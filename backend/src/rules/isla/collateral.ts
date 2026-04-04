import type { Rule } from "../types";

export const islaCollateralRule: Rule = {
  id: "ISLA_COLLATERAL_COVERAGE",
  evaluate(input: { collateral_value?: unknown; loan_value?: unknown; haircut?: unknown }) {
    const collateralValue = Number(input.collateral_value);
    const loanValue = Number(input.loan_value);
    const haircut = Number(input.haircut);
    if (isNaN(collateralValue) || isNaN(loanValue) || isNaN(haircut)) {
      return { status: "FAIL" as const, reason_code: "INSUFFICIENT_COLLATERAL" };
    }
    const requiredCoverage = loanValue * (1 + haircut);
    if (collateralValue >= requiredCoverage) {
      return { status: "PASS" as const };
    }
    return { status: "FAIL" as const, reason_code: "INSUFFICIENT_COLLATERAL" };
  },
};
