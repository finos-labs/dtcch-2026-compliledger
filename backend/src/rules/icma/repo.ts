import type { Rule } from "../types";

export const icmaRepoRule: Rule = {
  id: "ICMA_REPO_COLLATERAL_SUFFICIENCY",
  evaluate(input: { purchase_price?: unknown; collateral_value?: unknown; haircut?: unknown }) {
    const purchasePrice = Number(input.purchase_price);
    const collateralValue = Number(input.collateral_value);
    const haircut = Number(input.haircut);
    const requiredCoverage = purchasePrice * (1 + haircut);
    if (collateralValue >= requiredCoverage) {
      return { passed: true };
    }
    return { passed: false, reason_code: "COLLATERAL_DEFICIT" };
  },
};
