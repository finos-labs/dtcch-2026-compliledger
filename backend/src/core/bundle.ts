import type { SettlementIntent, ProofStepResult, ProofBundle } from "./types";
import { canonicalStringify, sha256 } from "./crypto";

const BUNDLE_VERSION = "sg-v1";

export function sealBundle(
  intentHash: string,
  receivedAt: string,
  intent: SettlementIntent,
  steps: ProofStepResult[]
): ProofBundle {
  const bundle: Omit<ProofBundle, "bundle_root_hash"> = {
    bundle_version: BUNDLE_VERSION,
    asset_type: intent.asset_type,
    intent_hash: intentHash,
    received_at: receivedAt,
    steps,
  };

  const bundleRootHash = sha256(canonicalStringify(bundle));

  return {
    ...bundle,
    bundle_root_hash: bundleRootHash,
  };
}
