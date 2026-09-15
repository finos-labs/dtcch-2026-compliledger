import type {
  CdmEligibilityAssessment,
  CdmEligibilityAssessmentReasonCode,
  CdmEligibilityRequest,
  CdmEligibilityResultSummary,
  EligibilityQuery,
  EligibilityQueryField,
  EligibleCollateralSpecification,
  EvidenceReference,
  MatchingEligibilityCriterionSummary,
} from "./types";

const EVIDENCE_SUFFICIENCY_REASON_CODES: readonly CdmEligibilityAssessmentReasonCode[] = [
  "EVIDENCE_INVALID",
  "EVIDENCE_STALE",
  "EVIDENCE_MISSING",
  "EVIDENCE_INSUFFICIENT",
  "COLLATERAL_REFERENCE_MISMATCH",
  "EVIDENCE_DUPLICATE_ID",
  "EVIDENCE_CONFLICT",
] as const;

export interface CdmEligibilityEvaluationApiRequest {
  collateral_reference: string;
  specification?: EligibleCollateralSpecification;
  specification_reference?: string;
  evidence_package: {
    package_id?: string;
    collateral_reference?: string;
    evidence: EvidenceReference[];
  };
}

export interface RequestValidationDiagnostic {
  path: string;
  message: string;
}

export interface CdmEligibilityEvidenceSufficiencySummary {
  is_sufficient: boolean;
  requires_manual_review: boolean;
  submitted_evidence_count: number;
  accepted_evidence_count: number;
  missing_fields: EligibilityQueryField[];
  invalid_fields: EligibilityQueryField[];
  stale_fields: EligibilityQueryField[];
  conflicting_fields: EligibilityQueryField[];
  reason_codes: CdmEligibilityAssessmentReasonCode[];
}

