import { ruleRegistry, RuleRegistry } from "./ruleRegistry";
import { evaluate as ossEvaluate, type RulePack } from "./ossRuleEvaluator";
import type { SettlementDecisionInput, SettlementDecisionResult } from "../types";

/** Maps each rule pack to a human-readable version string for audit trails. */
const RULE_VERSIONS: Record<string, string> = {
  ISDA: "isda-2002-v1",
  ISLA: "isla-gmsla-2010-v1",
  ICMA: "icma-gmra-2011-v1",
};

export function evaluate(rulePack: string, payload: any): { decision: "PASS" | "FAIL"; reason_codes: string[] } {
  if (!(rulePack in ruleRegistry)) {
    throw new Error(`Unsupported rule pack: ${rulePack}`);
  }
  const rules = ruleRegistry[rulePack as keyof typeof ruleRegistry];

  const reason_codes: string[] = [];
  for (const rule of rules) {
    const outcome = rule.evaluate(payload);
    if (!outcome.passed && outcome.reason_code) {
      reason_codes.push(outcome.reason_code);
    }
  }

  return {
    decision: reason_codes.length === 0 ? "PASS" : "FAIL",
    reason_codes,
  };
}

/**
 * Evaluate a settlement decision using the OSS rule engine.
 * Called before proof bundle generation so the result can be embedded in
 * the bundle metadata as decision_result / reason_codes / rule_version_used / evaluated_at.
 */
export function evaluateSettlementDecision(
  input: SettlementDecisionInput
): SettlementDecisionResult {
  const oss = ossEvaluate(input.rule_pack as RulePack, input.payload);
  return {
    decision_result: oss.decision,
    reason_codes: oss.reason_codes,
    rule_version_used: RULE_VERSIONS[input.rule_pack] ?? `${input.rule_pack}-v1`,
    evaluated_at: new Date().toISOString(),
  };
}

export function evaluateRules(
  registry: RuleRegistry,
  payload: unknown
): { passed: boolean; results: Array<{ passed: boolean; reason_code?: string }> } {
  const rules = registry.getAll();
  const results = rules.map((rule) => rule.evaluate(payload));
  return { passed: results.every((r) => r.passed), results };
}
