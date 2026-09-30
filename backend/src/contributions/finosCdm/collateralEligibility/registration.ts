import type {
  ApplicabilityOutcome,
  CollateralEligibilityRuleMetadata,
  CollateralFact,
  EvaluationContext,
  Evidence,
  RegisteredCollateralEligibilityRule,
  RuleEvaluationOutput,
  RuleSourceReviewAdmission,
  CollateralEligibilityRule,
} from "./types";

export type RegistrationDiagnosticCode =
  | "RULE_DEFINITION_INVALID"
  | "RULE_NOT_REVIEW_COMPLETE"
  | "RULE_METADATA_INCOMPLETE"
  | "RULE_ADMISSION_INVALID"
  | "RULE_VERSION_ALREADY_REGISTERED";

export interface RegistrationDiagnostic {
  code: RegistrationDiagnosticCode;
  path: string;
  message: string;
}

export type RuleRegistrationResult =
  | { ok: true; handle: RegisteredCollateralEligibilityRule; diagnostics: [] }
  | { ok: false; handle: null; diagnostics: RegistrationDiagnostic[] };

interface RegisteredRuleEntry {
  metadata: CollateralEligibilityRuleMetadata;
  sourceReview: RuleSourceReviewAdmission;
  checkApplicability: (
    facts: readonly CollateralFact[],
    evidence: readonly Evidence[],
    context: EvaluationContext
  ) => ApplicabilityOutcome;
  evaluate: (
    facts: readonly CollateralFact[],
    evidence: readonly Evidence[],
    context: EvaluationContext
  ) => RuleEvaluationOutput;
}

interface Candidate {
  lifecycle: unknown;
  metadata: unknown;
  checkApplicability: unknown;
  evaluate: unknown;
}

interface Admission {
  recordType: unknown;
  disposition: unknown;
  reviewerId: unknown;
  reviewReference: unknown;
  reviewedAt: unknown;
  reviewedMetadata: unknown;
}

const registeredEntries = new WeakMap<object, RegisteredRuleEntry>();

function isRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasExactKeys(value: unknown, expected: string[]): value is Record<string, unknown> {
  return isRecord(value) && Object.keys(value).length === expected.length &&
    expected.every((key) => Object.hasOwn(value, key));
}

function cloneJson(value: unknown): unknown {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (Array.isArray(value)) {
    const result: unknown[] = [];
    if (Reflect.ownKeys(value).length !== value.length + 1) throw new TypeError("Invalid array properties");
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (!descriptor || !("value" in descriptor)) throw new TypeError("Invalid array");
      result.push(cloneJson(descriptor.value));
    }
    return result;
  }
  if (!isRecord(value)) throw new TypeError("Expected plain JSON data");
  const result: Record<string, unknown> = {};
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== "string") throw new TypeError("Expected string keys");
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor?.enumerable || !("value" in descriptor)) throw new TypeError("Expected data properties");
    result[key] = cloneJson(descriptor.value);
  }
  return result;
}

function freezeDeep<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value as Record<string, unknown>)) freezeDeep(child);
    Object.freeze(value);
  }
  return value;
}

function ownValue(record: Record<string, unknown>, key: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(record, key);
  return descriptor && "value" in descriptor ? descriptor.value : undefined;
}

function nonblank(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

function validTimestamp(value: unknown): value is string {
  return typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) &&
    validDate(value.slice(0, 10)) &&
    !Number.isNaN(Date.parse(value));
}