export interface CdmEligibilityEvaluationApiResponse {
  assessment_id: string;
  assessment_type: CdmEligibilityAssessment["assessment_type"];
  status: CdmEligibilityAssessment["status"];
  legacy_status: CdmEligibilityAssessment["legacy_status"];
  reason_codes: CdmEligibilityAssessment["reason_codes"];
  collateral_reference: string | null;
  specification_reference: string | null;
  evidence_package_id: string | null;
  evidence_reference_ids: string[];
  evidence_sufficiency: CdmEligibilityEvidenceSufficiencySummary;
  cdm_function: CdmEligibilityAssessment["cdm_function"];
  cdm_model_version: string | null;
  provider_version: string | null;
  provider_name: string | null;
  evaluated_at: string;
  specification: EligibleCollateralSpecification | null;
  query: EligibilityQuery | null;
  query_hash: string | null;
  evidence_lineage_hash: string | null;
  evidence_lineage: NonNullable<CdmEligibilityAssessment["evidence_lineage"]>;
  accepted_evidence: NonNullable<CdmEligibilityAssessment["accepted_evidence"]>;
  rejected_evidence: NonNullable<CdmEligibilityAssessment["rejected_evidence"]>;
  submitted_evidence: NonNullable<CdmEligibilityAssessment["submitted_evidence"]>;
  missing_fields: NonNullable<CdmEligibilityAssessment["missing_fields"]>;
  conflicting_fields: NonNullable<CdmEligibilityAssessment["conflicting_fields"]>;
  invalid_fields: NonNullable<CdmEligibilityAssessment["invalid_fields"]>;
  stale_fields: NonNullable<CdmEligibilityAssessment["stale_fields"]>;
  diagnostics: NonNullable<CdmEligibilityAssessment["diagnostics"]>;
  evidence_policy: CdmEligibilityAssessment["evidence_policy"];
  verification: CdmEligibilityAssessment["verification"] | null;
  cdm_result_summary: CdmEligibilityResultSummary | null;
  matching_criteria_summary: MatchingEligibilityCriterionSummary[] | null;
  check_eligibility_result: CdmEligibilityAssessment["check_eligibility_result"] | null;
  error_code: string | null;
  error_message: string | null;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function pushError(
  errors: RequestValidationDiagnostic[],
  path: string,
  message: string
): void {
  errors.push({ path, message });
}

function validateOptionalString(
  value: unknown,
  path: string,
  errors: RequestValidationDiagnostic[]
): void {
  if (value !== undefined && typeof value !== "string") {
    pushError(errors, path, `${path} must be a string when provided`);
  }
}

export function parseCdmEligibilityEvaluationApiRequest(
  body: unknown
): { ok: true; request: CdmEligibilityEvaluationApiRequest } | {
  ok: false;
  errors: RequestValidationDiagnostic[];
} {
  const errors: RequestValidationDiagnostic[] = [];
  if (!isPlainObject(body)) {
    return {
      ok: false,
      errors: [{ path: "$", message: "Request body must be a JSON object" }],
    };
  }

  if ("provider_configuration_id" in body) {
    pushError(
      errors,
      "provider_configuration_id",
      "provider_configuration_id is not supported; CDM provider selection is server-configured"
    );
  }

  if (typeof body.collateral_reference !== "string") {
    pushError(errors, "collateral_reference", "collateral_reference is required and must be a string");
  }

  if (body.specification === undefined && body.specification_reference === undefined) {
    pushError(
      errors,
      "specification",
      "specification or specification_reference is required"
    );
  }

  if (body.specification !== undefined) {
    if (!isPlainObject(body.specification)) {
      pushError(errors, "specification", "specification must be an object when provided");
    } else if (!isPlainObject(body.specification.criteria)) {
      pushError(errors, "specification.criteria", "specification.criteria is required and must be an object");
    } else {
      validateOptionalString(body.specification.id, "specification.id", errors);
      validateOptionalString(body.specification.name, "specification.name", errors);
      validateOptionalString(body.specification.version, "specification.version", errors);
    }
  }

  validateOptionalString(body.specification_reference, "specification_reference", errors);

  if (!isPlainObject(body.evidence_package)) {
    pushError(errors, "evidence_package", "evidence_package is required and must be an object");
  } else {
    validateOptionalString(body.evidence_package.package_id, "evidence_package.package_id", errors);
    validateOptionalString(
      body.evidence_package.collateral_reference,
      "evidence_package.collateral_reference",
      errors
    );

    if (!Array.isArray(body.evidence_package.evidence)) {
      pushError(
        errors,
        "evidence_package.evidence",
        "evidence_package.evidence is required and must be an array"
      );
    } else {
      body.evidence_package.evidence.forEach((entry, index) => {
        const path = `evidence_package.evidence[${index}]`;
        if (!isPlainObject(entry)) {
          pushError(errors, path, `${path} must be an object`);
          return;
        }
        for (const key of ["evidence_id", "source", "attribute", "claim_value", "observed_at"] as const) {
          if (typeof entry[key] !== "string") {
            pushError(errors, `${path}.${key}`, `${path}.${key} is required and must be a string`);
          }
        }
        validateOptionalString(entry.provenance, `${path}.provenance`, errors);
        validateOptionalString(entry.version, `${path}.version`, errors);
        validateOptionalString(entry.integrity_hash, `${path}.integrity_hash`, errors);
      });
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    request: body as unknown as CdmEligibilityEvaluationApiRequest,
  };
}

export function toInternalCdmEligibilityRequest(
  request: CdmEligibilityEvaluationApiRequest
): CdmEligibilityRequest {
  return {
    collateral_reference: request.collateral_reference,
    specification: request.specification,
    specification_reference: request.specification_reference,
    evidence_package: request.evidence_package,
  };
}

function normalizeArray<T>(value: T[] | undefined): T[] {
  return value ? [...value] : [];
}

function hasManualEvidenceReviewReason(assessment: CdmEligibilityAssessment): boolean {
  return assessment.reason_codes.includes("COLLATERAL_REFERENCE_MISMATCH")
    || assessment.reason_codes.includes("EVIDENCE_DUPLICATE_ID")
    || assessment.reason_codes.includes("EVIDENCE_CONFLICT");
}

function hasEvidenceFieldFailure(assessment: CdmEligibilityAssessment): boolean {
  return (assessment.missing_fields?.length ?? 0) > 0
    || (assessment.invalid_fields?.length ?? 0) > 0
    || (assessment.stale_fields?.length ?? 0) > 0
    || (assessment.conflicting_fields?.length ?? 0) > 0;
}

function hasEvidenceSufficiencyFailure(assessment: CdmEligibilityAssessment): boolean {
  return hasEvidenceFieldFailure(assessment) || hasManualEvidenceReviewReason(assessment);
}

function countAcceptedEvidence(assessment: CdmEligibilityAssessment): number {
  return Object.values(assessment.accepted_evidence ?? {}).reduce((total, entries) => total + entries.length, 0);
}

export function summarizeEvidenceSufficiency(
  assessment: CdmEligibilityAssessment
): CdmEligibilityEvidenceSufficiencySummary {
  const evidenceInsufficient = hasEvidenceSufficiencyFailure(assessment);
  const reasonCodes = assessment.reason_codes.filter((reasonCode) =>
    reasonCode !== "EVIDENCE_INSUFFICIENT"
      ? EVIDENCE_SUFFICIENCY_REASON_CODES.includes(reasonCode)
      : evidenceInsufficient
  );
  const requiresManualReview = assessment.status === "MANUAL_REVIEW"
    || hasManualEvidenceReviewReason(assessment);
  return {
    is_sufficient: !evidenceInsufficient,
    requires_manual_review: requiresManualReview,
    submitted_evidence_count: assessment.submitted_evidence?.length ?? 0,
    accepted_evidence_count: countAcceptedEvidence(assessment),
    missing_fields: normalizeArray(assessment.missing_fields),
    invalid_fields: normalizeArray(assessment.invalid_fields),
    stale_fields: normalizeArray(assessment.stale_fields),
    conflicting_fields: normalizeArray(assessment.conflicting_fields),
    reason_codes: reasonCodes,
  };
}

export function toCdmEligibilityEvaluationApiResponse(
  assessment: CdmEligibilityAssessment
): CdmEligibilityEvaluationApiResponse {
  return {
    assessment_id: assessment.assessment_id,
    assessment_type: assessment.assessment_type,
    status: assessment.status,
    legacy_status: assessment.legacy_status,
    reason_codes: [...assessment.reason_codes],
    collateral_reference: assessment.collateral_reference,
    specification_reference: assessment.specification_reference,
    evidence_package_id: assessment.evidence_package_id,
    evidence_reference_ids: [...assessment.evidence_reference_ids],
    evidence_sufficiency: summarizeEvidenceSufficiency(assessment),
    cdm_function: assessment.cdm_function,
    cdm_model_version: assessment.cdm_model_version,
    provider_version: assessment.provider_version,
    provider_name: assessment.provider_name,
    evaluated_at: assessment.evaluated_at,
    specification: assessment.specification ?? null,
    query: assessment.query ?? null,
    query_hash: assessment.query_hash ?? null,
    evidence_lineage_hash: assessment.evidence_lineage_hash ?? null,
    evidence_lineage: assessment.evidence_lineage ?? {
      maturity: [],
      collateralAssetType: [],
      assetCountryOfOrigin: [],
      denominatedCurrency: [],
      agencyRating: [],
      issuerType: [],
      issuerName: [],
    },
    accepted_evidence: assessment.accepted_evidence ?? {
      maturity: [],
      collateralAssetType: [],
      assetCountryOfOrigin: [],
      denominatedCurrency: [],
      agencyRating: [],
      issuerType: [],
      issuerName: [],
    },
    rejected_evidence: normalizeArray(assessment.rejected_evidence),
    submitted_evidence: normalizeArray(assessment.submitted_evidence),
    missing_fields: normalizeArray(assessment.missing_fields),
    conflicting_fields: normalizeArray(assessment.conflicting_fields),
    invalid_fields: normalizeArray(assessment.invalid_fields),
    stale_fields: normalizeArray(assessment.stale_fields),
    diagnostics: normalizeArray(assessment.diagnostics),
    evidence_policy: assessment.evidence_policy,
    verification: assessment.verification ?? null,
    cdm_result_summary: assessment.cdm_result_summary ?? null,
    matching_criteria_summary: assessment.cdm_result_summary?.matching_criteria ?? null,
    check_eligibility_result: assessment.check_eligibility_result ?? null,
    error_code: assessment.error_code ?? null,
    error_message: assessment.error_message ?? null,
  };
}
