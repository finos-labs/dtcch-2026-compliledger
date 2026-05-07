#!/usr/bin/env node
/**
 * Backend unit tests for Canton status / adapter behavior.
 *
 * These tests do NOT require a real Canton node — every fetch is intercepted
 * by an in-process mock installed in the child harness
 * (`scripts/internal/canton-status-child.mjs`). Each scenario is run in its
 * own child Node process so the Canton adapter (which snapshots env vars at
 * module-load time) can be exercised under different configurations.
 *
 * Scenarios covered:
 *   1. No CANTON_LEDGER_API_URL configured →
 *        - `/v1/canton/status` payload reports `configured=false` AND
 *          `reachable=false`
 *        - the call must not throw / 500
 *   2. CANTON_NETWORK=devnet but parties / package missing →
 *        - `mode === "devnet"`
 *        - per-field readiness flags (`submitter_party_configured`,
 *          `custodian_party_configured`, `package_id_configured`,
 *          `configured`, `devnet_ready`) all false
 *   3. CANTON_AUTH_TOKEN set →
 *        - the Canton adapter sends `Authorization: Bearer <token>` on its
 *          HTTP calls (covered here via the `/v2/state/ledger-end` probe in
 *          `getCantonNetworkStatus`)
 *
 * Usage:
 *   node backend/scripts/canton-status-test.mjs
 */

import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import assert from "node:assert/strict";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HARNESS = path.join(__dirname, "internal", "canton-status-child.mjs");
const DIST_ENTRY = path.resolve(__dirname, "..", "dist", "canton-ledger.js");

// ── ANSI helpers (match style of the existing e2e-test.mjs harness) ─────────
const G = (s) => `\x1b[32m${s}\x1b[0m`;
const R = (s) => `\x1b[31m${s}\x1b[0m`;
const B = (s) => `\x1b[36m${s}\x1b[0m`;
const DIM = (s) => `\x1b[2m${s}\x1b[0m`;
const BOLD = (s) => `\x1b[1m${s}\x1b[0m`;

let passed = 0;
let failed = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
    console.log(`  ${G("✓")} ${name}`);
    passed++;
  } catch (err) {
    console.log(`  ${R("✗")} ${name}`);
    console.log(`    ${DIM(err.message)}`);
    failures.push({ name, error: err.message });
    failed++;
  }
}

function section(title) {
  console.log(`\n${BOLD(B(`── ${title} `))}${B("─".repeat(Math.max(0, 50 - title.length)))}`);
}

/**
 * Spawn the child harness with the supplied env (merged on top of an empty
 * baseline so the parent process env doesn't leak Canton config into tests).
 * Returns the parsed `__RESULT__` JSON line emitted by the harness.
 */
function runChild(action, env = {}) {
  // Build a clean env: keep only the bits Node needs to start, then layer on
  // the per-scenario Canton env. This guarantees that env vars set on the CI
  // runner (e.g. a real CANTON_LEDGER_API_URL) cannot influence the test.
  const baseEnv = {
    PATH: process.env.PATH || "",
    HOME: process.env.HOME || "",
    NODE_ENV: "test",
  };
  const childEnv = { ...baseEnv, ...env };

  const res = spawnSync(process.execPath, [HARNESS, action], {
    env: childEnv,
    encoding: "utf8",
    timeout: 30_000,
  });

  if (res.error) {
    throw new Error(`Failed to spawn child: ${res.error.message}`);
  }
  if (res.status !== 0) {
    throw new Error(
      `Child exited with status ${res.status}\nstdout: ${res.stdout}\nstderr: ${res.stderr}`
    );
  }

  const line = res.stdout
    .split("\n")
    .reverse()
    .find((l) => l.startsWith("__RESULT__:"));
  if (!line) {
    throw new Error(
      `Child produced no __RESULT__ line.\nstdout: ${res.stdout}\nstderr: ${res.stderr}`
    );
  }
  return JSON.parse(line.slice("__RESULT__:".length));
}

// ── Pre-flight ──────────────────────────────────────────────────────────────
if (!fs.existsSync(DIST_ENTRY)) {
  console.error(R(`Built adapter not found at ${DIST_ENTRY}`));
  console.error(DIM("Run `npm run build` in backend/ first."));
  process.exit(2);
}

console.log(BOLD("Canton status — backend unit tests"));

