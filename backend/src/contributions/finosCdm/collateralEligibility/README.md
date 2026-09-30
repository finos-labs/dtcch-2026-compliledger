# FINOS CDM collateral eligibility contribution (scaffold)

The authoritative collateral-eligibility requirement for this FINOS CDM contribution is pending source validation. No production eligibility determination should be made from the placeholder implementation.

This backend-only namespace is **not** an authoritative eligibility implementation. It does not invoke or register the existing `rules/` packs or `cdm/` provider/evidence service. Its contribution ID is not an authoritative rule ID. The public evaluator has no configured-rule parameter: it always reports `RULE_NOT_CONFIGURED` and `AUTHORITATIVE_RULE_NOT_CONFIGURED`, independently of facts and evidence diagnostics. It never returns an eligibility boolean.

`adaptCollateralInput` accepts an opaque, JSON-compatible `sourceObject`, a caller-owned `sourceReference`, optional `expectedFactRefs`, and optional explicit `mappings` (factRef, dotted sourcePath, mappingId, mappingVersion, status `CALLER_SUPPLIED_UNVALIDATED`). Mappings are **not** a verified FINOS schema. Source paths are resolved only against own object properties; absent/unmapped paths yield `UNAVAILABLE`, not defaults. The source object is snapshotted without changing the caller's input. `SOURCE` facts retain mapping and original observed value. `DERIVED` is a model for future explicitly versioned derivations and input fact references; none are produced today. Attribute names are optional **internal** caller-defined candidates, not FINOS fields or eligibility requirements.

`validateEvidence` checks JSON structure and lineage fields only. A missing list produces `EVIDENCE_MISSING`; rejected entries produce `EVIDENCE_INVALID` diagnostics; accepted entries are `UNVALIDATED` with `EVIDENCE_UNVALIDATED`. A missing timestamp is allowed; parseable timestamps are not freshness checks. Neither provenance supplied by a caller nor transport integrity establishes authenticity, sufficient evidence, or normative validity.

Local usage (synthetic input, not an official CDM example):

```ts
import { assessCollateralEligibility } from "./index";

const artifact = assessCollateralEligibility(
  {
    sourceObject: { arbitrary: { sample: "synthetic" } },
    sourceReference: "synthetic-object-1",
    expectedFactRefs: ["internal.sample", "internal.unknown"],
    mappings: [{
      factRef: "internal.sample",
      sourcePath: "arbitrary.sample",
      mappingId: "test-only-map",
      mappingVersion: "synthetic-v1",
      status: "CALLER_SUPPLIED_UNVALIDATED",
    }],
  },
  undefined,
  { evaluatedAt: "2026-09-30T12:00:00.000Z" }
);
// artifact.evaluation.decision === "RULE_NOT_CONFIGURED"
```

The assessment contains a snapshot of the source object/reference, mappings, facts and field paths, validated evidence and diagnostics, pending source-validation state, explicit evaluation time, null rule identity, decision and structured reasons. It is a **local trace**, not signed proof, a content hash, or proof of truth/compliance. The caller supplies the evaluation time; output order is deterministic for identical inputs. Rejected malformed evidence is represented by diagnostics, never manufactured as authentic evidence.

## Future installation gate — not yet met

There is deliberately no runtime installation API, environment switch, route, auto-discovery, or production rule implementation. The private type brand distinguishes the future `CollateralEligibilityRule` from legacy Rule/provider types; installing one requires a reviewed code change to this boundary. Static dependency tests guard the current import/re-export graph and supported route dispatch, not arbitrary deliberate future changes. A future review must establish:

- **Authority TODO:** identify and validate the exact authoritative source, provision and version, applicability, necessary facts and evidence obligations, eligibility semantics and reason codes; add source-grounded fixtures, review the implementation and its installation before any production determination.
- **Mapping TODO (independent):** select and verify the applicable primary FINOS CDM model version, object path and field mappings; record exact model origins and tests. No CDM field mapping is asserted here.

Existing/reference ISDA/ISLA/ICMA rules remain independently runnable in `backend/src/rules/`. The pre-existing `backend/src/cdm/` provider/evidence integration is also independently executable; its provider names, verified transport and output do **not** establish source validation for this new contribution.
