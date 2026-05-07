#!/usr/bin/env node
/**
 * Canton Anchor Smoke Test
 *
 * End-to-end smoke test that submits a known-passing intent to the
 * SettlementGuard backend and anchors the resulting attestation. Verifies
 * that the anchor response either:
 *   1. Contains a real Canton `transaction_id` and `contract_id`, OR
 *   2. Is a clear fallback response indicating Canton is unavailable
 *      (e.g. "dynamo-fallback" network, empty contract_id, or HTTP 500
 *      with an "Anchoring failed" / "Canton unavailable" style message).
 *
 * When CANTON_NETWORK=devnet, only path (1) is acceptable — a missing
 * Canton transaction_id or contract_id will cause the script to fail.
 *
 * Usage:
 *   API_BASE_URL=https://api.example.com \
 *   API_BEARER_TOKEN=<token> \
 *     node backend/scripts/canton-anchor-smoke.mjs
 *
 *   # or pass the base URL as an argument:
 *   node backend/scripts/canton-anchor-smoke.mjs https://api.example.com
 *
 *   # via npm:
 *   npm --prefix backend run canton:anchor-smoke
 *
 * Exit codes:
 *   0 — smoke test passed
 *   1 — smoke test failed (see printed summary)
 *   2 — bad invocation (missing required env / args)
 *
 * Requires Node 18+ (native fetch).
 */

// ─── ANSI helpers ─────────────────────────────────────────────────────────────
const G    = (s) => `\x1b[32m${s}\x1b[0m`;
const R    = (s) => `\x1b[31m${s}\x1b[0m`;
const Y    = (s) => `\x1b[33m${s}\x1b[0m`;
const DIM  = (s) => `\x1b[2m${s}\x1b[0m`;
const BOLD = (s) => `\x1b[1m${s}\x1b[0m`;

// ─── Config ───────────────────────────────────────────────────────────────────
const argBase = process.argv[2];
const envBase = process.env.API_BASE_URL;
const BASE = (argBase || envBase || "").replace(/\/$/, "");
const TOKEN = (process.env.API_BEARER_TOKEN || "").trim();
const CANTON_NETWORK = (process.env.CANTON_NETWORK || "").trim().toLowerCase();
const STRICT_CANTON = CANTON_NETWORK === "devnet";

if (!BASE) {
  console.error(R("ERROR: API_BASE_URL is required (env var or first CLI argument)."));
  console.error(DIM("  Example: API_BASE_URL=https://api.example.com node backend/scripts/canton-anchor-smoke.mjs"));
  process.exit(2);
}

// Reject tokens containing CR/LF or other control characters to avoid HTTP
// header injection via a misconfigured env var.
if (TOKEN && /[\x00-\x1F\x7F]/.test(TOKEN)) {
  console.error(R("ERROR: API_BEARER_TOKEN contains control characters; refusing to send."));
  process.exit(2);
}

// ─── HTTP helpers ─────────────────────────────────────────────────────────────
function authHeaders() {
  if (!TOKEN) return {};
  const value = TOKEN.toLowerCase().startsWith("bearer ") ? TOKEN : `Bearer ${TOKEN}`;
  return { Authorization: value };
}

async function POST(path, payload) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify(payload ?? {}),
  });
  let body = {};
  try {
    body = await res.json();
  } catch {
    body = {};
  }
  return { status: res.status, body };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function isNonEmptyString(v) {
  return typeof v === "string" && v.trim().length > 0;
}

function fail(message, extra) {
  console.log("");
  console.log(BOLD(R("✗ SMOKE TEST FAILED")));
  console.log(`  ${R(message)}`);
  if (extra !== undefined) {
    const dump = typeof extra === "string" ? extra : JSON.stringify(extra, null, 2);
    console.log(DIM(dump.split("\n").map((l) => `  ${l}`).join("\n")));
  }
  console.log("");
  process.exit(1);
}

function succeed(summary) {
  console.log("");
  console.log(BOLD(G("✓ SMOKE TEST PASSED")));
  for (const line of summary) console.log(`  ${line}`);
  console.log("");
  process.exit(0);
}

