/**
 * SARIF Normalizer — Converts SARIF v2.1.0 JSON output from
 * Checkov, Semgrep, and Bandit into BLACKFYRE AgentFindingPayload format.
 *
 * All input is untrusted. Every field is sanitized before use.
 */

import type { AgentFindingPayload } from "@blackfyre/shared";
import { sanitizeString, validateSeverity, sanitizeIdentifier } from "./sanitize.js";

/** SARIF level → BLACKFYRE severity */
const LEVEL_MAP: Record<string, "critical" | "high" | "medium" | "low" | "info"> = {
  error: "high",
  warning: "medium",
  note: "low",
  none: "info",
};

/** File extension → IaC resource type */
function detectResourceType(filePath: string): string {
  const lower = filePath.toLowerCase();
  if (lower.endsWith(".tf") || lower.endsWith(".tf.json")) return "IaC::Terraform";
  if (lower.endsWith(".yaml") || lower.endsWith(".yml")) {
    // Could be CloudFormation, K8s, or generic YAML
    return "IaC::CloudFormation";
  }
  if (lower.endsWith(".json")) return "IaC::CloudFormation";
  if (lower.includes("dockerfile") || lower.endsWith(".dockerfile")) return "IaC::Docker";
  if (lower.endsWith(".bicep")) return "IaC::Bicep";
  if (lower.endsWith(".pp")) return "IaC::Puppet";
  if (lower.endsWith(".rb") && lower.includes("chef")) return "IaC::Chef";
  return "IaC::Unknown";
}

interface SarifResult {
  ruleId?: unknown;
  message?: { text?: unknown };
  level?: unknown;
  locations?: unknown[];
}

interface SarifRule {
  id?: unknown;
  fullDescription?: { text?: unknown };
  shortDescription?: { text?: unknown };
  properties?: { tags?: unknown[] };
}

interface SarifRun {
  tool?: { driver?: { name?: unknown; rules?: unknown[] } };
  results?: unknown[];
}

/**
 * Normalizes SARIF v2.1.0 JSON output into AgentFindingPayload array.
 */
export function normalizeSarifFindings(
  sarifJson: unknown,
  toolName: string,
): AgentFindingPayload[] {
  // Validate tool name
  const validTools = ["checkov", "semgrep", "bandit"];
  const source = validTools.includes(toolName) ? toolName : "checkov";

  const sarif = parseSarif(sarifJson);
  if (!sarif) return [];

  const results: AgentFindingPayload[] = [];
  const runs = Array.isArray(sarif.runs) ? sarif.runs : [];

  for (const run of runs) {
    const typedRun = run as SarifRun;
    const runResults = Array.isArray(typedRun.results) ? typedRun.results : [];
    const rules = buildRuleMap(typedRun);

    for (const rawResult of runResults) {
      try {
        const result = rawResult as SarifResult;

        const ruleId = sanitizeIdentifier(result.ruleId, 200);
        const rule = rules.get(ruleId);

        // Build title from message or rule
        const messageText = sanitizeString(result.message?.text, 500);
        const title = messageText || `${source}: ${ruleId}`;
        if (!title) continue;

        // Build description from rule metadata
        const ruleDesc = rule
          ? sanitizeString(rule.fullDescription?.text ?? rule.shortDescription?.text, 5000)
          : "";
        const description = ruleDesc || messageText || title;

        // Map severity
        const level = typeof result.level === "string" ? result.level.toLowerCase() : "warning";
        const severity = LEVEL_MAP[level] ?? "medium";

        // Extract location
        const locations = Array.isArray(result.locations) ? result.locations : [];
        const firstLoc = locations[0] as Record<string, unknown> | undefined;
        const physicalLoc = firstLoc?.physicalLocation as Record<string, unknown> | undefined;
        const artifactLoc = physicalLoc?.artifactLocation as Record<string, unknown> | undefined;
        const filePath = sanitizeString(artifactLoc?.uri, 500);
        const resourceType = filePath ? detectResourceType(filePath) : "IaC::Unknown";

        // Extract line info for resourceId
        const region = physicalLoc?.region as Record<string, unknown> | undefined;
        const startLine = typeof region?.startLine === "number" ? region.startLine : undefined;
        const resourceId = startLine ? `${filePath}:${startLine}` : filePath || null;

        // Extract tags from rule for compliance mapping
        const tags = extractTags(rule);

        results.push({
          title,
          description,
          severity,
          category: "iac" as AgentFindingPayload["category"],
          resourceType,
          resourceId,
          resourceRegion: null,
          remediationTier: "manual",
          autoFixAvailable: false,
          controlMappings: [],
          source: source as AgentFindingPayload["source"],
          remediationNotes: null,
        } as AgentFindingPayload & { tags?: string[] });
      } catch {
        // Skip malformed results
        continue;
      }
    }
  }

  return results;
}

/** Parse SARIF JSON safely */
function parseSarif(input: unknown): { runs?: unknown[] } | null {
  if (input === null || input === undefined) return null;

  if (typeof input === "string") {
    try {
      return JSON.parse(input);
    } catch {
      return null;
    }
  }

  if (typeof input === "object") return input as { runs?: unknown[] };
  return null;
}

/** Build a Map of ruleId → rule metadata from the SARIF run */
function buildRuleMap(run: SarifRun): Map<string, SarifRule> {
  const map = new Map<string, SarifRule>();
  const rules = run.tool?.driver?.rules;
  if (!Array.isArray(rules)) return map;

  for (const rule of rules) {
    const r = rule as SarifRule;
    const id = sanitizeIdentifier(r.id, 200);
    if (id) map.set(id, r);
  }

  return map;
}

/** Extract tags from SARIF rule properties */
function extractTags(rule: SarifRule | undefined): string[] {
  if (!rule?.properties?.tags || !Array.isArray(rule.properties.tags)) return [];
  return rule.properties.tags
    .filter((t): t is string => typeof t === "string")
    .map((t) => sanitizeString(t, 100))
    .filter(Boolean);
}
