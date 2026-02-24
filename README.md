![badge-labs](https://user-images.githubusercontent.com/327285/230928932-7c75f8ed-e57b-41db-9fb7-a292a13a1e58.svg)

# Innovate.DTCC: Industry-Powered AI Hackathon Supported by FINOS

# SettlementGuard

**Deterministic, proof-based settlement enforcement — before finality.**

> Live Demo: [https://settlement-guard.vercel.app](https://settlement-guard.vercel.app)  
> Console: [https://settlement-guard.vercel.app/app](https://settlement-guard.vercel.app/app)

SettlementGuard is a pre-finality enforcement layer that sits between a settlement intent and settlement finality on the **Canton Network**. It deterministically evaluates compliance through a Canonical Proof Chain, issues cryptographically signed attestations, and anchors immutable commitment records to Canton's Global Synchronizer.

---

## Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Smart Contract** | Daml (Canton Network) | `SettlementCommitment` / `VerificationRecord` templates |
| **Ledger** | Canton Global Synchronizer | Append-only commitment anchoring via Daml Ledger API |
| **Backend** | Node.js / Express / TypeScript | Proof chain evaluation, attestation issuance, Canton adapter |
| **AI Reasoning** | AWS Bedrock (Amazon Nova Micro) | Natural-language compliance analysis of proof steps |
| **Cryptography** | SHA-256 + Ed25519 | Bundle hashing, attestation signing, tx_hash derivation |
| **Persistence** | DynamoDB (us-east-2) | Immutable commitment registry backing Canton ledger |
| **Frontend** | Next.js 15 / React / Tailwind CSS | Enforcement console with real-time Canton status |
| **Deployment** | Vercel (frontend) + AWS EC2 (backend) | Production infrastructure |

---

## Canton Network Integration

SettlementGuard integrates with Canton through three layers:

### 1. Daml Smart Contract (`daml/CommitmentRegistry.daml`)

```
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

The adapter wraps commitment operations with Canton-compatible identifiers:

- **`transaction_id`** — SHA-256 derived from attestation hash + timestamp
- **`contract_id`** — deterministic derivation from attestation hash
- **`domain_id`** — `global-synchronizer.canton.network`
- **`participant_id`** — `sg-participant-01`
- **`template_id`** — `CommitmentRegistry:SettlementCommitment`

Each anchor operation produces a full Canton transaction record with workflow tracking.

### 3. Canton Network Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/v1/canton/status` | GET | Network connectivity, domain, participant, Daml runtime version |
| `/v1/canton/commitments/:hash` | GET | Lookup commitment by attestation hash with Canton metadata |
| `/v1/attestations/:id/anchor` | POST | Anchor attestation to Canton, returns full transaction record |

---

## How It Works

```
Settlement System
        ↓
Settlement Intent Submitted
        ↓
SettlementGuard (Canonical Proof Chain)
   1. Issuer Legitimacy
   2. Asset Classification
   3. Custody Conditions
   4. Reserve & Backing Validation
        ↓
Proof Bundle Sealed (SHA-256 root hash)
        ↓
Attestation Signed (Ed25519)
        ↓
Canton Commitment Anchored (Global Synchronizer)
        ↓
AI Compliance Reasoning Generated (Bedrock Nova Micro)
```

### Enforcement Flow

**ALLOW** — all four proof steps pass:
1. Proof bundle sealed with deterministic root hash
2. Ed25519 attestation signed and bound to bundle hash
3. Attestation hash anchored to Canton as `SettlementCommitment`
4. AI generates natural-language compliance reasoning

**DENY** — any proof step fails:
1. No attestation issued
2. No on-chain commitment
3. Settlement blocked deterministically

---

## Canonical Proof Chain

Every settlement intent executes the same ordered, deterministic sequence:

| Step | Check | Inputs |
|------|-------|--------|
| 1 | **Issuer Legitimacy** | Issuer name, jurisdiction, license status |
| 2 | **Asset Classification** | Asset type, regulatory category |
| 3 | **Custody Conditions** | Custodian, segregation status, insurance |
| 4 | **Reserve & Backing** | Reserve ratio, audit date, backing assets |

Each step produces a SHA-256 hash of its normalized inputs. The chain never changes order and produces reproducible results.

---

## Cryptographic Design

- **Bundle Root Hash**: SHA-256 over concatenated proof step hashes
- **Attestation Signature**: Ed25519 over the attestation payload
- **Transaction Hash**: `SHA-256(attestation_hash :: bundle_root_hash :: timestamp)` — cryptographically sound, not a simple encoding
- **On-Chain Data**: Only hashes are committed to Canton. Sensitive settlement data never leaves the originating environment.

---

## AI Compliance Reasoning

SettlementGuard uses **Amazon Bedrock (Amazon Nova Micro)** to generate natural-language analysis:

- **Per-step explanations** — why each proof step passed or failed
- **Risk assessment** — overall risk characterization
- **Recommendation** — actionable next steps
- **Summary** — concise compliance narrative

The AI receives only proof chain results (no raw settlement data), maintaining data minimization.

---

## Project Structure

```
dtcch-2026-compliledger/
├── daml/
│   └── CommitmentRegistry.daml      # Daml smart contract for Canton
├── backend/
│   └── src/
│       ├── server.ts                # Express API server
│       ├── canton-ledger.ts         # Canton Ledger API adapter
│       ├── dynamo-anchor.ts         # DynamoDB commitment storage
│       ├── proof-chain.ts           # 4-step canonical proof chain
│       ├── attestation.ts           # Ed25519 attestation issuance
│       ├── bundle.ts                # Proof bundle sealing
│       ├── crypto.ts                # SHA-256 + Ed25519 utilities
│       ├── bedrock-reasoning.ts     # AI compliance reasoning
│       ├── db.ts                    # SQLite intent persistence
│       └── types.ts                 # Shared type definitions
├── frontend/
│   ├── app/
│   │   ├── page.tsx                 # Landing page
│   │   ├── app/page.tsx             # Enforcement console
│   │   └── api/v1/[...path]/        # Server-side API proxy
│   ├── components/app/
│   │   ├── proof-chain-panel.tsx    # Proof chain visualization
│   │   ├── attestation-panel.tsx    # Attestation display
│   │   ├── anchor-panel.tsx         # Canton anchoring with tx details
│   │   ├── verify-panel.tsx         # Independent verification
│   │   ├── reasoning-panel.tsx      # AI reasoning display
│   │   ├── canton-status.tsx        # Real-time Canton network status
│   │   └── preset-buttons.tsx       # Scenario presets
│   └── lib/
│       └── api.ts                   # API client with Canton types
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
```
AWS_REGION=us-east-2
DYNAMO_TABLE=sg-commitment-registry
CANTON_DOMAIN=global-synchronizer.canton.network
CANTON_PARTICIPANT=sg-participant-01
```

### Frontend

```bash
cd frontend
npm install
BACKEND_API_URL=http://localhost:3001 npm run dev    # Runs on http://localhost:3000
```

---

## Example Scenarios

| Scenario | Asset Type | Decision | Canton Anchor |
|----------|-----------|----------|---------------|
| Treasury PASS | Tokenized Treasury | ALLOW | Committed |
| Treasury FAIL | Tokenized Treasury | DENY | Not committed |
| Stablecoin PASS | Stablecoin | ALLOW | Committed |
| Stablecoin FAIL | Stablecoin | DENY | Not committed |

---

## Architectural Principles

- **Deterministic** — same inputs always produce the same enforcement outcome
- **Pre-finality** — enforcement happens before settlement, not after
- **Proof-based** — every decision backed by cryptographic evidence
- **Privacy-preserving** — only hashes anchored on-chain, no sensitive data
- **Independently verifiable** — any party can verify attestation + on-chain commitment
- **AI-augmented** — natural-language reasoning supplements deterministic proofs

---

## License

Apache 2.0

---

## Team

CompliLedger — Innovate.DTCC Hackathon 2026







