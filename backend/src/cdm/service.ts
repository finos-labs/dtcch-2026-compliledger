import { canonicalStringify, sha256 } from "../crypto";
import { toLegacyCdmEligibilityAssessmentStatus } from "./assessment";
import { createCollateralEligibilityProvider } from "./adapter";
import { collectEvidenceReasonCodes, prepareEligibilityEvidence } from "./evidence";
import { CdmEligibilityProviderError, type CollateralEligibilityProvider } from "./provider";
import type {
  CdmEligibilityAssessment,
  CdmEligibilityAssessmentDiagnostic,
  CdmEligibilityAssessmentReasonCode,
  CdmEligibilityAssessmentStatus,
  CdmEligibilityEvaluationResponse,
  CdmEligibilityEvidencePolicy,
  CdmEligibilityQuery,
  CdmEligibilityRequest,
  CdmProviderMetadata,
  CdmVerificationMetadata,
  EligibleCollateralSpecification,
  MatchingEligibilityCriterionSummary,
  PreparedEligibilityEvidence,
} from "./types";
import {
  CDM_COLLATERAL_ELIGIBILITY_ASSESSMENT_TYPE,
  CDM_COLLATERAL_ELIGIBILITY_FUNCTION,
} from "./types";

const REASON_CODE_ORDER: CdmEligibilityAssessmentReasonCode[] = [
  "COLLATERAL_REFERENCE_MISMATCH",
  "SPECIFICATION_REFERENCE_MISMATCH",
  "EVIDENCE_DUPLICATE_ID",
  "EVIDENCE_CONFLICT",
  "MANUAL_REVIEW_REQUIRED",
  "EVIDENCE_INVALID",
  "EVIDENCE_STALE",
  "EVIDENCE_MISSING",
  "EVIDENCE_INSUFFICIENT",
  "SPECIFICATION_UNRESOLVED",
  "CDM_EVALUATION_UNAVAILABLE",
  "PROVIDER_NOT_CONFIGURED",
  "PROVIDER_CONFIGURATION_ERROR",
  "PROVIDER_RESPONSE_INVALID",
  "PROVIDER_RESPONSE_UNVERIFIED",
  "CDM_COLLATERAL_ELIGIBLE",
  "CDM_COLLATERAL_INELIGIBLE",
];

