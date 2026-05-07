/**
 * Input validation schema for the ICMA rule pack.
 *
 * Validates required repo and maturity fields up-front so that missing values
 * surface as a 400 error rather than being silently coerced into a
 * COLLATERAL_DEFICIT or REPO_EXPIRED FAIL.
 */

import { isFiniteNumber, isPlainObject, type SchemaValidationResult } from "../schema-utils";

export type { SchemaValidationResult };

export function validateICMAPayload(payload: unknown): SchemaValidationResult {
  const errors: string[] = [];

  if (!isPlainObject(payload)) {
    return { ok: false, errors: ["payload must be an object"] };
  }

  // Repo collateral sufficiency — required numeric fields.
  for (const f of ["purchase_price", "collateral_value"]) {
    if (!(f in payload)) {
      errors.push(`${f} is required`);
    } else if (!isFiniteNumber(payload[f])) {
      errors.push(`${f} must be a number`);
    }
  }

  // Maturity rule — both timestamps required.
  for (const f of ["current_date", "end_date"]) {
    if (!(f in payload)) {
      errors.push(`${f} is required`);
    } else if (!isFiniteNumber(payload[f])) {
      errors.push(`${f} must be a number`);
    }
  }

  // Optional numeric fields — type-check if present.
  for (const f of [
    "haircut",
    "repo_rate",
    "term_days",
    "repricing_threshold",
    "income_amount",
    "margin_maintenance_threshold",
    "current_exposure",
  ]) {
    if (f in payload && !isFiniteNumber(payload[f])) {
      errors.push(`${f} must be a number when present`);
    }
  }

  // Optional boolean fields — type-check if present.
  for (const f of ["counterparty_default_indicator", "income_paid"]) {
    if (f in payload && typeof payload[f] !== "boolean") {
      errors.push(`${f} must be a boolean when present`);
    }
  }

  return { ok: errors.length === 0, errors };
}
