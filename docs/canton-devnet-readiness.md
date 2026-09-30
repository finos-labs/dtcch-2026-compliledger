# Canton DevNet Readiness

This document describes the current state of Canton/DAML integration in
CompliOpen, the architecture of the anchoring flow, the steps required to
validate the integration on LocalNet, and the requirements that must be met
before the integration can be considered live on DevNet.

## 1. Current Status

- **CompliOpen includes Canton/DAML commitment contracts.** The DAML model
  defines the `SettlementCommitment` and `AnchoredCommitment` templates used to
  anchor attestations on a Canton ledger.
- **Backend supports Canton JSON Ledger API anchoring.** The backend exposes an
  anchoring adapter that submits commands to a Canton JSON Ledger API endpoint.
- **LocalNet / configured Canton JSON Ledger API anchoring is supported.** When
  the backend is configured against a reachable Canton JSON Ledger API
  (LocalNet or any other configured environment), it can create
  `SettlementCommitment` contracts end-to-end.
- **DevNet is not yet live until a real DevNet contract is created.** The
  integration is implementation-complete but DevNet readiness is only
  considered achieved after a successful contract creation on a DevNet
  validator.

## 2. Architecture

The anchoring flow proceeds as follows:

```
CompliOpen attestation
        │
        ▼
proof hash / signature
        │
        ▼
Canton JSON Ledger API
        │
        ▼
SettlementCommitment Daml contract
        │
        ▼
AnchoredCommitment / commitment lookup
```

1. CompliOpen produces an attestation for a settlement intent.
2. The attestation is reduced to a proof hash and signature.
3. The backend submits a create command to the Canton JSON Ledger API.
4. The ledger creates a `SettlementCommitment` Daml contract.
5. The contract is exposed for lookup as an `AnchoredCommitment`, allowing
   verification by attestation hash.

## 3. LocalNet First

LocalNet validation is a prerequisite for any DevNet work. The full LocalNet
loop must succeed before DevNet onboarding is attempted.

Steps:

1. **Build DAR** – compile the DAML model into a DAR package.
2. **Start Canton LocalNet / CN Quickstart LocalNet** – run a local Canton
   network (e.g. via the Canton Network Quickstart LocalNet).
3. **Upload DAR** – upload the built DAR to the LocalNet participant.
4. **Provision parties** – allocate the submitter and custodian parties used
   by the backend.
5. **Set environment variables** – configure the backend with the LocalNet
   ledger API URL, parties, and package ID (see Section 5).
6. **Submit intent** – submit a settlement intent through the backend.
7. **Anchor attestation** – call
   `POST /v1/attestations/:id/anchor` to anchor the resulting attestation.
8. **Verify contract creation** – confirm a `SettlementCommitment` contract
   was created on LocalNet and is retrievable via commitment lookup by
   attestation hash.

## 4. DevNet Requirements

Once LocalNet has been validated end-to-end, DevNet readiness additionally
requires:

- **DevNet validator access** – an operating DevNet validator that the
  backend can submit commands to.
- **Sponsoring Super Validator / validator onboarding path** – a sponsoring
  Super Validator or an equivalent onboarding path to join the DevNet.
- **Network connectivity / whitelisting where required** – outbound network
  connectivity to the DevNet endpoints, including any IP allow-listing or
  firewall rules required by the validator operator.
- **OIDC / auth configuration if required** – OAuth2/OIDC client setup and
  bearer token issuance, where the DevNet ledger API requires authentication.
- **DevNet JSON Ledger API URL** – the JSON Ledger API endpoint of the DevNet
  participant.
- **Submitter party** – a valid DevNet party identifier used to submit
  commands.
- **Custodian party** – a valid DevNet party identifier acting as the
  custodian on the `SettlementCommitment` contract.
- **Uploaded DAR package ID** – the package ID of the DAR uploaded to the
  DevNet participant.

## 5. Required Environment Variables

The backend reads the following environment variables to configure Canton
anchoring:

| Variable | Description |
| --- | --- |
| `CANTON_LEDGER_API_URL` | Base URL of the Canton JSON Ledger API. |
| `CANTON_SUBMITTER_PARTY` | Party that submits the anchoring command. |
| `CANTON_CUSTODIAN_PARTY` | Custodian party on the `SettlementCommitment`. |
| `CANTON_PACKAGE_ID` | Package ID of the uploaded DAR. |
| `CANTON_AUTH_TOKEN` | Bearer token for the JSON Ledger API (if required). |
| `CANTON_NETWORK` | `localnet` or `devnet`. |
| `CANTON_ANCHORING_ENABLED` | `true` or `false` to toggle anchoring. |

## 6. Success Criteria

DevNet is considered live only when **all** of the following are true:

- The backend can reach the DevNet ledger API.
- `CANTON_PACKAGE_ID` is configured and matches an uploaded DAR on DevNet.
- The configured submitter and custodian parties are valid on DevNet.
- `POST /v1/attestations/:id/anchor` creates a `SettlementCommitment`
  contract on DevNet.
- Contract lookup by attestation hash succeeds against DevNet.

Until every item above is verified, the integration must not be described as
live on DevNet.

## 7. Public Wording

The following exact wording should be used when describing Canton/DAML
anchoring publicly:

> CompliOpen includes a Canton/DAML anchoring adapter and DAML commitment
> contracts. The current implementation supports anchoring to a configured
> Canton JSON Ledger API environment. DevNet readiness is in progress and
> should only be described as live after a successful contract creation on a
> DevNet validator.
