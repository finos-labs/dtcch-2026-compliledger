"use client";

import { useState, useEffect, type ReactNode } from "react";
import { motion, AnimatePresence } from "motion/react";
import { SGLogo } from "./sg-logo";

export function PagePreloader(): ReactNode {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 2200);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (isLoading) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isLoading]);

  return (
    <AnimatePresence mode="wait">
      {isLoading && (
        <motion.div
          key="preloader"
          className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-background"
          exit={{ opacity: 0, scale: 1.05 }}
          transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.5, filter: "blur(20px)" }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            transition={{
              duration: 0.8,
              ease: [0.25, 0.46, 0.45, 0.94],
            }}
            className="relative"
          >
            <motion.div
              className="absolute inset-0 -m-8 rounded-full bg-accent/20 blur-3xl"
              animate={{
                scale: [1, 1.3, 1],
                opacity: [0.2, 0.4, 0.2],
              }}
              transition={{
                duration: 2,
                repeat: Number.POSITIVE_INFINITY,
                ease: "easeInOut",
              }}
            />
            <svg
              viewBox="0 0 100 100"
              className="relative h-20 w-20 text-accent"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <motion.circle
                cx="50"
                cy="50"
                r="38"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{
                  pathLength: { duration: 1.4, ease: [0.25, 0.46, 0.45, 0.94] },
                  opacity: { duration: 0.3 },
                }}
              />
              <motion.circle
                cx="50"
                cy="50"
                r="26"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 0.6 }}
                transition={{
                  pathLength: {
                    duration: 1.2,
                    delay: 0.3,
                    ease: [0.25, 0.46, 0.45, 0.94],
                  },
                  opacity: { duration: 0.3, delay: 0.3 },
                }}
              />
            </svg>
          </motion.div>

          <motion.div
            className="mt-8 flex items-center gap-2"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.6 }}
          >
            <SGLogo className="h-5 w-5 text-accent" />
            <span className="text-lg font-semibold tracking-tight text-foreground">
              SettlementGuard
            </span>
          </motion.div>

          <motion.div
            className="mt-6 h-[1px] w-24 overflow-hidden rounded-full bg-foreground/10"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
          >
            <motion.div
              className="h-full bg-accent"
              initial={{ x: "-100%" }}
              animate={{ x: "100%" }}
              transition={{
                duration: 1,
                delay: 0.8,
                repeat: Number.POSITIVE_INFINITY,
                ease: "easeInOut",
              }}
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
