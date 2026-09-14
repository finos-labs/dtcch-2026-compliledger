import type {
  CdmEligibilityEvaluationResponse,
  CdmEligibilityResult,
  CdmVerificationMetadata,
  EligibilityQuery,
  EligibleCollateralSpecification,
} from "./types";
import { CDM_COLLATERAL_ELIGIBILITY_FUNCTION } from "./types";
import { CdmEligibilityProviderError, type CollateralEligibilityProvider } from "./provider";

const MOCK_PROVIDER_NAME = "Mock CDM Eligibility Provider (TEST/REFERENCE ONLY)";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertValidEligibilityResult(result: CdmEligibilityResult): void {
  if (typeof result.isEligible !== "boolean") {
    throw new Error("Mock CDM result.isEligible must be boolean");
  }
  if (!Array.isArray(result.matchingEligibleCriteria)) {
    throw new Error("Mock CDM result.matchingEligibleCriteria must be an array");
  }
  if (!isRecord(result.eligibilityQuery)) {
    throw new Error("Mock CDM result.eligibilityQuery must be an object");
  }
  if (!isRecord(result.specification)) {
    throw new Error("Mock CDM result.specification must be an object");
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
      throw new Error(`Mock CDM result.eligibilityQuery.${field} must be string`);
    }
  }
}

export interface MockCdmEligibilityProviderOptions {
  defaultResult?: CdmEligibilityResult;
  resultsBySpecificationId?: Record<string, CdmEligibilityResult>;
  configurationError?: string;
  cdmModelVersion?: string;
  providerVersion?: string;
}

export class MockCdmEligibilityProvider implements CollateralEligibilityProvider {
  private readonly defaultResult?: CdmEligibilityResult;
  private readonly resultsBySpecificationId: Record<string, CdmEligibilityResult>;
  private readonly configurationError?: string;
  private readonly cdmModelVersion: string;
  private readonly providerVersion: string;

  constructor(options: MockCdmEligibilityProviderOptions = {}) {
    this.defaultResult = options.defaultResult;
    this.resultsBySpecificationId = options.resultsBySpecificationId ?? {};
    this.configurationError = options.configurationError;
    this.cdmModelVersion = options.cdmModelVersion ?? "mock-fixture";
    this.providerVersion = options.providerVersion ?? "mock-v1";
  }

  async evaluateEligibility(
    specification: EligibleCollateralSpecification,
    query: EligibilityQuery
  ): Promise<CdmEligibilityEvaluationResponse> {
    if (this.configurationError) {
      throw new CdmEligibilityProviderError("invalid_mock_configuration", this.configurationError);
    }

    const configuredResult = specification.id
      ? this.resultsBySpecificationId[specification.id]
      : undefined;
    const result = configuredResult ?? this.defaultResult;
    if (!result) {
      throw new CdmEligibilityProviderError(
        "mock_fixture_not_found",
        "Mock CDM provider requires an explicitly configured canned result"
      );
    }

    try {
      assertValidEligibilityResult(result);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Invalid mock CDM result";
      throw new CdmEligibilityProviderError("invalid_mock_configuration", message);
    }

    const verification: CdmVerificationMetadata = {
      verified: true,
      reason: "test_reference_provider",
    };
    const resolvedResult = structuredClone({
      ...result,
      eligibilityQuery: query,
      specification,
    });

    return {
      result: resolvedResult,
      metadata: {
        provider_name: MOCK_PROVIDER_NAME,
        cdm_function: CDM_COLLATERAL_ELIGIBILITY_FUNCTION,
        cdm_model_version: this.cdmModelVersion,
        provider_version: this.providerVersion,
      },
      verification,
    };
  }
}
