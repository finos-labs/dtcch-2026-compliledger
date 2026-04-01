export type AssetType = "tokenized_treasury" | "stablecoin";
export type IssuerStatus = "active" | "suspended";
export type Classification = "tokenized_security" | "stablecoin" | "unknown";
export type Decision = "ALLOW" | "DENY";

export interface SettlementIntent {
  asset_type: AssetType;
  issuer_name: string;
  issuer_status: IssuerStatus;
  asset_id: string;
  classification: Classification;
  custody_provider: string;
  custody_valid: boolean;
  reserve_ratio: number;
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
  decision: Decision;
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
  decision_result: Decision;
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
