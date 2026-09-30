# Collateral-eligibility architecture

The authoritative collateral-eligibility requirement for this FINOS CDM contribution is pending source validation. No production eligibility determination should be made from the placeholder implementation.

- **A — existing/reference:** `backend/src/rules/{isda,isla,icma}` remain executable independently via the existing registry and routes; these are not repurposed as new authority.
- **B — new contribution:** `backend/src/contributions/finosCdm/collateralEligibility/` provides opaque input ingestion, optional unvalidated mappings, typed source/derived/unavailable facts, structural evidence diagnostics, an isolated rule contract, deterministic unconfigured evaluation and a local trace artifact. No authoritative rule is installed and no production eligibility determination is possible via this skeleton.
- **C — existing CDM integration:** `backend/src/cdm/` retains its provider/evidence path. Its function strings, provider verification and assessments do **not** establish source validation for B.

For local API usage, synthetic example and separate authority versus model-mapping TODOs, see [the contribution README](../backend/src/contributions/finosCdm/collateralEligibility/README.md). No new HTTP route, UI, signing or ledger connection is introduced.