function containsPlaceholder(value: unknown): boolean {
  if (typeof value === "string") {
    return /(?:^|[^A-Z0-9])(?:TODO|TBD|PLACEHOLDER|UNRESOLVED|UNKNOWN)(?:$|[^A-Z0-9])/i.test(value);
  }
  if (Array.isArray(value)) return value.some(containsPlaceholder);
  return isRecord(value) && Object.values(value).some(containsPlaceholder);
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (isRecord(value)) {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

function freezeMetadata(value: unknown): CollateralEligibilityRuleMetadata | null {
  try {
    const metadata = cloneJson(value);
    return isRecord(metadata) ? freezeDeep(metadata) as unknown as CollateralEligibilityRuleMetadata : null;
  } catch {
    return null;
  }
}

function validateMetadata(
  metadata: CollateralEligibilityRuleMetadata | null,
  diagnostics: RegistrationDiagnostic[]
): metadata is CollateralEligibilityRuleMetadata {
  const issue = (path: string) => diagnostics.push({
    code: "RULE_METADATA_INCOMPLETE", path, message: "Reviewed, complete rule metadata is required",
  });
  if (!metadata) {
    issue("metadata");
    return false;
  }
  if (!hasExactKeys(metadata, [
    "contributionId", "ruleId", "ruleVersion", "sourceAuthority", "sourceDocument",
    "sourceProvision", "effectiveDate", "jurisdiction", "scope", "applicabilityConditions",
    "requiredInputs", "requiredEvidence", "reasonCodes", "provenance",
  ])) issue("metadata");
  if (metadata.contributionId !== "finos-cdm-collateral-eligibility") issue("metadata.contributionId");
  if (!nonblank(metadata.ruleId) || !nonblank(metadata.ruleVersion)) issue("metadata.ruleId/ruleVersion");
  if (containsPlaceholder(metadata)) issue("metadata");

  const reviewedString = (value: unknown, path: string) => {
    if (!hasExactKeys(value, ["status", "value"]) ||
      value.status !== "REVIEWED" || !nonblank(value.value)) issue(path);
  };
  const applicabilityValue = (value: unknown, path: string, array: boolean) => {
    if (!hasExactKeys(value, ["status", "value"])) {
      issue(path);
      return;
    }
    if (value.status === "NOT_APPLICABLE" && value.value === null) return;
    if (value.status !== "REVIEWED") {
      issue(path);
      return;
    }
    if (array) {
      if (!Array.isArray(value.value) || !value.value.every(nonblank)) issue(path);
    } else if (!validDate(value.value)) {
      issue(path);
    }
  };
  const declaration = (value: unknown, path: string, validItem: (item: unknown) => boolean) => {
    if (!hasExactKeys(value, ["status", "value"]) || value.status !== "REVIEWED" || !Array.isArray(value.value) ||
      !value.value.every(validItem)) issue(path);
  };

  reviewedString(metadata.sourceAuthority, "metadata.sourceAuthority");
  reviewedString(metadata.sourceProvision, "metadata.sourceProvision");
  const document = hasExactKeys(metadata.sourceDocument, ["status", "value"]) &&
    metadata.sourceDocument.status === "REVIEWED" && isRecord(metadata.sourceDocument.value)
    ? metadata.sourceDocument.value : null;
  if (!document || !hasExactKeys(document, ["title", "reference", "version"]) ||
    !nonblank(document.title) || !nonblank(document.reference) || !nonblank(document.version)) {
    issue("metadata.sourceDocument");
  }
  applicabilityValue(metadata.effectiveDate, "metadata.effectiveDate", false);
  applicabilityValue(metadata.jurisdiction, "metadata.jurisdiction", true);
  applicabilityValue(metadata.scope, "metadata.scope", true);
  const validString = (value: unknown) => nonblank(value);
  declaration(metadata.applicabilityConditions, "metadata.applicabilityConditions", validString);
  declaration(metadata.requiredInputs, "metadata.requiredInputs", validString);
  declaration(metadata.requiredEvidence, "metadata.requiredEvidence", validString);
  declaration(metadata.reasonCodes, "metadata.reasonCodes", (value) =>
    hasExactKeys(value, ["code", "description"]) && typeof value.code === "string" &&
    /^[A-Z][A-Z0-9_]*$/.test(value.code) && nonblank(value.description));
  if (isRecord(metadata.reasonCodes) && Array.isArray(metadata.reasonCodes.value)) {
    const codes = metadata.reasonCodes.value
      .filter(isRecord).map((reason) => reason.code).filter((code): code is string => typeof code === "string");
    if (new Set(codes).size !== codes.length) issue("metadata.reasonCodes");
  }
  const provenance = hasExactKeys(metadata.provenance, ["status", "value"]) &&
    metadata.provenance.status === "REVIEWED" &&
    isRecord(metadata.provenance.value) ? metadata.provenance.value : null;
  if (!provenance || !hasExactKeys(provenance, [
    "sourceReference", "documentVersion", "provisionReference", "notes",
  ]) || !nonblank(provenance.sourceReference) || !nonblank(provenance.documentVersion) ||
    !nonblank(provenance.provisionReference) || !Array.isArray(provenance.notes) ||
    !provenance.notes.every(nonblank)) {
    issue("metadata.provenance");
  } else if (!document || !isRecord(metadata.sourceProvision) ||
    provenance.sourceReference !== document.reference ||
    provenance.documentVersion !== document.version ||
    provenance.provisionReference !== metadata.sourceProvision.value) {
    issue("metadata.provenance");
  }
  return diagnostics.length === 0;
}

function readCandidate(value: unknown): Candidate | null {
  if (!hasExactKeys(value, ["lifecycle", "metadata", "checkApplicability", "evaluate"])) return null;
  return {
    lifecycle: ownValue(value, "lifecycle"),
    metadata: ownValue(value, "metadata"),
    checkApplicability: ownValue(value, "checkApplicability"),
    evaluate: ownValue(value, "evaluate"),
  };
}

function readAdmission(value: unknown): Admission | null {
  if (!hasExactKeys(value, [
    "recordType", "disposition", "reviewerId", "reviewReference", "reviewedAt", "reviewedMetadata",
  ])) return null;
  return {
    recordType: ownValue(value, "recordType"),
    disposition: ownValue(value, "disposition"),
    reviewerId: ownValue(value, "reviewerId"),
    reviewReference: ownValue(value, "reviewReference"),
    reviewedAt: ownValue(value, "reviewedAt"),
    reviewedMetadata: ownValue(value, "reviewedMetadata"),
  };
}

function validAdmission(
  admission: Admission | null,
  metadata: CollateralEligibilityRuleMetadata,
  diagnostics: RegistrationDiagnostic[]
): admission is Admission {
  const reviewedMetadata = freezeMetadata(admission?.reviewedMetadata);
  const valid = admission?.recordType === "APPLICATION_CONTROLLED_SOURCE_REVIEW" &&
    admission.disposition === "APPROVED_FOR_REGISTRATION" &&
    nonblank(admission.reviewerId) && nonblank(admission.reviewReference) &&
    validTimestamp(admission.reviewedAt) && reviewedMetadata !== null &&
    !containsPlaceholder(admission) &&
    canonical(reviewedMetadata) === canonical(metadata);
  if (!valid) {
    diagnostics.push({
      code: "RULE_ADMISSION_INVALID", path: "sourceReview",
      message: "Application-controlled review evidence bound to this exact metadata version is required",
    });
    return false;
  }
  return true;
}

function sortDiagnostics(diagnostics: RegistrationDiagnostic[]): RegistrationDiagnostic[] {
  const unique = new Map<string, RegistrationDiagnostic>();
  for (const diagnostic of diagnostics) {
    unique.set(`${diagnostic.code}\0${diagnostic.path}`, diagnostic);
  }
  return [...unique.values()].sort((left, right) =>
    left.code.localeCompare(right.code) || left.path.localeCompare(right.path));
}

export interface RegisteredRuleProvenance {
  metadata: CollateralEligibilityRuleMetadata;
  sourceReview: RuleSourceReviewAdmission;
}

export interface RegisteredRuleExecution {
  applicability: unknown;
  output?: unknown;
}

function lookupRegisteredRule(handle: unknown): RegisteredRuleEntry | undefined {
  if ((typeof handle !== "object" && typeof handle !== "function") || handle === null) return undefined;
  return registeredEntries.get(handle);
}

export function getRegisteredRuleProvenance(handle: unknown): RegisteredRuleProvenance | undefined {
  const entry = lookupRegisteredRule(handle);
  return entry ? { metadata: entry.metadata, sourceReview: entry.sourceReview } : undefined;
}

export function invokeRegisteredRule(
  handle: unknown,
  facts: readonly CollateralFact[],
  evidence: readonly Evidence[],
  context: EvaluationContext
): RegisteredRuleExecution | undefined {
  const entry = lookupRegisteredRule(handle);
  if (!entry) return undefined;
  const applicability: unknown = Reflect.apply(entry.checkApplicability, undefined, [facts, evidence, context]);
  if (applicability !== "APPLICABLE") return { applicability };
  return {
    applicability,
    output: Reflect.apply(entry.evaluate, undefined, [facts, evidence, context]),
  };
}

export class CollateralEligibilityRuleCatalog {
  readonly #handles = new Map<string, RegisteredCollateralEligibilityRule>();

  register(definitionInput: unknown, admissionInput: unknown): RuleRegistrationResult {
    const diagnostics: RegistrationDiagnostic[] = [];
    let definition: Candidate | null = null;
    let admission: Admission | null = null;
    try {
      definition = readCandidate(definitionInput);
      admission = readAdmission(admissionInput);
    } catch {
      diagnostics.push({
        code: "RULE_DEFINITION_INVALID", path: "definition",
        message: "Rule definition and review evidence must be plain data objects",
      });
    }
    if (!definition) {
      diagnostics.push({
        code: "RULE_DEFINITION_INVALID", path: "definition",
        message: "A plain rule definition object is required",
      });
    } else if (definition.lifecycle !== "REVIEW_COMPLETE") {
      diagnostics.push({
        code: "RULE_NOT_REVIEW_COMPLETE", path: "lifecycle",
        message: "DRAFT and TEMPLATE definitions are non-executable",
      });
    }

    const metadata = freezeMetadata(definition?.metadata);
    validateMetadata(metadata, diagnostics);
    if (typeof definition?.checkApplicability !== "function") {
      diagnostics.push({
        code: "RULE_DEFINITION_INVALID", path: "checkApplicability",
        message: "A reviewed applicability function is required",
      });
    }
    if (typeof definition?.evaluate !== "function") {
      diagnostics.push({
        code: "RULE_DEFINITION_INVALID", path: "evaluate",
        message: "A rule evaluation function is required",
      });
    }
    if (metadata) validAdmission(admission, metadata, diagnostics);
    if (metadata?.ruleId && metadata.ruleVersion &&
      this.#handles.has(canonical([metadata.ruleId, metadata.ruleVersion]))) {
      diagnostics.push({
        code: "RULE_VERSION_ALREADY_REGISTERED", path: "metadata.ruleId/ruleVersion",
        message: "This exact rule version is already registered",
      });
    }

    const ordered = sortDiagnostics(diagnostics);
    if (ordered.length > 0 || !metadata || !definition || !admission ||
      typeof definition.checkApplicability !== "function" || typeof definition.evaluate !== "function") {
      return { ok: false, handle: null, diagnostics: ordered };
    }

    const sourceReview = freezeDeep({
      recordType: admission.recordType,
      disposition: admission.disposition,
      reviewerId: admission.reviewerId,
      reviewReference: admission.reviewReference,
      reviewedAt: admission.reviewedAt,
      reviewedMetadata: freezeMetadata(admission.reviewedMetadata)!,
    }) as unknown as RuleSourceReviewAdmission;
    const entry: RegisteredRuleEntry = {
      metadata,
      sourceReview,
      checkApplicability: definition.checkApplicability as CollateralEligibilityRule["checkApplicability"],
      evaluate: definition.evaluate as CollateralEligibilityRule["evaluate"],
    };
    const handle = Object.freeze({ kind: "REGISTERED_COLLATERAL_ELIGIBILITY_RULE" }) as RegisteredCollateralEligibilityRule;
    registeredEntries.set(handle, entry);
    this.#handles.set(canonical([metadata.ruleId, metadata.ruleVersion]), handle);
    return { ok: true, handle, diagnostics: [] };
  }

  select(ruleId: string, ruleVersion: string): RegisteredCollateralEligibilityRule | null {
    if (!nonblank(ruleId) || !nonblank(ruleVersion)) return null;
    return this.#handles.get(canonical([ruleId, ruleVersion])) ?? null;
  }
}
