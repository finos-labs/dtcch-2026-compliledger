import type {
  CdmEligibilityEvaluationResponse,
} from "./types";
import { ExternalCdmEligibilityProvider } from "./httpAdapter";
import { MockCdmEligibilityProvider } from "./mockProvider";
import { CdmEligibilityProviderError, type CollateralEligibilityProvider } from "./provider";

function parseMockResultFromEnv():
  | { defaultResult: CdmEligibilityEvaluationResponse["result"] }
  | { configurationError: string }
  | {} {
  const raw = process.env.CDM_ELIGIBILITY_MOCK_RESPONSE;
  if (!raw) return {};

  try {
    return { defaultResult: JSON.parse(raw) as CdmEligibilityEvaluationResponse["result"] };
  } catch {
    return {
      configurationError:
        "CDM_ELIGIBILITY_MOCK_RESPONSE must be valid JSON for a canned CheckEligibilityResult fixture",
    };
  }
}

export function createCollateralEligibilityProvider(): CollateralEligibilityProvider | null {
  const providerType = (process.env.CDM_ELIGIBILITY_PROVIDER || "").trim().toLowerCase();
  if (providerType === "mock") {
    return new MockCdmEligibilityProvider(parseMockResultFromEnv());
  }
  if (providerType && providerType !== "external") {
    throw new CdmEligibilityProviderError(
      "invalid_provider_configuration",
      `Unsupported CDM_ELIGIBILITY_PROVIDER: ${process.env.CDM_ELIGIBILITY_PROVIDER}`
    );
  }

  const endpoint = process.env.CDM_ELIGIBILITY_ENDPOINT;
  if (providerType === "external" && !endpoint) {
    throw new CdmEligibilityProviderError(
      "invalid_provider_configuration",
      "CDM_ELIGIBILITY_ENDPOINT is required when CDM_ELIGIBILITY_PROVIDER=external"
    );
  }
  if (!endpoint) return null;
  return new ExternalCdmEligibilityProvider({
    url: endpoint,
    authToken: process.env.CDM_ELIGIBILITY_AUTH_TOKEN,
    authHeader: process.env.CDM_ELIGIBILITY_AUTH_HEADER,
    timeoutMs: Number(process.env.CDM_ELIGIBILITY_TIMEOUT_MS || 8_000),
    providerVersion: process.env.CDM_ELIGIBILITY_PROVIDER_VERSION,
    cdmModelVersion: process.env.CDM_MODEL_VERSION,
  });
}

export const createCdmEligibilityAdapter = createCollateralEligibilityProvider;
