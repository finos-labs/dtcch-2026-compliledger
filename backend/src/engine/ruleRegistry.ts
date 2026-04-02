import type { Rule } from "../rules/types";
import { isdaCounterpartyRule } from "../rules/isda/counterparty";
import { isdaMarginRule } from "../rules/isda/margin";
import { islaCollateralRule } from "../rules/isla/collateral";
import { islaEligibilityRule } from "../rules/isla/eligibility";
import { icmaRepoRule } from "../rules/icma/repo";
import { icmaMaturityRule } from "../rules/icma/maturity";

/**
 * Central registry that stores and retrieves Rule instances by their id.
 */
export class RuleRegistry {
  private readonly rules = new Map<string, Rule>();

  register(rule: Rule): void {
    this.rules.set(rule.id, rule);
  }

  get(id: string): Rule | undefined {
    return this.rules.get(id);
  }

  getAll(): Rule[] {
    return Array.from(this.rules.values());
  }
}

export const defaultRegistry = new RuleRegistry();

export const ruleRegistry = {
  ISDA: [isdaCounterpartyRule, isdaMarginRule],
  ISLA: [islaEligibilityRule, islaCollateralRule],
  ICMA: [icmaRepoRule, icmaMaturityRule],
};
