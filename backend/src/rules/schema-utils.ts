/**
 * Shared helpers for rule-pack input schema validators.
 *
 * Each rule pack has its own `schema.ts` that uses these primitives to
 * validate the demo endpoint payload shape before the deterministic rules
 * are evaluated.
 */

export interface SchemaValidationResult {
  ok: boolean;
  errors: string[];
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isFiniteNumber(value: unknown): boolean {
  return typeof value === "number" && Number.isFinite(value);
}
