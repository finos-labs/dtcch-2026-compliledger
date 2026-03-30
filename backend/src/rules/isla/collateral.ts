import type { Rule } from "../types";

export const islaCollateralRule: Rule = {
  id: "ISLA_COLLATERAL_COVERAGE",
  evaluate(input: { collateral_value?: unknown; loan_value?: unknown; haircut?: unknown }) {
    const collateralValue = Number(input.collateral_value);
    const loanValue = Number(input.loan_value);
    const haircut = Number(input.haircut);
    if (isNaN(collateralValue) || isNaN(loanValue) || isNaN(haircut)) {
      return { passed: false, reason_code: "INSUFFICIENT_COLLATERAL" };
    }
    const requiredCoverage = loanValue * (1 + haircut);
    if (collateralValue >= requiredCoverage) {
      return { passed: true };
    }
    return { passed: false, reason_code: "INSUFFICIENT_COLLATERAL" };
  },
};
