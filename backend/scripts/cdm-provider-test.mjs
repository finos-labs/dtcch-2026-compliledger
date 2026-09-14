#!/usr/bin/env node
import assert from "node:assert/strict";
import http from "node:http";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { createCollateralEligibilityProvider } = require("../dist/cdm/adapter.js");
const { MockCdmEligibilityProvider } = require("../dist/cdm/mockProvider.js");
const {
  ExternalCdmEligibilityProvider,
} = require("../dist/cdm/httpAdapter.js");

const baseSpecification = {
  id: "SPEC-001",
  name: "Eligible Collateral Specification",
  version: "1.0",
  criteria: { schedule: "fixture" },
};

const baseQuery = {
  maturity: "2028-12-31",
  collateralAssetType: "GOVERNMENT_BOND",
  assetCountryOfOrigin: "US",
  denominatedCurrency: "USD",
  agencyRating: "AA",
  issuerType: "SOVEREIGN",
  issuerName: "US TREASURY",
};

let passed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`✓ ${name}`);
    passed += 1;
  } catch (error) {
    console.error(`✗ ${name}`);
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}

function makeResult(isEligible) {
  return {
    isEligible,
    matchingEligibleCriteria: isEligible ? ["fixture:eligible"] : [],
    eligibilityQuery: baseQuery,
    specification: baseSpecification,
  };
}

async function withEnv(overrides, fn) {
  const keys = Object.keys(overrides);
  const previous = new Map(keys.map((key) => [key, process.env[key]]));
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    await fn();
  } finally {
    for (const [key, value] of previous.entries()) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

async function withServer(handler, fn) {
  const server = http.createServer(handler);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const url = `http://127.0.0.1:${address.port}`;
  try {
    await fn(url);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
}

await test("Mock provider returns configured eligible fixture", async () => {
  const provider = new MockCdmEligibilityProvider({ defaultResult: makeResult(true) });
  const response = await provider.evaluateEligibility(baseSpecification, baseQuery);
  assert.equal(response.result.isEligible, true);
  assert.match(response.metadata.provider_name, /TEST\/REFERENCE ONLY/);
  assert.equal(response.metadata.cdm_function, "cdm.product.collateral.CheckEligibilityByDetails");
});

await test("Mock provider returns configured ineligible fixture", async () => {
  const provider = new MockCdmEligibilityProvider({ defaultResult: makeResult(false) });
  const response = await provider.evaluateEligibility(baseSpecification, baseQuery);
  assert.equal(response.result.isEligible, false);
  assert.deepEqual(response.result.matchingEligibleCriteria, []);
});

await test("External provider surfaces provider unavailable errors", async () => {
  const provider = new ExternalCdmEligibilityProvider({
    url: "http://127.0.0.1:9",
    timeoutMs: 200,
  });
  await assert.rejects(
    () => provider.evaluateEligibility(baseSpecification, baseQuery),
    (error) => error && error.code === "provider_unavailable"
  );
});

await test("External provider rejects invalid responses", async () => {
  await withServer((request, response) => {
    assert.equal(request.method, "POST");
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
    });
    request.on("end", () => {
      const parsed = JSON.parse(body);
      assert.equal(parsed.cdm_function, "cdm.product.collateral.CheckEligibilityByDetails");
      assert.deepEqual(parsed.specification, baseSpecification);
      assert.deepEqual(parsed.eligibilityQuery, baseQuery);
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ result: { isEligible: "yes" } }));
    });
  }, async (url) => {
    const provider = new ExternalCdmEligibilityProvider({ url, timeoutMs: 500 });
    await assert.rejects(
      () => provider.evaluateEligibility(baseSpecification, baseQuery),
      (error) => error && error.code === "invalid_provider_response"
    );
  });
});

await test("Provider factory rejects unsupported provider configuration", async () => {
  await withEnv({
    CDM_ELIGIBILITY_PROVIDER: "invalid-provider",
    CDM_ELIGIBILITY_ENDPOINT: undefined,
  }, async () => {
    assert.throws(
      () => createCollateralEligibilityProvider(),
      (error) => error && error.code === "invalid_provider_configuration"
    );
  });
});

await test("Provider factory rejects external provider without endpoint", async () => {
  await withEnv({
    CDM_ELIGIBILITY_PROVIDER: "external",
    CDM_ELIGIBILITY_ENDPOINT: "",
  }, async () => {
    assert.throws(
      () => createCollateralEligibilityProvider(),
      (error) => error && error.code === "invalid_provider_configuration"
    );
  });
});

await test("Provider factory surfaces invalid mock fixture configuration", async () => {
  await withEnv({
    CDM_ELIGIBILITY_PROVIDER: "mock",
    CDM_ELIGIBILITY_MOCK_RESPONSE: "{not-json",
    CDM_ELIGIBILITY_ENDPOINT: undefined,
  }, async () => {
    const provider = createCollateralEligibilityProvider();
    assert.ok(provider);
    await assert.rejects(
      () => provider.evaluateEligibility(baseSpecification, baseQuery),
      (error) => error && error.code === "invalid_mock_configuration"
    );
  });
});

if (!process.exitCode) {
  console.log(`CDM provider adapter tests passed (${passed} cases)`);
}
