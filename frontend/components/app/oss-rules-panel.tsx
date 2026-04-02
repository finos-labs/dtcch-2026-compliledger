"use client";

import { useState } from "react";
import { evaluateRulePack, type RulePack, type RulePackEvalResult } from "@/lib/api";

type Phase = "CLEARING" | "SETTLEMENT";
type DisplayDecision = "PASS" | "FAIL" | "CONDITIONAL";

interface RulePackConfig {
  id: RulePack;
  label: string;
  standard: string;
  version: string;
  phase: Phase;
  description: string;
  controls: string[];
  payload: Record<string, unknown>;
}

const RULE_PACKS: RulePackConfig[] = [
  {
    id: "ISDA",
    label: "ISDA",
    standard: "ISDA 2002 Master Agreement",
    version: "ISDA_SNIPPET_V1",
    phase: "CLEARING",
    description: "Counterparty validity and margin sufficiency controls.",
    controls: ["ISDA_COUNTERPARTY_VALID", "ISDA_MARGIN_SUFFICIENCY"],
    payload: {
      counterparty_status: "ACTIVE",
      required_margin: 1000000,
      posted_collateral_value: 1250000,
    },
  },
  {
    id: "ISLA",
    label: "ISLA",
    standard: "ISLA GMSLA 2010",
    version: "ISLA_SNIPPET_V1",
    phase: "SETTLEMENT",
    description: "Collateral eligibility and coverage controls for securities lending.",
    controls: ["ISLA_COLLATERAL_ELIGIBILITY", "ISLA_COLLATERAL_COVERAGE"],
    payload: {
      collateral_type: "GOVERNMENT_BOND",
      allowed_types: ["GOVERNMENT_BOND", "AGENCY_BOND"],
      collateral_value: 1020000,
      loan_value: 1000000,
      haircut: 0.05,
    },
  },
  {
    id: "ICMA",
    label: "ICMA",
    standard: "ICMA GMRA 2011",
    version: "ICMA_SNIPPET_V1",
    phase: "CLEARING",
    description: "Repo collateral sufficiency and maturity validation controls.",
    controls: ["ICMA_REPO_COLLATERAL_SUFFICIENCY", "ICMA_REPO_MATURITY_VALID"],
    payload: {
      purchase_price: 5000000,
      collateral_value: 5350000,
      haircut: 0.05,
      current_date: Date.now(),
      end_date: Date.now() + 7 * 24 * 60 * 60 * 1000,
    },
  },
];

function toDisplayDecision(result: RulePackEvalResult, totalControls: number): DisplayDecision {
  if (result.decision === "ALLOW") return "PASS";
  if (result.reason_codes.length < totalControls) return "CONDITIONAL";
  return "FAIL";
}

interface Props {
  dark: boolean;
}

