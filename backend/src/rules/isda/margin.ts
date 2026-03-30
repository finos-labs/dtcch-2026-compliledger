import type { Rule } from "../types";

/**
 * ISDA margin rule: verifies that the initial margin ratio meets the
 * minimum threshold required under ISDA Credit Support Annex (CSA) terms.
 */
export const isdaMarginRule: Rule = {
  id: "ISDA_MARGIN_001",
  evaluate(input: { margin_ratio?: number }) {
    const MIN_MARGIN_RATIO = 1.0;
    if (input.margin_ratio === undefined || input.margin_ratio === null) {
      return { passed: false, reason_code: "MARGIN_RATIO_MISSING" };
    }
    if (input.margin_ratio < MIN_MARGIN_RATIO) {
      return { passed: false, reason_code: "MARGIN_RATIO_BELOW_MINIMUM" };
    }
    return { passed: true };
  },
};
