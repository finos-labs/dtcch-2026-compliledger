# FINOS CDM collateral eligibility contribution

The authoritative collateral-eligibility requirement for this FINOS CDM contribution is pending source validation. No production eligibility determination should be made from the placeholder implementation.

This namespace is separate from the existing ISDA, ISLA, and ICMA reference rules and from the existing `backend/src/cdm/` provider integration. Neither is an authority, fallback, or substitute for this contribution. No authoritative source, admission record, or production rule implementation is included.

## Rule definition and lifecycle

The definition contract represents the contribution identity separately from the actual `ruleId` and `ruleVersion`. It also carries `sourceAuthority`, `sourceDocument` (including document version), `sourceProvision`, `effectiveDate`, `jurisdiction`, `scope`, `applicabilityConditions`, `requiredInputs`, `requiredEvidence`, `reasonCodes`, and source `provenance`. The TypeScript camelCase properties correspond to the requested `rule_id`, `source_authority`, and similar metadata names.

Metadata uses explicit states:

- `UNRESOLVED` means the field still needs source review; it is not an empty or approved value.
- `REVIEWED` means the field was deliberately reviewed. For declarations, a reviewed empty list is distinct from an unresolved declaration.
- `NOT_APPLICABLE` means a reviewer explicitly determined an optional effective date, jurisdiction, or scope does not apply.

Definitions move through `DRAFT` or `TEMPLATE` to `REVIEW_COMPLETE`. Drafts and templates are never executable, even if a caller attaches functions. Registration requires complete reviewed metadata, deterministic applicability/evaluation callbacks, and an application-controlled `APPLICATION_CONTROLLED_SOURCE_REVIEW` admission record whose metadata snapshot matches the exact rule ID and version. Registration is in-memory only, selects versions by exact ID and version, rejects duplicate versions, and is not exposed by an HTTP or JSON endpoint.

Admission validation checks the shape and exact metadata binding of a recorded review. It does **not** establish legal authority, authenticate a reviewer, or prove that human review occurred. The application must obtain the record from its controlled source-review and approval process; that governance prerequisite remains external to this code. Registry handles are guarded by runtime membership, not only TypeScript types. Metadata is snapshotted and frozen; callback references are captured at registration. This is an application boundary, not a sandbox for intentionally malicious trusted code.

The optional registered handle plugs into the existing adapter → facts → evidence → rule → evaluation → assessment path. Without a valid registered handle, both evaluation entry points retain `RULE_NOT_CONFIGURED` and `AUTHORITATIVE_RULE_NOT_CONFIGURED`. Unknown or outside applicability and invalid callback output fail closed to manual review; rule reason codes must have been declared in reviewed metadata. Successful rule execution does not change the pending validation state of CDM facts or evidence.

## Unresolved source requirements

- Identify and review the authoritative source authority, source document and document version, and exact source provision.
- Determine whether an effective date, jurisdiction, and scope apply.
- Review applicability conditions, required inputs, required evidence, and the permitted reason-code declarations.
- Implement and independently review a deterministic, versioned rule from that evidence.
- Supply exact-version application-controlled admission evidence through the application governance process.

These source-dependent items are distinct from the existing adapter's unresolved CDM field mappings and the evidence layer's unvalidated authenticity/sufficiency. No CDM mapping or evidence is validated by registering a rule.
