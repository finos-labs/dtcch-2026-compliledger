import { evaluate } from "./decisionProvider";

export type Phase = "CLEARING" | "SETTLEMENT";
export type DecisionResult = "PASS" | "FAIL" | "CONDITIONAL";
export type RulePack = "ISDA" | "ISLA" | "ICMA";

export interface SettlementDecisionRequest {
  transaction_id: string;
  phase: Phase;
  rule_pack: RulePack;
  event_type: string;
  payload: Record<string, unknown>;
}

export interface SettlementDecisionResponse {
  transaction_id: string;
  phase: Phase;
  rule_pack: RulePack;
  event_type: string;
  result: DecisionResult;
  reason_codes: string[];
  evaluated_at: string;
}

/**
 * Thin orchestration layer that sits between rule evaluation and
 * proof/attestation generation.
 *
 * Maps raw rule outcomes to a normalised tri-state DecisionResult:
 *   PASS        – all rules passed
 *   CONDITIONAL – one or more rules failed during the CLEARING phase
 *                 (clearing may proceed subject to the reported conditions)
 *   FAIL        – one or more rules failed during the SETTLEMENT phase
 */
export function evaluateSettlementDecision(
  request: SettlementDecisionRequest
): SettlementDecisionResponse {
  const { transaction_id, phase, rule_pack, event_type, payload } = request;

  const { decision, reason_codes } = evaluate(rule_pack, payload);

  let result: DecisionResult;
  if (decision === "PASS") {
    result = "PASS";
  } else if (phase === "CLEARING") {
    result = "CONDITIONAL";
  } else {
    result = "FAIL";
  }

  return {
    transaction_id,
    phase,
    rule_pack,
    event_type,
    result,
    reason_codes,
    evaluated_at: new Date().toISOString(),
  };
}
