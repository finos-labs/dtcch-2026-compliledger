import type { SettlementIntent } from "./types";

export const PRESETS: Record<string, SettlementIntent> = {
  "treasury-fail": {
    asset_type: "tokenized_treasury",
    issuer_name: "US Treasury Digital Securities",
    issuer_status: "active",
    asset_id: "USTB-2026-001",
    classification: "tokenized_security",
    custody_provider: "DTC Qualified Custodian",
    custody_valid: false,
    reserve_ratio: 1.0,
  },
  "stablecoin-fail": {
    asset_type: "stablecoin",
    issuer_name: "Regulated Stablecoin Corp",
    issuer_status: "active",
    asset_id: "USDX-001",
    classification: "stablecoin",
    custody_provider: "Segregated Reserve Trust",
    custody_valid: true,
    reserve_ratio: 0.97,
  },
  "treasury-pass": {
    asset_type: "tokenized_treasury",
    issuer_name: "US Treasury Digital Securities",
    issuer_status: "active",
    asset_id: "USTB-2026-002",
    classification: "tokenized_security",
    custody_provider: "DTC Qualified Custodian",
    custody_valid: true,
    reserve_ratio: 1.0,
  },
  "stablecoin-pass": {
    asset_type: "stablecoin",
    issuer_name: "Regulated Stablecoin Corp",
    issuer_status: "active",
    asset_id: "USDX-002",
    classification: "stablecoin",
    custody_provider: "Segregated Reserve Trust",
    custody_valid: true,
    reserve_ratio: 1.02,
  },
};
