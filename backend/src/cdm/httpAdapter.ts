import { createHmac, timingSafeEqual } from "crypto";
import { canonicalStringify, sha256 } from "../crypto";
import type {
  CdmEligibilityEvaluationResponse,
  CdmFunctionMetadata,
  CdmVerificationMetadata,
  CheckEligibilityResult,
  EligibilityQuery,
  EligibleCollateralSpecification,
} from "./types";

const DEFAULT_TIMEOUT_MS = 8_000;
const SUPPORTED_RESPONSE_ALGORITHM = "hmac-sha256";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export class HttpCdmEligibilityAdapter {
  private readonly endpoint: string;

  constructor(endpoint: string) {
    this.endpoint = endpoint;
  }

  async evaluate(input: {
    specification: EligibleCollateralSpecification;
    query: EligibilityQuery;
  }): Promise<CdmEligibilityEvaluationResponse> {
    const timeoutMs = Number(process.env.CDM_ELIGIBILITY_TIMEOUT_MS || DEFAULT_TIMEOUT_MS);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), Number.isFinite(timeoutMs) ? timeoutMs : DEFAULT_TIMEOUT_MS);

    const body = {
      function: "CheckEligibilityByDetails",
      specification: input.specification,
      query: input.query,
    };

    try {
      const response = await fetch(this.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(process.env.CDM_ELIGIBILITY_AUTH_TOKEN
            ? { Authorization: ["Bearer", process.env.CDM_ELIGIBILITY_AUTH_TOKEN].join(" ") }
            : {}),
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(`CDM eligibility endpoint error (${response.status}): ${text || response.statusText}`);
      }

      const payload = await response.json() as {
        result: CheckEligibilityResult;
        metadata?: Partial<CdmFunctionMetadata>;
      };

      if (!payload || typeof payload !== "object" || !payload.result || typeof payload.result !== "object") {
        throw new Error("CDM eligibility endpoint returned invalid payload shape");
      }
      this.assertValidEligibilityResult(payload.result);

      const verification = this.verifyResponse(response.headers, payload);
      const metadata: CdmFunctionMetadata = {
        function_name: payload.metadata?.function_name || "CheckEligibilityByDetails",
        model_name: payload.metadata?.model_name || "FINOS-CDM",
        model_version: payload.metadata?.model_version || "unknown",
        runtime: payload.metadata?.runtime || "external-http",
      };

      return {
        result: payload.result,
        metadata,
        verification,
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private verifyResponse(
    headers: Headers,
    payload: { result: CheckEligibilityResult; metadata?: Partial<CdmFunctionMetadata> }
  ): CdmVerificationMetadata {
    const signature = headers.get("x-cdm-response-signature") || "";
    const keyId = headers.get("x-cdm-response-key-id") || undefined;
    const algorithm = headers.get("x-cdm-response-algorithm") || SUPPORTED_RESPONSE_ALGORITHM;
    const contentHash = sha256(canonicalStringify(payload));

    if (algorithm !== SUPPORTED_RESPONSE_ALGORITHM) {
      return {
        verified: false,
        reason: "unsupported_algorithm",
        key_id: keyId,
        algorithm,
        content_hash: contentHash,
      };
    }

    const sharedSecret = process.env.CDM_RESPONSE_HMAC_SECRET;
    if (!sharedSecret) {
      return {
        verified: false,
        reason: "missing_verification_secret",
        key_id: keyId,
        algorithm,
        content_hash: contentHash,
      };
    }

    if (!signature) {
      return {
        verified: false,
        reason: "missing_signature",
        key_id: keyId,
        algorithm,
        content_hash: contentHash,
      };
    }

    if (!/^[a-f0-9]+$/i.test(signature) || signature.length % 2 !== 0) {
      return {
        verified: false,
        reason: "invalid_signature_encoding",
        key_id: keyId,
        algorithm,
        content_hash: contentHash,
        signature,
      };
    }

    const expected = createHmac("sha256", sharedSecret).update(contentHash, "utf8").digest("hex");
    const expectedBuffer = Buffer.from(expected, "hex");
    const signatureBuffer = Buffer.from(signature, "hex");
    const signatureMatches = expectedBuffer.length === signatureBuffer.length
      && timingSafeEqual(expectedBuffer, signatureBuffer);
    if (!signatureMatches) {
      return {
        verified: false,
        reason: "invalid_signature",
        key_id: keyId,
        algorithm,
        content_hash: contentHash,
        signature,
      };
    }

    return {
      verified: true,
      key_id: keyId,
      algorithm,
      content_hash: contentHash,
      signature,
    };
  }

  private assertValidEligibilityResult(result: CheckEligibilityResult): void {
    if (typeof result.isEligible !== "boolean") {
      throw new Error("CDM eligibility endpoint result.isEligible must be boolean");
    }
    if (!Array.isArray(result.matchingEligibleCriteria)) {
      throw new Error("CDM eligibility endpoint result.matchingEligibleCriteria must be an array");
    }
    if (!isRecord(result.eligibilityQuery)) {
      throw new Error("CDM eligibility endpoint result.eligibilityQuery must be an object");
    }
    if (!isRecord(result.specification)) {
      throw new Error("CDM eligibility endpoint result.specification must be an object");
    }
    for (const field of [
      "maturity",
      "collateralAssetType",
      "assetCountryOfOrigin",
      "denominatedCurrency",
      "agencyRating",
      "issuerType",
      "issuerName",
    ]) {
      if (typeof (result.eligibilityQuery as Record<string, unknown>)[field] !== "string") {
        throw new Error(`CDM eligibility endpoint result.eligibilityQuery.${field} must be string`);
      }
    }
  }
}
