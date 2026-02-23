"use client";

import { useState, type ReactNode } from "react";
import { motion } from "motion/react";
import { FileCheck, Copy, Check } from "lucide-react";
import type { EnforcementResult } from "@/lib/api";

export function AttestationPanel({ result }: { result: EnforcementResult }): ReactNode {
  const [copiedJson, setCopiedJson] = useState(false);
  const [copiedSig, setCopiedSig] = useState(false);

  if (!result.attestation) return null;

  const { attestation, attestation_hash, signature } = result.attestation;
  const attestationJson = JSON.stringify(attestation, null, 2);

  function copyToClipboard(text: string, setter: (v: boolean) => void) {
    navigator.clipboard.writeText(text).then(() => {
      setter(true);
      setTimeout(() => setter(false), 2000);
    });
  }

  return (
    <motion.div
      className="rounded-2xl border border-accent/10 bg-accent/5 p-6"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.7 }}
    >
      <div className="mb-4 flex items-center gap-2">
        <FileCheck className="h-4 w-4 text-accent" />
        <h2 className="text-sm font-semibold text-foreground">Settlement Attestation</h2>
      </div>

      {/* Attestation JSON */}
      <div className="mb-4">
        <div className="mb-1 flex items-center justify-between">
          <p className="text-xs font-medium text-muted-foreground">Attestation JSON</p>
          <button
            type="button"
            onClick={() => copyToClipboard(attestationJson, setCopiedJson)}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            {copiedJson ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            {copiedJson ? "Copied" : "Copy"}
          </button>
        </div>
        <pre className="max-h-52 overflow-auto rounded-xl border border-foreground/5 bg-background/60 p-4 font-mono text-xs text-foreground">
          {attestationJson}
        </pre>
      </div>

      {/* Attestation Hash */}
      <div className="mb-4">
        <p className="mb-1 text-xs font-medium text-muted-foreground">attestation_hash</p>
        <p className="break-all rounded-lg border border-foreground/5 bg-background/40 px-3 py-2 font-mono text-xs text-foreground">
          {attestation_hash}
        </p>
      </div>

      {/* Signature */}
      <div>
        <div className="mb-1 flex items-center justify-between">
          <p className="text-xs font-medium text-muted-foreground">Ed25519 Signature</p>
          <button
            type="button"
            onClick={() => copyToClipboard(signature, setCopiedSig)}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            {copiedSig ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            {copiedSig ? "Copied" : "Copy"}
          </button>
        </div>
        <p className="break-all rounded-lg border border-foreground/5 bg-background/40 px-3 py-2 font-mono text-xs text-foreground">
          {signature}
        </p>
      </div>
    </motion.div>
  );
}
