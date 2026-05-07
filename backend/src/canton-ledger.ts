import { v4 as uuidv4 } from "uuid";
import jwt from "jsonwebtoken";
import type { AnchorRecord } from "./types";
import { anchorToDynamo, lookupByAttestationHash as dynamoLookup } from "./dynamo-anchor";
import { logger } from "./logger";

const CANTON_LEDGER_API   = process.env.CANTON_LEDGER_API_URL || "http://localhost:7575";
const CANTON_SUBMITTER    = process.env.CANTON_SUBMITTER_PARTY || "";
const CANTON_CUSTODIAN    = process.env.CANTON_CUSTODIAN_PARTY || "";
const CANTON_PACKAGE_ID   = process.env.CANTON_PACKAGE_ID || "";
const CANTON_DOMAIN       = process.env.CANTON_DOMAIN || "global-synchronizer.canton.network";
const CANTON_PARTICIPANT  = process.env.CANTON_PARTICIPANT || "sg-participant-01";
const SCHEMA_VERSION      = "sg-v1";

// Network profile is purely informational/configurational. It does NOT change submission
// behavior — the same Canton JSON Ledger API client is used for every profile. The profile
// only describes which deployment target the operator has wired into the env vars so that
// status/readiness reports are accurate. We never claim DevNet (or any non-local profile)
// is "live" until the configured ledger actually responds to a health probe.
const SUPPORTED_NETWORK_PROFILES = ["localnet", "devnet", "testnet", "mainnet"] as const;
type CantonNetworkProfile = (typeof SUPPORTED_NETWORK_PROFILES)[number];

function readNetworkProfile(): CantonNetworkProfile {
  const raw = (process.env.CANTON_NETWORK_PROFILE || "localnet").toLowerCase();
  return (SUPPORTED_NETWORK_PROFILES as readonly string[]).includes(raw)
    ? (raw as CantonNetworkProfile)
    : "localnet";
}

const CANTON_NETWORK_PROFILE: CantonNetworkProfile = readNetworkProfile();
const CANTON_JWT_SECRET      = process.env.CANTON_JWT_SECRET || "";
const CANTON_JWT_PRIVATE_KEY = process.env.CANTON_JWT_PRIVATE_KEY || "";
const CANTON_JWT_AUDIENCE    = process.env.CANTON_JWT_AUDIENCE || "https://daml.com/ledger-api";
const CANTON_LEDGER_USER     = process.env.CANTON_LEDGER_USER || "sg-service-account";

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
  network_profile: CantonNetworkProfile;
  domain: string;
  participant: string;
  completion_offset?: string;
}

function cantonAvailable(): boolean {
  return Boolean(CANTON_SUBMITTER && CANTON_CUSTODIAN);
}

function buildCantonJWT(actingParty: string): string | null {
  const payload = {
    sub:     CANTON_LEDGER_USER,
    aud:     CANTON_JWT_AUDIENCE,
    actAs:   [actingParty],
    readAs:  [CANTON_SUBMITTER, CANTON_CUSTODIAN].filter(Boolean),
    admin:   false,
  };

  if (CANTON_JWT_PRIVATE_KEY) {
    return jwt.sign(payload, CANTON_JWT_PRIVATE_KEY, {
      algorithm:  "RS256",
      expiresIn:  "5m",
      issuer:     "settlementguard",
    });
  }

  if (CANTON_JWT_SECRET) {
    return jwt.sign(payload, CANTON_JWT_SECRET, {
      expiresIn: "5m",
      issuer:    "settlementguard",
    });
  }

  return null;
}

function cantonHeaders(actingParty?: string): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = buildCantonJWT(actingParty ?? CANTON_SUBMITTER);
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

async function cantonPost(path: string, body: unknown, actingParty?: string): Promise<Response> {
  return fetch(`${CANTON_LEDGER_API}${path}`, {
    method: "POST",
    headers: cantonHeaders(actingParty),
    body: JSON.stringify(body),
  });
}

async function cantonGet(path: string): Promise<Response> {
  const headers = cantonHeaders();
  delete headers["Content-Type"];
  return fetch(`${CANTON_LEDGER_API}${path}`, { headers });
}

