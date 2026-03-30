import type { Rule } from "../types";

/**
 * ICMA repo haircut rule: verifies that the repo haircut applied to collateral
 * meets the minimum required under ICMA Global Master Repurchase Agreement (GMRA) terms.
 */
export const icmaRepoRule: Rule = {
  id: "ICMA_REPO_001",
  evaluate(input: { haircut?: number }) {
    const MAX_HAIRCUT = 0.5;
    if (input.haircut === undefined || input.haircut === null) {
      return { passed: false, reason_code: "HAIRCUT_MISSING" };
    }
    if (input.haircut < 0 || input.haircut > MAX_HAIRCUT) {
      return { passed: false, reason_code: "HAIRCUT_OUT_OF_RANGE" };
    }
    return { passed: true };
  },
};
