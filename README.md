![badge-labs](https://user-images.githubusercontent.com/327285/230928932-7c75f8ed-e57b-41db-9fb7-a292a13a1e58.svg)

<div align="center">

# SettlementGuard

### Governance infrastructure for tokenized settlement systems

[![License](https://img.shields.io/badge/License-Apache%202.0-blue?style=for-the-badge)](LICENSE)
[![Algorand](https://img.shields.io/badge/Built%20on-Algorand-000000?style=for-the-badge&logo=algorand)](https://algorand.com)

</div>

---

## What is SettlementGuard?

SettlementGuard is **governance infrastructure** for tokenized settlement systems. It provides deterministic, proof-based enforcement of settlement rules before transactions reach finality.

### Core Capabilities

1. **Canonical Proof Chain** — deterministic compliance evaluation in a fixed, reproducible order
2. **Cryptographic Attestation** — Ed25519-signed proof bundles with SHA-256 Merkle roots
3. **On-Chain Anchoring** — immutable commitment records on Algorand
4. **AI Compliance Reasoning** — natural-language analysis via Amazon Bedrock Nova Micro
5. **State Governance** — (in development) cross-chain state verification and policy enforcement

### Current Implementation

The current MVP runs on **Algorand testnet** with support for:
- Tokenized treasury settlement (T-bills, government securities)
- Stablecoin redemption and transfer
- Reserve ratio validation
- Custody condition verification

> **Origin**: This repository originated from the [DTCC/FINOS Innovate.DTCC Hackathon 2026](https://github.com/finos-labs) prototype. The initial implementation used Canton Network. The production architecture has migrated to Algorand for the settlement rail.

---

## Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Settlement Rail** | Algorand | On-chain commitment anchoring via application calls |
| **Backend** | Node.js / Express / TypeScript | Proof chain evaluation, attestation issuance, Algorand adapter |
| **AI Reasoning** | AWS Bedrock — Amazon Nova Micro | Natural-language compliance analysis of each proof step |
| **Cryptography** | SHA-256 + Ed25519 | Bundle hashing, attestation signing, transaction signing |
| **Frontend** | Next.js 15 / React / Tailwind CSS | Enforcement console with real-time network status |
| **Deployment** | Vercel (frontend) + AWS EC2 (backend) | Production infrastructure |

---

## Architecture

```
Settlement Intent
       ↓
Canonical Proof Chain (4 deterministic steps)
       ↓
Proof Bundle Sealed (SHA-256 Merkle root)
       ↓
Attestation Signed (Ed25519)
       ↓
Algorand Commitment (Application Call)
       ↓
AI Compliance Reasoning (Bedrock Nova Micro)
```

### Algorand Integration

SettlementGuard anchors enforcement decisions to Algorand testnet:

- **Application ID** — smart contract managing commitment records
- **Transaction Type** — application call with attestation hash in note field
- **Confirmed Round** — block height at which commitment was finalized
- **Indexer** — query historical commitments by attestation hash

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/v1/algorand/status` | GET | Network connectivity, node health, current round |
| `/v1/algorand/commitments/:hash` | GET | Lookup commitment by attestation hash |
| `/v1/attestations/:id/anchor` | POST | Anchor attestation to Algorand, returns transaction ID |

---

## How It Works

```
Settlement Intent Submitted
         │
         ▼
┌─────────────────────────────────┐
│     Canonical Proof Chain       │
│  1. Issuer Legitimacy           │
│  2. Asset Classification        │
│  3. Custody Conditions          │
│  4. Reserve & Backing           │
└─────────────────────────────────┘
         │
         ▼
Proof Bundle Sealed (SHA-256 Merkle root)
         │
         ▼
Attestation Signed (Ed25519)
         │
         ▼
Canton Commitment Anchored (Global Synchronizer)
         │
         ▼
AI Compliance Reasoning (Bedrock Nova Micro)
```

**ALLOW** — all four proof steps pass → attestation issued → Canton anchor created → AI reasoning generated

**DENY** — any proof step fails → no attestation → no on-chain commitment → settlement blocked

---

## Canonical Proof Chain

| Step | Check | Key Inputs |
|------|-------|------------|
| 1 | **Issuer Legitimacy** | Issuer name, jurisdiction, license status |
| 2 | **Asset Classification** | Asset type, regulatory category, ruleset |
| 3 | **Custody Conditions** | Custodian, segregation status, encumbrance |
| 4 | **Reserve & Backing** | Reserve ratio (must be ≥ 1.0), audit date, backing assets |

Each step produces a SHA-256 hash of its normalized inputs. The chain never changes order and produces reproducible, independently verifiable results.

---

## Cryptographic Design

- **Bundle Root Hash** — SHA-256 over concatenated proof step hashes
- **Attestation Signature** — Ed25519 over `{bundle_root_hash}:{intent_id}:{issued_at}`
- **Transaction ID** — Algorand transaction hash containing attestation commitment
- **Privacy** — only hashes committed on-chain; raw settlement data never leaves the originating environment

---

## Example Scenarios

| Scenario | Asset | Decision | On-Chain Anchor | Reason |
|----------|-------|----------|-----------------|--------|
| **Stablecoin PASS** | USDX-002 | ALLOW | Committed | Reserve ratio 1.02 ≥ 1.0, custody valid |
| **Treasury PASS** | USTB-2026-002 | ALLOW | Committed | CUSIP verified, position available |
| **Stablecoin FAIL** | USDX-001 | DENY | Not committed | Reserve ratio 0.97 < 1.0 threshold |
| **Treasury FAIL** | USTB-2026-001 | DENY | Not committed | Custody position flagged invalid |

---

## Open-Source Rule Snippet Layer

This repository includes lightweight example rules aligned to three major industry standards:

- **ISDA** — margin sufficiency check (`ISDA_MARGIN_SUFFICIENCY`): verifies that posted collateral value meets or exceeds the required margin threshold.
- **ISLA** — collateral coverage check (`ISLA_COLLATERAL_COVERAGE`): verifies that collateral value covers the loan value after applying a haircut.
- **ICMA** — repo collateral sufficiency check (`ICMA_REPO_COLLATERAL_SUFFICIENCY`): verifies that collateral value covers the purchase price after applying a haircut.

**Important caveats:**

- These are **reference snippets only** — they demonstrate how standards-aligned settlement decisioning can be encoded, not full legal or production-grade rule packs.
- They are intended to illustrate the integration pattern between an industry standard and the SettlementGuard proof chain.
- Advanced rule orchestration, commercial logic, and full standards compliance remain **out of scope** for the open-source layer.

### Demo Evaluation API

The `POST /v1/demo/evaluate` endpoint provides a standalone entry point for testing the OSS rule snippets without submitting a full settlement intent.

**Request body:**

```json
{
  "rule_pack": "ISDA | ISLA | ICMA",
  "payload": { ... }
}
```

**Example: ISDA margin check** (`examples/isda-margin.json`)

```bash
curl -X POST http://localhost:3001/v1/demo/evaluate \
  -H "Content-Type: application/json" \
  -d @examples/isda-margin.json
```

```json
{
  "rule_pack": "ISDA",
  "payload": {
    "required_margin": 100000,
    "posted_collateral_value": 110000
  }
}
```

**Example: ISLA collateral coverage** (`examples/isla-collateral.json`)

```bash
curl -X POST http://localhost:3001/v1/demo/evaluate \
  -H "Content-Type: application/json" \
  -d @examples/isla-collateral.json
```

```json
{
  "rule_pack": "ISLA",
  "payload": {
    "collateral_value": 1050000,
    "loan_value": 1000000,
    "haircut": 0.02
  }
}
```

**Example: ICMA repo collateral sufficiency** (`examples/icma-repo.json`)

```bash
curl -X POST http://localhost:3001/v1/demo/evaluate \
  -H "Content-Type: application/json" \
  -d @examples/icma-repo.json
```

```json
{
  "rule_pack": "ICMA",
  "payload": {
    "purchase_price": 1000000,
    "collateral_value": 1050000,
    "haircut": 0.02
  }
}
```

A passing evaluation returns `"decision": "ALLOW"` with an empty `reason_codes` array. A failing evaluation returns `"decision": "DENY"` with one or more reason codes identifying which rule was not satisfied.

---

## Project Structure

```
settlementguard/
├── archive/
│   └── canton/                      # Original DTCC hackathon Canton implementation
├── backend/
│   └── src/
│       ├── server.ts                # Express API — REST endpoints
│       ├── proof-chain.ts           # 4-step canonical proof chain
│       ├── attestation.ts           # Ed25519 attestation issuance
│       ├── bundle.ts                # Proof bundle sealing
│       ├── crypto.ts                # SHA-256 + Ed25519 utilities
│       ├── bedrock-reasoning.ts     # Amazon Nova Micro AI reasoning
│       ├── db.ts                    # SQLite intent persistence
│       ├── types.ts                 # Shared type definitions
│       ├── engine/
│       │   ├── ossRuleEvaluator.ts  # OSS rule evaluation entry point
│       │   └── ruleRegistry.ts      # Rule pack registry (ISDA, ISLA, ICMA)
│       └── rules/
│           ├── isda/margin.ts       # ISDA margin sufficiency snippet
│           ├── isla/collateral.ts   # ISLA collateral coverage snippet
│           └── icma/repo.ts         # ICMA repo collateral sufficiency snippet
├── examples/
│   ├── isda-margin.json             # Example payload for ISDA margin check
│   ├── isla-collateral.json         # Example payload for ISLA collateral coverage
│   └── icma-repo.json               # Example payload for ICMA repo check
├── frontend/
│   ├── app/
│   │   ├── page.tsx                 # Landing page
│   │   ├── app/page.tsx             # Enforcement console
│   │   └── api/v1/[...path]/        # Server-side API proxy
│   └── lib/
│       └── api.ts                   # API client
├── .env.example                     # Environment variable template
└── README.md
```

---

## Running Locally

### Backend

```bash
cd backend
npm install
npm run build
npm start          # Runs on http://localhost:3001
```

Required environment variables (see `.env.example`):
```env
AWS_REGION=us-east-2
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
BEDROCK_MODEL_ID=us.amazon.nova-micro-v1:0
ALGORAND_ALGOD_SERVER=https://testnet-api.algonode.cloud
ALGORAND_INDEXER_SERVER=https://testnet-idx.algonode.cloud
```

### Frontend

```bash
cd frontend
npm install
BACKEND_API_URL=http://localhost:3001 npm run dev
# Opens at http://localhost:3000
```

---

## Architectural Principles

- **Deterministic** — same inputs always produce the same enforcement outcome
- **Pre-finality** — enforcement happens before settlement becomes irreversible
- **Proof-based** — every decision backed by cryptographic evidence
- **Privacy-preserving** — only hashes anchored on-chain, no sensitive data
- **Independently verifiable** — any party can verify the attestation hash + on-chain commitment
- **AI-augmented** — natural-language reasoning supplements (not replaces) deterministic proofs

---

## Contributing

All FINOS Hackathon projects are [Apache 2.0 licensed](LICENSE) and accept contributions via GitHub pull requests.

Each commit **must** include a DCO sign-off line:

```
Signed-off-by: Satyam-10124 <satyam@compliledger.com>
```

This sign-off means you agree the commit satisfies the [Developer Certificate of Origin (DCO)](https://developercertificate.org/).

To configure git to automatically add the sign-off:
```bash
git config user.name "Satyam-10124"
git config user.email "satyam@compliledger.com"
# Then use -s flag on each commit:
git commit -s -m "your commit message"
```

---

## License

[Apache 2.0](LICENSE)

---

## Team

**CompliLedger** — Innovate.DTCC Hackathon 2026  
Presented in the **Regulatory Compliance & Governance** track  
Slot: 11:25–11:40am ET







