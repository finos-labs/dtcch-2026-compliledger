export type RuleStatus = "PASS" | "FAIL" | "CONDITIONAL";

export interface RuleResult {
  status: RuleStatus;
  reason_code?: string;
  metadata?: Record<string, unknown>;
}

export interface Rule {
  id: string;
  evaluate(input: any): RuleResult;
}
