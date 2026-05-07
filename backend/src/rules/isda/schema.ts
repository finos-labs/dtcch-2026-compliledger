/**
 * Input validation schema for the ISDA rule pack.
 *
 * Validates the shape of the payload before it is handed to the deterministic
 * rules. Returns a list of validation errors when the payload is invalid so
 * the demo endpoint can respond with a clear 400 instead of silently coercing
 * missing or wrong-typed fields into a FAIL outcome.
 */

export interface SchemaValidationResult {
  ok: boolean;
  errors: string[];
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): boolean {
  return typeof value === "number" && Number.isFinite(value);
}

export function validateISDAPayload(payload: unknown): SchemaValidationResult {
  const errors: string[] = [];

  if (!isPlainObject(payload)) {
    return { ok: false, errors: ["payload must be an object"] };
  }

  // counterparty_status — required, string
  if (!("counterparty_status" in payload)) {
    errors.push("counterparty_status is required");
  } else if (typeof payload.counterparty_status !== "string") {
    errors.push("counterparty_status must be a string");
  }

  // Margin sufficiency requires either an array form (posted_collateral or
  // eligible_collateral) OR the legacy numeric form (required_margin and
  // posted_collateral_value). We require one complete form to be present so
  // the rule is not run against silently coerced zeros.
  const hasPostedArray = Array.isArray((payload as Record<string, unknown>).posted_collateral);
  const hasEligibleArray = Array.isArray(
    (payload as Record<string, unknown>).eligible_collateral
  );

  if (hasPostedArray || hasEligibleArray) {
    const arr = (hasPostedArray
      ? (payload as Record<string, unknown>).posted_collateral
      : (payload as Record<string, unknown>).eligible_collateral) as unknown[];
    arr.forEach((item, idx) => {
      if (!isPlainObject(item)) {
        errors.push(`collateral[${idx}] must be an object`);
        return;
      }
      if (!isFiniteNumber(item.value)) {
        errors.push(`collateral[${idx}].value must be a number`);
      }
      if (typeof item.currency !== "string") {
        errors.push(`collateral[${idx}].currency must be a string`);
      }
      if (item.fx_rate_to_base !== undefined && !isFiniteNumber(item.fx_rate_to_base)) {
        errors.push(`collateral[${idx}].fx_rate_to_base must be a number`);
      }
      if (item.haircut !== undefined && !isFiniteNumber(item.haircut)) {
        errors.push(`collateral[${idx}].haircut must be a number`);
      }
      if (item.eligible !== undefined && typeof item.eligible !== "boolean") {
        errors.push(`collateral[${idx}].eligible must be a boolean`);
      }
    });
  } else {
    // Legacy numeric form
    if (!("required_margin" in payload)) {
      errors.push(
        "required_margin is required (or provide posted_collateral / eligible_collateral arrays)"
      );
    } else if (!isFiniteNumber((payload as Record<string, unknown>).required_margin)) {
      errors.push("required_margin must be a number");
    }

    if (!("posted_collateral_value" in payload)) {
      errors.push(
        "posted_collateral_value is required (or provide posted_collateral / eligible_collateral arrays)"
      );
    } else if (!isFiniteNumber((payload as Record<string, unknown>).posted_collateral_value)) {
      errors.push("posted_collateral_value must be a number");
    }
  }

  // Optional numeric fields — type-check if present.
  for (const f of ["mtm_exposure", "threshold_amount", "minimum_transfer_amount", "independent_amount"]) {
    if (f in payload && !isFiniteNumber((payload as Record<string, unknown>)[f])) {
      errors.push(`${f} must be a number when present`);
    }
  }

  return { ok: errors.length === 0, errors };
}
