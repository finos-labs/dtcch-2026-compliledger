import type { FIGIRecord } from "../types";
import { logger } from "../logger";

const FIGI_API = "https://api.openfigi.com/v3/mapping";
const FIGI_TIMEOUT_MS = 8000;
const ORACLE_ENABLED = process.env.SG_ORACLE_ENABLED === "true";
const FIGI_API_KEY = process.env.OPENFIGI_API_KEY || "";

interface FIGIMappingResult {
  figi: string;
  name: string;
  ticker?: string;
  exchCode?: string;
  securityType?: string;
  marketSector?: string;
  securityDescription?: string;
}

interface FIGIResponseItem {
  data?: FIGIMappingResult[];
  error?: string;
}

export async function lookupAssetByISIN(isin: string): Promise<FIGIRecord | null> {
  if (!ORACLE_ENABLED || !isin) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FIGI_TIMEOUT_MS);

  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (FIGI_API_KEY) headers["X-OPENFIGI-APIKEY"] = FIGI_API_KEY;

    const resp = await fetch(FIGI_API, {
      method: "POST",
      headers,
      body: JSON.stringify([{ idType: "ID_ISIN", idValue: isin }]),
      signal: controller.signal,
    });

    if (!resp.ok) {
      logger.warn({ isin, status: resp.status }, "OpenFIGI lookup returned non-200");
      return null;
    }

    const body = (await resp.json()) as FIGIResponseItem[];
    const item = body[0];
    if (!item || item.error || !item.data?.[0]) {
      logger.warn({ isin, error: item?.error }, "OpenFIGI: no mapping found");
      return null;
    }

    const d = item.data[0];
    return {
      figi: d.figi,
      isin,
      security_type: d.securityType ?? "UNKNOWN",
      market_sector: d.marketSector ?? "UNKNOWN",
      name: d.name,
    };
  } catch (err) {
    logger.warn({ isin, err: (err as Error).message }, "OpenFIGI lookup failed");
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export function validateAssetClassification(
  figiRecord: FIGIRecord | null,
  claimedAssetType: string
): { valid: boolean; reason?: string } {
  if (!figiRecord) return { valid: true, reason: "oracle_unavailable" };

  const sector = figiRecord.market_sector.toLowerCase();
  const secType = figiRecord.security_type.toLowerCase();

  if (claimedAssetType === "tokenized_treasury") {
    const isTreasury =
      sector.includes("govt") ||
      sector.includes("government") ||
      secType.includes("bill") ||
      secType.includes("note") ||
      secType.includes("bond");
    if (!isTreasury) {
      return { valid: false, reason: `ASSET_CLASS_MISMATCH: FIGI reports ${figiRecord.market_sector}/${figiRecord.security_type}` };
    }
  }

  if (claimedAssetType === "stablecoin") {
    const isMoneyMarket = sector.includes("money") || secType.includes("stable") || secType.includes("money");
    if (!isMoneyMarket) {
      return { valid: false, reason: `ASSET_CLASS_MISMATCH: FIGI reports ${figiRecord.market_sector}/${figiRecord.security_type}` };
    }
  }

  return { valid: true };
}
