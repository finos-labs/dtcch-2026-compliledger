import "dotenv/config";
import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { v4 as uuidv4 } from "uuid";
import type { SettlementIntent, VerifyRequest, VerifyResponse, AnchorRecord, SettlementDecisionResult } from "./types";
import { canonicalStringify, sha256, verifySignature, getPublicKeyB64, getSigningKeyId, getSigningKeyVersion } from "./crypto";
import { executeProofChain } from "./proof-chain";
import { sealBundle } from "./bundle";
import { computeDecision } from "./decision";
import { issueAttestation, recomputeAttestationHash } from "./attestation";
import { saveIntent, getIntent, getIntentByBundleHash, getIntentByAttestationHash, updateAnchor, getAllIntents } from "./db";
import { PRESETS } from "./presets";
import { RuleRegistry, ruleRegistry } from "./engine/ruleRegistry";
import { evaluateRules, evaluateSettlementDecision } from "./engine/decisionProvider";
import { anchorToDynamo, lookupByAttestationHash } from "./dynamo-anchor";
import { anchorToCantonLedger, lookupCantonCommitment, getCantonNetworkStatus } from "./canton-ledger";
import { generateComplianceReasoning } from "./bedrock-reasoning";
import { evaluate, type RulePack } from "./engine/ossRuleEvaluator";
import type { OssEvaluation } from "./types";

const app = express();
const PORT = process.env.PORT || 3001;
const JSON_BODY_LIMIT = process.env.JSON_BODY_LIMIT || "32kb";
const API_BEARER_TOKEN = process.env.API_BEARER_TOKEN;

app.use(cors());
app.use(express.json({ limit: JSON_BODY_LIMIT }));

const postRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Math.max(Number(process.env.POST_RATE_LIMIT_MAX || 1000), 1000),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Rate limit exceeded" },
});

function requireBearerToken(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!API_BEARER_TOKEN) {
    next();
    return;
  }
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing bearer token" });
    return;
  }
  const token = header.slice("Bearer ".length);
  if (token !== API_BEARER_TOKEN) {
    res.status(401).json({ error: "Invalid bearer token" });
    return;
  }
  next();
}

app.use("/v1/intents", postRateLimiter);
app.use("/v1/verify", postRateLimiter);
app.use("/v1/attestations", postRateLimiter);
app.use("/v1/reasoning", postRateLimiter);
app.use("/v1/demo/evaluate", postRateLimiter);

app.post("/v1/intents", requireBearerToken);
app.post("/v1/intents/preset/:presetId", requireBearerToken);
app.post("/v1/verify", requireBearerToken);
app.post("/v1/attestations/:id/anchor", requireBearerToken);
app.post("/v1/reasoning/:id", requireBearerToken);
app.post("/v1/demo/evaluate", requireBearerToken);

/** Extract and run an optional OSS rule evaluation from a request body. */
function resolveOssEvaluation(body: Record<string, unknown>): OssEvaluation | undefined {
  const rulePack = body.rule_pack as RulePack | undefined;
  const rulePackPayload = body.rule_pack_payload as Record<string, unknown> | undefined;
  return rulePack && rulePackPayload ? evaluate(rulePack, rulePackPayload) : undefined;
}

/**
 * Call evaluateSettlementDecision() when the request carries a rule_pack.
 * Wires in: transaction_id, phase, rule_pack, event_type, payload.
 */
