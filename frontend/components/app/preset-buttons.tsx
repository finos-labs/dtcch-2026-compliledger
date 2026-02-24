"use client";

import { type ReactNode } from "react";
import { Shield, ShieldX, Banknote, Landmark } from "lucide-react";
import { runPreset, type EnforcementResult } from "@/lib/api";

interface PresetButtonsProps {
  onResult: (result: EnforcementResult) => void;
  loading: boolean;
  setLoading: (loading: boolean) => void;
}

const PRESETS = [
  {
    id: "stablecoin-pass",
    label: "Stablecoin PASS",
    icon: Banknote,
    expected: "ALLOW" as const,
    scenario: "NovaUSD redemption — $25M transfer",
    detail: "Reserve ratio 1.02, segregated custody, issuer active",
  },
  {
    id: "treasury-pass",
    label: "Treasury PASS",
    icon: Landmark,
    expected: "ALLOW" as const,
    scenario: "Atlas T-bill transfer — $10M settlement",
    detail: "CUSIP verified, position available, not encumbered",
  },
  {
    id: "stablecoin-fail",
    label: "Stablecoin FAIL",
    icon: Banknote,
    expected: "DENY" as const,
    scenario: "Reserve ratio below 1:1 threshold",
    detail: "Reserves $4M vs $5M settlement — insufficient",
  },
  {
    id: "treasury-fail",
    label: "Treasury FAIL",
    icon: Landmark,
    expected: "DENY" as const,
    scenario: "Custody position insufficient",
    detail: "Position 1M vs 2M requested — shortfall",
  },
];

export function PresetButtons({ onResult, loading, setLoading }: PresetButtonsProps): ReactNode {
  async function handlePreset(presetId: string) {
    setLoading(true);
    try {
      const result = await runPreset(presetId);
      onResult(result);
    } catch (err) {
      console.error("Preset execution failed:", err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <Shield className="h-4 w-4 text-emerald-600" />
        <h2 className="text-sm font-semibold text-gray-900">Settlement Scenarios</h2>
      </div>
      <p className="mb-4 text-xs leading-relaxed text-gray-400">
        Each scenario submits a real settlement intent through the 4-step Canonical Proof Chain.
        ALLOW scenarios auto-anchor to Canton and generate AI analysis.
      </p>
      <div className="space-y-2.5">
        {PRESETS.map((preset) => {
          const Icon = preset.icon;
          const isAllow = preset.expected === "ALLOW";
          return (
            <button
              key={preset.id}
              type="button"
              disabled={loading}
              onClick={() => handlePreset(preset.id)}
              className={`group flex w-full cursor-pointer items-start gap-3 rounded-xl border p-3.5 text-left transition-all duration-200 disabled:opacity-50 ${
                isAllow
                  ? "border-emerald-200 bg-emerald-50/50 hover:border-emerald-300 hover:bg-emerald-50 hover:shadow-sm"
                  : "border-red-200 bg-red-50/50 hover:border-red-300 hover:bg-red-50 hover:shadow-sm"
              }`}
            >
              <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                isAllow ? "bg-emerald-100" : "bg-red-100"
              }`}>
                <Icon className={`h-4 w-4 ${isAllow ? "text-emerald-600" : "text-red-500"}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-gray-900">{preset.label}</span>
                  <span className={`rounded-full px-1.5 py-0.5 font-mono text-[9px] font-bold ${
                    isAllow ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"
                  }`}>
                    {preset.expected}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-gray-600">{preset.scenario}</p>
                <p className="mt-0.5 text-[11px] text-gray-400">{preset.detail}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
