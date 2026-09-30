import { snapshot } from "./adapter";
import { getRegisteredRuleProvenance, invokeRegisteredRule } from "./registration";
import type {
  AdaptedCollateral,
  ApplicabilityOutcome,
  Decision,
  EvaluationContext,
  EvaluationResult,
  EvidenceValidation,
  Reason,
  RuleEvaluationOutput,
} from "./types";

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

function isRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function freezeDeep<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value as Record<string, unknown>)) freezeDeep(child);
    Object.freeze(value);
  }
  return value;
}

function systemFailure(
  adapted: AdaptedCollateral,
  validated: EvidenceValidation,
  code: "AUTHORITATIVE_RULE_NOT_CONFIGURED" | "RULE_APPLICABILITY_UNRESOLVED" |
    "RULE_NOT_APPLICABLE" | "RULE_EXECUTION_INVALID",
  message: string,
  rule: EvaluationResult["rule"] = null,
  ruleMetadata?: EvaluationResult["ruleMetadata"],
  sourceReview?: EvaluationResult["sourceReview"]
): EvaluationResult {
  return {
    decision: code === "AUTHORITATIVE_RULE_NOT_CONFIGURED" ? "RULE_NOT_CONFIGURED" : "MANUAL_REVIEW_REQUIRED",
    rule,
    reasons: ordered([
      { code, message },
      ...safeReasons((adapted as unknown as Record<string, unknown> | null)?.diagnostics),
    ]),
    evidenceDiagnostics: ordered(safeReasons(
      (validated as unknown as Record<string, unknown> | null)?.diagnostics
    )),
    sourceValidation: "PENDING_SOURCE_VALIDATION",
    ...(ruleMetadata && { ruleMetadata }),
    ...(sourceReview && { sourceReview }),
  };
}

function validReason(value: unknown): value is Reason {
  return isRecord(value) && typeof value.code === "string" && value.code.length > 0 &&
    typeof value.message === "string" && value.message.trim().length > 0 &&
    ["factRef", "evidenceId", "sourceReference"].every((key) =>
      value[key] === undefined || typeof value[key] === "string") &&
    Object.keys(value).every((key) =>
      ["code", "message", "factRef", "evidenceId", "sourceReference"].includes(key));
}

function safeReasons(value: unknown): Reason[] {
  if (!Array.isArray(value)) return [];
  try {
    return value.filter(validReason).map((reason) => ({
      code: reason.code,
      message: reason.message,
      ...(reason.factRef !== undefined && { factRef: reason.factRef }),
      ...(reason.evidenceId !== undefined && { evidenceId: reason.evidenceId }),
      ...(reason.sourceReference !== undefined && { sourceReference: reason.sourceReference }),
    }));
  } catch {
    return [];
  }
}

function validOutput(
  value: unknown,
  id: string,
  version: string,
  allowedReasonCodes: Set<string>
): value is RuleEvaluationOutput {
  if (!isRecord(value) || !["SATISFIED", "NOT_SATISFIED", "INSUFFICIENT_EVIDENCE",
    "MANUAL_REVIEW_REQUIRED"].includes(String(value.decision)) || !isRecord(value.rule) ||
    value.rule.id !== id || value.rule.version !== version || !Array.isArray(value.reasons) ||
    !value.reasons.every(validReason)) return false;
  const codes = value.reasons.map((reason) => reason.code);
  return codes.every((code) => allowedReasonCodes.has(code)) &&
    Object.keys(value).every((key) => ["decision", "rule", "reasons"].includes(key)) &&
    Object.keys(value.rule).every((key) => ["id", "version"].includes(key));
}

function validContext(value: unknown): value is EvaluationContext {
  return isRecord(value) && typeof value.evaluatedAt === "string" &&
    !Number.isNaN(Date.parse(value.evaluatedAt));
}

export function evaluateCollateralEligibility(
  adapted: AdaptedCollateral,
  validated: EvidenceValidation,
  context: EvaluationContext,
  handle?: unknown
): EvaluationResult {
  const registered = getRegisteredRuleProvenance(handle);
  if (!registered) {
    return systemFailure(
      adapted, validated, "AUTHORITATIVE_RULE_NOT_CONFIGURED",
      "No source-validated authoritative rule is installed"
    );
  }

  const rule = { id: registered.metadata.ruleId!, version: registered.metadata.ruleVersion! };
  const ruleMetadata = registered.metadata;
  const sourceReview = registered.sourceReview;
  try {
    if (!validContext(context) || !isRecord(adapted) || !Array.isArray(adapted.facts) ||
      !Array.isArray(adapted.diagnostics) || !isRecord(validated) ||
      !Array.isArray(validated.evidence) || !Array.isArray(validated.diagnostics)) {
      throw new TypeError("Invalid evaluation input");
    }
    const facts = freezeDeep(snapshot(adapted.facts)) as AdaptedCollateral["facts"];
    const evidence = freezeDeep(snapshot(validated.evidence)) as EvidenceValidation["evidence"];
    const evaluationContext = freezeDeep(snapshot(context)) as EvaluationContext;
    const execution = invokeRegisteredRule(handle, facts, evidence, evaluationContext);
    if (!execution) throw new TypeError("Registered rule handle is unavailable");
    const applicability = execution.applicability as ApplicabilityOutcome;
    if (applicability === "UNKNOWN") {
      return systemFailure(
        adapted, validated, "RULE_APPLICABILITY_UNRESOLVED",
        "Rule applicability could not be established",
        rule, ruleMetadata, sourceReview
      );
    }
    if (applicability === "NOT_APPLICABLE") {
      return systemFailure(
        adapted, validated, "RULE_NOT_APPLICABLE",
        "The reviewed rule is outside its stated applicability",
        rule, ruleMetadata, sourceReview
      );
    }
    if (applicability !== "APPLICABLE") throw new TypeError("Invalid applicability result");

    const output = execution.output;
    const allowedReasonCodes = new Set(ruleMetadata.reasonCodes.value!.map((reason) => reason.code));
    if (!validOutput(output, rule.id, rule.version, allowedReasonCodes)) {
      throw new TypeError("Invalid rule output");
    }
    const copiedOutput = snapshot(output) as RuleEvaluationOutput;
    return {
      decision: copiedOutput.decision as Decision,
      rule,
      reasons: ordered(copiedOutput.reasons),
      evidenceDiagnostics: ordered([...validated.diagnostics]),
      sourceValidation: "PENDING_SOURCE_VALIDATION",
      ruleMetadata,
      sourceReview,
    };
  } catch {
    return systemFailure(
      adapted, validated, "RULE_EXECUTION_INVALID",
      "Registered rule evaluation did not produce a valid determination",
      rule, ruleMetadata, sourceReview
    );
  }
}