async function readStreamingContracts(
  resp: Response,
  attestationHash: string
): Promise<{ contractId: string; createArguments: Record<string, unknown> } | null> {
  if (!resp.body) return null;
  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const parsed = JSON.parse(trimmed) as Record<string, unknown>;
          const contract = parsed.activeContract ?? parsed;
          const args = (contract as Record<string, unknown>).createArguments as Record<string, unknown> | undefined;
          const cid = (contract as Record<string, unknown>).contractId as string | undefined;
          if (args?.attestationHash === attestationHash && cid) {
            reader.cancel();
            return { contractId: cid, createArguments: args };
          }
        } catch {
          /* partial JSON line — continue buffering */
        }
      }
    }
  } catch (err) {
    logger.warn({ err: (err as Error).message }, "Canton ACS stream read error");
  }
  return null;
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
              createdAt:      new Date().toISOString(),
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

    const completionOffset: string | undefined = (data as Record<string, unknown>).completionOffset as string | undefined;

    const anchor: AnchorRecord = {
      commitment_id:    commandId,
      tx_hash:          tx.transactionId,
      anchored_at:      anchoredAt,
      bundle_root_hash: bundleRootHash,
      attestation_hash: attestationHash,
    };

    if (contractId) {
      try {
        const exerciseBody = {
          commands: [{
            ExerciseCommand: {
              templateId: TEMPLATE_ID,
              contractId,
              choice: "AnchorCommitment",
              choiceArgument: {},
            },
          }],
          workflowId,
          commandId: `${commandId}-anchor`,
          actAs: [CANTON_CUSTODIAN],
          readAs: [CANTON_SUBMITTER],
        };
        const anchorResp = await cantonPost("/v2/commands/submit-and-wait", exerciseBody, CANTON_CUSTODIAN);
        if (!anchorResp.ok) {
          logger.warn({ status: anchorResp.status }, "AnchorCommitment choice failed — SettlementCommitment still recorded");
        } else {
          logger.info({ contractId }, "AnchorCommitment choice exercised — dual-party commitment confirmed");
        }
      } catch (err) {
        logger.warn({ err: (err as Error).message }, "AnchorCommitment exercise failed — continuing");
      }
    }

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
      network_profile: CANTON_NETWORK_PROFILE,
      domain:      CANTON_DOMAIN,
      participant: CANTON_PARTICIPANT,
      completion_offset: completionOffset,
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
  return { anchor, canton_transaction: cantonTx, network: "dynamo-fallback", network_profile: CANTON_NETWORK_PROFILE, domain: CANTON_DOMAIN, participant: CANTON_PARTICIPANT };
}

