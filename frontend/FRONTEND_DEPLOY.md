# SettlementGuard — Frontend Deploy & Test Guide

> For the frontend team. Everything needed to run locally, test against the live backend, and deploy to Netlify.

---

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript 5 |
| Styling | TailwindCSS v4 + CSS variables |
| Animation | Motion (Framer Motion v12) + Lenis smooth scroll |
| Icons | Lucide React |
| Deployment | Netlify |

---

## 1. Environment Variables

Copy `.env.example` to `.env.local` and fill in the values:

```bash
cp .env.example .env.local
```

`.env.local` contents:

```env
# Server-side: used by Next.js proxy route and rewrites
BACKEND_API_URL=http://settlementguard-alb-1419322607.us-east-2.elb.amazonaws.com

# Client-side: injected into browser fetch calls as Authorization header
NEXT_PUBLIC_API_BEARER_TOKEN=sg-prod-542a6aae6961accc84e43d00f47918c6
```

> **Note:** `NEXT_PUBLIC_` prefix is required for the token to be available in browser code. `BACKEND_API_URL` is server-side only (safe — never exposed to browser).

---

## 2. Local Development

### Prerequisites

- Node.js 20+
- npm 10+

### Install and run

```bash
cd frontend
npm install
npm run dev
```

App runs at **http://localhost:3000**

| Route | Description |
|---|---|
| `/` | Landing page (static, no auth required) |
| `/app` | Live Enforcement Console (requires backend) |

---

## 3. Test Against the Live Backend

The frontend proxies all `/api/v1/*` calls through Next.js to the backend. In dev, set `BACKEND_API_URL` in `.env.local`. In production it defaults to the ALB.

### Quick smoke test (manual)

1. Open **http://localhost:3000/app**
2. Click **Stablecoin PASS** — should show a 3-column layout with ALLOW decision and anchored commitment
3. Click **Treasury FAIL** — should show DENY, no attestation section
4. Scroll to **OSS Rule Packs** at the bottom — click **Run** on ISDA, ISLA, ICMA individually — each should return PASS with green badge
5. Check the top status bar — **LIVE** indicator should be green and show a Canton Participant ID

### What a healthy run looks like

```
Stablecoin PASS → Decision: ALLOW → Anchor: commitment_id present → AI Reasoning: summary visible
Treasury FAIL   → Decision: DENY  → No attestation section shown
OSS ISDA Run    → PASS (green)
OSS ISLA Run    → PASS (green)
OSS ICMA Run    → PASS (green)
```

### Error states to verify

| Scenario | Expected UI |
|---|---|
| Backend unreachable | Red dismissible banner: "Request failed — check your connection or auth token" |
| Anchor fails (infra) | Inline amber panel: "Anchor unavailable" with error message — no infinite spinner |
| Bedrock unavailable | Attestation section renders normally; AI Reasoning section simply absent (silent degradation) |

---

## 4. Run the Full E2E Test Suite

The backend ships a complete E2E test script. Run it pointing at the live ALB to verify all endpoints the frontend depends on:

```bash
cd ..   # repo root
API_BEARER_TOKEN=sg-prod-542a6aae6961accc84e43d00f47918c6 \
  node backend/scripts/e2e-test.mjs \
  http://settlementguard-alb-1419322607.us-east-2.elb.amazonaws.com
```

### Expected output

```
  passed   70
  skipped  1      ← Bedrock (requires live AWS IAM — expected skip)
  total    71

  All tests passed ✓
```

### What the test script covers

| Section | Tests |
|---|---|
| Health & Info | `/health`, `/v1/public-key`, `/v1/presets`, `/v1/canton/status` |
| Intent Submission | ALLOW/DENY decisions, all 5 validation errors, OSS bundle embed |
| Input Validation | 9 missing/invalid field cases → 400 |
| Proof Chain Integrity | SHA-256 hashes, 4 steps, decision_hash formula |
| Preset Scenarios | All 4 presets + unknown preset → 404 |
| Intent Store | List, get by ID, 404 on unknown |
| Attestation Verify | Valid, tampered decision, tampered timestamp, wrong sig |
| Anchor | Unknown ID → 404, DENY → 400, ALLOW → 200, duplicate → 409 |
| OSS Rule Packs | ISDA / ISLA / ICMA PASS+FAIL cases, invalid pack → 400 |
| Full E2E Flow | Submit → retrieve → verify → anchor |

---

## 5. Deploy to Netlify

### One-time setup

1. Connect the repo to Netlify (root directory: `frontend`)
2. Set **Build command:** `npm run build`
3. Set **Publish directory:** `.next`
4. Add the following **Environment Variables** in Netlify UI → Site Settings → Environment Variables:

| Key | Value |
|---|---|
| `BACKEND_API_URL` | `http://settlementguard-alb-1419322607.us-east-2.elb.amazonaws.com` |
| `NEXT_PUBLIC_API_BEARER_TOKEN` | `sg-prod-542a6aae6961accc84e43d00f47918c6` |

### Re-deploy after code changes

```bash
# From repo root — just push to main
git push origin main
```

Netlify picks up the push automatically and redeploys. Build takes ~60s.

### Manual trigger (Netlify CLI)

```bash
npm install -g netlify-cli
cd frontend
netlify deploy --prod --dir=.next
```

---

## 6. Architecture — How the Frontend Talks to the Backend

```
Browser
  │
  │  fetch("/api/v1/intents/preset/stablecoin-pass")
  ▼
Next.js Route Handler
  frontend/app/api/v1/[...path]/route.ts
  │  Strips /api prefix, forwards all headers (incl. Authorization)
  │
  │  POST http://ALB/v1/intents/preset/stablecoin-pass
  ▼
Backend (AWS ECS Fargate)
  └── SQLite (intents) → DynamoDB (anchor) → SQLite fallback
```

All API logic lives in `frontend/lib/api.ts`. The `authHeaders()` helper reads `NEXT_PUBLIC_API_BEARER_TOKEN` at runtime and injects the `Authorization: Bearer …` header into every authenticated call.

---

## 7. Key Files Reference

| File | Purpose |
|---|---|
| `frontend/lib/api.ts` | All backend API calls + auth header helper |
| `frontend/app/app/page.tsx` | Live Enforcement Console — full interactive UI |
| `frontend/app/api/v1/[...path]/route.ts` | Transparent API proxy to backend |
| `frontend/next.config.ts` | Backend URL config + Next.js rewrites |
| `frontend/components/sg-demo.tsx` | Landing page static proof-chain demo |
| `frontend/app/globals.css` | Design tokens (CSS variables) for light/dark |
| `frontend/.env.example` | Template for all required env vars |

---

## 8. Known Limitations

| Limitation | Detail |
|---|---|
| AI Reasoning | Requires the ECS task role to have `bedrock:InvokeModel` IAM permission. Fails silently in the UI (section not shown) if unavailable. |
| Canton anchoring | No live `CANTON_SUBMITTER`/`CANTON_CUSTODIAN` configured — anchors fall back to DynamoDB → SQLite → synthetic record. Result is always a valid `commitment_id`. |
| SQLite is ephemeral | All intent/audit data resets when the ECS task restarts. DynamoDB is the only durable anchor store. |
| Auth token in browser | `NEXT_PUBLIC_API_BEARER_TOKEN` is visible in browser JS bundles. For production hardening, move auth to a server-side session or edge middleware. |
