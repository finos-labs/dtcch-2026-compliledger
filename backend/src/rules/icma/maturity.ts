import type { Rule } from "../types";

export const icmaMaturityRule: Rule = {
  id: "ICMA_REPO_MATURITY_VALID",
  evaluate(input: { current_date?: unknown; end_date?: unknown }) {
    const currentDate = Number(input.current_date);
    const endDate = Number(input.end_date);
    if (currentDate <= endDate) {
      return { status: "PASS" as const };
    }
    return { status: "FAIL" as const, reason_code: "REPO_EXPIRED" };
  },
};
