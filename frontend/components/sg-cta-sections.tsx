"use client";

import { useRef, type ReactNode } from "react";
import { motion, useInView } from "motion/react";
import Link from "next/link";
import {
  Play,
  Download,
  FlaskConical,
  BookOpen,
  Rocket,
  Building2,
  ShieldCheck,
  ArrowRight,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface CTACard {
  icon: LucideIcon;
  label: string;
  title: string;
  description: string;
  href: string;
  primary?: boolean;
}

const topFunnel: CTACard[] = [
  {
    icon: Play,
    label: "Primary CTA",
    title: "See the Proof Chain in Action",
    description:
      "Watch a 3-minute demo of a settlement being evaluated in real time.",
    href: "#demo",
    primary: true,
  },
  {
    icon: Download,
    label: "Secondary CTA",
    title: "Download the SettlementGuard Overview",
    description:
      "The non-technical guide to proof-based settlement enforcement.",
    href: "#",
  },
];

const midFunnel: CTACard[] = [
  {
    icon: FlaskConical,
    label: "Evaluation CTA",
    title: "Run a Settlement Scenario",
    description:
      "Try Treasury PASS, Treasury FAIL, Stablecoin PASS, and Stablecoin FAIL — live, in 5 minutes.",
    href: "#demo",
    primary: true,
  },
  {
    icon: BookOpen,
    label: "Education CTA",
    title: "Understand the Canonical Proof Chain",
    description:
      "A step-by-step walkthrough of how SettlementGuard evaluates a settlement intent.",
    href: "#features",
  },
];

const bottomFunnel: CTACard[] = [
  {
    icon: Rocket,
    label: "Integration CTA",
    title: "Start Your Proof-Based Settlement Pilot",
    description:
      "Deploy SettlementGuard in your environment. We handle the integration. You own the proof.",
    href: "#",
    primary: true,
  },
  {
    icon: Building2,
    label: "Enterprise CTA",
    title: "Request a Technical Architecture Review",
    description:
      "Work with our team to map SettlementGuard to your settlement infrastructure.",
    href: "#",
  },
];

function CTACardComponent({
  card,
  index,
}: {
  card: CTACard;
  index: number;
}): ReactNode {
  const Icon = card.icon;
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.5,
        delay: index * 0.1,
        ease: [0.25, 0.46, 0.45, 0.94],
      }}
      viewport={{ once: true }}
    >
      <Link
        href={card.href}
        className={`group relative flex h-full flex-col overflow-hidden rounded-2xl p-6 transition-all duration-300 sm:p-8 ${
          card.primary
            ? "bg-background border border-accent/20 hover:border-accent/30 hover:shadow-[0_0_30px_rgba(16,185,129,0.08)]"
            : "bg-muted/30 border border-foreground/5 hover:border-foreground/10 hover:bg-muted/50"
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-xl ${
              card.primary ? "bg-accent/15" : "bg-foreground/5"
            }`}
          >
            <Icon
              className={`h-4 w-4 ${
                card.primary ? "text-accent" : "text-foreground"
              }`}
              strokeWidth={1.5}
            />
          </div>
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {card.label}
          </span>
        </div>

        <h3 className="mt-4 text-lg font-semibold tracking-tight text-foreground">
          {card.title}
        </h3>

        <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
          {card.description}
        </p>

        <div className="mt-4 flex items-center gap-1 text-sm font-medium text-accent">
          <span>Learn more</span>
          <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-1" />
        </div>
      </Link>
    </motion.div>
  );
}

function FunnelSection({
  stage,
  subtitle,
  cards,
}: {
  stage: string;
  subtitle: string;
  cards: CTACard[];
}): ReactNode {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });

  return (
    <div ref={ref} className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.4 }}
      >
        <p className="text-xs font-medium uppercase tracking-wider text-accent">
          {stage}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
      </motion.div>

      <div className="grid gap-4 sm:grid-cols-2">
        {cards.map((card, i) => (
          <CTACardComponent key={card.title} card={card} index={i} />
        ))}
      </div>
    </div>
  );
}

export function SGCTASections(): ReactNode {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section id="cta" className="px-4 py-20 sm:px-6 md:py-28 lg:px-8">
      <div className="mx-auto max-w-7xl" ref={ref}>
        <div className="mb-16 max-w-3xl">
          <motion.p
            className="text-sm font-medium uppercase tracking-wider text-accent"
            initial={{ opacity: 0, y: 10 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.4 }}
          >
            Calls to Action
          </motion.p>
          <motion.h2
            className="mt-4 text-3xl font-medium tracking-tight text-foreground md:text-4xl lg:text-5xl"
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            Your path to proof-based settlement
          </motion.h2>
        </div>

        <div className="space-y-16">
          <FunnelSection
            stage="Top of Funnel — Awareness"
            subtitle="Homepage hero sections, conference materials, and social content."
            cards={topFunnel}
          />

          <FunnelSection
            stage="Mid Funnel — Consideration"
            subtitle="Product pages, solution briefs, and email nurture sequences."
            cards={midFunnel}
          />

          <FunnelSection
            stage="Bottom of Funnel — Decision"
            subtitle="Warm prospects, direct outreach, and RFP responses."
            cards={bottomFunnel}
          />
        </div>

        <motion.div
          className="mt-16 rounded-2xl border border-accent/20 bg-accent/5 p-6 sm:p-8"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}
        >
          <div className="flex items-start gap-4">
            <ShieldCheck className="mt-1 h-6 w-6 shrink-0 text-accent" />
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-accent">
                Verification / Trust CTA
              </p>
              <h3 className="mt-2 text-xl font-semibold tracking-tight text-foreground">
                Verify Any Attestation, Any Time
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Paste a settlement attestation. Confirm the cryptographic proof.
                Verify the on-chain commitment. Used in partner materials,
                regulator-facing content, and post-settlement audit contexts.
              </p>
              <Link
                href="#verification"
                className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline"
              >
                Go to Verification
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
