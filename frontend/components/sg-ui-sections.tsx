"use client";

import { useState, type ReactNode } from "react";
import { motion } from "motion/react";
import { ArrowRight } from "lucide-react";

const cards = [
  {
    number: 1,
    title: "Submit Settlement Intent",
    link: "View scenarios",
    href: "/app",
    items: [
      "Choose asset class & scenario",
      "Define settlement parameters",
      "Initiate Canonical Proof Chain",
    ],
    gradient: "from-accent/80 to-sg-teal/80",
  },
  {
    number: 2,
    title: "Enforce Compliance",
    link: "Explore proof chain",
    href: "/app",
    items: [
      "Issuer Legitimacy check",
      "Asset Classification engine",
      "Custody & Reserve verification",
      "Cryptographic proof bundle",
    ],
    gradient: "from-sg-teal/80 to-sg-cyan/80",
  },
  {
    number: 3,
    title: "Verify & Anchor",
    link: "Verification docs",
    href: "https://github.com/finos-labs/dtcch-2026-compliledger#readme",
    items: [
      "On-chain proof anchoring",
      "Independent attestation verification",
    ],
    gradient: "from-sg-cyan/80 to-accent/80",
  },
];

export function SGUISections(): ReactNode {
  const [hoveredCard, setHoveredCard] = useState<number | null>(null);

  return (
    <section
      id="verification"
      className="w-full px-4 py-20 sm:px-6 md:py-28 lg:px-8"
      aria-label="How it works"
    >
      <div className="mx-auto w-full max-w-7xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mb-12 text-center sm:mb-16"
        >
          <p className="mb-4 text-sm font-medium uppercase tracking-wider text-accent">
            Interface Walkthrough
          </p>
          <h2 className="text-center text-3xl font-medium tracking-tight text-foreground sm:text-4xl md:text-5xl lg:text-6xl">
            Three steps, one enforcement flow
          </h2>
        </motion.div>

        <div className="mb-12 grid grid-cols-1 gap-4 md:grid-cols-3 lg:gap-6 sm:mb-16">
          {cards.map((card, idx) => (
            <motion.article
              key={card.number}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: idx * 0.1 }}
              className="group relative flex min-h-[400px] cursor-pointer flex-col overflow-hidden rounded-2xl border border-foreground/5 bg-muted/30 sm:min-h-[450px] lg:min-h-[500px]"
              onMouseEnter={() => setHoveredCard(card.number)}
              onMouseLeave={() => setHoveredCard(null)}
              aria-label={`Step ${card.number}: ${card.title}`}
            >
              {/* Hover gradient overlay */}
              <motion.div
                className={`absolute inset-0 bg-gradient-to-br ${card.gradient}`}
                initial={{ opacity: 0 }}
                animate={{
                  opacity: hoveredCard === card.number ? 1 : 0,
                }}
                transition={{ duration: 0.5, ease: "easeOut" }}
              />
              <motion.div
                className="absolute inset-0 bg-background/60"
                initial={{ opacity: 0 }}
                animate={{
                  opacity: hoveredCard === card.number ? 1 : 0,
                }}
                transition={{ duration: 0.4, ease: "easeOut" }}
              />

              <div className="relative z-10 flex h-full flex-col px-6 pt-6 sm:px-8 sm:pt-8">
                <div className="flex-1">
                  <div
                    className={`mb-4 flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold transition-colors duration-300 ${
                      hoveredCard === card.number
                        ? "bg-accent text-accent-foreground"
                        : "bg-accent/10 text-accent"
                    }`}
                  >
                    {card.number}
                  </div>

                  <h3 className="mb-2 text-xl font-medium tracking-tight text-foreground sm:text-2xl lg:text-3xl">
                    {card.title}
                  </h3>

                  <a
                    href={card.href}
                    className={`inline-flex items-center gap-2 text-sm font-medium transition-colors duration-300 group/link ${
                      hoveredCard === card.number
                        ? "text-accent"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {card.link}
                    <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover/link:translate-x-1" />
                  </a>
                </div>

                <div className="mt-auto -mx-6 sm:-mx-8">
                  {card.items.map((item, itemIdx) => (
                    <div
                      key={itemIdx}
                      className={`border-t px-6 py-3 transition-colors duration-300 sm:px-8 ${
                        hoveredCard === card.number
                          ? "border-accent/20 text-foreground/90"
                          : "border-foreground/5 text-muted-foreground"
                      }`}
                    >
                      <span className="text-sm">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.article>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="text-center"
        >
          <a
            href="/app"
            className="group inline-flex items-center gap-2 text-muted-foreground transition-colors duration-200 hover:text-foreground"
          >
            <span className="text-sm sm:text-base">
              Start enforcing compliance. Integrate the proof chain in under 5
              minutes.
            </span>
            <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
          </a>
        </motion.div>
      </div>
    </section>
  );
}
