"use client";

import { useState, useRef, type ReactNode } from "react";
import { motion, AnimatePresence, useInView } from "motion/react";
import Link from "next/link";
import {
  CheckCircle2,
  XCircle,
  Anchor,
  FileCheck,
  Play,
} from "lucide-react";
import { SGLogo } from "./sg-logo";

interface Scenario {
  id: string;
  name: string;
  assetType: string;
  outcome: "ALLOW" | "DENY";
  failReason: string | null;
  story: string;
  checks: {
    name: string;
    passed: boolean;
    detail: string;
  }[];
}

const scenarios: Scenario[] = [
  {
    id: "treasury-fail",
    name: "Treasury FAIL",
    assetType: "Tokenized Treasury",
    outcome: "DENY",
    failReason: "Custody invalid",
    story:
      "Even a legitimate issuer with proper classification cannot settle without valid custody conditions.",
    checks: [
      {
        name: "Issuer Legitimacy",
        passed: true,
        detail: "Verified: US Treasury issuer recognized",
      },
      {
        name: "Asset Classification",
        passed: true,
        detail: "Classified: Tokenized Government Bond",
      },
      {
        name: "Custody Conditions",
        passed: false,
        detail: "FAILED: Custody certificate expired",
      },
      {
        name: "Backing & Reserve",
        passed: true,
        detail: "Reserve ratio: 1.00",
      },
    ],
  },
  {
    id: "stablecoin-fail",
    name: "Stablecoin FAIL",
    assetType: "Stablecoin",
    outcome: "DENY",
    failReason: "Reserve ratio 0.97",
    story:
      "A stablecoin with insufficient reserves is blocked before settlement — not discovered in a post-trade audit.",
    checks: [
      {
        name: "Issuer Legitimacy",
        passed: true,
        detail: "Verified: Licensed stablecoin issuer",
      },
      {
        name: "Asset Classification",
        passed: true,
        detail: "Classified: Fiat-backed Stablecoin",
      },
      {
        name: "Custody Conditions",
        passed: true,
        detail: "Valid: Segregated custody confirmed",
      },
      {
        name: "Backing & Reserve",
        passed: false,
        detail: "FAILED: Reserve ratio 0.97 < 1.00 minimum",
      },
    ],
  },
  {
    id: "treasury-pass",
    name: "Treasury PASS",
    assetType: "Tokenized Treasury",
    outcome: "ALLOW",
    failReason: null,
    story:
      "A fully compliant tokenized Treasury receives an attestation, anchors on-chain, and is independently verifiable.",
    checks: [
      {
        name: "Issuer Legitimacy",
        passed: true,
        detail: "Verified: US Treasury issuer recognized",
      },
      {
        name: "Asset Classification",
        passed: true,
        detail: "Classified: Tokenized Government Bond",
      },
      {
        name: "Custody Conditions",
        passed: true,
        detail: "Valid: Qualified custodian confirmed",
      },
      {
        name: "Backing & Reserve",
        passed: true,
        detail: "Reserve ratio: 1.00",
      },
    ],
  },
  {
    id: "stablecoin-pass",
    name: "Stablecoin PASS",
    assetType: "Stablecoin",
    outcome: "ALLOW",
    failReason: null,
    story:
      "A well-reserved stablecoin clears all four checks and receives a signed settlement attestation.",
    checks: [
      {
        name: "Issuer Legitimacy",
        passed: true,
        detail: "Verified: Licensed stablecoin issuer",
      },
      {
        name: "Asset Classification",
        passed: true,
        detail: "Classified: Fiat-backed Stablecoin",
      },
      {
        name: "Custody Conditions",
        passed: true,
        detail: "Valid: Segregated custody confirmed",
      },
      {
        name: "Backing & Reserve",
        passed: true,
        detail: "Reserve ratio: 1.02",
      },
    ],
  },
];

function ProofChainAnimation({
  scenario,
}: {
  scenario: Scenario;
}): ReactNode {
  return (
    <div className="space-y-3">
      {scenario.checks.map((check, i) => (
        <motion.div
          key={check.name}
          className={`flex items-start gap-3 rounded-xl p-4 ${
            check.passed
              ? "bg-sg-success/5 border border-sg-success/10"
              : "bg-sg-deny/5 border border-sg-deny/10"
          }`}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{
            duration: 0.4,
            delay: i * 0.15,
            ease: [0.25, 0.46, 0.45, 0.94],
          }}
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.3, delay: i * 0.15 + 0.2 }}
          >
            {check.passed ? (
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-sg-success" />
            ) : (
              <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-sg-deny" />
            )}
          </motion.div>
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground">{check.name}</p>
            <p
              className={`mt-1 font-mono text-xs ${
                check.passed ? "text-sg-success/80" : "text-sg-deny/80"
              }`}
            >
              {check.detail}
            </p>
          </div>
        </motion.div>
      ))}

      <motion.div
        className={`mt-4 flex items-center gap-3 rounded-xl p-4 ${
          scenario.outcome === "ALLOW"
            ? "bg-accent/10 border border-accent/20"
            : "bg-sg-deny/10 border border-sg-deny/20"
        }`}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, delay: 0.8 }}
      >
        {scenario.outcome === "ALLOW" ? (
          <SGLogo className="h-6 w-6 text-accent" />
        ) : (
          <XCircle className="h-6 w-6 text-sg-deny" />
        )}
        <div>
          <p
            className={`text-lg font-semibold ${
              scenario.outcome === "ALLOW"
                ? "text-accent"
                : "text-sg-deny"
            }`}
          >
            {scenario.outcome === "ALLOW"
              ? "ALLOW — Attestation Issued"
              : `DENY — ${scenario.failReason}`}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {scenario.outcome === "ALLOW"
              ? "Cryptographically signed attestation generated. Ready for on-chain anchoring."
              : "No attestation issued. Settlement blocked at pre-finality."}
          </p>
        </div>
      </motion.div>

      {scenario.outcome === "ALLOW" && (
        <motion.div
          className="flex items-center gap-3 rounded-xl border border-foreground/5 bg-muted/30 p-4"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 1.1 }}
        >
          <Anchor className="h-5 w-5 text-sg-teal" />
          <div>
            <p className="text-sm font-medium text-foreground">
              On-Chain Anchor Available
            </p>
            <p className="mt-0.5 font-mono text-xs text-muted-foreground">
              Bundle hash: 0x7f3a...c4e2 | Attestation hash: 0x9b1d...a8f7
            </p>
          </div>
        </motion.div>
      )}
    </div>
  );
}

