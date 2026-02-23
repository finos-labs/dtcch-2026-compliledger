import { createHash } from "crypto";
import nacl from "tweetnacl";
import naclUtil from "tweetnacl-util";

let keyPair: nacl.SignKeyPair | null = null;

function getKeyPair(): nacl.SignKeyPair {
  if (!keyPair) {
    const seed = createHash("sha256")
      .update("sg-demo-key-01-seed-deterministic")
      .digest();
    keyPair = nacl.sign.keyPair.fromSeed(new Uint8Array(seed));
  }
  return keyPair;
}

export function canonicalSerialize(obj: unknown): string {
  return JSON.stringify(obj, Object.keys(obj as Record<string, unknown>).sort());
}

function sortKeysDeep(obj: unknown): unknown {
  if (Array.isArray(obj)) {
    return obj.map(sortKeysDeep);
  }
  if (obj !== null && typeof obj === "object") {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(obj as Record<string, unknown>).sort()) {
      sorted[key] = sortKeysDeep((obj as Record<string, unknown>)[key]);
    }
    return sorted;
  }
  return obj;
}

export function canonicalStringify(obj: unknown): string {
  return JSON.stringify(sortKeysDeep(obj));
}

export function sha256(data: string): string {
  return createHash("sha256").update(data, "utf8").digest("hex");
}

export function signData(dataHash: string): string {
  const kp = getKeyPair();
  const messageBytes = naclUtil.decodeUTF8(dataHash);
  const signatureBytes = nacl.sign.detached(messageBytes, kp.secretKey);
  return naclUtil.encodeBase64(signatureBytes);
}

export function verifySignature(dataHash: string, signatureB64: string): boolean {
  const kp = getKeyPair();
  try {
    const messageBytes = naclUtil.decodeUTF8(dataHash);
    const signatureBytes = naclUtil.decodeBase64(signatureB64);
    return nacl.sign.detached.verify(messageBytes, signatureBytes, kp.publicKey);
  } catch {
    return false;
  }
}

export function getPublicKeyB64(): string {
  const kp = getKeyPair();
  return naclUtil.encodeBase64(kp.publicKey);
}
