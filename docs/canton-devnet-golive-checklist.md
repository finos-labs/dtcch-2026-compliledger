# Canton DevNet Go-Live Checklist

Use this checklist to track progress toward going live on Canton DevNet. This is documentation only.

## Access / Onboarding
- [ ] DevNet validator access confirmed
- [ ] sponsoring Super Validator / onboarding path confirmed
- [ ] required network/VPN/whitelist access confirmed
- [ ] OIDC/auth token process confirmed

## Deployment
- [ ] DAR built
- [ ] DAR uploaded to DevNet participant
- [ ] CANTON_PACKAGE_ID captured
- [ ] submitter party configured
- [ ] custodian party configured
- [ ] backend env updated

## Validation
- [ ] npm run canton:readiness passes
- [ ] passing intent generated
- [ ] attestation generated
- [ ] anchor endpoint returns DevNet transaction_id
- [ ] anchor endpoint returns DevNet contract_id
- [ ] lookup by attestation hash succeeds

## Public Claim
- [ ] README updated from “DevNet readiness” to “DevNet live” only after successful contract creation
