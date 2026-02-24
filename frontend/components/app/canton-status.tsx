"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Globe, Server, Database, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { fetchCantonStatus, type CantonNetworkStatus } from "@/lib/api";

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
        <span className="text-xs text-gray-400">Connecting to Canton...</span>
      </div>
    );
  }

  if (error || !status) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5">
        <XCircle className="h-3.5 w-3.5 text-red-500" />
        <span className="text-xs text-red-600">Canton Network offline</span>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-emerald-200 bg-emerald-50/60 px-4 py-2.5">
      <div className="flex items-center gap-1.5">
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
        <span className="text-xs font-semibold text-emerald-700">Canton Connected</span>
      </div>
      <div className="flex items-center gap-1.5">
        <Globe className="h-3 w-3 text-gray-500" />
        <span className="text-[11px] text-gray-600">{status.domain}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <Server className="h-3 w-3 text-gray-500" />
        <span className="text-[11px] text-gray-600">{status.participant}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <Database className="h-3 w-3 text-gray-500" />
        <span className="text-[11px] text-gray-600">{status.ledger_api}</span>
      </div>
    </div>
  );
}
