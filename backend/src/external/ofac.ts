import type { SanctionsScreenResult, SanctionsMatch } from "../types";
import { logger } from "../logger";

const ORACLE_ENABLED = process.env.SG_ORACLE_ENABLED === "true";
const OPENSANCTIONS_API = "https://api.opensanctions.org/match/default";
const OPENSANCTIONS_API_KEY = process.env.OPENSANCTIONS_API_KEY || "";
const SCREEN_TIMEOUT_MS = 10000;
const MATCH_SCORE_THRESHOLD = 0.85;

interface OpenSanctionsResult {
  results: Array<{
    id: string;
    caption: string;
    score: number;
    datasets: string[];
  }>;
  status: number;
}

interface OpenSanctionsResponse {
  responses: Record<string, OpenSanctionsResult>;
}

export async function screenPartyName(
  name: string,
  context: string = "issuer"
): Promise<SanctionsScreenResult> {
  const screenedAt = new Date().toISOString();

  if (!ORACLE_ENABLED) {
    return { screened: false, matched: false, matches: [], screened_at: screenedAt };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SCREEN_TIMEOUT_MS);

  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (OPENSANCTIONS_API_KEY) headers["Authorization"] = `ApiKey ${OPENSANCTIONS_API_KEY}`;

    const payload = {
      queries: {
        [context]: {
          schema: "LegalEntity",
          properties: { name: [name] },
        },
      },
    };

    const resp = await fetch(OPENSANCTIONS_API, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!resp.ok) {
      logger.warn({ name, status: resp.status }, "OpenSanctions screening returned non-200");
      return { screened: false, matched: false, matches: [], screened_at: screenedAt };
    }

    const body = (await resp.json()) as OpenSanctionsResponse;
    const results = body.responses?.[context]?.results ?? [];

    const highScoreMatches = results.filter((r) => r.score >= MATCH_SCORE_THRESHOLD);

    const matches: SanctionsMatch[] = highScoreMatches.map((r) => ({
      list: r.datasets.join(", "),
      name: r.caption,
      score: r.score,
    }));

    if (matches.length > 0) {
      logger.error({ name, matches }, "SANCTIONS MATCH DETECTED");
    }

    return {
      screened: true,
      matched: matches.length > 0,
      matches,
      screened_at: screenedAt,
    };
  } catch (err) {
    logger.warn({ name, err: (err as Error).message }, "Sanctions screening failed");
    return { screened: false, matched: false, matches: [], screened_at: screenedAt };
  } finally {
    clearTimeout(timer);
  }
}

export async function screenMultipleParties(parties: Array<{ name: string; role: string }>): Promise<{
  cleared: boolean;
  results: Array<{ role: string; name: string; result: SanctionsScreenResult }>;
}> {
  const results = await Promise.all(
    parties.map(async (p) => ({
      role: p.role,
      name: p.name,
      result: await screenPartyName(p.name, p.role),
    }))
  );

  const cleared = results.every((r) => !r.result.matched);
  return { cleared, results };
}
