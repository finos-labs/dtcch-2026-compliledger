#!/usr/bin/env node
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import net from "node:net";

const require = createRequire(import.meta.url);
const jwt = require("jsonwebtoken");
const { canonicalStringify, sha256 } = require("../dist/crypto.js");

const __dirname = dirname(fileURLToPath(import.meta.url));
const backendDir = resolve(__dirname, "..");
const serverEntry = resolve(backendDir, "dist/server.js");
const JWT_SECRET = "phase4-jwt-secret";
const JWT_ISSUER = "phase4-tests";
const JWT_AUDIENCE = "settlementguard-api";
const STATIC_BEARER_TOKEN = "phase4-static-bearer";
const HMAC_SECRET = "phase4-hmac-secret";
const CDM_SCOPE = "sg:cdm:eligibility:evaluate";
const DEMO_SCOPE = "sg:demo:evaluate";

const baseSpecification = {
  id: "SPEC-SAT",
  name: "Eligible Collateral Fixture",
  version: "1.0",
  criteria: { schedule: "fixture" },
};

const baseEvidenceValues = {
  maturity: "2028-12-31",
  collateralAssetType: "GOVERNMENT_BOND",
  assetCountryOfOrigin: "US",
  denominatedCurrency: "USD",
  agencyRating: "AA",
  issuerType: "SOVEREIGN",
  issuerName: "US TREASURY",
};

let passed = 0;

function issueJwt(scopes) {
  return jwt.sign(
    { sub: "phase4-test-client", scope: scopes.join(" ") },
    JWT_SECRET,
    { issuer: JWT_ISSUER, audience: JWT_AUDIENCE, expiresIn: "5m" }
  );
}

function authHeader(token) {
  return { Authorization: ["Bearer", token].join(" ") };
}

function isoNowMinus(minutes) {
  return new Date(Date.now() - (minutes * 60 * 1000)).toISOString();
}

function makeEvidence(attribute, claimValue, overrides = {}) {
  return {
    evidence_id: `ev-${attribute}-${claimValue}`.replace(/[^a-zA-Z0-9-]/g, "_"),
    source: "security-master",
    attribute,
    claim_value: claimValue,
    observed_at: isoNowMinus(5),
    provenance: "fixture/v1",
    integrity_hash: `hash-${attribute}`,
    ...overrides,
  };
}

function makeEvidencePackage(overrides = {}) {
  return {
    package_id: "pkg-phase4",
    collateral_reference: "COLL-001",
    evidence: Object.entries(baseEvidenceValues).map(([attribute, claimValue]) =>
      makeEvidence(attribute, claimValue)
    ),
    ...overrides,
  };
}

function makeRequest(overrides = {}) {
  return {
    collateral_reference: "COLL-001",
    specification: { ...baseSpecification },
    specification_reference: baseSpecification.id,
    evidence_package: makeEvidencePackage(),
    ...overrides,
  };
}

function getFreePort() {
  return new Promise((resolvePort, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close(() => reject(new Error("Could not resolve free port")));
        return;
      }
      const { port } = address;
      server.close((error) => {
        if (error) reject(error);
        else resolvePort(port);
      });
    });
  });
}

