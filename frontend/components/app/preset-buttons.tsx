"use client";

import { type ReactNode } from "react";
import { runPreset, type EnforcementResult } from "@/lib/api";

interface PresetButtonsProps {
  onResult: (result: EnforcementResult) => void;
  loading: boolean;
  setLoading: (loading: boolean) => void;
}

const PRESETS = [
  {
    id: "treasury-fail",
    label: "Treasury FAIL",
    assetType: "Tokenized Treasury",
    expected: "DENY",
    description: "Custody invalid",
  },
  {
    id: "stablecoin-fail",
    label: "Stablecoin FAIL",
    assetType: "Stablecoin",
    expected: "DENY",
    description: "Reserve ratio 0.97",
  },
  {
    id: "treasury-pass",
    label: "Treasury PASS",
    assetType: "Tokenized Treasury",
    expected: "ALLOW",
    description: "Fully compliant",
  },
  {
    id: "stablecoin-pass",
    label: "Stablecoin PASS",
    assetType: "Stablecoin",
    expected: "ALLOW",
    description: "Reserve ratio 1.02",
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
    <div className="rounded-2xl border border-foreground/5 bg-muted/10 p-5">
      <h2 className="mb-1 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        Demo Presets
      </h2>
      <p className="mb-4 text-xs text-muted-foreground/70">
        Each button submits a preset settlement intent through the Canonical Proof Chain.
      </p>
      <div className="grid grid-cols-2 gap-3">
        {PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            disabled={loading}
            onClick={() => handlePreset(preset.id)}
            className={`group flex cursor-pointer flex-col items-start gap-1.5 rounded-xl border p-4 text-left transition-all duration-200 disabled:opacity-50 ${
              preset.expected === "ALLOW"
                ? "border-sg-success/15 bg-sg-success/5 hover:border-sg-success/30 hover:bg-sg-success/10"
                : "border-sg-deny/15 bg-sg-deny/5 hover:border-sg-deny/30 hover:bg-sg-deny/10"
            }`}
          >
            <div className="flex w-full items-center justify-between">
              <span className="text-xs text-muted-foreground">{preset.assetType}</span>
              <span
                className={`rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold ${
                  preset.expected === "ALLOW"
                    ? "bg-sg-success/10 text-sg-success"
                    : "bg-sg-deny/10 text-sg-deny"
                }`}
              >
                {preset.expected}
              </span>
            </div>
            <span className="text-sm font-semibold text-foreground">{preset.label}</span>
            <span className="text-xs text-muted-foreground/70">{preset.description}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
