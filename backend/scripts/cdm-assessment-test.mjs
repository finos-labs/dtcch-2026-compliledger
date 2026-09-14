#!/usr/bin/env node
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  evaluateEvidenceBackedCollateralEligibility,
} = require("../dist/cdm/service.js");
const {
  CDM_COLLATERAL_ELIGIBILITY_FUNCTION,
} = require("../dist/cdm/types.js");
const {
  CdmEligibilityProviderError,
} = require("../dist/cdm/provider.js");

const FIXED_EVALUATED_AT = "2026-09-14T14:24:00.678Z";
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const baseSpecification = {
  id: "SPEC-001",
  name: "Eligible Collateral Specification",
  version: "1.0",
  criteria: { schedule: "fixture" },
};

const baseEvidence = {
  maturity: "2028-12-31",
  collateralAssetType: "GOVERNMENT_BOND",
  assetCountryOfOrigin: "US",
  denominatedCurrency: "USD",
  agencyRating: "AA",
  issuerType: "SOVEREIGN",
  issuerName: "US TREASURY",
};

let passed = 0;

function isoBefore(ms) {
  return new Date(Date.parse(FIXED_EVALUATED_AT) - ms).toISOString();
}

function makeEvidence(field, claimValue, overrides = {}) {
  return {
    evidence_id: `evidence-${field}-${claimValue}`.replace(/[^a-zA-Z0-9-]/g, "_"),
    source: "custodian-feed",
    attribute: field,
    claim_value: claimValue,
    observed_at: isoBefore(ONE_DAY_MS),
    provenance: "custodian/v1",
    integrity_hash: `hash-${field}`,
    ...overrides,
  };
}

function makeEvidencePackage(overrides = {}) {
  return {
    package_id: "pkg-001",
    collateral_reference: "COLL-001",
    evidence: Object.entries(baseEvidence).map(([field, value]) => makeEvidence(field, value)),
    ...overrides,
  };
}

function makeRequest(overrides = {}) {
  return {
    specification: baseSpecification,
    specification_reference: baseSpecification.id,
    collateral_reference: "COLL-001",
    evidence_package: makeEvidencePackage(),
    ...overrides,
  };
}

function makeResponse(isEligible, matchingEligibleCriteria = []) {
  return {
    result: {
      isEligible,
      matchingEligibleCriteria,
      eligibilityQuery: { ...baseEvidence },
      specification: { ...baseSpecification },
    },
    metadata: {
      provider_name: "Mock CDM Eligibility Provider (TEST/REFERENCE ONLY)",
      cdm_function: CDM_COLLATERAL_ELIGIBILITY_FUNCTION,
      cdm_model_version: "mock-fixture",
      provider_version: "mock-v1",
    },
    verification: {
      verified: true,
      reason: "test_reference_provider",
    },
  };
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

await test("SATISFIED assessment calls provider and preserves lineage", async () => {
  const calls = [];
  const provider = {
    async evaluateEligibility(specification, query) {
      calls.push({ specification, query });
      return makeResponse(true, [
        "criterion-ref-1",
        { identifier: "CRIT-2", reference: "criteria/2" },
      ]);
    },
  };
  const request = makeRequest();
  const original = JSON.parse(JSON.stringify(request));
  const assessment = await evaluateEvidenceBackedCollateralEligibility(request, {
    evaluatedAt: FIXED_EVALUATED_AT,
    provider,
  });

  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].query, baseEvidence);
  assert.equal(assessment.status, "SATISFIED");
  assert.equal(assessment.legacy_status, "eligible");
  assert.deepEqual(assessment.reason_codes, ["CDM_COLLATERAL_ELIGIBLE"]);
  assert.equal(assessment.assessment_type, "CDM_COLLATERAL_ELIGIBILITY");
  assert.equal(assessment.collateral_reference, "COLL-001");
  assert.equal(assessment.specification_reference, "SPEC-001");
  assert.equal(assessment.evidence_package_id, "pkg-001");
  assert.equal(assessment.cdm_function, CDM_COLLATERAL_ELIGIBILITY_FUNCTION);
  assert.equal(assessment.cdm_model_version, "mock-fixture");
  assert.equal(assessment.provider_version, "mock-v1");
  assert.equal(assessment.provider_name, "Mock CDM Eligibility Provider (TEST/REFERENCE ONLY)");
  assert.equal(assessment.evaluated_at, FIXED_EVALUATED_AT);
  assert.deepEqual(assessment.query, baseEvidence);
  assert.equal(assessment.cdm_result_summary?.isEligible, true);
  assert.deepEqual(assessment.cdm_result_summary?.matching_criteria, [
    { reference: "criterion-ref-1" },
    { identifier: "CRIT-2", reference: "criteria/2" },
  ]);
  assert.deepEqual(assessment.evidence_reference_ids, makeEvidencePackage().evidence.map((entry) => entry.evidence_id).sort());
  assert.equal(assessment.rejected_evidence?.length, 0);
  assert.ok(assessment.assessment_id);
  assert.deepEqual(request, original);
});

