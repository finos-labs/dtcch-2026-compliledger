import type { Rule } from "../types";

interface ICMARepoInput {
  purchase_price?: unknown;
  collateral_value?: unknown;
  haircut?: unknown;
  repo_rate?: unknown;
  term_days?: unknown;
  repricing_threshold?: unknown;
  income_amount?: unknown;
  income_paid?: unknown;
  counterparty_default_indicator?: unknown;
  margin_maintenance_threshold?: unknown;
  current_exposure?: unknown;
}

export const icmaRepoRule: Rule = {
  id: "ICMA_REPO_COLLATERAL_SUFFICIENCY",
  evaluate(input: ICMARepoInput) {
    const purchasePrice = Number(input.purchase_price ?? 0);
    const collateralValue = Number(input.collateral_value ?? 0);
    const haircut = Number(input.haircut ?? 0);
    const termDays = Number(input.term_days ?? 0);
    const repoRate = Number(input.repo_rate ?? 0);
    const repricingThreshold = Number(input.repricing_threshold ?? 0.02);
    const marginThreshold = Number(input.margin_maintenance_threshold ?? 0.01);

    if (input.counterparty_default_indicator === true) {
      return { status: "FAIL" as const, reason_code: "COUNTERPARTY_DEFAULT_EVENT" };
    }

    const repurchasePrice =
      termDays > 0 && repoRate > 0
        ? purchasePrice * (1 + repoRate * (termDays / 360))
        : purchasePrice;

    const requiredCollateral = repurchasePrice * (1 + haircut);

    if (collateralValue < requiredCollateral) {
      const deficit = requiredCollateral - collateralValue;
      const deficitPct = (deficit / requiredCollateral) * 100;
      return {
        status: "FAIL" as const,
        reason_code: `COLLATERAL_DEFICIT_${Math.round(deficitPct)}PCT`,
      };
    }

    if (repricingThreshold > 0) {
      const marketValue = Number(input.current_exposure ?? collateralValue);
      const deviation = Math.abs(marketValue - repurchasePrice) / repurchasePrice;
      if (deviation > repricingThreshold) {
        return { status: "CONDITIONAL" as const, reason_code: "REPRICING_REQUIRED" };
      }
    }

    const coverageRatio = collateralValue / requiredCollateral;
    if (coverageRatio < 1 + marginThreshold) {
      return { status: "CONDITIONAL" as const, reason_code: "MARGIN_MAINTENANCE_CALL_POTENTIAL" };
    }

    if (input.income_amount !== undefined && input.income_paid === false) {
      return { status: "CONDITIONAL" as const, reason_code: "MANUFACTURED_PAYMENT_PENDING" };
    }

    return { status: "PASS" as const };
  },
};
