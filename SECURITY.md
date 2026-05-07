# Security Policy

## Reference Implementation Notice

**ComplianceLedger (CompliLedger) is a reference implementation** developed for the
DTCC Hackathon 2026. It is intended to demonstrate concepts, architecture, and
integration patterns — **not** to be deployed as-is in a production environment.

Production deployments **must** add, at a minimum:

- **KMS/HSM-backed key management** for all signing, encryption, and DAML party
  keys (no plaintext keys on disk or in environment variables).
- **Full authentication and role-based access control (RBAC)** across all
  services, APIs, and UIs (no anonymous or shared-credential access).
- **Comprehensive logging, monitoring, and audit trails** with tamper-evident
  storage and alerting on security-relevant events.
- **Infrastructure hardening**, including network segmentation, TLS everywhere,
  least-privilege IAM, secrets management, dependency scanning, container
  image scanning, and regular patching.
- **Data protection** controls appropriate to the regulatory regime (encryption
  at rest and in transit, retention policies, PII minimization).
- **Independent security review and penetration testing** before any production
  use.

## Supported Versions

This project is an active hackathon / research codebase. Only the latest commit
on the default branch (`main`) is supported. Older branches, tags, forks, and
archived directories (e.g. `archive/`) receive **no** security updates.

| Version            | Supported |
|--------------------|-----------|
| `main` (latest)    | ✅        |
| All other branches | ❌        |
| Tagged releases    | ❌        |
| `archive/*`        | ❌        |

## Reporting a Vulnerability

We take security issues seriously and appreciate responsible disclosure.

**Please do not report security vulnerabilities through public GitHub issues,
discussions, or pull requests.**

Instead, report them privately using one of the following channels:

1. **GitHub Private Vulnerability Reporting** (preferred):
   Open a private report via the repository's
   [Security Advisories](https://github.com/finos-labs/dtcch-2026-compliledger/security/advisories/new)
   page. This keeps the report confidential and gives maintainers a private
   workspace to triage and coordinate a fix.

2. **FINOS security process**: As a FINOS Labs project, this repository also
   falls under the FINOS security and disclosure process. See
   <https://www.finos.org/security> for details.

When reporting, please include as much of the following as you can:

- A clear description of the issue and its potential impact.
- Steps to reproduce, including affected commit SHA, configuration, and
  environment.
- Proof-of-concept code, logs, or screenshots, if applicable.
- Any suggested mitigation or fix.
- Whether you would like to be credited in the advisory.

## Disclosure Process

Our responsible disclosure process is:

1. **Acknowledgement** — We aim to acknowledge new reports within a reasonable
   timeframe after they are received via one of the channels above.
2. **Triage** — Maintainers validate the report, determine severity, and
   identify affected components and versions.
3. **Remediation** — A fix is developed in a private branch or advisory
   workspace. For non-trivial issues we may request additional information
   from the reporter.
4. **Coordinated disclosure** — Once a fix is ready, we publish a security
   advisory describing the issue, affected versions, mitigations, and
   credits (where the reporter has consented). The fix is then merged to
   `main`.
5. **Public disclosure** — Please give maintainers a reasonable opportunity
   to remediate before any public disclosure. We will work with you to agree
   on a disclosure timeline.

## Scope

In scope:

- Source code in this repository on the `main` branch.
- Build, deployment, and CI configuration committed to this repository.

Out of scope:

- Third-party dependencies (please report upstream; we will update once a fix
  is available).
- Issues that require a compromised host, browser, or developer machine.
- Findings that only apply to the reference implementation's intentional
  simplifications (e.g. demo credentials, in-memory stores, simplified
  security controls). These are documented limitations of a reference
  implementation, not vulnerabilities — but reports that highlight risks
  for downstream adopters are still welcome.

## Thank You

Thank you for helping keep ComplianceLedger and its users safe.
