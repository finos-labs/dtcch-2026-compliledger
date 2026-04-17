export type AssetType = "tokenized_treasury" | "stablecoin";
export type IssuerStatus = "active" | "suspended";
export type Classification = "tokenized_security" | "stablecoin" | "unknown";
export type Decision = "ALLOW" | "DENY";
export type RuleDecision = "PASS" | "FAIL" | "CONDITIONAL";

export interface SettlementIntent {
  asset_type: AssetType;
  issuer_name: string;
  issuer_status: IssuerStatus;
  asset_id: string;
  classification: Classification;
  custody_provider: string;
  custody_valid: boolean;
  reserve_ratio: number;
  lei?: string;
  counterparty_lei?: string;
  notional_amount?: number;
  notional_currency?: string;
  settlement_date?: string;
  settlement_cycle?: "T0" | "T1" | "T2" | "T3";
  isin?: string;
  collateral_items?: CollateralItem[];
}

export interface CollateralItem {
  isin: string;
  description: string;
  market_value: number;
  currency: string;
  haircut: number;
  issuer_lei?: string;
  country?: string;
  sector?: string;
}

export interface ConcentrationLimit {
  dimension: "issuer" | "country" | "sector";
  key: string;
  max_pct: number;
}

export interface ConcentrationCheckResult {
  passed: boolean;
  breaches: Array<{ dimension: string; key: string; actual_pct: number; limit_pct: number }>;
}

export interface LEIRecord {
  lei: string;
  entity_status: "ACTIVE" | "INACTIVE" | "ANNULLED";
  legal_name: string;
  jurisdiction: string;
}

export interface FIGIRecord {
  figi: string;
  isin: string;
  security_type: string;
  market_sector: string;
  name: string;
}

export interface SanctionsMatch {
  list: string;
  name: string;
  score: number;
}

export interface SanctionsScreenResult {
  screened: boolean;
  matched: boolean;
  matches: SanctionsMatch[];
  screened_at: string;
}

export interface ReserveRatioResult {
  ratio: number;
  source: string;
  verified: boolean;
  as_of: string;
}

export type RegulatoryEventType =
  | "INTENT_SUBMITTED"
  | "ATTESTATION_ISSUED"
  | "ANCHOR_COMPLETED"
  | "VERIFY_REQUESTED"
  | "SANCTIONS_SCREENED"
  | "ORACLE_CALLED"
  | "ANCHOR_FAILED";

export interface RegulatoryEvent {
  event_id: string;
  correlation_id: string;
  event_type: RegulatoryEventType;
  timestamp: string;
  actor: string;
  data_hash: string;
  regulation_refs: string[];
  outcome: "SUCCESS" | "FAILURE" | "CONDITIONAL";
  metadata: Record<string, unknown>;
}

export interface ProofStepResult {
  step_name: string;
  step_index: number;
  pass: boolean;
  reason_codes: string[];
  normalized_inputs_hash: string;
  evaluated_at: string;
}

export interface OssEvaluation {
  /** Name of the OSS rule pack that was evaluated (e.g. "ISDA", "ISLA", "ICMA"). */
  rule_pack: string;
  /** Aggregated decision produced by the OSS rule set. */
  decision: RuleDecision;
  /** Reason codes emitted by any rules that did not pass. */
  reason_codes: string[];
}

/** Input contract for evaluateSettlementDecision(). */
export interface SettlementDecisionInput {
  transaction_id: string;
  phase: string;
  rule_pack: string;
  event_type: string;
  payload: Record<string, unknown>;
}

/** Output produced by evaluateSettlementDecision(), embedded in proof metadata. */
export interface SettlementDecisionResult {
  decision_result: RuleDecision;
  reason_codes: string[];
  rule_version_used: string;
  evaluated_at: string;
}

export interface ProofBundle {
  bundle_version: string;
  asset_type: AssetType;
  intent_hash: string;
  received_at: string;
  steps: ProofStepResult[];
  bundle_root_hash: string;
  /** Optional OSS rule evaluation embedded in the sealed bundle. */
  oss_evaluation?: OssEvaluation;
  /** Optional settlement decision evaluation embedded in the sealed bundle. */
  settlement_decision?: SettlementDecisionResult;
}

export interface DecisionRecord {
  decision: Decision;
  decision_hash: string;
  bundle_root_hash: string;
  decision_type?: "enforcement";
}

export interface Attestation {
  attestation_version: string;
  asset_type: AssetType;
  intent_id: string;
  intent_hash: string;
  bundle_root_hash: string;
  decision: "ALLOW";
  issued_at: string;
  signer: {
    name: string;
    key_id: string;
    key_version: string;
  };
}

export interface SignedAttestation {
  attestation: Attestation;
  attestation_hash: string;
  signature: string;
}

export interface IntentRecord {
  id: string;
  intent: SettlementIntent;
  intent_hash: string;
  received_at: string;
  bundle: ProofBundle;
  decision_record: DecisionRecord;
  signed_attestation: SignedAttestation | null;
  anchor: AnchorRecord | null;
}

export interface AnchorRecord {
  commitment_id: string;
  tx_hash: string;
  anchored_at: string;
  bundle_root_hash: string;
  attestation_hash: string;
}

export interface VerifyRequest {
  attestation_json: string;
  signature: string;
  check_chain?: boolean;
}

export interface VerifyResponse {
  signature_valid: boolean;
  bundle_exists: boolean;
  on_chain: boolean | null;
  tx_hash: string | null;
}
