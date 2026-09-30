import { createHash } from "node:crypto";
import { assessCollateralEligibility } from "./assessment";
import type {
  Assessment,
  AssessmentReplay,
  CapturedReplayInput,
  CollateralOperationalState,
  CollateralSubject,
  EvaluationContext,
  ProofArtifact,
  ProofArtifactPayload,
} from "./types";

function snapshotJson(value: unknown): unknown {
  const seen = new Set<object>();
  function visit(item: unknown): unknown {
    if (item === null || typeof item === "string" || typeof item === "boolean") return item;
    if (typeof item === "number" && Number.isFinite(item)) return item;
    if (typeof item !== "object") throw new TypeError("Proof inputs must be strict JSON data");
    if (seen.has(item)) throw new TypeError("Proof inputs cannot contain cycles");
    seen.add(item);
    if (Array.isArray(item)) {
      if (Object.getPrototypeOf(item) !== Array.prototype) {
        throw new TypeError("Proof arrays must be plain JSON arrays");
      }
      const keys = Reflect.ownKeys(item);
      if (keys.length !== item.length + 1) throw new TypeError("Proof arrays cannot have extra properties");
      const copy: unknown[] = [];
      for (let index = 0; index < item.length; index += 1) {
        const descriptor = Object.getOwnPropertyDescriptor(item, String(index));
        if (!descriptor?.enumerable || !("value" in descriptor)) {
          throw new TypeError("Proof arrays cannot be sparse or contain accessors");
        }
        copy.push(visit(descriptor.value));
      }
      seen.delete(item);
      return copy;
    }
    const prototype = Object.getPrototypeOf(item);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new TypeError("Proof objects must be plain JSON objects");
    }
    const entries: [string, unknown][] = [];
    for (const key of Reflect.ownKeys(item)) {
      if (typeof key !== "string") throw new TypeError("Proof object keys must be strings");
      const descriptor = Object.getOwnPropertyDescriptor(item, key);
      if (!descriptor?.enumerable || !("value" in descriptor)) {
        throw new TypeError("Proof objects cannot contain accessors or hidden properties");
      }
      entries.push([key, visit(descriptor.value)]);
    }
    seen.delete(item);
    return Object.fromEntries(entries);
  }
  return visit(value);
}

export function canonicalizeProofJson(value: unknown): string {
  const snapshot = snapshotJson(value);
  function encode(item: unknown): string {
    if (item === null || typeof item !== "object") return JSON.stringify(item) as string;
    if (Array.isArray(item)) return `[${item.map(encode).join(",")}]`;
    const record = item as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) =>
      `${JSON.stringify(key)}:${encode(record[key])}`).join(",")}}`;
  }
  return encode(snapshot);
}

function capture(value: unknown): CapturedReplayInput {
  if (value === undefined) return { status: "ABSENT" };
  if (value === null) return { status: "NULL" };
  return { status: "VALUE", value: snapshotJson(value) };
}

function restore(value: CapturedReplayInput): unknown {
  if (value.status === "ABSENT") return undefined;
  if (value.status === "NULL") return null;
  if (value.status === "VALUE") return value.value;
  throw new TypeError("Unsupported replay input state");
}

export function subjectForAssessment(assessment: Assessment): CollateralSubject {
  const reference = assessment.input.sourceReference;
  return {
    kind: { status: "UNRESOLVED", value: null },
    reference: reference
      ? { status: "SOURCE_REFERENCE_ONLY", value: reference }
      : { status: "UNRESOLVED", value: null },
    identityAssertion: "NOT_ESTABLISHED",
  };
}

export function operationalStateForAssessment(assessment: Assessment): CollateralOperationalState {
  return {
    factRefs: assessment.facts.map((fact) => fact.factRef),
    evidenceReferences: assessment.evidence.map((evidence) => evidence.evidenceId),
    evidenceObservations: assessment.evidence.map((evidence) => ({
      evidenceId: evidence.evidenceId,
      observedAt: evidence.observedAt ?? null,
    })),
    evaluationTime: assessment.context.evaluatedAt,
    sourceAsOf: null,
    freshness: "UNKNOWN",
    diagnostics: {
      normalization: assessment.adapterDiagnostics,
      evidence: assessment.evaluation.evidenceDiagnostics,
    },
  };
}

function freezeDeep<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value as Record<string, unknown>)) freezeDeep(child);
    Object.freeze(value);
  }
  return value;
}

export function createCollateralEligibilityProof(
  input: unknown,
  evidenceInput: unknown,
  context: EvaluationContext,
  ruleHandle?: unknown
): ProofArtifact {
  const replay: AssessmentReplay = {
    input: capture(input),
    evidence: capture(evidenceInput),
    context: snapshotJson(context) as EvaluationContext,
  };
  const assessment = assessCollateralEligibility(
    restore(replay.input),
    restore(replay.evidence),
    replay.context,
    ruleHandle
  );
  const payload: ProofArtifactPayload = {
    artifactType: "FINOS_CDM_COLLATERAL_ELIGIBILITY_ASSESSMENT",
    schemaVersion: 1,
    canonicalizationVersion: "COMPLIOPEN_JSON_KEY_SORT_V1",
    pipelineVersion: "COMPLIOPEN_FINOS_CDM_COLLATERAL_ELIGIBILITY_PIPELINE_V1",
    normalizationVersion: "COMPLIOPEN_FINOS_CDM_COLLATERAL_NORMALIZATION_V1",
    subject: subjectForAssessment(assessment),
    operationalState: operationalStateForAssessment(assessment),
    replay,
    assessment,
  };
  const safePayload = snapshotJson(payload) as ProofArtifactPayload;
  const digest = createHash("sha256").update(canonicalizeProofJson(safePayload)).digest("hex");
  return freezeDeep({
    ...safePayload,
    commitment: { algorithm: "SHA-256", digest },
  });
}
