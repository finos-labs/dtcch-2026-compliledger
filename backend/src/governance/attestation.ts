import type { Attestation, SignedAttestation, AssetType } from "../core/types";
import { canonicalStringify, sha256, signData } from "../core/crypto";

const ATTESTATION_VERSION = "sg-attest-v1";
const SIGNER_NAME = "SettlementGuard";
const KEY_ID = "sg-demo-key-01";

export function issueAttestation(
  intentId: string,
  intentHash: string,
  bundleRootHash: string,
  assetType: AssetType
): SignedAttestation {
  const issuedAt = new Date().toISOString();

  const attestation: Attestation = {
    attestation_version: ATTESTATION_VERSION,
    asset_type: assetType,
    intent_id: intentId,
    intent_hash: intentHash,
    bundle_root_hash: bundleRootHash,
    decision: "ALLOW",
    issued_at: issuedAt,
    signer: {
      name: SIGNER_NAME,
      key_id: KEY_ID,
    },
  };

  const attestationHash = sha256(canonicalStringify(attestation));
  const signature = signData(attestationHash);

  return {
    attestation,
    attestation_hash: attestationHash,
    signature,
  };
}

export function recomputeAttestationHash(attestationJson: string): string {
  const parsed = JSON.parse(attestationJson);
  return sha256(canonicalStringify(parsed));
}
