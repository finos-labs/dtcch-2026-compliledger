export const ELIGIBILITY_QUERY_FIELDS = [
  "maturity",
  "collateralAssetType",
  "assetCountryOfOrigin",
  "denominatedCurrency",
  "agencyRating",
  "issuerType",
  "issuerName",
] as const;

export type EligibilityQueryField = typeof ELIGIBILITY_QUERY_FIELDS[number];

export const CDM_COLLATERAL_ELIGIBILITY_FUNCTION =
  "cdm.product.collateral.CheckEligibilityByDetails" as const;

export const CDM_COLLATERAL_ELIGIBILITY_ASSESSMENT_TYPE =
  "CDM_COLLATERAL_ELIGIBILITY" as const;

export interface EligibleCollateralSpecification {
  id?: string;
  name?: string;
  version?: string;
  criteria: Record<string, unknown>;
}

export interface CdmEligibilityQuery {
  maturity: string;
  collateralAssetType: string;
  assetCountryOfOrigin: string;
  denominatedCurrency: string;
  agencyRating: string;
  issuerType: string;
  issuerName: string;
}

export type EligibilityQuery = CdmEligibilityQuery;

export interface CdmEligibilityResult {
  isEligible: boolean;
  matchingEligibleCriteria: unknown[];
  eligibilityQuery: CdmEligibilityQuery;
  specification: EligibleCollateralSpecification;
}

export type CheckEligibilityResult = CdmEligibilityResult;

export interface EvidenceReference {
  evidence_id: string;
  source: string;
  attribute: string;
  claim_value: string;
  observed_at: string;
  provenance?: string;
  version?: string;
  integrity_hash?: string;
}

export interface EligibilityEvidencePackage {
  package_id?: string;
  collateral_reference?: string;
  evidence: EvidenceReference[];
}

export interface CdmEligibilityRequest {
  specification?: EligibleCollateralSpecification;
  specification_reference?: string;
  collateral_reference?: string;
  evidence_package?: EligibilityEvidencePackage;
  query_evidence?: Partial<Record<EligibilityQueryField, EvidenceReference[]>>;
}

export interface PreparedEligibilityEvidence {
  query?: EligibilityQuery;
  query_hash: string | null;
  evidence_lineage: Record<EligibilityQueryField, EvidenceReference[]>;
  accepted_evidence: Record<EligibilityQueryField, EvidenceReference[]>;
  rejected_evidence: EvidenceReferenceDiagnostic[];
  submitted_evidence: Array<Record<string, unknown>>;
  evidence_lineage_hash: string | null;
  evidence_reference_ids: string[];
  missing_fields: EligibilityQueryField[];
  conflicting_fields: EligibilityQueryField[];
  invalid_fields: EligibilityQueryField[];
  stale_fields: EligibilityQueryField[];
  diagnostics: CdmEligibilityAssessmentDiagnostic[];
  policy: CdmEligibilityEvidencePolicy;
}

export interface CdmProviderMetadata {
  provider_name: string;
  cdm_function: typeof CDM_COLLATERAL_ELIGIBILITY_FUNCTION;
  cdm_model_version: string;
  provider_version: string;
}

export type CdmFunctionMetadata = CdmProviderMetadata;

export interface CdmVerificationMetadata {
  verified: boolean;
  reason?: string;
  key_id?: string;
  algorithm?: string;
  content_hash?: string;
  signature?: string;
}

export interface CdmEligibilityEvaluationResponse {
  result: CdmEligibilityResult;
  metadata: CdmProviderMetadata;
  verification: CdmVerificationMetadata;
}

export type CdmEligibilityAssessmentStatus =
  | "SATISFIED"
  | "NOT_SATISFIED"
  | "NOT_EVALUABLE"
  | "MANUAL_REVIEW";

export type LegacyCdmEligibilityAssessmentStatus =
  | "eligible"
  | "ineligible"
  | "indeterminate_missing_evidence"
  | "indeterminate_conflicting_evidence"
  | "technical_error";

