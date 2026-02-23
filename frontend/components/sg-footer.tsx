"use client";

import { useRef, type ReactNode } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { SGLogo } from "./sg-logo";
import { motion, useScroll, useTransform } from "motion/react";

const footerCards = [
  {
    title: "Product",
    links: [
      { text: "Features", href: "#features" },
      { text: "Live Demo", href: "#demo" },
      { text: "Verification Flow", href: "#verification" },
    ],
  },
  {
    title: "Resources",
    links: [
      { text: "Documentation", href: "#", external: true },
      { text: "Architecture Overview", href: "#" },
      { text: "Integration Guide", href: "#", external: true },
      { text: "API Reference", href: "#", external: true },
    ],
  },
  {
    title: "Company",
    links: [
      { text: "About", href: "#" },
      { text: "Blog", href: "#" },
      { text: "Careers", href: "#", external: true },
      { text: "Press", href: "#" },
    ],
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5 },
  },
};

export function SGFooter(): ReactNode {
  return (
    <footer className="relative w-full overflow-hidden bg-background py-12 sm:py-16 md:py-20 lg:py-24">
      <div className="mx-auto w-full max-w-[1400px] px-4 sm:px-6 lg:px-8">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          className="space-y-6"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-[1.2fr_1fr_1fr_1fr]">
            {/* Branding Column */}
            <motion.div
              variants={itemVariants}
              className="mb-6 flex flex-col justify-between space-y-6 lg:mb-0"
            >
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent">
                  <SGLogo className="h-5 w-5 text-accent-foreground" />
                </div>
                <span className="text-lg font-semibold tracking-tight text-foreground">
                  SettlementGuard
                </span>
              </div>

              <div>
                <h3 className="text-lg font-medium tracking-tight text-foreground sm:text-xl">
                  Proof-based settlement
                  <br />
                  infrastructure at scale
                </h3>
              </div>

              <div className="flex gap-3">
                <Link
                  href="#"
                  className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  Terms
                </Link>
                <span className="text-foreground/10">·</span>
                <Link
                  href="#"
                  className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  Privacy
                </Link>
                <span className="text-foreground/10">·</span>
                <Link
                  href="#"
                  className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  Security
                </Link>
              </div>

              <div className="mt-auto">
                <p className="text-sm text-muted-foreground/60">
                  &copy; {new Date().getFullYear()} SettlementGuard. All rights
                  reserved.
                </p>
              </div>
            </motion.div>

            {/* Link Cards */}
            {footerCards.map((card, index) => {
              let marginClass = "";

              if (index > 0) {
                marginClass = "-mt-px";
              }

              if (index === 0) {
                marginClass += " md:mt-0";
              } else if (index === 1) {
                marginClass += " md:-mt-px md:ml-0";
              } else if (index === 2) {
                marginClass += " md:-mt-px md:-ml-px";
              }

              marginClass += " lg:mt-0";
              if (index > 0) {
                marginClass += " lg:-ml-px";
              }

              return (
                <motion.div
                  key={card.title}
                  variants={itemVariants}
                  className={`group relative min-h-[280px] overflow-hidden border border-foreground/[0.08] p-6 transition-colors hover:bg-accent/[0.03] sm:p-8 ${marginClass}`}
                >
                  <h4 className="mb-6 text-sm font-medium tracking-tight text-foreground sm:text-base">
                    {card.title}
                  </h4>
                  <ul className="space-y-3">
                    {card.links.map((link) => (
                      <li key={link.text}>
                        <Link
                          href={link.href}
                          className="inline-flex items-center gap-1 text-sm font-light text-muted-foreground transition-colors hover:text-foreground sm:text-base"
                        >
                          {link.text}
                          {link.external && (
                            <ArrowUpRight className="h-3 w-3" />
                          )}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </motion.div>
              );
            })}
          </div>

          {/* Large Background Text with Parallax */}
          <FooterParallaxText />
        </motion.div>
      </div>
    </footer>
  );
}

function FooterParallaxText(): ReactNode {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end end"],
  });

  const y = useTransform(scrollYProgress, [0, 1], [150, 0]);
  const scale = useTransform(scrollYProgress, [0, 1], [0.85, 1]);
  const opacity = useTransform(scrollYProgress, [0, 0.5, 1], [0, 0.6, 1]);

  return (
    <div
      ref={containerRef}
      className="relative -mb-4 overflow-hidden pt-8 sm:pt-12 md:pt-16"
    >
      <motion.div
        className="select-none"
        style={{ y, scale, opacity }}
        aria-hidden="true"
      >
        <span className="block w-full whitespace-nowrap text-center text-[11vw] font-black leading-none tracking-tighter text-accent/[0.15] dark:text-foreground/[0.05]">
          SETTLEMENTGUARD
        </span>
      </motion.div>
    </div>
  );
}
