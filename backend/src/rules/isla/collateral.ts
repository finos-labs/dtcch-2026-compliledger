import type { Rule } from "../types";

/**
 * ISLA collateral eligibility rule: verifies that posted collateral is
 * eligible under ISLA Global Master Securities Lending Agreement (GMSLA) terms.
 */
export const islaCollateralRule: Rule = {
  id: "ISLA_COLLATERAL_001",
  evaluate(input: { collateral_eligible?: boolean; collateral_type?: string }) {
    if (input.collateral_eligible === undefined || input.collateral_eligible === null) {
      return { passed: false, reason_code: "COLLATERAL_ELIGIBILITY_MISSING" };
    }
    if (!input.collateral_eligible) {
      return { passed: false, reason_code: "COLLATERAL_NOT_ELIGIBLE" };
    }
    return { passed: true };
  },
};
