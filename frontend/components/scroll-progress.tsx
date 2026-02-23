"use client";

import { motion, useScroll, useSpring } from "motion/react";
import type { ReactNode } from "react";

export function ScrollProgress(): ReactNode {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 200,
    damping: 50,
    restDelta: 0.001,
  });

  return (
    <motion.div
      className="fixed top-0 left-0 right-0 z-[100] h-[2px] origin-left bg-gradient-to-r from-accent via-accent-light to-sg-teal"
      style={{ scaleX }}
    />
  );
}
