import { adaptCollateralInput, snapshot } from "./adapter";
import { validateEvidence } from "./evidence";
import { evaluateCollateralEligibility } from "./evaluator";
import type { Assessment, EvaluationContext } from "./types";

export function assessCollateralEligibility(
  input: unknown,
  evidenceInput: unknown,
  context: EvaluationContext
): Assessment {
  if (!context || typeof context.evaluatedAt !== "string" ||
    Number.isNaN(Date.parse(context.evaluatedAt))) {
    throw new TypeError("A valid caller-provided evaluation time is required");
  }
  const adapted = adaptCollateralInput(input);
  const validated = validateEvidence(evidenceInput);
  const evaluation = evaluateCollateralEligibility(adapted, validated, context);
  return {
    contributionId: adapted.contributionId,
    input: { sourceObject: adapted.sourceObject, sourceReference: adapted.sourceReference },
    mappings: adapted.mappings, facts: adapted.facts,
    evidence: validated.evidence, sourceValidation: adapted.sourceValidation,
    context: snapshot(context) as EvaluationContext, evaluation,
  };
}
