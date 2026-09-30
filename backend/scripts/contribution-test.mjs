#!/usr/bin/env node
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import path from "node:path";
import ts from "typescript";

const require = createRequire(import.meta.url);
const contribution = require("../dist/contributions/finosCdm/collateralEligibility/index.js");
const { ruleRegistry } = require("../dist/engine/ruleRegistry.js");
const { evaluate } = require("../dist/engine/ossRuleEvaluator.js");
const root = path.resolve("src");
const contributionDir = path.join(root, "contributions/finosCdm/collateralEligibility");
const config = ts.readConfigFile("tsconfig.json", ts.sys.readFile);
assert.equal(config.error, undefined);
const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, process.cwd());
const program = ts.createProgram(parsed.fileNames, parsed.options);
const checker = program.getTypeChecker();

function dependencies(file, visited = new Set()) {
  const absolute = path.resolve(file);
  if (visited.has(absolute)) return visited;
  visited.add(absolute);
  const source = program.getSourceFile(absolute);
  assert.ok(source, `Missing TypeScript source: ${absolute}`);
  source.forEachChild((node) => {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)) {
      const resolved = ts.resolveModuleName(node.moduleSpecifier.text, absolute, parsed.options, ts.sys)
        .resolvedModule?.resolvedFileName;
      if (resolved?.startsWith(root + path.sep)) dependencies(resolved, visited);
    }
  });
  return visited;
}

const entry = path.join(contributionDir, "index.ts");
const imports = dependencies(entry);
assert.ok([...imports].every((file) => file.startsWith(contributionDir + path.sep)),
  "Contribution must not transitively import existing evaluation machinery");
for (const existing of ["server.ts", "engine/ruleRegistry.ts", "cdm/service.ts"]) {
  assert.ok(!dependencies(path.join(root, existing)).has(entry),
    `${existing} must not register or dispatch the contribution`);
}
const index = program.getSourceFile(entry);
assert.ok(index);
const exports = checker.getExportsOfModule(checker.getSymbolAtLocation(index));
assert.ok(!exports.some((symbol) => /Provider|RuleRegistry|^Rule$/.test(symbol.name)));
function exportedType(file, name) {
  const source = program.getSourceFile(path.join(root, file));
  const symbol = checker.getExportsOfModule(checker.getSymbolAtLocation(source))
    .find((entry) => entry.name === name);
  assert.ok(symbol);
  return checker.getDeclaredTypeOfSymbol(symbol);
}
const target = exportedType("contributions/finosCdm/collateralEligibility/types.ts", "CollateralEligibilityRule");
for (const [file, name] of [["rules/types.ts", "Rule"], ["cdm/provider.ts", "CollateralEligibilityProvider"]]) {
  assert.equal(checker.isTypeAssignableTo(exportedType(file, name), target), false,
    `${name} must not be assignable to the new rule contract`);
}

const context = { evaluatedAt: "2026-09-30T12:00:00.000Z" };
const synthetic = {
  sourceObject: { arbitrary: { token: "synthetic-value", zero: 0 } },
  sourceReference: "synthetic-object-1",
  expectedFactRefs: ["internal.unmapped", "internal.token", "internal.zero"],
  mappings: [
    { factRef: "internal.token", sourcePath: "arbitrary.token", mappingId: "test-only-map",
      mappingVersion: "synthetic-v1", status: "CALLER_SUPPLIED_UNVALIDATED" },
    { factRef: "internal.zero", sourcePath: "arbitrary.zero", mappingId: "test-only-map",
      mappingVersion: "synthetic-v1", status: "CALLER_SUPPLIED_UNVALIDATED" },
  ],
};
const evidence = [{ evidenceId: "synthetic-1", source: "test-fixture",
  sourceReference: "synthetic-object-1", observedValue: "synthetic-value",
  factRef: "internal.token" }];
const original = structuredClone(synthetic);
const first = contribution.assessCollateralEligibility(synthetic, evidence, context);
const second = contribution.assessCollateralEligibility(synthetic, evidence, context);
assert.deepEqual(first, second);
assert.deepEqual(synthetic, original);
assert.equal(first.input.sourceObject.arbitrary.token, "synthetic-value");
assert.equal(first.sourceValidation, "PENDING_SOURCE_VALIDATION");
assert.equal(first.facts.find((fact) => fact.factRef === "internal.token").source.sourcePath, "arbitrary.token");
assert.equal(first.facts.find((fact) => fact.factRef === "internal.zero").observedValue, 0);
assert.equal(first.facts.find((fact) => fact.factRef === "internal.unmapped").kind, "UNAVAILABLE");
assert.equal(first.facts.find((fact) => fact.factRef === "internal.unmapped").mappingStatus, "UNMAPPED");
assert.equal(first.evidence[0].validation, "UNVALIDATED");
assert.equal(first.evaluation.evidenceDiagnostics[0].code, "EVIDENCE_UNVALIDATED");
assert.equal(first.facts.some((fact) => fact.kind === "DERIVED"), false);
for (const [input, suppliedEvidence] of [
  [synthetic, evidence], [synthetic, undefined],
  [synthetic, [{ evidenceId: "bad", observedValue: true }]],
  [{ sourceObject: { collateral_type: "bond", allowed_types: ["bond"] }, sourceReference: "old-rule-shaped" }, []],
  [{ sourceObject: null, sourceReference: "" }, []],
]) {
  const artifact = contribution.assessCollateralEligibility(input, suppliedEvidence, context);
  assert.equal(artifact.evaluation.decision, "RULE_NOT_CONFIGURED");
  assert.equal(artifact.evaluation.rule, null);
  assert.ok(artifact.evaluation.reasons.some((reason) => reason.code === "AUTHORITATIVE_RULE_NOT_CONFIGURED"));
  assert.equal(Object.hasOwn(artifact.evaluation, "isEligible"), false);
  assert.deepEqual(artifact, contribution.assessCollateralEligibility(input, suppliedEvidence, context));
}
assert.equal(contribution.assessCollateralEligibility(synthetic, undefined, context)
  .evaluation.evidenceDiagnostics[0].code, "EVIDENCE_MISSING");
