import {
  CONTRIBUTION_ID,
  type AdaptedCollateral,
  type AdapterEnvelope,
  type CollateralFact,
  type OptionalMapping,
  type Reason,
} from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

// Accept JSON data only: snapshots must not silently lose undefined, functions,
// cycles or non-finite numbers in an assessment.
export function snapshot(value: unknown): unknown {
  const seen = new Set<object>();
  function visit(item: unknown): unknown {
    if (item === null || typeof item === "string" || typeof item === "boolean") return item;
    if (typeof item === "number" && Number.isFinite(item)) return item;
    if (typeof item !== "object") throw new TypeError("Expected JSON data");
    if (seen.has(item)) throw new TypeError("Cyclic input");
    if (!Array.isArray(item) && Object.getPrototypeOf(item) !== Object.prototype) {
      throw new TypeError("Expected plain JSON object");
    }
    seen.add(item);
    const copy: unknown = Array.isArray(item)
      ? item.map(visit)
      : Object.fromEntries(Object.entries(item).map(([key, entry]) => [key, visit(entry)]));
    seen.delete(item);
    return copy;
  }
  return visit(value);
}

function nonblank(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isMapping(value: unknown): value is OptionalMapping {
  return isRecord(value) && nonblank(value.factRef) && nonblank(value.sourcePath) &&
    nonblank(value.mappingId) && nonblank(value.mappingVersion) &&
    value.status === "CALLER_SUPPLIED_UNVALIDATED";
}

function lookup(object: unknown, path: string): { found: boolean; value?: unknown } {
  let current: unknown = object;
  for (const segment of path.split(".")) {
    if (!segment || !isRecord(current) || !Object.hasOwn(current, segment)) return { found: false };
    current = current[segment];
  }
  return { found: true, value: current };
}

export function adaptCollateralInput(input: unknown): AdaptedCollateral {
  const diagnostics: Reason[] = [];
  const envelope = isRecord(input) ? input as Partial<AdapterEnvelope> : {};
  const sourceReference = nonblank(envelope.sourceReference) ? envelope.sourceReference : null;
  let sourceObject: unknown = null;
  try {
    sourceObject = snapshot(envelope.sourceObject);
    if (!isRecord(sourceObject)) throw new TypeError("Source object must be a JSON object");
  } catch {
    diagnostics.push({ code: "ADAPTER_INPUT_INVALID", message: "Source object must be a plain JSON object" });
  }
  if (!sourceReference) {
    diagnostics.push({ code: "ADAPTER_INPUT_INVALID", message: "Source reference is required" });
  }
  const mappings: OptionalMapping[] = [];
  if (envelope.mappings !== undefined && !Array.isArray(envelope.mappings)) {
    diagnostics.push({ code: "MAPPING_INVALID", message: "Mappings must be an array" });
  } else {
    const seen = new Set<string>();
    for (const value of envelope.mappings ?? []) {
      if (!isMapping(value) || seen.has(value.factRef) || value.sourcePath.split(".").some((part) => !part)) {
        diagnostics.push({ code: "MAPPING_INVALID", message: "Mapping is malformed or duplicates a fact reference" });
        continue;
      }
      seen.add(value.factRef);
      mappings.push({
        factRef: value.factRef, sourcePath: value.sourcePath,
        mappingId: value.mappingId, mappingVersion: value.mappingVersion,
        status: value.status,
      });
    }
  }
  const expected = envelope.expectedFactRefs;
  if (expected !== undefined && (!Array.isArray(expected) || !expected.every(nonblank))) {
    diagnostics.push({ code: "MAPPING_INVALID", message: "Expected fact references must be nonempty strings" });
  }
  const facts: CollateralFact[] = [];
  const refs = [...new Set([
    ...((Array.isArray(expected) && expected.every(nonblank)) ? expected : []),
    ...mappings.map((mapping) => mapping.factRef),
  ])].sort();
  for (const factRef of refs) {
    const mapping = mappings.find((candidate) => candidate.factRef === factRef);
    const source = { sourceReference: sourceReference ?? "", ...(mapping && { sourcePath: mapping.sourcePath }) };
    const found = mapping && sourceReference && sourceObject !== null
      ? lookup(sourceObject, mapping.sourcePath) : { found: false };
    facts.push(found.found
      ? {
          kind: "SOURCE", factRef, observedValue: found.value, source,
          mappingId: mapping!.mappingId, mappingVersion: mapping!.mappingVersion,
          mappingStatus: "CALLER_SUPPLIED_UNVALIDATED",
        }
      : { kind: "UNAVAILABLE", factRef, source, mappingStatus: mapping ? "CALLER_SUPPLIED_UNVALIDATED" : "UNMAPPED" });
  }
  return {
    contributionId: CONTRIBUTION_ID, sourceObject, sourceReference,
    sourceValidation: "PENDING_SOURCE_VALIDATION", mappings, facts, diagnostics,
  };
}
