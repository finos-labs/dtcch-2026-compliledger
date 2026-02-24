"use client";

import { type ReactNode } from "react";
import { motion } from "motion/react";
import { CheckCircle2, XCircle, FileCheck, ArrowDown } from "lucide-react";
import type { EnforcementResult } from "@/lib/api";

const STEP_META: Record<string, { label: string; desc: string }> = {
  issuer_legitimacy: { label: "Issuer Legitimacy", desc: "Entity registration, keys, jurisdiction" },
  asset_classification: { label: "Asset Classification", desc: "Asset type, regulatory category, eligibility" },
  custody_conditions: { label: "Custody Conditions", desc: "Segregated custody, position, encumbrance" },
  backing_reserve: { label: "Backing & Reserve", desc: "Reserve ratio, collateral adequacy" },
};

export function ProofChainPanel({ result }: { result: EnforcementResult }): ReactNode {
  const { bundle, decision } = result;
  const allPassed = bundle.steps.every((s) => s.pass);

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50/50 px-6 py-4">
        <div className="flex items-center gap-2">
          <FileCheck className="h-4 w-4 text-emerald-600" />
          <h2 className="text-sm font-semibold text-gray-900">Canonical Proof Chain</h2>
          <span className="ml-1 rounded-md bg-gray-100 px-2 py-0.5 font-mono text-[10px] text-gray-500">
            4 steps
          </span>
        </div>
        <span className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-gray-600">
          {bundle.asset_type === "tokenized_treasury" ? "Tokenized Treasury" : "Stablecoin"}
        </span>
      </div>

      <div className="p-6">
        <div className="relative">
          {bundle.steps.map((step, i) => {
            const meta = STEP_META[step.step_name] || { label: step.step_name, desc: "" };
            const isLast = i === bundle.steps.length - 1;
            return (
              <motion.div
                key={step.step_name}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.35, delay: i * 0.12 }}
              >
                <div className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <motion.div
                      className={`flex h-9 w-9 items-center justify-center rounded-full border-2 ${
                        step.pass
                          ? "border-emerald-300 bg-emerald-50"
                          : "border-red-300 bg-red-50"
                      }`}
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ duration: 0.25, delay: i * 0.12 + 0.1 }}
                    >
                      {step.pass ? (
                        <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-500" />
                      )}
                    </motion.div>
                    {!isLast && (
                      <motion.div
                        className={`w-0.5 flex-1 my-1 ${
                          step.pass ? "bg-emerald-200" : "bg-red-200"
                        }`}
                        initial={{ scaleY: 0 }}
                        animate={{ scaleY: 1 }}
                        transition={{ duration: 0.3, delay: i * 0.12 + 0.2 }}
                        style={{ originY: 0 }}
                      />
                    )}
                  </div>
                  <div className={`flex-1 pb-4 ${isLast ? "pb-0" : ""}`}>
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[9px] font-bold text-gray-500">
                        STEP {i + 1}
                      </span>
                      <span className={`font-mono text-[9px] font-bold ${
                        step.pass ? "text-emerald-600" : "text-red-500"
                      }`}>
                        {step.pass ? "PASS" : "FAIL"}
                      </span>
                    </div>
                    <p className="mt-1 text-sm font-semibold text-gray-900">{meta.label}</p>
                    <p className="mt-0.5 text-xs text-gray-500">{meta.desc}</p>
                    {step.reason_codes.length > 0 && (
                      <p className="mt-1 rounded-md bg-red-50 px-2 py-1 font-mono text-xs text-red-600">
                        {step.reason_codes.join(", ")}
                      </p>
                    )}
                    <p className="mt-1 font-mono text-[10px] text-gray-300">
                      {step.normalized_inputs_hash.slice(0, 24)}...
                    </p>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        <motion.div
          className={`mt-5 flex items-center gap-3 rounded-xl p-4 ${
            decision.decision === "ALLOW"
              ? "border-2 border-emerald-300 bg-gradient-to-r from-emerald-50 to-teal-50"
              : "border-2 border-red-300 bg-gradient-to-r from-red-50 to-orange-50"
          }`}
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.35, delay: 0.6 }}
        >
          {decision.decision === "ALLOW" ? (
            <CheckCircle2 className="h-8 w-8 text-emerald-600" />
          ) : (
            <XCircle className="h-8 w-8 text-red-500" />
          )}
          <div>
            <p className={`text-2xl font-bold tracking-tight ${
              decision.decision === "ALLOW" ? "text-emerald-700" : "text-red-600"
            }`}>
              {decision.decision}
            </p>
            <p className="text-xs text-gray-500">
              {decision.decision === "ALLOW"
                ? "All 4 checks passed. Proof bundle sealed. Attestation issued."
                : `${bundle.steps.filter((s) => !s.pass).length} check(s) failed. Settlement blocked pre-finality.`}
            </p>
          </div>
        </motion.div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
            <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400">Bundle Root</p>
            <p className="mt-1 break-all font-mono text-[11px] text-gray-700">
              {bundle.bundle_root_hash.slice(0, 32)}...
            </p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
            <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400">Decision Hash</p>
            <p className="mt-1 break-all font-mono text-[11px] text-gray-700">
              {decision.decision_hash.slice(0, 32)}...
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
