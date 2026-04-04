import { ruleRegistry } from "./ruleRegistry";
import type { OssEvaluation, RuleDecision } from "../types";

export type RulePack = keyof typeof ruleRegistry;

/**
 * Thin integration layer between the OSS rule evaluation engine and the
 * existing proof/attestation pipeline.
 *
 * Accepts a rule_pack name (e.g. "ISDA", "ISLA", "ICMA") and an arbitrary
 * payload, runs the matching rule set, then returns a decision + reason_codes
 * ready to be embedded in the proof bundle metadata.
 */
export function evaluate(rule_pack: RulePack, payload: Record<string, unknown>): OssEvaluation {
  const rules = ruleRegistry[rule_pack];

  const results = rules.map((rule) => ({ rule_id: rule.id, ...rule.evaluate(payload) }));
  const reason_codes = results.filter((r) => r.status !== "PASS" && r.reason_code).map((r) => r.reason_code as string);

  let decision: RuleDecision;
  if (results.some((r) => r.status === "FAIL")) {
    decision = "FAIL";
  } else if (results.some((r) => r.status === "CONDITIONAL")) {
    decision = "CONDITIONAL";
  } else {
    decision = "PASS";
  }

  return { rule_pack, decision, reason_codes };
}