export type CdmEligibilityAssessmentReasonCode =
  | "CDM_COLLATERAL_ELIGIBLE"
  | "CDM_COLLATERAL_INELIGIBLE"
  | "EVIDENCE_MISSING"
  | "EVIDENCE_INSUFFICIENT"
  | "EVIDENCE_STALE"
  | "EVIDENCE_INVALID"
  | "CDM_EVALUATION_UNAVAILABLE"
  | "MANUAL_REVIEW_REQUIRED"
  | "COLLATERAL_REFERENCE_MISMATCH"
  | "EVIDENCE_CONFLICT"
  | "EVIDENCE_DUPLICATE_ID"
  | "PROVIDER_CONFIGURATION_ERROR"
  | "PROVIDER_NOT_CONFIGURED"
  | "PROVIDER_UNAVAILABLE"
  | "PROVIDER_RESPONSE_INVALID"
  | "PROVIDER_RESPONSE_UNVERIFIED"
  | "SPECIFICATION_REFERENCE_MISMATCH"
  | "SPECIFICATION_UNRESOLVED";

export interface CdmEligibilityAssessmentDiagnostic {
  reason_code: CdmEligibilityAssessmentReasonCode;
  message: string;
  field?: EligibilityQueryField;
  evidence_id?: string | null;
}

export interface EvidenceReferenceDiagnostic {
  evidence_id: string | null;
  field: EligibilityQueryField | null;
  reason_codes: CdmEligibilityAssessmentReasonCode[];
  message: string;
  evidence: Record<string, unknown>;
}

export interface MatchingEligibilityCriterionSummary {
  identifier?: string;
  reference?: string;
}

export interface CdmEligibilityResultSummary {
  isEligible: boolean;
  matching_criteria: MatchingEligibilityCriterionSummary[];
}

export interface CdmEligibilityEvidencePolicy {
  max_evidence_age_ms: number;
  future_timestamp_tolerance_ms: number;
  require_provenance: boolean;
  require_integrity_hash: boolean;
  freshness_boundary: "age_lte_max_evidence_age_ms";
}

export interface CdmEligibilityAssessment {
  assessment_id: string;
  assessment_type: typeof CDM_COLLATERAL_ELIGIBILITY_ASSESSMENT_TYPE;
  status: CdmEligibilityAssessmentStatus;
  legacy_status: LegacyCdmEligibilityAssessmentStatus;
  reason_codes: CdmEligibilityAssessmentReasonCode[];
  collateral_reference: string | null;
  specification_reference: string | null;
  evidence_package_id: string | null;
  evidence_reference_ids: string[];
  cdm_function: typeof CDM_COLLATERAL_ELIGIBILITY_FUNCTION;
  cdm_model_version: string | null;
  provider_version: string | null;
  provider_name: string | null;
  evaluated_at: string;
  specification: EligibleCollateralSpecification | null;
  query?: EligibilityQuery;
  query_hash?: string | null;
  evidence_lineage_hash?: string | null;
  evidence_lineage?: Record<EligibilityQueryField, EvidenceReference[]>;
  accepted_evidence?: Record<EligibilityQueryField, EvidenceReference[]>;
  rejected_evidence?: EvidenceReferenceDiagnostic[];
  submitted_evidence?: Array<Record<string, unknown>>;
  missing_fields?: EligibilityQueryField[];
  conflicting_fields?: EligibilityQueryField[];
  invalid_fields?: EligibilityQueryField[];
  stale_fields?: EligibilityQueryField[];
  diagnostics?: CdmEligibilityAssessmentDiagnostic[];
  evidence_policy?: CdmEligibilityEvidencePolicy;
  verification?: CdmVerificationMetadata;
  cdm_result_summary?: CdmEligibilityResultSummary;
  check_eligibility_result?: CheckEligibilityResult;
  error_code?: string;
  error_message?: string;
}
