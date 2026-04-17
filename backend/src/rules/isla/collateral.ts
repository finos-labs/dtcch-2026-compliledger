import type { Rule } from "../types";

interface ISLACollateralItem {
  isin?: string;
  value: number;
  currency: string;
  fx_rate_to_base?: number;
  haircut?: number;
  eligible?: boolean;
  issuer_lei?: string;
  country?: string;
  sector?: string;
}

interface ConcentrationLimitEntry {
  dimension: "issuer" | "country" | "sector";
  key: string;
  max_pct: number;
}

interface ISLAInput {
  loan_value?: unknown;
  collateral_value?: unknown;
  haircut?: unknown;
  collateral_items?: unknown;
  margin_ratio?: unknown;
  concentration_limits?: unknown;
}

function haircutAdjustedValue(items: ISLACollateralItem[]): number {
  return items
    .filter((c) => c.eligible !== false)
    .reduce((sum, c) => {
      const fx = c.fx_rate_to_base ?? 1;
      const hc = c.haircut ?? 0;
      return sum + c.value * fx * (1 - hc);
    }, 0);
}

function checkConcentration(
  items: ISLACollateralItem[],
  limits: ConcentrationLimitEntry[]
): string | null {
  const totalValue = items.reduce((s, c) => s + (c.value * (c.fx_rate_to_base ?? 1)), 0);
  if (totalValue === 0) return null;

  for (const limit of limits) {
    const groupValue = items
      .filter((c) => {
        if (limit.dimension === "issuer") return c.issuer_lei === limit.key;
        if (limit.dimension === "country") return c.country === limit.key;
        if (limit.dimension === "sector") return c.sector === limit.key;
        return false;
      })
      .reduce((s, c) => s + c.value * (c.fx_rate_to_base ?? 1), 0);

    const pct = (groupValue / totalValue) * 100;
    if (pct > limit.max_pct) {
      return `CONCENTRATION_BREACH_${limit.dimension.toUpperCase()}_${limit.key}_${Math.round(pct)}PCT`;
    }
  }
  return null;
}

export const islaCollateralRule: Rule = {
  id: "ISLA_COLLATERAL_COVERAGE",
  evaluate(input: ISLAInput) {
    const loanValue = Number(input.loan_value ?? 0);
    const marginRatio = Number(input.margin_ratio ?? 1.05);
    const requiredCoverage = loanValue * marginRatio;

    if (Array.isArray(input.collateral_items)) {
      const items = input.collateral_items as ISLACollateralItem[];
      const adjustedValue = haircutAdjustedValue(items);

      if (adjustedValue < requiredCoverage) {
        return {
          status: "FAIL" as const,
          reason_code: `INSUFFICIENT_COLLATERAL_COVERAGE_${Math.round((adjustedValue / requiredCoverage) * 100)}PCT`,
        };
      }

      if (Array.isArray(input.concentration_limits) && input.concentration_limits.length > 0) {
        const concentrationBreach = checkConcentration(
          items,
          input.concentration_limits as ConcentrationLimitEntry[]
        );
        if (concentrationBreach) {
          return { status: "FAIL" as const, reason_code: concentrationBreach };
        }
      }

      const coverageRatio = adjustedValue / requiredCoverage;
      if (coverageRatio < 1.02) {
        return { status: "CONDITIONAL" as const, reason_code: "COLLATERAL_COVERAGE_NEAR_MINIMUM" };
      }

      return { status: "PASS" as const };
    }

    const collateralValue = Number(input.collateral_value ?? 0);
    const haircut = Number(input.haircut ?? 0);
    if (isNaN(collateralValue) || isNaN(loanValue)) {
      return { status: "FAIL" as const, reason_code: "INSUFFICIENT_COLLATERAL" };
    }
    const requiredFallback = loanValue * (1 + haircut);
    if (collateralValue >= requiredFallback) return { status: "PASS" as const };
    return { status: "FAIL" as const, reason_code: "INSUFFICIENT_COLLATERAL" };
  },
};
