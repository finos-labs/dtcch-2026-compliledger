"use client";

import { useState, type ReactNode } from "react";
import { motion } from "motion/react";
import { Check, X, Landmark, Coins, FileKey2 } from "lucide-react";

const assetClasses = [
  { id: "securities", icon: Landmark, label: "Tokenized Securities" },
  { id: "stablecoins", icon: Coins, label: "Stablecoins" },
  { id: "digital", icon: FileKey2, label: "Digital Assets" },
];

const comparisonData = {
  securities: [
    {
      title: "Enforcement timing",
      description: "When compliance is evaluated relative to settlement",
      guard: "Pre-finality proof",
      traditional: "Post-trade audit",
    },
    {
      title: "Compliance method",
      description: "How regulatory conditions are verified",
      guard: "Deterministic check",
      traditional: "Periodic review",
    },
    {
      title: "Evidence type",
      description: "Format of the compliance attestation",
      guard: "Cryptographic proof",
      traditional: "Manual attestation",
    },
    {
      title: "Settlement risk",
      description: "Exposure to non-compliant settlement",
      guard: true,
      traditional: false,
    },
    {
      title: "On-chain anchoring",
      description: "Immutable proof committed to blockchain",
      guard: true,
      traditional: false,
    },
    {
      title: "Independent verification",
      description: "Third-party verifiable without trusted intermediary",
      guard: true,
      traditional: false,
    },
  ],
  stablecoins: [
    {
      title: "Reserve verification",
      description: "How backing reserves are validated",
      guard: "Real-time proof",
      traditional: "Monthly audit",
    },
    {
      title: "Redemption checks",
      description: "Compliance verification on redemption",
      guard: "Pre-finality gate",
      traditional: "Post-redemption review",
    },
    {
      title: "Issuer legitimacy",
      description: "Validation of the issuing entity",
      guard: "Cryptographic check",
      traditional: "Trust-based",
    },
    {
      title: "Custody conditions",
      description: "Enforcement of custodial requirements",
      guard: true,
      traditional: false,
    },
    {
      title: "Cross-chain proof",
      description: "Verification across multiple chains",
      guard: true,
      traditional: false,
    },
    {
      title: "Automated compliance",
      description: "Zero manual intervention in the enforcement loop",
      guard: true,
      traditional: false,
    },
  ],
  digital: [
    {
      title: "Asset classification",
      description: "Automated determination of regulatory category",
      guard: "Deterministic engine",
      traditional: "Legal opinion",
    },
    {
      title: "Transfer restrictions",
      description: "Enforcement of jurisdictional transfer rules",
      guard: "Pre-settlement gate",
      traditional: "Post-transfer review",
    },
    {
      title: "Proof bundle",
      description: "Tamper-proof evidence of compliance",
      guard: "Merkle root hash",
      traditional: "PDF report",
    },
    {
      title: "Real-time enforcement",
      description: "Compliance evaluated at transaction speed",
      guard: true,
      traditional: false,
    },
    {
      title: "Regulatory portability",
      description: "Proof accepted across jurisdictions",
      guard: true,
      traditional: false,
    },
    {
      title: "Deterministic outcome",
      description: "Same inputs always produce same compliance result",
      guard: true,
      traditional: false,
    },
  ],
};

