#!/usr/bin/env node
import { createHmac } from "node:crypto";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { canonicalStringify, sha256 } = require("../dist/crypto.js");

const ENDPOINT = process.env.CDM_ELIGIBILITY_ENDPOINT || "";
const SHARED_SECRET = process.env.CDM_RESPONSE_HMAC_SECRET || "";
const AUTH_TOKEN = process.env.CDM_ELIGIBILITY_AUTH_TOKEN || "";

if (!ENDPOINT) {
  console.error("CDM_ELIGIBILITY_ENDPOINT is required");
  process.exit(2);
}

const body = {
  cdm_function: "cdm.product.collateral.CheckEligibilityByDetails",
  specification: {
    id: "SPEC-INT-001",
    version: "1.0",
    criteria: { market: "GMSLA" },
  },
  eligibilityQuery: {
    maturity: "2028-12-31",
    collateralAssetType: "GOVERNMENT_BOND",
    assetCountryOfOrigin: "US",
    denominatedCurrency: "USD",
    agencyRating: "AA",
    issuerType: "SOVEREIGN",
    issuerName: "US TREASURY",
  },
};

const response = await fetch(ENDPOINT, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    ...(AUTH_TOKEN ? { Authorization: ["Bearer", AUTH_TOKEN].join(" ") } : {}),
  },
  body: JSON.stringify(body),
});

if (!response.ok) {
  const text = await response.text().catch(() => "");
  console.error(`CDM integration request failed (${response.status}): ${text}`);
  process.exit(1);
}

const payload = await response.json();
const result = payload?.result ?? payload;

if (SHARED_SECRET) {
  const signature = response.headers.get("x-cdm-response-signature") || "";
  const contentHash = sha256(canonicalStringify(payload));
  const expected = createHmac("sha256", SHARED_SECRET).update(contentHash, "utf8").digest("hex");

  if (!signature || signature !== expected) {
    console.error("CDM response signature verification failed");
    process.exit(1);
  }
}

if (!result || typeof result.isEligible !== "boolean") {
  console.error("CDM response did not include a valid CheckEligibilityResult");
  process.exit(1);
}

for (const key of ["eligibilityQuery", "specification", "matchingEligibleCriteria"]) {
  if (!(key in result)) {
    console.error(`CDM response missing result.${key}`);
    process.exit(1);
  }
}

console.log("CDM integration test passed");
