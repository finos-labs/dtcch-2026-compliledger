"use client";

import { useState, type ReactNode } from "react";
import { motion } from "motion/react";
import { Anchor, CheckCircle2, Loader2 } from "lucide-react";
import { anchorAttestation, type AnchorRecord } from "@/lib/api";

interface AnchorPanelProps {
  intentId: string;
  anchor?: AnchorRecord | null;
}

export function AnchorPanel({ intentId, anchor: initialAnchor }: AnchorPanelProps): ReactNode {
  const [anchor, setAnchor] = useState<AnchorRecord | null>(initialAnchor || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAnchor() {
    setLoading(true);
    setError(null);
    try {
      const result = await anchorAttestation(intentId);
      setAnchor(result.anchor);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Anchoring failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <motion.div
      className="rounded-2xl border border-sg-teal/10 bg-sg-teal/5 p-6"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.85 }}
    >
      <div className="mb-4 flex items-center gap-2">
        <Anchor className="h-4 w-4 text-sg-teal" />
        <h2 className="text-sm font-semibold text-foreground">Canton On-Chain Anchoring</h2>
      </div>

      {!anchor && (
        <div>
          <p className="mb-4 text-xs text-muted-foreground">
            Anchor the proof commitment on-chain for independent verification and tamper resistance.
          </p>
          <button
            type="button"
            onClick={handleAnchor}
            disabled={loading}
            className="flex items-center gap-2 rounded-xl bg-sg-teal px-5 py-2.5 text-sm font-semibold text-white transition-all hover:brightness-110 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Anchor className="h-4 w-4" />
            )}
            {loading ? "Anchoring..." : "Anchor on Canton"}
          </button>
          {error && (
            <p className="mt-2 text-xs text-sg-deny">{error}</p>
          )}
        </div>
      )}

      {anchor && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sg-success">
            <CheckCircle2 className="h-5 w-5" />
            <span className="text-sm font-semibold">Anchored on Canton</span>
          </div>

          <div className="space-y-2 rounded-xl border border-foreground/5 bg-background/40 p-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground">commitment_id</p>
              <p className="mt-0.5 font-mono text-xs text-foreground">{anchor.commitment_id}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">tx_hash</p>
              <p className="mt-0.5 break-all font-mono text-xs text-foreground">{anchor.tx_hash}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">anchored_at</p>
              <p className="mt-0.5 font-mono text-xs text-foreground">{anchor.anchored_at}</p>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}
