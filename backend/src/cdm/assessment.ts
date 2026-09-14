import type {
  CdmEligibilityAssessmentStatus,
  LegacyCdmEligibilityAssessmentStatus,
} from "./types";

export function toLegacyCdmEligibilityAssessmentStatus(
  status: CdmEligibilityAssessmentStatus
): LegacyCdmEligibilityAssessmentStatus {
  switch (status) {
    case "SATISFIED":
      return "eligible";
    case "NOT_SATISFIED":
      return "ineligible";
    case "MANUAL_REVIEW":
      return "indeterminate_conflicting_evidence";
    case "NOT_EVALUABLE":
    default:
      return "technical_error";
  }
}
