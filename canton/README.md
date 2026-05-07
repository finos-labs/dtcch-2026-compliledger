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
| `CANTON_NETWORK_PROFILE` | One of `localnet` / `devnet` / `testnet` / `mainnet` (default `localnet`). Informational; does not change submission behavior. See [`docs/DEVNET.md`](../docs/DEVNET.md). | No |

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

The same JSON Ledger API client is used for every Canton deployment target.
The only differences are configuration — endpoints, party IDs, package ID, and
JWT signing material — none of which are hardcoded in this repo.

### Status today

The currently shipped integration is verified against **LocalNet / a configured
Canton JSON Ledger API** (DPM sandbox or CN Quickstart LocalNet). DevNet is
**not** considered live until a `SettlementCommitment` contract is successfully
created on a real DevNet validator.

### DevNet readiness path

1. Obtain a DevNet validator (self-host, or via a sponsoring Super Validator /
   Node-as-a-Service). DevNet onboarding requires credentials from the operator
   running the validator — this repo does not ship with any DevNet endpoints.
2. Upload the DAR to your participant via `POST /v2/packages/upload`.
3. Allocate the submitter and custodian parties via `POST /v2/parties/allocate`.
4. Generate an RS256 JWT signing key and configure the matching public key on
   your participant's OIDC provider (Auth0, Keycloak, etc.).
5. Set the env vars in your deployment (ECS task def, Kubernetes secret, etc.):
   - `CANTON_NETWORK_PROFILE=devnet`
   - `CANTON_LEDGER_API_URL=https://<your-devnet-participant>`
   - `CANTON_SUBMITTER_PARTY=<allocated submitter party id>`
   - `CANTON_CUSTODIAN_PARTY=<allocated custodian party id>`
   - `CANTON_PACKAGE_ID=<DAR package hash>`
   - `CANTON_JWT_PRIVATE_KEY=<RS256 PEM>`
   - `CANTON_JWT_AUDIENCE=<participant audience>`
   - `CANTON_DOMAIN`, `CANTON_PARTICIPANT` for accurate reporting
6. Verify with `GET /v1/canton/status`. The endpoint will only report
   `"devnet_ready": true` when the configured validator answers `/livez` and
   every required env var is populated.
7. Anchor a real intent end-to-end via `POST /v1/attestations/:id/anchor` and
   confirm the response includes a non-empty `canton_transaction.contract_id`.

See [`docs/DEVNET.md`](../docs/DEVNET.md) for the full readiness checklist.

The DynamoDB / SQLite fallback is preserved for every profile — if Canton is
unreachable, anchoring still succeeds via the fallback and `network` is
reported as `dynamo-fallback`.
