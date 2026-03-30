import { ruleRegistry } from "./ruleRegistry";

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
