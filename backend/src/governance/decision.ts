import type { ProofStepResult, DecisionRecord, Decision } from "../core/types";
import { sha256 } from "../core/crypto";

export function computeDecision(
  steps: ProofStepResult[],
  bundleRootHash: string
): DecisionRecord {
  const allPassed = steps.every((s) => s.pass);
  const decision: Decision = allPassed ? "ALLOW" : "DENY";
  const decisionHash = sha256(`${bundleRootHash}|${decision}`);

  return {
    decision,
    decision_hash: decisionHash,
    bundle_root_hash: bundleRootHash,
  };
}
