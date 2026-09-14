import { canonicalStringify, sha256 } from "../crypto";
import type {
  CdmEligibilityAssessmentDiagnostic,
  CdmEligibilityAssessmentReasonCode,
  CdmEligibilityEvidencePolicy,
  CdmEligibilityRequest,
  EligibilityQuery,
  EligibilityQueryField,
  EvidenceReference,
  EvidenceReferenceDiagnostic,
  PreparedEligibilityEvidence,
} from "./types";
import { ELIGIBILITY_QUERY_FIELDS } from "./types";

const ELIGIBILITY_QUERY_FIELD_SET = new Set<EligibilityQueryField>(ELIGIBILITY_QUERY_FIELDS);
const DEFAULT_POLICY: CdmEligibilityEvidencePolicy = Object.freeze({
  max_evidence_age_ms: 30 * 24 * 60 * 60 * 1000,
  future_timestamp_tolerance_ms: 0,
  require_provenance: true,
  require_integrity_hash: true,
  freshness_boundary: "age_lte_max_evidence_age_ms",
});

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function blankToNull(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function sortEvidence(entries: EvidenceReference[]): EvidenceReference[] {
  return [...entries].sort((left, right) =>
    left.evidence_id.localeCompare(right.evidence_id)
    || left.attribute.localeCompare(right.attribute)
    || left.claim_value.localeCompare(right.claim_value)
    || left.observed_at.localeCompare(right.observed_at)
    || left.source.localeCompare(right.source)
  );
}

function buildEmptyLineage(): Record<EligibilityQueryField, EvidenceReference[]> {
  return Object.fromEntries(
    ELIGIBILITY_QUERY_FIELDS.map((field) => [field, [] as EvidenceReference[]])
  ) as Record<EligibilityQueryField, EvidenceReference[]>;
}

function toSubmittedEvidence(rawEvidence: unknown[]): Array<Record<string, unknown>> {
  return rawEvidence.map((entry) =>
    entry && typeof entry === "object"
      ? cloneJson(entry as Record<string, unknown>)
      : { value: entry }
  );
}

function toReasonSet(entries: CdmEligibilityAssessmentDiagnostic[]): Set<CdmEligibilityAssessmentReasonCode> {
  return new Set(entries.map((entry) => entry.reason_code));
}

function toEvidenceDiagnostic(
  evidence: Record<string, unknown>,
  reasonCodes: CdmEligibilityAssessmentReasonCode[],
  message: string,
  field: EligibilityQueryField | null,
  evidenceId: string | null
): EvidenceReferenceDiagnostic {
  return {
    evidence_id: evidenceId,
    field,
    reason_codes: [...reasonCodes],
    message,
    evidence: cloneJson(evidence),
  };
}

function addDiagnostic(
  diagnostics: CdmEligibilityAssessmentDiagnostic[],
  diagnostic: CdmEligibilityAssessmentDiagnostic
): void {
  const exists = diagnostics.some((entry) =>
    entry.reason_code === diagnostic.reason_code
    && entry.field === diagnostic.field
    && entry.evidence_id === diagnostic.evidence_id
    && entry.message === diagnostic.message
  );
  if (!exists) diagnostics.push(diagnostic);
}

function flattenLegacyEvidence(request: CdmEligibilityRequest): unknown[] {
  if (!request.query_evidence || typeof request.query_evidence !== "object") return [];
  const flattened: unknown[] = [];
  for (const field of ELIGIBILITY_QUERY_FIELDS) {
    const entries = request.query_evidence[field];
    if (!Array.isArray(entries)) continue;
    for (const entry of entries) {
      if (entry && typeof entry === "object" && typeof entry.attribute !== "string") {
        flattened.push({ ...entry, attribute: field });
        continue;
      }
      flattened.push(entry);
    }
  }
  return flattened;
}

function resolveSubmittedEvidence(request: CdmEligibilityRequest): {
  evidencePackageId: string | null;
  packageCollateralReference: string | null;
  rawEvidence: unknown[];
  diagnostics: CdmEligibilityAssessmentDiagnostic[];
  rejectedEvidence: EvidenceReferenceDiagnostic[];
} {
  const diagnostics: CdmEligibilityAssessmentDiagnostic[] = [];
  const rejectedEvidence: EvidenceReferenceDiagnostic[] = [];
  if (request.evidence_package === undefined) {
    return {
      evidencePackageId: null,
      packageCollateralReference: null,
      rawEvidence: flattenLegacyEvidence(request),
      diagnostics,
      rejectedEvidence,
    };
  }

  if (!request.evidence_package || typeof request.evidence_package !== "object" || Array.isArray(request.evidence_package)) {
    const message = "Evidence package must be an object";
    addDiagnostic(diagnostics, { reason_code: "EVIDENCE_INVALID", message });
    rejectedEvidence.push(
      toEvidenceDiagnostic({}, ["EVIDENCE_INVALID"], message, null, null)
    );
    return {
      evidencePackageId: null,
      packageCollateralReference: null,
      rawEvidence: [],
      diagnostics,
      rejectedEvidence,
    };
  }

  const evidencePackageId = request.evidence_package.package_id === undefined
    ? null
    : blankToNull(request.evidence_package.package_id);
  if (request.evidence_package.package_id !== undefined && !evidencePackageId) {
    addDiagnostic(diagnostics, {
      reason_code: "EVIDENCE_INVALID",
      message: "evidence_package.package_id must be a non-empty string when provided",
    });
  }

  const packageCollateralReference = request.evidence_package.collateral_reference === undefined
    ? null
    : blankToNull(request.evidence_package.collateral_reference);
  if (request.evidence_package.collateral_reference !== undefined && !packageCollateralReference) {
    addDiagnostic(diagnostics, {
      reason_code: "EVIDENCE_INVALID",
      message: "evidence_package.collateral_reference must be a non-empty string when provided",
    });
  }

  const rawEvidence = Array.isArray(request.evidence_package.evidence)
    ? request.evidence_package.evidence
    : [];
  if (!Array.isArray(request.evidence_package.evidence)) {
    const message = "evidence_package.evidence must be an array";
    addDiagnostic(diagnostics, { reason_code: "EVIDENCE_INVALID", message });
    rejectedEvidence.push(
      toEvidenceDiagnostic({}, ["EVIDENCE_INVALID"], message, null, null)
    );
  }

  return {
    evidencePackageId,
    packageCollateralReference,
    rawEvidence,
    diagnostics,
    rejectedEvidence,
  };
}

export function createDefaultEligibilityEvidencePolicy(
  overrides: Partial<CdmEligibilityEvidencePolicy> = {}
): CdmEligibilityEvidencePolicy {
  return {
    max_evidence_age_ms: overrides.max_evidence_age_ms ?? DEFAULT_POLICY.max_evidence_age_ms,
    future_timestamp_tolerance_ms:
      overrides.future_timestamp_tolerance_ms ?? DEFAULT_POLICY.future_timestamp_tolerance_ms,
    require_provenance: overrides.require_provenance ?? DEFAULT_POLICY.require_provenance,
    require_integrity_hash: overrides.require_integrity_hash ?? DEFAULT_POLICY.require_integrity_hash,
    freshness_boundary: DEFAULT_POLICY.freshness_boundary,
  };
}

export function prepareEligibilityEvidence(
  request: CdmEligibilityRequest,
  evaluatedAt: string,
  policyOverrides: Partial<CdmEligibilityEvidencePolicy> = {}
): PreparedEligibilityEvidence {
  const policy = createDefaultEligibilityEvidencePolicy(policyOverrides);
  const evidenceLineage = buildEmptyLineage();
  const acceptedEvidence = buildEmptyLineage();
  const rejectedEvidence: EvidenceReferenceDiagnostic[] = [];
  const diagnostics: CdmEligibilityAssessmentDiagnostic[] = [];
  const missingFields: EligibilityQueryField[] = [];
  const conflictingFields: EligibilityQueryField[] = [];
  const invalidFields = new Set<EligibilityQueryField>();
  const staleFields = new Set<EligibilityQueryField>();
  const evidenceReferenceIds = new Set<string>();
  const seenEvidenceIds = new Map<string, string>();
  const queryCandidate = {} as EligibilityQuery;

  const {
    rawEvidence,
    diagnostics: packageDiagnostics,
    rejectedEvidence: packageRejectedEvidence,
  } = resolveSubmittedEvidence(request);
  diagnostics.push(...packageDiagnostics);
  rejectedEvidence.push(...packageRejectedEvidence);

  const submittedEvidence = toSubmittedEvidence(rawEvidence);
  const evaluatedAtMs = Date.parse(evaluatedAt);

  for (const submittedEntry of submittedEvidence) {
    const evidenceId = blankToNull(submittedEntry.evidence_id);
    if (evidenceId) evidenceReferenceIds.add(evidenceId);
  }

  for (const submittedEntry of submittedEvidence) {
    const evidenceId = blankToNull(submittedEntry.evidence_id);
    const fieldValue = blankToNull(submittedEntry.attribute);
    const field = fieldValue && ELIGIBILITY_QUERY_FIELD_SET.has(fieldValue as EligibilityQueryField)
      ? fieldValue as EligibilityQueryField
      : null;
    const source = blankToNull(submittedEntry.source);
    const claimValue = blankToNull(submittedEntry.claim_value);
    const observedAt = blankToNull(submittedEntry.observed_at);
    const provenance = blankToNull(submittedEntry.provenance);
    const integrityHash = blankToNull(submittedEntry.integrity_hash);
    const invalidReasonCodes = new Set<CdmEligibilityAssessmentReasonCode>();
    const invalidMessages: string[] = [];

    if (!evidenceId) {
      invalidReasonCodes.add("EVIDENCE_INVALID");
      invalidMessages.push("Evidence entry is missing a non-empty evidence_id");
    }
    if (!source) {
      invalidReasonCodes.add("EVIDENCE_INVALID");
      invalidMessages.push("Evidence entry is missing a non-empty source");
    }
    if (!field) {
      invalidReasonCodes.add("EVIDENCE_INVALID");
      invalidMessages.push("Evidence entry attribute must match a supported EligibilityQuery field");
    }
    if (!claimValue) {
      invalidReasonCodes.add("EVIDENCE_INVALID");
      invalidMessages.push("Evidence entry claim_value must be a non-empty string");
    }
    if (!observedAt || Number.isNaN(Date.parse(observedAt))) {
      invalidReasonCodes.add("EVIDENCE_INVALID");
      invalidMessages.push("Evidence entry observed_at must be a valid timestamp");
    }
    if (policy.require_provenance && !provenance) {
      invalidReasonCodes.add("EVIDENCE_INVALID");
      invalidMessages.push("Evidence entry provenance is required by policy");
    }
    if (policy.require_integrity_hash && !integrityHash) {
      invalidReasonCodes.add("EVIDENCE_INVALID");
      invalidMessages.push("Evidence entry integrity_hash is required by policy");
    }

    if (invalidReasonCodes.size > 0) {
      if (field) invalidFields.add(field);
      const message = invalidMessages.join("; ");
      for (const reasonCode of invalidReasonCodes) {
        addDiagnostic(diagnostics, {
          reason_code: reasonCode,
          message,
          field: field ?? undefined,
          evidence_id: evidenceId,
        });
      }
      rejectedEvidence.push(
        toEvidenceDiagnostic(submittedEntry, [...invalidReasonCodes], message, field, evidenceId)
      );
      continue;
    }

    const canonicalEntry = canonicalStringify({
      evidence_id: evidenceId,
      source,
      attribute: field,
      claim_value: claimValue,
      observed_at: observedAt,
      provenance,
      version: blankToNull(submittedEntry.version) ?? undefined,
      integrity_hash: integrityHash,
    });
    const existingCanonicalEntry = seenEvidenceIds.get(evidenceId as string);
    if (existingCanonicalEntry) {
      invalidFields.add(field as EligibilityQueryField);
      conflictingFields.push(field as EligibilityQueryField);
      const message = "Duplicate evidence_id detected in evidence package";
      addDiagnostic(diagnostics, {
        reason_code: "EVIDENCE_DUPLICATE_ID",
        message,
        field: field ?? undefined,
        evidence_id: evidenceId,
      });
      rejectedEvidence.push(
        toEvidenceDiagnostic(
          submittedEntry,
          ["EVIDENCE_DUPLICATE_ID", "MANUAL_REVIEW_REQUIRED"],
          message,
          field,
          evidenceId
        )
      );
      if (existingCanonicalEntry !== canonicalEntry) {
        addDiagnostic(diagnostics, {
          reason_code: "EVIDENCE_CONFLICT",
          message: "Duplicate evidence_id carries conflicting evidence content",
          field: field ?? undefined,
          evidence_id: evidenceId,
        });
      }
      continue;
    }
    seenEvidenceIds.set(evidenceId as string, canonicalEntry);

    const observedAtMs = Date.parse(observedAt as string);
    const evidenceAgeMs = evaluatedAtMs - observedAtMs;
    if (observedAtMs - evaluatedAtMs > policy.future_timestamp_tolerance_ms) {
      invalidFields.add(field as EligibilityQueryField);
      const message = "Evidence entry observed_at cannot be in the future";
      addDiagnostic(diagnostics, {
        reason_code: "EVIDENCE_INVALID",
        message,
        field: field ?? undefined,
        evidence_id: evidenceId,
      });
      rejectedEvidence.push(
        toEvidenceDiagnostic(submittedEntry, ["EVIDENCE_INVALID"], message, field, evidenceId)
      );
      continue;
    }
    if (evidenceAgeMs > policy.max_evidence_age_ms) {
      staleFields.add(field as EligibilityQueryField);
      const message = "Evidence entry is older than the allowed freshness policy";
      addDiagnostic(diagnostics, {
        reason_code: "EVIDENCE_STALE",
        message,
        field: field ?? undefined,
        evidence_id: evidenceId,
      });
      rejectedEvidence.push(
        toEvidenceDiagnostic(submittedEntry, ["EVIDENCE_STALE"], message, field, evidenceId)
      );
      continue;
    }

    const acceptedEntry: EvidenceReference = {
      evidence_id: evidenceId as string,
      source: source as string,
      attribute: field as EligibilityQueryField,
      claim_value: claimValue as string,
      observed_at: observedAt as string,
      provenance: provenance ?? undefined,
      version: blankToNull(submittedEntry.version) ?? undefined,
      integrity_hash: integrityHash ?? undefined,
    };
    acceptedEvidence[field as EligibilityQueryField].push(acceptedEntry);
    evidenceLineage[field as EligibilityQueryField].push(acceptedEntry);
  }

  for (const field of ELIGIBILITY_QUERY_FIELDS) {
    acceptedEvidence[field] = sortEvidence(acceptedEvidence[field]);
    evidenceLineage[field] = sortEvidence(evidenceLineage[field]);
    const values = Array.from(new Set(acceptedEvidence[field].map((entry) => entry.claim_value)));
    if (acceptedEvidence[field].length === 0) {
      missingFields.push(field);
      continue;
    }
    if (values.length > 1) {
      conflictingFields.push(field);
      addDiagnostic(diagnostics, {
        reason_code: "EVIDENCE_CONFLICT",
        message: `Multiple conflicting claim values were supplied for ${field}`,
        field,
      });
      continue;
    }
    queryCandidate[field] = values[0] as string;
  }

  const dedupedConflictingFields = Array.from(new Set(conflictingFields)).sort();
  const sortedMissingFields = [...missingFields].sort();
  const sortedInvalidFields = Array.from(invalidFields).sort();
  const sortedStaleFields = Array.from(staleFields).sort();
  if (sortedMissingFields.length > 0) {
    addDiagnostic(diagnostics, {
      reason_code: "EVIDENCE_MISSING",
      message: `Missing evidence for required fields: ${sortedMissingFields.join(", ")}`,
    });
  }

  const sortedDiagnostics = [...diagnostics].sort((left, right) =>
    left.reason_code.localeCompare(right.reason_code)
    || (left.field ?? "").localeCompare(right.field ?? "")
    || (left.evidence_id ?? "").localeCompare(right.evidence_id ?? "")
    || left.message.localeCompare(right.message)
  );
  const sortedRejectedEvidence = [...rejectedEvidence].sort((left, right) =>
    (left.field ?? "").localeCompare(right.field ?? "")
    || (left.evidence_id ?? "").localeCompare(right.evidence_id ?? "")
    || left.message.localeCompare(right.message)
  );

  const evidenceLineageHash = ELIGIBILITY_QUERY_FIELDS.some((field) => evidenceLineage[field].length > 0)
    ? sha256(canonicalStringify(evidenceLineage))
    : null;
  const query = dedupedConflictingFields.length === 0 && sortedMissingFields.length === 0
    ? queryCandidate
    : undefined;

  return {
    query,
    query_hash: query ? sha256(canonicalStringify(query)) : null,
    evidence_lineage: evidenceLineage,
    accepted_evidence: acceptedEvidence,
    rejected_evidence: sortedRejectedEvidence,
    submitted_evidence: submittedEvidence,
    evidence_lineage_hash: evidenceLineageHash,
    evidence_reference_ids: [...evidenceReferenceIds].sort(),
    missing_fields: sortedMissingFields,
    conflicting_fields: dedupedConflictingFields,
    invalid_fields: sortedInvalidFields,
    stale_fields: sortedStaleFields,
    diagnostics: sortedDiagnostics,
    policy,
  };
}

export function collectEvidenceReasonCodes(
  preparedEvidence: PreparedEligibilityEvidence
): Set<CdmEligibilityAssessmentReasonCode> {
  return toReasonSet(preparedEvidence.diagnostics);
}