assert.equal(contribution.assessCollateralEligibility({ sourceObject: [], sourceReference: "" }, [], context)
  .evaluation.reasons.some((reason) => reason.code === "ADAPTER_INPUT_INVALID"), true);
const unexpected = contribution.assessCollateralEligibility({
  ...synthetic, mappings: [{ ...synthetic.mappings[0], sourcePath: "missing.path" }],
  expectedFactRefs: ["internal.token"],
}, [], context);
assert.equal(unexpected.facts[0].kind, "UNAVAILABLE");
const derived = {
  kind: "DERIVED", factRef: "internal.example-derived", observedValue: "synthetic-only",
  derivationId: "test-only", derivationVersion: "1", inputFactRefs: ["internal.token"],
  source: { sourceReference: "synthetic-object-1" },
};
assert.equal(derived.kind, "DERIVED");
assert.deepEqual(derived.inputFactRefs, ["internal.token"]);

const reviewed = (value) => ({ status: "REVIEWED", value });
const unresolved = { status: "UNRESOLVED", value: null };
const notApplicable = { status: "NOT_APPLICABLE", value: null };
function syntheticMetadata(ruleId = "synthetic-test-rule", ruleVersion = "test-v1") {
  return {
    contributionId: "finos-cdm-collateral-eligibility",
    ruleId,
    ruleVersion,
    sourceAuthority: reviewed("Synthetic test authority (not authoritative)"),
    sourceDocument: reviewed({
      title: "Synthetic test document (not authoritative)",
      reference: "urn:synthetic-test-only:document",
      version: "synthetic-document-v1",
    }),
    sourceProvision: reviewed("Synthetic test provision (not a real clause)"),
    effectiveDate: notApplicable,
    jurisdiction: reviewed(["TEST ONLY"]),
    scope: notApplicable,
    applicabilityConditions: reviewed([]),
    requiredInputs: reviewed([]),
    requiredEvidence: reviewed([]),
    reasonCodes: reviewed([{
      code: "SYNTHETIC_TEST_RESULT",
      description: "Test-only reason declaration; not an eligibility criterion",
    }]),
    provenance: reviewed({
      sourceReference: "urn:synthetic-test-only:document",
      documentVersion: "synthetic-document-v1",
      provisionReference: "Synthetic test provision (not a real clause)",
      notes: ["Synthetic fixture only; no source authority is asserted"],
    }),
  };
}
function syntheticAdmission(metadata) {
  return {
    recordType: "APPLICATION_CONTROLLED_SOURCE_REVIEW",
    disposition: "APPROVED_FOR_REGISTRATION",
    reviewerId: "test-only-synthetic-reviewer",
    reviewReference: "test-only-synthetic-review-record",
    reviewedAt: "2026-09-30T12:00:00.000Z",
    reviewedMetadata: structuredClone(metadata),
  };
}
function syntheticDefinition(metadata, evaluateFunction, applicabilityFunction = () => "APPLICABLE") {
  return {
    lifecycle: "REVIEW_COMPLETE",
    metadata,
    checkApplicability: applicabilityFunction,
    evaluate: evaluateFunction,
  };
}
function outputFor(metadata, decision = "SATISFIED", reasons = []) {
  return { decision, rule: { id: metadata.ruleId, version: metadata.ruleVersion }, reasons };
}
function assertNonDetermination(assessment) {
  assert.ok(["RULE_NOT_CONFIGURED", "MANUAL_REVIEW_REQUIRED"].includes(assessment.evaluation.decision));
  assert.notEqual(assessment.evaluation.decision, "SATISFIED");
  assert.notEqual(assessment.evaluation.decision, "NOT_SATISFIED");
}

