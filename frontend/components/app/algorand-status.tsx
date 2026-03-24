"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Globe, Server, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { fetchAlgorandStatus, type AlgorandNetworkStatus } from "@/lib/api";

export function AlgorandStatus(): ReactNode {
  const [status, setStatus] = useState<AlgorandNetworkStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let mounted = true;
    fetchAlgorandStatus()
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
        <span className="text-xs text-gray-400">Connecting to Algorand...</span>
      </div>
    );
  }

  if (error || !status) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5">
        <XCircle className="h-3.5 w-3.5 text-red-500" />
        <span className="text-xs text-red-600">Algorand Network offline</span>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-xl border border-emerald-200 bg-emerald-50/40 px-3.5 py-2">
      <div className="flex items-center gap-1.5">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
        </span>
        <span className="text-[11px] font-semibold text-emerald-700">Algorand {status.network}</span>
      </div>
      <span className="hidden text-gray-300 sm:inline">|</span>
      <div className="flex items-center gap-1">
        <Server className="h-3 w-3 text-gray-400" />
        <span className="text-[10px] text-gray-500">Node</span>
      </div>
      <div className="flex items-center gap-1">
        <Globe className="h-3 w-3 text-gray-400" />
        <span className="text-[10px] text-gray-500">Indexer</span>
      </div>
      <div className="flex items-center gap-1">
        <CheckCircle2 className="h-3 w-3 text-emerald-500" />
        <span className="text-[10px] text-emerald-600">Connected</span>
      </div>
    </div>
  );
}
