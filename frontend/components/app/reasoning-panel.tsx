"use client";

import { useState, type ReactNode } from "react";
import { motion } from "motion/react";
import { Brain, Loader2, CheckCircle2, XCircle, AlertTriangle, ArrowRight } from "lucide-react";
import { fetchReasoning, type ComplianceReasoning } from "@/lib/api";

interface ReasoningPanelProps {
  intentId: string;
}

export function ReasoningPanel({ intentId }: ReasoningPanelProps): ReactNode {
  const [reasoning, setReasoning] = useState<ComplianceReasoning | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchReasoning(intentId);
      setReasoning(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate reasoning");
    } finally {
      setLoading(false);
    }
  }

  if (!reasoning && !loading) {
    return (
      <motion.div
        className="rounded-2xl border border-purple-200 bg-white p-6 shadow-sm"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.9 }}
      >
        <div className="mb-4 flex items-center gap-2">
          <Brain className="h-4 w-4 text-purple-600" />
          <h2 className="text-sm font-semibold text-gray-900">AI Compliance Reasoning</h2>
          <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-medium text-purple-700">
            Powered by Bedrock
          </span>
        </div>
        <p className="mb-4 text-xs text-gray-500">
          Generate natural-language compliance analysis explaining each proof step result using AI.
        </p>
        <button
          type="button"
          onClick={handleGenerate}
          className="flex items-center gap-2 rounded-xl bg-purple-600 px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-purple-700 disabled:opacity-50"
        >
          <Brain className="h-4 w-4" />
          Generate AI Analysis
        </button>
        {error && <p className="mt-2 text-xs text-sg-deny">{error}</p>}
      </motion.div>
    );
  }

  if (loading) {
    return (
      <motion.div
        className="flex min-h-[200px] items-center justify-center rounded-2xl border border-purple-200 bg-white p-6 shadow-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
          <p className="text-sm text-gray-500">
            AI is analyzing compliance results...
          </p>
        </div>
      </motion.div>
    );
  }

  if (!reasoning) return null;

  return (
    <motion.div
      className="rounded-2xl border border-purple-200 bg-white p-6 shadow-sm"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
    >
      <div className="mb-4 flex items-center gap-2">
        <Brain className="h-4 w-4 text-purple-600" />
        <h2 className="text-sm font-semibold text-gray-900">AI Compliance Reasoning</h2>
        <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-medium text-purple-700">
          Powered by Bedrock
        </span>
      </div>

      {/* Summary */}
      <div className="mb-4 rounded-xl border border-gray-200 bg-gray-50 p-4">
        <p className="text-sm text-gray-800">{reasoning.summary}</p>
      </div>

      {/* Step Explanations */}
      <div className="mb-4 space-y-2">
        {reasoning.step_explanations.map((step, i) => (
          <motion.div
            key={step.step_name}
            className={`flex items-start gap-3 rounded-xl p-3 ${
              step.pass
                ? "border border-emerald-200 bg-emerald-50"
                : "border border-red-200 bg-red-50"
            }`}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: i * 0.1 }}
          >
            {step.pass ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            ) : (
              <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
            )}
            <div>
              <p className="text-xs font-semibold text-gray-900">
                {step.step_name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
              </p>
              <p className="mt-0.5 text-xs text-gray-500">{step.explanation}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Risk Assessment */}
      <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
        <div className="mb-1 flex items-center gap-1.5">
          <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
          <p className="text-xs font-semibold text-amber-700">Risk Assessment</p>
        </div>
        <p className="text-xs text-gray-600">{reasoning.risk_assessment}</p>
      </div>

      {/* Recommendation */}
      <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
        <div className="mb-1 flex items-center gap-1.5">
          <ArrowRight className="h-3.5 w-3.5 text-emerald-600" />
          <p className="text-xs font-semibold text-emerald-700">Recommendation</p>
        </div>
        <p className="text-xs text-gray-600">{reasoning.recommendation}</p>
      </div>
    </motion.div>
  );
}
