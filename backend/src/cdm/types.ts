export type EligibilityQueryField =
  | "maturity"
  | "collateralAssetType"
  | "assetCountryOfOrigin"
  | "denominatedCurrency"
  | "agencyRating"
  | "issuerType"
  | "issuerName";

export interface EligibleCollateralSpecification {
  id?: string;
  name?: string;
  version?: string;
  criteria: Record<string, unknown>;
}

export interface EligibilityQuery {
  maturity: string;
  collateralAssetType: string;
  assetCountryOfOrigin: string;
  denominatedCurrency: string;
  agencyRating: string;
  issuerType: string;
  issuerName: string;
}

export interface CheckEligibilityResult {
  isEligible: boolean;
  matchingEligibleCriteria: unknown[];
  eligibilityQuery: EligibilityQuery;
  specification: EligibleCollateralSpecification;
}

export interface EvidenceReference {
  evidence_id: string;
  source: string;
  attribute: EligibilityQueryField;
  claim_value: string;
  observed_at: string;
  provenance?: string;
  version?: string;
  integrity_hash?: string;
}

export interface CdmEligibilityRequest {
  specification: EligibleCollateralSpecification;
  query_evidence: Partial<Record<EligibilityQueryField, EvidenceReference[]>>;
}

export interface PreparedEligibilityEvidence {
  query: EligibilityQuery;
  query_hash: string;
  evidence_lineage: Record<EligibilityQueryField, EvidenceReference[]>;
  evidence_lineage_hash: string;
  missing_fields: EligibilityQueryField[];
  conflicting_fields: EligibilityQueryField[];
}

export interface CdmFunctionMetadata {
  function_name: string;
  model_name: string;
  model_version: string;
  runtime: string;
}

export interface CdmVerificationMetadata {
  verified: boolean;
  reason?: string;
  key_id?: string;
  algorithm?: string;
  content_hash?: string;
  signature?: string;
}

export interface CdmEligibilityEvaluationResponse {
  result: CheckEligibilityResult;
  metadata: CdmFunctionMetadata;
  verification: CdmVerificationMetadata;
}

export type CdmEligibilityAssessmentStatus =
  | "eligible"
  | "ineligible"
  | "indeterminate_missing_evidence"
  | "indeterminate_conflicting_evidence"
  | "technical_error";

export interface CdmEligibilityAssessment {
  status: CdmEligibilityAssessmentStatus;
  evaluated_at: string;
  specification: EligibleCollateralSpecification;
  query?: EligibilityQuery;
  query_hash?: string;
  evidence_lineage_hash?: string;
  evidence_lineage?: Record<EligibilityQueryField, EvidenceReference[]>;
  missing_fields?: EligibilityQueryField[];
  conflicting_fields?: EligibilityQueryField[];
  cdm_function?: CdmFunctionMetadata;
  verification?: CdmVerificationMetadata;
  check_eligibility_result?: CheckEligibilityResult;
  error_code?: string;
  error_message?: string;
}
