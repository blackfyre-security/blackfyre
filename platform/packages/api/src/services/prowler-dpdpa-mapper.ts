/**
 * Prowler DPDPA Mapper — Maps Prowler check categories to DPDPA controls.
 *
 * Prowler natively maps to SOC2, ISO27001, HIPAA, GDPR, PCI-DSS but NOT DPDPA.
 * This mapper fills that gap for India's Digital Personal Data Protection Act 2023.
 */

import { m, type ControlMappingEntry } from "./compliance-mapper-aws.js";

/** DPDPA category mappings — keyed by BLACKFYRE finding category */
const DPDPA_CATEGORY_MAP: Record<string, ControlMappingEntry[]> = {
  iam: [
    m("dpdpa", "DPDPA-S8-1", "Security Safeguards for Personal Data", 3),
    m("dpdpa", "DPDPA-S8-2", "Access Control to Personal Data Systems", 3),
  ],
  encryption: [
    m("dpdpa", "DPDPA-S8-3", "Encryption of Personal Data", 3),
    m("dpdpa", "DPDPA-S8-1", "Security Safeguards for Personal Data", 3),
  ],
  logging: [
    m("dpdpa", "DPDPA-S8-4", "Audit Trails for Personal Data Processing", 2),
    m("dpdpa", "DPDPA-S8-1", "Security Safeguards for Personal Data", 2),
  ],
  network: [
    m("dpdpa", "DPDPA-S9-1", "Network Security Safeguards", 3),
    m("dpdpa", "DPDPA-S8-1", "Security Safeguards for Personal Data", 2),
  ],
  storage: [
    m("dpdpa", "DPDPA-S10-1", "Data Retention and Erasure", 2),
    m("dpdpa", "DPDPA-S8-1", "Security Safeguards for Personal Data", 2),
  ],
  endpoint: [
    m("dpdpa", "DPDPA-S8-1", "Security Safeguards for Personal Data", 2),
    m("dpdpa", "DPDPA-S9-1", "Network Security Safeguards", 2),
  ],
  config: [
    m("dpdpa", "DPDPA-S8-1", "Security Safeguards for Personal Data", 1),
  ],
  identity: [
    m("dpdpa", "DPDPA-S8-2", "Access Control to Personal Data Systems", 3),
  ],
};

/**
 * Maps a Prowler finding category to DPDPA compliance controls.
 * Returns empty array for unknown categories.
 */
export function mapProwlerCheckToDpdpa(checkCategory: string): ControlMappingEntry[] {
  const category = checkCategory.toLowerCase().trim();
  return DPDPA_CATEGORY_MAP[category] ?? [];
}
