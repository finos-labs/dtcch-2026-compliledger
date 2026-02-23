"use client";

import { useRef, type ReactNode } from "react";
import { motion, useInView } from "motion/react";
import {
  Building2,
  Landmark,
  Shield,
  Lock,
  BadgeCheck,
  Banknote,
  Scale,
  Globe,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface Partner {
  name: string;
  icon: LucideIcon;
}

const partners: Partner[] = [
  { name: "Central Bank of Singapore", icon: Landmark },
  { name: "Deutsche Börse Group", icon: Building2 },
  { name: "DTCC", icon: Shield },
  { name: "Euroclear", icon: Lock },
  { name: "Fireblocks", icon: BadgeCheck },
  { name: "Monetary Authority", icon: Banknote },
  { name: "SEC Division", icon: Scale },
  { name: "Swift Network", icon: Globe },
  { name: "BNY Mellon", icon: Landmark },
  { name: "Goldman Sachs", icon: Building2 },
];

function MarqueeRow({
  direction = "left",
  speed = 25,
}: {
  direction?: "left" | "right";
  speed?: number;
}): ReactNode {
  const items = [...partners, ...partners];

  return (
    <div className="flex overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]">
      <motion.div
        className="flex shrink-0 gap-6"
        animate={{
          x: direction === "left" ? ["0%", "-50%"] : ["-50%", "0%"],
        }}
        transition={{
          x: {
            duration: speed,
            repeat: Number.POSITIVE_INFINITY,
            ease: "linear",
          },
        }}
      >
        {items.map((partner, index) => {
          const Icon = partner.icon;
          return (
            <div
              key={`${partner.name}-${index}`}
              className="group flex shrink-0 items-center gap-3 rounded-full border border-foreground/5 bg-muted/30 px-6 py-3 transition-colors hover:border-accent/20 hover:bg-accent/5"
            >
              <Icon
                className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-accent"
                strokeWidth={1.5}
              />
              <span className="whitespace-nowrap text-sm font-medium text-foreground/60 transition-colors group-hover:text-foreground">
                {partner.name}
              </span>
            </div>
          );
        })}
      </motion.div>
    </div>
  );
}

export function TrustedByMarquee(): ReactNode {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });

  return (
    <section className="py-20 md:py-28" ref={ref}>
      <motion.div
        className="mb-10 text-center"
        initial={{ opacity: 0, y: 16 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.5 }}
      >
        <p className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
          Designed for institutional infrastructure
        </p>
      </motion.div>

      <motion.div
        className="space-y-4"
        initial={{ opacity: 0 }}
        animate={isInView ? { opacity: 1 } : {}}
        transition={{ duration: 0.6, delay: 0.2 }}
      >
        <MarqueeRow direction="left" speed={30} />
        <MarqueeRow direction="right" speed={35} />
      </motion.div>
    </section>
  );
}
