"use client";

import { useState, useRef, useEffect, type ReactNode } from "react";
import { SGHeader } from "@/components/sg-header";
import { SGFooter } from "@/components/sg-footer";
import {
  runPreset,
  anchorAttestation,
  fetchReasoning,
  fetchAlgorandStatus,
  type EnforcementResult,
  type AlgorandAnchorResponse,
  type ComplianceReasoning,
  type AlgorandNetworkStatus,
} from "@/lib/api";

const SCENARIOS = [
  {
    id: "stablecoin-pass",
    label: "Stablecoin PASS",
    short: "ALLOW" as const,
    asset: "USDX-002",
    amount: "$5,000,000",
    issuer: "Regulated Stablecoin Corp",
    scenario: "Stablecoin redemption with sufficient reserves (1.02 ratio), segregated custody, and active issuer.",
    outcome: "All 4 checks pass. Attestation issued. Anchored to Algorand.",
  },
  {
    id: "treasury-pass",
    label: "Treasury PASS",
    short: "ALLOW" as const,
    asset: "USTB-2026-002",
    amount: "$10,000,000",
    issuer: "US Treasury Digital Securities",
    scenario: "Tokenized T-bill transfer. CUSIP verified, custody position available, not encumbered.",
    outcome: "All 4 checks pass. Attestation issued. Anchored to Algorand.",
  },
  {
    id: "stablecoin-fail",
    label: "Stablecoin FAIL",
    short: "DENY" as const,
    asset: "USDX-001",
    amount: "$5,000,000",
    issuer: "Regulated Stablecoin Corp",
    scenario: "Reserve ratio 0.97 — below the required 1:1 threshold at time of settlement.",
    outcome: "Backing check fails. No attestation. Settlement blocked.",
  },
  {
    id: "treasury-fail",
    label: "Treasury FAIL",
    short: "DENY" as const,
    asset: "USTB-2026-001",
    amount: "$10,000,000",
    issuer: "US Treasury Digital Securities",
    scenario: "Custody position flagged as invalid — assets may be encumbered or insufficient.",
    outcome: "Custody check fails. No attestation. Settlement blocked.",
  },
];

function formatTime(iso: string) {
  return iso.replace("T", " ").slice(11, 22) + "Z";
}

function truncHash(h: string, n = 20) {
  return h.length > n ? h.slice(0, n) + "..." : h;
}