function resolveSettlementDecision(
  body: Record<string, unknown>,
  transactionId: string
): SettlementDecisionResult | undefined {
  const rulePack = body.rule_pack as RulePack | undefined;
  if (!rulePack || !(rulePack in ruleRegistry)) return undefined;
  const payload = (body.rule_pack_payload ?? {}) as Record<string, unknown>;
  return evaluateSettlementDecision({
    transaction_id: transactionId,
    phase: (body.phase as string) ?? "settlement",
    rule_pack: rulePack,
    event_type: (body.event_type as string) ?? "intent_submitted",
    payload,
  });
}

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

  if (typeof b.custody_valid !== "boolean") {
    return { valid: false, error: "custody_valid must be a boolean" };
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

  // Optional OSS rule evaluation — runs when the caller supplies rule_pack + rule_pack_payload
  const ossEvaluation = resolveOssEvaluation(req.body as Record<string, unknown>);

  // Evaluate settlement decision before proof generation (embedded in bundle metadata)
  const settlementDecision = resolveSettlementDecision(req.body as Record<string, unknown>, intentId);

  // Seal the proof bundle (oss_evaluation and settlement_decision are included before hashing when present)
  const bundle = sealBundle(intentHash, receivedAt, intent, steps, ossEvaluation, settlementDecision);

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
    decision_type: "enforcement",
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

  // Optional OSS rule evaluation — callers may supply rule_pack + rule_pack_payload
  const ossEvaluation = resolveOssEvaluation(req.body as Record<string, unknown>);

  // Evaluate settlement decision before proof generation (embedded in bundle metadata)
  const settlementDecision = resolveSettlementDecision(req.body as Record<string, unknown>, intentId);

  const bundle = sealBundle(intentHash, receivedAt, intent, steps, ossEvaluation, settlementDecision);
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
    intent,
    intent_hash: intentHash,
    received_at: receivedAt,
    bundle,
    decision_type: "enforcement",
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
app.post("/v1/verify", async (req, res) => {
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

  if (body.check_chain) {
    try {
      const dynamoRecord = await lookupByAttestationHash(attestationHash);
      if (dynamoRecord) {
        onChain = true;
        txHash = dynamoRecord.tx_hash;
      } else {
        onChain = false;
      }
    } catch {
      if (bundleRecord?.anchor) {
        onChain = true;
        txHash = bundleRecord.anchor.tx_hash;
      } else {
        onChain = false;
      }
    }
  }

  const response: VerifyResponse = {
    signature_valid: signatureValid,
    bundle_exists: bundleExists,
    on_chain: onChain,
    tx_hash: txHash,
  };

  res.json(response);
});

// POST /v1/attestations/:id/anchor — Anchor attestation on Canton Network via commitment registry
app.post("/v1/attestations/:id/anchor", async (req, res) => {
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

  try {
    const result = await anchorToCantonLedger(
      record.bundle.bundle_root_hash,
      record.signed_attestation.attestation_hash,
      record.id,
      record.bundle.asset_type
    );

    updateAnchor(record.id, result.anchor);

    res.json({
      anchored: true,
      network: result.network,
      domain: result.domain,
      participant: result.participant,
      anchor: result.anchor,
      canton_transaction: result.canton_transaction,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message.includes("ConditionalCheckFailedException")) {
      res.status(409).json({ error: "Already anchored on-chain" });
    } else {
      console.error("Anchor error:", err);
      res.status(500).json({ error: "Anchoring failed", details: message });
    }
  }
});

// POST /v1/reasoning/:id — Generate AI compliance reasoning for an intent
app.post("/v1/reasoning/:id", async (req, res) => {
  const record = getIntent(req.params.id);
  if (!record) {
    res.status(404).json({ error: "Intent not found" });
    return;
  }

  try {
    const reasoning = await generateComplianceReasoning(
      record.intent,
      record.bundle.steps,
      record.decision_record.decision
    );
    res.json(reasoning);
  } catch (err: unknown) {
    console.error("Reasoning error:", err);
    res.status(500).json({ error: "AI reasoning generation failed" });
  }
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
  res.json({
    public_key: getPublicKeyB64(),
    key_id: getSigningKeyId(),
    key_version: getSigningKeyVersion(),
  });
});

// GET /v1/canton/status — Canton Network connectivity and configuration
app.get("/v1/canton/status", async (_req, res) => {
  const status = await getCantonNetworkStatus();
  res.json(status);
});

// GET /v1/canton/commitments/:attestationHash — Lookup a Canton commitment by attestation hash
app.get("/v1/canton/commitments/:attestationHash", async (req, res) => {
  try {
    const result = await lookupCantonCommitment(req.params.attestationHash);
    if (!result) {
      res.status(404).json({ error: "Commitment not found on Canton" });
      return;
    }
    res.json(result);
  } catch (err: unknown) {
    console.error("Canton lookup error:", err);
    res.status(500).json({ error: "Canton lookup failed" });
  }
});

// POST /v1/demo/evaluate — Evaluate a payload against a rule pack
app.post("/v1/demo/evaluate", (req, res) => {
  const body = req.body as Record<string, unknown>;

  if (!body || typeof body !== "object") {
    res.status(400).json({ error: "Request body must be a JSON object" });
    return;
  }

  const { rule_pack, payload } = body;

  if (!rule_pack || typeof rule_pack !== "string") {
    res.status(400).json({ error: "rule_pack is required and must be a string" });
    return;
  }

  if (!(rule_pack in ruleRegistry)) {
    res.status(400).json({
      error: `Invalid rule_pack: ${rule_pack}`,
      valid_rule_packs: Object.keys(ruleRegistry),
    });
    return;
  }

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    res.status(400).json({ error: "payload is required and must be an object" });
    return;
  }

  try {
    const pack = rule_pack as keyof typeof ruleRegistry;
    const registry = new RuleRegistry();
    for (const rule of ruleRegistry[pack]) {
      registry.register(rule);
    }

    const result = evaluateRules(registry, payload);
    const reason_codes = result.results
      .filter((r) => r.status !== "PASS" && r.reason_code)
      .map((r) => r.reason_code as string);

    let decision: "PASS" | "FAIL" | "CONDITIONAL";
    if (result.results.some((r) => r.status === "FAIL")) {
      decision = "FAIL";
    } else if (result.results.some((r) => r.status === "CONDITIONAL")) {
      decision = "CONDITIONAL";
    } else {
      decision = "PASS";
    }

    res.json({
      rule_pack,
      decision_type: "evaluation",
      decision,
      reason_codes,
    });
  } catch (err: unknown) {
    console.error(`Evaluate error for rule_pack ${rule_pack}:`, err);
    res.status(500).json({ error: "Evaluation failed" });
  }
});

// GET /health — Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "SettlementGuard", version: "0.2.0" });
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