const ruleRegistryForContribution = new contribution.CollateralEligibilityRuleCatalog();
let rejectedCallbackCalls = 0;
let invalidCandidateIndex = 0;
const rejectedMetadataCases = [
  ["missing rule id", (metadata) => { delete metadata.ruleId; }],
  ["null rule id", (metadata) => { metadata.ruleId = null; }],
  ["blank rule id", (metadata) => { metadata.ruleId = "   "; }],
  ["missing version", (metadata) => { delete metadata.ruleVersion; }],
  ["null version", (metadata) => { metadata.ruleVersion = null; }],
  ["blank version", (metadata) => { metadata.ruleVersion = ""; }],
  ["missing authority", (metadata) => { delete metadata.sourceAuthority; }],
  ["unresolved authority", (metadata) => { metadata.sourceAuthority = unresolved; }],
  ["null authority", (metadata) => { metadata.sourceAuthority = reviewed(null); }],
  ["blank authority", (metadata) => { metadata.sourceAuthority = reviewed(" "); }],
  ["TODO authority", (metadata) => { metadata.sourceAuthority = reviewed("TODO: source"); }],
  ["missing source document", (metadata) => { delete metadata.sourceDocument; }],
  ["unresolved source document", (metadata) => { metadata.sourceDocument = unresolved; }],
  ["null document title", (metadata) => { metadata.sourceDocument.value.title = null; }],
  ["blank document reference", (metadata) => { metadata.sourceDocument.value.reference = ""; }],
  ["blank document version", (metadata) => { metadata.sourceDocument.value.version = " "; }],
  ["missing provision", (metadata) => { delete metadata.sourceProvision; }],
  ["unresolved provision", (metadata) => { metadata.sourceProvision = unresolved; }],
  ["null provision", (metadata) => { metadata.sourceProvision = reviewed(null); }],
  ["blank provision", (metadata) => { metadata.sourceProvision = reviewed(" "); }],
  ["unresolved effective date", (metadata) => { metadata.effectiveDate = unresolved; }],
  ["malformed effective date", (metadata) => { metadata.effectiveDate = reviewed("2026-02-30"); }],
  ["wrong effective date type", (metadata) => { metadata.effectiveDate = reviewed(20260930); }],
  ["missing jurisdiction", (metadata) => { delete metadata.jurisdiction; }],
  ["unresolved jurisdiction", (metadata) => { metadata.jurisdiction = unresolved; }],
  ["malformed jurisdiction", (metadata) => { metadata.jurisdiction = reviewed("TEST"); }],
  ["missing scope", (metadata) => { delete metadata.scope; }],
  ["unresolved scope", (metadata) => { metadata.scope = unresolved; }],
  ["unresolved applicability", (metadata) => { metadata.applicabilityConditions = unresolved; }],
  ["missing applicability", (metadata) => { delete metadata.applicabilityConditions; }],
  ["null inputs declaration", (metadata) => { metadata.requiredInputs = reviewed(null); }],
  ["blank required input", (metadata) => { metadata.requiredInputs = reviewed([" "]); }],
  ["unresolved inputs", (metadata) => { metadata.requiredInputs = unresolved; }],
  ["null evidence declaration", (metadata) => { metadata.requiredEvidence = reviewed(null); }],
  ["blank evidence declaration", (metadata) => { metadata.requiredEvidence = reviewed([" "]); }],
  ["unresolved evidence", (metadata) => { metadata.requiredEvidence = unresolved; }],
  ["null reason declaration", (metadata) => { metadata.reasonCodes = reviewed(null); }],
  ["unresolved reasons", (metadata) => { metadata.reasonCodes = unresolved; }],
  ["duplicate reason declarations", (metadata) => {
    metadata.reasonCodes.value.push({ ...metadata.reasonCodes.value[0] });
  }],
  ["malformed reason declaration", (metadata) => {
    metadata.reasonCodes.value[0].code = "lower-case";
  }],
  ["unresolved provenance", (metadata) => { metadata.provenance = unresolved; }],
  ["missing provenance", (metadata) => { delete metadata.provenance; }],
  ["TODO provenance note", (metadata) => { metadata.provenance.value.notes = ["TODO: confirm"]; }],
  ["mismatched provenance", (metadata) => {
    metadata.provenance.value.provisionReference = "different synthetic provision";
  }],
  ["extra metadata flag", (metadata) => { metadata.sourceValidation = "VALIDATED"; }],
];
for (const [label, alter] of rejectedMetadataCases) {
  const metadata = syntheticMetadata(`synthetic-invalid-${invalidCandidateIndex++}`);
  alter(metadata);
  const candidate = syntheticDefinition(metadata, () => {
    rejectedCallbackCalls += 1;
    return outputFor(metadata);
  }, () => {
    rejectedCallbackCalls += 1;
    return "APPLICABLE";
  });
  const registration = ruleRegistryForContribution.register(candidate, syntheticAdmission(metadata));
  assert.equal(registration.ok, false, `${label} must reject registration`);
  assert.ok(registration.diagnostics.length > 0, `${label} has stable diagnostics`);
  assert.deepEqual(
    ruleRegistryForContribution.register(candidate, syntheticAdmission(metadata)).diagnostics,
    registration.diagnostics,
    `${label} diagnostics are stable`
  );
  assertNonDetermination(contribution.assessCollateralEligibility(synthetic, evidence, context, registration.handle));
  const directEvaluation = contribution.evaluateCollateralEligibility(
    contribution.adaptCollateralInput(synthetic),
    contribution.validateEvidence(evidence),
    context,
    registration.handle
  );
  assert.equal(directEvaluation.decision, "RULE_NOT_CONFIGURED");
  assert.equal(rejectedCallbackCalls, 0, `${label} callback must not run`);
}

