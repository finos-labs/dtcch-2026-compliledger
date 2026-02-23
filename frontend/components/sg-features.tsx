"use client";

import { useRef, type ReactNode } from "react";
import { motion, useInView } from "motion/react";
import { TiltCard } from "./tilt-card";
import {
  Link2,
  Lock,
  CheckCircle2,
  Anchor,
  Search,
  Building2,
  Layers,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface Feature {
  icon: LucideIcon;
  title: string;
  description: string;
  accent?: boolean;
}

const features: Feature[] = [
  {
    icon: Link2,
    title: "Canonical Proof Chain",
    description:
      "Every settlement attempt runs through an identical, ordered sequence of compliance checks: issuer legitimacy, asset classification, custody conditions, and reserve backing. The chain never changes. Results are always reproducible.",
  },
  {
    icon: Lock,
    title: "Sealed Proof Bundle",
    description:
      "Once all checks complete, the results are sealed into a tamper-evident bundle. This bundle captures every input, every decision, and every hash — the Single Source of Proof.",
    accent: true,
  },
  {
    icon: CheckCircle2,
    title: "Cryptographic Settlement Attestation",
    description:
      "If and only if all checks pass, SettlementGuard issues a digitally signed attestation. Cryptographically bound to the proof bundle — machine-verifiable evidence, not a compliance checkbox.",
  },
  {
    icon: Anchor,
    title: "On-Chain Commitment Anchoring",
    description:
      "The proof bundle hash and attestation hash are written to an institutional blockchain. A permanent, tamper-resistant timestamp that regulators and auditors can independently confirm.",
  },
  {
    icon: Search,
    title: "Independent Verification",
    description:
      "Any authorized party can verify a settlement attestation at any time. Paste the attestation JSON and signature — tampering is immediately detectable.",
    accent: true,
  },
  {
    icon: Building2,
    title: "Asset-Agnostic Enforcement",
    description:
      "The same enforcement structure applies to tokenized Treasuries, stablecoins, and other real-world assets. One enforcement layer scales across your entire portfolio.",
  },
  {
    icon: Layers,
    title: "Hybrid Architecture",
    description:
      "Proof evaluation runs off-chain in a secure enterprise environment. Only cryptographic hashes are anchored on-chain. Performance and privacy with tamper-resistance and auditability.",
  },
  {
    icon: Zap,
    title: "Pre-Finality Enforcement",
    description:
      "SettlementGuard acts before settlement becomes irreversible. If a proof check fails, no attestation is issued. Without an attestation, settlement does not proceed.",
    accent: true,
  },
];

function FeatureCard({
  feature,
  index,
}: {
  feature: Feature;
  index: number;
}): ReactNode {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });
  const Icon = feature.icon;

  const cardContent = (
    <div
      className={`relative flex h-full flex-col rounded-2xl p-6 transition-colors duration-300 sm:p-8 ${
        feature.accent
          ? "bg-background border border-accent/15"
          : "bg-muted/50 border border-foreground/5 hover:bg-muted"
      }`}
    >
      <div
        className={`flex h-12 w-12 items-center justify-center rounded-xl ${
          feature.accent
            ? "bg-accent/15"
            : "bg-foreground/5"
        }`}
      >
        <Icon
          className={`h-5 w-5 ${
            feature.accent ? "text-accent" : "text-foreground"
          }`}
          strokeWidth={1.5}
        />
      </div>

      <h3 className="mt-5 text-lg font-semibold tracking-tight text-foreground">
        {feature.title}
      </h3>

      <p className="mt-3 flex-1 text-sm leading-relaxed text-muted-foreground">
        {feature.description}
      </p>
    </div>
  );

  const staggerOrder = [0, 4, 1, 5, 2, 6, 3, 7];
  const staggerDelay = (staggerOrder[index] ?? index) * 0.07;

  if (feature.accent) {
    return (
      <motion.div
        ref={ref}
        className="group relative"
        initial={{ opacity: 0, y: 40, scale: 0.9, filter: "blur(10px)" }}
        animate={
          isInView
            ? { opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }
            : {}
        }
        transition={{
          duration: 0.6,
          delay: staggerDelay,
          ease: [0.25, 0.46, 0.45, 0.94],
        }}
      >
        <TiltCard className="h-full rounded-2xl" tiltStrength={8}>
          <motion.div
            className="pointer-events-none absolute left-1/2 top-1/2 h-[60%] w-[60%] rounded-full bg-accent-light opacity-30 blur-3xl"
            animate={{
              x: ["-50%", "-30%", "-70%", "-40%", "-60%", "-50%"],
              y: ["-50%", "-70%", "-30%", "-60%", "-40%", "-50%"],
              scale: [1, 1.2, 0.9, 1.1, 0.95, 1],
            }}
            transition={{
              duration: 14,
              repeat: Number.POSITIVE_INFINITY,
              ease: "easeInOut",
              times: [0, 0.2, 0.4, 0.6, 0.8, 1],
            }}
          />
          <motion.div
            className="pointer-events-none absolute left-1/2 top-1/2 h-[40%] w-[40%] rounded-full bg-accent opacity-20 blur-3xl"
            animate={{
              x: ["-50%", "-70%", "-30%", "-60%", "-40%", "-50%"],
              y: ["-50%", "-30%", "-70%", "-40%", "-60%", "-50%"],
              scale: [1, 0.9, 1.15, 0.95, 1.1, 1],
            }}
            transition={{
              duration: 11,
              repeat: Number.POSITIVE_INFINITY,
              ease: "easeInOut",
              times: [0, 0.2, 0.4, 0.6, 0.8, 1],
            }}
          />
          <div className="absolute -inset-px rounded-[1.05rem] bg-linear-to-br from-accent to-accent-light opacity-20" />
          <div className="relative">{cardContent}</div>
        </TiltCard>
      </motion.div>
    );
  }

  return (
    <motion.div
      ref={ref}
      className="group"
      initial={{ opacity: 0, y: 40, scale: 0.9, filter: "blur(10px)" }}
      animate={
        isInView
          ? { opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }
          : {}
      }
      transition={{
        duration: 0.6,
        delay: staggerDelay,
        ease: [0.25, 0.46, 0.45, 0.94],
      }}
    >
      <TiltCard className="h-full rounded-2xl" tiltStrength={6} glareEnabled={false}>
        {cardContent}
      </TiltCard>
    </motion.div>
  );
}

export function SGFeatures(): ReactNode {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section id="features" className="px-4 py-20 sm:px-6 md:py-28 lg:px-8">
      <div className="mx-auto max-w-7xl" ref={ref}>
        <div className="mb-16 max-w-3xl">
          <motion.p
            className="text-sm font-medium uppercase tracking-wider text-accent"
            initial={{ opacity: 0, y: 10 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.4 }}
          >
            Core Features
          </motion.p>
          <motion.h2
            className="mt-4 text-3xl font-medium tracking-tight text-foreground md:text-4xl lg:text-5xl"
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            Eight pillars of settlement enforcement
          </motion.h2>
          <motion.p
            className="mt-4 text-lg text-muted-foreground"
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            Each feature delivers outcomes, not engineering specs. Designed to be
            explained to decision-makers without technical jargon.
          </motion.p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature, index) => (
            <FeatureCard key={feature.title} feature={feature} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
}
