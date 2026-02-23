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
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileCheck className="h-4 w-4 text-emerald-600" />
          <h2 className="text-sm font-semibold text-gray-900">Canonical Proof Chain</h2>
        </div>
        <span className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 font-mono text-xs text-gray-500">
          {bundle.asset_type === "tokenized_treasury" ? "Tokenized Treasury" : "Stablecoin"}
        </span>
      </div>

      <div className="space-y-3">
        {bundle.steps.map((step, i) => (
          <motion.div
            key={step.step_name}
            className={`flex items-start gap-3 rounded-xl p-4 ${
              step.pass
                ? "border border-emerald-200 bg-emerald-50"
                : "border border-red-200 bg-red-50"
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
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
              ) : (
                <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
              )}
            </motion.div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">
                {STEP_LABELS[step.step_name] || step.step_name}
              </p>
              {step.reason_codes.length > 0 && (
                <p className="mt-1 font-mono text-xs text-red-500">
                  {step.reason_codes.join(", ")}
                </p>
              )}
              <p className="mt-1 font-mono text-[10px] text-gray-400">
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
            ? "border border-emerald-300 bg-emerald-50"
            : "border border-red-300 bg-red-50"
        }`}
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.35, delay: 0.6 }}
      >
        {decision.decision === "ALLOW" ? (
          <CheckCircle2 className="h-7 w-7 text-emerald-600" />
        ) : (
          <XCircle className="h-7 w-7 text-red-500" />
        )}
        <div>
          <p
            className={`text-xl font-bold ${
              decision.decision === "ALLOW" ? "text-emerald-700" : "text-red-600"
            }`}
          >
            {decision.decision}
          </p>
          <p className="mt-0.5 text-xs text-gray-500">
            {decision.decision === "ALLOW"
              ? "All checks passed. Attestation issued."
              : "Enforcement failed. No attestation issued."}
          </p>
        </div>
      </motion.div>

      {/* Bundle Root Hash */}
      <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4">
        <p className="text-xs font-medium text-gray-500">bundle_root_hash</p>
        <p className="mt-1 break-all font-mono text-xs text-gray-800">
          {bundle.bundle_root_hash}
        </p>
        <p className="mt-2 text-xs font-medium text-gray-500">decision_hash</p>
        <p className="mt-1 break-all font-mono text-xs text-gray-800">
          {decision.decision_hash}
        </p>
      </div>
    </div>
  );
}
