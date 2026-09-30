import { createHash } from "node:crypto";
import { assessCollateralEligibility } from "./assessment";
import { canonicalizeProofJson, operationalStateForAssessment, subjectForAssessment } from "./proof-artifact";
import { getRegisteredRuleProvenance } from "./registration";
import type {
  AssessmentReplay,
  CapturedReplayInput,
  Decision,
  ProofArtifactPayload,
  ProofVerification,
} from "./types";

const decisions: Decision[] = [
  "SATISFIED",
  "NOT_SATISFIED",
  "INSUFFICIENT_EVIDENCE",
  "MANUAL_REVIEW_REQUIRED",
  "RULE_NOT_CONFIGURED",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}

function exactKeys(value: unknown, keys: string[]): value is Record<string, unknown> {
  return isRecord(value) && Object.keys(value).length === keys.length &&
    keys.every((key) => Object.hasOwn(value, key));
}

function failure(
  integrity: ProofVerification["integrity"],
  replay: ProofVerification["replay"],
  code: string,
  message: string,
  recordedDecision: Decision | null = null
): ProofVerification {
  return {
    integrity,
    replay,
    reasons: [{ code, message }],
    recordedDecision,
    determinationAuthority: "NOT_ESTABLISHED_BY_PROOF_VERIFICATION",
  };
}

function replayInput(value: CapturedReplayInput): unknown {
  if (value.status === "ABSENT") return undefined;
  if (value.status === "NULL") return null;
  if (value.status === "VALUE") return value.value;
  throw new TypeError("Unsupported replay input state");
}

function recordedDecision(value: unknown): Decision | null {
  if (!isRecord(value) || !isRecord(value.assessment) || !isRecord(value.assessment.evaluation)) return null;
  const decision = value.assessment.evaluation.decision;
  return decisions.includes(decision as Decision) ? decision as Decision : null;
}