export interface EvaluateEvidenceBackedCollateralEligibilityOptions {
  evaluatedAt?: string;
  evidencePolicy?: Partial<CdmEligibilityEvidencePolicy>;
  provider?: CollateralEligibilityProvider | null;
  providerFactory?: () => CollateralEligibilityProvider | null;
  specificationResolver?: (
    specificationReference: string
  ) => Promise<EligibleCollateralSpecification | null> | EligibleCollateralSpecification | null;
  assessmentIdFactory?: (seed: string) => string;
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function blankToNull(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function makeAssessmentId(seed: string, factory?: (seed: string) => string): string {
  if (factory) return factory(seed);
  return `cdm-collateral-eligibility:${sha256(seed)}`;
}

function createDiagnostic(
  reasonCode: CdmEligibilityAssessmentReasonCode,
  message: string
): CdmEligibilityAssessmentDiagnostic {
  return { reason_code: reasonCode, message };
}

function normalizeReasonCodes(
  reasonCodes: Iterable<CdmEligibilityAssessmentReasonCode>
): CdmEligibilityAssessmentReasonCode[] {
  const seen = new Set(reasonCodes);
  return REASON_CODE_ORDER.filter((reasonCode) => seen.has(reasonCode));
}

function normalizeSpecificationReference(
  request: CdmEligibilityRequest
): { specificationReference: string | null; diagnostics: CdmEligibilityAssessmentDiagnostic[] } {
  const diagnostics: CdmEligibilityAssessmentDiagnostic[] = [];
  const explicitReference = blankToNull(request.specification_reference);
  const payloadReference = blankToNull(request.specification?.id);
  if (explicitReference && payloadReference && explicitReference !== payloadReference) {
    diagnostics.push(
      createDiagnostic(
        "SPECIFICATION_REFERENCE_MISMATCH",
        "specification_reference does not match specification.id"
      )
    );
  }

  return {
    specificationReference: explicitReference ?? payloadReference,
    diagnostics,
  };
}

async function resolveSpecification(
  request: CdmEligibilityRequest,
  options: EvaluateEvidenceBackedCollateralEligibilityOptions
): Promise<{
  specification: EligibleCollateralSpecification | null;
  specificationReference: string | null;
  diagnostics: CdmEligibilityAssessmentDiagnostic[];
}> {
  const diagnostics: CdmEligibilityAssessmentDiagnostic[] = [];
  const { specificationReference, diagnostics: referenceDiagnostics } =
    normalizeSpecificationReference(request);
  diagnostics.push(...referenceDiagnostics);

  if (request.specification && typeof request.specification === "object" && !Array.isArray(request.specification)) {
    return {
      specification: cloneJson(request.specification),
      specificationReference,
      diagnostics,
    };
  }

  if (!specificationReference) {
    diagnostics.push(
      createDiagnostic(
        "EVIDENCE_MISSING",
        "Eligible collateral specification payload or specification_reference is required"
      )
    );
    return { specification: null, specificationReference: null, diagnostics };
  }

  if (!options.specificationResolver) {
    diagnostics.push(
      createDiagnostic(
        "SPECIFICATION_UNRESOLVED",
        "Specification reference was provided without a resolver-backed specification payload"
      )
    );
    return { specification: null, specificationReference, diagnostics };
  }

  try {
    const resolved = await options.specificationResolver(specificationReference);
    if (!resolved) {
      diagnostics.push(
        createDiagnostic(
          "SPECIFICATION_UNRESOLVED",
          "Specification reference could not be resolved"
        )
      );
      return { specification: null, specificationReference, diagnostics };
    }
    return {
      specification: cloneJson(resolved),
      specificationReference,
      diagnostics,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Specification resolver failed";
    diagnostics.push(
      createDiagnostic(
        "SPECIFICATION_UNRESOLVED",
        `Specification reference resolution failed: ${message}`
      )
    );
    return { specification: null, specificationReference, diagnostics };
  }
}

function validateProviderResponse(
  response: CdmEligibilityEvaluationResponse,
  query: CdmEligibilityQuery,
  specification: EligibleCollateralSpecification,
  specificationReference: string | null
): { diagnostics: CdmEligibilityAssessmentDiagnostic[]; metadata: CdmProviderMetadata | null; verification: CdmVerificationMetadata | undefined } {
  const diagnostics: CdmEligibilityAssessmentDiagnostic[] = [];
  const metadata = response?.metadata && typeof response.metadata === "object"
    ? response.metadata
    : null;
  const verification = response?.verification;
  const result = response?.result;

  if (!metadata
    || typeof metadata.provider_name !== "string"
    || typeof metadata.cdm_model_version !== "string"
    || typeof metadata.provider_version !== "string"
    || metadata.cdm_function !== CDM_COLLATERAL_ELIGIBILITY_FUNCTION) {
    diagnostics.push(
      createDiagnostic(
        "PROVIDER_RESPONSE_INVALID",
        "CDM provider response metadata is missing or malformed"
      )
    );
  }

  if (!verification || verification.verified !== true) {
    diagnostics.push(
      createDiagnostic(
        "PROVIDER_RESPONSE_UNVERIFIED",
        `CDM response verification failed${verification?.reason ? `: ${verification.reason}` : ""}`
      )
    );
  }

  if (!result || typeof result !== "object" || Array.isArray(result)) {
    diagnostics.push(
      createDiagnostic(
        "PROVIDER_RESPONSE_INVALID",
        "CDM provider response result is missing or malformed"
      )
    );
    return { diagnostics, metadata, verification };
  }

  if (typeof result.isEligible !== "boolean" || !Array.isArray(result.matchingEligibleCriteria)) {
    diagnostics.push(
      createDiagnostic(
        "PROVIDER_RESPONSE_INVALID",
        "CDM provider response result has an invalid CheckEligibilityResult shape"
      )
    );
  }

  if (canonicalStringify(result.eligibilityQuery) !== canonicalStringify(query)) {
    diagnostics.push(
      createDiagnostic(
        "PROVIDER_RESPONSE_INVALID",
        "CDM provider response echoed a mismatched eligibilityQuery"
      )
    );
  }

  if (canonicalStringify(result.specification) !== canonicalStringify(specification)) {
    const matchesReference = specificationReference
      && blankToNull(result.specification?.id) === specificationReference;
    if (!matchesReference) {
      diagnostics.push(
        createDiagnostic(
          "PROVIDER_RESPONSE_INVALID",
          "CDM provider response echoed a mismatched eligible collateral specification"
        )
      );
    }
  }

  return { diagnostics, metadata, verification };
}

function summarizeMatchingCriteria(matchingCriteria: unknown[]): MatchingEligibilityCriterionSummary[] {
  return matchingCriteria.flatMap((criterion) => {
    if (typeof criterion === "string" && criterion.trim().length > 0) {
      return [{ reference: criterion }];
    }
    if (!criterion || typeof criterion !== "object" || Array.isArray(criterion)) {
      return [];
    }
    const record = criterion as Record<string, unknown>;
    const identifier = blankToNull(record.identifier) ?? blankToNull(record.id);
    const reference = blankToNull(record.reference)
      ?? blankToNull(record.href)
      ?? blankToNull(record.name);
    if (!identifier && !reference) return [];
    return [{ ...(identifier ? { identifier } : {}), ...(reference ? { reference } : {}) }];
  });
}

function buildAssessment(
  request: CdmEligibilityRequest,
  preparedEvidence: PreparedEligibilityEvidence,
  specification: EligibleCollateralSpecification | null,
  specificationReference: string | null,
  evaluatedAt: string,
  status: CdmEligibilityAssessmentStatus,
  reasonCodes: CdmEligibilityAssessmentReasonCode[],
  options: {
    metadata?: CdmProviderMetadata | null;
    verification?: CdmVerificationMetadata;
    resultSummary?: CdmEligibilityAssessment["cdm_result_summary"];
    result?: CdmEligibilityEvaluationResponse["result"];
    errorCode?: string;
    errorMessage?: string;
    extraDiagnostics?: CdmEligibilityAssessmentDiagnostic[];
    assessmentIdFactory?: (seed: string) => string;
  } = {}
): CdmEligibilityAssessment {
  const diagnostics = [...preparedEvidence.diagnostics, ...(options.extraDiagnostics ?? [])];
  const normalizedReasonCodes = normalizeReasonCodes([
    ...reasonCodes,
    ...diagnostics.map((entry) => entry.reason_code),
  ]);
  const legacyStatus = status === "NOT_EVALUABLE"
    && normalizedReasonCodes.some((reasonCode) =>
      reasonCode === "EVIDENCE_MISSING"
      || reasonCode === "EVIDENCE_INVALID"
      || reasonCode === "EVIDENCE_STALE"
      || reasonCode === "EVIDENCE_INSUFFICIENT"
      || reasonCode === "SPECIFICATION_UNRESOLVED"
    )
    ? "indeterminate_missing_evidence"
    : status === "MANUAL_REVIEW"
      ? "indeterminate_conflicting_evidence"
      : toLegacyCdmEligibilityAssessmentStatus(status);
  const seed = canonicalStringify({
    assessment_type: CDM_COLLATERAL_ELIGIBILITY_ASSESSMENT_TYPE,
    evaluated_at: evaluatedAt,
    status,
    reason_codes: normalizedReasonCodes,
    collateral_reference: blankToNull(request.collateral_reference),
    specification_reference: specificationReference,
    evidence_package_id: blankToNull(request.evidence_package?.package_id),
    query_hash: preparedEvidence.query_hash,
    evidence_lineage_hash: preparedEvidence.evidence_lineage_hash,
  });

  return {
    assessment_id: makeAssessmentId(seed, options.assessmentIdFactory),
    assessment_type: CDM_COLLATERAL_ELIGIBILITY_ASSESSMENT_TYPE,
    status,
    legacy_status: legacyStatus,
    reason_codes: normalizedReasonCodes,
    collateral_reference: blankToNull(request.collateral_reference),
    specification_reference: specificationReference,
    evidence_package_id: blankToNull(request.evidence_package?.package_id),
    evidence_reference_ids: preparedEvidence.evidence_reference_ids,
    cdm_function: CDM_COLLATERAL_ELIGIBILITY_FUNCTION,
    cdm_model_version: options.metadata?.cdm_model_version ?? null,
    provider_version: options.metadata?.provider_version ?? null,
    provider_name: options.metadata?.provider_name ?? null,
    evaluated_at: evaluatedAt,
    specification,
    query: preparedEvidence.query,
    query_hash: preparedEvidence.query_hash,
    evidence_lineage_hash: preparedEvidence.evidence_lineage_hash,
    evidence_lineage: preparedEvidence.evidence_lineage,
    accepted_evidence: preparedEvidence.accepted_evidence,
    rejected_evidence: preparedEvidence.rejected_evidence,
    submitted_evidence: preparedEvidence.submitted_evidence,
    missing_fields: preparedEvidence.missing_fields,
    conflicting_fields: preparedEvidence.conflicting_fields,
    invalid_fields: preparedEvidence.invalid_fields,
    stale_fields: preparedEvidence.stale_fields,
    diagnostics,
    evidence_policy: preparedEvidence.policy,
    verification: options.verification,
    cdm_result_summary: options.resultSummary,
    check_eligibility_result: options.result ? cloneJson(options.result) : undefined,
    error_code: options.errorCode,
    error_message: options.errorMessage,
  };
}

function resolveEvidenceGateStatus(
  reasonCodes: Set<CdmEligibilityAssessmentReasonCode>
): { status: CdmEligibilityAssessmentStatus; reasonCodes: CdmEligibilityAssessmentReasonCode[] } | null {
  const manualReviewReasons: CdmEligibilityAssessmentReasonCode[] = [];
  if (reasonCodes.has("COLLATERAL_REFERENCE_MISMATCH")) manualReviewReasons.push("COLLATERAL_REFERENCE_MISMATCH");
  if (reasonCodes.has("SPECIFICATION_REFERENCE_MISMATCH")) manualReviewReasons.push("SPECIFICATION_REFERENCE_MISMATCH");
  if (reasonCodes.has("EVIDENCE_DUPLICATE_ID")) manualReviewReasons.push("EVIDENCE_DUPLICATE_ID");
  if (reasonCodes.has("EVIDENCE_CONFLICT")) manualReviewReasons.push("EVIDENCE_CONFLICT");
  if (manualReviewReasons.length > 0) {
    return {
      status: "MANUAL_REVIEW",
      reasonCodes: normalizeReasonCodes([...manualReviewReasons, "MANUAL_REVIEW_REQUIRED"]),
    };
  }

  const notEvaluableReasons: CdmEligibilityAssessmentReasonCode[] = [];
  if (reasonCodes.has("EVIDENCE_INVALID")) notEvaluableReasons.push("EVIDENCE_INVALID");
  if (reasonCodes.has("EVIDENCE_STALE")) notEvaluableReasons.push("EVIDENCE_STALE");
  if (reasonCodes.has("EVIDENCE_MISSING")) notEvaluableReasons.push("EVIDENCE_MISSING");
  if (reasonCodes.has("SPECIFICATION_UNRESOLVED")) notEvaluableReasons.push("SPECIFICATION_UNRESOLVED");
  if (reasonCodes.has("EVIDENCE_INVALID")
    || reasonCodes.has("EVIDENCE_STALE")
    || reasonCodes.has("EVIDENCE_MISSING")
    || reasonCodes.has("SPECIFICATION_UNRESOLVED")) {
    notEvaluableReasons.push("EVIDENCE_INSUFFICIENT");
  }

  if (notEvaluableReasons.length > 0) {
    return {
      status: "NOT_EVALUABLE",
      reasonCodes: normalizeReasonCodes(notEvaluableReasons),
    };
  }

  return null;
}

export async function evaluateEvidenceBackedCollateralEligibility(
  request: CdmEligibilityRequest,
  options: EvaluateEvidenceBackedCollateralEligibilityOptions = {}
): Promise<CdmEligibilityAssessment> {
  const evaluatedAt = blankToNull(options.evaluatedAt) ?? new Date().toISOString();
  if (Number.isNaN(Date.parse(evaluatedAt))) {
    throw new Error("evaluatedAt must be a valid ISO-8601 timestamp");
  }

  const { specification, specificationReference, diagnostics: specificationDiagnostics } =
    await resolveSpecification(request, options);
  const preparedEvidence = prepareEligibilityEvidence(request, evaluatedAt, options.evidencePolicy);
  const allDiagnostics = [...preparedEvidence.diagnostics, ...specificationDiagnostics];
  const reasonCodes = collectEvidenceReasonCodes({
    ...preparedEvidence,
    diagnostics: allDiagnostics,
  });

  const collateralReference = blankToNull(request.collateral_reference);
  if (!collateralReference) {
    allDiagnostics.push(
      createDiagnostic(
        "EVIDENCE_MISSING",
        "collateral_reference is required to assess evidence-backed collateral eligibility"
      )
    );
    reasonCodes.add("EVIDENCE_MISSING");
  }

  const packageCollateralReference = blankToNull(request.evidence_package?.collateral_reference);
  if (collateralReference && packageCollateralReference && collateralReference !== packageCollateralReference) {
    allDiagnostics.push(
      createDiagnostic(
        "COLLATERAL_REFERENCE_MISMATCH",
        "evidence_package.collateral_reference does not match collateral_reference"
      )
    );
    reasonCodes.add("COLLATERAL_REFERENCE_MISMATCH");
  }

  if (!preparedEvidence.query) {
    reasonCodes.add("EVIDENCE_INSUFFICIENT");
  }
  for (const diagnostic of specificationDiagnostics) {
    reasonCodes.add(diagnostic.reason_code);
  }

  const evidenceGate = resolveEvidenceGateStatus(reasonCodes);
  const preparedEvidenceWithAllDiagnostics: PreparedEligibilityEvidence = {
    ...preparedEvidence,
    diagnostics: [...allDiagnostics].sort((left, right) =>
      left.reason_code.localeCompare(right.reason_code) || left.message.localeCompare(right.message)
    ),
  };

  if (evidenceGate || !specification || !preparedEvidence.query) {
    const status = evidenceGate?.status ?? "NOT_EVALUABLE";
    const evidenceReasonCodes = evidenceGate?.reasonCodes ?? normalizeReasonCodes(reasonCodes);
    return buildAssessment(
      request,
      preparedEvidenceWithAllDiagnostics,
      specification,
      specificationReference,
      evaluatedAt,
      status,
      evidenceReasonCodes,
      {
        assessmentIdFactory: options.assessmentIdFactory,
      }
    );
  }

  let provider: CollateralEligibilityProvider | null;
  try {
    provider = options.provider ?? options.providerFactory?.() ?? createCollateralEligibilityProvider();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "CDM provider configuration failed";
    const code = error instanceof CdmEligibilityProviderError ? error.code : "cdm_provider_configuration_error";
    return buildAssessment(
      request,
      preparedEvidenceWithAllDiagnostics,
      specification,
      specificationReference,
      evaluatedAt,
      "NOT_EVALUABLE",
      ["CDM_EVALUATION_UNAVAILABLE", "PROVIDER_CONFIGURATION_ERROR"],
      {
        errorCode: code,
        errorMessage: message,
        assessmentIdFactory: options.assessmentIdFactory,
        extraDiagnostics: [
          createDiagnostic("CDM_EVALUATION_UNAVAILABLE", message),
          createDiagnostic("PROVIDER_CONFIGURATION_ERROR", message),
        ],
      }
    );
  }

  if (!provider) {
    return buildAssessment(
      request,
      preparedEvidenceWithAllDiagnostics,
      specification,
      specificationReference,
      evaluatedAt,
      "NOT_EVALUABLE",
      ["CDM_EVALUATION_UNAVAILABLE", "PROVIDER_NOT_CONFIGURED"],
      {
        errorCode: "cdm_provider_not_configured",
        errorMessage: "CDM collateral eligibility provider is not configured",
        assessmentIdFactory: options.assessmentIdFactory,
        extraDiagnostics: [
          createDiagnostic(
            "CDM_EVALUATION_UNAVAILABLE",
            "CDM collateral eligibility provider is not configured"
          ),
          createDiagnostic(
            "PROVIDER_NOT_CONFIGURED",
            "CDM collateral eligibility provider is not configured"
          ),
        ],
      }
    );
  }

  try {
    const response = await provider.evaluateEligibility(specification, preparedEvidence.query);
    const validation = validateProviderResponse(
      response,
      preparedEvidence.query,
      specification,
      specificationReference
    );
    if (validation.diagnostics.length > 0) {
      const errorMessage = validation.diagnostics.map((entry) => entry.message).join("; ");
      return buildAssessment(
        request,
        preparedEvidenceWithAllDiagnostics,
        specification,
        specificationReference,
        evaluatedAt,
        "NOT_EVALUABLE",
        ["CDM_EVALUATION_UNAVAILABLE", ...validation.diagnostics.map((entry) => entry.reason_code)],
        {
          metadata: validation.metadata,
          verification: validation.verification,
          errorCode: "invalid_cdm_provider_response",
          errorMessage,
          assessmentIdFactory: options.assessmentIdFactory,
          extraDiagnostics: [
            createDiagnostic("CDM_EVALUATION_UNAVAILABLE", errorMessage),
            ...validation.diagnostics,
          ],
        }
      );
    }

    const resultSummary = {
      isEligible: response.result.isEligible,
      matching_criteria: summarizeMatchingCriteria(response.result.matchingEligibleCriteria),
    };
    const status: CdmEligibilityAssessmentStatus = response.result.isEligible
      ? "SATISFIED"
      : "NOT_SATISFIED";
    const reasonCode: CdmEligibilityAssessmentReasonCode = response.result.isEligible
      ? "CDM_COLLATERAL_ELIGIBLE"
      : "CDM_COLLATERAL_INELIGIBLE";

    return buildAssessment(
      request,
      preparedEvidenceWithAllDiagnostics,
      specification,
      specificationReference,
      evaluatedAt,
      status,
      [reasonCode],
      {
        metadata: response.metadata,
        verification: response.verification,
        resultSummary,
        result: response.result,
        assessmentIdFactory: options.assessmentIdFactory,
      }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown CDM provider evaluation failure";
    const code = error instanceof CdmEligibilityProviderError ? error.code : "cdm_provider_error";
    return buildAssessment(
      request,
      preparedEvidenceWithAllDiagnostics,
      specification,
      specificationReference,
      evaluatedAt,
      "NOT_EVALUABLE",
      ["CDM_EVALUATION_UNAVAILABLE", "PROVIDER_RESPONSE_INVALID"],
      {
        errorCode: code,
        errorMessage: message,
        assessmentIdFactory: options.assessmentIdFactory,
        extraDiagnostics: [
          createDiagnostic("CDM_EVALUATION_UNAVAILABLE", message),
          createDiagnostic("PROVIDER_RESPONSE_INVALID", message),
        ],
      }
    );
  }
}
