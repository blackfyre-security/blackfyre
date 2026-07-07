/**
 * OCSF Normalizer — Converts Prowler OCSF v1.1.0 JSON output
 * into BLACKFYRE AgentFindingPayload format.
 *
 * All input is untrusted. Every field is sanitized before use.
 */

import type { AgentFindingPayload } from "@blackfyre/shared";
import { sanitizeString, validateSeverity, sanitizeIdentifier } from "./sanitize.js";
import { mapProwlerCheckToDpdpa } from "../../services/prowler-dpdpa-mapper.js";

/** OCSF severity_id mapping (Prowler uses 1-5) */
const SEVERITY_MAP: Record<number, "info" | "low" | "medium" | "high" | "critical"> = {
  1: "info",
  2: "low",
  3: "medium",
  4: "high",
  5: "critical",
};

interface OcsfFinding {
  title?: unknown;
  message?: unknown;
  severity_id?: unknown;
  status_code?: unknown;
  resources?: unknown;
  compliance?: unknown;
  remediation?: unknown;
  class_uid?: unknown;
  category_name?: unknown;
}

/**
 * Normalizes Prowler OCSF JSON output into AgentFindingPayload array.
 * Skips PASS findings and malformed records.
 */
export function normalizeOcsfFindings(ocsfJson: unknown): AgentFindingPayload[] {
  if (!Array.isArray(ocsfJson)) {
    // Try parsing if it's a string
    if (typeof ocsfJson === "string") {
      try {
        const parsed = JSON.parse(ocsfJson);
        if (Array.isArray(parsed)) return normalizeOcsfFindings(parsed);
      } catch {
        return [];
      }
    }
    return [];
  }

  const results: AgentFindingPayload[] = [];

  for (const raw of ocsfJson) {
    try {
      const finding = raw as OcsfFinding;

      // Skip PASS findings — only ingest failures
      const statusCode = typeof finding.status_code === "string"
        ? finding.status_code.toUpperCase()
        : "";
      if (statusCode === "PASS") continue;

      const title = sanitizeString(finding.title, 500);
      if (!title) continue; // Skip findings with no title

      const description = sanitizeString(finding.message, 5000) || title;
      const severityId = typeof finding.severity_id === "number" ? finding.severity_id : 3;
      const severity = SEVERITY_MAP[severityId] ?? "medium";

      // Extract resource info
      const resources = Array.isArray(finding.resources) ? finding.resources : [];
      const firstResource = resources[0] as Record<string, unknown> | undefined;
      const resourceType = firstResource
        ? sanitizeIdentifier(firstResource.type, 200)
        : null;
      const resourceId = firstResource
        ? sanitizeString(firstResource.uid, 500)
        : null;
      const resourceRegion = firstResource
        ? sanitizeString(firstResource.region, 100) || null
        : null;

      // Extract compliance mappings from Prowler's native framework support
      const controlMappings = extractComplianceMappings(finding);

      // Extract category from OCSF category_name
      const category = mapOcsfCategory(finding.category_name);

      // Add DPDPA mappings (Prowler doesn't natively support DPDPA)
      const dpdpaMappings = mapProwlerCheckToDpdpa(category);
      controlMappings.push(...dpdpaMappings);

      // Extract remediation notes
      const remediationNotes = extractRemediationNotes(finding.remediation);

      results.push({
        title,
        description,
        severity,
        category: category as AgentFindingPayload["category"],
        resourceType: resourceType || null,
        resourceId: resourceId || null,
        resourceRegion,
        remediationTier: "manual",
        autoFixAvailable: false,
        controlMappings,
        source: "prowler" as const,
        remediationNotes: remediationNotes ?? null,
      } as AgentFindingPayload);
    } catch {
      // Skip malformed records — don't crash the normalizer
      continue;
    }
  }

  return results;
}

/**
 * Extracts compliance control mappings from Prowler OCSF compliance field.
 * Prowler maps to SOC2, ISO27001, HIPAA, GDPR, PCI-DSS natively.
 */
function extractComplianceMappings(finding: OcsfFinding): AgentFindingPayload["controlMappings"] & unknown[] {
  const mappings: NonNullable<AgentFindingPayload["controlMappings"]> = [];

  if (!finding.compliance || typeof finding.compliance !== "object") return mappings;

  const compliance = finding.compliance as Record<string, unknown>;
  const requirements = Array.isArray(compliance.requirements)
    ? compliance.requirements
    : [];

  for (const req of requirements) {
    if (!req || typeof req !== "object") continue;
    const r = req as Record<string, unknown>;

    const framework = mapProwlerFramework(r.framework);
    if (!framework) continue;

    mappings.push({
      framework,
      controlId: sanitizeIdentifier(r.control_id ?? r.id, 50),
      controlName: sanitizeString(r.title ?? r.name, 300),
      status: "fail" as const,
      weight: 2,
    });
  }

  return mappings;
}

/** Maps Prowler framework names to BLACKFYRE framework enum values */
function mapProwlerFramework(input: unknown): "soc2" | "iso27001" | "hipaa" | "gdpr" | "pcidss" | null {
  if (typeof input !== "string") return null;
  const lower = input.toLowerCase();
  if (lower.includes("soc2") || lower.includes("soc 2")) return "soc2";
  if (lower.includes("iso") || lower.includes("27001")) return "iso27001";
  if (lower.includes("hipaa")) return "hipaa";
  if (lower.includes("gdpr")) return "gdpr";
  if (lower.includes("pci") || lower.includes("pcidss")) return "pcidss";
  return null;
}

/** Maps OCSF category_name to BLACKFYRE FindingCategory */
function mapOcsfCategory(input: unknown): string {
  if (typeof input !== "string") return "config";
  const lower = input.toLowerCase();
  if (lower.includes("iam") || lower.includes("identity") || lower.includes("access")) return "iam";
  if (lower.includes("encrypt") || lower.includes("crypto") || lower.includes("kms")) return "encryption";
  if (lower.includes("log") || lower.includes("trail") || lower.includes("monitor")) return "logging";
  if (lower.includes("network") || lower.includes("vpc") || lower.includes("firewall")) return "network";
  if (lower.includes("storage") || lower.includes("s3") || lower.includes("bucket")) return "storage";
  if (lower.includes("endpoint") || lower.includes("ec2") || lower.includes("compute")) return "endpoint";
  return "config";
}

/** Extracts remediation notes from Prowler OCSF remediation field */
function extractRemediationNotes(remediation: unknown): string | undefined {
  if (!remediation || typeof remediation !== "object") return undefined;
  const r = remediation as Record<string, unknown>;
  const desc = sanitizeString(r.desc ?? r.description ?? r.recommendation, 2000);
  return desc || undefined;
}