export function verifyCollateralEligibilityProof(
  untrustedArtifact: unknown,
  ruleHandle?: unknown
): ProofVerification {
  let decision: Decision | null = null;
  try {
    if (!exactKeys(untrustedArtifact, [
      "artifactType", "schemaVersion", "canonicalizationVersion", "pipelineVersion",
      "normalizationVersion", "subject", "operationalState", "replay", "assessment", "commitment",
    ])) {
      return failure("FAILED", "NOT_ATTEMPTED", "ARTIFACT_MALFORMED", "Proof artifact structure is invalid");
    }
    const artifact = JSON.parse(canonicalizeProofJson(untrustedArtifact)) as Record<string, unknown>;
    decision = recordedDecision(artifact);
    if (artifact.artifactType !== "FINOS_CDM_COLLATERAL_ELIGIBILITY_ASSESSMENT" ||
      artifact.schemaVersion !== 1 ||
      artifact.canonicalizationVersion !== "COMPLIOPEN_JSON_KEY_SORT_V1" ||
      artifact.pipelineVersion !== "COMPLIOPEN_FINOS_CDM_COLLATERAL_ELIGIBILITY_PIPELINE_V1" ||
      artifact.normalizationVersion !== "COMPLIOPEN_FINOS_CDM_COLLATERAL_NORMALIZATION_V1") {
      return failure("UNSUPPORTED", "NOT_ATTEMPTED", "ARTIFACT_VERSION_UNSUPPORTED",
        "Proof artifact schema or pipeline version is not supported", decision);
    }
    const commitment = artifact.commitment;
    if (!exactKeys(commitment, ["algorithm", "digest"]) ||
      commitment.algorithm !== "SHA-256" || typeof commitment.digest !== "string" ||
      !/^[a-f0-9]{64}$/.test(commitment.digest)) {
      return failure("UNSUPPORTED", "NOT_ATTEMPTED", "COMMITMENT_UNSUPPORTED",
        "Proof artifact commitment algorithm or format is not supported", decision);
    }
    const { commitment: _commitment, ...payload } = artifact;
    const expectedDigest = createHash("sha256").update(canonicalizeProofJson(payload)).digest("hex");
    if (expectedDigest !== commitment.digest) {
      return failure("FAILED", "NOT_ATTEMPTED", "COMMITMENT_MISMATCH",
        "Proof artifact payload does not match its SHA-256 commitment", decision);
    }

    const body = payload as unknown as ProofArtifactPayload;
    if (!exactKeys(body.replay, ["input", "evidence", "context"]) ||
      !exactKeys(body.replay.input, ["status", ...(body.replay.input.status === "VALUE" ? ["value"] : [])]) ||
      !exactKeys(body.replay.evidence, ["status", ...(body.replay.evidence.status === "VALUE" ? ["value"] : [])]) ||
      !["ABSENT", "NULL", "VALUE"].includes(body.replay.input.status) ||
      !["ABSENT", "NULL", "VALUE"].includes(body.replay.evidence.status) ||
      !isRecord(body.replay.context) || typeof body.replay.context.evaluatedAt !== "string" ||
      Number.isNaN(Date.parse(body.replay.context.evaluatedAt)) ||
      !isRecord(body.assessment) || !isRecord(body.assessment.evaluation)) {
      return failure("FAILED", "NOT_ATTEMPTED", "ARTIFACT_MALFORMED",
        "Proof artifact replay inputs or assessment are invalid", decision);
    }
    if (canonicalizeProofJson(body.subject) !== canonicalizeProofJson(subjectForAssessment(body.assessment)) ||
      canonicalizeProofJson(body.operationalState) !==
        canonicalizeProofJson(operationalStateForAssessment(body.assessment))) {
      return failure("VERIFIED", "MISMATCH", "SUBJECT_STATE_MISMATCH",
        "Recorded subject or operational state is inconsistent with its assessment", decision);
    }

    const evaluation = body.assessment.evaluation;
    let trustedHandle: unknown;
    if (evaluation.rule === null) {
      if (evaluation.ruleMetadata !== undefined || evaluation.sourceReview !== undefined) {
        return failure("VERIFIED", "MISMATCH", "RULE_BINDING_INVALID",
          "Unconfigured assessment contains unexpected rule provenance", decision);
      }
    } else {
      if (!exactKeys(evaluation.rule, ["id", "version"]) ||
        typeof evaluation.rule.id !== "string" || typeof evaluation.rule.version !== "string") {
        return failure("VERIFIED", "MISMATCH", "RULE_BINDING_INVALID",
          "Recorded rule identity is malformed", decision);
      }
      const registered = getRegisteredRuleProvenance(ruleHandle);
      if (!registered) {
        return failure("VERIFIED", "UNAVAILABLE", "RULE_VERSION_UNAVAILABLE",
          "The exact recorded rule version is not available from a trusted registration", decision);
      }
      const expectedBinding = {
        rule: { id: registered.metadata.ruleId, version: registered.metadata.ruleVersion },
        ruleMetadata: registered.metadata,
        sourceReview: registered.sourceReview,
      };
      const recordedBinding = {
        rule: evaluation.rule,
        ruleMetadata: evaluation.ruleMetadata ?? null,
        sourceReview: evaluation.sourceReview ?? null,
      };
      if (canonicalizeProofJson(expectedBinding) !== canonicalizeProofJson(recordedBinding)) {
        return failure("VERIFIED", "UNAVAILABLE", "RULE_METADATA_MISMATCH",
          "Trusted registration does not match the exact recorded rule metadata and review lineage", decision);
      }
      trustedHandle = ruleHandle;
    }

    const replay = body.replay as AssessmentReplay;
    const replayed = assessCollateralEligibility(
      replayInput(replay.input),
      replayInput(replay.evidence),
      replay.context,
      trustedHandle
    );
    if (canonicalizeProofJson(replayed) !== canonicalizeProofJson(body.assessment)) {
      return failure("VERIFIED", "MISMATCH", "REPLAY_MISMATCH",
        "Deterministic assessment replay did not reproduce the complete recorded assessment", decision);
    }
    return {
      integrity: "VERIFIED",
      replay: "VERIFIED",
      reasons: [],
      recordedDecision: decision,
      determinationAuthority: "NOT_ESTABLISHED_BY_PROOF_VERIFICATION",
    };
  } catch {
    return failure("FAILED", "NOT_ATTEMPTED", "ARTIFACT_INVALID",
      "Proof artifact could not be safely validated", decision);
  }
}
