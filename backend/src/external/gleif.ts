import type { LEIRecord } from "../types";
import { logger } from "../logger";

const GLEIF_API_BASE = "https://api.gleif.org/api/v1";
const GLEIF_TIMEOUT_MS = 8000;
const ORACLE_ENABLED = process.env.SG_ORACLE_ENABLED === "true";

export interface GLEIFResponse {
  data: Array<{
    type: string;
    id: string;
    attributes: {
      lei: string;
      entity: {
        legalName: { name: string };
        status: "ACTIVE" | "INACTIVE" | "ANNULLED";
        jurisdiction: string;
      };
      registration: {
        status: string;
      };
    };
  }>;
}

export async function validateLEI(lei: string): Promise<LEIRecord | null> {
  if (!ORACLE_ENABLED) return null;
  if (!lei || lei.length !== 20) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GLEIF_TIMEOUT_MS);

  try {
    const resp = await fetch(`${GLEIF_API_BASE}/lei-records/${lei}`, {
      headers: { Accept: "application/vnd.api+json" },
      signal: controller.signal,
    });

    if (!resp.ok) {
      logger.warn({ lei, status: resp.status }, "GLEIF LEI lookup returned non-200");
      return null;
    }

    const body = (await resp.json()) as GLEIFResponse;
    const record = body.data?.[0];
    if (!record) return null;

    return {
      lei: record.attributes.lei,
      entity_status: record.attributes.entity.status,
      legal_name: record.attributes.entity.legalName.name,
      jurisdiction: record.attributes.entity.jurisdiction ?? "UNKNOWN",
    };
  } catch (err) {
    logger.warn({ lei, err: (err as Error).message }, "GLEIF lookup failed");
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function screenIssuerLEI(
  lei: string,
  issuerName: string
): Promise<{ valid: boolean; reason?: string; record?: LEIRecord }> {
  if (!ORACLE_ENABLED) {
    return { valid: true, reason: "oracle_disabled" };
  }

  const record = await validateLEI(lei);
  if (!record) {
    return { valid: false, reason: "LEI_NOT_FOUND" };
  }

  if (record.entity_status !== "ACTIVE") {
    return { valid: false, reason: `LEI_ENTITY_${record.entity_status}`, record };
  }

  const normalise = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const nameMismatch =
    normalise(record.legal_name).length > 0 &&
    normalise(issuerName).length > 0 &&
    !normalise(record.legal_name).includes(normalise(issuerName).slice(0, 6)) &&
    !normalise(issuerName).includes(normalise(record.legal_name).slice(0, 6));

  if (nameMismatch) {
    logger.warn({ lei, gleif_name: record.legal_name, submitted_name: issuerName }, "Issuer name mismatch");
  }

  return { valid: true, record };
}
