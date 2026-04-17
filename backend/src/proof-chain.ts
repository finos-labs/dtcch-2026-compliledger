import type { SettlementIntent, ProofStepResult } from "./types";
import { canonicalStringify, sha256 } from "./crypto";
import { screenIssuerLEI } from "./external/gleif";
import { lookupAssetByISIN, validateAssetClassification } from "./external/openfigi";
import { screenMultipleParties } from "./external/ofac";
import { fetchReserveRatio, buildReserveCheckResult } from "./external/reserve-oracle";
import { gleifCircuit, sanctionsCircuit } from "./circuit-breaker";
import { logger } from "./logger";

const ORACLE_ENABLED = process.env.SG_ORACLE_ENABLED === "true";

function makeInputsHash(inputs: Record<string, unknown>): string {
  return sha256(canonicalStringify(inputs));
}

async function issuerLegitimacy(intent: SettlementIntent, index: number): Promise<ProofStepResult> {
  const reasonCodes: string[] = [];
  let pass = intent.issuer_status === "active";
  const oracleData: Record<string, unknown> = {};

  if (!pass) reasonCodes.push("ISSUER_NOT_ACTIVE");

  if (ORACLE_ENABLED && intent.lei) {
    try {
      const leiResult = await gleifCircuit.fire(() =>
        screenIssuerLEI(intent.lei!, intent.issuer_name)
      );
      oracleData.lei_check = leiResult;

      if (!leiResult.valid) {
        pass = false;
        reasonCodes.push(leiResult.reason ?? "LEI_VALIDATION_FAILED");
      } else if (leiResult.record) {
        oracleData.gleif_legal_name = leiResult.record.legal_name;
        oracleData.gleif_jurisdiction = leiResult.record.jurisdiction;
      }
    } catch (err) {
      logger.warn({ err: (err as Error).message }, "GLEIF circuit open — skipping LEI check");
      oracleData.lei_check = { skipped: true, reason: "circuit_open" };
    }
  }

  if (ORACLE_ENABLED && intent.issuer_name) {
    const parties = [{ name: intent.issuer_name, role: "issuer" }];
    if (intent.custody_provider) parties.push({ name: intent.custody_provider, role: "custodian" });

    try {
      const sanctions = await sanctionsCircuit.fire(() => screenMultipleParties(parties));
      oracleData.sanctions_check = sanctions;
      if (!sanctions.cleared) {
        pass = false;
        reasonCodes.push("SANCTIONS_MATCH_DETECTED");
      }
    } catch (err) {
      logger.warn({ err: (err as Error).message }, "Sanctions circuit open — skipping screen");
      oracleData.sanctions_check = { skipped: true, reason: "circuit_open" };
    }
  }

  return {
    step_name: "issuer_legitimacy",
    step_index: index,
    pass,
    reason_codes: reasonCodes,
    normalized_inputs_hash: makeInputsHash({
      issuer_name: intent.issuer_name,
      issuer_status: intent.issuer_status,
      lei: intent.lei ?? null,
    }),
    evaluated_at: new Date().toISOString(),
    ...(Object.keys(oracleData).length > 0 && { oracle_data: oracleData }),
  } as ProofStepResult;
}

async function assetClassification(intent: SettlementIntent, index: number): Promise<ProofStepResult> {
  const reasonCodes: string[] = [];
  let pass = false;
  const oracleData: Record<string, unknown> = {};

  if (intent.asset_type === "tokenized_treasury") {
    pass = intent.classification === "tokenized_security";
    if (!pass) reasonCodes.push("CLASSIFICATION_MISMATCH_EXPECTED_TOKENIZED_SECURITY");
  } else if (intent.asset_type === "stablecoin") {
    pass = intent.classification === "stablecoin";
    if (!pass) reasonCodes.push("CLASSIFICATION_MISMATCH_EXPECTED_STABLECOIN");
  } else {
    reasonCodes.push("UNKNOWN_ASSET_TYPE");
  }

  if (ORACLE_ENABLED && intent.isin) {
    try {
      const figiRecord = await lookupAssetByISIN(intent.isin);
      if (figiRecord) {
        oracleData.figi_record = figiRecord;
        const classCheck = validateAssetClassification(figiRecord, intent.asset_type);
        if (!classCheck.valid) {
          pass = false;
          reasonCodes.push(classCheck.reason ?? "FIGI_CLASSIFICATION_MISMATCH");
        }
      }
    } catch (err) {
      logger.warn({ err: (err as Error).message }, "OpenFIGI lookup failed — skipping");
    }
  }

  return {
    step_name: "asset_classification",
    step_index: index,
    pass,
    reason_codes: reasonCodes,
    normalized_inputs_hash: makeInputsHash({
      asset_type: intent.asset_type,
      classification: intent.classification,
      isin: intent.isin ?? null,
    }),
    evaluated_at: new Date().toISOString(),
    ...(Object.keys(oracleData).length > 0 && { oracle_data: oracleData }),
  } as ProofStepResult;
}

async function custodyConditions(intent: SettlementIntent, index: number): Promise<ProofStepResult> {
  const reasonCodes: string[] = [];
  const pass = intent.custody_valid === true;

  if (!pass) reasonCodes.push("CUSTODY_INVALID");

  if (ORACLE_ENABLED && !pass) {
    logger.warn(
      { custody_provider: intent.custody_provider },
      "Custody validation failed. Production: integrate BNY Mellon / State Street / Northern Trust API."
    );
  }

  return {
    step_name: "custody_conditions",
    step_index: index,
    pass,
    reason_codes: reasonCodes,
    normalized_inputs_hash: makeInputsHash({
      custody_provider: intent.custody_provider,
      custody_valid: intent.custody_valid,
    }),
    evaluated_at: new Date().toISOString(),
  };
}

async function backingReserve(intent: SettlementIntent, index: number): Promise<ProofStepResult> {
  const reasonCodes: string[] = [];
  const oracleData: Record<string, unknown> = {};
  let oracleResult = null;

  if (ORACLE_ENABLED) {
    try {
      oracleResult = await fetchReserveRatio(intent.asset_type, intent.asset_id);
      if (oracleResult) oracleData.reserve_oracle = oracleResult;
    } catch (err) {
      logger.warn({ err: (err as Error).message }, "Reserve oracle failed — using submitted value");
    }
  }

  const check = buildReserveCheckResult(intent.reserve_ratio, oracleResult);
  if (!check.passed && check.reason) reasonCodes.push(check.reason);

  return {
    step_name: "backing_reserve",
    step_index: index,
    pass: check.passed,
    reason_codes: reasonCodes,
    normalized_inputs_hash: makeInputsHash({
      reserve_ratio: intent.reserve_ratio,
      reserve_source: check.source,
    }),
    evaluated_at: new Date().toISOString(),
    ...(Object.keys(oracleData).length > 0 && { oracle_data: oracleData }),
  } as ProofStepResult;
}

export async function executeProofChain(intent: SettlementIntent): Promise<ProofStepResult[]> {
  return Promise.all([
    issuerLegitimacy(intent, 0),
    assetClassification(intent, 1),
    custodyConditions(intent, 2),
    backingReserve(intent, 3),
  ]);
}