// ─── Main flow ────────────────────────────────────────────────────────────────
async function main() {
  console.log(BOLD("\nCanton Anchor Smoke Test\n"));
  console.log(`  API_BASE_URL   = ${BASE}`);
  console.log(`  API_BEARER     = ${TOKEN ? DIM("(provided)") : DIM("(none)")}`);
  console.log(`  CANTON_NETWORK = ${CANTON_NETWORK || DIM("(unset)")}${STRICT_CANTON ? Y("  [strict mode]") : ""}`);
  console.log("");

  // 1) Submit a known-passing intent (mirrors the ALLOW case in e2e-test.mjs).
  console.log("→ Submitting known-passing intent to POST /v1/intents …");
  const passingIntent = {
    asset_type: "tokenized_treasury",
    issuer_name: "US Treasury Digital Securities",
    issuer_status: "active",
    asset_id: `USTB-SMOKE-${Date.now()}`,
    classification: "tokenized_security",
    custody_provider: "DTC Qualified Custodian",
    custody_valid: true,
    reserve_ratio: 1.0,
  };

  let submitRes;
  try {
    submitRes = await POST("/v1/intents", passingIntent);
  } catch (err) {
    fail(`Could not reach POST ${BASE}/v1/intents`, err?.message || String(err));
  }

  if (submitRes.status === 401 || submitRes.status === 403) {
    fail(`Authentication failed on POST /v1/intents (HTTP ${submitRes.status}). Set API_BEARER_TOKEN.`, submitRes.body);
  }
  if (submitRes.status !== 201) {
    fail(`POST /v1/intents returned HTTP ${submitRes.status} (expected 201).`, submitRes.body);
  }

  const intentId = submitRes.body?.id;
  const decision = submitRes.body?.decision?.decision;
  const attestation = submitRes.body?.attestation;

  if (!isNonEmptyString(intentId)) {
    fail("POST /v1/intents response missing `id`.", submitRes.body);
  }
  if (decision !== "ALLOW") {
    fail(`Expected decision ALLOW for known-passing intent, got "${decision}".`, submitRes.body);
  }
  if (!attestation) {
    fail("Expected attestation for ALLOW intent, got null/undefined.", submitRes.body);
  }
  console.log(`  ${G("✓")} intent submitted ${DIM(intentId)} → decision=${decision}`);

  // 2) Anchor the attestation.
  console.log(`→ Anchoring attestation via POST /v1/attestations/${intentId}/anchor …`);
  let anchorRes;
  try {
    anchorRes = await POST(`/v1/attestations/${intentId}/anchor`, {});
  } catch (err) {
    fail(`Could not reach POST ${BASE}/v1/attestations/${intentId}/anchor`, err?.message || String(err));
  }

  // 3) Evaluate the response.
  const { status, body } = anchorRes;
  const cantonTx = body?.canton_transaction || {};
  const network = body?.network;
  const transactionId = cantonTx.transaction_id;
  const contractId = cantonTx.contract_id;

  const hasRealCantonAnchor =
    status === 200 &&
    body?.anchored === true &&
    isNonEmptyString(transactionId) &&
    isNonEmptyString(contractId) &&
    network !== "dynamo-fallback";

  // A "clear fallback" response is one where the API explicitly tells us
  // Canton was unavailable. We accept either:
  //   • HTTP 200 with network === "dynamo-fallback" (circuit-breaker fallback), or
  //   • HTTP 500 with an `error` field whose message indicates anchoring failed
  //     / Canton unavailable.
  const fallbackBecauseDynamo =
    status === 200 && body?.anchored === true && network === "dynamo-fallback";

  const errorText = isNonEmptyString(body?.error)
    ? `${body.error} ${body.details || ""}`.toLowerCase()
    : "";
  const fallbackBecauseError =
    status === 500 &&
    (errorText.includes("anchoring failed") ||
      errorText.includes("canton") ||
      errorText.includes("unavailable"));

  const isClearFallback = fallbackBecauseDynamo || fallbackBecauseError;

  if (STRICT_CANTON) {
    if (!hasRealCantonAnchor) {
      fail(
        `CANTON_NETWORK=devnet requires a real Canton transaction_id and contract_id, ` +
          `but the anchor response did not include both (HTTP ${status}, network="${network ?? ""}", ` +
          `transaction_id="${transactionId ?? ""}", contract_id="${contractId ?? ""}").`,
        body
      );
    }
    succeed([
      `${G("Canton anchor confirmed")} (devnet strict mode)`,
      `network        = ${network}`,
      `transaction_id = ${transactionId}`,
      `contract_id    = ${contractId}`,
      `tx_hash        = ${body?.anchor?.tx_hash ?? DIM("(none)")}`,
    ]);
  }

  if (hasRealCantonAnchor) {
    succeed([
      `${G("Canton anchor confirmed")}`,
      `network        = ${network}`,
      `transaction_id = ${transactionId}`,
      `contract_id    = ${contractId}`,
      `tx_hash        = ${body?.anchor?.tx_hash ?? DIM("(none)")}`,
    ]);
  }

  if (isClearFallback) {
    const reason = fallbackBecauseDynamo
      ? `network="dynamo-fallback"`
      : `HTTP ${status} ${body?.error || ""}`.trim();
    succeed([
      `${Y("Canton unavailable — clear fallback response accepted")}`,
      `reason         = ${reason}`,
      fallbackBecauseDynamo
        ? `tx_hash        = ${body?.anchor?.tx_hash ?? DIM("(none)")}`
        : `details        = ${body?.details ?? DIM("(none)")}`,
      DIM("(set CANTON_NETWORK=devnet to require a real Canton anchor)"),
    ]);
  }

  fail(
    `Anchor response was neither a real Canton anchor nor a clear fallback ` +
      `(HTTP ${status}, network="${network ?? ""}", transaction_id="${transactionId ?? ""}", ` +
      `contract_id="${contractId ?? ""}").`,
    body
  );
}

main().catch((err) => {
  console.error(R(`\nUnexpected error: ${err?.stack || err?.message || String(err)}\n`));
  process.exit(1);
});