export function OssRulesPanel({ dark }: Props) {
  const [results, setResults] = useState<Record<string, RulePackEvalResult | null>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string | null>>({});

  const card = dark ? "bg-[#111827] border-[#1e293b]" : "bg-white border-gray-200";
  const text = dark ? "text-gray-100" : "text-gray-900";
  const textMuted = dark ? "text-gray-400" : "text-gray-500";
  const textDim = dark ? "text-gray-500" : "text-gray-400";
  const mono = dark ? "text-emerald-400" : "text-emerald-700";
  const stepBg = dark ? "bg-[#0d1520] border-[#1e293b]" : "bg-gray-50 border-gray-200";
  const border = dark ? "border-[#1e293b]" : "border-gray-200";

  async function handleEvaluate(pack: RulePackConfig) {
    setLoading((p) => ({ ...p, [pack.id]: true }));
    setErrors((p) => ({ ...p, [pack.id]: null }));
    try {
      const result = await evaluateRulePack(pack.id, pack.payload);
      setResults((p) => ({ ...p, [pack.id]: result }));
    } catch (err) {
      setErrors((p) => ({
        ...p,
        [pack.id]: err instanceof Error ? err.message : "Evaluation failed",
      }));
    } finally {
      setLoading((p) => ({ ...p, [pack.id]: false }));
    }
  }

  return (
    <div className={`rounded-xl border ${card} p-5`}>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className={`text-sm font-semibold ${text}`}>OSS Rule Packs</h3>
          <p className={`mt-0.5 text-[11px] ${textMuted}`}>
            Open-source compliance controls — ISDA, ISLA, ICMA
          </p>
        </div>
        <span className={`rounded border px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider ${
          dark ? "border-emerald-500/30 text-emerald-400 bg-emerald-500/10" : "border-emerald-300 text-emerald-700 bg-emerald-50"
        }`}>
          SNIPPET MODE
        </span>
      </div>

      <div className="space-y-3">
        {RULE_PACKS.map((pack) => {
          const result = results[pack.id];
          const isLoading = loading[pack.id];
          const error = errors[pack.id];
          const displayDecision = result ? toDisplayDecision(result, pack.controls.length) : null;

          const decisionColor = displayDecision === "PASS"
            ? dark ? "bg-emerald-500/20 text-emerald-400" : "bg-emerald-100 text-emerald-700"
            : displayDecision === "CONDITIONAL"
            ? dark ? "bg-amber-500/20 text-amber-400" : "bg-amber-100 text-amber-700"
            : dark ? "bg-red-500/20 text-red-400" : "bg-red-100 text-red-600";

          const phaseColor = pack.phase === "CLEARING"
            ? dark ? "border-blue-500/30 text-blue-400" : "border-blue-200 text-blue-700"
            : dark ? "border-purple-500/30 text-purple-400" : "border-purple-200 text-purple-700";

          return (
            <div key={pack.id} className={`rounded-lg border p-3 ${stepBg}`}>
              <div className="mb-2 flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`font-mono text-xs font-bold ${mono}`}>{pack.label}</span>
                    <span className={`text-[10px] ${textDim}`}>{pack.standard}</span>
                    <span className={`rounded border px-1.5 py-0.5 font-mono text-[9px] font-semibold ${phaseColor}`}>
                      Phase: {pack.phase}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-2 flex-wrap">
                    <span className={`font-mono text-[9px] ${textDim}`}>
                      Rule Pack: <span className={mono}>{pack.version}</span>
                    </span>
                  </div>
                  <p className={`mt-0.5 text-[11px] ${textMuted}`}>{pack.description}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {displayDecision && (
                    <span className={`rounded px-2 py-0.5 font-mono text-[10px] font-bold ${decisionColor}`}>
                      {displayDecision}
                    </span>
                  )}
                  <button
                    onClick={() => handleEvaluate(pack)}
                    disabled={isLoading}
                    className={`rounded border px-2.5 py-1 text-[10px] font-semibold transition-colors disabled:opacity-50 ${
                      dark
                        ? "border-[#1e293b] text-gray-300 hover:border-emerald-500/50 hover:text-emerald-400"
                        : "border-gray-200 text-gray-600 hover:border-emerald-400 hover:text-emerald-700"
                    }`}
                  >
                    {isLoading ? (
                      <span className="flex items-center gap-1">
                        <span className="h-2.5 w-2.5 animate-spin rounded-full border border-emerald-500 border-t-transparent" />
                        Running
                      </span>
                    ) : result ? "Re-run" : "Run"}
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5 mb-2">
                {pack.controls.map((ctrl) => {
                  const isFailing = result?.reason_codes.includes(ctrl.replace(/_/g, "_")) ?? false;
                  const chipColor = result === null || result === undefined
                    ? dark ? "border-[#1e293b] text-gray-500" : "border-gray-200 text-gray-400"
                    : displayDecision === "PASS"
                    ? dark ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" : "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : displayDecision === "CONDITIONAL"
                    ? dark ? "border-amber-500/30 bg-amber-500/10 text-amber-400" : "border-amber-200 bg-amber-50 text-amber-700"
                    : dark ? "border-red-500/30 bg-red-500/10 text-red-400" : "border-red-200 bg-red-50 text-red-600";
                  return (
                    <span key={ctrl} className={`rounded border px-1.5 py-0.5 font-mono text-[9px] ${chipColor}`}>
                      {ctrl}
                    </span>
                  );
                })}
              </div>

              {error && (
                <p className={`text-[10px] ${dark ? "text-red-400" : "text-red-600"}`}>{error}</p>
              )}

              {result && result.reason_codes.length > 0 && (
                <div className={`mt-2 rounded border px-2 py-1.5 ${
                  displayDecision === "CONDITIONAL"
                    ? dark ? "border-amber-500/20 bg-amber-500/5" : "border-amber-100 bg-amber-50"
                    : dark ? "border-red-500/20 bg-red-500/5" : "border-red-100 bg-red-50"
                }`}>
                  <p className={`text-[9px] font-semibold uppercase tracking-wider mb-1 ${
                    displayDecision === "CONDITIONAL"
                      ? dark ? "text-amber-400" : "text-amber-700"
                      : dark ? "text-red-400" : "text-red-600"
                  }`}>Reason Codes</p>
                  <div className="flex flex-wrap gap-1">
                    {result.reason_codes.map((rc) => (
                      <span key={rc} className={`font-mono text-[9px] ${
                        displayDecision === "CONDITIONAL"
                          ? dark ? "text-amber-400" : "text-amber-700"
                          : dark ? "text-red-400" : "text-red-600"
                      }`}>
                        {rc}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {displayDecision === "PASS" && (
                <div className={`mt-2 flex items-center gap-1.5 rounded border px-2 py-1 ${
                  dark ? "border-emerald-500/20 bg-emerald-500/5" : "border-emerald-100 bg-emerald-50"
                }`}>
                  <svg className="h-3 w-3 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className={`text-[10px] font-medium ${dark ? "text-emerald-400" : "text-emerald-700"}`}>
                    All controls passed
                  </span>
                </div>
              )}

              {displayDecision === "CONDITIONAL" && (
                <div className={`mt-2 flex items-center gap-1.5 rounded border px-2 py-1 ${
                  dark ? "border-amber-500/20 bg-amber-500/5" : "border-amber-100 bg-amber-50"
                }`}>
                  <svg className="h-3 w-3 text-amber-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" />
                  </svg>
                  <span className={`text-[10px] font-medium ${dark ? "text-amber-400" : "text-amber-700"}`}>
                    Partial pass — manual review required
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className={`mt-3 border-t pt-3 ${border}`}>
        <p className={`text-[10px] leading-relaxed ${textDim}`}>
          OSS rule packs are open-source compliance snippets (1–2 controls each) contributed to the FINOS ecosystem.
          Each pack evaluates a structured payload against industry standard rules — ISDA 2002, ISLA GMSLA 2010, ICMA GMRA 2011.
        </p>
      </div>
    </div>
  );
}
