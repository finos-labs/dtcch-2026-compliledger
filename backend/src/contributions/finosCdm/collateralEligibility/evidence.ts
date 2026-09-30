import { snapshot } from "./adapter";
import type { Evidence, EvidenceValidation, Reason } from "./types";

export function validateEvidence(input: unknown): EvidenceValidation {
  const evidence: Evidence[] = [];
  const diagnostics: Reason[] = [];
  if (input === undefined || input === null) {
    return { evidence, diagnostics: [{ code: "EVIDENCE_MISSING", message: "No evidence supplied" }] };
  }
  if (!Array.isArray(input)) {
    return { evidence, diagnostics: [{ code: "EVIDENCE_INVALID", message: "Evidence must be an array" }] };
  }
  if (input.length === 0) {
    diagnostics.push({ code: "EVIDENCE_MISSING", message: "No evidence supplied" });
  }
  const ids = new Set<string>();
  for (const item of input) {
    const record = item !== null && typeof item === "object" && !Array.isArray(item)
      ? item as Record<string, unknown> : {};
    const evidenceId = typeof record.evidenceId === "string" ? record.evidenceId : undefined;
    const valid = evidenceId?.trim() && !ids.has(evidenceId) &&
      typeof record.source === "string" && record.source.trim() &&
      typeof record.sourceReference === "string" && record.sourceReference.trim() &&
      Object.hasOwn(record, "observedValue") &&
      (record.observedAt === undefined || (typeof record.observedAt === "string" &&
        !Number.isNaN(Date.parse(record.observedAt)))) &&
      (record.provenance === undefined || typeof record.provenance === "string") &&
      (record.factRef === undefined || typeof record.factRef === "string");
    let observedValue: unknown;
    try { observedValue = snapshot(record.observedValue); } catch { observedValue = undefined; }
    if (!valid || observedValue === undefined) {
      diagnostics.push({
        code: "EVIDENCE_INVALID", message: "Evidence structure or lineage is invalid",
        ...(evidenceId && { evidenceId }),
      });
      continue;
    }
    ids.add(evidenceId!);
    evidence.push({
      evidenceId: evidenceId!, source: record.source as string,
      sourceReference: record.sourceReference as string, observedValue,
      ...(record.observedAt !== undefined && { observedAt: record.observedAt as string }),
      ...(record.provenance !== undefined && { provenance: record.provenance as string }),
      ...(record.factRef !== undefined && { factRef: record.factRef as string }),
      validation: "UNVALIDATED",
    });
    diagnostics.push({
      code: "EVIDENCE_UNVALIDATED", message: "Evidence structure does not establish authenticity or sufficiency",
      evidenceId: evidenceId!, sourceReference: record.sourceReference as string,
    });
  }
  return { evidence, diagnostics };
}
