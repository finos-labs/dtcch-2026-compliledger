import { canonicalStringify, sha256 } from "../crypto";
import type {
  CdmEligibilityRequest,
  EligibilityQuery,
  EligibilityQueryField,
  EvidenceReference,
  PreparedEligibilityEvidence,
} from "./types";

const ELIGIBILITY_QUERY_FIELDS: EligibilityQueryField[] = [
  "maturity",
  "collateralAssetType",
  "assetCountryOfOrigin",
  "denominatedCurrency",
  "agencyRating",
  "issuerType",
  "issuerName",
];
const ELIGIBILITY_QUERY_FIELD_SET = new Set<EligibilityQueryField>(ELIGIBILITY_QUERY_FIELDS);

function normalizeEvidenceArray(value: unknown): EvidenceReference[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is EvidenceReference => {
    if (!entry || typeof entry !== "object") return false;
    const typed = entry as Partial<EvidenceReference>;
    return typeof typed.evidence_id === "string"
      && typeof typed.source === "string"
      && typeof typed.attribute === "string"
      && typeof typed.claim_value === "string"
      && typeof typed.observed_at === "string"
      && ELIGIBILITY_QUERY_FIELD_SET.has(typed.attribute as EligibilityQueryField);
  });
}

export function prepareEligibilityEvidence(request: CdmEligibilityRequest): PreparedEligibilityEvidence {
  const missingFields: EligibilityQueryField[] = [];
  const conflictingFields: EligibilityQueryField[] = [];

  const evidenceLineage = {} as Record<EligibilityQueryField, EvidenceReference[]>;
  const query = {} as EligibilityQuery;

  for (const field of ELIGIBILITY_QUERY_FIELDS) {
    const sourceEvidence = request.query_evidence && typeof request.query_evidence === "object"
      ? request.query_evidence
      : {};
    const references = normalizeEvidenceArray(sourceEvidence[field]).filter((entry) => entry.attribute === field);
    evidenceLineage[field] = references;

    if (references.length === 0) {
      missingFields.push(field);
      query[field] = "";
      continue;
    }

    const values = Array.from(new Set(references.map((r) => r.claim_value)));
    if (values.length > 1) {
      conflictingFields.push(field);
    }

    query[field] = values[0] ?? "";
  }

  return {
    query,
    query_hash: sha256(canonicalStringify(query)),
    evidence_lineage: evidenceLineage,
    evidence_lineage_hash: sha256(canonicalStringify(evidenceLineage)),
    missing_fields: missingFields,
    conflicting_fields: conflictingFields,
  };
}
