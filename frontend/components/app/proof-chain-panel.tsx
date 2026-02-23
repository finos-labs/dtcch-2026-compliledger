"use client";

import { type ReactNode } from "react";
import { motion } from "motion/react";
import { CheckCircle2, XCircle, FileCheck } from "lucide-react";
import type { EnforcementResult } from "@/lib/api";

const STEP_LABELS: Record<string, string> = {
  issuer_legitimacy: "Issuer Legitimacy",
  asset_classification: "Asset Classification",
  custody_conditions: "Custody Conditions",
  backing_reserve: "Backing & Reserve",
};

export function ProofChainPanel({ result }: { result: EnforcementResult }): ReactNode {
  const { bundle, decision } = result;

  return (
    <div className="rounded-2xl border border-foreground/5 bg-muted/10 p-6">
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileCheck className="h-4 w-4 text-accent" />
          <h2 className="text-sm font-semibold text-foreground">Canonical Proof Chain</h2>
        </div>
        <span className="rounded-full border border-foreground/5 bg-background/50 px-3 py-1 font-mono text-xs text-muted-foreground">
          {bundle.asset_type === "tokenized_treasury" ? "Tokenized Treasury" : "Stablecoin"}
        </span>
      </div>

      <div className="space-y-3">
        {bundle.steps.map((step, i) => (
          <motion.div
            key={step.step_name}
            className={`flex items-start gap-3 rounded-xl p-4 ${
              step.pass
                ? "border border-sg-success/10 bg-sg-success/5"
                : "border border-sg-deny/10 bg-sg-deny/5"
            }`}
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.35, delay: i * 0.12 }}
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.25, delay: i * 0.12 + 0.15 }}
            >
              {step.pass ? (
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-sg-success" />
              ) : (
                <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-sg-deny" />
              )}
            </motion.div>
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">
                {STEP_LABELS[step.step_name] || step.step_name}
              </p>
              {step.reason_codes.length > 0 && (
                <p className="mt-1 font-mono text-xs text-sg-deny/80">
                  {step.reason_codes.join(", ")}
                </p>
              )}
              <p className="mt-1 font-mono text-[10px] text-muted-foreground/60">
                hash: {step.normalized_inputs_hash.slice(0, 16)}...
              </p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Decision */}
      <motion.div
        className={`mt-4 flex items-center gap-3 rounded-xl p-5 ${
          decision.decision === "ALLOW"
            ? "border border-accent/20 bg-accent/10"
            : "border border-sg-deny/20 bg-sg-deny/10"
        }`}
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.35, delay: 0.6 }}
      >
        {decision.decision === "ALLOW" ? (
          <CheckCircle2 className="h-7 w-7 text-accent" />
        ) : (
          <XCircle className="h-7 w-7 text-sg-deny" />
        )}
        <div>
          <p
            className={`text-xl font-bold ${
              decision.decision === "ALLOW" ? "text-accent" : "text-sg-deny"
            }`}
          >
            {decision.decision}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {decision.decision === "ALLOW"
              ? "All checks passed. Attestation issued."
              : "Enforcement failed. No attestation issued."}
          </p>
        </div>
      </motion.div>

      {/* Bundle Root Hash */}
      <div className="mt-4 rounded-xl border border-foreground/5 bg-muted/20 p-4">
        <p className="text-xs font-medium text-muted-foreground">bundle_root_hash</p>
        <p className="mt-1 break-all font-mono text-xs text-foreground">
          {bundle.bundle_root_hash}
        </p>
        <p className="mt-2 text-xs font-medium text-muted-foreground">decision_hash</p>
        <p className="mt-1 break-all font-mono text-xs text-foreground">
          {decision.decision_hash}
        </p>
      </div>
    </div>
  );
}
