import { v4 as uuidv4 } from "uuid";
import type { AnchorRecord } from "./types";
import { anchorToDynamo, lookupByAttestationHash as dynamoLookup } from "./dynamo-anchor";

const CANTON_LEDGER_API   = process.env.CANTON_LEDGER_API_URL || "http://localhost:7575";
const CANTON_SUBMITTER    = process.env.CANTON_SUBMITTER_PARTY || "";
const CANTON_CUSTODIAN    = process.env.CANTON_CUSTODIAN_PARTY || "";
const CANTON_PACKAGE_ID   = process.env.CANTON_PACKAGE_ID || "";
const CANTON_DOMAIN       = process.env.CANTON_DOMAIN || "global-synchronizer.canton.network";
const CANTON_PARTICIPANT  = process.env.CANTON_PARTICIPANT || "sg-participant-01";
const SCHEMA_VERSION      = "sg-v1";

const TEMPLATE_ID = CANTON_PACKAGE_ID
  ? `${CANTON_PACKAGE_ID}:SettlementGuard.CommitmentRegistry:SettlementCommitment`
  : "SettlementGuard.CommitmentRegistry:SettlementCommitment";

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

function cantonAvailable(): boolean {
  return Boolean(CANTON_SUBMITTER && CANTON_CUSTODIAN);
}

