#!/usr/bin/env node
import { createHash, createHmac } from "node:crypto";

const ENDPOINT = process.env.CDM_ELIGIBILITY_ENDPOINT || "";
const SHARED_SECRET = process.env.CDM_RESPONSE_HMAC_SECRET || "";
const AUTH_TOKEN = process.env.CDM_ELIGIBILITY_AUTH_TOKEN || "";

if (!ENDPOINT) {
  console.error("CDM_ELIGIBILITY_ENDPOINT is required");
  process.exit(2);
}

if (!SHARED_SECRET) {
  console.error("CDM_RESPONSE_HMAC_SECRET is required");
  process.exit(2);
}

const body = {
  function: "CheckEligibilityByDetails",
  specification: {
    id: "SPEC-INT-001",
    version: "1.0",
    criteria: { market: "GMSLA" },
  },
  query: {
    maturity: "2028-12-31",
    collateralAssetType: "GOVERNMENT_BOND",
    assetCountryOfOrigin: "US",
    denominatedCurrency: "USD",
    agencyRating: "AA",
    issuerType: "SOVEREIGN",
    issuerName: "US TREASURY",
  },
};

function sortKeysDeep(value) {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value && typeof value === "object") {
    return Object.keys(value).sort().reduce((acc, key) => {
      acc[key] = sortKeysDeep(value[key]);
      return acc;
    }, {});
  }
  return value;
}

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
const signature = response.headers.get("x-cdm-response-signature") || "";
const contentHash = createHash("sha256")
  .update(JSON.stringify(sortKeysDeep(payload)), "utf8")
  .digest("hex");
const expected = createHmac("sha256", SHARED_SECRET).update(contentHash, "utf8").digest("hex");

if (!signature || signature !== expected) {
  console.error("CDM response signature verification failed");
  process.exit(1);
}

if (!payload?.result || typeof payload.result.isEligible !== "boolean") {
  console.error("CDM response did not include a valid CheckEligibilityResult");
  process.exit(1);
}

for (const key of ["eligibilityQuery", "specification", "matchingEligibleCriteria"]) {
  if (!(key in payload.result)) {
    console.error(`CDM response missing result.${key}`);
    process.exit(1);
  }
}

console.log("CDM integration test passed");
