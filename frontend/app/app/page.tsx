"use client";

import { useState, useRef, useEffect, type ReactNode } from "react";
import { SGHeader } from "@/components/sg-header";
import { SGFooter } from "@/components/sg-footer";
import {
  runPreset,
  anchorAttestation,
  fetchReasoning,
  fetchCantonStatus,
  type EnforcementResult,
  type CantonAnchorResponse,
  type ComplianceReasoning,
  type CantonNetworkStatus,
} from "@/lib/api";

const SCENARIOS = [
  { id: "stablecoin-pass", label: "Stablecoin PASS", short: "ALLOW" },
  { id: "treasury-pass", label: "Treasury PASS", short: "ALLOW" },
  { id: "stablecoin-fail", label: "Stablecoin FAIL", short: "DENY" },
  { id: "treasury-fail", label: "Treasury FAIL", short: "DENY" },
];

function formatTime(iso: string) {
  return iso.replace("T", " ").slice(11, 22) + "Z";
}

function truncHash(h: string, n = 20) {
  return h.length > n ? h.slice(0, n) + "..." : h;
}

export default function AppPage(): ReactNode {
  const [result, setResult] = useState<EnforcementResult | null>(null);
  const [anchorData, setAnchorData] = useState<CantonAnchorResponse | null>(null);
  const [reasoning, setReasoning] = useState<ComplianceReasoning | null>(null);
  const [cantonStatus, setCantonStatus] = useState<CantonNetworkStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [dark, setDark] = useState(true);

  useEffect(() => {
    fetchCantonStatus().then(setCantonStatus).catch(() => {});
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
  const cantonTx = anchorData?.canton_transaction;

  return (
    <div className={`${bg} min-h-screen transition-colors duration-300`}>
      <SGHeader />

      {/* Top Status Bar */}
      <div className={`fixed top-0 z-30 w-full ${barBg} border-b`}>
        <div className="mx-auto flex h-10 max-w-[1400px] items-center justify-between px-4 text-[11px]">
          <div className="flex items-center gap-4">
            <span className={textMuted}>Environment: <span className={text}>Production</span></span>
            <span className={textMuted}>Canton Participant ID: <span className={mono}>
              {cantonStatus?.participant || "sg-participant-01"}
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

        {/* Empty State */}
        {!result && !loading && (
          <div className={`flex h-[500px] items-center justify-center rounded-xl border ${border} ${card}`}>
            <div className="text-center">
              <p className={`font-mono text-sm ${textDim}`}>Select a scenario to begin enforcement evaluation</p>
            </div>
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
                <Row label="Venue" value="Canton Clearing" dark={dark} />
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
                  <h4 className={`mb-2 text-xs font-semibold ${text}`}>Anchor Status</h4>
                  {anchor ? (
                    <div className="space-y-2">
                      <p className={`text-xs font-medium ${mono}`}>Canton On-Chain Commitment</p>
                      <Row label="Commitment ID" value={anchor.commitment_id} mono dark={dark} />
                      <div>
                        <p className={`mb-0.5 text-[10px] font-medium uppercase tracking-wider ${textDim}`}>Anchor Hash</p>
                        <p className={`break-all font-mono text-[10px] ${mono}`}>{anchor.tx_hash}</p>
                      </div>
                      <Row label="Anchored At" value={formatTime(anchor.anchored_at)} mono dark={dark} />
                      <Row label="Network" value={anchorData?.domain || "global-synchronizer.canton.network"} mono dark={dark} />
                      {cantonTx && (
                        <details className="mt-1">
                          <summary className={`cursor-pointer text-[11px] font-medium ${mono}`}>
                            Canton Transaction Details
                          </summary>
                          <div className={`mt-2 space-y-1.5 rounded-lg border p-3 ${stepBg}`}>
                            <MiniRow label="transaction_id" value={truncHash(cantonTx.transaction_id, 30)} dark={dark} />
                            <MiniRow label="contract_id" value={truncHash(cantonTx.contract_id, 30)} dark={dark} />
                            <MiniRow label="domain_id" value={cantonTx.domain_id} dark={dark} />
                            <MiniRow label="participant_id" value={cantonTx.participant_id} dark={dark} />
                            <MiniRow label="template_id" value={cantonTx.template_id} dark={dark} />
                            <MiniRow label="workflow_id" value={cantonTx.workflow_id} dark={dark} />
                          </div>
                        </details>
                      )}
                    </div>
                  ) : (
                    <p className={`text-xs ${textDim}`}>Anchoring in progress...</p>
                  )}
                </div>
              )}

              {/* AI Reasoning */}
              {reasoning && (
                <div className={`mt-4 border-t pt-3 ${border}`}>
                  <h4 className={`mb-2 flex items-center gap-2 text-xs font-semibold ${text}`}>
                    AI Compliance Reasoning
                    <span className="rounded bg-purple-500/20 px-1.5 py-0.5 text-[9px] font-bold text-purple-400">
                      Bedrock Nova Micro
                    </span>
                  </h4>
                  <p className={`mb-2 text-xs leading-relaxed ${textMuted}`}>{reasoning.summary}</p>
                  <div className="space-y-1">
                    {reasoning.step_explanations.map((s) => (
                      <div key={s.step_name} className={`flex items-start gap-2 text-[11px] ${textMuted}`}>
                        <span className={s.pass ? "text-emerald-500" : "text-red-400"}>
                          {s.pass ? "+" : "-"}
                        </span>
                        <span>{s.explanation}</span>
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