export async function lookupCantonCommitment(
  attestationHash: string,
  activeAtOffset?: string
): Promise<{ anchor: AnchorRecord; canton_metadata: Partial<CantonTransaction> } | null> {
  if (cantonAvailable()) {
    try {
      let queryOffset = activeAtOffset;
      if (!queryOffset) {
        const endResp = await cantonGet("/v2/state/ledger-end");
        if (endResp.ok) {
          const endData = await endResp.json() as { offset?: string };
          queryOffset = endData.offset;
        }
      }

      const acsBody: Record<string, unknown> = {
        filter: {
          filtersByParty: {
            [CANTON_SUBMITTER]: {
              inclusive: { templateFilters: [{ templateId: TEMPLATE_ID }] },
            },
          },
        },
        verbose: false,
      };
      if (queryOffset) acsBody.activeAtOffset = queryOffset;

      const resp = await cantonPost("/v2/state/active-contracts", acsBody);

      if (resp.ok) {
        const match = await readStreamingContracts(resp, attestationHash);

        if (match) {
          const args = match.createArguments;
          const anchoredAt = (args.createdAt as string) ?? new Date().toISOString();
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
  // Per-field configuration flags. These describe what the operator has wired
  // up via env vars and are independent of whether the ledger is actually
  // reachable. We never claim a Canton ledger is "connected" or "reachable"
  // unless a live probe to the configured JSON Ledger API succeeds.
  const ledgerApiUrlConfigured    = Boolean(process.env.CANTON_LEDGER_API_URL);
  const submitterPartyConfigured  = Boolean(CANTON_SUBMITTER);
  const custodianPartyConfigured  = Boolean(CANTON_CUSTODIAN);
  const packageIdConfigured       = Boolean(CANTON_PACKAGE_ID);
  const authTokenConfigured       = Boolean(CANTON_JWT_PRIVATE_KEY || CANTON_JWT_SECRET);

  // "configured" means we have everything needed to submit to a Canton ledger:
  // a URL, both parties, and the Daml package id. Auth is optional for some
  // dev deployments (LocalNet sandbox without auth), so it is reported as a
  // separate flag rather than gating `configured`.
  const configured =
    ledgerApiUrlConfigured &&
    submitterPartyConfigured &&
    custodianPartyConfigured &&
    packageIdConfigured;

  // Network identity for status reporting. CANTON_NETWORK / CANTON_NETWORK_LABEL
  // are the new public-facing knobs. We fall back to the legacy
  // CANTON_NETWORK_PROFILE so existing deployments keep working.
  const networkRaw =
    (process.env.CANTON_NETWORK || process.env.CANTON_NETWORK_PROFILE || "localnet")
      .toLowerCase();
  const network = networkRaw || "localnet";
  const networkLabel =
    process.env.CANTON_NETWORK_LABEL ||
    (network === "devnet"   ? "DevNet"   :
     network === "testnet"  ? "TestNet"  :
     network === "mainnet"  ? "MainNet"  :
     network === "localnet" ? "LocalNet" : network);

  const mode: "localnet" | "devnet" | "unknown" =
    network === "localnet" ? "localnet" :
    network === "devnet"   ? "devnet"   : "unknown";

  // Reachability probe. If we have no URL we cannot probe; reachable=false.
  // Otherwise try the same lightweight endpoints the rest of the repo uses
  // (`/livez` for liveness, `/v2/state/ledger-end` for ledger-end). All
  // network errors are swallowed — this endpoint must never throw 500.
  let reachable = false;
  let ledgerEndAvailable = false;
  let ledgerEnd: string | null = null;
  if (ledgerApiUrlConfigured) {
    try {
      const health = await cantonGet("/livez");
      if (health.ok) {
        reachable = true;
      }
    } catch {
      // unreachable — leave reachable=false
    }

    try {
      const endResp = await cantonGet("/v2/state/ledger-end");
      if (endResp.ok) {
        // A successful ledger-end response also proves reachability, even
        // when /livez is not exposed by the deployment (e.g. some validators).
        reachable = true;
        ledgerEndAvailable = true;
        try {
          const endData = await endResp.json() as { offset?: string };
          ledgerEnd = endData.offset ?? null;
        } catch {
          /* ledger-end body not JSON — still counts as available */
        }
      }
    } catch {
      // unreachable for ledger-end — leave ledgerEndAvailable=false
    }
  }

  // Backwards-compatible `status` string used by existing frontend consumers.
  // Only report "connected" when a real reachability check succeeded.
  let legacyStatus: string;
  if (!cantonAvailable()) {
    legacyStatus = "not_configured";
  } else if (reachable) {
    legacyStatus = "connected";
  } else if (ledgerApiUrlConfigured) {
    legacyStatus = "unreachable";
  } else {
    legacyStatus = "unavailable";
  }

  const connectedParties = reachable
    ? [CANTON_SUBMITTER, CANTON_CUSTODIAN].filter(Boolean)
    : [];

  // `devnet_ready` (legacy) — only true when the operator opted into devnet,
  // every DevNet-grade env var is populated (incl. RS256 JWT signing key),
  // AND the configured ledger actually responded.
  const requiredForRemote = {
    CANTON_LEDGER_API_URL:    ledgerApiUrlConfigured,
    CANTON_SUBMITTER_PARTY:   submitterPartyConfigured,
    CANTON_CUSTODIAN_PARTY:   custodianPartyConfigured,
    CANTON_PACKAGE_ID:        packageIdConfigured,
    CANTON_JWT_PRIVATE_KEY:   Boolean(CANTON_JWT_PRIVATE_KEY),
  };
  const missingForRemote = Object.entries(requiredForRemote)
    .filter(([, present]) => !present)
    .map(([name]) => name);
  const devnetReady =
    (CANTON_NETWORK_PROFILE === "devnet" || mode === "devnet") &&
    missingForRemote.length === 0 &&
    reachable;

  return {
    // New readiness fields (LocalNet / DevNet status contract).
    configured,
    network,
    network_label: networkLabel,
    ledger_api_url_configured:  ledgerApiUrlConfigured,
    submitter_party_configured: submitterPartyConfigured,
    custodian_party_configured: custodianPartyConfigured,
    package_id_configured:      packageIdConfigured,
    auth_token_configured:      authTokenConfigured,
    reachable,
    ledger_end_available:       ledgerEndAvailable,
    mode,

    // Backwards-compatible fields (frontend + existing tooling consumers).
    network_profile: CANTON_NETWORK_PROFILE,
    domain:      CANTON_DOMAIN,
    participant: CANTON_PARTICIPANT,
    status:      legacyStatus,
    ledger_api:  "json-api/v2",
    ledger_end:  ledgerEnd,
    parties:     connectedParties,
    package_id:  CANTON_PACKAGE_ID || null,
    commitment_table: process.env.DYNAMO_TABLE || "sg-commitment-registry",
    schema_version: SCHEMA_VERSION,
    devnet_ready: devnetReady,
    missing_remote_env: missingForRemote,
  };
}
