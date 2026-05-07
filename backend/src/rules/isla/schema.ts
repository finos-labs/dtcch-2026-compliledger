/**
 * Input validation schema for the ISLA rule pack.
 *
 * Ensures eligibility and collateral coverage rules receive a well-formed
 * payload before evaluation. Missing required fields produce a 400 at the
 * endpoint rather than being silently coerced into an INSUFFICIENT_COLLATERAL
 * or INELIGIBLE_COLLATERAL FAIL.
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

export function validateISLAPayload(payload: unknown): SchemaValidationResult {
  const errors: string[] = [];

  if (!isPlainObject(payload)) {
    return { ok: false, errors: ["payload must be an object"] };
  }

  // Eligibility rule inputs — both required.
  if (!("collateral_type" in payload)) {
    errors.push("collateral_type is required");
  } else if (typeof payload.collateral_type !== "string") {
    errors.push("collateral_type must be a string");
  }

  if (!("allowed_types" in payload)) {
    errors.push("allowed_types is required");
  } else if (!Array.isArray(payload.allowed_types)) {
    errors.push("allowed_types must be an array of strings");
  } else {
    payload.allowed_types.forEach((t, idx) => {
      if (typeof t !== "string") {
        errors.push(`allowed_types[${idx}] must be a string`);
      }
    });
  }

  // Coverage rule — loan_value is always required.
  if (!("loan_value" in payload)) {
    errors.push("loan_value is required");
  } else if (!isFiniteNumber(payload.loan_value)) {
    errors.push("loan_value must be a number");
  }

  // Coverage requires either an itemised array OR collateral_value.
  if (Array.isArray(payload.collateral_items)) {
    payload.collateral_items.forEach((item, idx) => {
      if (!isPlainObject(item)) {
        errors.push(`collateral_items[${idx}] must be an object`);
        return;
      }
      if (!isFiniteNumber(item.value)) {
        errors.push(`collateral_items[${idx}].value must be a number`);
      }
      if (typeof item.currency !== "string") {
        errors.push(`collateral_items[${idx}].currency must be a string`);
      }
      if (item.fx_rate_to_base !== undefined && !isFiniteNumber(item.fx_rate_to_base)) {
        errors.push(`collateral_items[${idx}].fx_rate_to_base must be a number`);
      }
      if (item.haircut !== undefined && !isFiniteNumber(item.haircut)) {
        errors.push(`collateral_items[${idx}].haircut must be a number`);
      }
      if (item.eligible !== undefined && typeof item.eligible !== "boolean") {
        errors.push(`collateral_items[${idx}].eligible must be a boolean`);
      }
    });
  } else if (!("collateral_value" in payload)) {
    errors.push("collateral_value is required (or provide collateral_items array)");
  } else if (!isFiniteNumber(payload.collateral_value)) {
    errors.push("collateral_value must be a number");
  }

  // Optional numeric fields — type-check if present.
  for (const f of ["haircut", "margin_ratio"]) {
    if (f in payload && !isFiniteNumber((payload as Record<string, unknown>)[f])) {
      errors.push(`${f} must be a number when present`);
    }
  }

  if ("concentration_limits" in payload) {
    if (!Array.isArray(payload.concentration_limits)) {
      errors.push("concentration_limits must be an array when present");
    } else {
      payload.concentration_limits.forEach((entry, idx) => {
        if (!isPlainObject(entry)) {
          errors.push(`concentration_limits[${idx}] must be an object`);
          return;
        }
        if (
          entry.dimension !== "issuer" &&
          entry.dimension !== "country" &&
          entry.dimension !== "sector"
        ) {
          errors.push(
            `concentration_limits[${idx}].dimension must be 'issuer', 'country' or 'sector'`
          );
        }
        if (typeof entry.key !== "string") {
          errors.push(`concentration_limits[${idx}].key must be a string`);
        }
        if (!isFiniteNumber(entry.max_pct)) {
          errors.push(`concentration_limits[${idx}].max_pct must be a number`);
        }
      });
    }
  }

  return { ok: errors.length === 0, errors };
}
