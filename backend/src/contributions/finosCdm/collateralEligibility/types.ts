export const CONTRIBUTION_ID = "finos-cdm-collateral-eligibility" as const;

export type SourceValidation = "PENDING_SOURCE_VALIDATION";
export type MappingStatus = "UNMAPPED" | "CALLER_SUPPLIED_UNVALIDATED";
export type ReasonCode =
  | "AUTHORITATIVE_RULE_NOT_CONFIGURED"
  | "ADAPTER_INPUT_INVALID"
  | "MAPPING_INVALID"
  | "EVIDENCE_MISSING"
  | "EVIDENCE_INVALID"
  | "EVIDENCE_UNVALIDATED";

export interface Reason {
  code: ReasonCode;
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
}

// A future implementation must be installed only after reviewed source/provision
// lineage is established. The private brand prevents legacy Rule/provider objects
// from satisfying this interface by structural coincidence.
declare const reviewedRuleBoundary: unique symbol;
export interface CollateralEligibilityRule {
  readonly [reviewedRuleBoundary]: true;
  readonly id: string;
  readonly version: string;
  evaluate(
    collateralFacts: readonly CollateralFact[],
    evidence: readonly Evidence[],
    evaluationContext: EvaluationContext
  ): EvaluationResult;
}

export interface Assessment {
  contributionId: typeof CONTRIBUTION_ID;
  input: { sourceObject: unknown; sourceReference: string | null };
  mappings: OptionalMapping[];
  facts: CollateralFact[];
  evidence: Evidence[];
  sourceValidation: SourceValidation;
  context: EvaluationContext;
  evaluation: EvaluationResult;
}
