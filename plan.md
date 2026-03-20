# SettlementGuard — 2-Day Hackathon Development Plan

## Overview
**SettlementGuard** is a compliance-native settlement enforcement primitive for tokenized markets.
It introduces a deterministic Canonical Proof Chain that executes before settlement and produces a Single Source of Proof.

Built for the DTCC Industry-Powered Hackathon on Canton Network.

---

## Architecture

### Off-Chain (Node.js/Express backend)
- Intent API
- Canonical Proof Chain Engine
- Proof Bundle Sealing
- Decision Engine
- Attestation Service (Ed25519)
- Verification Service
- Canton Adapter
- SQLite persistence (demo-grade)

### On-Chain (Canton Network)
- Minimal append-only Commitment Registry
- Stores: bundle_root_hash, attestation_hash, issued_at, schema_version

### Frontend (Next.js 16 + Tailwind v4 + Motion)
- Landing page (already built)
- App page with 4 preset demo buttons
- Proof chain result display
- Attestation + signature display
- Anchor button (ALLOW only)
- Verification panel

---

## Day 1 — Core Enforcement + Attestation

### Backend (Node.js + Express + TypeScript)
- [ ] Project scaffolding (package.json, tsconfig, etc.)
- [ ] POST /v1/intents — validate, canonical serialize, compute intent_hash, persist
- [ ] Canonical Proof Chain Engine (4 steps, strict order)
  - issuer_legitimacy
  - asset_classification
  - custody_conditions
  - backing_reserve
- [ ] Proof Bundle Sealing — bundle_version, steps, intent_hash, received_at → bundle_root_hash
- [ ] Decision Engine — ALLOW if all pass, else DENY; compute decision_hash
- [ ] Attestation Service — Ed25519 sign, only on ALLOW
- [ ] POST /v1/verify — recompute attestation_hash, verify signature, confirm bundle exists
- [ ] 4 demo presets endpoint

### Frontend
- [x] Landing page template (done)
- [ ] /app route with demo interaction page
  - 4 preset buttons (Treasury FAIL, Stablecoin FAIL, Treasury PASS, Stablecoin PASS)
  - Proof chain step-by-step display
  - Decision display (large)
  - bundle_root_hash display
  - Attestation JSON + signature display
  - Verify section (paste JSON + signature → VALID/INVALID)

### Canton Prep
- [ ] Deploy minimal contract skeleton
- [ ] Confirm recordCommitment + retrieve work

### Day 1 Deliverable
All 4 scenarios work off-chain. Attestation issued for ALLOW. Signature verification works.

---

## Day 2 — Canton Anchoring + Finalization

### Backend
- [ ] POST /v1/attestations/:id/anchor — load attestation, call Canton, persist commitment_id + tx_hash
- [ ] Extend POST /v1/verify with check_chain flag → query Canton for on-chain confirmation

### Frontend
- [ ] "Anchor on Canton" button (visible only if ALLOW)
- [ ] Show commitment_id, tx_hash, "Anchored ✓"
- [ ] Verify screen: checkbox "Verify on-chain"

### Canton
- [ ] Final contract deploy with recordCommitment(bundle_root_hash, attestation_hash, issued_at, asset_type)
- [ ] Confirm retrieval and tx_hash

### Day 2 Deliverable
Treasury PASS anchors on Canton and verifies on-chain.

---

## Demo Flow (must work exactly)
1. Treasury FAIL → DENY
2. Stablecoin FAIL → DENY
3. Treasury PASS → ALLOW → Anchor → Verify on-chain
4. Stablecoin PASS → ALLOW

## Test Matrix
| Scenario | Expected |
|---|---|
| Treasury FAIL | DENY + sealed bundle |
| Stablecoin FAIL | DENY + sealed bundle |
| Treasury PASS | ALLOW + attestation + anchor |
| Stablecoin PASS | ALLOW + attestation |
| Tamper attestation | Verification fails |

## Hard Constraints
- No new features after Day 1
- No architectural refactors Day 2
- No extra proof steps
- No extra cryptographic primitives
- No multi-chain
- Only public/synthetic data
- Open-source license required within 30 days

## Commit Strategy
1. `feat: add SettlementGuard frontend template` — landing page
2. `feat: add backend scaffolding with intent API` — backend foundation
3. `feat: implement canonical proof chain engine` — 4-step enforcement
4. `feat: add bundle sealing and decision engine` — deterministic decisions
5. `feat: add Ed25519 attestation service` — cryptographic attestations
6. `feat: add verification endpoint` — signature + bundle verification
7. `feat: add interactive demo app page` — frontend app integration
8. `feat: add Canton anchoring` — on-chain commitment
9. `feat: add on-chain verification` — full loop
10. `docs: finalize README and demo instructions`
