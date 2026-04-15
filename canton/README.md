# SettlementGuard — Canton Integration

On-ledger commitment registry using Daml smart contracts on Canton Network.

## What This Does

When a settlement intent is anchored via `POST /v1/attestations/:id/anchor`, the backend
submits a real `SettlementCommitment` Daml contract to the Canton JSON Ledger API.
The contract is signed by the **submitter** party and optionally countersigned by the
**custodian** via the `AnchorCommitment` choice — producing an immutable `AnchoredCommitment`
that neither party can alter alone.

## Prerequisites

- JDK 17+ (`brew install openjdk@17`)
- DPM (`curl https://get.digitalasset.com/install/install.sh | sh`)

## Local Dev Option A — DPM Sandbox

```bash
# 1. Install DPM (if not already installed)
#    Mac/Linux: curl https://get.digitalasset.com/install/install.sh | sh
#    Then add to PATH: export PATH="$HOME/.dpm/bin:$PATH"

# 2. Build the Daml DAR (compiles to .daml/dist/settlement-guard-1.0.0.dar)
cd canton
dpm build

# 3. Start the Canton sandbox (JSON API on :7575, gRPC on :6866)
dpm sandbox &

# 4. Provision parties, upload DAR, write .env.canton
chmod +x setup-canton.sh
./setup-canton.sh

# 5. Source env + start backend
set -a && source ../backend/.env.canton && set +a
cd ../backend && npm run dev
```

## Local Dev Option B — CN Quickstart LocalNet

For a full multi-participant network with wallet and scan UIs:

```bash
# Clone the quickstart repo and enter it
git clone https://github.com/digital-asset/cn-quickstart
cd cn-quickstart

# Install dependencies and start the full LocalNet stack
make install && make start
```

The JSON Ledger API is then at `http://json-ledger-api.localhost` (port 7575 on some builds).
Set `CANTON_LEDGER_API_URL=http://json-ledger-api.localhost` and run steps 4–5 from Option A.

## Environment Variables

| Variable | Description | Required for Canton |
|---|---|---|
| `CANTON_LEDGER_API_URL` | Canton JSON API base URL (default: `http://localhost:7575`) | Yes |
| `CANTON_SUBMITTER_PARTY` | Party ID for the submitter (from `setup-canton.sh`) | Yes |
| `CANTON_CUSTODIAN_PARTY` | Party ID for the custodian (from `setup-canton.sh`) | Yes |
| `CANTON_PACKAGE_ID` | DAR package hash (from `setup-canton.sh`) | Yes |
| `CANTON_DOMAIN` | Canton synchronizer domain name | No |
| `CANTON_PARTICIPANT` | Participant node identifier | No |

If `CANTON_SUBMITTER_PARTY` or `CANTON_CUSTODIAN_PARTY` are not set, the backend
falls back to DynamoDB/SQLite and the `/v1/canton/status` endpoint reports `not_configured`.

## Daml Contract: `SettlementCommitment`

```
template SettlementCommitment
  signatory: submitter
  observer:  custodian
  fields: intentId, attestationHash, bundleRootHash, assetType, schemaVersion, createdAt

  choice AnchorCommitment (controller: custodian)
    → creates AnchoredCommitment (signatory: submitter + custodian)

  choice Revoke (controller: submitter)
    → archives without anchoring
```

## Production (DevNet / TestNet / MainNet)

1. Get a validator node (self-host or Node-as-a-Service)
2. Upload the DAR via `POST /v2/packages/upload` on your participant
3. Allocate parties via `POST /v2/parties/allocate`
4. Set the env vars above in your ECS task definition
5. The backend will use real Canton transactions — no code changes needed
