![badge-labs](https://user-images.githubusercontent.com/327285/230928932-7c75f8ed-e57b-41db-9fb7-a292a13a1e58.svg)

<div align="center">

# CompliLedger — SettlementGuard

### Pre-settlement compliance attestation for tokenized settlement systems

[![License](https://img.shields.io/badge/License-Apache%202.0-blue?style=for-the-badge)](LICENSE)
[![Canton](https://img.shields.io/badge/Ledger-Canton%20Network-6C4EE5?style=for-the-badge)](https://canton.network)
[![FINOS](https://img.shields.io/badge/FINOS-Innovate.DTCC%202026-003366?style=for-the-badge)](https://github.com/finos-labs)

</div>

---

## Overview

SettlementGuard is a **pre-settlement compliance attestation module** built by CompliLedger.

It evaluates structured transaction inputs against deterministic, machine-readable rule sets (aligned with ISDA, ISLA, and ICMA) and produces **cryptographically verifiable proof artifacts** representing compliance-related conditions at a specific point in time.

> SettlementGuard does not execute transactions, route orders, or make trading decisions.
> It generates independent, tamper-evident attestations that external systems may use in their own decision-making processes.

---

## Non-Intermediary Design

SettlementGuard is explicitly designed as a **non-intermediary system**:

| | Capability |
|---|---|
| ❌ | Does NOT approve or reject transactions |
| ❌ | Does NOT block, permit, or trigger execution |
| ❌ | Does NOT route, match, or sequence orders |
| ❌ | Does NOT custody assets or sign transactions |
| ✅ | Produces independent compliance attestations only |
| ✅ | Operates outside of execution environments |
| ✅ | Outputs verifiable signals, not instructions |

> SettlementGuard outputs are informational and do not constitute transaction instructions or execution logic.

---

## Core Function

For each submitted transaction scenario ("intent"), SettlementGuard:

1. Evaluates inputs against deterministic rule sets
2. Generates a canonical proof bundle (deterministic JSON)
3. Computes a cryptographic hash (SHA-256 / Merkle root)
4. Produces a signed attestation (Ed25519)
5. Enables independent verification of the result
6. Optionally anchors a commitment hash to a ledger (Canton)

Each evaluation produces a **verifiable compliance state**, not an execution decision.

---

## Evaluation Model

SettlementGuard uses deterministic rule evaluation:

| Result | Meaning |
|---|---|
| `PASS` | All evaluated criteria satisfied |
| `FAIL` | One or more criteria not satisfied |
| `CONDITIONAL` | Partial satisfaction; additional review required |

These values represent **rule evaluation results only**. They do not approve transactions, deny transactions, or influence execution.

In API responses, `decision_type: "evaluation"` accompanies OSS rule evaluation responses (`POST /v1/demo/evaluate`) and `decision_type: "enforcement"` accompanies proof-chain responses (`POST /v1/intents`). This separation is intentional.

---

## Role in the Transaction Lifecycle

SettlementGuard operates **before execution and settlement**, as an independent attestation layer:

```
Transaction Intent
        ↓
SettlementGuard  (evaluate → attest)
        ↓
External System  (decision-making)
        ↓
Execution        (broker-dealer / platform)
        ↓
Clearing & Settlement  (e.g., DTCC)
```

SettlementGuard is **not** part of the execution path.

---

## Alignment with Industry Standards

SettlementGuard rule packs align with established market standards. These standards define market conditions, not execution behavior.

| Standard | Rule Pack | Check |
|---|---|---|
| **ISDA** | `ISDA_MARGIN_SUFFICIENCY` | Counterparty status, margin sufficiency |
| **ISLA** | `ISLA_COLLATERAL_COVERAGE` | Collateral eligibility, coverage ratio |
| **ICMA** | `ICMA_REPO_COLLATERAL_SUFFICIENCY` | Repo collateral, maturity validation |

> These are **reference snippets only** — they demonstrate how standards-aligned settlement decisioning can be encoded, not full legal or production-grade rule packs. Advanced rule orchestration, commercial logic, and full standards compliance remain out of scope for the open-source layer.

---

## Architecture

```
Transaction Intent Submitted
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
Proof Bundle Sealed  (SHA-256 Merkle root)
         │
         ▼
Attestation Signed  (Ed25519)
         │
         ▼
Canton Commitment Anchored  (optional, Global Synchronizer)
         │
         ▼
AI Compliance Reasoning  (optional, AWS Bedrock Nova Micro)
```

### Architecture Highlights

- **Deterministic rule evaluation engine** — same inputs always produce the same result
- **Canonical proof bundle generation** — deterministic JSON, SHA-256 Merkle root
- **Cryptographic attestation** — Ed25519 signature over bundle root hash
- **Independent verification flow** — any party can verify without re-running evaluation
- **Optional ledger anchoring** — Canton JSON Ledger API v2 (`SettlementCommitment` Daml contract)
- **Optional AI reasoning** — non-deterministic, non-decisional, does not affect attestation
- **REST API** — standard HTTP integration

### Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Commitment Rail** | Canton Network — Daml contracts | On-ledger commitment anchoring and lookup |
| **Backend** | Node.js / Express / TypeScript | Proof chain, attestation, Canton + DynamoDB adapter |
| **AI Reasoning** | AWS Bedrock — Amazon Nova Micro | Optional natural-language compliance explanation |
| **Cryptography** | SHA-256 + Ed25519 | Bundle hashing and attestation signing |
| **Frontend** | Next.js 15 / React / Tailwind CSS | Compliance console with real-time network status |
| **Deployment** | AWS ECS (backend) + Vercel (frontend) | Production infrastructure |

---

## Canonical Proof Chain

| Step | Check | Key Inputs |
|---|---|---|
| 1 | **Issuer Legitimacy** | Issuer name, jurisdiction, license status |
| 2 | **Asset Classification** | Asset type, regulatory category, ruleset |
| 3 | **Custody Conditions** | Custodian, segregation status, encumbrance |
| 4 | **Reserve & Backing** | Reserve ratio (must be ≥ 1.0), audit date, backing assets |

Each step produces a SHA-256 hash of its normalized inputs. The chain never changes order and produces reproducible, independently verifiable results.

---

## Cryptographic Design

- **Bundle Root Hash** — SHA-256 over concatenated proof step hashes
- **Attestation Signature** — Ed25519 over `{bundle_root_hash}:{intent_id}:{issued_at}`
- **On-ledger Contract** — Canton `contractId` and `transaction_id` for `SettlementCommitment` / `AnchoredCommitment` records
- **Privacy** — only hashes committed on-chain; raw settlement data never leaves the originating environment

---

## API Reference

| Endpoint | Method | Description |
|---|---|---|
| `/health` | GET | Backend health check |
| `/v1/intents` | POST | Submit a settlement intent for proof evaluation |
| `/v1/intents` | GET | List persisted intent records |
| `/v1/intents/:id` | GET | Fetch a specific intent record |
| `/v1/intents/preset/:presetId` | POST | Run a predefined settlement scenario |
| `/v1/verify` | POST | Verify attestation signature and optional on-chain presence |
| `/v1/attestations/:id/anchor` | POST | Anchor an attestation commitment to Canton |
| `/v1/reasoning/:id` | POST | Generate Bedrock-backed compliance reasoning for an intent |
| `/v1/presets` | GET | List available demo presets |
| `/v1/public-key` | GET | Fetch the active public verification key and metadata |
| `/v1/canton/status` | GET | Canton network / configuration status |
| `/v1/canton/commitments/:attestationHash` | GET | Lookup a commitment by attestation hash |
| `/v1/demo/evaluate` | POST | Evaluate an OSS rule pack independently of the proof chain |

### Example Flow

```bash
# 1. Submit a settlement intent
POST /v1/intents
→ evaluate rule pack
→ generate proof bundle (SHA-256 Merkle root)
→ sign attestation (Ed25519)
→ return result with decision and signed attestation

# 2. Verify independently
POST /v1/verify
→ validate Ed25519 signature
→ validate bundle integrity

# 3. Anchor to Canton (optional, ALLOW results only)
POST /v1/attestations/:id/anchor
→ submit SettlementCommitment Daml contract
→ return canton transaction_id and contract_id
```

---

## Demo Rule Pack API

`POST /v1/demo/evaluate` provides a standalone entry point for testing OSS rule snippets without submitting a full intent.

```json
{ "rule_pack": "ISDA | ISLA | ICMA", "payload": { ... } }
```

**ISDA — margin sufficiency** (`examples/isda-margin.json`)
```json
{ "rule_pack": "ISDA", "payload": { "required_margin": 100000, "posted_collateral_value": 110000 } }
```

**ISLA — collateral coverage** (`examples/isla-collateral.json`)
```json
{ "rule_pack": "ISLA", "payload": { "collateral_value": 1050000, "loan_value": 1000000, "haircut": 0.02 } }
```

**ICMA — repo collateral sufficiency** (`examples/icma-repo.json`)
```json
{ "rule_pack": "ICMA", "payload": { "purchase_price": 1000000, "collateral_value": 1050000, "haircut": 0.02 } }
```

A passing evaluation returns `"decision": "PASS"` with an empty `reason_codes` array. A failing evaluation returns `"decision": "FAIL"` or `"CONDITIONAL"` with one or more reason codes.

---

## Example Scenarios

| Scenario | Asset | Attestation | Commitment | Reason |
|---|---|---|---|---|
| **Stablecoin PASS** | USDX-002 | Issued | Anchored | Reserve ratio 1.02 ≥ 1.0, custody valid |
| **Treasury PASS** | USTB-2026-002 | Issued | Anchored | CUSIP verified, position available |
| **Stablecoin FAIL** | USDX-001 | Not issued | Not anchored | Reserve ratio 0.97 < 1.0 threshold |
| **Treasury FAIL** | USTB-2026-001 | Not issued | Not anchored | Custody position flagged invalid |

---

## Canton Integration

SettlementGuard anchors compliance commitments to Canton using Daml contracts defined in `canton/daml/SettlementGuard/CommitmentRegistry.daml`. The backend calls the Canton JSON Ledger API v2.

- **Submit** — `POST /v2/commands/submit-and-wait` creates a `SettlementCommitment` contract
- **Lookup** — `POST /v2/state/active-contracts` queries active commitments by attestation hash
- **Status** — `GET /livez` and `GET /v2/state/ledger-end` for health and ledger offset

### Canton Environment Variables

| Variable | Description |
|---|---|
| `CANTON_LEDGER_API_URL` | Canton JSON API base URL (default: `http://localhost:7575`) |
| `CANTON_SUBMITTER_PARTY` | Submitter party ID (from `canton/setup-canton.sh`) |
| `CANTON_CUSTODIAN_PARTY` | Custodian party ID (from `canton/setup-canton.sh`) |
| `CANTON_PACKAGE_ID` | DAR package hash (from `canton/setup-canton.sh`) |

If these are not set, anchoring falls back to DynamoDB / SQLite for local operation.

### Local Dev Option A — DPM Sandbox

Prereqs: JDK 17+, DPM (`curl https://get.digitalasset.com/install/install.sh | sh`, then `export PATH="$HOME/.dpm/bin:$PATH"`).

```bash
# Build the Daml DAR
cd canton && dpm build

# Start the Canton sandbox (JSON API on :7575, gRPC on :6866)
dpm sandbox &

# Provision parties, upload DAR, write backend/.env.canton
chmod +x setup-canton.sh && ./setup-canton.sh

# Source env and start backend
set -a && source ../backend/.env.canton && set +a
cd ../backend && npm run dev

# Run end-to-end tests
API_BEARER_TOKEN=... node backend/scripts/e2e-test.mjs http://localhost:3001
```

### Local Dev Option B — CN Quickstart LocalNet

For a full multi-participant network with wallet and scan UIs:

```bash
git clone https://github.com/digital-asset/cn-quickstart
cd cn-quickstart
make install && make start
```

JSON Ledger API: `http://json-ledger-api.localhost` (port 7575 on some builds).
Set `CANTON_LEDGER_API_URL=http://json-ledger-api.localhost` and run the provision/backend steps above.

---

## Running Locally

### Backend

```bash
cd backend
npm install
npm run build
npm start          # http://localhost:3001
```

Required environment variables (see `.env.example`):

```env
SG_SIGNING_SEED_B64=your_base64_32_byte_seed
SG_KEY_ID=sg-demo-key-01
SG_KEY_VERSION=v1
API_BEARER_TOKEN=shared_demo_token
JSON_BODY_LIMIT=32kb
POST_RATE_LIMIT_MAX=60
AWS_REGION=us-east-2
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
BEDROCK_MODEL_ID=us.amazon.nova-micro-v1:0

# Canton JSON Ledger API (set after running canton/setup-canton.sh)
CANTON_LEDGER_API_URL=http://localhost:7575
CANTON_SUBMITTER_PARTY=
CANTON_CUSTODIAN_PARTY=
CANTON_PACKAGE_ID=
CANTON_DOMAIN=global-synchronizer.canton.network
CANTON_PARTICIPANT=sg-participant-01
DYNAMO_TABLE=sg-commitment-registry
```

### Frontend

```bash
cd frontend
npm install
BACKEND_API_URL=http://localhost:3001 npm run dev
# Opens at http://localhost:3000
```

---

## Project Structure

```
dtcch-2026-compliledger/
├── backend/
│   └── src/
│       ├── server.ts                # Express API — all REST endpoints
│       ├── canton-ledger.ts         # Canton JSON Ledger API v2 integration
│       ├── proof-chain.ts           # 4-step canonical proof chain
│       ├── attestation.ts           # Ed25519 attestation issuance
│       ├── bundle.ts                # Proof bundle sealing
│       ├── crypto.ts                # SHA-256 + Ed25519 utilities
│       ├── bedrock-reasoning.ts     # AWS Bedrock Nova Micro AI reasoning
│       ├── dynamo-anchor.ts         # DynamoDB / SQLite fallback persistence
│       ├── db.ts                    # SQLite intent persistence
│       ├── types.ts                 # Shared type definitions
│       ├── engine/
│       │   ├── ossRuleEvaluator.ts  # OSS rule evaluation entry point
│       │   └── ruleRegistry.ts      # Rule pack registry (ISDA, ISLA, ICMA)
│       └── rules/
│           ├── isda/margin.ts       # ISDA margin sufficiency snippet
│           ├── isla/collateral.ts   # ISLA collateral coverage snippet
│           └── icma/repo.ts         # ICMA repo collateral sufficiency snippet
├── canton/
│   ├── daml.yaml                    # DPM project config (SDK 3.4.11)
│   ├── setup-canton.sh              # Provision parties + upload DAR + write .env.canton
│   ├── README.md                    # Canton-specific setup and LocalNet guide
│   └── daml/SettlementGuard/
│       └── CommitmentRegistry.daml  # SettlementCommitment + AnchoredCommitment templates
├── frontend/
│   ├── app/
│   │   ├── page.tsx                 # Landing page
│   │   ├── app/page.tsx             # Compliance console
│   │   └── api/v1/[...path]/        # Server-side API proxy
│   └── lib/
│       └── api.ts                   # API client
├── examples/
│   ├── isda-margin.json             # ISDA margin check example payload
│   ├── isla-collateral.json         # ISLA collateral coverage example payload
│   └── icma-repo.json               # ICMA repo check example payload
├── .env.example                     # Environment variable template
└── README.md
```

---

## AI Reasoning (Optional)

SettlementGuard can optionally generate AI-assisted explanations via `POST /v1/reasoning/:id` (AWS Bedrock, Amazon Nova Micro).

- AI output is **non-deterministic** and **non-decisional**
- It does not affect evaluation results or attestation values
- Requires valid AWS credentials and Bedrock model access

---

## Contributing

All FINOS Hackathon projects are [Apache 2.0 licensed](LICENSE) and accept contributions via GitHub pull requests.

Each commit must include a DCO sign-off:

```
Signed-off-by: Your Name <you@compliledger.com>
```

```bash
git config user.name "Your Name"
git config user.email "you@compliledger.com"
git commit -s -m "your commit message"
```

---

## Disclaimer

This repository is a **reference implementation** intended for demonstration and development purposes.

- Security controls are simplified
- Key management is not production-grade
- Execution systems are not included
- Rule packs are illustrative reference snippets, not legal compliance engines

Production deployments should include:

- Secure key management (KMS / HSM)
- Authentication and authorization controls
- Transactional persistence and audit logging
- Infrastructure hardening and network isolation
- Legal review of rule pack alignment with applicable regulations

---

## License

[Apache 2.0](LICENSE)

---

## Team

**CompliLedger** — Innovate.DTCC Hackathon 2026
Presented in the **Regulatory Compliance & Governance** track
Slot: 11:25–11:40am ET
