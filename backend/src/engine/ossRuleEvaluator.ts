import { RuleRegistry, ruleRegistry } from "./ruleRegistry";
import { evaluateRules } from "./decisionProvider";
import type { OssEvaluation } from "../types";

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

  const registry = new RuleRegistry();
  for (const rule of rules) {
    registry.register(rule);
  }

  const result = evaluateRules(registry, payload);

  const reason_codes = result.results
    .filter((r) => !r.passed && r.reason_code)
    .map((r) => r.reason_code as string);

  return {
    rule_pack,
    decision: result.passed ? "ALLOW" : "DENY",
    reason_codes,
  };
}
