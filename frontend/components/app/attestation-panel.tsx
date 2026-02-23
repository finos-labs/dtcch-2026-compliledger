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
      className="rounded-2xl border border-emerald-200 bg-white p-6 shadow-sm"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.7 }}
    >
      <div className="mb-4 flex items-center gap-2">
        <FileCheck className="h-4 w-4 text-emerald-600" />
        <h2 className="text-sm font-semibold text-gray-900">Settlement Attestation</h2>
      </div>

      {/* Attestation JSON */}
      <div className="mb-4">
        <div className="mb-1 flex items-center justify-between">
          <p className="text-xs font-medium text-gray-500">Attestation JSON</p>
          <button
            type="button"
            onClick={() => copyToClipboard(attestationJson, setCopiedJson)}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-gray-400 transition-colors hover:text-gray-700"
          >
            {copiedJson ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            {copiedJson ? "Copied" : "Copy"}
          </button>
        </div>
        <pre className="max-h-52 overflow-auto rounded-xl border border-gray-200 bg-gray-50 p-4 font-mono text-xs text-gray-800">
          {attestationJson}
        </pre>
      </div>

      {/* Attestation Hash */}
      <div className="mb-4">
        <p className="mb-1 text-xs font-medium text-gray-500">attestation_hash</p>
        <p className="break-all rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 font-mono text-xs text-gray-800">
          {attestation_hash}
        </p>
      </div>

      {/* Signature */}
      <div>
        <div className="mb-1 flex items-center justify-between">
          <p className="text-xs font-medium text-gray-500">Ed25519 Signature</p>
          <button
            type="button"
            onClick={() => copyToClipboard(signature, setCopiedSig)}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-gray-400 transition-colors hover:text-gray-700"
          >
            {copiedSig ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            {copiedSig ? "Copied" : "Copy"}
          </button>
        </div>
        <p className="break-all rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 font-mono text-xs text-gray-800">
          {signature}
        </p>
      </div>
    </motion.div>
  );
}