async function waitForHealthy(baseUrl, token) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/health`, {
        headers: token ? authHeader(token) : undefined,
      });
      if (response.ok) return;
    } catch {
      // retry
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 200));
  }
  throw new Error(`Timed out waiting for backend health at ${baseUrl}`);
}

function createProviderPayload(body, isEligible, matchingEligibleCriteria = []) {
  return {
    result: {
      isEligible,
      matchingEligibleCriteria,
      eligibilityQuery: body.eligibilityQuery,
      specification: body.specification,
    },
    metadata: {
      provider_name: "Fixture External CDM Provider",
      cdm_function: "cdm.product.collateral.CheckEligibilityByDetails",
      cdm_model_version: "cdm-fixture-v1",
      provider_version: "fixture-provider-v1",
    },
  };
}

function signProviderPayload(payload) {
  const contentHash = sha256(canonicalStringify(payload));
  return createHmac("sha256", HMAC_SECRET).update(contentHash, "utf8").digest("hex");
}

async function createProviderServer() {
  const calls = [];
  const server = createServer(async (req, res) => {
    if (req.method !== "POST") {
      res.writeHead(405, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "method_not_allowed" }));
      return;
    }

    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const rawBody = Buffer.concat(chunks).toString("utf8");
    const body = JSON.parse(rawBody);
    calls.push(body);

    const specId = body?.specification?.id;
    if (specId === "SPEC-HTTP-503") {
      res.writeHead(503, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "provider_unavailable" }));
      return;
    }

    let payload;
    let signature;

    if (specId === "SPEC-NOT") {
      payload = createProviderPayload(body, false, [{ identifier: "CRIT-NO", reference: "criteria/ineligible" }]);
      signature = signProviderPayload(payload);
    } else if (specId === "SPEC-INVALID") {
      payload = {
        result: {
          isEligible: true,
          matchingEligibleCriteria: [],
          eligibilityQuery: { ...body.eligibilityQuery, issuerName: "OTHER ISSUER" },
          specification: body.specification,
        },
        metadata: {
          provider_name: "Fixture External CDM Provider",
          cdm_function: "cdm.product.collateral.CheckEligibilityByDetails",
          cdm_model_version: "cdm-fixture-v1",
          provider_version: "fixture-provider-v1",
        },
      };
      signature = signProviderPayload(payload);
    } else if (specId === "SPEC-UNVERIFIED") {
      payload = createProviderPayload(body, true, [{ reference: "criteria/unverified" }]);
      signature = "deadbeef";
    } else {
      payload = createProviderPayload(body, true, [
        "criteria/1",
        { identifier: "CRIT-2", reference: "criteria/2" },
      ]);
      signature = signProviderPayload(payload);
    }

    res.writeHead(200, {
      "Content-Type": "application/json",
      "x-cdm-response-algorithm": "hmac-sha256",
      "x-cdm-response-key-id": "fixture-key",
      "x-cdm-response-signature": signature,
    });
    res.end(JSON.stringify(payload));
  });

  const port = await getFreePort();
  await new Promise((resolveListen, reject) => {
    server.listen(port, "127.0.0.1", (error) => {
      if (error) reject(error);
      else resolveListen();
    });
  });

  return {
    baseUrl: `http://127.0.0.1:${port}`,
    calls,
    close: () => new Promise((resolveClose, reject) => {
      server.close((error) => {
        if (error) reject(error);
        else resolveClose();
      });
    }),
  };
}

async function startBackend(extraEnv = {}) {
  const port = await getFreePort();
  const env = {
    ...process.env,
    PORT: String(port),
    API_BEARER_TOKEN: STATIC_BEARER_TOKEN,
    SG_JWT_SECRET: JWT_SECRET,
    SG_JWT_ISSUER: JWT_ISSUER,
    SG_JWT_AUDIENCE: JWT_AUDIENCE,
    SG_SIGNING_SEED_B64: Buffer.alloc(32, 7).toString("base64"),
    SG_KEY_ID: "phase4-key",
    SG_KEY_VERSION: "v1",
    ...extraEnv,
  };

  const child = spawn(process.execPath, [serverEntry], {
    cwd: backendDir,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });

  let logs = "";
  child.stdout.on("data", (chunk) => {
    logs += chunk.toString("utf8");
  });
  child.stderr.on("data", (chunk) => {
    logs += chunk.toString("utf8");
  });

  const baseUrl = `http://127.0.0.1:${port}`;
  await waitForHealthy(baseUrl);

  return {
    baseUrl,
    logs: () => logs,
    close: () => new Promise((resolveClose) => {
      child.once("exit", () => resolveClose());
      child.kill("SIGTERM");
      setTimeout(() => child.kill("SIGKILL"), 5_000).unref();
    }),
  };
}

async function requestJson(baseUrl, path, { token, method = "POST", body } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(token ? authHeader(token) : {}),
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const json = await response.json().catch(() => ({}));
  return { status: response.status, body: json };
}

async function requestRaw(baseUrl, path, { token, body } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      ...(token ? authHeader(token) : {}),
      "Content-Type": "application/json",
    },
    body,
  });
  const json = await response.json().catch(() => ({}));
  return { status: response.status, body: json };
}

async function test(name, fn) {
  try {
    await fn();
    console.log(`✓ ${name}`);
    passed += 1;
  } catch (error) {
    console.error(`✗ ${name}`);
    console.error(error instanceof Error ? error.stack : error);
    process.exitCode = 1;
  }
}

const provider = await createProviderServer();
const backend = await startBackend({
  CDM_ELIGIBILITY_ENDPOINT: provider.baseUrl,
  CDM_RESPONSE_HMAC_SECRET: HMAC_SECRET,
  CDM_ELIGIBILITY_PROVIDER_VERSION: "fixture-provider-v1",
  CDM_MODEL_VERSION: "cdm-fixture-v1",
});