for (const lifecycle of ["DRAFT", "TEMPLATE"]) {
  const metadata = syntheticMetadata(`synthetic-${lifecycle.toLowerCase()}`);
  const candidate = syntheticDefinition(metadata, () => {
    rejectedCallbackCalls += 1;
    return outputFor(metadata, "NOT_SATISFIED");
  });
  candidate.lifecycle = lifecycle;
  const registration = ruleRegistryForContribution.register(candidate, syntheticAdmission(metadata));
  assert.equal(registration.ok, false, `${lifecycle} with callbacks is non-executable`);
  assert.ok(registration.diagnostics.some((item) => item.code === "RULE_NOT_REVIEW_COMPLETE"));
  assertNonDetermination(contribution.assessCollateralEligibility(synthetic, evidence, context, registration.handle));
  assert.equal(rejectedCallbackCalls, 0);
}

const unresolvedTemplateMetadata = syntheticMetadata("synthetic-template");
unresolvedTemplateMetadata.ruleId = null;
unresolvedTemplateMetadata.ruleVersion = null;
unresolvedTemplateMetadata.sourceAuthority = unresolved;
unresolvedTemplateMetadata.sourceDocument = unresolved;
unresolvedTemplateMetadata.sourceProvision = unresolved;
unresolvedTemplateMetadata.effectiveDate = unresolved;
unresolvedTemplateMetadata.jurisdiction = unresolved;
unresolvedTemplateMetadata.scope = unresolved;
unresolvedTemplateMetadata.applicabilityConditions = unresolved;
unresolvedTemplateMetadata.requiredInputs = unresolved;
unresolvedTemplateMetadata.requiredEvidence = unresolved;
unresolvedTemplateMetadata.reasonCodes = unresolved;
unresolvedTemplateMetadata.provenance = unresolved;
const explicitTemplate = ruleRegistryForContribution.register({
  lifecycle: "TEMPLATE",
  metadata: unresolvedTemplateMetadata,
  checkApplicability: null,
  evaluate: null,
}, syntheticAdmission(unresolvedTemplateMetadata));
assert.equal(explicitTemplate.ok, false, "An explicitly unresolved, non-executable template cannot register");
assertNonDetermination(contribution.assessCollateralEligibility(
  synthetic, evidence, context, explicitTemplate.handle
));

const incompleteMetadata = syntheticMetadata("synthetic-no-admission");
const completeWithoutAdmission = ruleRegistryForContribution.register(
  syntheticDefinition(incompleteMetadata, () => outputFor(incompleteMetadata)),
  { sourceValidation: "VALIDATED" }
);
assert.equal(completeWithoutAdmission.ok, false, "A self-asserted validation flag is not admission evidence");
assert.ok(completeWithoutAdmission.diagnostics.some((item) => item.code === "RULE_ADMISSION_INVALID"));
const noAdmissionEvaluation = contribution.evaluateCollateralEligibility(
  contribution.adaptCollateralInput(synthetic),
  contribution.validateEvidence(evidence),
  context,
  completeWithoutAdmission.handle
);
assert.equal(noAdmissionEvaluation.decision, "RULE_NOT_CONFIGURED");

const alteredAdmissionMetadata = syntheticMetadata("synthetic-admission-binding");
const alteredAdmission = syntheticAdmission(alteredAdmissionMetadata);
alteredAdmission.reviewedMetadata.sourceProvision = reviewed("A different synthetic provision");
assert.equal(ruleRegistryForContribution.register(
  syntheticDefinition(alteredAdmissionMetadata, () => outputFor(alteredAdmissionMetadata)),
  alteredAdmission
).ok, false, "Admission evidence must bind to the exact metadata");
let badAdmissionIndex = 0;
for (const [name, alterAdmission] of [
  ["missing reviewer", (admission) => { delete admission.reviewerId; }],
  ["blank reviewer", (admission) => { admission.reviewerId = " "; }],
  ["TODO review reference", (admission) => { admission.reviewReference = "TODO"; }],
  ["malformed review timestamp", (admission) => { admission.reviewedAt = "2026-02-30T12:00:00Z"; }],
  ["extra validation flag", (admission) => { admission.sourceValidation = "VALIDATED"; }],
]) {
  const metadata = syntheticMetadata(`synthetic-bad-admission-${badAdmissionIndex++}`);
  const admission = syntheticAdmission(metadata);
  alterAdmission(admission);
  const result = ruleRegistryForContribution.register(
    syntheticDefinition(metadata, () => outputFor(metadata)),
    admission
  );
  assert.equal(result.ok, false, `${name} is insufficient admission evidence`);
  assert.ok(result.diagnostics.some((item) => item.code === "RULE_ADMISSION_INVALID"));
}

