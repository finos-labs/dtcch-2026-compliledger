#!/usr/bin/env node
/**
 * Canton Readiness Check
 *
 * Validates the local environment is configured correctly to talk to a Canton
 * JSON Ledger API and that the configured ledger is reachable. This script is
 * intentionally read-only: it does NOT submit any contracts. It only verifies
 * configuration and connectivity.
 *
 * Usage:
 *   node backend/scripts/canton-readiness.mjs
 *   npm --prefix backend run canton:readiness
 *
 * Exit codes:
 *   0 — all required readiness checks passed
 *   1 — one or more required readiness checks failed
 *
 * Requires Node 18+ (native fetch).
 */

import "dotenv/config";

// ─── ANSI helpers ─────────────────────────────────────────────────────────────
const G    = (s) => `\x1b[32m${s}\x1b[0m`;
const R    = (s) => `\x1b[31m${s}\x1b[0m`;
const DIM  = (s) => `\x1b[2m${s}\x1b[0m`;
const BOLD = (s) => `\x1b[1m${s}\x1b[0m`;

let passed = 0;
let failed = 0;
const failures = [];

function check(name, ok, detail) {
  if (ok) {
    console.log(`  ${G("PASS")} ${name}${detail ? DIM(`  — ${detail}`) : ""}`);
    passed++;
  } else {
    console.log(`  ${R("FAIL")} ${name}${detail ? DIM(`  — ${detail}`) : ""}`);
    failures.push({ name, detail: detail || "" });
    failed++;
  }
}

function envPresent(name) {
  const val = process.env[name];
  return typeof val === "string" && val.trim().length > 0;
}

async function main() {
  console.log(BOLD("\nCanton Readiness Check\n"));

  // 1) Print CANTON_NETWORK
  const network = process.env.CANTON_NETWORK || "(unset)";
  console.log(`  CANTON_NETWORK = ${network}`);
  console.log("");

  // 2) Verify CANTON_LEDGER_API_URL is configured
  const ledgerUrlRaw = process.env.CANTON_LEDGER_API_URL;
  const ledgerUrl = (ledgerUrlRaw || "").trim();
  check(
    "CANTON_LEDGER_API_URL configured",
    ledgerUrl.length > 0,
    ledgerUrl ? ledgerUrl : "set CANTON_LEDGER_API_URL in your environment"
  );

  // 3) Probe the Canton health endpoint (fall back to ledger-end when /livez
  //    is not available, e.g. some sandbox builds).
  if (ledgerUrl.length > 0) {
    const base = ledgerUrl.replace(/\/$/, "");
    const headers = {};
    const authTokenRaw = process.env.CANTON_AUTH_TOKEN || "";
    const authToken = authTokenRaw.trim();
    // Reject tokens containing CR/LF or any other control characters to avoid
    // HTTP header injection via a misconfigured env var. Mirrors the
    // sanitizeBearerToken() guard in src/canton-ledger.ts.
    if (authToken && !/[\x00-\x1F\x7F]/.test(authToken)) {
      headers["Authorization"] = authToken.toLowerCase().startsWith("bearer ")
        ? authToken
        : `Bearer ${authToken}`;
    } else if (authToken) {
      console.log(`  ${DIM("note: CANTON_AUTH_TOKEN contains control characters and was ignored")}`);
    }

    let probeOk = false;
    let probeDetail = "";
    let probeEndpoint = "/livez";

    try {
      const res = await fetch(`${base}/livez`, { headers });
      if (res.ok) {
        probeOk = true;
        probeDetail = `${base}/livez → ${res.status}`;
      } else {
        probeDetail = `${base}/livez → HTTP ${res.status}`;
      }
    } catch (err) {
      probeDetail = `${base}/livez → ${err?.message || String(err)}`;
    }

    if (!probeOk) {
      // Fall back to /v2/state/ledger-end
      probeEndpoint = "/v2/state/ledger-end";
      try {
        const res = await fetch(`${base}/v2/state/ledger-end`, { headers });
        if (res.ok) {
          probeOk = true;
          probeDetail = `${base}/v2/state/ledger-end → ${res.status}`;
        } else {
          probeDetail += ` ; ${base}/v2/state/ledger-end → HTTP ${res.status}`;
        }
      } catch (err) {
        probeDetail += ` ; ${base}/v2/state/ledger-end → ${err?.message || String(err)}`;
      }
    }

    check(`Canton ${probeEndpoint} reachable`, probeOk, probeDetail);
  } else {
    check("Canton health endpoint reachable", false, "skipped: CANTON_LEDGER_API_URL not set");
  }

  // 4) Verify required party / package configuration
  for (const name of ["CANTON_SUBMITTER_PARTY", "CANTON_CUSTODIAN_PARTY", "CANTON_PACKAGE_ID"]) {
    check(
      `${name} configured`,
      envPresent(name),
      envPresent(name) ? process.env[name] : `set ${name} in your environment`
    );
  }

  // ─── Summary ────────────────────────────────────────────────────────────────
  console.log("");
  console.log(BOLD("Summary"));
  console.log(`  ${G(`PASS: ${passed}`)}   ${failed > 0 ? R(`FAIL: ${failed}`) : `FAIL: ${failed}`}`);
  if (failures.length > 0) {
    console.log("");
    console.log(BOLD("Failed checks:"));
    for (const f of failures) {
      console.log(`  ${R("✗")} ${f.name}${f.detail ? DIM(`  — ${f.detail}`) : ""}`);
    }
  }
  console.log("");

  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(R(`\nUnexpected error: ${err?.stack || err?.message || String(err)}\n`));
  process.exit(1);
});
