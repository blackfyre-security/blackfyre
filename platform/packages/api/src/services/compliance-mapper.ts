/**
 * Compliance Mapper Hub — Unified entry point that merges all cloud-specific
 * compliance mappings (AWS, Azure, GCP) into a single lookup.
 *
 * Any file that imports from this module still works unchanged.
 * The actual check-type definitions live in the per-cloud files.
 */

import { AWS_COMPLIANCE_MAP, KNOWN_AWS_CHECK_TYPES } from "./compliance-mapper-aws.js";
import { AZURE_COMPLIANCE_MAP, KNOWN_AZURE_CHECK_TYPES } from "./compliance-mapper-azure.js";
import { GCP_COMPLIANCE_MAP, KNOWN_GCP_CHECK_TYPES } from "./compliance-mapper-gcp.js";
import { AI_COMPLIANCE_MAP, KNOWN_AI_CHECK_TYPES } from "./compliance-mapper-ai.js";
import type { ControlMappingEntry } from "./compliance-mapper-aws.js";

export type { ControlMappingEntry };

const UNIFIED_MAP: Record<string, ControlMappingEntry[]> = {
  ...AWS_COMPLIANCE_MAP,
  ...AZURE_COMPLIANCE_MAP,
  ...GCP_COMPLIANCE_MAP,
  ...AI_COMPLIANCE_MAP,
};

/** All 74 known check type identifiers (18 AWS + 18 Azure + 18 GCP + 20 AI). NIST 800-53 mappings are embedded in each check entry. */
export const KNOWN_CHECK_TYPES: string[] = [
  ...KNOWN_AWS_CHECK_TYPES,
  ...KNOWN_AZURE_CHECK_TYPES,
  ...KNOWN_GCP_CHECK_TYPES,
  ...KNOWN_AI_CHECK_TYPES,
];

/**
 * Maps any cloud check type to its compliance control mappings across all frameworks.
 * Returns an empty array for unknown check types (graceful fallback).
 */
export function mapCheckToControls(checkType: string): ControlMappingEntry[] {
  return UNIFIED_MAP[checkType] ?? [];
}