const missingEvaluatorMetadata = syntheticMetadata("synthetic-missing-evaluator");
const missingEvaluator = syntheticDefinition(missingEvaluatorMetadata, null);
assert.equal(ruleRegistryForContribution.register(
  missingEvaluator, syntheticAdmission(missingEvaluatorMetadata)
).ok, false);
const missingApplicabilityMetadata = syntheticMetadata("synthetic-missing-applicability");
const missingApplicability = syntheticDefinition(missingApplicabilityMetadata, () => outputFor(missingApplicabilityMetadata));
missingApplicability.checkApplicability = null;
assert.equal(ruleRegistryForContribution.register(
  missingApplicability, syntheticAdmission(missingApplicabilityMetadata)
).ok, false);

const metadataV1 = syntheticMetadata("synthetic-versioned-rule", "test-v1");
const metadataV1Identity = { ruleId: metadataV1.ruleId, ruleVersion: metadataV1.ruleVersion };
let versionOneCalls = 0;
const definitionV1 = syntheticDefinition(metadataV1, () => {
  versionOneCalls += 1;
  return outputFor(metadataV1Identity, "SATISFIED", [{
    code: "SYNTHETIC_TEST_RESULT", message: "Synthetic version one only",
  }]);
});
const registrationV1 = ruleRegistryForContribution.register(definitionV1, syntheticAdmission(metadataV1));
assert.equal(registrationV1.ok, true);
const metadataV2 = syntheticMetadata("synthetic-versioned-rule", "test-v2");
const definitionV2 = syntheticDefinition(metadataV2, () => outputFor(metadataV2, "NOT_SATISFIED", [{
  code: "SYNTHETIC_TEST_RESULT", message: "Synthetic version two only",
}]));
const registrationV2 = ruleRegistryForContribution.register(definitionV2, syntheticAdmission(metadataV2));
assert.equal(registrationV2.ok, true, "Explicit side-by-side versions are supported");
const reviewedEmptyReasonsMetadata = syntheticMetadata("synthetic-reviewed-empty-reasons");
reviewedEmptyReasonsMetadata.reasonCodes = reviewed([]);
const reviewedEmptyReasons = ruleRegistryForContribution.register(
  syntheticDefinition(reviewedEmptyReasonsMetadata, () => outputFor(reviewedEmptyReasonsMetadata)),
  syntheticAdmission(reviewedEmptyReasonsMetadata)
);
assert.equal(reviewedEmptyReasons.ok, true, "A reviewed empty reason declaration is explicit and complete");
assert.equal(ruleRegistryForContribution.select("synthetic-versioned-rule", "test-v3"), null);
assert.equal(ruleRegistryForContribution.select("toString", "test-v1"), null);

const assessmentV1 = contribution.assessCollateralEligibility(
  synthetic, evidence, context, ruleRegistryForContribution.select("synthetic-versioned-rule", "test-v1")
);
const assessmentV2 = contribution.assessCollateralEligibility(
  synthetic, evidence, context, ruleRegistryForContribution.select("synthetic-versioned-rule", "test-v2")
);
assert.equal(assessmentV1.evaluation.decision, "SATISFIED");
assert.equal(assessmentV1.evaluation.rule.version, "test-v1");
assert.equal(assessmentV1.evaluation.ruleMetadata.sourceDocument.value.version, "synthetic-document-v1");
assert.equal(assessmentV1.evaluation.sourceReview.reviewReference, "test-only-synthetic-review-record");
assert.equal(assessmentV1.evaluation.sourceValidation, "PENDING_SOURCE_VALIDATION");
assert.equal(assessmentV2.evaluation.decision, "NOT_SATISFIED");
assert.equal(assessmentV2.evaluation.rule.version, "test-v2");
assert.equal(assessmentV2.evaluation.ruleMetadata.ruleId, "synthetic-versioned-rule");
assert.deepEqual(JSON.parse(JSON.stringify(assessmentV1)), assessmentV1);
assert.deepEqual(assessmentV1, contribution.assessCollateralEligibility(
  synthetic, evidence, context, ruleRegistryForContribution.select("synthetic-versioned-rule", "test-v1")
));
assert.equal(Object.isFrozen(assessmentV1.evaluation.ruleMetadata), true);
assert.equal(Object.isFrozen(assessmentV1.evaluation.ruleMetadata.requiredInputs.value), true);

const registeredV1Handle = registrationV1.handle;
metadataV1.sourceDocument.value.title = "Mutated after registration";
metadataV1.ruleVersion = "mutated-version";
definitionV1.evaluate = () => outputFor(metadataV1, "NOT_SATISFIED");
assert.equal(ruleRegistryForContribution.select("synthetic-versioned-rule", "test-v1"), registeredV1Handle);
const afterMutation = contribution.assessCollateralEligibility(synthetic, evidence, context, registeredV1Handle);
assert.equal(afterMutation.evaluation.rule.version, "test-v1");
assert.equal(afterMutation.evaluation.ruleMetadata.sourceDocument.value.title, "Synthetic test document (not authoritative)");
assert.equal(afterMutation.evaluation.decision, "SATISFIED");
assert.equal(versionOneCalls, 3, "The captured evaluator identity is retained");

