"use client";

import { useState, useRef, type ReactNode } from "react";
import { SGHeader } from "@/components/sg-header";
import { SGFooter } from "@/components/sg-footer";
import { ThemeSwitch } from "@/components/theme-switch";
import { ProofChainPanel } from "@/components/app/proof-chain-panel";
import { AttestationPanel } from "@/components/app/attestation-panel";
import { AnchorPanel } from "@/components/app/anchor-panel";
import { VerifyPanel } from "@/components/app/verify-panel";
import { PresetButtons } from "@/components/app/preset-buttons";
import { ReasoningPanel } from "@/components/app/reasoning-panel";
import { CantonStatus } from "@/components/app/canton-status";
import type { EnforcementResult } from "@/lib/api";

export default function AppPage(): ReactNode {
  const [result, setResult] = useState<EnforcementResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [autoAnchor, setAutoAnchor] = useState(true);
  const anchorRef = useRef<{ triggerAnchor: () => void }>(null);
  const reasoningRef = useRef<{ triggerGenerate: () => void }>(null);

  function handleResult(r: EnforcementResult) {
    setResult(r);
    if (autoAnchor && r.decision.decision === "ALLOW" && r.attestation) {
      setTimeout(() => {
        anchorRef.current?.triggerAnchor();
        reasoningRef.current?.triggerGenerate();
      }, 600);
    }
  }

  return (
    <div className="sg-light-dashboard">
      <SGHeader />
      <ThemeSwitch />
      <main className="mx-auto min-h-screen max-w-7xl px-4 pb-24 pt-28 sm:px-6 lg:px-8">
        <div className="mb-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-gray-900 sm:text-3xl">
                Enforcement Console
              </h1>
              <p className="mt-1 max-w-xl text-sm text-gray-500">
                Run settlement intents through the Canonical Proof Chain, anchor to Canton, and verify with AI.
              </p>
            </div>
            <CantonStatus />
          </div>
          <div className="mt-3 h-px bg-gradient-to-r from-emerald-200 via-teal-200 to-transparent" />
        </div>

        <div className="grid gap-6 lg:grid-cols-12">
          {/* Left Column — Controls */}
          <div className="space-y-5 lg:col-span-4">
            <PresetButtons
              onResult={handleResult}
              loading={loading}
              setLoading={setLoading}
            />

            <label className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 text-xs text-gray-600">
              <input
                type="checkbox"
                checked={autoAnchor}
                onChange={(e) => setAutoAnchor(e.target.checked)}
                className="rounded border-gray-300 accent-teal-600"
              />
              Auto-anchor & analyze on ALLOW
            </label>

            <VerifyPanel />
          </div>

          {/* Right Column — Results */}
          <div className="space-y-5 lg:col-span-8">
            {!result && !loading && (
              <div className="flex min-h-[420px] flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-gray-50/50">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
                  <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-gray-400">
                  Select a scenario to begin enforcement
                </p>
                <p className="mt-1 text-xs text-gray-300">
                  4 preset scenarios available
                </p>
              </div>
            )}

            {loading && (
              <div className="flex min-h-[420px] items-center justify-center rounded-2xl border border-gray-200 bg-gray-50/50">
                <div className="flex flex-col items-center gap-3">
                  <div className="relative">
                    <div className="h-10 w-10 animate-spin rounded-full border-2 border-emerald-200 border-t-emerald-600" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="h-3 w-3 rounded-full bg-emerald-500 animate-pulse" />
                    </div>
                  </div>
                  <p className="text-sm font-medium text-gray-500">
                    Evaluating Proof Chain...
                  </p>
                </div>
              </div>
            )}

            {result && !loading && (
              <>
                <ProofChainPanel result={result} />
                {result.attestation && (
                  <AttestationPanel result={result} />
                )}
                {result.attestation && (
                  <AnchorPanel ref={anchorRef} intentId={result.id} anchor={result.anchor} />
                )}
                <ReasoningPanel ref={reasoningRef} intentId={result.id} />
              </>
            )}
          </div>
        </div>
      </main>
      <SGFooter />
    </div>
  );
}
