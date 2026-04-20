#!/usr/bin/env node
/**
 * SettlementGuard — End-to-End Backend Test Suite
 *
 * Covers every route, happy-path + error-path, and state-dependent flows
 * (intent → verify → anchor). No external test framework needed.
 *
 * Usage:
 *   node backend/scripts/e2e-test.mjs                  # default http://localhost:3001
 *   node backend/scripts/e2e-test.mjs http://host:3001
 *
 * Requires Node 18+ (native fetch).
 */

const BASE = process.argv[2]?.replace(/\/$/, "") || "http://localhost:3001";
const API_BEARER_TOKEN = process.env.API_BEARER_TOKEN || "";

// ─── ANSI helpers ─────────────────────────────────────────────────────────────
const G    = (s) => `\x1b[32m${s}\x1b[0m`;
const R    = (s) => `\x1b[31m${s}\x1b[0m`;
const Y    = (s) => `\x1b[33m${s}\x1b[0m`;
const B    = (s) => `\x1b[36m${s}\x1b[0m`;
const DIM  = (s) => `\x1b[2m${s}\x1b[0m`;
const BOLD = (s) => `\x1b[1m${s}\x1b[0m`;

// ─── Harness ──────────────────────────────────────────────────────────────────
let passed = 0, failed = 0, skipped = 0;
const failures = [];

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ${G("✓")} ${name}`);
    passed++;
  } catch (err) {
    console.log(`  ${R("✗")} ${name}`);
    console.log(`    ${DIM(err.message)}`);
    failures.push({ name, error: err.message });
    failed++;
  }
}

function skip(name, reason) {
  console.log(`  ${Y("○")} ${name} ${DIM(`(skipped: ${reason})`)}`);
  skipped++;
}

function section(title) {
  console.log(`\n${BOLD(B(`── ${title} `))}${B("─".repeat(Math.max(0, 50 - title.length)))}`);
}

// ─── Assertions ───────────────────────────────────────────────────────────────
function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}
function eq(actual, expected, label = "value") {
  if (actual !== expected)
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}
function hasKey(obj, key) {
  if (obj === null || obj === undefined || !(key in obj))
    throw new Error(`Expected key "${key}" in ${JSON.stringify(obj)}`);
}
function isArray(val, label) {
  assert(Array.isArray(val), `${label} should be an array`);
}
function isHex64(val, label) {
  assert(/^[a-f0-9]{64}$/i.test(val), `${label} should be a 64-char hex SHA-256, got "${val}"`);
}

// ─── HTTP helpers ─────────────────────────────────────────────────────────────
async function GET(path) {
  const res = await fetch(`${BASE}${path}`);
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

async function POST(path, payload) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(API_BEARER_TOKEN ? { Authorization: `Bearer ${API_BEARER_TOKEN}` } : {}),
    },
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

// ─── Shared state ─────────────────────────────────────────────────────────────
let allowIntentId        = null;
let allowAttestationJson = null;
let allowSignature       = null;
let denyIntentId         = null;

// ─── Connectivity guard ───────────────────────────────────────────────────────
async function checkConnectivity() {
  try {
    const { status } = await GET("/health");
    if (status !== 200) throw new Error(`/health returned ${status}`);
  } catch (err) {
    console.error(R(`\nCannot reach backend at ${BASE}: ${err.message}`));
    console.error(DIM("Start the backend with: cd backend && npm run dev\n"));
    process.exit(1);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
async function main() {
  console.log(BOLD(`\n  SettlementGuard — E2E Backend Test Suite`));
  console.log(DIM(`  ${BASE}\n`));

  await checkConnectivity();

  // ── 1. Health & Info ────────────────────────────────────────────────────────
  section("Health & Info");

  await test("GET /health → 200, status=ok, service and version present", async () => {
    const { status, body } = await GET("/health");
    eq(status, 200, "HTTP status");
    eq(body.status, "ok", "body.status");
    hasKey(body, "service");
    hasKey(body, "version");
  });

  await test("GET /v1/public-key → 200, public_key non-empty, key metadata present", async () => {
    const { status, body } = await GET("/v1/public-key");
    eq(status, 200, "HTTP status");
    hasKey(body, "public_key");
    hasKey(body, "key_id");
    hasKey(body, "key_version");
    assert(body.public_key.length > 20, "public_key is non-empty base64");
    assert(body.key_id.length > 0, "key_id present");
    assert(body.key_version.length > 0, "key_version present");
  });

  await test("GET /v1/presets → 200, 4 presets with expected_outcome", async () => {
    const { status, body } = await GET("/v1/presets");
    eq(status, 200, "HTTP status");
    hasKey(body, "presets");
    isArray(body.presets, "presets");
    eq(body.presets.length, 4, "preset count");
    const ids = body.presets.map((p) => p.id);
    for (const id of ["treasury-pass", "treasury-fail", "stablecoin-pass", "stablecoin-fail"]) {
      assert(ids.includes(id), `preset "${id}" present`);
    }
    const passPreset = body.presets.find((p) => p.id === "treasury-pass");
    eq(passPreset.expected_outcome, "ALLOW", "treasury-pass expected_outcome");
  });

  await test("GET /v1/canton/status → 200", async () => {
    const { status } = await GET("/v1/canton/status");
    eq(status, 200, "HTTP status");
  });

  // ── 2. POST /v1/intents — Intent Submission ─────────────────────────────────
  section("POST /v1/intents — Intent Submission");

  await test("ALLOW: fully compliant tokenized_treasury → decision ALLOW, attestation issued", async () => {
    const { status, body } = await POST("/v1/intents", {
      asset_type: "tokenized_treasury",
      issuer_name: "US Treasury Digital Securities",
      issuer_status: "active",
      asset_id: "USTB-E2E-001",
      classification: "tokenized_security",
      custody_provider: "DTC Qualified Custodian",
      custody_valid: true,
      reserve_ratio: 1.0,
    });
    eq(status, 201, "HTTP status");
    hasKey(body, "id");
    hasKey(body, "intent_hash");
    hasKey(body, "received_at");
    hasKey(body, "bundle");
    hasKey(body, "decision");
    hasKey(body, "attestation");
    eq(body.decision_type, "enforcement", "decision_type");
    eq(body.decision.decision, "ALLOW", "decision");
    assert(body.attestation !== null, "attestation must exist for ALLOW");
    eq(body.bundle.steps.length, 4, "4 proof steps");
    assert(body.bundle.steps.every((s) => s.pass === true), "all steps pass");
    hasKey(body.bundle, "bundle_version");
    hasKey(body.bundle, "bundle_root_hash");
    // stash for downstream tests
    allowIntentId        = body.id;
    allowAttestationJson = JSON.stringify(body.attestation.attestation);
    allowSignature       = body.attestation.signature;
  });

  await test("ALLOW: fully compliant stablecoin (reserve_ratio=1.02) → ALLOW", async () => {
    const { status, body } = await POST("/v1/intents", {
      asset_type: "stablecoin",
      issuer_name: "Regulated Stablecoin Corp",
      issuer_status: "active",
      asset_id: "USDX-E2E-001",
      classification: "stablecoin",
      custody_provider: "Segregated Reserve Trust",
      custody_valid: true,
      reserve_ratio: 1.02,
    });
    eq(status, 201, "HTTP status");
    eq(body.decision.decision, "ALLOW", "decision");
    assert(body.attestation !== null, "attestation present");
  });

  await test("DENY: custody_valid=false → DENY, no attestation, CUSTODY_INVALID code", async () => {
    const { status, body } = await POST("/v1/intents", {
      asset_type: "tokenized_treasury",
      issuer_name: "Failing Custodian Corp",
      issuer_status: "active",
      asset_id: "USTB-DENY-001",
      classification: "tokenized_security",
      custody_provider: "Invalid Custodian",
      custody_valid: false,
      reserve_ratio: 1.0,
    });
    eq(status, 201, "HTTP status");
    eq(body.decision.decision, "DENY", "decision");
    assert(body.attestation === null, "no attestation for DENY");
    const step = body.bundle.steps.find((s) => s.step_name === "custody_conditions");
    assert(step && !step.pass, "custody_conditions fails");
    assert(step.reason_codes.includes("CUSTODY_INVALID"), "CUSTODY_INVALID present");
    denyIntentId = body.id;
  });

  await test("DENY: reserve_ratio=0.95 → DENY, RESERVE_INSUFFICIENT reason code", async () => {
    const { status, body } = await POST("/v1/intents", {
      asset_type: "stablecoin",
      issuer_name: "Under-Reserved Corp",
      issuer_status: "active",
      asset_id: "USDX-DENY-001",
      classification: "stablecoin",
      custody_provider: "Reserve Trust",
      custody_valid: true,
      reserve_ratio: 0.95,
    });
    eq(status, 201, "HTTP status");
    eq(body.decision.decision, "DENY", "decision");
    const step = body.bundle.steps.find((s) => s.step_name === "backing_reserve");
    assert(step && !step.pass, "backing_reserve fails");
    assert(step.reason_codes.some((c) => c.includes("RESERVE_INSUFFICIENT")), "RESERVE_INSUFFICIENT in codes");
  });

  await test("DENY: issuer_status=suspended → DENY, ISSUER_NOT_ACTIVE code", async () => {
    const { status, body } = await POST("/v1/intents", {
      asset_type: "stablecoin",
      issuer_name: "Suspended Corp",
      issuer_status: "suspended",
      asset_id: "SUSP-001",
      classification: "stablecoin",
      custody_provider: "Trust",
      custody_valid: true,
      reserve_ratio: 1.0,
    });
    eq(status, 201, "HTTP status");
    eq(body.decision.decision, "DENY", "decision");
    const step = body.bundle.steps.find((s) => s.step_name === "issuer_legitimacy");
    assert(step && !step.pass, "issuer_legitimacy fails");
    assert(step.reason_codes.includes("ISSUER_NOT_ACTIVE"), "ISSUER_NOT_ACTIVE present");
  });

  await test("DENY: asset_type/classification mismatch → DENY, CLASSIFICATION_MISMATCH code", async () => {
    const { status, body } = await POST("/v1/intents", {
      asset_type: "tokenized_treasury",
      issuer_name: "Mismatch Corp",
      issuer_status: "active",
      asset_id: "MISMATCH-001",
      classification: "stablecoin",
      custody_provider: "DTC",
      custody_valid: true,
      reserve_ratio: 1.0,
    });
    eq(status, 201, "HTTP status");
    eq(body.decision.decision, "DENY", "decision");
    const step = body.bundle.steps.find((s) => s.step_name === "asset_classification");
    assert(step && !step.pass, "asset_classification fails");
    assert(
      step.reason_codes.some((c) => c.includes("CLASSIFICATION_MISMATCH")),
      "CLASSIFICATION_MISMATCH code present"
    );
  });

  await test("OSS bundle embed: intent + ISDA rule_pack → oss_evaluation in bundle", async () => {
    const { status, body } = await POST("/v1/intents", {
      asset_type: "tokenized_treasury",
      issuer_name: "ISDA Embed Corp",
      issuer_status: "active",
      asset_id: "USTB-OSS-001",
      classification: "tokenized_security",
      custody_provider: "DTC",
      custody_valid: true,
      reserve_ratio: 1.0,
      rule_pack: "ISDA",
      rule_pack_payload: {
        counterparty_status: "ACTIVE",
        required_margin: 1000000,
        posted_collateral_value: 1250000,
      },
    });
    eq(status, 201, "HTTP status");
    hasKey(body.bundle, "oss_evaluation");
    eq(body.bundle.oss_evaluation.rule_pack, "ISDA", "oss rule_pack");
    eq(body.bundle.oss_evaluation.decision, "PASS", "oss decision");
    isArray(body.bundle.oss_evaluation.reason_codes, "oss reason_codes");
  });

  // ── 3. Input Validation ─────────────────────────────────────────────────────
  section("POST /v1/intents — Input Validation");

  const validBase = {
    asset_type: "stablecoin", issuer_name: "Corp", issuer_status: "active",
    asset_id: "X-001", classification: "stablecoin", custody_provider: "Trust",
    custody_valid: true, reserve_ratio: 1.0,
  };

  const validationCases = [
    ["missing asset_type",        { ...validBase, asset_type: undefined }],
    ["missing issuer_name",       { ...validBase, issuer_name: undefined }],
    ["missing issuer_status",     { ...validBase, issuer_status: undefined }],
    ["missing asset_id",          { ...validBase, asset_id: undefined }],
    ["missing classification",    { ...validBase, classification: undefined }],
    ["missing custody_provider",  { ...validBase, custody_provider: undefined }],
    ["missing custody_valid",     { ...validBase, custody_valid: undefined }],
    ["missing reserve_ratio",     { ...validBase, reserve_ratio: undefined }],
    ["invalid asset_type",        { ...validBase, asset_type: "bond" }],
    ["invalid issuer_status",     { ...validBase, issuer_status: "pending" }],
    ["reserve_ratio as string",   { ...validBase, reserve_ratio: "high" }],
  ];

  for (const [label, payload] of validationCases) {
    await test(`Validation: ${label} → 400 with error`, async () => {
      const { status, body } = await POST("/v1/intents", payload);
      eq(status, 400, "HTTP status");
      hasKey(body, "error");
    });
  }

  // ── 4. Proof Chain Integrity ─────────────────────────────────────────────────
  section("Proof Chain Integrity");

  await test("All hashes are 64-char hex SHA-256", async () => {
    const { body } = await POST("/v1/intents", {
      ...validBase,
      asset_id: "HASH-TEST-001",
    });
    isHex64(body.bundle.bundle_root_hash, "bundle_root_hash");
    isHex64(body.bundle.intent_hash, "intent_hash");
    isHex64(body.decision.decision_hash, "decision_hash");
    for (const step of body.bundle.steps) {
      isHex64(step.normalized_inputs_hash, `${step.step_name}.normalized_inputs_hash`);
    }
  });

  await test("4 steps present: issuer_legitimacy, asset_classification, custody_conditions, backing_reserve", async () => {
    const { body } = await POST("/v1/intents", { ...validBase, asset_id: "STEP-TEST-001" });
    const names = body.bundle.steps.map((s) => s.step_name);
    for (const n of ["issuer_legitimacy", "asset_classification", "custody_conditions", "backing_reserve"]) {
      assert(names.includes(n), `step "${n}" present`);
    }
    eq(body.bundle.steps[0].step_index, 0, "step_index[0]=0");
    eq(body.bundle.steps[3].step_index, 3, "step_index[3]=3");
    for (const s of body.bundle.steps) {
      hasKey(s, "evaluated_at");
      hasKey(s, "normalized_inputs_hash");
      hasKey(s, "reason_codes");
    }
  });

  await test("decision_hash = SHA-256(bundle_root_hash|decision)", async () => {
    const { body } = await POST("/v1/intents", { ...validBase, asset_id: "DECHASH-001" });
    const { createHash } = await import("crypto");
    const expected = createHash("sha256")
      .update(`${body.bundle.bundle_root_hash}|${body.decision.decision}`)
      .digest("hex");
    eq(body.decision.decision_hash, expected, "decision_hash");
  });

  await test("Identical intents produce identical intent_hash (bundle_root_hash differs due to per-step timestamps)", async () => {
    const intent = { ...validBase, asset_id: "DETERM-001" };
    const { body: a } = await POST("/v1/intents", intent);
    const { body: b } = await POST("/v1/intents", intent);
    // intent_hash is SHA-256(canonical intent) — fully deterministic
    eq(a.bundle.intent_hash, b.bundle.intent_hash, "intent_hash determinism");
    // bundle_root_hash is intentionally non-deterministic: each step embeds evaluated_at timestamp
    assert(a.bundle.bundle_root_hash !== b.bundle.bundle_root_hash,
      "bundle_root_hash differs between submissions (evaluated_at timestamps make it non-deterministic by design)");
  });

  // ── 5. Presets ──────────────────────────────────────────────────────────────
  section("POST /v1/intents/preset/:presetId");

  for (const [id, expected] of [
    ["treasury-pass",    "ALLOW"],
    ["treasury-fail",    "DENY"],
    ["stablecoin-pass",  "ALLOW"],
    ["stablecoin-fail",  "DENY"],
  ]) {
    await test(`Preset ${id} → ${expected}`, async () => {
      const { status, body } = await POST(`/v1/intents/preset/${id}`, {});
      eq(status, 201, "HTTP status");
      eq(body.decision.decision, expected, "decision");
      eq(body.preset_id, id, "preset_id echo");
      hasKey(body, "intent");
      if (expected === "ALLOW") {
        assert(body.attestation !== null, "attestation present for ALLOW preset");
        eq(body.attestation.attestation.decision, "ALLOW", "attestation.decision");
      } else {
        assert(body.attestation === null, "no attestation for DENY preset");
      }
    });
  }

  await test("Preset with embedded ISDA rule pack → oss_evaluation in bundle", async () => {
    const { status, body } = await POST("/v1/intents/preset/treasury-pass", {
      rule_pack: "ISDA",
      rule_pack_payload: {
        counterparty_status: "ACTIVE",
        required_margin: 500000,
        posted_collateral_value: 600000,
      },
    });
    eq(status, 201, "HTTP status");
    hasKey(body.bundle, "oss_evaluation");
    eq(body.bundle.oss_evaluation.decision, "PASS", "oss decision");
  });

  await test("Unknown preset → 404 with available list", async () => {
    const { status, body } = await POST("/v1/intents/preset/nonexistent-preset", {});
    eq(status, 404, "HTTP status");
    hasKey(body, "error");
    hasKey(body, "available");
    isArray(body.available, "available");
    assert(body.available.length === 4, "4 available presets listed");
  });

  // ── 6. Intent Store ─────────────────────────────────────────────────────────
  section("GET /v1/intents — Intent Store");

  await test("GET /v1/intents → 200, intents array", async () => {
    const { status, body } = await GET("/v1/intents");
    eq(status, 200, "HTTP status");
    hasKey(body, "intents");
    isArray(body.intents, "intents");
    assert(body.intents.length > 0, "at least one intent in store");
    const first = body.intents[0];
    hasKey(first, "id");
    hasKey(first, "intent");
    hasKey(first, "bundle");
    hasKey(first, "decision_record");
  });

  await test("GET /v1/intents/:id → ALLOW intent retrieved correctly", async () => {
    assert(allowIntentId !== null, "allowIntentId was captured");
    const { status, body } = await GET(`/v1/intents/${allowIntentId}`);
    eq(status, 200, "HTTP status");
    eq(body.id, allowIntentId, "id match");
    eq(body.decision_record.decision, "ALLOW", "decision_record.decision");
    assert(body.signed_attestation !== null, "signed_attestation present");
    hasKey(body.signed_attestation, "attestation_hash");
    hasKey(body.signed_attestation, "signature");
  });

  await test("GET /v1/intents/:id → DENY intent has null signed_attestation", async () => {
    assert(denyIntentId !== null, "denyIntentId was captured");
    const { status, body } = await GET(`/v1/intents/${denyIntentId}`);
    eq(status, 200, "HTTP status");
    eq(body.decision_record.decision, "DENY", "decision_record.decision");
    assert(body.signed_attestation === null, "signed_attestation is null for DENY");
  });

  await test("GET /v1/intents/:id unknown ID → 404", async () => {
    const { status } = await GET("/v1/intents/00000000-0000-0000-0000-000000000000");
    eq(status, 404, "HTTP status");
  });

  // ── 7. Attestation Verification ─────────────────────────────────────────────
  section("POST /v1/verify — Attestation Verification");

  await test("Valid attestation + signature → signature_valid=true, bundle_exists=true", async () => {
    assert(allowAttestationJson && allowSignature, "attestation data captured");
    const { status, body } = await POST("/v1/verify", {
      attestation_json: allowAttestationJson,
      signature: allowSignature,
    });
    eq(status, 200, "HTTP status");
    eq(body.signature_valid, true, "signature_valid");
    eq(body.bundle_exists, true, "bundle_exists");
    assert(body.on_chain === null, "on_chain null when check_chain not requested");
    assert(body.tx_hash === null, "tx_hash null");
  });

  await test("Tampered decision field → signature_valid=false", async () => {
    assert(allowAttestationJson !== null, "attestation captured");
    const tampered = allowAttestationJson.replace(/"ALLOW"/, '"DENY"');
    const { body } = await POST("/v1/verify", {
      attestation_json: tampered,
      signature: allowSignature,
    });
    eq(body.signature_valid, false, "signature_valid");
  });

  await test("Tampered issued_at field → signature_valid=false", async () => {
    // Attestation only contains: attestation_version, asset_type, intent_id, intent_hash,
    // bundle_root_hash, decision, issued_at, signer — NOT intent payload fields like issuer_name
    assert(allowAttestationJson !== null, "attestation captured");
    const tampered = allowAttestationJson.replace(/"issued_at":"[^"]+"/, '"issued_at":"2000-01-01T00:00:00.000Z"');
    const { body } = await POST("/v1/verify", {
      attestation_json: tampered,
      signature: allowSignature,
    });
    eq(body.signature_valid, false, "signature_valid");
  });

  await test("Wrong signature → signature_valid=false", async () => {
    assert(allowAttestationJson !== null, "attestation captured");
    const { body } = await POST("/v1/verify", {
      attestation_json: allowAttestationJson,
      signature: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    });
    eq(body.signature_valid, false, "signature_valid");
  });

  await test("check_chain=true → on_chain is boolean (not null)", async () => {
    assert(allowAttestationJson && allowSignature, "attestation data captured");
    const { status, body } = await POST("/v1/verify", {
      attestation_json: allowAttestationJson,
      signature: allowSignature,
      check_chain: true,
    });
    eq(status, 200, "HTTP status");
    assert(typeof body.on_chain === "boolean", `on_chain should be boolean, got ${typeof body.on_chain}`);
  });

  await test("Missing attestation_json → 400", async () => {
    const { status } = await POST("/v1/verify", { signature: "abc" });
    eq(status, 400, "HTTP status");
  });

  await test("Missing signature → 400", async () => {
    const { status } = await POST("/v1/verify", { attestation_json: "{}" });
    eq(status, 400, "HTTP status");
  });

  await test("Malformed attestation_json (not JSON) → 400", async () => {
    const { status } = await POST("/v1/verify", {
      attestation_json: "NOT_VALID_JSON!",
      signature: "abc",
    });
    eq(status, 400, "HTTP status");
  });

  // ── 8. Anchor ───────────────────────────────────────────────────────────────
  section("POST /v1/attestations/:id/anchor");

  await test("Anchor unknown intent ID → 404", async () => {
    const { status } = await POST("/v1/attestations/00000000-0000-0000-0000-000000000000/anchor", {});
    eq(status, 404, "HTTP status");
  });

  await test("Anchor a DENY intent (no attestation) → 400", async () => {
    assert(denyIntentId !== null, "denyIntentId captured");
    const { status, body } = await POST(`/v1/attestations/${denyIntentId}/anchor`, {});
    eq(status, 400, "HTTP status");
    hasKey(body, "error");
    assert(body.error.toLowerCase().includes("no attestation") || body.error.toLowerCase().includes("deny"),
      "error mentions missing attestation");
  });

  await test("Anchor valid ALLOW intent → 200 with anchor record OR expected infra error", async () => {
    assert(allowIntentId !== null, "allowIntentId captured");
    const { status, body } = await POST(`/v1/attestations/${allowIntentId}/anchor`, {});
    assert([200, 409, 500].includes(status), `expected 200|409|500, got ${status}`);
    if (status === 200) {
      eq(body.anchored, true, "anchored");
      hasKey(body, "anchor");
      hasKey(body.anchor, "commitment_id");
      hasKey(body.anchor, "tx_hash");
      hasKey(body.anchor, "anchored_at");
      // Canton returns Ethereum-style 0x-prefixed hash; Dynamo returns plain 64-char hex
      assert(
        /^0x[a-f0-9]+$/i.test(body.anchor.tx_hash) || /^[a-f0-9]{64}$/.test(body.anchor.tx_hash),
        `anchor.tx_hash should be 0x-prefixed or 64-char hex, got "${body.anchor.tx_hash}"`
      );
    }
    // 409 = already anchored; 500 = DynamoDB/Canton unavailable in test env — both valid
  });

  await test("Anchor same intent twice → 409 conflict or 500 infra error", async () => {
    assert(allowIntentId !== null, "allowIntentId captured");
    await POST(`/v1/attestations/${allowIntentId}/anchor`, {});
    const { status } = await POST(`/v1/attestations/${allowIntentId}/anchor`, {});
    assert([409, 500].includes(status), `second anchor: expected 409|500, got ${status}`);
  });

  // ── 9. OSS Demo Evaluate ────────────────────────────────────────────────────
  section("POST /v1/demo/evaluate — OSS Rule Packs");

  const ossCases = [
    // ISDA
    {
      label: "ISDA PASS: ACTIVE counterparty + sufficient margin",
      pack: "ISDA",
      payload: { counterparty_status: "ACTIVE", required_margin: 1000000, posted_collateral_value: 1250000 },
      decision: "PASS",
      codes: [],
    },
    {
      label: "ISDA FAIL: INACTIVE counterparty",
      pack: "ISDA",
      payload: { counterparty_status: "INACTIVE", required_margin: 1000000, posted_collateral_value: 1250000 },
      decision: "FAIL",
      codes: ["INVALID_COUNTERPARTY"],
    },
    {
      label: "ISDA FAIL: insufficient margin (posted < required)",
      pack: "ISDA",
      payload: { counterparty_status: "ACTIVE", required_margin: 2000000, posted_collateral_value: 1000000 },
      decision: "FAIL",
      codes: ["INSUFFICIENT_MARGIN"],
    },
    {
      label: "ISDA FAIL: both rules fail → 2 reason codes",
      pack: "ISDA",
      payload: { counterparty_status: "INACTIVE", required_margin: 2000000, posted_collateral_value: 500000 },
      decision: "FAIL",
      codes: ["INVALID_COUNTERPARTY", "INSUFFICIENT_MARGIN"],
    },
    {
      label: "ISDA FAIL: exact margin (posted = required) → PASS",
      pack: "ISDA",
      payload: { counterparty_status: "ACTIVE", required_margin: 1000000, posted_collateral_value: 1000000 },
      decision: "PASS",
      codes: [],
    },
    // ISLA
    {
      label: "ISLA PASS: eligible collateral + sufficient coverage",
      pack: "ISLA",
      payload: {
        collateral_type: "GOVERNMENT_BOND",
        allowed_types: ["GOVERNMENT_BOND", "AGENCY_BOND"],
        collateral_value: 1060000,
        loan_value: 1000000,
        haircut: 0.05,
      },
      decision: "PASS",
      codes: [],
    },
    {
      label: "ISLA FAIL: ineligible collateral type",
      pack: "ISLA",
      payload: {
        collateral_type: "CRYPTO",
        allowed_types: ["GOVERNMENT_BOND", "AGENCY_BOND"],
        collateral_value: 1060000,
        loan_value: 1000000,
        haircut: 0.05,
      },
      decision: "FAIL",
      codes: ["INELIGIBLE_COLLATERAL"],
    },
    {
      label: "ISLA FAIL: insufficient coverage (collateral < loan * (1 + haircut))",
      pack: "ISLA",
      payload: {
        collateral_type: "GOVERNMENT_BOND",
        allowed_types: ["GOVERNMENT_BOND"],
        collateral_value: 900000,
        loan_value: 1000000,
        haircut: 0.05,
      },
      decision: "FAIL",
      codes: ["INSUFFICIENT_COLLATERAL"],
    },
    {
      label: "ISLA FAIL: missing numeric fields → FAIL",
      pack: "ISLA",
      payload: {
        collateral_type: "GOVERNMENT_BOND",
        allowed_types: ["GOVERNMENT_BOND"],
      },
      decision: "FAIL",
      codes: ["INSUFFICIENT_COLLATERAL"],
    },
    // ICMA
    {
      label: "ICMA PASS: sufficient collateral + valid maturity",
      pack: "ICMA",
      payload: {
        purchase_price: 5000000,
        collateral_value: 5350000,
        haircut: 0.05,
        current_date: Date.now(),
        end_date: Date.now() + 7 * 24 * 60 * 60 * 1000,
      },
      decision: "PASS",
      codes: [],
    },
    {
      label: "ICMA FAIL: collateral deficit",
      pack: "ICMA",
      payload: {
        purchase_price: 5000000,
        collateral_value: 4000000,
        haircut: 0.05,
        current_date: Date.now(),
        end_date: Date.now() + 86400000,
      },
      decision: "FAIL",
      codes: ["COLLATERAL_DEFICIT"],
    },
    {
      label: "ICMA FAIL: repo expired (current_date > end_date)",
      pack: "ICMA",
      payload: {
        purchase_price: 5000000,
        collateral_value: 5350000,
        haircut: 0.05,
        current_date: Date.now(),
        end_date: Date.now() - 1000,
      },
      decision: "FAIL",
      codes: ["REPO_EXPIRED"],
    },
    {
      label: "ICMA FAIL: both collateral and maturity fail → 2 reason codes",
      pack: "ICMA",
      payload: {
        purchase_price: 5000000,
        collateral_value: 1000000,
        haircut: 0.05,
        current_date: Date.now(),
        end_date: Date.now() - 1000,
      },
      decision: "FAIL",
      codes: ["COLLATERAL_DEFICIT", "REPO_EXPIRED"],
    },
  ];

  for (const tc of ossCases) {
    await test(tc.label, async () => {
      const { status, body } = await POST("/v1/demo/evaluate", {
        rule_pack: tc.pack,
        payload: tc.payload,
      });
      eq(status, 200, "HTTP status");
      hasKey(body, "decision");
      hasKey(body, "reason_codes");
      eq(body.decision_type, "evaluation", "decision_type");
      eq(body.rule_pack, tc.pack, "rule_pack echo");
      eq(body.decision, tc.decision, "decision");
      isArray(body.reason_codes, "reason_codes");
      for (const code of tc.codes) {
        assert(body.reason_codes.includes(code), `reason_codes includes "${code}" (got [${body.reason_codes}])`);
      }
      if (tc.decision === "PASS") {
        eq(body.reason_codes.length, 0, "no reason_codes on PASS");
      }
    });
  }

  // OSS error cases
  await test("evaluate: invalid rule_pack → 400 with valid_rule_packs list", async () => {
    const { status, body } = await POST("/v1/demo/evaluate", {
      rule_pack: "MIFID",
      payload: {},
    });
    eq(status, 400, "HTTP status");
    hasKey(body, "error");
    hasKey(body, "valid_rule_packs");
    isArray(body.valid_rule_packs, "valid_rule_packs");
    for (const pack of ["ISDA", "ISLA", "ICMA"]) {
      assert(body.valid_rule_packs.includes(pack), `valid_rule_packs includes ${pack}`);
    }
  });

  await test("evaluate: missing rule_pack → 400", async () => {
    const { status } = await POST("/v1/demo/evaluate", { payload: { x: 1 } });
    eq(status, 400, "HTTP status");
  });

  await test("evaluate: missing payload → 400", async () => {
    const { status } = await POST("/v1/demo/evaluate", { rule_pack: "ISDA" });
    eq(status, 400, "HTTP status");
  });

  await test("evaluate: payload is array → 400", async () => {
    const { status } = await POST("/v1/demo/evaluate", {
      rule_pack: "ISDA",
      payload: ["not", "an", "object"],
    });
    eq(status, 400, "HTTP status");
  });

  await test("evaluate: empty body → 400", async () => {
    const res = await fetch(`${BASE}/v1/demo/evaluate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(API_BEARER_TOKEN ? { Authorization: `Bearer ${API_BEARER_TOKEN}` } : {}),
      },
      body: "{}",
    });
    eq(res.status, 400, "HTTP status");
  });

  // ── 10. Canton Commitments ───────────────────────────────────────────────────
  section("GET /v1/canton/commitments/:hash");

  await test("Non-existent hash → 404 or 500 (Canton may be unavailable)", async () => {
    const { status } = await GET(
      "/v1/canton/commitments/0000000000000000000000000000000000000000000000000000000000000000"
    );
    assert([404, 500].includes(status), `expected 404 or 500, got ${status}`);
  });

  // ── 11. AI Reasoning ─────────────────────────────────────────────────────────
  section("POST /v1/reasoning/:id — AI Reasoning");

  await test("Unknown intent ID → 404", async () => {
    const { status } = await POST("/v1/reasoning/00000000-0000-0000-0000-000000000000", {});
    eq(status, 404, "HTTP status");
  });

  await test("Known intent ID → AI reasoning response", async () => {
    const { body: intentBody } = await POST("/v1/intents", {
      asset_type: "stablecoin",
      issuer_name: "Bedrock Test Corp",
      issuer_status: "active",
      asset_id: `BDR-${Date.now()}`,
      classification: "stablecoin",
      custody_provider: "Segregated Reserve Trust",
      custody_valid: true,
      reserve_ratio: 1.05,
    });
    const intentId = intentBody.id;
    assert(intentId, "intent created for reasoning test");
    const { status, body } = await POST(`/v1/reasoning/${intentId}`, {});
    eq(status, 200, "reasoning HTTP 200");
    assert(typeof body.summary === "string" && body.summary.length > 0, "summary present");
    assert(Array.isArray(body.step_explanations) && body.step_explanations.length === 4, "4 step explanations");
    assert(typeof body.risk_assessment === "string" && body.risk_assessment.length > 0, "risk_assessment present");
    assert(typeof body.recommendation === "string" && body.recommendation.length > 0, "recommendation present");
  });

  // ── 12. End-to-End Flow ───────────────────────────────────────────────────────
  section("Full E2E Flow: submit → retrieve → verify → anchor attempt");

  await test("Full happy path: submit ALLOW intent → retrieve → verify signature → check bundle", async () => {
    const { body: submitBody } = await POST("/v1/intents", {
      asset_type: "tokenized_treasury",
      issuer_name: "E2E Flow Corp",
      issuer_status: "active",
      asset_id: `E2E-FLOW-${Date.now()}`,
      classification: "tokenized_security",
      custody_provider: "DTC Qualified Custodian",
      custody_valid: true,
      reserve_ratio: 1.0,
    });
    eq(submitBody.decision.decision, "ALLOW", "step 1: decision ALLOW");

    const intentId = submitBody.id;
    const { body: getBody } = await GET(`/v1/intents/${intentId}`);
    eq(getBody.id, intentId, "step 2: retrieve by id");
    eq(getBody.decision_record.decision, "ALLOW", "step 2: decision_record");

    const attJson = JSON.stringify(submitBody.attestation.attestation);
    const sig     = submitBody.attestation.signature;
    const { body: verifyBody } = await POST("/v1/verify", {
      attestation_json: attJson,
      signature: sig,
    });
    eq(verifyBody.signature_valid, true,  "step 3: signature_valid");
    eq(verifyBody.bundle_exists,   true,  "step 3: bundle_exists");

    const { status: anchorStatus } = await POST(`/v1/attestations/${intentId}/anchor`, {});
    assert([200, 409, 500].includes(anchorStatus), `step 4: anchor status ${anchorStatus} acceptable`);
  });

  await test("Full deny path: submit DENY → retrieve → verify fails → anchor blocked", async () => {
    const { body: submitBody } = await POST("/v1/intents", {
      asset_type: "stablecoin",
      issuer_name: "E2E Deny Corp",
      issuer_status: "suspended",
      asset_id: `E2E-DENY-FLOW-${Date.now()}`,
      classification: "stablecoin",
      custody_provider: "Trust",
      custody_valid: false,
      reserve_ratio: 0.80,
    });
    eq(submitBody.decision.decision, "DENY", "step 1: decision DENY");
    assert(submitBody.attestation === null, "step 1: no attestation");
    // All 3 failing steps should each have reason codes
    const failSteps = submitBody.bundle.steps.filter((s) => !s.pass);
    assert(failSteps.length >= 3, `step 1: ≥3 steps should fail, got ${failSteps.length}`);

    const intentId = submitBody.id;
    const { body: getBody } = await GET(`/v1/intents/${intentId}`);
    assert(getBody.signed_attestation === null, "step 2: signed_attestation null in store");

    const { status: anchorStatus, body: anchorBody } = await POST(`/v1/attestations/${intentId}/anchor`, {});
    eq(anchorStatus, 400, "step 3: anchor blocked with 400");
    hasKey(anchorBody, "error");
  });

  // ── Summary ───────────────────────────────────────────────────────────────────
  const total = passed + failed + skipped;
  console.log(`\n${"═".repeat(54)}`);
  console.log(BOLD("  Results"));
  console.log(`  ${G("passed")}   ${passed}`);
  if (failed  > 0) console.log(`  ${R("failed")}   ${failed}`);
  if (skipped > 0) console.log(`  ${Y("skipped")}  ${skipped}`);
  console.log(`  ${DIM("total")}    ${total}`);

  if (failures.length > 0) {
    console.log(`\n${BOLD(R("  Failures"))}`);
    for (const f of failures) {
      console.log(`\n  ${R("✗")} ${f.name}`);
      console.log(`    ${DIM(f.error)}`);
    }
  }

  console.log("");
  if (failed === 0) {
    console.log(G(BOLD("  All tests passed ✓")));
  } else {
    console.log(R(BOLD(`  ${failed} test(s) failed`)));
    process.exit(1);
  }
  console.log("");
}

main().catch((err) => {
  console.error(R(`\nFatal: ${err.message}\n`));
  process.exit(1);
});
