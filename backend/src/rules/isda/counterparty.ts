import type { Rule } from "../types";

export const isdaCounterpartyRule: Rule = {
  id: "ISDA_COUNTERPARTY_VALID",
  evaluate(input: { counterparty_status?: unknown }) {
    if (input.counterparty_status === "ACTIVE") {
      return { status: "PASS" as const };
    }
    return { status: "FAIL" as const, reason_code: "INVALID_COUNTERPARTY" };
  },
};
