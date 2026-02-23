"use client";

import { useState, useRef, type ReactNode } from "react";
import { motion, AnimatePresence, useInView } from "motion/react";
import { ShieldCheck, Cpu, TrendingUp, Scale } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface AudienceMessage {
  id: string;
  icon: LucideIcon;
  audience: string;
  title: string;
  points: string[];
}

const audiences: AudienceMessage[] = [
  {
    id: "risk",
    icon: ShieldCheck,
    audience: "Risk Officers & Compliance Teams",
    title: "Eliminate the compliance gap",
    points: [
      "SettlementGuard eliminates the gap between when a trade settles and when compliance is verified.",
      "Every settlement decision is provable, reproducible, and independently verifiable — not a matter of trust.",
      "If the proof doesn\u2019t exist, settlement doesn\u2019t happen. That\u2019s not a policy. That\u2019s enforcement.",
    ],
  },
  {
    id: "cto",
    icon: Cpu,
    audience: "CTOs & Infrastructure Architects",
    title: "Drop-in enforcement layer",
    points: [
      "SettlementGuard does not replace your settlement rails — it strengthens them.",
      "Hybrid architecture: sensitive data stays off-chain. Cryptographic commitments go on-chain.",
      "Asset-agnostic design means one integration supports tokenized Treasuries, stablecoins, and future asset classes.",
    ],
  },
  {
    id: "ceo",
    icon: TrendingUp,
    audience: "CEOs & Business Leaders",
    title: "The new standard for settlement",
    points: [
      "As tokenized asset markets scale, retrospective compliance will not be acceptable to regulators or institutional counterparties.",
      "SettlementGuard is the infrastructure layer that makes proof-based settlement the new standard.",
      "Organizations that adopt enforcement-first infrastructure today become the trusted settlement venues of tomorrow.",
    ],
  },
  {
    id: "regulator",
    icon: Scale,
    audience: "Regulators & Auditors",
    title: "Deterministic verification",
    points: [
      "Every settlement carries a sealed, cryptographically signed proof record — retrievable at any time.",
      "On-chain commitments provide tamper-resistant timestamps independent of any single party\u2019s records.",
      "Verification is deterministic: paste the attestation, confirm the signature, check the chain. No interpretation required.",
    ],
  },
];

export function SGMessages(): ReactNode {
  const [activeId, setActiveId] = useState("risk");
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const active = audiences.find((a) => a.id === activeId) ?? audiences[0]!;

  return (
    <section id="messages" className="px-4 py-20 sm:px-6 md:py-28 lg:px-8">
      <div className="mx-auto max-w-7xl" ref={ref}>
        <div className="mb-16 max-w-3xl">
          <motion.p
            className="text-sm font-medium uppercase tracking-wider text-accent"
            initial={{ opacity: 0, y: 10 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.4 }}
          >
            Key Messages
          </motion.p>
          <motion.h2
            className="mt-4 text-3xl font-medium tracking-tight text-foreground md:text-4xl lg:text-5xl"
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            Built for every stakeholder
          </motion.h2>
          <motion.p
            className="mt-4 max-w-xl text-lg text-muted-foreground"
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            Tokenized markets move at machine speed. Compliance must too.
            SettlementGuard enforces proof — deterministically, before finality.
          </motion.p>
        </div>

        <div className="grid gap-8 lg:grid-cols-12 lg:gap-12">
          <div className="lg:col-span-4">
            <div className="flex flex-col gap-2">
              {audiences.map((aud) => {
                const Icon = aud.icon;
                const isActive = aud.id === activeId;
                return (
                  <button
                    key={aud.id}
                    type="button"
                    onClick={() => setActiveId(aud.id)}
                    className={`flex cursor-pointer items-center gap-3 rounded-xl px-5 py-4 text-left transition-all duration-200 ${
                      isActive
                        ? "bg-accent/10 border border-accent/20"
                        : "bg-muted/30 border border-transparent hover:bg-muted/60"
                    }`}
                  >
                    <Icon
                      className={`h-5 w-5 shrink-0 ${
                        isActive ? "text-accent" : "text-muted-foreground"
                      }`}
                      strokeWidth={1.5}
                    />
                    <span
                      className={`text-sm font-medium ${
                        isActive ? "text-foreground" : "text-muted-foreground"
                      }`}
                    >
                      {aud.audience}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="lg:col-span-8">
            <AnimatePresence mode="wait">
              <motion.div
                key={active.id}
                initial={{ opacity: 0, y: 12, filter: "blur(4px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, y: -12, filter: "blur(4px)" }}
                transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
                className="relative overflow-hidden rounded-2xl border border-foreground/5 bg-muted/30 p-8 sm:p-10"
              >
                <div
                  className="pointer-events-none absolute right-0 top-0 h-full w-1/2 opacity-20"
                  style={{
                    background:
                      "radial-gradient(ellipse 80% 80% at 100% 0%, rgba(16,185,129,0.25) 0%, transparent 70%)",
                  }}
                  aria-hidden="true"
                />
                <div className="relative">
                <p className="text-xs font-medium uppercase tracking-wider text-accent">
                  {active.audience}
                </p>
                <h3 className="mt-3 text-2xl font-medium tracking-tight text-foreground sm:text-3xl">
                  {active.title}
                </h3>
                <div className="mt-8 space-y-6">
                  {active.points.map((point, i) => (
                    <motion.div
                      key={i}
                      className="flex gap-4"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3, delay: i * 0.1 }}
                    >
                      <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent" />
                      <p className="text-base leading-relaxed text-foreground/80">
                        {point}
                      </p>
                    </motion.div>
                  ))}
                </div>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
}
