import type { Rule } from "../types";

export const islaEligibilityRule: Rule = {
  id: "ISLA_COLLATERAL_ELIGIBILITY",
  evaluate(input: { collateral_type?: unknown; allowed_types?: unknown }) {
    const collateralType = input.collateral_type;
    const allowedTypes = input.allowed_types;
    if (!Array.isArray(allowedTypes) || !allowedTypes.includes(collateralType)) {
      return { passed: false, reason_code: "INELIGIBLE_COLLATERAL" };
    }
    return { passed: true };
  },
};