// ── Scenario 1: no CANTON_LEDGER_API_URL configured ─────────────────────────
section("CANTON_LEDGER_API_URL not configured");
{
  const result = runChild("status", {
    // Intentionally no CANTON_* env vars set.
  });

  test("status call resolves without throwing (no 500)", () => {
    assert.equal(result.ok, true, `status threw: ${result.error}`);
  });

  test("payload reports configured=false", () => {
    assert.equal(result.status.configured, false);
    assert.equal(result.status.ledger_api_url_configured, false);
  });

  test("payload reports reachable=false", () => {
    assert.equal(result.status.reachable, false);
    assert.equal(result.status.ledger_end_available, false);
  });

  test("legacy status string is not_configured", () => {
    assert.equal(result.status.status, "not_configured");
  });

  test("no fetch calls were made (nothing to probe)", () => {
    assert.equal(result.fetchCalls.length, 0,
      `expected 0 fetch calls, got: ${JSON.stringify(result.fetchCalls)}`);
  });
}

// ── Scenario 2: CANTON_NETWORK=devnet but parties / package missing ─────────
section("CANTON_NETWORK=devnet with missing parties/package");
{
  const result = runChild("status", {
    CANTON_NETWORK: "devnet",
    // No CANTON_LEDGER_API_URL / parties / package id on purpose.
  });

  test("status call resolves without throwing", () => {
    assert.equal(result.ok, true, `status threw: ${result.error}`);
  });

  test("mode is devnet", () => {
    assert.equal(result.status.mode, "devnet");
    assert.equal(result.status.network, "devnet");
  });

  test("readiness fields are all false", () => {
    assert.equal(result.status.configured, false);
    assert.equal(result.status.submitter_party_configured, false);
    assert.equal(result.status.custodian_party_configured, false);
    assert.equal(result.status.package_id_configured, false);
    assert.equal(result.status.reachable, false);
    assert.equal(result.status.devnet_ready, false);
  });

  test("missing_remote_env lists the unset vars", () => {
    const missing = result.status.missing_remote_env;
    assert.ok(Array.isArray(missing), "missing_remote_env should be an array");
    for (const name of [
      "CANTON_LEDGER_API_URL",
      "CANTON_SUBMITTER_PARTY",
      "CANTON_CUSTODIAN_PARTY",
      "CANTON_PACKAGE_ID",
      "CANTON_JWT_PRIVATE_KEY",
    ]) {
      assert.ok(missing.includes(name), `missing_remote_env should include ${name}, got ${JSON.stringify(missing)}`);
    }
  });
}

// ── Scenario 3: CANTON_AUTH_TOKEN drives the Authorization header ───────────
section("CANTON_AUTH_TOKEN sets Authorization header");
{
  const TOKEN = "test-bearer-token-abc123";
  const result = runChild("status", {
    CANTON_LEDGER_API_URL: "http://canton.test:7575",
    CANTON_AUTH_TOKEN: TOKEN,
    // Force the mock to look like a reachable ledger so both probes fire and
    // we can verify the Authorization header on each.
    MOCK_FETCH_MODE: "ok-livez",
  });

  test("status call resolves without throwing", () => {
    assert.equal(result.ok, true, `status threw: ${result.error}`);
  });

  test("auth_token_configured=true is reported", () => {
    assert.equal(result.status.auth_token_configured, true);
  });

  test("at least one Canton HTTP call was made", () => {
    assert.ok(result.fetchCalls.length > 0,
      `expected fetch calls, got none. status=${JSON.stringify(result.status)}`);
  });

  test("every Canton fetch carries Authorization: Bearer <token>", () => {
    for (const call of result.fetchCalls) {
      const auth = call.headers["authorization"];
      assert.equal(auth, `Bearer ${TOKEN}`,
        `fetch to ${call.url} had Authorization=${JSON.stringify(auth)}`);
    }
  });
}

// ── Summary ─────────────────────────────────────────────────────────────────
console.log("");
console.log(BOLD(`Results: ${G(`${passed} passed`)}, ${failed ? R(`${failed} failed`) : `${failed} failed`}`));
if (failed > 0) {
  console.log(R("\nFailures:"));
  for (const f of failures) {
    console.log(`  - ${f.name}: ${f.error}`);
  }
  process.exit(1);
}