export function SGComparison(): ReactNode {
  const [selectedClass, setSelectedClass] = useState("securities");

  const features =
    comparisonData[selectedClass as keyof typeof comparisonData];

  return (
    <section
      id="comparison"
      className="relative w-full px-4 py-20 sm:px-6 md:py-28 lg:px-8"
    >
      <div className="mx-auto w-full max-w-7xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-16 text-center"
        >
          <p className="mb-4 text-sm font-medium uppercase tracking-wider text-accent">
            The Core Shift
          </p>
          <h2 className="mb-6 text-3xl font-medium tracking-tight text-foreground sm:text-4xl md:text-5xl lg:text-6xl">
            SettlementGuard vs. Traditional
          </h2>
          <p className="mx-auto mb-8 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            SettlementGuard is the last gate before settlement is final. Not a
            settlement system, not a custody platform — the enforcement layer.
          </p>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="rounded-full bg-accent px-8 py-4 text-base font-medium text-accent-foreground transition-all hover:shadow-[0_0_30px_rgba(16,185,129,0.2)]"
          >
            Start Integration
          </motion.button>
        </motion.div>

        {/* Comparison Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="relative overflow-hidden rounded-3xl border border-foreground/5 bg-muted/30 p-1"
        >
          {/* Mobile Layout */}
          <div className="flex flex-col gap-4 lg:hidden">
            {/* Asset Class Toggle */}
            <div className="rounded-2xl bg-background p-6">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-medium text-foreground">
                  Compare by asset
                </h3>
                <p className="text-sm text-muted-foreground">
                  {
                    assetClasses.find((a) => a.id === selectedClass)
                      ?.label
                  }
                </p>
              </div>
              <div className="flex gap-3">
                {assetClasses.map((ac) => {
                  const Icon = ac.icon;
                  return (
                    <motion.button
                      key={ac.id}
                      onClick={() => setSelectedClass(ac.id)}
                      whileTap={{ scale: 0.95 }}
                      className={`flex h-12 w-12 items-center justify-center rounded-xl transition-all ${
                        selectedClass === ac.id
                          ? "bg-accent text-accent-foreground shadow-[0_0_20px_rgba(16,185,129,0.2)]"
                          : "bg-muted/50 text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      <Icon className="h-6 w-6" strokeWidth={1.5} />
                    </motion.button>
                  );
                })}
              </div>
            </div>

            {/* Mobile Cards */}
            {features.map((feature, index) => (
              <motion.div
                key={`${selectedClass}-${feature.title}-mobile`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
                className="overflow-hidden rounded-2xl bg-background"
              >
                <div className="border-b border-foreground/5 p-6">
                  <div className="text-lg font-bold text-foreground">
                    {feature.title}
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {feature.description}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-px bg-foreground/5">
                  <div className="bg-background p-6">
                    <div className="mb-3 text-base font-bold text-accent">
                      SettlementGuard
                    </div>
                    <div className="flex items-center justify-start">
                      {typeof feature.guard === "boolean" ? (
                        feature.guard ? (
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent">
                            <Check
                              className="h-6 w-6 text-accent-foreground"
                              strokeWidth={3}
                            />
                          </div>
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                            <X
                              className="h-6 w-6 text-muted-foreground"
                              strokeWidth={3}
                            />
                          </div>
                        )
                      ) : (
                        <span className="text-lg font-semibold text-foreground">
                          {feature.guard}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="bg-background p-6">
                    <div className="mb-3 text-base font-bold text-muted-foreground">
                      Traditional
                    </div>
                    <div className="flex items-center justify-start">
                      {typeof feature.traditional === "boolean" ? (
                        feature.traditional ? (
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent">
                            <Check
                              className="h-6 w-6 text-accent-foreground"
                              strokeWidth={3}
                            />
                          </div>
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                            <X
                              className="h-6 w-6 text-muted-foreground"
                              strokeWidth={3}
                            />
                          </div>
                        )
                      ) : (
                        <span className="text-lg font-semibold text-muted-foreground">
                          {feature.traditional}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Desktop Layout */}
          <div className="hidden lg:block">
            {/* Table Header */}
            <div className="grid grid-cols-[2fr_1fr_1fr] gap-1 border-b-4 border-foreground/5">
              {/* Column 1 - Asset Toggle */}
              <div className="flex items-center justify-between gap-6 rounded-tl-3xl bg-background p-8">
                <div>
                  <h3 className="mb-1 text-lg font-bold text-foreground">
                    Compare by asset class
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {
                      assetClasses.find((a) => a.id === selectedClass)
                        ?.label
                    }
                  </p>
                </div>
                <div className="flex gap-2">
                  {assetClasses.map((ac) => {
                    const Icon = ac.icon;
                    return (
                      <motion.button
                        key={ac.id}
                        onClick={() => setSelectedClass(ac.id)}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className={`flex h-10 w-10 items-center justify-center rounded-lg transition-all ${
                          selectedClass === ac.id
                            ? "bg-accent text-accent-foreground shadow-[0_0_15px_rgba(16,185,129,0.15)]"
                            : "bg-muted/50 text-muted-foreground hover:bg-muted"
                        }`}
                      >
                        <Icon className="h-5 w-5" strokeWidth={1.5} />
                      </motion.button>
                    );
                  })}
                </div>
              </div>

              {/* Column 2 - SettlementGuard (Highlighted) */}
              <div className="relative overflow-hidden px-12 py-8">
                <div
                  className="absolute inset-0 z-0"
                  style={{
                    background:
                      "radial-gradient(165% 165% at 50% 90%, var(--background) 40%, #10B981 100%)",
                  }}
                />
                <div className="relative z-10 text-center">
                  <div className="mb-1 text-2xl font-bold text-foreground">
                    SettlementGuard
                  </div>
                  <div className="text-sm font-medium text-accent">
                    ENFORCEMENT ↗
                  </div>
                </div>
              </div>

              {/* Column 3 - Traditional */}
              <div className="rounded-tr-3xl bg-background px-12 py-8">
                <div className="text-center">
                  <div className="mb-1 text-2xl font-bold text-foreground">
                    Traditional
                  </div>
                  <div className="text-sm font-medium text-muted-foreground">
                    LEGACY
                  </div>
                </div>
              </div>
            </div>

            {/* Table Body */}
            {features.map((feature, index) => (
              <div
                key={feature.title}
                className="grid grid-cols-[2fr_1fr_1fr] gap-1"
              >
                {/* Feature Info */}
                <div
                  className={`bg-background p-8 ${
                    index === features.length - 1 ? "rounded-bl-3xl" : ""
                  }`}
                >
                  <div className="font-semibold text-foreground">
                    {feature.title}
                  </div>
                  <div className="mt-1 max-w-xs text-sm text-muted-foreground">
                    {feature.description}
                  </div>
                </div>

                {/* SettlementGuard Value */}
                <div className="bg-background px-12 py-8">
                  <motion.div
                    key={`${selectedClass}-guard-${feature.title}`}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3 }}
                    className="flex items-center justify-center"
                  >
                    {typeof feature.guard === "boolean" ? (
                      feature.guard ? (
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent">
                          <Check
                            className="h-5 w-5 text-accent-foreground"
                            strokeWidth={3}
                          />
                        </div>
                      ) : (
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                          <X
                            className="h-5 w-5 text-muted-foreground"
                            strokeWidth={3}
                          />
                        </div>
                      )
                    ) : (
                      <span className="text-center font-semibold text-foreground">
                        {feature.guard}
                      </span>
                    )}
                  </motion.div>
                </div>

                {/* Traditional Value */}
                <div
                  className={`bg-background px-12 py-8 ${
                    index === features.length - 1 ? "rounded-br-3xl" : ""
                  }`}
                >
                  <motion.div
                    key={`${selectedClass}-trad-${feature.title}`}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3 }}
                    className="flex items-center justify-center"
                  >
                    {typeof feature.traditional === "boolean" ? (
                      feature.traditional ? (
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent">
                          <Check
                            className="h-5 w-5 text-accent-foreground"
                            strokeWidth={3}
                          />
                        </div>
                      ) : (
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                          <X
                            className="h-5 w-5 text-muted-foreground"
                            strokeWidth={3}
                          />
                        </div>
                      )
                    ) : (
                      <span className="text-center font-semibold text-muted-foreground">
                        {feature.traditional}
                      </span>
                    )}
                  </motion.div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
