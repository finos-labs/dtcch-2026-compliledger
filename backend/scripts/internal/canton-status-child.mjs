#!/usr/bin/env node
/**
 * Child harness for Canton status unit tests.
 *
 * Spawned by `scripts/canton-status-test.mjs` once per scenario so each test
 * gets a fresh process with its own env vars (the Canton adapter snapshots
 * many env vars at module-load time).
 *
 * Action is read from `process.argv[2]`. The harness:
 *   1. Installs a `globalThis.fetch` mock that records every call.
 *   2. Dynamically imports the compiled Canton adapter from `dist/`.
 *   3. Invokes the adapter and writes a single JSON line to stdout
 *      (prefixed with `__RESULT__:`) describing the captured fetch calls
 *      and the adapter's return value.
 *
 * The harness must NOT make real network calls — every fetch goes through
 * the in-process mock so tests can run without a Canton node.
 */

import { pathToFileURL } from "node:url";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const action = process.argv[2];

// ── Install fetch mock ──────────────────────────────────────────────────────
const fetchCalls = [];

/**
 * Build a Response-like object that mimics the subset of the fetch Response
 * API used by `canton-ledger.ts` (`ok`, `status`, `json()`, `text()`, `body`).
 */
function makeResponse({ status = 200, body = "", json } = {}) {
  const text = typeof body === "string" ? body : JSON.stringify(body);
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      if (json !== undefined) return json;
      return JSON.parse(text);
    },
    async text() {
      return text;
    },
    body: null,
  };
}

globalThis.fetch = async (url, init = {}) => {
  // Headers may be provided as a plain object, an array, or a Headers
  // instance. Normalise to a plain lowercase-keyed object so tests can
  // assert on Authorization regardless of how the adapter built them.
  const rawHeaders = init.headers ?? {};
  const headers = {};
  if (rawHeaders && typeof rawHeaders.forEach === "function") {
    rawHeaders.forEach((v, k) => { headers[String(k).toLowerCase()] = v; });
  } else if (Array.isArray(rawHeaders)) {
    for (const [k, v] of rawHeaders) headers[String(k).toLowerCase()] = v;
  } else if (typeof rawHeaders === "object") {
    for (const [k, v] of Object.entries(rawHeaders)) headers[String(k).toLowerCase()] = v;
  }

  fetchCalls.push({
    url: String(url),
    method: init.method || "GET",
    headers,
  });

  // Default behaviour: simulate a Canton ledger that is unreachable. Tests
  // that need a "reachable" ledger override this by setting MOCK_FETCH_MODE.
  const mode = process.env.MOCK_FETCH_MODE || "unreachable";
  if (mode === "unreachable") {
    throw Object.assign(new Error("ECONNREFUSED (mock)"), { code: "ECONNREFUSED" });
  }
  if (mode === "ok-livez") {
    if (String(url).endsWith("/livez")) return makeResponse({ status: 200, body: "OK" });
    if (String(url).includes("/v2/state/ledger-end")) {
      return makeResponse({ status: 200, json: { offset: "000000000000001" } });
    }
    return makeResponse({ status: 404, body: "" });
  }
  return makeResponse({ status: 500, body: "unexpected mock mode" });
};

// ── Dynamic import of the built adapter ─────────────────────────────────────
const adapterPath = path.resolve(__dirname, "..", "..", "dist", "canton-ledger.js");
const adapterUrl = pathToFileURL(adapterPath).href;
const adapter = await import(adapterUrl);

// ── Dispatch on action ──────────────────────────────────────────────────────
let result;
try {
  switch (action) {
    case "status": {
      const status = await adapter.getCantonNetworkStatus();
      result = { ok: true, status, fetchCalls };
      break;
    }
    default:
      throw new Error(`Unknown action: ${action}`);
  }
} catch (err) {
  result = { ok: false, error: err && err.message ? err.message : String(err), fetchCalls };
}

process.stdout.write(`__RESULT__:${JSON.stringify(result)}\n`);
