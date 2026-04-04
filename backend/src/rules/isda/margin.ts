import type { Rule } from "../types";

export const isdaMarginRule: Rule = {
  id: "ISDA_MARGIN_SUFFICIENCY",
  evaluate(input: { required_margin?: unknown; posted_collateral_value?: unknown }) {
    const required = Number(input.required_margin);
    const posted = Number(input.posted_collateral_value);
    if (!isNaN(required) && !isNaN(posted) && posted >= required) {
      return { status: "PASS" as const };
    }
    return { status: "FAIL" as const, reason_code: "INSUFFICIENT_MARGIN" };
  },
};