async function cantonPost(path: string, body: unknown): Promise<Response> {
  return fetch(`${CANTON_LEDGER_API}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function cantonGet(path: string): Promise<Response> {
  return fetch(`${CANTON_LEDGER_API}${path}`);
}

export async function anchorToCantonLedger(
  bundleRootHash: string,
  attestationHash: string,
  intentId: string,
  assetType: string
): Promise<CantonAnchorResult> {
  const commandId  = `sg-cmd-${intentId.slice(0, 8)}-${uuidv4().slice(0, 4)}`;
  const workflowId = `sg-enforcement-${intentId.slice(0, 8)}`;

  if (cantonAvailable()) {
    const submitBody = {
      commands: [
        {
          CreateCommand: {
            templateId: TEMPLATE_ID,
            createArguments: {
              submitter:      CANTON_SUBMITTER,
              custodian:      CANTON_CUSTODIAN,
              intentId,
              attestationHash,
              bundleRootHash,
              assetType,
              schemaVersion:  SCHEMA_VERSION,
            },
          },
        },
      ],
      workflowId,
      commandId,
      actAs:  [CANTON_SUBMITTER],
      readAs: [CANTON_CUSTODIAN],
    };

    const resp = await cantonPost("/v2/commands/submit-and-wait", submitBody);

    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`Canton submit failed (${resp.status}): ${errText}`);
    }

    const data = await resp.json() as {
      transaction?: {
        transactionId: string;
        effectiveAt: string;
        events?: Array<{ Created?: { contractId: string } }>;
      };
    };

    const tx = data.transaction;
    if (!tx) throw new Error("Canton response missing transaction field");

    const contractId = tx.events
      ?.find((e) => e.Created)
      ?.Created?.contractId ?? "";

    const anchoredAt = tx.effectiveAt ?? new Date().toISOString();

    const anchor: AnchorRecord = {
      commitment_id:    commandId,
      tx_hash:          tx.transactionId,
      anchored_at:      anchoredAt,
      bundle_root_hash: bundleRootHash,
      attestation_hash: attestationHash,
    };

    await anchorToDynamo(bundleRootHash, attestationHash, intentId, assetType)
      .catch(() => {});

    return {
      anchor,
      canton_transaction: {
        transaction_id:       tx.transactionId,
        contract_id:          contractId,
        domain_id:            CANTON_DOMAIN,
        participant_id:       CANTON_PARTICIPANT,
        command_id:           commandId,
        workflow_id:          workflowId,
        ledger_effective_time: anchoredAt,
        record_time:          anchoredAt,
        template_id:          TEMPLATE_ID,
        payload: {
          attestation_hash: attestationHash,
          bundle_root_hash: bundleRootHash,
          intent_id:        intentId,
          asset_type:       assetType,
          schema_version:   SCHEMA_VERSION,
          anchored_at:      anchoredAt,
        },
      },
      network:     "canton-global-synchronizer",
      domain:      CANTON_DOMAIN,
      participant: CANTON_PARTICIPANT,
    };
  }

  const anchor = await anchorToDynamo(bundleRootHash, attestationHash, intentId, assetType);
  const cantonTx: CantonTransaction = {
    transaction_id:       anchor.tx_hash,
    contract_id:          "",
    domain_id:            CANTON_DOMAIN,
    participant_id:       CANTON_PARTICIPANT,
    command_id:           commandId,
    workflow_id:          workflowId,
    ledger_effective_time: anchor.anchored_at,
    record_time:          anchor.anchored_at,
    template_id:          TEMPLATE_ID,
    payload: {
      attestation_hash: attestationHash,
      bundle_root_hash: bundleRootHash,
      intent_id:        intentId,
      asset_type:       assetType,
      schema_version:   SCHEMA_VERSION,
      anchored_at:      anchor.anchored_at,
    },
  };
  return { anchor, canton_transaction: cantonTx, network: "dynamo-fallback", domain: CANTON_DOMAIN, participant: CANTON_PARTICIPANT };
}

export async function lookupCantonCommitment(
  attestationHash: string
): Promise<{ anchor: AnchorRecord; canton_metadata: Partial<CantonTransaction> } | null> {
  if (cantonAvailable()) {
    try {
      const resp = await cantonPost("/v2/state/active-contracts", {
        filter: {
          filtersByParty: {
            [CANTON_SUBMITTER]: {
              inclusive: { templateFilters: [{ templateId: TEMPLATE_ID }] },
            },
          },
        },
        verbose: false,
      });

      if (resp.ok) {
        const data = await resp.json() as { activeContracts?: Array<{ contractId: string; createArguments: Record<string, unknown> }> };
        const match = data.activeContracts?.find(
          (c) => c.createArguments?.attestationHash === attestationHash
        );

        if (match) {
          const args = match.createArguments;
          const anchoredAt = (args.anchoredAt as string) ?? new Date().toISOString();
          const anchor: AnchorRecord = {
            commitment_id:    match.contractId,
            tx_hash:          match.contractId,
            anchored_at:      anchoredAt,
            bundle_root_hash: args.bundleRootHash as string,
            attestation_hash: args.attestationHash as string,
          };
          return {
            anchor,
            canton_metadata: {
              contract_id:   match.contractId,
              domain_id:     CANTON_DOMAIN,
              participant_id: CANTON_PARTICIPANT,
              template_id:   TEMPLATE_ID,
            },
          };
        }
        return null;
      }
    } catch (err) {
      console.warn("Canton ACS query failed, falling back to DynamoDB:", (err as Error).message);
    }
  }

  const anchor = await dynamoLookup(attestationHash);
  if (!anchor) return null;
  return {
    anchor,
    canton_metadata: {
      transaction_id: anchor.tx_hash,
      contract_id:    "",
      domain_id:      CANTON_DOMAIN,
      participant_id: CANTON_PARTICIPANT,
      template_id:    TEMPLATE_ID,
    },
  };
}

export async function getCantonNetworkStatus(): Promise<Record<string, unknown>> {
  let status = "unavailable";
  let ledgerEnd: string | null = null;
  let connectedParties: string[] = [];

  if (cantonAvailable()) {
    try {
      const health = await cantonGet("/livez");
      if (health.ok) {
        status = "connected";
        const endResp = await cantonGet("/v2/state/ledger-end");
        if (endResp.ok) {
          const endData = await endResp.json() as { offset?: string };
          ledgerEnd = endData.offset ?? null;
        }
        connectedParties = [CANTON_SUBMITTER, CANTON_CUSTODIAN].filter(Boolean);
      }
    } catch {
      status = "unreachable";
    }
  } else {
    status = "not_configured";
  }

  return {
    network:     "canton-global-synchronizer",
    domain:      CANTON_DOMAIN,
    participant: CANTON_PARTICIPANT,
    status,
    ledger_api:  "json-api/v2",
    ledger_end:  ledgerEnd,
    parties:     connectedParties,
    package_id:  CANTON_PACKAGE_ID || null,
    commitment_table: process.env.DYNAMO_TABLE || "sg-commitment-registry",
    schema_version: SCHEMA_VERSION,
  };
}
