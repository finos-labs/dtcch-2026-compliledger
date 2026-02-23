"use client";

import { useScroll, useTransform, useSpring, motion } from "motion/react";
import { ArrowDown, ArrowRight } from "lucide-react";
import { SGLogo } from "./sg-logo";
import { MagneticButton } from "./magnetic-button";
import { useRef, type ReactNode } from "react";
import Link from "next/link";
import { FluidCursor } from "./fluid-cursor";

export function SGHero(): ReactNode {
  const sectionRef = useRef<HTMLElement>(null);

  const { scrollY, scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end start"],
  });

  const scaleYRaw = useTransform(scrollYProgress, [0.0, 0.5], [1, 0]);
  const scaleY = useSpring(scaleYRaw, { stiffness: 100, damping: 30 });
  const y = useTransform(scrollY, (value) => value * 0.7);

  return (
    <section ref={sectionRef} className="relative min-h-dvh w-full">
      <FluidCursor
        color={{ r: 0.04, g: 0.47, b: 0.34 }}
        className="absolute inset-0 -z-5"
      />

      <motion.div
        className="pointer-events-none absolute inset-0 -z-10 origin-top scale-125 will-change-transform"
        style={{ scaleY, y }}
        aria-hidden="true"
      >
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 90% 70% at 50% -10%, rgba(16,185,129,0.28) 0%, rgba(5,150,105,0.15) 30%, rgba(13,148,136,0.06) 55%, transparent 75%)",
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 50% 50% at 20% 30%, rgba(6,182,212,0.12) 0%, transparent 60%)",
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 40% 40% at 80% 20%, rgba(16,185,129,0.10) 0%, transparent 60%)",
          }}
        />
        <div className="from-background absolute inset-x-0 bottom-0 h-1/2 bg-linear-to-t to-transparent" />
      </motion.div>

      <div className="mx-auto flex min-h-dvh max-w-5xl flex-col items-center justify-center gap-8 px-4 py-20 text-center sm:py-0 lg:px-8">
        <motion.div
          className="flex items-center gap-2.5 rounded-full border border-accent/20 bg-accent/5 px-6 py-2.5 backdrop-blur-sm"
          initial={{ opacity: 0, y: 20, filter: "blur(8px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
        >
          <SGLogo className="h-4 w-4 text-accent" />
          <span className="text-sm font-medium text-accent">
            Compliance-Native Settlement Enforcement
          </span>
        </motion.div>

        <motion.h1
          className="text-4xl font-medium tracking-tight text-foreground sm:text-5xl md:text-6xl lg:text-7xl"
          initial={{ opacity: 0, y: 20, filter: "blur(8px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{
            duration: 0.6,
            delay: 0.1,
            ease: [0.25, 0.46, 0.45, 0.94],
          }}
        >
          <span className="block">From Trust to Proof —</span>
          <span className="block">
            Before Settlement{" "}
            <em className="bg-linear-to-r from-accent to-sg-teal bg-clip-text italic text-transparent">
              Finalizes
            </em>
          </span>
        </motion.h1>

        <motion.p
          className="max-w-2xl text-lg text-muted-foreground sm:text-xl"
          initial={{ opacity: 0, y: 20, filter: "blur(8px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{
            duration: 0.6,
            delay: 0.2,
            ease: [0.25, 0.46, 0.45, 0.94],
          }}
        >
          SettlementGuard enforces compliance deterministically, before the
          moment of irreversibility. Cryptographic proof at institutional scale.
        </motion.p>

        <motion.div
          className="flex flex-col gap-4 sm:flex-row"
          initial={{ opacity: 0, y: 20, filter: "blur(8px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{
            duration: 0.6,
            delay: 0.3,
            ease: [0.25, 0.46, 0.45, 0.94],
          }}
        >
          <MagneticButton strength={0.3}>
            <Link
              href="#demo"
              className="focus-ring group relative flex items-center gap-2 overflow-hidden rounded-full bg-accent px-8 py-4 text-base font-semibold text-accent-foreground transition-all hover:shadow-[0_0_30px_rgba(16,185,129,0.3)] hover:brightness-110"
            >
              See the Proof Chain in Action
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </MagneticButton>
          <MagneticButton strength={0.25}>
            <Link
              href="#features"
              className="focus-ring flex items-center gap-2 rounded-full border border-foreground/10 bg-foreground/5 px-8 py-4 text-base font-semibold text-foreground backdrop-blur-sm transition-all hover:border-foreground/20 hover:bg-foreground/10"
            >
              Explore Features
            </Link>
          </MagneticButton>
        </motion.div>

        <motion.div
          className="mt-12 grid grid-cols-3 gap-8 sm:gap-20"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.6,
            delay: 0.45,
            ease: [0.25, 0.46, 0.45, 0.94],
          }}
        >
          {[
            { label: "Pre-Finality", value: "Enforcement" },
            { label: "Deterministic", value: "Proof" },
            { label: "On-Chain", value: "Anchoring" },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <p className="text-sm font-semibold tracking-wide text-accent">
                {stat.value}
              </p>
              <p className="mt-1 text-xs text-foreground/40">{stat.label}</p>
            </div>
          ))}
        </motion.div>
      </div>

      <motion.div
        className="absolute inset-x-0 bottom-24 mx-auto flex max-w-5xl items-center justify-between px-4 sm:px-6 lg:px-8"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          duration: 0.5,
          delay: 0.6,
          ease: [0.25, 0.46, 0.45, 0.94],
        }}
      >
        <p className="text-foreground/40 max-w-sm text-sm">
          The last gate before settlement is final. Designed for banks,
          custodians, and regulated digital asset exchanges.
        </p>
        <ArrowDown
          className="text-foreground/30 h-12 w-12"
          strokeWidth={1}
        />
      </motion.div>
    </section>
  );
}