const duplicateMetadata = syntheticMetadata("synthetic-versioned-rule", "test-v1");
const duplicateResult = ruleRegistryForContribution.register(
  syntheticDefinition(duplicateMetadata, () => outputFor(duplicateMetadata, "NOT_SATISFIED")),
  syntheticAdmission(duplicateMetadata)
);
assert.equal(duplicateResult.ok, false, "A duplicate ID/version cannot overwrite a valid registration");
assert.ok(duplicateResult.diagnostics.some((item) => item.code === "RULE_VERSION_ALREADY_REGISTERED"));
assert.equal(contribution.assessCollateralEligibility(synthetic, evidence, context, registeredV1Handle)
  .evaluation.decision, "SATISFIED");

for (const [name, applicability] of [
  ["indeterminate", () => "UNKNOWN"],
  ["outside", () => "NOT_APPLICABLE"],
]) {
  const metadata = syntheticMetadata(`synthetic-applicability-${name}`);
  let evaluationCalls = 0;
  const registration = ruleRegistryForContribution.register(
    syntheticDefinition(metadata, () => {
      evaluationCalls += 1;
      return outputFor(metadata);
    }, applicability),
    syntheticAdmission(metadata)
  );
  assert.equal(registration.ok, true);
  const assessment = contribution.assessCollateralEligibility(synthetic, evidence, context, registration.handle);
  assertNonDetermination(assessment);
  assert.equal(evaluationCalls, 0, `${name} applicability cannot reach the rule callback`);
}

const badOutputs = [
  ["wrong identity", (metadata) => ({ ...outputFor(metadata), rule: { id: "other", version: metadata.ruleVersion } })],
  ["undeclared reason", (metadata) => outputFor(metadata, "SATISFIED", [{ code: "INVENTED_CODE", message: "bad" }])],
  ["unconfigured output", (metadata) => outputFor(metadata, "RULE_NOT_CONFIGURED")],
  ["malformed output", () => ({ decision: "SATISFIED", isEligible: true })],
  ["throwing evaluator", () => { throw new Error("synthetic failure"); }],
];
for (const [name, makeOutput] of badOutputs) {
  const metadata = syntheticMetadata(`synthetic-bad-output-${name.replaceAll(" ", "-")}`);
  const registration = ruleRegistryForContribution.register(
    syntheticDefinition(metadata, () => makeOutput(metadata)),
    syntheticAdmission(metadata)
  );
  assert.equal(registration.ok, true, `${name} is rejected at evaluation, not admission`);
  const assessment = contribution.assessCollateralEligibility(synthetic, evidence, context, registration.handle);
  assert.equal(assessment.evaluation.decision, "MANUAL_REVIEW_REQUIRED", name);
  assert.ok(assessment.evaluation.reasons.some((reason) => reason.code === "RULE_EXECUTION_INVALID"));
  assert.equal(assessment.evaluation.rule.version, "test-v1");
}

const forgedHandle = { kind: "REGISTERED_COLLATERAL_ELIGIBILITY_RULE" };
assertNonDetermination(contribution.assessCollateralEligibility(synthetic, evidence, context, forgedHandle));
assertNonDetermination(contribution.assessCollateralEligibility(synthetic, evidence, context, {
  kind: "REGISTERED_COLLATERAL_ELIGIBILITY_RULE",
  metadata: metadataV1,
  evaluate: () => outputFor(metadataV1),
}));
const forgedEvaluation = contribution.evaluateCollateralEligibility(
  contribution.adaptCollateralInput(synthetic),
  contribution.validateEvidence(evidence),
  context,
  forgedHandle
);
assert.equal(forgedEvaluation.decision, "RULE_NOT_CONFIGURED");
assert.equal(forgedEvaluation.rule, null);

assert.equal(ruleRegistry.ISLA[0].evaluate({ collateral_type: "bond", allowed_types: ["bond"] }).status, "PASS");
assert.equal(ruleRegistry.ISLA[0].evaluate({ collateral_type: "bond", allowed_types: [] }).reason_code, "INELIGIBLE_COLLATERAL");
assert.equal(ruleRegistry.ISDA[0].evaluate({ counterparty_status: "bad" }).reason_code, "INVALID_COUNTERPARTY");
assert.equal(ruleRegistry.ICMA[1].evaluate({ current_date: "2026-09-30", end_date: "2020-01-01" }).reason_code, "REPO_EXPIRED");
assert.equal(evaluate("ISLA", { collateral_type: "bond", allowed_types: [] }).decision, "FAIL");
assert.deepEqual(Object.keys(ruleRegistry).sort(), ["ICMA", "ISDA", "ISLA"]);

