import { createHash } from "crypto";
import nacl from "tweetnacl";
import naclUtil from "tweetnacl-util";
import { signWithKMS, getKMSPublicKey, isKMSEnabled, getKMSKeyMetadata } from "./signing/kms-signer";

let keyPair: nacl.SignKeyPair | null = null;

const DEFAULT_KEY_ID = "sg-prod-key-01";
const DEFAULT_KEY_VERSION = "v1";

function getKeyPair(): nacl.SignKeyPair {
  if (!keyPair) {
    const seedB64 = process.env.SG_SIGNING_SEED_B64;
    if (!seedB64) {
      throw new Error("Missing SG_SIGNING_SEED_B64 environment variable");
    }
    const seed = Buffer.from(seedB64, "base64");
    if (seed.length !== 32) {
      throw new Error("SG_SIGNING_SEED_B64 must decode to exactly 32 bytes");
    }
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

export function getSigningKeyId(): string {
  if (isKMSEnabled()) return getKMSKeyMetadata().key_id;
  return process.env.SG_KEY_ID || DEFAULT_KEY_ID;
}

export function getSigningKeyVersion(): string {
  if (isKMSEnabled()) return getKMSKeyMetadata().algorithm;
  return process.env.SG_KEY_VERSION || DEFAULT_KEY_VERSION;
}

export async function signDataAsync(dataHash: string): Promise<string> {
  if (isKMSEnabled()) {
    return signWithKMS(dataHash);
  }
  return signData(dataHash);
}

export async function getPublicKeyAsync(): Promise<string> {
  if (isKMSEnabled()) {
    return getKMSPublicKey();
  }
  return getPublicKeyB64();
}

export function getSigningProvider(): "kms" | "local-ed25519" {
  return isKMSEnabled() ? "kms" : "local-ed25519";
}
