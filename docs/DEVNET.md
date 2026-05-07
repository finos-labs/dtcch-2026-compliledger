# SettlementGuard — Canton Network DevNet Readiness

This document describes the configuration path for running SettlementGuard
against Canton Network **DevNet**, and the verification steps that must pass
before DevNet can be claimed as "live".

> **Status:** the integration shipped in this repo is verified against
> **LocalNet / a configured Canton JSON Ledger API** (DPM sandbox or CN
> Quickstart LocalNet). DevNet is **not** considered live until a
> `SettlementCommitment` Daml contract has been successfully created on a real
> DevNet validator. Setting `CANTON_NETWORK_PROFILE=devnet` alone does not
> change that — it only labels the deployment for status reporting.

## What "DevNet ready" means here

The backend already speaks the Canton JSON Ledger API v2 (see
[`backend/src/canton-ledger.ts`](../backend/src/canton-ledger.ts)). Switching
between LocalNet, DevNet, TestNet, and MainNet is purely a matter of
configuration — there are no hardcoded DevNet endpoints, party IDs, package
IDs, or signing keys in this repo. To go from "ready" to "live" on DevNet you
need:

1. **Validator access.** A DevNet validator node — either self-hosted, or
   provided by a sponsoring **Super Validator** / Node-as-a-Service operator.
   Onboarding credentials (validator URL, OIDC issuer, audience, party hints)
   come from that operator. We do not bundle any DevNet credentials.
2. **DAR upload.** The compiled `settlement-guard-1.0.0.dar` (built with
   `dpm build` in [`canton/`](../canton)) uploaded to your participant via
   `POST /v2/packages/upload`. Record the resulting package hash.
3. **Party allocation.** Submitter and custodian parties allocated via
   `POST /v2/parties/allocate`. Record both party IDs.
4. **JWT signing.** An RS256 keypair where the private key is held by
   SettlementGuard and the public key is registered with your participant's
   OIDC provider. The `sub` claim is a ledger-API user; parties go in
   `actAs` / `readAs` only — never in `sub`.
5. **Environment configuration.** All of the variables in the table below
   populated in the deployment environment.
6. **End-to-end verification.** `GET /v1/canton/status` reports
   `devnet_ready: true` and a `POST /v1/attestations/:id/anchor` round-trip
   returns a non-empty `canton_transaction.contract_id`.

## Required environment variables for DevNet

| Variable | Purpose |
|---|---|
| `CANTON_NETWORK_PROFILE=devnet` | Marks the deployment as DevNet for status reporting. Allowed values: `localnet`, `devnet`, `testnet`, `mainnet`. |
| `CANTON_LEDGER_API_URL` | HTTPS URL of your DevNet participant's JSON Ledger API. Provided by your validator operator. |
| `CANTON_SUBMITTER_PARTY` | Party ID allocated for the submitter on DevNet. |
| `CANTON_CUSTODIAN_PARTY` | Party ID allocated for the custodian on DevNet. |
| `CANTON_PACKAGE_ID` | DAR package hash returned by `POST /v2/packages/upload`. |
| `CANTON_JWT_PRIVATE_KEY` | RS256 PEM private key used to sign ledger-API JWTs. |
| `CANTON_JWT_AUDIENCE` | JWT audience expected by your participant (e.g. `https://daml.com/ledger-api`). |
| `CANTON_LEDGER_USER` | Ledger-API user (the `sub` claim). Not a Daml party. |
| `CANTON_DOMAIN` | DevNet synchronizer domain (informational). |
| `CANTON_PARTICIPANT` | Your participant node identifier (informational). |

> ⚠️ Do **not** commit any of these values into the repository. They are
> deployment-time secrets that come from your validator operator and your own
> OIDC infrastructure.

## Behavior of `network_profile`

The profile is informational. The same JSON Ledger API client code is used for
every profile; the only difference is which endpoint and credentials are wired
in. Specifically:

- `GET /v1/canton/status` reports `network_profile` and a conservative
  `devnet_ready` boolean.
- `POST /v1/attestations/:id/anchor` echoes `network_profile` in the response
  alongside `network` (`canton-global-synchronizer` when the ledger accepts the
  command, or `dynamo-fallback` when the configured ledger is unreachable and
  the DynamoDB / SQLite fallback handled the anchor).

## When is `devnet_ready: true`?

`/v1/canton/status` only reports `devnet_ready: true` when **all** of the
following hold:

1. `CANTON_NETWORK_PROFILE=devnet` is set explicitly.
2. Every variable in `missing_remote_env` is populated:
   `CANTON_LEDGER_API_URL`, `CANTON_SUBMITTER_PARTY`, `CANTON_CUSTODIAN_PARTY`,
   `CANTON_PACKAGE_ID`, `CANTON_JWT_PRIVATE_KEY`.
3. The configured ledger answers `/livez` successfully.

If any condition fails, the field is `false` — even if Canton is otherwise
reachable. This is intentional: we never want to claim DevNet is live based on
configuration alone.

## Fallback behavior is preserved

The DynamoDB / SQLite commitment fallback is unchanged. If the DevNet
participant is briefly unreachable, the anchor circuit breaker falls back to
the local commitment registry and the response reports
`network: "dynamo-fallback"`. Attestation logic is also unchanged — only the
on-ledger anchoring step is affected by the network profile.
