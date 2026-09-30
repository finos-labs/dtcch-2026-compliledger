export const CONTRIBUTION_ID = "finos-cdm-collateral-eligibility" as const;

export type SourceValidation = "PENDING_SOURCE_VALIDATION";
export type MappingStatus = "UNMAPPED" | "CALLER_SUPPLIED_UNVALIDATED";
export type ReasonCode =
  | "AUTHORITATIVE_RULE_NOT_CONFIGURED"
  | "ADAPTER_INPUT_INVALID"
  | "MAPPING_INVALID"
  | "EVIDENCE_MISSING"
  | "EVIDENCE_INVALID"
  | "EVIDENCE_UNVALIDATED"
  | "RULE_APPLICABILITY_UNRESOLVED"
  | "RULE_NOT_APPLICABLE"
  | "RULE_EXECUTION_INVALID";

export interface Reason {
  code: string;
  message: string;
  factRef?: string;
  evidenceId?: string;
  sourceReference?: string;
}

export interface SourceLocation {
  sourceReference: string;
  sourcePath?: string;
}

// Candidate names are caller-owned INTERNAL attributes, not FINOS CDM fields
// or mandatory inputs for any future eligibility requirement.
export interface OptionalMapping {
  factRef: string;
  sourcePath: string;
  mappingId: string;
  mappingVersion: string;
  status: "CALLER_SUPPLIED_UNVALIDATED";
}

export interface AdapterEnvelope {
  sourceObject: unknown;
  sourceReference: string;
  mappings?: OptionalMapping[];
  expectedFactRefs?: string[];
}

export interface SourceFact {
  kind: "SOURCE";
  factRef: string;
  observedValue: unknown;
  source: SourceLocation;
  mappingId: string;
  mappingVersion: string;
  mappingStatus: "CALLER_SUPPLIED_UNVALIDATED";
}

export interface DerivedFact {
  kind: "DERIVED";
  factRef: string;
  observedValue: unknown;
  derivationId: string;
  derivationVersion: string;
  inputFactRefs: string[];
  source: SourceLocation;
}

export interface UnavailableFact {
  kind: "UNAVAILABLE";
  factRef: string;
  source: SourceLocation;
  mappingStatus: MappingStatus;
}

export type CollateralFact = SourceFact | DerivedFact | UnavailableFact;

export interface AdaptedCollateral {
  contributionId: typeof CONTRIBUTION_ID;
  sourceObject: unknown;
  sourceReference: string | null;
  sourceValidation: SourceValidation;
  mappings: OptionalMapping[];
  facts: CollateralFact[];
  diagnostics: Reason[];
}

export interface EvidenceInput {
  evidenceId: string;
  source: string;
  sourceReference: string;
  observedValue: unknown;
  observedAt?: string;
  provenance?: string;
  factRef?: string;
}

export interface Evidence extends EvidenceInput {
  validation: "UNVALIDATED" | "INVALID";
}

export interface EvidenceValidation {
  evidence: Evidence[];
  diagnostics: Reason[];
}

export interface EvaluationContext {
  evaluatedAt: string;
}

export type Decision =
  | "SATISFIED"
  | "NOT_SATISFIED"
  | "INSUFFICIENT_EVIDENCE"
  | "MANUAL_REVIEW_REQUIRED"
  | "RULE_NOT_CONFIGURED";

export interface EvaluationResult {
  decision: Decision;
  rule: { id: string; version: string } | null;
  reasons: Reason[];
  evidenceDiagnostics: Reason[];
  sourceValidation: SourceValidation;
  ruleMetadata?: CollateralEligibilityRuleMetadata;
  sourceReview?: RuleSourceReviewAdmission;
}

export type ReviewableValue<T> =
  | { status: "UNRESOLVED"; value: null }
  | { status: "REVIEWED"; value: T };

export type ApplicabilityValue<T> =
  | ReviewableValue<T>
  | { status: "NOT_APPLICABLE"; value: null };

export type ReviewedDeclaration<T> =
  | { status: "UNRESOLVED"; value: null }
  | { status: "REVIEWED"; value: T };

export interface RuleSourceDocument {
  title: string;
  reference: string;
  version: string;
}

export interface RuleReasonCodeDeclaration {
  code: string;
  description: string;
}

export interface RuleProvenance {
  sourceReference: string;
  documentVersion: string;
  provisionReference: string;
  notes: string[];
}

export interface CollateralEligibilityRuleMetadata {
  contributionId: typeof CONTRIBUTION_ID;
  ruleId: string | null;
  ruleVersion: string | null;
  sourceAuthority: ReviewableValue<string>;
  sourceDocument: ReviewableValue<RuleSourceDocument>;
  sourceProvision: ReviewableValue<string>;
  effectiveDate: ApplicabilityValue<string>;
  jurisdiction: ApplicabilityValue<string[]>;
  scope: ApplicabilityValue<string[]>;
  applicabilityConditions: ReviewedDeclaration<string[]>;
  requiredInputs: ReviewedDeclaration<string[]>;
  requiredEvidence: ReviewedDeclaration<string[]>;
  reasonCodes: ReviewedDeclaration<RuleReasonCodeDeclaration[]>;
  provenance: ReviewedDeclaration<RuleProvenance>;
}

