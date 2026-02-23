import type { SettlementIntent, ProofStepResult } from "./types";
import { canonicalStringify, sha256 } from "./crypto";

type ProofStep = (intent: SettlementIntent, index: number) => ProofStepResult;

function makeInputsHash(inputs: Record<string, unknown>): string {
  return sha256(canonicalStringify(inputs));
}

function issuerLegitimacy(intent: SettlementIntent, index: number): ProofStepResult {
  const pass = intent.issuer_status === "active";
  const reasonCodes: string[] = [];

  if (!pass) {
    reasonCodes.push("ISSUER_NOT_ACTIVE");
  }

  return {
    step_name: "issuer_legitimacy",
    step_index: index,
    pass,
    reason_codes: reasonCodes,
    normalized_inputs_hash: makeInputsHash({
      issuer_name: intent.issuer_name,
      issuer_status: intent.issuer_status,
    }),
    evaluated_at: new Date().toISOString(),
  };
}

function assetClassification(intent: SettlementIntent, index: number): ProofStepResult {
  let pass = false;
  const reasonCodes: string[] = [];

  if (intent.asset_type === "tokenized_treasury") {
    pass = intent.classification === "tokenized_security";
    if (!pass) {
      reasonCodes.push("CLASSIFICATION_MISMATCH_EXPECTED_TOKENIZED_SECURITY");
    }
  } else if (intent.asset_type === "stablecoin") {
    pass = intent.classification === "stablecoin";
    if (!pass) {
      reasonCodes.push("CLASSIFICATION_MISMATCH_EXPECTED_STABLECOIN");
    }
  } else {
    reasonCodes.push("UNKNOWN_ASSET_TYPE");
  }

  return {
    step_name: "asset_classification",
    step_index: index,
    pass,
    reason_codes: reasonCodes,
    normalized_inputs_hash: makeInputsHash({
      asset_type: intent.asset_type,
      classification: intent.classification,
    }),
    evaluated_at: new Date().toISOString(),
  };
}

function custodyConditions(intent: SettlementIntent, index: number): ProofStepResult {
  const pass = intent.custody_valid === true;
  const reasonCodes: string[] = [];

  if (!pass) {
    reasonCodes.push("CUSTODY_INVALID");
  }

  return {
    step_name: "custody_conditions",
    step_index: index,
    pass,
    reason_codes: reasonCodes,
    normalized_inputs_hash: makeInputsHash({
      custody_provider: intent.custody_provider,
      custody_valid: intent.custody_valid,
    }),
    evaluated_at: new Date().toISOString(),
  };
}

function backingReserve(intent: SettlementIntent, index: number): ProofStepResult {
  const pass = intent.reserve_ratio >= 1.0;
  const reasonCodes: string[] = [];

  if (!pass) {
    reasonCodes.push(`RESERVE_INSUFFICIENT_${intent.reserve_ratio}`);
  }

  return {
    step_name: "backing_reserve",
    step_index: index,
    pass,
    reason_codes: reasonCodes,
    normalized_inputs_hash: makeInputsHash({
      reserve_ratio: intent.reserve_ratio,
    }),
    evaluated_at: new Date().toISOString(),
  };
}

const PROOF_CHAIN: ProofStep[] = [
  issuerLegitimacy,
  assetClassification,
  custodyConditions,
  backingReserve,
];

export function executeProofChain(intent: SettlementIntent): ProofStepResult[] {
  return PROOF_CHAIN.map((step, index) => step(intent, index));
}
