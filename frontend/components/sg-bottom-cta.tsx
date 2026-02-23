"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { BorderBeam } from "./border-beam";

export function SGBottomCTA(): ReactNode {
  return (
    <section className="px-4 py-24 sm:px-6 lg:px-8">
      <div className="relative mx-auto max-w-7xl overflow-hidden rounded-3xl bg-muted/50">
        <div className="relative z-10 px-8 py-14 sm:px-12">
          <div className="max-w-xl">
            <h2 className="text-2xl font-medium tracking-tight text-foreground sm:text-3xl">
              Start your proof-based settlement pilot
            </h2>
            <p className="mt-3 max-w-md text-lg text-muted-foreground">
              Deploy SettlementGuard in your environment. We handle the
              integration. You own the proof.
            </p>

            <form className="mt-8 flex flex-col gap-2 sm:flex-row">
              <input
                type="email"
                placeholder="you@institution.com"
                className="h-12 sm:min-w-86 appearance-none rounded-xl border-0 bg-background px-6 text-foreground shadow-none placeholder:text-muted-foreground outline-none! ring-0! transition-shadow duration-200 focus:border-0 focus:shadow-[0_0_20px_rgba(0,0,0,0.08)] dark:focus:shadow-[0_0_20px_rgba(16,185,129,0.15)]"
                required
              />
              <button
                type="submit"
                className="h-12 cursor-pointer rounded-full bg-accent px-8 font-medium text-accent-foreground transition-all hover:opacity-90 hover:shadow-[0_0_24px_rgba(16,185,129,0.25)]"
              >
                Request access
              </button>
            </form>

            <p className="mt-4 max-w-xs text-xs text-muted-foreground">
              Enterprise-grade security. No sensitive data leaves your
              environment.{" "}
              <Link href="#" className="underline hover:text-foreground">
                Privacy Policy
              </Link>
              .
            </p>
          </div>
        </div>

        <motion.div
          className="pointer-events-none absolute right-[-10%] top-[-20%] h-[140%] w-[60%] rounded-full opacity-20 blur-3xl"
          style={{
            background:
              "radial-gradient(circle, rgba(16,185,129,0.6) 0%, rgba(13,148,136,0.3) 40%, transparent 70%)",
          }}
          animate={{
            x: ["0%", "5%", "-3%", "4%", "0%"],
            y: ["0%", "-5%", "3%", "-2%", "0%"],
            scale: [1, 1.05, 0.95, 1.02, 1],
          }}
          transition={{
            duration: 16,
            repeat: Number.POSITIVE_INFINITY,
            ease: "easeInOut",
          }}
          aria-hidden="true"
        />

        <div
          className="pointer-events-none absolute inset-y-0 right-0 w-2/3 opacity-15"
          style={{
            background:
              "linear-gradient(to left, rgba(16,185,129,0.8), rgba(13,148,136,0.4), transparent)",
            maskImage:
              "linear-gradient(to left, black 0%, black 30%, transparent 100%)",
            WebkitMaskImage:
              "linear-gradient(to left, black 0%, black 30%, transparent 100%)",
          }}
          aria-hidden="true"
        />

        <BorderBeam duration={8} />
      </div>
    </section>
  );
}