const registeredRule = ruleRegistryForContribution.select("synthetic-versioned-rule", "test-v1");
const proof = contribution.createCollateralEligibilityProof(synthetic, evidence, context, registeredRule);
const repeatedProof = contribution.createCollateralEligibilityProof(synthetic, evidence, context, registeredRule);
assert.deepEqual(proof, repeatedProof);
assert.equal(proof.assessment.evaluation.decision, "SATISFIED");
assert.equal(proof.assessment.evaluation.rule.version, "test-v1");
assert.equal(proof.assessment.evaluation.sourceReview.reviewReference, "test-only-synthetic-review-record");
assert.deepEqual(proof.subject, {
  kind: { status: "UNRESOLVED", value: null },
  reference: { status: "SOURCE_REFERENCE_ONLY", value: "synthetic-object-1" },
  identityAssertion: "NOT_ESTABLISHED",
});
assert.equal(proof.operationalState.evaluationTime, context.evaluatedAt);
assert.equal(proof.operationalState.sourceAsOf, null);
assert.equal(proof.operationalState.freshness, "UNKNOWN");
assert.deepEqual(proof.operationalState.factRefs, proof.assessment.facts.map((fact) => fact.factRef));
assert.deepEqual(proof.operationalState.evidenceReferences, ["synthetic-1"]);
assert.equal(Object.isFrozen(proof), true);
assert.equal(Object.isFrozen(proof.assessment.evaluation.reasons), true);
assert.deepEqual(JSON.parse(JSON.stringify(proof)), proof);
const verifiedProof = contribution.verifyCollateralEligibilityProof(
  JSON.parse(JSON.stringify(proof)), registeredRule
);
assert.equal(verifiedProof.integrity, "VERIFIED");
assert.equal(verifiedProof.replay, "VERIFIED");
assert.equal(verifiedProof.recordedDecision, "SATISFIED");
assert.equal(verifiedProof.determinationAuthority, "NOT_ESTABLISHED_BY_PROOF_VERIFICATION");

const keyOrderVariant = {
  expectedFactRefs: [...synthetic.expectedFactRefs],
  mappings: synthetic.mappings.map((mapping) => ({
    status: mapping.status, mappingVersion: mapping.mappingVersion, mappingId: mapping.mappingId,
    sourcePath: mapping.sourcePath, factRef: mapping.factRef,
  })),
  sourceReference: synthetic.sourceReference,
  sourceObject: { arbitrary: { zero: 0, token: "synthetic-value" } },
};
assert.equal(contribution.createCollateralEligibilityProof(keyOrderVariant, evidence, context, registeredRule)
  .commitment.digest, proof.commitment.digest, "Object insertion order does not affect canonical commitments");
const orderedArrayVariant = structuredClone(synthetic);
orderedArrayVariant.sourceObject.arbitrary.sequence = ["first", "second"];
const reversedArrayVariant = structuredClone(orderedArrayVariant);
reversedArrayVariant.sourceObject.arbitrary.sequence.reverse();
assert.notEqual(
  contribution.createCollateralEligibilityProof(orderedArrayVariant, evidence, context, registeredRule)
    .commitment.digest,
  contribution.createCollateralEligibilityProof(reversedArrayVariant, evidence, context, registeredRule)
    .commitment.digest,
  "Array order remains significant"
);

const invalidEvidence = [...evidence, { evidenceId: "rejected-evidence", observedValue: true }];
const diagnosticsProof = contribution.createCollateralEligibilityProof(synthetic, invalidEvidence, context);
assert.ok(diagnosticsProof.assessment.evaluation.evidenceDiagnostics
  .some((reason) => reason.code === "EVIDENCE_INVALID"));
assert.deepEqual(diagnosticsProof.replay.evidence.value, invalidEvidence);
assert.equal(contribution.verifyCollateralEligibilityProof(diagnosticsProof).replay, "VERIFIED");

const absentEvidenceProof = contribution.createCollateralEligibilityProof(synthetic, undefined, context);
const nullEvidenceProof = contribution.createCollateralEligibilityProof(synthetic, null, context);
assert.equal(absentEvidenceProof.replay.evidence.status, "ABSENT");
assert.equal(nullEvidenceProof.replay.evidence.status, "NULL");
assert.notEqual(absentEvidenceProof.commitment.digest, nullEvidenceProof.commitment.digest);
for (const missingOrInvalid of [
  absentEvidenceProof,
  contribution.createCollateralEligibilityProof(synthetic, invalidEvidence, context),
]) {
  assert.equal(missingOrInvalid.assessment.evaluation.decision, "RULE_NOT_CONFIGURED");
  assert.equal(missingOrInvalid.assessment.evaluation.rule, null);
  assert.ok(missingOrInvalid.assessment.evaluation.reasons
    .some((reason) => reason.code === "AUTHORITATIVE_RULE_NOT_CONFIGURED"));
  assert.equal(contribution.verifyCollateralEligibilityProof(missingOrInvalid).replay, "VERIFIED");
  assert.equal(contribution.verifyCollateralEligibilityProof(missingOrInvalid).recordedDecision, "RULE_NOT_CONFIGURED");
}

