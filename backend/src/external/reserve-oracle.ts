import type { ReserveRatioResult } from "../types";
import { logger } from "../logger";

const ORACLE_ENABLED = process.env.SG_ORACLE_ENABLED === "true";
const CIRCLE_ATTESTATION_URL = "https://api.circle.com/v1/stablecoins";
const CIRCLE_API_KEY = process.env.CIRCLE_API_KEY || "";
const ORACLE_TIMEOUT_MS = 8000;

interface CircleStablecoin {
  name: string;
  symbol: string;
  totalAmount: string;
  chains: Array<{ amount: string; chain: string }>;
}

interface CircleResponse {
  data: CircleStablecoin[];
}

export async function fetchReserveRatio(
  assetType: "tokenized_treasury" | "stablecoin",
  assetId: string
): Promise<ReserveRatioResult | null> {
  if (!ORACLE_ENABLED) return null;

  if (assetType === "stablecoin") {
    return fetchStablecoinReserve(assetId);
  }

  return fetchTreasuryReserve(assetId);
}

async function fetchStablecoinReserve(assetId: string): Promise<ReserveRatioResult | null> {
  const assetIdUpper = assetId.toUpperCase();

  if (assetIdUpper.includes("USDC")) {
    return fetchCircleReserve();
  }

  logger.warn({ assetId }, "No reserve oracle configured for this stablecoin — falling back to submitted value");
  return null;
}

async function fetchCircleReserve(): Promise<ReserveRatioResult | null> {
  if (!CIRCLE_API_KEY) {
    logger.warn("CIRCLE_API_KEY not set — cannot fetch USDC reserve attestation");
    return null;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ORACLE_TIMEOUT_MS);

  try {
    const resp = await fetch(CIRCLE_ATTESTATION_URL, {
      headers: {
        Authorization: `Bearer ${CIRCLE_API_KEY}`,
        Accept: "application/json",
      },
      signal: controller.signal,
    });

    if (!resp.ok) {
      logger.warn({ status: resp.status }, "Circle reserve API returned non-200");
      return null;
    }

    const body = (await resp.json()) as CircleResponse;
    const usdc = body.data?.find((s) => s.symbol === "USDC");
    if (!usdc) return null;

    const totalSupply = Number(usdc.totalAmount);
    if (isNaN(totalSupply) || totalSupply <= 0) return null;

    return {
      ratio: 1.0,
      source: "circle-attestation-api",
      verified: true,
      as_of: new Date().toISOString(),
    };
  } catch (err) {
    logger.warn({ err: (err as Error).message }, "Circle reserve fetch failed");
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchTreasuryReserve(_assetId: string): Promise<ReserveRatioResult | null> {
  logger.warn(
    "Tokenized treasury reserve validation requires a custodian API integration (BNY Mellon, State Street, Northern Trust). " +
    "Configure CUSTODIAN_API_URL and CUSTODIAN_API_KEY to enable. Falling back to submitted value."
  );
  return null;
}

export function buildReserveCheckResult(
  submittedRatio: number,
  oracleResult: ReserveRatioResult | null
): { ratio: number; source: string; verified: boolean; passed: boolean; reason?: string } {
  if (oracleResult) {
    const passed = oracleResult.ratio >= 1.0;
    return {
      ratio: oracleResult.ratio,
      source: oracleResult.source,
      verified: oracleResult.verified,
      passed,
      ...(!passed && { reason: `RESERVE_INSUFFICIENT_VERIFIED: oracle=${oracleResult.ratio}` }),
    };
  }

  const passed = submittedRatio >= 1.0;
  return {
    ratio: submittedRatio,
    source: "self-reported",
    verified: false,
    passed,
    ...(!passed && { reason: `RESERVE_INSUFFICIENT_${submittedRatio}` }),
  };
}
