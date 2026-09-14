import type {
  CdmEligibilityEvaluationResponse,
  EligibilityQuery,
  EligibleCollateralSpecification,
} from "./types";

export class CdmEligibilityProviderError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "CdmEligibilityProviderError";
    this.code = code;
  }
}

export interface CollateralEligibilityProvider {
  evaluateEligibility(
    specification: EligibleCollateralSpecification,
    query: EligibilityQuery
  ): Promise<CdmEligibilityEvaluationResponse>;
}