try {
  const exactScopeToken = issueJwt([CDM_SCOPE]);
  const demoScopeToken = issueJwt([DEMO_SCOPE]);
  const adminScopeToken = issueJwt(["sg:admin"]);
  const wrongScopeToken = issueJwt(["sg:verify:read"]);

  await test("CDM route returns SATISFIED with required metadata and no intent side effects", async () => {
    const before = await requestJson(backend.baseUrl, "/v1/intents", {
      token: adminScopeToken,
      method: "GET",
    });
    assert.equal(before.status, 200);
    const beforeCount = before.body.intents.length;

    const response = await requestJson(backend.baseUrl, "/v1/cdm/collateral/eligibility/evaluate", {
      token: exactScopeToken,
      body: makeRequest(),
    });
    assert.equal(response.status, 200);
    assert.equal(response.body.assessment_type, "CDM_COLLATERAL_ELIGIBILITY");
    assert.equal(response.body.status, "SATISFIED");
    assert.deepEqual(response.body.reason_codes, ["CDM_COLLATERAL_ELIGIBLE"]);
    assert.equal(response.body.collateral_reference, "COLL-001");
    assert.equal(response.body.specification_reference, "SPEC-SAT");
    assert.equal(response.body.evidence_package_id, "pkg-phase4");
    assert.equal(response.body.evidence_sufficiency.is_sufficient, true);
    assert.equal(response.body.evidence_sufficiency.requires_manual_review, false);
    assert.equal(response.body.provider_name, "Fixture External CDM Provider");
    assert.equal(response.body.provider_version, "fixture-provider-v1");
    assert.equal(response.body.cdm_model_version, "cdm-fixture-v1");
    assert.equal(response.body.cdm_result_summary.isEligible, true);
    assert.deepEqual(response.body.cdm_result_summary.matching_criteria, [
      { reference: "criteria/1" },
      { identifier: "CRIT-2", reference: "criteria/2" },
    ]);
    assert.ok(Array.isArray(response.body.evidence_reference_ids));
    assert.ok(response.body.evaluated_at);

    const after = await requestJson(backend.baseUrl, "/v1/intents", {
      token: adminScopeToken,
      method: "GET",
    });
    assert.equal(after.status, 200);
    assert.equal(after.body.intents.length, beforeCount);
  });

  await test("CDM route returns NOT_SATISFIED without fabricating PASS", async () => {
    const response = await requestJson(backend.baseUrl, "/v1/cdm/collateral/eligibility/evaluate", {
      token: exactScopeToken,
      body: makeRequest({
        specification: { ...baseSpecification, id: "SPEC-NOT" },
        specification_reference: "SPEC-NOT",
      }),
    });
    assert.equal(response.status, 200);
    assert.equal(response.body.status, "NOT_SATISFIED");
    assert.deepEqual(response.body.reason_codes, ["CDM_COLLATERAL_INELIGIBLE"]);
    assert.equal(response.body.cdm_result_summary.isEligible, false);
  });

  await test("insufficient evidence returns NOT_EVALUABLE and never calls provider", async () => {
    const callsBefore = provider.calls.length;
    const response = await requestJson(backend.baseUrl, "/v1/cdm/collateral/eligibility/evaluate", {
      token: exactScopeToken,
      body: makeRequest({
        evidence_package: makeEvidencePackage({ evidence: [] }),
      }),
    });
    assert.equal(response.status, 200);
    assert.equal(response.body.status, "NOT_EVALUABLE");
    assert.equal(response.body.evidence_sufficiency.is_sufficient, false);
    assert.equal(response.body.cdm_result_summary, null);
    assert.equal(response.body.provider_name, null);
    assert.equal(provider.calls.length, callsBefore);
  });

  await test("conflicting evidence returns MANUAL_REVIEW and never calls provider", async () => {
    const callsBefore = provider.calls.length;
    const response = await requestJson(backend.baseUrl, "/v1/cdm/collateral/eligibility/evaluate", {
      token: exactScopeToken,
      body: makeRequest({
        evidence_package: makeEvidencePackage({
          evidence: [
            ...makeEvidencePackage().evidence,
            makeEvidence("agencyRating", "BBB", { evidence_id: "ev-rating-conflict" }),
          ],
        }),
      }),
    });
    assert.equal(response.status, 200);
    assert.equal(response.body.status, "MANUAL_REVIEW");
    assert.equal(response.body.evidence_sufficiency.requires_manual_review, true);
    assert.equal(response.body.query, null);
    assert.equal(provider.calls.length, callsBefore);
  });

  await test("reference-only specification requests stay explicit and unevaluated without a resolver", async () => {
    const callsBefore = provider.calls.length;
    const response = await requestJson(backend.baseUrl, "/v1/cdm/collateral/eligibility/evaluate", {
      token: exactScopeToken,
      body: makeRequest({
        specification: undefined,
      }),
    });
    assert.equal(response.status, 200);
    assert.equal(response.body.status, "NOT_EVALUABLE");
    assert.ok(response.body.reason_codes.includes("SPECIFICATION_UNRESOLVED"));
    assert.equal(response.body.evidence_sufficiency.is_sufficient, true);
    assert.equal(provider.calls.length, callsBefore);
  });

  await test("mismatched specification payload and reference require manual review", async () => {
    const callsBefore = provider.calls.length;
    const response = await requestJson(backend.baseUrl, "/v1/cdm/collateral/eligibility/evaluate", {
      token: exactScopeToken,
      body: makeRequest({
        specification_reference: "SPEC-OTHER",
      }),
    });
    assert.equal(response.status, 200);
    assert.equal(response.body.status, "MANUAL_REVIEW");
    assert.ok(response.body.reason_codes.includes("SPECIFICATION_REFERENCE_MISMATCH"));
    assert.equal(provider.calls.length, callsBefore);
  });

  await test("provider HTTP errors map to NOT_EVALUABLE while preserving evidence sufficiency", async () => {
    const response = await requestJson(backend.baseUrl, "/v1/cdm/collateral/eligibility/evaluate", {
      token: exactScopeToken,
      body: makeRequest({
        specification: { ...baseSpecification, id: "SPEC-HTTP-503" },
        specification_reference: "SPEC-HTTP-503",
      }),
    });
    assert.equal(response.status, 200);
    assert.equal(response.body.status, "NOT_EVALUABLE");
    assert.deepEqual(response.body.reason_codes, [
      "CDM_EVALUATION_UNAVAILABLE",
      "PROVIDER_UNAVAILABLE",
    ]);
    assert.equal(response.body.evidence_sufficiency.is_sufficient, true);
    assert.equal(response.body.cdm_result_summary, null);
  });

  await test("invalid provider responses never fabricate ineligibility", async () => {
    const response = await requestJson(backend.baseUrl, "/v1/cdm/collateral/eligibility/evaluate", {
      token: exactScopeToken,
      body: makeRequest({
        specification: { ...baseSpecification, id: "SPEC-INVALID" },
        specification_reference: "SPEC-INVALID",
      }),
    });
    assert.equal(response.status, 200);
    assert.equal(response.body.status, "NOT_EVALUABLE");
    assert.ok(response.body.reason_codes.includes("PROVIDER_RESPONSE_INVALID"));
    assert.equal(response.body.cdm_result_summary, null);
  });

  await test("unverified provider responses stay NOT_EVALUABLE", async () => {
    const response = await requestJson(backend.baseUrl, "/v1/cdm/collateral/eligibility/evaluate", {
      token: exactScopeToken,
      body: makeRequest({
        specification: { ...baseSpecification, id: "SPEC-UNVERIFIED" },
        specification_reference: "SPEC-UNVERIFIED",
      }),
    });
    assert.equal(response.status, 200);
    assert.equal(response.body.status, "NOT_EVALUABLE");
    assert.ok(response.body.reason_codes.includes("PROVIDER_RESPONSE_UNVERIFIED"));
  });

  await test("missing package, malformed structure, and unsupported provider selector return 400", async () => {
    const missingPackage = await requestJson(backend.baseUrl, "/v1/cdm/collateral/eligibility/evaluate", {
      token: exactScopeToken,
      body: {
        collateral_reference: "COLL-001",
        specification: { ...baseSpecification },
      },
    });
    assert.equal(missingPackage.status, 400);

    const wrongEvidenceField = await requestJson(backend.baseUrl, "/v1/cdm/collateral/eligibility/evaluate", {
      token: exactScopeToken,
      body: makeRequest({
        evidence_package: {
          package_id: "pkg-phase4",
          collateral_reference: "COLL-001",
          evidence: [{ evidence_id: "bad" }],
        },
      }),
    });
    assert.equal(wrongEvidenceField.status, 400);

    const unsupportedProviderSelector = await requestJson(backend.baseUrl, "/v1/cdm/collateral/eligibility/evaluate", {
      token: exactScopeToken,
      body: {
        ...makeRequest(),
        provider_configuration_id: "external-a",
      },
    });
    assert.equal(unsupportedProviderSelector.status, 400);
  });

  await test("non-object and malformed JSON bodies return safe 400 errors", async () => {
    const nonObject = await requestRaw(backend.baseUrl, "/v1/cdm/collateral/eligibility/evaluate", {
      token: exactScopeToken,
      body: JSON.stringify([]),
    });
    assert.equal(nonObject.status, 400);
    assert.equal(nonObject.body.error, "Invalid CDM collateral eligibility evaluation request");

    const malformed = await requestRaw(backend.baseUrl, "/v1/cdm/collateral/eligibility/evaluate", {
      token: exactScopeToken,
      body: "{",
    });
    assert.equal(malformed.status, 400);
    assert.equal(malformed.body.error, "Malformed JSON request body");
  });

  await test("auth rejects missing credentials, invalid tokens, wrong scopes, and demo-only scope", async () => {
    const missing = await requestJson(backend.baseUrl, "/v1/cdm/collateral/eligibility/evaluate", {
      body: makeRequest(),
    });
    assert.equal(missing.status, 401);

    const invalid = await requestJson(backend.baseUrl, "/v1/cdm/collateral/eligibility/evaluate", {
      token: "not-a-real-token",
      body: makeRequest(),
    });
    assert.equal(invalid.status, 401);

    const wrongScope = await requestJson(backend.baseUrl, "/v1/cdm/collateral/eligibility/evaluate", {
      token: wrongScopeToken,
      body: makeRequest(),
    });
    assert.equal(wrongScope.status, 403);

    const demoScope = await requestJson(backend.baseUrl, "/v1/cdm/collateral/eligibility/evaluate", {
      token: demoScopeToken,
      body: makeRequest(),
    });
    assert.equal(demoScope.status, 403);
  });

  await test("sg:admin JWT and static bearer preserve backward-compatible access", async () => {
    const adminJwt = await requestJson(backend.baseUrl, "/v1/cdm/collateral/eligibility/evaluate", {
      token: adminScopeToken,
      body: makeRequest(),
    });
    assert.equal(adminJwt.status, 200);

    const staticBearer = await requestJson(backend.baseUrl, "/v1/cdm/collateral/eligibility/evaluate", {
      token: STATIC_BEARER_TOKEN,
      body: makeRequest(),
    });
    assert.equal(staticBearer.status, 200);
  });

  await test("demo endpoint remains unchanged, including scope behavior and response shape", async () => {
    const demoOk = await requestJson(backend.baseUrl, "/v1/demo/evaluate", {
      token: demoScopeToken,
      body: {
        rule_pack: "ISDA",
        payload: {
          counterparty_status: "ACTIVE",
          required_margin: 100,
          posted_collateral_value: 100,
        },
      },
    });
    assert.equal(demoOk.status, 200);
    assert.equal(demoOk.body.decision_type, "evaluation");
    assert.equal(demoOk.body.decision, "PASS");
    assert.deepEqual(demoOk.body.reason_codes, []);

    const demoForbidden = await requestJson(backend.baseUrl, "/v1/demo/evaluate", {
      token: exactScopeToken,
      body: {
        rule_pack: "ISDA",
        payload: {
          counterparty_status: "ACTIVE",
          required_margin: 100,
          posted_collateral_value: 100,
        },
      },
    });
    assert.equal(demoForbidden.status, 403);
  });
} finally {
  await backend.close();
  await provider.close();
}

const misconfiguredBackend = await startBackend({
  CDM_ELIGIBILITY_PROVIDER: "bogus-provider",
});

try {
  await test("provider configuration errors return explicit NOT_EVALUABLE assessments", async () => {
    const response = await requestJson(misconfiguredBackend.baseUrl, "/v1/cdm/collateral/eligibility/evaluate", {
      token: issueJwt([CDM_SCOPE]),
      body: makeRequest(),
    });
    assert.equal(response.status, 200);
    assert.equal(response.body.status, "NOT_EVALUABLE");
    assert.deepEqual(response.body.reason_codes, [
      "CDM_EVALUATION_UNAVAILABLE",
      "PROVIDER_CONFIGURATION_ERROR",
    ]);
    assert.equal(response.body.cdm_result_summary, null);
  });
} finally {
  await misconfiguredBackend.close();
}

if (!process.exitCode) {
  console.log(`CDM REST API tests passed (${passed} cases)`);
}
