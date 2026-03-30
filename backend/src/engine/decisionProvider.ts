import type { Rule } from "../rules/types";
import type { RuleRegistry } from "./ruleRegistry";

export interface RuleResult {
  rule_id: string;
  passed: boolean;
  reason_code?: string;
}

export interface DecisionResult {
  passed: boolean;
  results: RuleResult[];
}

/**
 * Evaluates all registered rules against the provided input and returns
 * an aggregated decision result.
 */
export function evaluateRules(registry: RuleRegistry, input: any): DecisionResult {
  const rules: Rule[] = registry.getAll();
  const results: RuleResult[] = rules.map((rule) => {
    const outcome = rule.evaluate(input);
    return { rule_id: rule.id, ...outcome };
  });

  const passed = results.every((r) => r.passed);
  return { passed, results };
}
