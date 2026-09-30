#!/usr/bin/env node
import assert from "node:assert/strict";
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
assert.equal(ruleRegistry.ISLA[0].evaluate({ collateral_type: "bond", allowed_types: ["bond"] }).status, "PASS");
assert.equal(ruleRegistry.ISLA[0].evaluate({ collateral_type: "bond", allowed_types: [] }).reason_code, "INELIGIBLE_COLLATERAL");
assert.equal(ruleRegistry.ISDA[0].evaluate({ counterparty_status: "bad" }).reason_code, "INVALID_COUNTERPARTY");
assert.equal(ruleRegistry.ICMA[1].evaluate({ current_date: "2026-09-30", end_date: "2020-01-01" }).reason_code, "REPO_EXPIRED");
assert.equal(evaluate("ISLA", { collateral_type: "bond", allowed_types: [] }).decision, "FAIL");
assert.deepEqual(Object.keys(ruleRegistry).sort(), ["ICMA", "ISDA", "ISLA"]);
console.log("Contribution boundary, provenance, determinism and reference regression tests passed");
