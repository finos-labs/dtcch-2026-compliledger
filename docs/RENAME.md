# CompliOpen branding and compatibility

CompliOpen is CompliLedger's open-source implementation and contribution
surface. This repository's immediate FINOS/CDM use case is evidence-backed
collateral eligibility; the product is not limited to that use case. The
project originated as SettlementGuard, CompliLedger's DTCC hackathon project.
This rename changes branding only: it does not identify or add an authoritative
FINOS, ISDA, ISLA, or ICMA collateral eligibility rule, change evaluation
behavior, rename the GitHub repository, or migrate infrastructure.

## Retained identities

- **Signed evidence:** `backend/src/attestation.ts` keeps
  `SIGNER_NAME = "SettlementGuard"` because it participates in the canonical
  attestation hash and signature.
- **Ledger and persistence:** Daml modules under `canton/daml/SettlementGuard/`
  and `canton/tests/daml/SettlementGuard/`, their imports, the `settlement-guard`
  and `settlement-guard-tests` package names, DAR filenames, and corresponding
  template IDs remain unchanged. The Daml package names are in
  `canton/daml.yaml` and `canton/tests/daml.yaml`; the corresponding template
  IDs are in `backend/src/canton-ledger.ts`. DAR filename references remain in
  `canton/README.md`, `canton/setup-canton.sh`, and `docs/DEVNET.md`.
  `backend/src/db.ts` keeps `settlementguard.db` so existing local data remains
  accessible.
- **Authentication and audit:** `backend/src/middleware/auth.ts` retains the
  `SG_*` settings, `sg:*` scopes, and `settlementguard-api` JWT audience.
  `backend/src/canton-ledger.ts` retains the Canton JWT issuer
  `settlementguard`. `backend/src/audit/regulatory-log.ts` retains the persisted
  actor `settlementguard-service`. The `SG_*` settings also remain in
  `.env.example`, `backend/.env.example`, `backend/src/crypto.ts`,
  `backend/src/external/`, `backend/src/proof-chain.ts`,
  `backend/src/signing/kms-signer.ts`, and `deploy.sh`; API scope values are
  documented in `README.md`.
- **External integrations:** `settlementguard.io`, `@settlementguard`, the
  existing ALB URL, and AWS ECR/ECS/IAM/log resource identifiers remain as
  legacy external references. Their endpoints and infrastructure have not
  been validated, renamed, or migrated by this branding change.
- **History and legal attribution:** `plan.md`, `archive/canton/`, and
  `SettlementGuard_Final_Pitch_Deck.pptx` remain historical artifacts. The
  footer copyright statement and all repository/frontend licenses, NOTICE,
  copyright, author credits, upstream links, and provenance are preserved.
- **Internal compatibility names:** `SG_*`, `sg:*`, `sg-*` component filenames,
  CSS variables/classes, and storage keys are not renamed.

The remaining SettlementGuard naming references—including the historical name
used in this note itself—are therefore limited to:

- The origin note and preserved Daml path examples in `README.md`.
- The archived implementation in `archive/canton/`, the historical plan in
  `plan.md`, and the original pitch deck filename/content/metadata.
- Signed-evidence, audit, authentication, database, Canton issuer, Daml module,
  package, template, and DAR identities described above, in their source,
  configuration, and documentation paths: `backend/src/attestation.ts`,
  `backend/src/audit/regulatory-log.ts`, `backend/src/canton-ledger.ts`,
  `backend/src/db.ts`, `backend/src/middleware/auth.ts`, `canton/daml.yaml`,
  `canton/tests/daml.yaml`, `canton/daml/SettlementGuard/CommitmentRegistry.daml`,
  and `canton/tests/daml/SettlementGuard/Tests.daml`.
- Legacy external domains, social handles, AWS resource names, and the
  frontend's retained backend proxy targets in `deploy.sh`,
  `frontend/README.md`, `frontend/FRONTEND_DEPLOY.md`,
  `frontend/lib/config.ts`, `frontend/lib/metadata.ts`,
  `frontend/app/api/v1/[...path]/route.ts`, and `frontend/next.config.ts`.
- The retained DAR filename is also shown in `canton/README.md`,
  `canton/setup-canton.sh`, and `docs/DEVNET.md`; the upstream
  `finos/common-domain-model#4684` link remains unchanged in `README.md`.
- The retained frontend copyright statement in
  `frontend/components/sg-footer.tsx`.

These identifiers are compatibility, historical, attribution, or external
references—not current product display names.
