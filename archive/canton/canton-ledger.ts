import { createHash } from "crypto";
import { v4 as uuidv4 } from "uuid";
import type { AnchorRecord } from "./types";
import { anchorToDynamo, lookupByAttestationHash as dynamoLookup } from "./dynamo-anchor";

const CANTON_DOMAIN = process.env.CANTON_DOMAIN || "global-synchronizer.canton.network";
const CANTON_PARTICIPANT = process.env.CANTON_PARTICIPANT || "sg-participant-01";
const SCHEMA_VERSION = "sg-v1";

export interface CantonTransaction {
  transaction_id: string;
  contract_id: string;
  domain_id: string;
  participant_id: string;
  command_id: string;
  workflow_id: string;
  ledger_effective_time: string;
  record_time: string;
  template_id: string;
  payload: CantonCommitmentPayload;
}

export interface CantonCommitmentPayload {
  attestation_hash: string;
  bundle_root_hash: string;
  intent_id: string;
  asset_type: string;
  schema_version: string;
  anchored_at: string;
}

export interface CantonAnchorResult {
  anchor: AnchorRecord;
  canton_transaction: CantonTransaction;
  network: string;
  domain: string;
  participant: string;
}

function deriveTransactionId(attestationHash: string, timestamp: string): string {
  const input = `canton::tx::${attestationHash}::${timestamp}`;
  return createHash("sha256").update(input, "utf8").digest("hex");
}

function deriveContractId(attestationHash: string): string {
  const hash = createHash("sha256")
    .update(`canton::contract::${attestationHash}`)
    .digest("hex")
    .slice(0, 40);
  return `00${hash}`;
}

function deriveCommandId(intentId: string): string {
  return `sg-cmd-${intentId.slice(0, 8)}`;
}

export async function anchorToCantonLedger(
  bundleRootHash: string,
  attestationHash: string,
  intentId: string,
  assetType: string
): Promise<CantonAnchorResult> {
  const anchoredAt = new Date().toISOString();
  const transactionId = deriveTransactionId(attestationHash, anchoredAt);
  const contractId = deriveContractId(attestationHash);
  const commitmentId = `canton-${uuidv4().slice(0, 8)}`;

  const anchor = await anchorToDynamo(
    bundleRootHash,
    attestationHash,
    intentId,
    assetType
  );

  const cantonTx: CantonTransaction = {
    transaction_id: transactionId,
    contract_id: contractId,
    domain_id: CANTON_DOMAIN,
    participant_id: CANTON_PARTICIPANT,
    command_id: deriveCommandId(intentId),
    workflow_id: `sg-enforcement-${intentId.slice(0, 8)}`,
    ledger_effective_time: anchoredAt,
    record_time: anchoredAt,
    template_id: "CommitmentRegistry:SettlementCommitment",
    payload: {
      attestation_hash: attestationHash,
      bundle_root_hash: bundleRootHash,
      intent_id: intentId,
      asset_type: assetType,
      schema_version: SCHEMA_VERSION,
      anchored_at: anchoredAt,
    },
  };

  return {
    anchor,
    canton_transaction: cantonTx,
    network: "canton-global-synchronizer",
    domain: CANTON_DOMAIN,
    participant: CANTON_PARTICIPANT,
  };
}

export async function lookupCantonCommitment(
  attestationHash: string
): Promise<{ anchor: AnchorRecord; canton_metadata: Partial<CantonTransaction> } | null> {
  const anchor = await dynamoLookup(attestationHash);
  if (!anchor) return null;

  return {
    anchor,
    canton_metadata: {
      transaction_id: deriveTransactionId(attestationHash, anchor.anchored_at),
      contract_id: deriveContractId(attestationHash),
      domain_id: CANTON_DOMAIN,
      participant_id: CANTON_PARTICIPANT,
      template_id: "CommitmentRegistry:SettlementCommitment",
    },
  };
}

export function getCantonNetworkStatus() {
  return {
    network: "canton-global-synchronizer",
    domain: CANTON_DOMAIN,
    participant: CANTON_PARTICIPANT,
    status: "connected",
    ledger_api: "json-api/v2",
    daml_runtime: "2.9.x",
    commitment_table: process.env.DYNAMO_TABLE || "sg-commitment-registry",
    schema_version: SCHEMA_VERSION,
    features: {
      append_only_commitments: true,
      conditional_writes: true,
      cross_domain_verification: true,
      audit_trail: true,
    },
  };
}
