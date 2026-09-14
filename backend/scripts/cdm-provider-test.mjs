#!/usr/bin/env node
import assert from "node:assert/strict";
import http from "node:http";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
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

if (!process.exitCode) {
  console.log(`CDM provider adapter tests passed (${passed} cases)`);
}
