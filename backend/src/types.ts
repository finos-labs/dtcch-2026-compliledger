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

export interface ProofBundle {
  bundle_version: string;
  asset_type: AssetType;
  intent_hash: string;
  received_at: string;
  steps: ProofStepResult[];
  bundle_root_hash: string;
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
