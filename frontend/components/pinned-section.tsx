"use client";

import { useRef, useEffect, type ReactNode } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const steps = [
  {
    number: "01",
    title: "Settlement Intent Submitted",
    description:
      "An institution initiates settlement. SettlementGuard intercepts the request before finality — this is the enforcement window.",
    detail: "Asset type, counterparties, and parameters are captured.",
  },
  {
    number: "02",
    title: "Canonical Proof Chain Executes",
    description:
      "Four deterministic checks run in sequence: Issuer Legitimacy, Asset Classification, Custody Conditions, and Reserve Backing.",
    detail: "Every input, decision, and hash is recorded immutably.",
  },
  {
    number: "03",
    title: "Proof Bundle Sealed",
    description:
      "Results are sealed into a tamper-evident bundle — the Single Source of Proof. Any modification is cryptographically detectable.",
    detail: "SHA-256 hashes bind every element together.",
  },
  {
    number: "04",
    title: "Attestation Issued & Anchored",
    description:
      "If all checks pass, a signed attestation is issued and its hash is anchored on-chain. Settlement proceeds with proof.",
    detail: "Independently verifiable by any authorized party.",
  },
];

export function PinnedSection(): ReactNode {
  const containerRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      if (!containerRef.current || !progressRef.current) return;

      const stepElements = containerRef.current.querySelectorAll("[data-step]");

      gsap.to(progressRef.current, {
        scaleY: 1,
        ease: "none",
        scrollTrigger: {
          trigger: containerRef.current,
          start: "top top",
          end: "bottom bottom",
          scrub: 0.5,
        },
      });

      stepElements.forEach((step) => {
        gsap.fromTo(
          step,
          {
            opacity: 0.15,
            y: 30,
          },
          {
            opacity: 1,
            y: 0,
            duration: 0.5,
            scrollTrigger: {
              trigger: step,
              start: "top 70%",
              end: "top 30%",
              scrub: true,
            },
          }
        );

        const numberEl = step.querySelector("[data-step-number]");
        if (numberEl) {
          gsap.fromTo(
            numberEl,
            { scale: 0.5, opacity: 0 },
            {
              scale: 1,
              opacity: 1,
              duration: 0.4,
              scrollTrigger: {
                trigger: step,
                start: "top 65%",
                end: "top 40%",
                scrub: true,
              },
            }
          );
        }
      });
    }, containerRef);

    return () => ctx.revert();
  }, []);

  return (
    <section className="relative px-4 sm:px-6 lg:px-8">
      <div
        ref={containerRef}
        className="relative mx-auto max-w-5xl py-20 md:py-28"
      >
        <div className="mb-16 text-center">
          <p className="mb-4 text-sm font-medium uppercase tracking-wider text-accent">
            The Enforcement Flow
          </p>
          <h2 className="text-3xl font-medium tracking-tight text-foreground sm:text-4xl md:text-5xl">
            From intent to proof — in milliseconds
          </h2>
        </div>

        <div className="absolute left-8 top-48 bottom-20 hidden w-px md:block">
          <div className="h-full w-full bg-foreground/5" />
          <div
            ref={progressRef}
            className="absolute inset-x-0 top-0 origin-top bg-gradient-to-b from-accent to-sg-teal"
            style={{ height: "100%", transform: "scaleY(0)" }}
          />
        </div>

        <div className="space-y-24 md:space-y-32 md:pl-24">
          {steps.map((step) => (
            <div
              key={step.number}
              data-step
              className="relative"
            >
              <div
                data-step-number
                className="absolute -left-24 top-0 hidden h-12 w-12 items-center justify-center rounded-full border border-accent/20 bg-accent/10 font-mono text-sm font-bold text-accent md:flex"
              >
                {step.number}
              </div>

              <div className="rounded-2xl border border-foreground/5 bg-muted/20 p-8 transition-colors hover:border-accent/10 hover:bg-muted/40 sm:p-10">
                <span className="mb-4 inline-block rounded-full bg-accent/10 px-3 py-1 font-mono text-xs font-medium text-accent md:hidden">
                  Step {step.number}
                </span>
                <h3 className="text-2xl font-medium tracking-tight text-foreground sm:text-3xl">
                  {step.title}
                </h3>
                <p className="mt-4 max-w-xl text-base leading-relaxed text-muted-foreground">
                  {step.description}
                </p>
                <p className="mt-3 text-sm text-foreground/40">
                  {step.detail}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