await test("NOT_SATISFIED assessment maps verified provider false", async () => {
  const provider = {
    async evaluateEligibility() {
      return makeResponse(false, [{ id: "CRIT-9", name: "criteria/9" }]);
    },
  };
  const assessment = await evaluateEvidenceBackedCollateralEligibility(makeRequest(), {
    evaluatedAt: FIXED_EVALUATED_AT,
    provider,
  });

  assert.equal(assessment.status, "NOT_SATISFIED");
  assert.equal(assessment.legacy_status, "ineligible");
  assert.deepEqual(assessment.reason_codes, ["CDM_COLLATERAL_INELIGIBLE"]);
  assert.equal(assessment.cdm_result_summary?.isEligible, false);
  assert.deepEqual(assessment.cdm_result_summary?.matching_criteria, [
    { identifier: "CRIT-9", reference: "criteria/9" },
  ]);
});

await test("NOT_EVALUABLE on missing and invalid evidence never calls provider", async () => {
  const calls = [];
  const provider = {
    async evaluateEligibility() {
      calls.push("called");
      return makeResponse(true);
    },
  };
  const evidence = makeEvidencePackage().evidence.filter((entry) => entry.attribute !== "issuerName");
  evidence.push(makeEvidence("agencyRating", " ", { evidence_id: "blank-claim" }));
  const assessment = await evaluateEvidenceBackedCollateralEligibility(makeRequest({
    evidence_package: makeEvidencePackage({ evidence }),
  }), {
    evaluatedAt: FIXED_EVALUATED_AT,
    provider,
  });

  assert.equal(calls.length, 0);
  assert.equal(assessment.status, "NOT_EVALUABLE");
  assert.equal(assessment.legacy_status, "indeterminate_missing_evidence");
  assert.deepEqual(assessment.reason_codes, [
    "EVIDENCE_INVALID",
    "EVIDENCE_MISSING",
    "EVIDENCE_INSUFFICIENT",
  ]);
  assert.equal(assessment.cdm_model_version, null);
  assert.equal(assessment.provider_version, null);
  assert.equal(assessment.provider_name, null);
  assert.equal(assessment.cdm_result_summary, undefined);
  assert.ok(assessment.rejected_evidence?.some((entry) => entry.evidence_id === "blank-claim"));
});

await test("NOT_EVALUABLE flags stale boundary and future timestamps deterministically", async () => {
  const calls = [];
  const provider = {
    async evaluateEligibility() {
      calls.push("called");
      return makeResponse(true);
    },
  };
  const evidence = makeEvidencePackage().evidence.map((entry) => ({ ...entry }));
  evidence[0].observed_at = isoBefore((30 * ONE_DAY_MS) + 1);
  evidence[1].observed_at = new Date(Date.parse(FIXED_EVALUATED_AT) + 1000).toISOString();
  evidence[2].observed_at = isoBefore(30 * ONE_DAY_MS);
  const assessment = await evaluateEvidenceBackedCollateralEligibility(makeRequest({
    evidence_package: makeEvidencePackage({ evidence }),
  }), {
    evaluatedAt: FIXED_EVALUATED_AT,
    provider,
    evidencePolicy: { max_evidence_age_ms: 30 * ONE_DAY_MS },
  });

  assert.equal(calls.length, 0);
  assert.equal(assessment.status, "NOT_EVALUABLE");
  assert.deepEqual(assessment.reason_codes, [
    "EVIDENCE_INVALID",
    "EVIDENCE_STALE",
    "EVIDENCE_MISSING",
    "EVIDENCE_INSUFFICIENT",
  ]);
  assert.deepEqual(assessment.stale_fields, ["maturity"]);
  assert.deepEqual(assessment.invalid_fields, ["collateralAssetType"]);
  assert.ok(!assessment.stale_fields.includes("assetCountryOfOrigin"));
});