export interface RuleSourceReviewAdmission {
  recordType: "APPLICATION_CONTROLLED_SOURCE_REVIEW";
  disposition: "APPROVED_FOR_REGISTRATION";
  reviewerId: string;
  reviewReference: string;
  reviewedAt: string;
  reviewedMetadata: CollateralEligibilityRuleMetadata;
}

export type ApplicabilityOutcome = "APPLICABLE" | "NOT_APPLICABLE" | "UNKNOWN";

export interface RuleEvaluationOutput {
  decision: Exclude<Decision, "RULE_NOT_CONFIGURED">;
  rule: { id: string; version: string };
  reasons: Reason[];
}

// Executable candidates must be admitted to a runtime registry before the
// pipeline will invoke either callback.
export interface CollateralEligibilityRule {
  readonly id: string;
  readonly version: string;
  checkApplicability(
    collateralFacts: readonly CollateralFact[],
    evidence: readonly Evidence[],
    evaluationContext: EvaluationContext
  ): ApplicabilityOutcome;
  evaluate(
    collateralFacts: readonly CollateralFact[],
    evidence: readonly Evidence[],
    evaluationContext: EvaluationContext
  ): RuleEvaluationOutput;
}

export type RuleLifecycle = "DRAFT" | "TEMPLATE" | "REVIEW_COMPLETE";

export type CollateralEligibilityRuleDefinition =
  | {
      lifecycle: "DRAFT" | "TEMPLATE";
      metadata: CollateralEligibilityRuleMetadata;
      checkApplicability?: null;
      evaluate?: null;
    }
  | {
      lifecycle: "REVIEW_COMPLETE";
      metadata: CollateralEligibilityRuleMetadata;
      checkApplicability: CollateralEligibilityRule["checkApplicability"];
      evaluate: CollateralEligibilityRule["evaluate"];
    };

export interface RegisteredCollateralEligibilityRule {
  readonly kind: "REGISTERED_COLLATERAL_ELIGIBILITY_RULE";
}

export interface Assessment {
  contributionId: typeof CONTRIBUTION_ID;
  input: { sourceObject: unknown; sourceReference: string | null };
  mappings: OptionalMapping[];
  facts: CollateralFact[];
  adapterDiagnostics: Reason[];
  evidence: Evidence[];
  sourceValidation: SourceValidation;
  context: EvaluationContext;
  evaluation: EvaluationResult;
}

export interface CollateralSubject {
  kind: { status: "UNRESOLVED"; value: null };
  reference:
    | { status: "SOURCE_REFERENCE_ONLY"; value: string }
    | { status: "UNRESOLVED"; value: null };
  identityAssertion: "NOT_ESTABLISHED";
}

export interface CollateralOperationalState {
  factRefs: string[];
  evidenceReferences: string[];
  evidenceObservations: { evidenceId: string; observedAt: string | null }[];
  evaluationTime: string;
  sourceAsOf: null;
  freshness: "UNKNOWN";
  diagnostics: { normalization: Reason[]; evidence: Reason[] };
}

export type CapturedReplayInput =
  | { status: "ABSENT" | "NULL" }
  | { status: "VALUE"; value: unknown };

export interface AssessmentReplay {
  input: CapturedReplayInput;
  evidence: CapturedReplayInput;
  context: EvaluationContext;
}

export interface ProofArtifactPayload {
  artifactType: "FINOS_CDM_COLLATERAL_ELIGIBILITY_ASSESSMENT";
  schemaVersion: 1;
  canonicalizationVersion: "COMPLIOPEN_JSON_KEY_SORT_V1";
  pipelineVersion: "COMPLIOPEN_FINOS_CDM_COLLATERAL_ELIGIBILITY_PIPELINE_V1";
  normalizationVersion: "COMPLIOPEN_FINOS_CDM_COLLATERAL_NORMALIZATION_V1";
  subject: CollateralSubject;
  operationalState: CollateralOperationalState;
  replay: AssessmentReplay;
  assessment: Assessment;
}

export interface ProofArtifact extends ProofArtifactPayload {
  commitment: { algorithm: "SHA-256"; digest: string };
}

export interface ProofVerification {
  integrity: "VERIFIED" | "FAILED" | "UNSUPPORTED";
  replay: "VERIFIED" | "MISMATCH" | "UNAVAILABLE" | "NOT_ATTEMPTED";
  reasons: { code: string; message: string }[];
  recordedDecision: Decision | null;
  determinationAuthority: "NOT_ESTABLISHED_BY_PROOF_VERIFICATION";
}