export function SGDemo(): ReactNode {
  const [activeId, setActiveId] = useState("treasury-pass");
  const [animKey, setAnimKey] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const active = scenarios.find((s) => s.id === activeId) ?? scenarios[0]!;

  const selectScenario = (id: string) => {
    setActiveId(id);
    setAnimKey((k) => k + 1);
  };

  return (
    <section id="demo" className="px-4 py-20 sm:px-6 md:py-28 lg:px-8">
      <div className="mx-auto max-w-7xl" ref={ref}>
        <div className="mb-16 max-w-3xl">
          <motion.p
            className="text-sm font-medium uppercase tracking-wider text-accent"
            initial={{ opacity: 0, y: 10 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.4 }}
          >
            Live Demo
          </motion.p>
          <motion.h2
            className="mt-4 text-3xl font-medium tracking-tight text-foreground md:text-4xl lg:text-5xl"
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            See enforcement in action
          </motion.h2>
          <motion.p
            className="mt-4 max-w-xl text-lg text-muted-foreground"
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            Four scenarios that tell a complete compliance story. Select a
            scenario and watch the Canonical Proof Chain evaluate in real time.
          </motion.p>
        </div>

        <div className="grid gap-8 lg:grid-cols-12 lg:gap-12">
          <div className="lg:col-span-5">
            <p className="mb-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Select Scenario
            </p>
            <div className="grid grid-cols-2 gap-3">
              {scenarios.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => selectScenario(s.id)}
                  className={`group flex cursor-pointer flex-col items-start gap-2 rounded-xl p-4 text-left transition-all duration-200 ${
                    s.id === activeId
                      ? s.outcome === "ALLOW"
                        ? "bg-accent/10 border border-accent/25"
                        : "bg-sg-deny/10 border border-sg-deny/25"
                      : "bg-muted/30 border border-transparent hover:bg-muted/60"
                  }`}
                >
                  <div className="flex w-full items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">
                      {s.assetType}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 font-mono text-xs font-medium ${
                        s.outcome === "ALLOW"
                          ? "bg-sg-success/10 text-sg-success"
                          : "bg-sg-deny/10 text-sg-deny"
                      }`}
                    >
                      {s.outcome}
                    </span>
                  </div>
                  <span className="text-sm font-semibold text-foreground">
                    {s.name}
                  </span>
                  <span className="text-xs leading-relaxed text-muted-foreground">
                    {s.story}
                  </span>
                </button>
              ))}
            </div>

            <Link
              href="/app"
              className="mt-6 flex items-start gap-3 rounded-xl border border-accent/20 bg-accent/5 p-4 transition-colors hover:bg-accent/10 group"
            >
              <Play className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
              <div className="flex-1">
                <p className="text-xs font-medium text-foreground">
                  Try it live in the Enforcement Console
                </p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Run Treasury PASS, anchor it on-chain, copy the attestation
                  hash, edit one character — verification fails. Proof is
                  deterministic and tamper-evident.
                </p>
              </div>
              <svg className="mt-0.5 h-4 w-4 shrink-0 text-accent transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </Link>
          </div>

          <div className="lg:col-span-7">
            <div className="relative overflow-hidden rounded-2xl border border-foreground/5 bg-muted/20 p-6 sm:p-8">
              <div
                className="pointer-events-none absolute inset-0 opacity-20"
                style={{
                  background:
                    active.outcome === "ALLOW"
                      ? "radial-gradient(ellipse 60% 60% at 80% 80%, rgba(16,185,129,0.3) 0%, transparent 70%)"
                      : "radial-gradient(ellipse 60% 60% at 80% 80%, rgba(239,68,68,0.15) 0%, transparent 70%)",
                }}
                aria-hidden="true"
              />
              <div className="relative">
                <div className="mb-6 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileCheck className="h-4 w-4 text-accent" />
                    <span className="text-sm font-medium text-foreground">
                      Canonical Proof Chain
                    </span>
                  </div>
                  <span className="rounded-full border border-foreground/5 bg-background/50 px-3 py-1 font-mono text-xs text-muted-foreground backdrop-blur-sm">
                    {active.assetType}
                  </span>
                </div>

                <AnimatePresence mode="wait">
                  <motion.div
                    key={animKey}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ProofChainAnimation scenario={active} />
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
