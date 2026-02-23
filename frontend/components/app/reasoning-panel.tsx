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
        className="rounded-2xl border border-purple-500/10 bg-purple-500/5 p-6"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.9 }}
      >
        <div className="mb-4 flex items-center gap-2">
          <Brain className="h-4 w-4 text-purple-400" />
          <h2 className="text-sm font-semibold text-foreground">AI Compliance Reasoning</h2>
          <span className="rounded-full bg-purple-500/10 px-2 py-0.5 text-[10px] font-medium text-purple-400">
            Powered by Bedrock
          </span>
        </div>
        <p className="mb-4 text-xs text-muted-foreground">
          Generate natural-language compliance analysis explaining each proof step result using AI.
        </p>
        <button
          type="button"
          onClick={handleGenerate}
          className="flex items-center gap-2 rounded-xl bg-purple-500/80 px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-purple-500 disabled:opacity-50"
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
        className="flex min-h-[200px] items-center justify-center rounded-2xl border border-purple-500/10 bg-purple-500/5 p-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-purple-400" />
          <p className="text-sm text-muted-foreground">
            AI is analyzing compliance results...
          </p>
        </div>
      </motion.div>
    );
  }

  if (!reasoning) return null;

  return (
    <motion.div
      className="rounded-2xl border border-purple-500/10 bg-purple-500/5 p-6"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
    >
      <div className="mb-4 flex items-center gap-2">
        <Brain className="h-4 w-4 text-purple-400" />
        <h2 className="text-sm font-semibold text-foreground">AI Compliance Reasoning</h2>
        <span className="rounded-full bg-purple-500/10 px-2 py-0.5 text-[10px] font-medium text-purple-400">
          Powered by Bedrock
        </span>
      </div>

      {/* Summary */}
      <div className="mb-4 rounded-xl border border-foreground/5 bg-background/40 p-4">
        <p className="text-sm text-foreground">{reasoning.summary}</p>
      </div>

      {/* Step Explanations */}
      <div className="mb-4 space-y-2">
        {reasoning.step_explanations.map((step, i) => (
          <motion.div
            key={step.step_name}
            className={`flex items-start gap-3 rounded-xl p-3 ${
              step.pass
                ? "border border-sg-success/10 bg-sg-success/5"
                : "border border-sg-deny/10 bg-sg-deny/5"
            }`}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: i * 0.1 }}
          >
            {step.pass ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-sg-success" />
            ) : (
              <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-sg-deny" />
            )}
            <div>
              <p className="text-xs font-semibold text-foreground">
                {step.step_name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">{step.explanation}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Risk Assessment */}
      <div className="mb-3 rounded-xl border border-amber-500/10 bg-amber-500/5 p-4">
        <div className="mb-1 flex items-center gap-1.5">
          <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
          <p className="text-xs font-semibold text-amber-400">Risk Assessment</p>
        </div>
        <p className="text-xs text-muted-foreground">{reasoning.risk_assessment}</p>
      </div>

      {/* Recommendation */}
      <div className="rounded-xl border border-foreground/5 bg-background/40 p-4">
        <div className="mb-1 flex items-center gap-1.5">
          <ArrowRight className="h-3.5 w-3.5 text-accent" />
          <p className="text-xs font-semibold text-accent">Recommendation</p>
        </div>
        <p className="text-xs text-muted-foreground">{reasoning.recommendation}</p>
      </div>
    </motion.div>
  );
}
