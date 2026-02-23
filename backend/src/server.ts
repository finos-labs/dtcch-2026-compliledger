import express from "express";
import cors from "cors";
import { v4 as uuidv4 } from "uuid";
import type { SettlementIntent, VerifyRequest, VerifyResponse, AnchorRecord } from "./types";
import { canonicalStringify, sha256, verifySignature, getPublicKeyB64 } from "./crypto";
import { executeProofChain } from "./proof-chain";
import { sealBundle } from "./bundle";
import { computeDecision } from "./decision";
import { issueAttestation, recomputeAttestationHash } from "./attestation";
import { saveIntent, getIntent, getIntentByBundleHash, getIntentByAttestationHash, updateAnchor, getAllIntents } from "./db";
import { PRESETS } from "./presets";

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

function validateIntent(body: unknown): { valid: boolean; error?: string; intent?: SettlementIntent } {
  const b = body as Record<string, unknown>;

  if (!b || typeof b !== "object") {
    return { valid: false, error: "Request body must be a JSON object" };
  }

  const requiredFields = [
    "asset_type", "issuer_name", "issuer_status", "asset_id",
    "classification", "custody_provider", "custody_valid", "reserve_ratio",
  ];

  for (const field of requiredFields) {
    if (b[field] === undefined || b[field] === null) {
      return { valid: false, error: `Missing required field: ${field}` };
    }
  }

  if (b.asset_type !== "tokenized_treasury" && b.asset_type !== "stablecoin") {
    return { valid: false, error: "asset_type must be 'tokenized_treasury' or 'stablecoin'" };
  }

  if (b.issuer_status !== "active" && b.issuer_status !== "suspended") {
    return { valid: false, error: "issuer_status must be 'active' or 'suspended'" };
  }

  if (typeof b.reserve_ratio !== "number") {
    return { valid: false, error: "reserve_ratio must be a number" };
  }

  return { valid: true, intent: b as unknown as SettlementIntent };
}

// POST /v1/intents — Submit a settlement intent for enforcement
app.post("/v1/intents", (req, res) => {
  const validation = validateIntent(req.body);
  if (!validation.valid || !validation.intent) {
    res.status(400).json({ error: validation.error });
    return;
  }

  const intent = validation.intent;
  const intentId = uuidv4();
  const receivedAt = new Date().toISOString();
  const intentHash = sha256(canonicalStringify(intent));

  // Execute the Canonical Proof Chain
  const steps = executeProofChain(intent);

  // Seal the proof bundle
  const bundle = sealBundle(intentHash, receivedAt, intent, steps);

  // Compute decision
  const decisionRecord = computeDecision(steps, bundle.bundle_root_hash);

  // Issue attestation only if ALLOW
  let signedAttestation = null;
  if (decisionRecord.decision === "ALLOW") {
    signedAttestation = issueAttestation(
      intentId,
      intentHash,
      bundle.bundle_root_hash,
      intent.asset_type
    );
  }

  // Persist
  const record = {
    id: intentId,
    intent,
    intent_hash: intentHash,
    received_at: receivedAt,
    bundle,
    decision_record: decisionRecord,
    signed_attestation: signedAttestation,
    anchor: null,
  };
  saveIntent(record);

  res.status(201).json({
    id: intentId,
    intent_hash: intentHash,
    received_at: receivedAt,
    bundle,
    decision: decisionRecord,
    attestation: signedAttestation,
  });
});

// POST /v1/intents/preset/:presetId — Run a preset scenario
app.post("/v1/intents/preset/:presetId", (req, res) => {
  const presetId = req.params.presetId;
  const preset = PRESETS[presetId];

  if (!preset) {
    res.status(404).json({
      error: `Unknown preset: ${presetId}`,
      available: Object.keys(PRESETS),
    });
    return;
  }

  const intent = { ...preset };
  const intentId = uuidv4();
  const receivedAt = new Date().toISOString();
  const intentHash = sha256(canonicalStringify(intent));

  const steps = executeProofChain(intent);
  const bundle = sealBundle(intentHash, receivedAt, intent, steps);
  const decisionRecord = computeDecision(steps, bundle.bundle_root_hash);

  let signedAttestation = null;
  if (decisionRecord.decision === "ALLOW") {
    signedAttestation = issueAttestation(
      intentId,
      intentHash,
      bundle.bundle_root_hash,
      intent.asset_type
    );
  }

  const record = {
    id: intentId,
    intent,
    intent_hash: intentHash,
    received_at: receivedAt,
    bundle,
    decision_record: decisionRecord,
    signed_attestation: signedAttestation,
    anchor: null,
  };
  saveIntent(record);

  res.status(201).json({
    id: intentId,
    preset_id: presetId,
    intent_hash: intentHash,
    received_at: receivedAt,
    bundle,
    decision: decisionRecord,
    attestation: signedAttestation,
  });
});

