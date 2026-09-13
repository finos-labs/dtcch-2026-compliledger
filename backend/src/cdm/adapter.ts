import type {
  CdmEligibilityEvaluationResponse,
  EligibilityQuery,
  EligibleCollateralSpecification,
} from "./types";
import { HttpCdmEligibilityAdapter } from "./httpAdapter";

export interface CdmEligibilityAdapter {
  evaluate(input: {
    specification: EligibleCollateralSpecification;
    query: EligibilityQuery;
  }): Promise<CdmEligibilityEvaluationResponse>;
}

export function createCdmEligibilityAdapter(): CdmEligibilityAdapter | null {
  const endpoint = process.env.CDM_ELIGIBILITY_ENDPOINT;
  if (!endpoint) return null;
  return new HttpCdmEligibilityAdapter(endpoint);
}
