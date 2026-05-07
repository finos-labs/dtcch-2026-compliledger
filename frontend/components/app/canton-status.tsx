"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Globe, CheckCircle2, XCircle, Loader2, AlertTriangle } from "lucide-react";
import { fetchCantonStatus, type CantonNetworkStatus } from "@/lib/api";

function YesNo({ label, ok }: { label: string; ok: boolean }): ReactNode {
  return (
    <div className="flex items-center gap-1">
      {ok ? (
        <CheckCircle2 className="h-3 w-3 text-emerald-500" />
      ) : (
        <XCircle className="h-3 w-3 text-gray-400" />
      )}
      <span className="text-[10px] text-gray-500">
        {label}: <span className={ok ? "text-emerald-700" : "text-gray-600"}>{ok ? "yes" : "no"}</span>
      </span>
    </div>
  );
}

export function CantonStatus(): ReactNode {
  const [status, setStatus] = useState<CantonNetworkStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let mounted = true;
    fetchCantonStatus()
      .then((data) => {
        if (mounted) setStatus(data);
      })
      .catch(() => {
        if (mounted) setError(true);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => { mounted = false; };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5">
        <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-400" />
        <span className="text-xs text-gray-400">Checking Canton status...</span>
      </div>
    );
  }

  if (error || !status) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5">
        <XCircle className="h-3.5 w-3.5 text-red-500" />
        <span className="text-xs text-red-600">Canton status unavailable</span>
      </div>
    );
  }

  // Derive readiness flags. Treat missing fields (older backends) as false so
  // we never overstate availability.
  const reachable = status.reachable === true;
  const configured = status.configured === true;
  const packageOk = status.package_id_configured === true;
  const partiesOk =
    status.submitter_party_configured === true &&
    status.custodian_party_configured === true;
  const authOk = status.auth_token_configured === true;

  // Network label: surface LocalNet / DevNet (from backend `mode`/`network_label`).
  const networkLabel =
    status.network_label ||
    (status.mode === "devnet"
      ? "DevNet"
      : status.mode === "localnet"
      ? "LocalNet"
      : status.network || "Unknown");

  // Per spec: only DevNet selection triggers the "DevNet configuration incomplete"
  // warning when readiness checks fail.
  const devnetIncomplete =
    status.mode === "devnet" && !(configured && reachable && authOk);

  // Container + header tone: only use the "live" emerald styling when the
  // backend reports reachable=true. Otherwise stay neutral — the word
  // "connected" / "Live" must not appear unless reachable=true.
  const containerTone = reachable
    ? "border-emerald-200 bg-emerald-50/40"
    : "border-gray-200 bg-white";

  return (
    <div className={`flex flex-col gap-1.5 rounded-xl border px-3.5 py-2 ${containerTone}`}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
        <div className="flex items-center gap-1.5">
          {reachable ? (
            <>
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              <span className="text-[11px] font-semibold text-emerald-700">Canton Live</span>
            </>
          ) : (
            <>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-gray-300" />
              <span className="text-[11px] font-semibold text-gray-600">Canton</span>
            </>
          )}
        </div>
        <span className="hidden text-gray-300 sm:inline">|</span>
        <div className="flex items-center gap-1">
          <Globe className="h-3 w-3 text-gray-400" />
          <span className="text-[10px] text-gray-500">
            Network: <span className="text-gray-700">{networkLabel}</span>
          </span>
        </div>
        <YesNo label="Configured" ok={configured} />
        <YesNo label="Reachable" ok={reachable} />
        <YesNo label="Package configured" ok={packageOk} />
        <YesNo label="Parties configured" ok={partiesOk} />
        <YesNo label="Auth configured" ok={authOk} />
      </div>
      {devnetIncomplete ? (
        <div className="flex items-center gap-1.5">
          <AlertTriangle className="h-3 w-3 text-amber-500" />
          <span className="text-[10px] font-medium text-amber-700">
            DevNet configuration incomplete
          </span>
        </div>
      ) : null}
    </div>
  );
}
