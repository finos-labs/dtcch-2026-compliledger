"use client";

import { useState, type ReactNode } from "react";
import { ShieldCheck, ShieldX, Loader2 } from "lucide-react";
import { verifyAttestation, type VerifyResponse } from "@/lib/api";

export function VerifyPanel(): ReactNode {
  const [attestationJson, setAttestationJson] = useState("");
  const [signature, setSignature] = useState("");
  const [checkChain, setCheckChain] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VerifyResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleVerify() {
    if (!attestationJson.trim() || !signature.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await verifyAttestation(attestationJson, signature, checkChain);
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-foreground/5 bg-muted/10 p-5">
      <h2 className="mb-1 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        Verify Attestation
      </h2>
      <p className="mb-4 text-xs text-muted-foreground/70">
        Paste an attestation JSON and signature to verify integrity. Tamper with any field to see detection.
      </p>

      <div className="space-y-3">
        <div>
          <label htmlFor="verify-json" className="mb-1 block text-xs font-medium text-muted-foreground">
            Attestation JSON
          </label>
          <textarea
            id="verify-json"
            value={attestationJson}
            onChange={(e) => setAttestationJson(e.target.value)}
            rows={5}
            placeholder='{"attestation_version":"sg-attest-v1",...}'
            className="w-full rounded-xl border border-foreground/10 bg-background/60 px-3 py-2 font-mono text-xs text-foreground placeholder:text-muted-foreground/40 focus:border-accent/30 focus:outline-none"
          />
        </div>

        <div>
          <label htmlFor="verify-sig" className="mb-1 block text-xs font-medium text-muted-foreground">
            Signature
          </label>
          <input
            id="verify-sig"
            type="text"
            value={signature}
            onChange={(e) => setSignature(e.target.value)}
            placeholder="Base64 encoded Ed25519 signature"
            className="w-full rounded-xl border border-foreground/10 bg-background/60 px-3 py-2 font-mono text-xs text-foreground placeholder:text-muted-foreground/40 focus:border-accent/30 focus:outline-none"
          />
        </div>

        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={checkChain}
            onChange={(e) => setCheckChain(e.target.checked)}
            className="rounded border-foreground/20 accent-accent"
          />
          Verify on-chain
        </label>

        <button
          type="button"
          onClick={handleVerify}
          disabled={loading || !attestationJson.trim() || !signature.trim()}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-foreground/10 px-4 py-2.5 text-sm font-semibold text-foreground transition-all hover:bg-foreground/15 disabled:opacity-40"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ShieldCheck className="h-4 w-4" />
          )}
          {loading ? "Verifying..." : "Verify"}
        </button>

        {error && (
          <p className="text-xs text-sg-deny">{error}</p>
        )}

        {result && (
          <div className={`rounded-xl border p-4 ${
            result.signature_valid
              ? "border-sg-success/20 bg-sg-success/5"
              : "border-sg-deny/20 bg-sg-deny/5"
          }`}>
            <div className="mb-2 flex items-center gap-2">
              {result.signature_valid ? (
                <ShieldCheck className="h-5 w-5 text-sg-success" />
              ) : (
                <ShieldX className="h-5 w-5 text-sg-deny" />
              )}
              <span className={`text-sm font-bold ${
                result.signature_valid ? "text-sg-success" : "text-sg-deny"
              }`}>
                {result.signature_valid ? "VALID" : "INVALID"}
              </span>
            </div>
            <div className="space-y-1 text-xs">
              <p className="text-muted-foreground">
                Signature: <span className={result.signature_valid ? "text-sg-success" : "text-sg-deny"}>
                  {result.signature_valid ? "Valid" : "Invalid"}
                </span>
              </p>
              <p className="text-muted-foreground">
                Bundle exists: <span className={result.bundle_exists ? "text-sg-success" : "text-sg-deny"}>
                  {result.bundle_exists ? "Yes" : "No"}
                </span>
              </p>
              {result.on_chain !== null && (
                <p className="text-muted-foreground">
                  On-chain: <span className={result.on_chain ? "text-sg-success" : "text-sg-deny"}>
                    {result.on_chain ? "Confirmed" : "Not found"}
                  </span>
                </p>
              )}
              {result.tx_hash && (
                <p className="text-muted-foreground">
                  tx_hash: <span className="font-mono text-foreground">{result.tx_hash.slice(0, 20)}...</span>
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