const otherVersion = ruleRegistryForContribution.select("synthetic-versioned-rule", "test-v2");
assert.equal(contribution.verifyCollateralEligibilityProof(proof, otherVersion).replay, "UNAVAILABLE");
assert.equal(contribution.verifyCollateralEligibilityProof(proof).replay, "UNAVAILABLE");
const inconsistentMetadata = structuredClone(proof);
inconsistentMetadata.assessment.evaluation.ruleMetadata.ruleVersion = "test-v2";
assert.equal(contribution.verifyCollateralEligibilityProof(inconsistentMetadata, registeredRule).integrity, "FAILED");

function canonicalizeTest(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalizeTest).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) =>
    `${JSON.stringify(key)}:${canonicalizeTest(value[key])}`).join(",")}}`;
}
function rehashArtifact(artifact) {
  const { commitment, ...payload } = structuredClone(artifact);
  return {
    ...payload,
    commitment: {
      algorithm: commitment.algorithm,
      digest: createHash("sha256").update(canonicalizeTest(payload)).digest("hex"),
    },
  };
}
const callsBeforeTampering = versionOneCalls;
for (const mutate of [
  (artifact) => { artifact.replay.input.value.sourceReference = "tampered-reference"; },
  (artifact) => { artifact.replay.evidence.value[0].observedValue = "tampered-evidence"; },
  (artifact) => { artifact.assessment.mappings[0].mappingVersion = "tampered-map-version"; },
  (artifact) => { artifact.assessment.context.evaluatedAt = "2026-09-29T12:00:00.000Z"; },
  (artifact) => { artifact.assessment.evaluation.rule.version = "test-v2"; },
  (artifact) => { artifact.assessment.evaluation.decision = "NOT_SATISFIED"; },
  (artifact) => { artifact.assessment.evaluation.reasons[0].message = "tampered reason"; },
  (artifact) => { artifact.assessment.facts[0].observedValue = "tampered fact"; },
]) {
  const tampered = structuredClone(proof);
  mutate(tampered);
  const result = contribution.verifyCollateralEligibilityProof(tampered, registeredRule);
  assert.equal(result.integrity, "FAILED");
  assert.equal(result.replay, "NOT_ATTEMPTED");
}
assert.equal(versionOneCalls, callsBeforeTampering, "Integrity failures must not invoke a registered callback");
const staleState = structuredClone(proof);
staleState.operationalState.freshness = "FRESH";
const rehashedStaleState = rehashArtifact(staleState);
const stateMismatch = contribution.verifyCollateralEligibilityProof(rehashedStaleState, registeredRule);
assert.equal(stateMismatch.integrity, "VERIFIED");
assert.equal(stateMismatch.replay, "MISMATCH");
assert.ok(stateMismatch.reasons.some((reason) => reason.code === "SUBJECT_STATE_MISMATCH"));
const coherentPayloadWithOldCommitment = rehashArtifact(proof);
coherentPayloadWithOldCommitment.replay.input.value.sourceReference = "altered-with-new-hash";
const rehashedInconsistentInput = rehashArtifact(coherentPayloadWithOldCommitment);
assert.equal(contribution.verifyCollateralEligibilityProof(rehashedInconsistentInput, registeredRule).replay,
  "MISMATCH", "A recomputed hash does not bypass deterministic replay");

const coherentEdited = structuredClone(proof);
coherentEdited.replay.input.value.sourceObject.note = "coherent edit";
coherentEdited.assessment.input.sourceObject.note = "coherent edit";
assert.equal(contribution.verifyCollateralEligibilityProof(rehashArtifact(coherentEdited), registeredRule).replay,
  "VERIFIED", "A coherent edit and new self-commitment cannot establish original authenticity");
for (const mutate of [
  (artifact) => { artifact.schemaVersion = 2; },
  (artifact) => { artifact.pipelineVersion = "unknown-pipeline"; },
  (artifact) => { artifact.normalizationVersion = "unknown-normalizer"; },
  (artifact) => { artifact.commitment.algorithm = "SHA-512"; },
]) {
  const unsupported = structuredClone(proof);
  mutate(unsupported);
  const result = contribution.verifyCollateralEligibilityProof(unsupported, registeredRule);
  assert.equal(result.replay, "NOT_ATTEMPTED");
}
const malformedArtifact = structuredClone(proof);
malformedArtifact.replay.input.value = Number.NaN;
assert.equal(contribution.verifyCollateralEligibilityProof(malformedArtifact, registeredRule).integrity, "FAILED");
let accessorCalls = 0;
const accessorInput = {
  sourceReference: "synthetic-accessor-input",
  get sourceObject() {
    accessorCalls += 1;
    return {};
  },
};
assert.throws(() => contribution.createCollateralEligibilityProof(accessorInput, evidence, context), TypeError);
assert.equal(accessorCalls, 0, "Unsupported accessors are rejected without invoking them");
const cyclicInput = {};
cyclicInput.self = cyclicInput;
assert.throws(() => contribution.createCollateralEligibilityProof(cyclicInput, evidence, context), /cycles/);
assert.throws(() => contribution.createCollateralEligibilityProof(
  { sourceReference: "non-finite", sourceObject: { value: Number.POSITIVE_INFINITY } }, evidence, context
), /strict JSON/);

console.log("Contribution boundary, provenance, proof artifact, replay and reference regression tests passed");
