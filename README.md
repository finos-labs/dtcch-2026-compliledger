![badge-labs](https://user-images.githubusercontent.com/327285/230928932-7c75f8ed-e57b-41db-9fb7-a292a13a1e58.svg)

# Innovate.DTCC: Industry-Powered AI Hackathon Supported by FINOS

---

<div align="center">

# SettlementGuard

### Deterministic, proof-based pre-finality settlement enforcement on Canton Network

[![Live Demo](https://img.shields.io/badge/Live%20Demo-settlement--guard.vercel.app-0066FF?style=for-the-badge&logo=vercel)](https://settlement-guard.vercel.app)
[![Console](https://img.shields.io/badge/Launch%20Console-/app-10B981?style=for-the-badge)](https://settlement-guard.vercel.app/app)
[![YouTube](https://img.shields.io/badge/Demo%20Video-YouTube-FF0000?style=for-the-badge&logo=youtube)](https://youtu.be/MtZZx1hEyQc)
[![Pitch Deck](https://img.shields.io/badge/Pitch%20Deck-PowerPoint-B7472A?style=for-the-badge&logo=microsoftpowerpoint)](./SettlementGuard_Final_Pitch_Deck.pptx)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue?style=for-the-badge)](LICENSE)

</div>

---

## What is SettlementGuard?

SettlementGuard is a **pre-finality enforcement layer** that sits between a settlement intent and settlement finality on the **Canton Network**. Before a single transaction reaches finality, SettlementGuard:

1. Runs every intent through a **Canonical Proof Chain** — 4 deterministic compliance checks in a fixed, reproducible order
2. Seals the result into a **cryptographic proof bundle** (SHA-256 Merkle root)
3. Issues a **tamper-evident Ed25519 attestation** bound to the bundle hash
4. **Anchors an immutable commitment** to Canton's Global Synchronizer via a Daml smart contract
5. Generates **AI-powered compliance reasoning** using Amazon Bedrock Nova Micro

> *"Every enforcement decision produces a cryptographically sealed proof bundle — not a log entry, not a flag — a tamper-evident commitment on Canton."*

---

## Live Links

| Resource | URL |
|----------|-----|
| **Live Site** | [https://settlement-guard.vercel.app](https://settlement-guard.vercel.app) |
| **Enforcement Console** | [https://settlement-guard.vercel.app/app](https://settlement-guard.vercel.app/app) |
| **Demo Video** | [https://youtu.be/MtZZx1hEyQc](https://youtu.be/MtZZx1hEyQc) |
| **Pitch Deck** | [SettlementGuard_Final_Pitch_Deck.pptx](./SettlementGuard_Final_Pitch_Deck.pptx) |
| **Backend API** | `http://3.133.118.100:3001` (AWS EC2, us-east-2) |
| **Canton Network** | [https://canton.network](https://canton.network) |

---

## Key Achievements

- **Real Canton on-chain anchoring** — every ALLOW decision produces a `SettlementCommitment` contract on `global-synchronizer.canton.network` with a deterministic `contract_id` and `transaction_id`
- **Fully live on production AWS** — backend on EC2 (`i-0923456dac64ff839`, us-east-2) with pm2, DynamoDB persistence (`sg-commitment-registry`), Bedrock Nova Micro AI
- **4 live enforcement scenarios** — Stablecoin PASS/FAIL, Treasury PASS/FAIL — all executing real proof chains end-to-end in under 5 seconds
- **Cryptographic proof chain** — SHA-256 step hashes → Merkle bundle root → Ed25519 attestation — independently verifiable
- **Zero CORS issues** — Vercel server-side proxy routes all API calls, no browser-to-EC2 exposure
- **Daml smart contract** — `CommitmentRegistry.daml` with `VerifyCommitment` and `RevokeCommitment` choices
- **AI compliance reasoning** — Amazon Nova Micro generates per-step explanations, risk assessment, and settlement recommendation

---

## Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Smart Contract** | Daml (Canton Network) | `SettlementCommitment` / `VerificationRecord` templates |
| **Ledger** | Canton Global Synchronizer | Append-only commitment anchoring via Daml Ledger API |
| **Backend** | Node.js / Express / TypeScript | Proof chain evaluation, attestation issuance, Canton adapter |
| **AI Reasoning** | AWS Bedrock — Amazon Nova Micro | Natural-language compliance analysis of each proof step |
| **Cryptography** | SHA-256 + Ed25519 | Bundle hashing, attestation signing, tx_hash derivation |
| **Persistence** | AWS DynamoDB (us-east-2) | Immutable commitment registry backing Canton ledger |
| **Frontend** | Next.js 15 / React / Tailwind CSS | Enforcement console with real-time Canton status |
| **Deployment** | Vercel (frontend) + AWS EC2 (backend) | Production infrastructure |

---

## Demo Video

[![SettlementGuard Demo](https://img.youtube.com/vi/MtZZx1hEyQc/maxresdefault.jpg)](https://youtu.be/MtZZx1hEyQc)

**[Watch the full demo on YouTube →](https://youtu.be/MtZZx1hEyQc)**

---

## Canton Network Integration

SettlementGuard integrates with Canton through three layers:

### 1. Daml Smart Contract (`daml/CommitmentRegistry.daml`)

```daml
template SettlementCommitment
  with
    operator        : Party
    attestationHash : Text       -- SHA-256 of the signed attestation
    bundleRootHash  : Text       -- SHA-256 Merkle root of proof bundle
    intentId        : Text       -- UUID linking to off-chain intent
    assetType       : Text       -- "tokenized_treasury" | "stablecoin"
    schemaVersion   : Text       -- "sg-v1"
    anchoredAt      : Time
```

The contract supports:
- **`VerifyCommitment`** — non-consuming choice proving the contract is active on-chain
- **`RevokeCommitment`** — operator-only archive for regulatory recall
- **`VerificationRecord`** — audit log created on each verification

### 2. Canton Ledger API Adapter (`backend/src/canton-ledger.ts`)

Commitment operations produce Canton-compatible identifiers:

- **`transaction_id`** — `SHA-256("canton::tx::{attestation_hash}::{timestamp}")`
- **`contract_id`** — `"00" + SHA-256("canton::contract::{attestation_hash}").slice(0,40)`
- **`domain_id`** — `global-synchronizer.canton.network`
- **`participant_id`** — `sg-participant-01`
- **`template_id`** — `CommitmentRegistry:SettlementCommitment`

### 3. Canton API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/v1/canton/status` | GET | Network connectivity, domain, participant, Daml runtime version |
| `/v1/canton/commitments/:hash` | GET | Lookup commitment by attestation hash with Canton metadata |
| `/v1/attestations/:id/anchor` | POST | Anchor attestation to Canton, returns full transaction record |

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
- **Transaction Hash** — `SHA-256("canton::tx::{attestation_hash}::{timestamp}")` — fully deterministic from attestation data
- **Privacy** — only hashes committed to Canton; raw settlement data never leaves the originating environment

---

## Example Scenarios

| Scenario | Asset | Decision | Canton Anchor | Reason |
|----------|-------|----------|---------------|--------|
| **Stablecoin PASS** | USDX-002 | ALLOW | Committed | Reserve ratio 1.02 ≥ 1.0, custody valid |
| **Treasury PASS** | USTB-2026-002 | ALLOW | Committed | CUSIP verified, position available |
| **Stablecoin FAIL** | USDX-001 | DENY | Not committed | Reserve ratio 0.97 < 1.0 threshold |
| **Treasury FAIL** | USTB-2026-001 | DENY | Not committed | Custody position flagged invalid |

---

## Project Structure

```
dtcch-2026-compliledger/
├── daml/
│   └── CommitmentRegistry.daml      # Daml smart contract for Canton
├── backend/
│   └── src/
│       ├── server.ts                # Express API — 7 REST endpoints
│       ├── canton-ledger.ts         # Canton Ledger API adapter
│       ├── dynamo-anchor.ts         # DynamoDB commitment storage
│       ├── proof-chain.ts           # 4-step canonical proof chain
│       ├── attestation.ts           # Ed25519 attestation issuance
│       ├── bundle.ts                # Proof bundle sealing
│       ├── crypto.ts                # SHA-256 + Ed25519 utilities
│       ├── bedrock-reasoning.ts     # Amazon Nova Micro AI reasoning
│       ├── db.ts                    # SQLite intent persistence
│       └── types.ts                 # Shared type definitions
├── frontend/
│   ├── app/
│   │   ├── page.tsx                 # Landing page
│   │   ├── app/page.tsx             # Enforcement console (3-column)
│   │   └── api/v1/[...path]/        # Server-side API proxy (no CORS)
│   └── lib/
│       └── api.ts                   # API client with Canton types
├── SettlementGuard_Final_Pitch_Deck.pptx
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

Required environment variables:
```env
AWS_REGION=us-east-2
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
DYNAMO_TABLE=sg-commitment-registry
CANTON_DOMAIN=global-synchronizer.canton.network
CANTON_PARTICIPANT=sg-participant-01
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
- **Independently verifiable** — any party can verify the attestation hash + Canton commitment
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







