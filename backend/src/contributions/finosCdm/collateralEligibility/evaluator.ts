import type { AdaptedCollateral, EvaluationContext, EvaluationResult, EvidenceValidation, Reason } from "./types";

function ordered(reasons: Reason[]): Reason[] {
  const seen = new Set<string>();
  return reasons.sort((a, b) =>
    a.code.localeCompare(b.code) ||
    (a.factRef ?? "").localeCompare(b.factRef ?? "") ||
    (a.evidenceId ?? "").localeCompare(b.evidenceId ?? "") ||
    (a.sourceReference ?? "").localeCompare(b.sourceReference ?? "") ||
    a.message.localeCompare(b.message)
  ).filter((reason) => {
    const key = JSON.stringify(reason);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// No authority-installation parameter or fallback exists in the shipped API.
export function evaluateCollateralEligibility(
  adapted: AdaptedCollateral,
  validated: EvidenceValidation,
  _context: EvaluationContext
): EvaluationResult {
  return {
    decision: "RULE_NOT_CONFIGURED",
    rule: null,
    reasons: ordered([
      { code: "AUTHORITATIVE_RULE_NOT_CONFIGURED", message: "No source-validated authoritative rule is installed" },
      ...adapted.diagnostics,
    ]),
    evidenceDiagnostics: ordered([...validated.diagnostics]),
    sourceValidation: "PENDING_SOURCE_VALIDATION",
  };
}
