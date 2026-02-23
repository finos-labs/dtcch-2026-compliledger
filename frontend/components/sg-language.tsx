"use client";

import { useRef, type ReactNode } from "react";
import { motion, useInView } from "motion/react";
import { Check, X } from "lucide-react";

const useWords = [
  { use: "Proof", not: "process" },
  { use: "Enforcement", not: "monitoring" },
  { use: "Deterministic", not: "rule-based" },
  { use: "Attestation", not: "approval" },
  { use: "Sealed bundle", not: "report" },
  { use: "Anchored commitment", not: "record" },
  { use: "Pre-finality", not: "pre-settlement" },
  { use: "Independent verification", not: "audit trail" },
];

const avoidWords = [
  {
    word: "Dashboard",
    reason: "implies observation, not enforcement",
  },
  {
    word: "Registry",
    reason: "implies record-keeping, not proof production",
  },
  {
    word: "Ledger",
    reason: "implies transaction storage, not compliance validation",
  },
  {
    word: "Policy engine",
    reason: "implies configurable rules, not deterministic proof",
  },
  {
    word: "Trust",
    reason: "SettlementGuard eliminates the need for it",
  },
  {
    word: "Automatic",
    reason: "undersells the deterministic cryptographic precision",
  },
];

export function SGLanguage(): ReactNode {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section className="px-4 py-20 sm:px-6 md:py-28 lg:px-8 border-t border-foreground/5">
      <div className="mx-auto max-w-7xl" ref={ref}>
        <div className="mb-16 max-w-3xl">
          <motion.p
            className="text-sm font-medium uppercase tracking-wider text-accent"
            initial={{ opacity: 0, y: 10 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.4 }}
          >
            Language Guide
          </motion.p>
          <motion.h2
            className="mt-4 text-3xl font-medium tracking-tight text-foreground md:text-4xl lg:text-5xl"
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            Words matter in compliance
          </motion.h2>
          <motion.p
            className="mt-4 text-lg text-muted-foreground"
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            Consistency across the product UI, marketing copy, sales
            conversations, and documentation.
          </motion.p>
        </div>

        <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
          <motion.div
            className="rounded-2xl bg-accent/5 border border-accent/10 p-6 sm:p-8"
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <h3 className="text-lg font-semibold text-foreground">
              Use These Words
            </h3>
            <div className="mt-6 space-y-3">
              {useWords.map((item, i) => (
                <motion.div
                  key={item.use}
                  className="flex items-center gap-3"
                  initial={{ opacity: 0, x: -10 }}
                  animate={isInView ? { opacity: 1, x: 0 } : {}}
                  transition={{ duration: 0.3, delay: 0.3 + i * 0.05 }}
                >
                  <Check className="h-4 w-4 shrink-0 text-accent" />
                  <span className="text-sm text-foreground">
                    <span className="font-medium">{item.use}</span>
                    <span className="text-muted-foreground">
                      , not {item.not}
                    </span>
                  </span>
                </motion.div>
              ))}
            </div>
          </motion.div>

          <motion.div
            className="rounded-2xl bg-sg-deny/3 border border-sg-deny/10 p-6 sm:p-8"
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <h3 className="text-lg font-semibold text-foreground">
              Avoid These Words
            </h3>
            <div className="mt-6 space-y-3">
              {avoidWords.map((item, i) => (
                <motion.div
                  key={item.word}
                  className="flex items-start gap-3"
                  initial={{ opacity: 0, x: -10 }}
                  animate={isInView ? { opacity: 1, x: 0 } : {}}
                  transition={{ duration: 0.3, delay: 0.4 + i * 0.05 }}
                >
                  <X className="mt-0.5 h-4 w-4 shrink-0 text-sg-deny" />
                  <span className="text-sm text-foreground">
                    <span className="font-medium">{item.word}</span>
                    <span className="text-muted-foreground">
                      {" "}
                      — {item.reason}
                    </span>
                  </span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
