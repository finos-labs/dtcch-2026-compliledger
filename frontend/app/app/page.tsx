"use client";

import { useState, type ReactNode } from "react";
import { SGHeader } from "@/components/sg-header";
import { SGFooter } from "@/components/sg-footer";
import { ThemeSwitch } from "@/components/theme-switch";
import { ProofChainPanel } from "@/components/app/proof-chain-panel";
import { AttestationPanel } from "@/components/app/attestation-panel";
import { AnchorPanel } from "@/components/app/anchor-panel";
import { VerifyPanel } from "@/components/app/verify-panel";
import { PresetButtons } from "@/components/app/preset-buttons";
import { ReasoningPanel } from "@/components/app/reasoning-panel";
import type { EnforcementResult } from "@/lib/api";

export default function AppPage(): ReactNode {
  const [result, setResult] = useState<EnforcementResult | null>(null);
  const [loading, setLoading] = useState(false);

  return (
    <div className="sg-light-dashboard">
      <SGHeader />
      <ThemeSwitch />
      <main className="mx-auto min-h-screen max-w-7xl px-4 pb-24 pt-28 sm:px-6 lg:px-8">
        <div className="mb-10">
          <h1 className="text-3xl font-medium tracking-tight text-gray-900 md:text-4xl">
            SettlementGuard Enforcement Console
          </h1>
          <p className="mt-2 max-w-2xl text-base text-gray-500">
            Run a settlement intent through the Canonical Proof Chain. Select a
            preset scenario to begin.
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-12">
          {/* Left Column — Controls */}
          <div className="space-y-6 lg:col-span-4">
            <PresetButtons
              onResult={setResult}
              loading={loading}
              setLoading={setLoading}
            />
            <VerifyPanel />
          </div>

          {/* Right Column — Results */}
          <div className="space-y-6 lg:col-span-8">
            {!result && !loading && (
              <div className="flex min-h-[400px] items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-gray-50">
                <p className="text-sm text-gray-400">
                  Select a scenario to see enforcement results
                </p>
              </div>
            )}

            {loading && (
              <div className="flex min-h-[400px] items-center justify-center rounded-2xl border border-gray-200 bg-gray-50">
                <div className="flex flex-col items-center gap-3">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
                  <p className="text-sm text-gray-500">
                    Running Canonical Proof Chain...
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
                  <AnchorPanel intentId={result.id} anchor={result.anchor} />
                )}
                <ReasoningPanel intentId={result.id} />
              </>
            )}
          </div>
        </div>
      </main>
      <SGFooter />
    </div>
  );
}
