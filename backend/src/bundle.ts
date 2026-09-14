import type {
  SettlementIntent,
  ProofStepResult,
  ProofBundle,
  OssEvaluation,
  SettlementDecisionResult,
} from "./types";
import type { CdmEligibilityAssessment } from "./cdm/types";
import { canonicalStringify, sha256 } from "./crypto";

const BUNDLE_VERSION = "sg-v1";

export function sealBundle(
  intentHash: string,
  receivedAt: string,
  intent: SettlementIntent,
  steps: ProofStepResult[],
  ossEvaluation?: OssEvaluation,
  settlementDecision?: SettlementDecisionResult,
  cdmEligibilityAssessment?: CdmEligibilityAssessment
): ProofBundle {
  const bundle: Omit<ProofBundle, "bundle_root_hash"> = {
    bundle_version: BUNDLE_VERSION,
    asset_type: intent.asset_type,
    intent_hash: intentHash,
    received_at: receivedAt,
    steps,
    ...(ossEvaluation && { oss_evaluation: ossEvaluation }),
    ...(settlementDecision && { settlement_decision: settlementDecision }),
    ...(cdmEligibilityAssessment && { cdm_eligibility_assessment: cdmEligibilityAssessment }),
  };

  const bundleRootHash = sha256(canonicalStringify(bundle));

  return {
    ...bundle,
    bundle_root_hash: bundleRootHash,
  };
}