export default function AppPage(): ReactNode {
  const [result, setResult] = useState<EnforcementResult | null>(null);
  const [anchorData, setAnchorData] = useState<AlgorandAnchorResponse | null>(null);
  const [reasoning, setReasoning] = useState<ComplianceReasoning | null>(null);
  const [algorandStatus, setAlgorandStatus] = useState<AlgorandNetworkStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [dark, setDark] = useState(false);

  useEffect(() => {
    fetchAlgorandStatus().then(setAlgorandStatus).catch(() => {});
  }, []);

  async function handleRun(presetId: string) {
    setLoading(true);
    setActivePreset(presetId);
    setAnchorData(null);
    setReasoning(null);
    try {
      const r = await runPreset(presetId);
      setResult(r);
      if (r.decision.decision === "ALLOW" && r.attestation) {
        const anchor = await anchorAttestation(r.id);
        setAnchorData(anchor);
        const ai = await fetchReasoning(r.id);
        setReasoning(ai);
      }
    } catch (err) {
      console.error("Execution failed:", err);
    } finally {
      setLoading(false);
    }
  }

  const bg = dark ? "bg-[#0a0f1a]" : "bg-gray-50";
  const card = dark ? "bg-[#111827] border-[#1e293b]" : "bg-white border-gray-200";
  const text = dark ? "text-gray-100" : "text-gray-900";
  const textMuted = dark ? "text-gray-400" : "text-gray-500";
  const textDim = dark ? "text-gray-500" : "text-gray-400";
  const mono = dark ? "text-emerald-400" : "text-emerald-700";
  const border = dark ? "border-[#1e293b]" : "border-gray-200";
  const stepBg = dark ? "bg-[#0d1520] border-[#1e293b]" : "bg-gray-50 border-gray-200";
  const barBg = dark ? "bg-[#0d1520] border-[#1e293b]" : "bg-gray-100 border-gray-200";

  const intent = result?.intent;
  const bundle = result?.bundle;
  const decision = result?.decision;
  const attestation = result?.attestation;
  const anchor = anchorData?.anchor;
  const algorandTx = anchorData?.algorand_transaction;

  return (
    <div className={`${bg} min-h-screen transition-colors duration-300`}>
      <SGHeader />

      {/* Top Status Bar */}
      <div className={`fixed top-0 z-30 w-full ${barBg} border-b`}>
        <div className="mx-auto flex h-10 max-w-[1400px] items-center justify-between px-4 text-[11px]">
          <div className="flex items-center gap-4">
            <span className={textMuted}>Environment: <span className={text}>Production</span></span>
            <span className={textMuted}>Algorand Network: <span className={mono}>
              {algorandStatus?.network || "testnet"}
            </span></span>
          </div>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className={textMuted}>Status</span>
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              <span className="font-bold text-emerald-500">LIVE</span>
            </span>
            <span className={textMuted}>Ruleset: <span className={text}>v1.32</span></span>
            <span className={textMuted}>{new Date().toISOString().slice(0, 19) + "Z"}</span>
            <button
              onClick={() => setDark(!dark)}
              className={`rounded px-2 py-0.5 text-[10px] font-bold ${dark ? "bg-gray-700 text-gray-300" : "bg-gray-200 text-gray-700"}`}
            >
              {dark ? "LIGHT" : "DARK"}
            </button>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-[1400px] px-4 pt-14 pb-16">
        {/* Pre-Finality Banner */}
        <div className={`my-4 flex items-center justify-center border-y ${border} py-2`}>
          <span className={`font-mono text-xs tracking-[0.3em] uppercase ${textDim}`}>
            Pre-Finality Enforcement Layer
          </span>
        </div>

        {/* Scenario Selector */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {SCENARIOS.map((s) => (
            <button
              key={s.id}
              onClick={() => handleRun(s.id)}
              disabled={loading}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-all disabled:opacity-40 ${
                activePreset === s.id
                  ? s.short === "ALLOW"
                    ? "border-emerald-500 bg-emerald-500/10 text-emerald-400"
                    : "border-red-500 bg-red-500/10 text-red-400"
                  : `${border} ${textMuted} hover:border-emerald-500/50`
              }`}
            >
              {s.label}
            </button>
          ))}
          {loading && (
            <span className="ml-2 flex items-center gap-2 text-xs text-emerald-500">
              <span className="h-3 w-3 animate-spin rounded-full border border-emerald-500 border-t-transparent" />
              Evaluating...
            </span>
          )}
        </div>

        {/* Scenario Cards — Empty State */}
        {!result && !loading && (
          <div className="grid gap-4 sm:grid-cols-2">
            {SCENARIOS.map((s) => {
              const isAllow = s.short === "ALLOW";
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => handleRun(s.id)}
                  disabled={loading}
                  className={`group rounded-xl border p-5 text-left transition-all hover:shadow-md disabled:opacity-50 ${card} ${
                    isAllow ? "hover:border-emerald-400" : "hover:border-red-400"
                  }`}
                >
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${
                        isAllow
                          ? dark ? "bg-emerald-500/20" : "bg-emerald-100"
                          : dark ? "bg-red-500/20" : "bg-red-100"
                      }`}>
                        {isAllow ? (
                          <svg className="h-4 w-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        ) : (
                          <svg className="h-4 w-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        )}
                      </span>
                      <span className={`text-sm font-semibold ${text}`}>{s.label}</span>
                    </div>
                    <span className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                      isAllow
                        ? dark ? "bg-emerald-500/20 text-emerald-400" : "bg-emerald-100 text-emerald-700"
                        : dark ? "bg-red-500/20 text-red-400" : "bg-red-100 text-red-600"
                    }`}>
                      {s.short}
                    </span>
                  </div>
                  <div className="mb-2 flex items-baseline gap-3">
                    <span className={`font-mono text-xs ${mono}`}>{s.asset}</span>
                    <span className={`text-xs font-semibold ${text}`}>{s.amount}</span>
                  </div>
                  <p className={`mb-2 text-xs leading-relaxed ${textMuted}`}>{s.scenario}</p>
                  <p className={`text-[11px] ${textDim}`}>{s.outcome}</p>
                </button>
              );
            })}
          </div>
        )}

        {/* 3-Column Layout */}
        {result && (
          <div className="grid gap-4 lg:grid-cols-12">
            {/* LEFT — Settlement Intent Snapshot */}
            <div className={`rounded-xl border ${card} p-5 lg:col-span-3`}>
              <h3 className={`mb-4 text-sm font-semibold ${text}`}>Settlement Intent Snapshot</h3>
              <div className="space-y-3">
                <Row label="Intent ID" value={truncHash(result.id, 14)} mono dark={dark} />
                <Row label="Asset Type" value={intent?.asset_type === "tokenized_treasury" ? "Tokenized Treasury" : "Stablecoin"} dark={dark} />
                <Row label="Asset Symbol" value={intent?.asset_id || "—"} mono dark={dark} />
                <Row label="Amount" value={intent?.asset_type === "stablecoin" ? "$5,000,000" : "$10,000,000"} dark={dark} />
                <Row label="Venue" value="Algorand Settlement" dark={dark} />
                <Row label="Timestamp" value={formatTime(result.received_at)} mono dark={dark} />
              </div>
              <div className={`mt-4 border-t pt-3 ${border}`}>
                <h4 className={`mb-2 text-xs font-semibold ${text}`}>Settlement State</h4>
                <Row label="Status" dark={dark}>
                  <span className={`flex items-center gap-1.5 text-xs font-semibold ${
                    decision?.decision === "ALLOW" ? "text-emerald-500" : "text-amber-500"
                  }`}>
                    <span className={`inline-block h-1.5 w-1.5 rounded-full ${
                      decision?.decision === "ALLOW" ? "bg-emerald-500" : "bg-amber-500"
                    }`} />
                    {decision?.decision === "ALLOW" ? "Enforcement Passed" : "Pending Enforcement"}
                  </span>
                </Row>
                <Row label="Finality" value={decision?.decision === "ALLOW" && anchor ? "Authorized" : "Not Authorized"} dark={dark} />
              </div>
            </div>

            {/* CENTER — Deterministic Enforcement Evaluation */}
            <div className={`rounded-xl border ${card} p-5 lg:col-span-5`}>
              <h3 className={`mb-4 text-sm font-semibold ${text}`}>Deterministic Enforcement Evaluation</h3>
              <div className="space-y-3">
                {bundle?.steps.map((step, i) => {
                  const fields = getStepFields(step.step_name, intent);
                  return (
                    <div key={step.step_name} className={`rounded-lg border p-3.5 ${stepBg}`}>
                      <div className="mb-2 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {step.pass ? (
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20">
                              <svg className="h-3 w-3 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            </span>
                          ) : (
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500/20">
                              <svg className="h-3 w-3 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </span>
                          )}
                          <span className={`text-xs font-semibold ${text}`}>{fields.label}</span>
                        </div>
                        <span className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                          step.pass
                            ? "bg-emerald-500/20 text-emerald-400"
                            : "bg-red-500/20 text-red-400"
                        }`}>
                          {step.pass ? "PASS" : "FAIL"}
                        </span>
                      </div>
                      <div className="ml-7 space-y-1">
                        {fields.rows.map(([k, v]) => (
                          <div key={k} className="flex items-baseline gap-2 text-[11px]">
                            <span className={textDim}>{k}:</span>
                            <span className={`${text}`}>{v}</span>
                          </div>
                        ))}
                        {step.reason_codes.length > 0 && (
                          <div className="mt-1 rounded bg-red-500/10 px-2 py-1 text-[11px] text-red-400">
                            {step.reason_codes.join(", ")}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* RIGHT — Settlement Attestation + Anchor */}
            <div className={`rounded-xl border ${card} p-5 lg:col-span-4`}>
              <h3 className={`mb-4 text-sm font-semibold ${text}`}>Settlement Attestation</h3>
              <div className="space-y-2.5">
                <Row label="Decision" dark={dark}>
                  <span className={`rounded px-2 py-0.5 text-xs font-bold ${
                    decision?.decision === "ALLOW"
                      ? "bg-emerald-500/20 text-emerald-400"
                      : "bg-red-500/20 text-red-400"
                  }`}>
                    {decision?.decision}
                  </span>
                </Row>
                {attestation && (
                  <>
                    <Row label="Issued At" value={formatTime(attestation.attestation.issued_at)} mono dark={dark} />
                    <div className={`border-t pt-2 ${border}`}>
                      <p className={`mb-1 text-[10px] font-medium uppercase tracking-wider ${textDim}`}>Attestation Hash</p>
                      <p className={`break-all font-mono text-[11px] ${mono}`}>{attestation.attestation_hash}</p>
                    </div>
                    <div>
                      <p className={`mb-1 text-[10px] font-medium uppercase tracking-wider ${textDim}`}>Bundle Root Hash</p>
                      <p className={`break-all font-mono text-[11px] ${mono}`}>{attestation.attestation.bundle_root_hash}</p>
                    </div>
                    <Row label="Signature Algo" value="Ed25519" dark={dark} />
                    <Row label="Key ID" value={attestation.attestation.signer.key_id} mono dark={dark} />
                  </>
                )}
                {!attestation && (
                  <p className={`text-xs ${textDim}`}>No attestation — settlement denied.</p>
                )}
              </div>

              {/* Anchor Status */}
              {attestation && (
                <div className={`mt-4 border-t pt-3 ${border}`}>
                  <div className="mb-2 flex items-center justify-between">
                    <h4 className={`text-xs font-semibold ${text}`}>Anchor Status</h4>
                    {anchor && (
                      <a
                        href="https://testnet.algoexplorer.io"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 rounded-md border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 transition-colors hover:bg-emerald-100"
                      >
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                        Algorand Explorer
                      </a>
                    )}
                  </div>
                  {anchor ? (
                    <div className="space-y-2.5">
                      <div className={`rounded-lg border p-3 ${stepBg}`}>
                        <div className="mb-2 flex items-center gap-2">
                          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500">
                            <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          </span>
                          <span className={`text-xs font-semibold ${mono}`}>Algorand On-Chain Commitment</span>
                        </div>
                        <div className="ml-6 space-y-1.5">
                          <div>
                            <p className={`text-[9px] font-medium uppercase tracking-wider ${textDim}`}>Commitment ID</p>
                            <p className={`font-mono text-xs font-semibold ${mono}`}>{anchor.commitment_id}</p>
                          </div>
                          <div>
                            <p className={`text-[9px] font-medium uppercase tracking-wider ${textDim}`}>Anchor Hash</p>
                            <p className={`break-all font-mono text-[10px] ${mono}`}>{anchor.tx_hash}</p>
                          </div>
                          <div className="flex items-baseline justify-between">
                            <span className={`text-[9px] font-medium uppercase tracking-wider ${textDim}`}>Anchored At</span>
                            <span className={`font-mono text-xs ${mono}`}>{formatTime(anchor.anchored_at)}</span>
                          </div>
                          <div className="flex items-baseline justify-between">
                            <span className={`text-[9px] font-medium uppercase tracking-wider ${textDim}`}>Network</span>
                            <span className={`font-mono text-[11px] ${mono}`}>{anchorData?.network || "testnet"}</span>
                          </div>
                        </div>
                      </div>

                      {algorandTx && (
                        <details className="group">
                          <summary className={`flex cursor-pointer list-none items-center gap-1.5 text-[11px] font-semibold ${mono} select-none`}>
                            <svg className="h-3 w-3 transition-transform group-open:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                            </svg>
                            Algorand Transaction Details
                          </summary>
                          <div className={`mt-2 space-y-2 rounded-lg border p-3 ${stepBg}`}>
                            <MiniRow label="txn_id" value={algorandTx.txn_id} dark={dark} />
                            <MiniRow label="confirmed_round" value={algorandTx.confirmed_round.toString()} dark={dark} />
                            <MiniRow label="app_id" value={algorandTx.app_id.toString()} dark={dark} />
                            <MiniRow label="sender" value={algorandTx.sender} dark={dark} />
                            <MiniRow label="timestamp" value={algorandTx.timestamp} dark={dark} />
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <a
                              href="https://developer.algorand.org/docs/"
                              target="_blank"
                              rel="noopener noreferrer"
                              className={`flex items-center gap-1 rounded border px-2 py-1 text-[10px] font-medium ${dark ? "border-[#1e293b] text-gray-400 hover:text-emerald-400" : "border-gray-200 text-gray-500 hover:text-emerald-700"}`}
                            >
                              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                              </svg>
                              Algorand Docs
                            </a>
                            <a
                              href="https://algorand.com"
                              target="_blank"
                              rel="noopener noreferrer"
                              className={`flex items-center gap-1 rounded border px-2 py-1 text-[10px] font-medium ${dark ? "border-[#1e293b] text-gray-400 hover:text-emerald-400" : "border-gray-200 text-gray-500 hover:text-emerald-700"}`}
                            >
                              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                              </svg>
                              Algorand
                            </a>
                          </div>
                        </details>
                      )}
                    </div>
                  ) : (
                    <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${stepBg}`}>
                      <span className="h-3 w-3 animate-spin rounded-full border border-emerald-500 border-t-transparent" />
                      <p className={`text-xs ${textDim}`}>Anchoring to Algorand...</p>
                    </div>
                  )}
                </div>
              )}

              {/* AI Reasoning */}
              {reasoning && (
                <div className={`mt-4 border-t pt-3 ${border}`}>
                  <h4 className={`mb-3 flex items-center gap-2 text-xs font-semibold ${text}`}>
                    AI Compliance Reasoning
                    <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${
                      dark ? "bg-purple-500/20 text-purple-400" : "bg-purple-100 text-purple-700"
                    }`}>
                      Bedrock Nova Micro
                    </span>
                  </h4>
                  <div className={`mb-3 rounded-lg border px-3 py-2.5 ${stepBg}`}>
                    <p className={`text-xs leading-relaxed ${text}`}>{reasoning.summary}</p>
                  </div>
                  <div className="space-y-1.5">
                    {reasoning.step_explanations.map((s) => (
                      <div key={s.step_name} className={`flex items-start gap-2 text-[11px]`}>
                        <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${
                          s.pass
                            ? dark ? "bg-emerald-500/20 text-emerald-400" : "bg-emerald-100 text-emerald-700"
                            : dark ? "bg-red-500/20 text-red-400" : "bg-red-100 text-red-600"
                        }`}>
                          {s.pass ? "+" : "−"}
                        </span>
                        <span className={textMuted}>{s.explanation}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Bottom Banner */}
        <div className={`mt-4 flex items-center justify-center border-y ${border} py-2`}>
          <span className={`font-mono text-xs tracking-[0.3em] uppercase ${textDim}`}>
            Pre-Finality Enforcement Layer
          </span>
        </div>
      </main>
      <SGFooter />
    </div>
  );
}

function Row({ label, value, mono: isMono, dark, children }: {
  label: string; value?: string; mono?: boolean; dark: boolean; children?: ReactNode;
}) {
  const textMuted = dark ? "text-gray-500" : "text-gray-400";
  const text = dark ? "text-gray-200" : "text-gray-800";
  const monoColor = dark ? "text-emerald-400" : "text-emerald-700";
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className={`text-[11px] ${textMuted}`}>{label}</span>
      {children || (
        <span className={`text-xs font-medium ${isMono ? `font-mono ${monoColor}` : text}`}>
          {value}
        </span>
      )}
    </div>
  );
}

function MiniRow({ label, value, dark }: { label: string; value: string; dark: boolean }) {
  const textDim = dark ? "text-gray-500" : "text-gray-400";
  const mono = dark ? "text-emerald-400" : "text-emerald-700";
  return (
    <div className="flex flex-col">
      <span className={`text-[9px] ${textDim}`}>{label}</span>
      <span className={`break-all font-mono text-[10px] ${mono}`}>{value}</span>
    </div>
  );
}

function getStepFields(stepName: string, intent?: { asset_type: string; issuer_name: string; issuer_status: string; classification: string; custody_provider: string; custody_valid: boolean; reserve_ratio: number } | null) {
  if (!intent) return { label: stepName, rows: [] };
  switch (stepName) {
    case "issuer_legitimacy":
      return {
        label: "Issuer Legitimacy",
        rows: [
          ["Entity", intent.issuer_name],
          ["Jurisdiction", "Active"],
          ["Key ID", "Verified"],
        ],
      };
    case "asset_classification":
      return {
        label: "Asset Classification",
        rows: [
          ["Classification", intent.classification === "tokenized_security" ? "Tokenized Security" : "Stablecoin"],
          ["Ruleset Applied", intent.classification === "tokenized_security" ? "Treasury-v2" : "Stablecoin-v2"],
        ],
      };
    case "custody_conditions":
      return {
        label: "Custody Conditions",
        rows: [
          ["Custodian", intent.custody_provider],
          ["Account Status", intent.custody_valid ? "Segregated" : "Invalid"],
          ["Encumbrance", intent.custody_valid ? "None" : "Flagged"],
        ],
      };
    case "backing_reserve":
      return {
        label: "Backing & Reserve",
        rows: [
          ["Reserve Ratio", String(intent.reserve_ratio)],
          ["Available Reserves", intent.asset_type === "stablecoin" ? "$102,000,000" : "$10,000,000"],
          ["Required Coverage", intent.asset_type === "stablecoin" ? ">= $100,000,000" : ">= $10,000,000"],
          ["Feed Timestamp", formatTime(new Date().toISOString())],
        ],
      };
    default:
      return { label: stepName, rows: [] };
  }
}
