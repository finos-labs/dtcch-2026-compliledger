"use client";

import { useState, forwardRef, useImperativeHandle, type ReactNode } from "react";
import { motion } from "motion/react";
import { Anchor, CheckCircle2, Loader2, Globe, Server, FileCode } from "lucide-react";
import { anchorAttestation, type AnchorRecord, type AlgorandTransaction } from "@/lib/api";

interface AnchorPanelProps {
  intentId: string;
  anchor?: AnchorRecord | null;
}

export const AnchorPanel = forwardRef<{ triggerAnchor: () => void }, AnchorPanelProps>(function AnchorPanel({ intentId, anchor: initialAnchor }, ref) {
  const [anchor, setAnchor] = useState<AnchorRecord | null>(initialAnchor || null);
  const [algorandTx, setAlgorandTx] = useState<AlgorandTransaction | null>(null);
  const [network, setNetwork] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useImperativeHandle(ref, () => ({ triggerAnchor: handleAnchor }));

  async function handleAnchor() {
    if (anchor) return;
    setLoading(true);
    setError(null);
    try {
      const result = await anchorAttestation(intentId);
      setAnchor(result.anchor);
      if (result.algorand_transaction) {
        setAlgorandTx(result.algorand_transaction);
      }
      if (result.network) {
        setNetwork(result.network);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Anchoring failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <motion.div
      className="rounded-2xl border border-teal-200 bg-white p-6 shadow-sm"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.85 }}
    >
      <div className="mb-4 flex items-center gap-2">
        <Anchor className="h-4 w-4 text-teal-600" />
        <h2 className="text-sm font-semibold text-gray-900">Algorand On-Chain Anchoring</h2>
      </div>

      {!anchor && (
        <div>
          <p className="mb-4 text-xs text-gray-500">
            Anchor the proof commitment on-chain via Algorand for independent verification and tamper resistance.
          </p>
          <button
            type="button"
            onClick={handleAnchor}
            disabled={loading}
            className="flex items-center gap-2 rounded-xl bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-teal-700 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Anchor className="h-4 w-4" />
            )}
            {loading ? "Submitting to Algorand..." : "Anchor on Algorand"}
          </button>
          {error && (
            <p className="mt-2 text-xs text-red-500">{error}</p>
          )}
        </div>
      )}

      {anchor && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-emerald-600">
            <CheckCircle2 className="h-5 w-5" />
            <span className="text-sm font-semibold">Anchored on Algorand</span>
          </div>

          <div className="flex flex-wrap gap-2">
            {network && (
              <span className="rounded-full bg-teal-100 px-2.5 py-0.5 text-[10px] font-medium text-teal-700">
                Algorand {network}
              </span>
            )}
            <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-[10px] font-medium text-blue-700">
              Application Call
            </span>
            <span className="rounded-full bg-purple-100 px-2.5 py-0.5 text-[10px] font-medium text-purple-700">
              Immutable Commitment
            </span>
          </div>


          {/* Anchor Record */}
          <div className="space-y-2 rounded-xl border border-gray-200 bg-gray-50 p-4">
            <div>
              <p className="text-xs font-medium text-gray-500">commitment_id</p>
              <p className="mt-0.5 font-mono text-xs text-gray-800">{anchor.commitment_id}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500">tx_hash (SHA-256)</p>
              <p className="mt-0.5 break-all font-mono text-xs text-gray-800">{anchor.tx_hash}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500">anchored_at</p>
              <p className="mt-0.5 font-mono text-xs text-gray-800">{anchor.anchored_at}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500">bundle_root_hash</p>
              <p className="mt-0.5 break-all font-mono text-xs text-gray-800">{anchor.bundle_root_hash}</p>
            </div>
          </div>

          {/* Algorand Transaction Details */}
          {algorandTx && (
            <details className="group">
              <summary className="flex cursor-pointer items-center gap-2 text-xs font-medium text-teal-700 hover:text-teal-900">
                <FileCode className="h-3.5 w-3.5" />
                Algorand Transaction Details
              </summary>
              <div className="mt-2 space-y-2 rounded-xl border border-teal-100 bg-teal-50/50 p-4">
                <div>
                  <p className="text-[10px] font-medium text-gray-500">txn_id</p>
                  <p className="mt-0.5 break-all font-mono text-[11px] text-gray-800">{algorandTx.txn_id}</p>
                </div>
                <div>
                  <p className="text-[10px] font-medium text-gray-500">confirmed_round</p>
                  <p className="mt-0.5 font-mono text-[11px] text-gray-800">{algorandTx.confirmed_round}</p>
                </div>
                <div>
                  <p className="text-[10px] font-medium text-gray-500">app_id</p>
                  <p className="mt-0.5 font-mono text-[11px] text-gray-800">{algorandTx.app_id}</p>
                </div>
                <div>
                  <p className="text-[10px] font-medium text-gray-500">sender</p>
                  <p className="mt-0.5 break-all font-mono text-[11px] text-gray-800">{algorandTx.sender}</p>
                </div>
                <div>
                  <p className="text-[10px] font-medium text-gray-500">timestamp</p>
                  <p className="mt-0.5 font-mono text-[11px] text-gray-800">{algorandTx.timestamp}</p>
                </div>
              </div>
            </details>
          )}
        </div>
      )}
    </motion.div>
  );
});
