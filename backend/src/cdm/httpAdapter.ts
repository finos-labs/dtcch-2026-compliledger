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
import { CDM_COLLATERAL_ELIGIBILITY_FUNCTION } from "./types";
import { CdmEligibilityProviderError, type CollateralEligibilityProvider } from "./provider";

const DEFAULT_TIMEOUT_MS = 8_000;
const SUPPORTED_RESPONSE_ALGORITHM = "hmac-sha256";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

interface ExternalCdmEligibilityProviderOptions {
  url: string;
  authToken?: string;
  authHeader?: string;
  timeoutMs?: number;
  providerName?: string;
  providerVersion?: string;
  cdmModelVersion?: string;
}

export class ExternalCdmEligibilityProvider implements CollateralEligibilityProvider {
  private readonly url: string;
  private readonly authToken?: string;
  private readonly authHeader?: string;
  private readonly timeoutMs: number;
  private readonly providerName: string;
  private readonly providerVersion: string;
  private readonly cdmModelVersion: string;

  constructor(options: ExternalCdmEligibilityProviderOptions) {
    this.url = options.url;
    this.authToken = options.authToken;
    this.authHeader = options.authHeader;
    this.timeoutMs = Number.isFinite(options.timeoutMs) ? Number(options.timeoutMs) : DEFAULT_TIMEOUT_MS;
    this.providerName = options.providerName || "External CDM Eligibility Provider";
    this.providerVersion = options.providerVersion || "unknown";
    this.cdmModelVersion = options.cdmModelVersion || "unknown";
  }

  async evaluateEligibility(
    specification: EligibleCollateralSpecification,
    query: EligibilityQuery
  ): Promise<CdmEligibilityEvaluationResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);
    const body = {
      cdm_function: CDM_COLLATERAL_ELIGIBILITY_FUNCTION,
      specification,
      eligibilityQuery: query,
    };

    let response: Response;

    try {
      try {
        response = await fetch(this.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(this.authHeader ? { Authorization: this.authHeader } : {}),
            ...(!this.authHeader && this.authToken
              ? { Authorization: ["Bearer", this.authToken].join(" ") }
              : {}),
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") {
          throw new CdmEligibilityProviderError(
            "provider_timeout",
            `CDM provider request timed out after ${this.timeoutMs}ms`
          );
        }
        const message = err instanceof Error ? err.message : "Unknown provider connectivity error";
        throw new CdmEligibilityProviderError("provider_unavailable", message);
      }

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        const code = response.status === 401 || response.status === 403
          ? "provider_auth_error"
          : "provider_http_error";
        throw new CdmEligibilityProviderError(
          code,
          `CDM eligibility endpoint error (${response.status}): ${text || response.statusText}`
        );
      }

      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        throw new CdmEligibilityProviderError(
          "invalid_provider_response",
          "CDM eligibility endpoint returned invalid JSON"
        );
      }

      const result = this.extractEligibilityResult(payload);
      this.assertValidEligibilityResult(result);

      const verification = this.verifyResponse(response.headers, payload);
      const metadata: CdmFunctionMetadata = {
        provider_name: this.providerName,
        cdm_function: CDM_COLLATERAL_ELIGIBILITY_FUNCTION,
        cdm_model_version: this.cdmModelVersion,
        provider_version: this.providerVersion,
      };

      if (isRecord(payload) && isRecord(payload.metadata)) {
        if (typeof payload.metadata.provider_name === "string") {
          metadata.provider_name = payload.metadata.provider_name;
        }
        if (typeof payload.metadata.cdm_model_version === "string") {
          metadata.cdm_model_version = payload.metadata.cdm_model_version;
        }
        if (typeof payload.metadata.provider_version === "string") {
          metadata.provider_version = payload.metadata.provider_version;
        }
      }

      return {
        result,
        metadata,
        verification,
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private extractEligibilityResult(payload: unknown): CheckEligibilityResult {
    if (isRecord(payload) && isRecord(payload.result)) {
      return payload.result as unknown as CheckEligibilityResult;
    }
    if (isRecord(payload)) {
      return payload as unknown as CheckEligibilityResult;
    }
    throw new CdmEligibilityProviderError(
      "invalid_provider_response",
      "CDM eligibility endpoint returned invalid payload shape"
    );
  }

  private verifyResponse(
    headers: Headers,
    payload: unknown
  ): CdmVerificationMetadata {
    const signature = headers.get("x-cdm-response-signature") || "";
    const keyId = headers.get("x-cdm-response-key-id") || undefined;
    const algorithm = headers.get("x-cdm-response-algorithm") || SUPPORTED_RESPONSE_ALGORITHM;
    const contentHash = sha256(canonicalStringify(payload));

    if (!process.env.CDM_RESPONSE_HMAC_SECRET) {
      return {
        verified: false,
        reason: "verification_not_configured",
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

    if (algorithm !== SUPPORTED_RESPONSE_ALGORITHM) {
      return {
        verified: false,
        reason: "unsupported_algorithm",
        key_id: keyId,
        algorithm,
        content_hash: contentHash,
        signature,
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

    const expected = createHmac("sha256", process.env.CDM_RESPONSE_HMAC_SECRET)
      .update(contentHash, "utf8")
      .digest("hex");
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
      throw new CdmEligibilityProviderError(
        "invalid_provider_response",
        "CDM eligibility endpoint result.isEligible must be boolean"
      );
    }
    if (!Array.isArray(result.matchingEligibleCriteria)) {
      throw new CdmEligibilityProviderError(
        "invalid_provider_response",
        "CDM eligibility endpoint result.matchingEligibleCriteria must be an array"
      );
    }
    if (!isRecord(result.eligibilityQuery)) {
      throw new CdmEligibilityProviderError(
        "invalid_provider_response",
        "CDM eligibility endpoint result.eligibilityQuery must be an object"
      );
    }
    if (!isRecord(result.specification)) {
      throw new CdmEligibilityProviderError(
        "invalid_provider_response",
        "CDM eligibility endpoint result.specification must be an object"
      );
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
        throw new CdmEligibilityProviderError(
          "invalid_provider_response",
          `CDM eligibility endpoint result.eligibilityQuery.${field} must be string`
        );
      }
    }
  }
}

export class HttpCdmEligibilityAdapter extends ExternalCdmEligibilityProvider {
  constructor(endpoint: string) {
    super({ url: endpoint });
  }
}