await test("MANUAL_REVIEW on conflicting evidence, duplicate IDs, and collateral mismatch never calls provider", async () => {
  const calls = [];
  const provider = {
    async evaluateEligibility() {
      calls.push("called");
      return makeResponse(true);
    },
  };
  const evidence = makeEvidencePackage().evidence.map((entry) => ({ ...entry }));
  evidence.push(makeEvidence("agencyRating", "BBB", { evidence_id: "conflict-rating" }));
  evidence.push(makeEvidence("issuerType", "SOVEREIGN", { evidence_id: evidence.find((entry) => entry.attribute === "issuerType").evidence_id }));
  const assessment = await evaluateEvidenceBackedCollateralEligibility(makeRequest({
    evidence_package: makeEvidencePackage({
      collateral_reference: "COLL-999",
      evidence,
    }),
  }), {
    evaluatedAt: FIXED_EVALUATED_AT,
    provider,
  });

  assert.equal(calls.length, 0);
  assert.equal(assessment.status, "MANUAL_REVIEW");
  assert.equal(assessment.legacy_status, "indeterminate_conflicting_evidence");
  assert.deepEqual(assessment.reason_codes, [
    "COLLATERAL_REFERENCE_MISMATCH",
    "EVIDENCE_DUPLICATE_ID",
    "EVIDENCE_CONFLICT",
    "MANUAL_REVIEW_REQUIRED",
  ]);
  assert.deepEqual(assessment.conflicting_fields, ["agencyRating", "issuerType"]);
});

await test("NOT_EVALUABLE when provider is absent or throws configuration/runtime errors", async () => {
  const unconfigured = await evaluateEvidenceBackedCollateralEligibility(makeRequest(), {
    evaluatedAt: FIXED_EVALUATED_AT,
    provider: null,
  });
  assert.equal(unconfigured.status, "NOT_EVALUABLE");
  assert.deepEqual(unconfigured.reason_codes, [
    "CDM_EVALUATION_UNAVAILABLE",
    "PROVIDER_NOT_CONFIGURED",
  ]);

  const thrown = await evaluateEvidenceBackedCollateralEligibility(makeRequest(), {
    evaluatedAt: FIXED_EVALUATED_AT,
    providerFactory() {
      throw new CdmEligibilityProviderError("invalid_provider_configuration", "bad config");
    },
  });
  assert.equal(thrown.status, "NOT_EVALUABLE");
  assert.deepEqual(thrown.reason_codes, [
    "CDM_EVALUATION_UNAVAILABLE",
    "PROVIDER_CONFIGURATION_ERROR",
  ]);
});

await test("NOT_EVALUABLE on invalid or unverified provider responses", async () => {
  const invalidResponse = await evaluateEvidenceBackedCollateralEligibility(makeRequest(), {
    evaluatedAt: FIXED_EVALUATED_AT,
    provider: {
      async evaluateEligibility() {
        return {
          ...makeResponse(true),
          verification: { verified: false, reason: "signature-mismatch" },
        };
      },
    },
  });
  assert.equal(invalidResponse.status, "NOT_EVALUABLE");
  assert.deepEqual(invalidResponse.reason_codes, [
    "CDM_EVALUATION_UNAVAILABLE",
    "PROVIDER_RESPONSE_UNVERIFIED",
  ]);

  const mismatchedQuery = await evaluateEvidenceBackedCollateralEligibility(makeRequest(), {
    evaluatedAt: FIXED_EVALUATED_AT,
    provider: {
      async evaluateEligibility() {
        const response = makeResponse(true);
        response.result.eligibilityQuery.issuerName = "OTHER";
        return response;
      },
    },
  });
  assert.equal(mismatchedQuery.status, "NOT_EVALUABLE");
  assert.deepEqual(mismatchedQuery.reason_codes, [
    "CDM_EVALUATION_UNAVAILABLE",
    "PROVIDER_RESPONSE_INVALID",
  ]);
});

await test("specification reference-only requests need a resolver and deterministic replay keeps IDs stable", async () => {
  const request = makeRequest({
    specification: undefined,
  });
  const unresolved = await evaluateEvidenceBackedCollateralEligibility(request, {
    evaluatedAt: FIXED_EVALUATED_AT,
    provider: {
      async evaluateEligibility() {
        throw new Error("should not be called");
      },
    },
  });
  assert.equal(unresolved.status, "NOT_EVALUABLE");
  assert.deepEqual(unresolved.reason_codes, [
    "EVIDENCE_INSUFFICIENT",
    "SPECIFICATION_UNRESOLVED",
  ]);

  const provider = {
    async evaluateEligibility() {
      return makeResponse(true);
    },
  };
  const resolvedOnce = await evaluateEvidenceBackedCollateralEligibility(request, {
    evaluatedAt: FIXED_EVALUATED_AT,
    specificationResolver: () => ({ ...baseSpecification }),
    provider,
  });
  const resolvedTwice = await evaluateEvidenceBackedCollateralEligibility(request, {
    evaluatedAt: FIXED_EVALUATED_AT,
    specificationResolver: () => ({ ...baseSpecification }),
    provider,
  });
  assert.equal(resolvedOnce.assessment_id, resolvedTwice.assessment_id);
  assert.deepEqual(resolvedOnce.reason_codes, resolvedTwice.reason_codes);
});

if (!process.exitCode) {
  console.log(`CDM assessment tests passed (${passed} cases)`);
}
