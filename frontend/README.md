<div align="center">

# SettlementGuard

### Proof at Scale

**Compliance-Native Settlement Enforcement for Tokenized Markets**

---

*Deterministic cryptographic proof before finality — at institutional scale.*

[![Next.js](https://img.shields.io/badge/Next.js-16.1-black?style=flat-square&logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=flat-square&logo=typescript)](https://typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.x-06B6D4?style=flat-square&logo=tailwindcss)](https://tailwindcss.com)
[![Motion](https://img.shields.io/badge/Motion-12.x-FF4154?style=flat-square)](https://motion.dev)
[![License: MIT](https://img.shields.io/badge/License-MIT-10B981?style=flat-square)](LICENSE)

</div>

---

## What is SettlementGuard?

SettlementGuard sits at the intersection of financial compliance and cryptographic proof. It is not a settlement system, a custody platform, or a compliance registry.

**It is the enforcement layer that sits between a settlement intent and settlement finality** — and either proves it should proceed, or stops it.

> *SettlementGuard = The last gate before settlement is final.*

### Who It's For

Banks, custodians, stablecoin issuers, tokenized fund platforms, central securities depositories, and regulated digital asset exchanges — organizations for whom a compliance failure at settlement is not an inconvenience, but a systemic event.

---

## The Core Shift

| Category | Traditional Settlement | SettlementGuard |
|:--|:--|:--|
| **Enforcement timing** | Post-trade audit | Pre-finality proof |
| **Compliance method** | Periodic review | Deterministic check |
| **Evidence type** | Manual attestation | Cryptographic proof |
| **Verification** | Trust-based | Independently verifiable |
| **Settlement risk** | Retrospective | Eliminated at source |

---

## Tech Stack

| Layer | Technology | Purpose |
|:--|:--|:--|
| **Framework** | [Next.js 16.1](https://nextjs.org) | App Router, React Server Components, Turbopack |
| **Language** | [TypeScript 5.x](https://typescriptlang.org) | Full type safety across the codebase |
| **Runtime** | [React 19](https://react.dev) | Latest React with Server Components |
| **Styling** | [Tailwind CSS v4](https://tailwindcss.com) | Utility-first CSS with CSS custom properties |
| **Animation** | [Motion 12.x](https://motion.dev) | Production-ready animations (Framer Motion) |
| **Scroll** | [Lenis](https://lenis.darkroom.engineering) | Smooth scrolling with anchor support |
| **Icons** | [Lucide React](https://lucide.dev) | Consistent iconography |
| **Theming** | [next-themes](https://github.com/pacocoursey/next-themes) | Dark/light mode with system detection |

---

## Core Features

### 1. Canonical Proof Chain
Every settlement runs through an identical, ordered sequence of compliance checks: issuer legitimacy, asset classification, custody conditions, and reserve backing. The chain never changes. Results are always reproducible.

### 2. Sealed Proof Bundle
All check results are sealed into a tamper-evident bundle — every input, every decision, every hash. The Single Source of Proof.

### 3. Cryptographic Settlement Attestation
If all checks pass, a digitally signed attestation is issued. Cryptographically bound to the proof bundle — machine-verifiable evidence.

### 4. On-Chain Commitment Anchoring
Proof bundle hash and attestation hash are written to an institutional blockchain. Permanent, tamper-resistant timestamps that any authorized party can independently verify.

### 5. Independent Verification
Paste an attestation JSON and signature — SettlementGuard confirms cryptographic validity, proof bundle existence, and on-chain anchoring. Tampering is immediately detectable.

### 6. Asset-Agnostic Enforcement
Tokenized Treasuries, stablecoins, and real-world assets. Same enforcement structure, same proof chain — only input rules change per asset type.

### 7. Hybrid Architecture
Off-chain proof evaluation in secure enterprise environments. Only cryptographic hashes anchored on-chain. Privacy + tamper-resistance.

### 8. Pre-Finality Enforcement
Acts before settlement becomes irreversible. No proof = no attestation = no settlement.

---

## Frontend Architecture

```
settlementguard/
├── app/
│   ├── globals.css              # SettlementGuard design tokens (emerald/teal)
│   ├── layout.tsx               # Root layout with Geist fonts & providers
│   └── page.tsx                 # Page composition — all sections
│
├── components/
│   ├── sg-header.tsx            # Animated header with scroll-hide behavior
│   ├── sg-hero.tsx              # Hero with parallax & positioning statement
│   ├── sg-features.tsx          # 8 core features in animated card grid
│   ├── sg-comparison.tsx        # Traditional vs SettlementGuard comparison table
│   ├── sg-messages.tsx          # Audience-segmented messaging (tabbed)
│   ├── sg-demo.tsx              # Interactive 4-scenario proof chain demo
│   ├── sg-ui-sections.tsx       # Interface walkthrough (5-step flow)
│   ├── sg-cta-sections.tsx      # Funnel-stage CTAs (top/mid/bottom)
│   ├── sg-language.tsx          # Language guide (use/avoid terminology)
│   ├── sg-faq.tsx               # FAQ accordion with domain-specific Q&A
│   ├── sg-bottom-cta.tsx        # Email capture CTA with gradient
│   ├── sg-footer.tsx            # Footer with branded watermark
│   ├── text-reveal.tsx          # Scroll-driven text reveal animation
│   ├── theme-switch.tsx         # Dark/light mode toggle
│   ├── smooth-scroll.tsx        # Lenis smooth scroll wrapper
│   ├── providers.tsx            # Theme + motion + scroll providers
│   └── skip-to-content.tsx      # Accessibility skip link
│
├── lib/
│   ├── config.ts                # Site configuration & feature flags
│   ├── metadata.ts              # SEO metadata, Open Graph, Twitter Cards
│   └── motion.tsx               # Motion variants, transitions, a11y context
│
└── public/                      # Static assets
```

---

## Demo Scenarios

The interface features four pre-set scenarios that tell a complete compliance story:

| Scenario | Outcome | What Fails | The Story |
|:--|:--|:--|:--|
| **Treasury FAIL** | DENY | Custody invalid | Legitimate issuer blocked without valid custody conditions |
| **Stablecoin FAIL** | DENY | Reserve ratio 0.97 | Insufficient reserves caught pre-settlement, not post-audit |
| **Treasury PASS** | ALLOW | All checks pass | Fully compliant — attestation issued, on-chain anchor available |
| **Stablecoin PASS** | ALLOW | All checks pass | Well-reserved stablecoin clears all four checks |

**The demo closer:** Run Treasury PASS, anchor it on-chain, copy the attestation, edit one character in the JSON, hit Verify. Signature fails. *Proof is deterministic, tamper is detectable, trust is eliminated.*

---

## Quick Start

```bash
# Clone the repository
git clone <repository-url>
cd settlementguard

# Install dependencies
npm install

# Start the development server
npm run dev

# Build for production
npm run build

# Start production server
npm run start
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

---

## Design System

### Color Tokens

SettlementGuard uses a custom emerald/teal palette designed for institutional compliance contexts:

| Token | Light | Dark | Purpose |
|:--|:--|:--|:--|
| `--accent` | `#059669` | `#10B981` | Primary brand / actions |
| `--sg-emerald` | `#059669` | `#10B981` | Enforcement indicators |
| `--sg-teal` | `#0D9488` | `#14B8A6` | Secondary accents |
| `--sg-success` | `#22C55E` | `#4ADE80` | ALLOW / proof passed |
| `--sg-deny` | `#EF4444` | `#F87171` | DENY / proof failed |
| `--background` | `#ffffff` | `#020A07` | Page background |
| `--foreground` | `#0a0a0a` | `#f0fdf4` | Primary text |

### Typography

- **Sans**: Geist Sans — clean, institutional readability
- **Mono**: Geist Mono — hashes, attestation IDs, technical data

### Animation Principles

- **Reduced motion**: All animations respect `prefers-reduced-motion`
- **Scroll-driven**: Text reveal, comparison table, feature cards
- **Staggered entry**: Feature grids, table rows, demo checks
- **Spring physics**: Smooth, natural transitions via Motion

---

## Language Guide

### Use These Words
- **Proof**, not process
- **Enforcement**, not monitoring
- **Deterministic**, not rule-based
- **Attestation**, not approval
- **Sealed bundle**, not report
- **Anchored commitment**, not record
- **Pre-finality**, not pre-settlement

### Avoid These Words
- **Dashboard** — implies observation, not enforcement
- **Registry** — implies record-keeping, not proof production
- **Trust** — SettlementGuard eliminates the need for it
- **Automatic** — undersells deterministic cryptographic precision

### The Single Sentence

> *SettlementGuard enforces compliance before settlement is final — deterministically, cryptographically, at scale.*

---

## Available Scripts

| Command | Description |
|:--|:--|
| `npm run dev` | Start development server (Turbopack) |
| `npm run build` | Production build with type checking |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run lint:fix` | Auto-fix lint issues |
| `npm run format` | Format with Prettier |
| `npm run format:check` | Check formatting |
| `npm run typecheck` | TypeScript type checking |

---

## Configuration

Edit `lib/config.ts` to customize branding and navigation:

```typescript
export const siteConfig = {
  name: "SettlementGuard",
  tagline: "Proof at Scale",
  description: "Compliance-native settlement enforcement for tokenized markets.",
  url: "https://settlementguard.io",
  twitter: "@settlementguard",
  nav: {
    cta: { text: "See the Proof Chain", href: "#demo" },
    signIn: { text: "Verify Attestation", href: "#verification" },
  },
};
```

---

## Performance

- **Zero Layout Shift** — Optimized font loading with `display: swap`
- **Static Generation** — All pages pre-rendered at build time
- **Accessibility** — WCAG 2.1 AA: skip navigation, ARIA labels, keyboard support
- **Reduced Motion** — Full `prefers-reduced-motion` support
- **Dark/Light Mode** — System-aware with smooth transitions
- **SEO** — Complete metadata, Open Graph, Twitter Cards, robots, sitemap

---

## License

MIT

---

<div align="center">

**SettlementGuard** — Proof at Scale

*Compliance-Native Settlement Enforcement for Tokenized Markets*

</div>
