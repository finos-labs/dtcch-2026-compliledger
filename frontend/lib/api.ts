const API_BASE = "/api";

export interface ProofStep {
  step_name: string;
  step_index: number;
  pass: boolean;
  reason_codes: string[];
  normalized_inputs_hash: string;
  evaluated_at: string;
}

export interface ProofBundle {
  bundle_version: string;
  asset_type: string;
  intent_hash: string;
  received_at: string;
  steps: ProofStep[];
  bundle_root_hash: string;
}

export interface DecisionRecord {
  decision: "ALLOW" | "DENY";
  decision_hash: string;
  bundle_root_hash: string;
}

export interface Attestation {
  attestation_version: string;
  asset_type: string;
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

export interface AnchorRecord {
  commitment_id: string;
  tx_hash: string;
  anchored_at: string;
  bundle_root_hash: string;
  attestation_hash: string;
}

export interface AlgorandTransaction {
  txn_id: string;
  confirmed_round: number;
  app_id: number;
  sender: string;
  note: string;
  timestamp: string;
}

export interface AlgorandAnchorResponse {
  anchored: boolean;
  network: string;
  anchor: AnchorRecord;
  algorand_transaction: AlgorandTransaction;
}

export interface AlgorandNetworkStatus {
  network: string;
  node_url: string;
  indexer_url: string;
  connected: boolean;
}

export interface SettlementIntent {
  asset_type: string;
  issuer_name: string;
  issuer_status: string;
  asset_id: string;
  classification: string;
  custody_provider: string;
  custody_valid: boolean;
  reserve_ratio: number;
}

export interface EnforcementResult {
  id: string;
  preset_id?: string;
  intent?: SettlementIntent;
  intent_hash: string;
  received_at: string;
  bundle: ProofBundle;
  decision: DecisionRecord;
  attestation: SignedAttestation | null;
  anchor?: AnchorRecord | null;
}

export interface VerifyResponse {
  signature_valid: boolean;
  bundle_exists: boolean;
  on_chain: boolean | null;
  tx_hash: string | null;
}

export async function runPreset(presetId: string): Promise<EnforcementResult> {
  const res = await fetch(`${API_BASE}/v1/intents/preset/${presetId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) {
    throw new Error(`Failed to run preset: ${res.statusText}`);
  }
  return res.json();
}

export async function anchorAttestation(intentId: string): Promise<AlgorandAnchorResponse> {
  const res = await fetch(`${API_BASE}/v1/attestations/${intentId}/anchor`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to anchor: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchAlgorandStatus(): Promise<AlgorandNetworkStatus> {
  const res = await fetch(`${API_BASE}/v1/algorand/status`);
  if (!res.ok) {
    throw new Error(`Algorand status check failed: ${res.statusText}`);
  }
  return res.json();
}

export async function verifyAttestation(
  attestationJson: string,
  signature: string,
  checkChain: boolean
): Promise<VerifyResponse> {
  const res = await fetch(`${API_BASE}/v1/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      attestation_json: attestationJson,
      signature,
      check_chain: checkChain,
    }),
  });
  if (!res.ok) {
    throw new Error(`Verification failed: ${res.statusText}`);
  }
  return res.json();
}

export interface StepExplanation {
  step_name: string;
  pass: boolean;
  explanation: string;
}

export interface ComplianceReasoning {
  summary: string;
  step_explanations: StepExplanation[];
  risk_assessment: string;
  recommendation: string;
}

export async function getIntent(intentId: string): Promise<EnforcementResult> {
  const res = await fetch(`${API_BASE}/v1/intents/${intentId}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch intent: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchReasoning(intentId: string): Promise<ComplianceReasoning> {
  const res = await fetch(`${API_BASE}/v1/reasoning/${intentId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) {
    throw new Error(`Reasoning failed: ${res.statusText}`);
  }
  return res.json();
}
