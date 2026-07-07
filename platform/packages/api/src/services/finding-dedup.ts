/**
 * Finding Deduplication Service
 *
 * Deduplicates findings from multiple scan sources (custom auditors,
 * Prowler, Checkov, Semgrep, Bandit). When the same resource+check
 * is flagged by both custom auditors and Prowler, keeps the Prowler
 * finding (richer metadata).
 */

import type { AgentFindingPayload } from "@blackfyre/shared";

/** Source priority — higher number wins during dedup */
const SOURCE_PRIORITY: Record<string, number> = {
  custom: 1,
  bandit: 2,
  semgrep: 2,
  checkov: 3,
  prowler: 4,
};

/**
 * Deduplicates findings based on resourceId + category + severity.
 * When duplicates exist, the finding from the higher-priority source wins.
 */
export function deduplicateFindings(
  findings: AgentFindingPayload[],
): AgentFindingPayload[] {
  const seen = new Map<string, AgentFindingPayload>();

  for (const finding of findings) {
    const key = buildDedupKey(finding);
    const existing = seen.get(key);

    if (!existing) {
      seen.set(key, finding);
      continue;
    }

    // Compare source priority — higher wins
    const existingPriority = SOURCE_PRIORITY[(existing as Record<string, unknown>).source as string] ?? 0;
    const newPriority = SOURCE_PRIORITY[(finding as Record<string, unknown>).source as string] ?? 0;

    if (newPriority > existingPriority) {
      seen.set(key, finding);
    }
  }

  return Array.from(seen.values());
}

/**
 * Builds a dedup key from finding fields.
 * Key format: resourceId:category:severity
 */
function buildDedupKey(finding: AgentFindingPayload): string {
  const resourceId = (finding.resourceId ?? "unknown").toLowerCase().trim();
  const category = finding.category.toLowerCase().trim();
  const severity = finding.severity.toLowerCase().trim();
  return `${resourceId}:${category}:${severity}`;
}
