import type { Rule } from "../types";

interface CollateralItem {
  value: number;
  currency: string;
  fx_rate_to_base?: number;
  haircut?: number;
  eligible?: boolean;
}

interface ISDAMarginInput {
  mtm_exposure?: unknown;
  threshold_amount?: unknown;
  minimum_transfer_amount?: unknown;
  independent_amount?: unknown;
  posted_collateral?: unknown;
  eligible_collateral?: unknown;
  base_currency?: unknown;
  required_margin?: unknown;
  posted_collateral_value?: unknown;
}

function adjustedCollateralValue(items: CollateralItem[]): number {
  return items
    .filter((c) => c.eligible !== false)
    .reduce((sum, c) => {
      const fxRate = c.fx_rate_to_base ?? 1;
      const haircut = c.haircut ?? 0;
      return sum + c.value * fxRate * (1 - haircut);
    }, 0);
}

export const isdaMarginRule: Rule = {
  id: "ISDA_MARGIN_SUFFICIENCY",
  evaluate(input: ISDAMarginInput) {
    const mtmExposure = Number(input.mtm_exposure ?? 0);
    const threshold = Number(input.threshold_amount ?? 0);
    const mta = Number(input.minimum_transfer_amount ?? 0);
    const independentAmount = Number(input.independent_amount ?? 0);

    const creditSupportAmount = Math.max(mtmExposure - threshold, 0) + independentAmount;

    let adjustedPosted = 0;
    if (Array.isArray(input.posted_collateral)) {
      adjustedPosted = adjustedCollateralValue(input.posted_collateral as CollateralItem[]);
    } else if (Array.isArray(input.eligible_collateral)) {
      adjustedPosted = adjustedCollateralValue(input.eligible_collateral as CollateralItem[]);
    } else {
      const legacyPosted = Number(input.posted_collateral_value ?? input.required_margin ?? 0);
      const legacyRequired = Number(input.required_margin ?? input.mtm_exposure ?? 0);
      if (!isNaN(legacyPosted) && !isNaN(legacyRequired) && legacyPosted >= legacyRequired) {
        return { status: "PASS" as const };
      }
      return { status: "FAIL" as const, reason_code: "INSUFFICIENT_MARGIN" };
    }

    const callAmount = creditSupportAmount - adjustedPosted;

    if (callAmount > mta) {
      return {
        status: "FAIL" as const,
        reason_code: `MARGIN_CALL_REQUIRED_AMOUNT_${Math.round(callAmount)}`,
      };
    }

    if (adjustedPosted < creditSupportAmount * 0.95) {
      return { status: "CONDITIONAL" as const, reason_code: "MARGIN_NEAR_THRESHOLD" };
    }

    return { status: "PASS" as const };
  },
};
