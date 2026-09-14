import type {
  CdmEligibilityAssessment,
  CdmEligibilityEvaluationResponse,
  PreparedEligibilityEvidence,
  CdmEligibilityRequest,
} from "./types";

interface BuildAssessmentInput {
  request: CdmEligibilityRequest;
  preparedEvidence: PreparedEligibilityEvidence;
  cdmResponse?: CdmEligibilityEvaluationResponse;
  technicalError?: { code: string; message: string };
}

export function buildCdmEligibilityAssessment(input: BuildAssessmentInput): CdmEligibilityAssessment {
  const evaluatedAt = new Date().toISOString();
  const base: Omit<CdmEligibilityAssessment, "status" | "evaluated_at" | "specification"> = {
    query: input.preparedEvidence.query,
    query_hash: input.preparedEvidence.query_hash,
    evidence_lineage: input.preparedEvidence.evidence_lineage,
    evidence_lineage_hash: input.preparedEvidence.evidence_lineage_hash,
  };

  if (input.preparedEvidence.missing_fields.length > 0) {
    return {
      status: "indeterminate_missing_evidence",
      evaluated_at: evaluatedAt,
      specification: input.request.specification,
      ...base,
      missing_fields: input.preparedEvidence.missing_fields,
      conflicting_fields: input.preparedEvidence.conflicting_fields,
    };
  }

  if (input.preparedEvidence.conflicting_fields.length > 0) {
    return {
      status: "indeterminate_conflicting_evidence",
      evaluated_at: evaluatedAt,
      specification: input.request.specification,
      ...base,
      missing_fields: input.preparedEvidence.missing_fields,
      conflicting_fields: input.preparedEvidence.conflicting_fields,
    };
  }

  if (input.technicalError) {
    return {
      status: "technical_error",
      evaluated_at: evaluatedAt,
      specification: input.request.specification,
      ...base,
      error_code: input.technicalError.code,
      error_message: input.technicalError.message,
    };
  }

  if (!input.cdmResponse) {
    return {
      status: "technical_error",
      evaluated_at: evaluatedAt,
      specification: input.request.specification,
      ...base,
      error_code: "missing_cdm_response",
      error_message: "CDM response was not returned",
    };
  }

  return {
    status: input.cdmResponse.result.isEligible ? "eligible" : "ineligible",
    evaluated_at: evaluatedAt,
    specification: input.request.specification,
    ...base,
    cdm_function: input.cdmResponse.metadata,
    verification: input.cdmResponse.verification,
    check_eligibility_result: input.cdmResponse.result,
  };
}