// GET /v1/intents — List all intents
app.get("/v1/intents", (_req, res) => {
  const records = getAllIntents();
  res.json({ intents: records });
});

// GET /v1/intents/:id — Get a specific intent record
app.get("/v1/intents/:id", (req, res) => {
  const record = getIntent(req.params.id);
  if (!record) {
    res.status(404).json({ error: "Intent not found" });
    return;
  }
  res.json(record);
});

// POST /v1/verify — Verify an attestation
app.post("/v1/verify", (req, res) => {
  const body = req.body as VerifyRequest;

  if (!body.attestation_json || !body.signature) {
    res.status(400).json({ error: "attestation_json and signature are required" });
    return;
  }

  let attestationHash: string;
  let parsedAttestation: Record<string, unknown>;
  try {
    parsedAttestation = JSON.parse(body.attestation_json);
    attestationHash = recomputeAttestationHash(body.attestation_json);
  } catch {
    res.status(400).json({ error: "Invalid attestation JSON" });
    return;
  }

  const signatureValid = verifySignature(attestationHash, body.signature);

  const bundleRootHash = parsedAttestation.bundle_root_hash as string;
  const bundleRecord = bundleRootHash ? getIntentByBundleHash(bundleRootHash) : null;
  const bundleExists = bundleRecord !== null;

  let onChain: boolean | null = null;
  let txHash: string | null = null;

  if (body.check_chain && bundleRecord?.anchor) {
    onChain = true;
    txHash = bundleRecord.anchor.tx_hash;
  } else if (body.check_chain) {
    onChain = false;
  }

  const response: VerifyResponse = {
    signature_valid: signatureValid,
    bundle_exists: bundleExists,
    on_chain: onChain,
    tx_hash: txHash,
  };

  res.json(response);
});

// POST /v1/attestations/:id/anchor — Anchor an attestation on-chain
app.post("/v1/attestations/:id/anchor", (req, res) => {
  const record = getIntent(req.params.id);
  if (!record) {
    res.status(404).json({ error: "Intent not found" });
    return;
  }

  if (!record.signed_attestation) {
    res.status(400).json({ error: "No attestation to anchor (decision was DENY)" });
    return;
  }

  if (record.anchor) {
    res.status(409).json({
      error: "Already anchored",
      anchor: record.anchor,
    });
    return;
  }

  // Simulate Canton anchoring
  // In production, this would call the Canton Network Ledger API
  const anchor: AnchorRecord = {
    commitment_id: `canton-${uuidv4().slice(0, 8)}`,
    tx_hash: `0x${sha256(record.signed_attestation.attestation_hash + Date.now()).slice(0, 64)}`,
    anchored_at: new Date().toISOString(),
    bundle_root_hash: record.bundle.bundle_root_hash,
    attestation_hash: record.signed_attestation.attestation_hash,
  };

  updateAnchor(record.id, anchor);

  res.json({
    anchored: true,
    anchor,
  });
});

// GET /v1/presets — List available demo presets
app.get("/v1/presets", (_req, res) => {
  const presets = Object.entries(PRESETS).map(([id, intent]) => ({
    id,
    asset_type: intent.asset_type,
    expected_outcome: intent.custody_valid && intent.reserve_ratio >= 1.0 ? "ALLOW" : "DENY",
    description: getPresetDescription(id),
  }));
  res.json({ presets });
});

// GET /v1/public-key — Get the public key for signature verification
app.get("/v1/public-key", (_req, res) => {
  res.json({ public_key: getPublicKeyB64(), key_id: "sg-demo-key-01" });
});

// GET /health — Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "SettlementGuard", version: "0.1.0" });
});

function getPresetDescription(id: string): string {
  const descriptions: Record<string, string> = {
    "treasury-fail": "Tokenized Treasury with invalid custody — expects DENY",
    "stablecoin-fail": "Stablecoin with reserve ratio 0.97 — expects DENY",
    "treasury-pass": "Fully compliant Tokenized Treasury — expects ALLOW",
    "stablecoin-pass": "Well-reserved Stablecoin (1.02 ratio) — expects ALLOW",
  };
  return descriptions[id] || "";
}

app.listen(PORT, () => {
  console.log(`SettlementGuard backend running on http://localhost:${PORT}`);
  console.log(`Public key: ${getPublicKeyB64()}`);
});
