"use client";

import { useRef, useEffect, type ReactNode } from "react";
import { motion, useInView } from "motion/react";

interface Stat {
  label: string;
  sg: number;
  traditional: number;
  unit: string;
  description: string;
}

const stats: Stat[] = [
  {
    label: "Compliance Verification",
    sg: 100,
    traditional: 35,
    unit: "%",
    description: "Pre-settlement vs post-trade audit coverage",
  },
  {
    label: "Proof Reproducibility",
    sg: 100,
    traditional: 12,
    unit: "%",
    description: "Deterministic checks vs manual attestations",
  },
  {
    label: "Verification Speed",
    sg: 95,
    traditional: 15,
    unit: "%",
    description: "Instant cryptographic vs weeks of audit cycles",
  },
  {
    label: "Tamper Detection",
    sg: 100,
    traditional: 8,
    unit: "%",
    description: "Cryptographic proof vs assumption-based records",
  },
];

function AnimatedBar({
  value,
  color,
  delay,
  isInView,
}: {
  value: number;
  color: "accent" | "muted";
  delay: number;
  isInView: boolean;
}): ReactNode {
  return (
    <div className="relative h-2 w-full overflow-hidden rounded-full bg-foreground/5">
      <motion.div
        className={`absolute inset-y-0 left-0 rounded-full ${
          color === "accent"
            ? "bg-linear-to-r from-accent to-accent-light"
            : "bg-foreground/15"
        }`}
        initial={{ width: "0%" }}
        animate={isInView ? { width: `${value}%` } : { width: "0%" }}
        transition={{
          duration: 1.2,
          delay,
          ease: [0.25, 0.46, 0.45, 0.94],
        }}
      />
      {color === "accent" && (
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full bg-accent/30 blur-sm"
          initial={{ width: "0%" }}
          animate={isInView ? { width: `${value}%` } : { width: "0%" }}
          transition={{
            duration: 1.2,
            delay,
            ease: [0.25, 0.46, 0.45, 0.94],
          }}
        />
      )}
    </div>
  );
}

function AnimatedNumber({
  value,
  unit,
  isInView,
  delay,
}: {
  value: number;
  unit: string;
  isInView: boolean;
  delay: number;
}): ReactNode {
  const nodeRef = useRef<HTMLSpanElement>(null);
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (!isInView || hasAnimated.current || !nodeRef.current) return;
    hasAnimated.current = true;

    const start = performance.now();
    const duration = 1200;
    const delayMs = delay * 1000;

    const timeout = setTimeout(() => {
      function tick(now: number) {
        const elapsed = now - start - delayMs;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        const current = Math.round(eased * value);

        if (nodeRef.current) {
          nodeRef.current.textContent = `${current}${unit}`;
        }

        if (progress < 1) {
          requestAnimationFrame(tick);
        }
      }

      requestAnimationFrame(tick);
    }, delayMs);

    return () => clearTimeout(timeout);
  }, [isInView, value, unit, delay]);

  return (
    <motion.span
      ref={nodeRef}
      className="font-mono text-sm font-semibold tabular-nums"
      initial={{ opacity: 0 }}
      animate={isInView ? { opacity: 1 } : {}}
      transition={{ duration: 0.4, delay: delay + 0.3 }}
    >
      0{unit}
    </motion.span>
  );
}

export function SGStats(): ReactNode {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section className="px-4 py-20 sm:px-6 md:py-28 lg:px-8">
      <div className="mx-auto max-w-7xl" ref={ref}>
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-5">
            <motion.p
              className="text-sm font-medium uppercase tracking-wider text-accent"
              initial={{ opacity: 0, y: 10 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.4 }}
            >
              Enforcement Metrics
            </motion.p>
            <motion.h2
              className="mt-4 text-3xl font-medium tracking-tight text-foreground md:text-4xl"
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              Proof over trust — measured
            </motion.h2>
            <motion.p
              className="mt-4 text-lg text-muted-foreground"
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              SettlementGuard doesn&apos;t just improve compliance — it replaces
              the need for trust with deterministic, cryptographic proof.
            </motion.p>

            <motion.div
              className="mt-8 flex items-center gap-6"
              initial={{ opacity: 0 }}
              animate={isInView ? { opacity: 1 } : {}}
              transition={{ duration: 0.5, delay: 0.3 }}
            >
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-linear-to-r from-accent to-accent-light" />
                <span className="text-xs font-medium text-foreground">
                  SettlementGuard
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-foreground/15" />
                <span className="text-xs font-medium text-muted-foreground">
                  Traditional
                </span>
              </div>
            </motion.div>
          </div>

          <div className="lg:col-span-7">
            <div className="space-y-8">
              {stats.map((stat, index) => {
                const baseDelay = 0.2 + index * 0.12;
                return (
                  <motion.div
                    key={stat.label}
                    className="space-y-3"
                    initial={{ opacity: 0, y: 16 }}
                    animate={isInView ? { opacity: 1, y: 0 } : {}}
                    transition={{
                      duration: 0.4,
                      delay: baseDelay,
                      ease: [0.25, 0.46, 0.45, 0.94],
                    }}
                  >
                    <div className="flex items-baseline justify-between">
                      <h3 className="text-sm font-semibold text-foreground">
                        {stat.label}
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        {stat.description}
                      </p>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <AnimatedBar
                          value={stat.sg}
                          color="accent"
                          delay={baseDelay + 0.1}
                          isInView={isInView}
                        />
                        <span className="w-12 text-right text-accent">
                          <AnimatedNumber
                            value={stat.sg}
                            unit={stat.unit}
                            isInView={isInView}
                            delay={baseDelay + 0.1}
                          />
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <AnimatedBar
                          value={stat.traditional}
                          color="muted"
                          delay={baseDelay + 0.2}
                          isInView={isInView}
                        />
                        <span className="w-12 text-right text-foreground/40">
                          <AnimatedNumber
                            value={stat.traditional}
                            unit={stat.unit}
                            isInView={isInView}
                            delay={baseDelay + 0.2}
                          />
                        </span>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
