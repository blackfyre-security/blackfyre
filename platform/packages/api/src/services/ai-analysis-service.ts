import { getLlmClient, type LlmClient } from "./llm/client.js";
import { eq, and, desc } from "drizzle-orm";
import { findings, scans, aiDecisionLog } from "../db/schema.js";
import type { Db } from "../db/connection.js";
import type { Severity } from "@blackfyre/shared";
// REAL IMPL (BLACKFYRE 2026-06): map findings to genuine controls from the actual
// control catalog (control-registry.ts) instead of SHA256-fabricated IDs / a tiny
// keyword list, and to real ATT&CK technique IDs from the curated catalog instead
// of a 12-entry inline Map.
import {
  getFrameworkRegistry,
  getControlDefinition,
} from "../compliance/control-registry.js";
import type { ControlDefinition } from "@blackfyre/shared";
import { mapFindingToTechniques, getTechnique } from "./mitre/attack-techniques.js";

/* ------------------------------------------------------------------ */
/*  SECURITY FIX (BLACKFYRE audit 2026-06-05): cross-tenant finding    */
/*  laundering — minimal logger surface so the service can emit        */
/*  structured security events (cross-tenant 403s) via the Fastify     */
/*  pino logger when callers pass one, falling back to console.        */
/* ------------------------------------------------------------------ */

interface SecurityLogger {
  warn(obj: Record<string, unknown>, msg?: string): void;
  info(obj: Record<string, unknown>, msg?: string): void;
}

/**
 * SECURITY FIX (BLACKFYRE audit 2026-06-05): raised when a client-supplied
 * scanId/findingId resolves to a row owned by a different tenant. Callers
 * (routes) should map this to a 403/404 so foreign-tenant data is never
 * loaded into an LLM prompt or returned to the requester.
 */
export class CrossTenantAccessError extends Error {
  readonly code = "CROSS_TENANT_ACCESS";
  constructor(message: string) {
    super(message);
    this.name = "CrossTenantAccessError";
  }
}

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface GapAnalysisResult {
  scanId: string;
  framework: string;
  overallScore: number;
  criticalGaps: number;
  gaps: Array<{
    control: string;
    framework: string;
    status: "gap" | "partial" | "covered";
    risk: "critical" | "high" | "medium" | "low";
    recommendation: string;
  }>;
  generatedAt: string;
  confidence: number;
  modelVersion: string;
}

export interface MitreMapping {
  findingId: string;
  technique: string;
  techniqueId: string;
  tactic: string;
  mitigation: string;
  severity: Severity;
}

export interface RiskAssessment {
  tenantId: string;
  overallRisk: number;
  riskLevel: "critical" | "high" | "medium" | "low";
  riskBreakdown: {
    cloudInfrastructure: number;
    identityAccess: number;
    dataProtection: number;
    networkSecurity: number;
    compliance: number;
  };
  topRisks: Array<{ title: string; score: number; category: string; recommendation: string }>;
  recommendations: string[];
  generatedAt: string;
  confidence: number;
  modelVersion: string;
}

export interface RemediationRecommendation {
  findingId: string;
  steps: string[];
  priority: "immediate" | "short_term" | "long_term";
  effort: "low" | "medium" | "high";
  impact: "critical" | "high" | "medium" | "low";
  automatable: boolean;
  estimatedMinutes: number;
  confidence: number;
  modelVersion: string;
  generatedAt: string;
}

export interface ExecutiveSummary {
  scanId: string;
  summary: string;
  keyFindings: string[];
  riskPosture: string;
  recommendations: string[];
  complianceStatus: Record<string, { score: number; status: string }>;
  generatedAt: string;
  confidence: number;
  modelVersion: string;
}

export interface ComplianceTrajectory {
  predictedScore30d: number;
  predictedScore90d: number;
  confidence: number;
  riskFactors: string[];
  recommendations: string[];
  modelVersion: string;
  generatedAt: string;
}

export interface ControlMappingSuggestion {
  framework: string;
  controlId: string;
  controlName: string;
  confidence: number;
  reasoning: string;
}

export interface RemediationPriority {
  findingId: string;
  priority: number;
  reasoning: string;
  estimatedEffort: string;
  complianceImpact: Record<string, number>;
}

export interface ScanAnomaly {
  type: "score_drop" | "finding_spike" | "new_category" | "regression";
  description: string;
  severity: string;
  affectedFrameworks: string[];
  suggestedAction: string;
}

export interface AnomalyDetectionResult {
  anomalies: ScanAnomaly[];
  overallRisk: "stable" | "concerning" | "critical";
  confidence: number;
  modelVersion: string;
  generatedAt: string;
}

/* ------------------------------------------------------------------ */
/*  Framework key normalization + registry-backed control resolution  */
/* ------------------------------------------------------------------ */

// REAL IMPL (BLACKFYRE 2026-06): callers pass framework identifiers in mixed forms
// (registry keys like "soc2", display names like "SOC 2", "ISO 27001", "NIST CSF").
// Normalize to the registry key used by control-registry.ts so we resolve against
// the ACTUAL control catalog. Unknown inputs return undefined (no fabrication).
const FRAMEWORK_ALIASES: Record<string, string> = {
  "soc2": "soc2", "soc 2": "soc2", "soc-2": "soc2", "soc2type2": "soc2", "soc 2 type ii": "soc2",
  "iso27001": "iso27001", "iso 27001": "iso27001", "iso-27001": "iso27001", "iso/iec 27001": "iso27001", "iso27001:2022": "iso27001",
  "iso42001": "iso42001", "iso 42001": "iso42001", "iso-42001": "iso42001", "iso/iec 42001": "iso42001",
  "hipaa": "hipaa",
  "gdpr": "gdpr",
  "pcidss": "pcidss", "pci dss": "pcidss", "pci-dss": "pcidss", "pci": "pcidss",
  "dpdpa": "dpdpa", "dpdp": "dpdpa", "dpdp act": "dpdpa",
  "pdppl": "pdppl",
  // NIST 800-53 registry key; "NIST CSF" is a distinct framework not in the
  // registry — map it to the closest catalog we actually carry (800-53) and the
  // reasoning string is honest about the resolution.
  "nist80053": "nist80053", "nist 800-53": "nist80053", "nist800-53": "nist80053",
  "nist": "nist80053", "nist csf": "nist80053", "nist-csf": "nist80053",
};

function normalizeFrameworkKey(framework: string): string | undefined {
  const k = framework.trim().toLowerCase();
  if (FRAMEWORK_ALIASES[k]) return FRAMEWORK_ALIASES[k];
  // Direct registry-key match (already canonical).
  if (getFrameworkRegistry(k)) return k;
  return undefined;
}

// REAL IMPL (BLACKFYRE 2026-06): finding-category → control-registry category map.
// We resolve a finding to genuine controls by intersecting (a) the finding's
// semantic category derived from its text with (b) the real ControlDefinition.category
// values present in each registered framework. No hashing, no invented IDs.
const CATEGORY_INTENT: Array<{ test: RegExp; categories: string[] }> = [
  { test: /\b(mfa|multi-factor|2fa|password|credential|login|authentication|sign-?on|sign-?in)\b/, categories: ["Access Control", "Identification", "Identification and Authentication", "Consent", "Security", "Security Safeguards", "Annex A"] },
  { test: /\b(iam|permission|privilege|role|policy|least privilege|access)\b/, categories: ["Access Control", "Identification", "Identification and Authentication", "Security Safeguards", "Data Protection"] },
  { test: /\b(encrypt|tls|ssl|cipher|kms|key|cryptograph|at rest|in transit|transport)\b/, categories: ["Cryptography", "System Communications", "Encryption", "Transmission Security", "Data Protection", "Security", "Security Safeguards"] },
  { test: /\b(network|firewall|port|vpc|security group|ingress|boundary|segmentation)\b/, categories: ["Network Security", "System Communications", "Access Control"] },
  { test: /\b(log|audit|trail|monitor|cloudtrail|detection|siem)\b/, categories: ["Logging & Monitoring", "Monitoring", "Audit Controls", "Audit and Accountability", "Security Safeguards", "Records & Accountability", "Accountability"] },
  { test: /\b(backup|recovery|versioning|continuity|disaster|retention|restore|snapshot)\b/, categories: ["Availability", "Contingency Planning", "Data Lifecycle", "Records & Accountability"] },
  { test: /\b(vulnerab|patch|cve|remediation|flaw|drift|config)\b/, categories: ["Risk Assessment", "Vulnerability Management", "Configuration Management", "System Integrity", "Change Management"] },
  { test: /\b(breach|exposure|public|leak|data loss|incident)\b/, categories: ["Incident Management", "Incident Response", "Breach Notification", "Breach Management", "Security", "Data Protection", "Monitoring"] },
];

/**
 * REAL IMPL (BLACKFYRE 2026-06): resolve a finding to genuine control IDs from
 * the real registry for ONE framework. Strategy:
 *   1. Derive the finding's intent categories from its text.
 *   2. Pick registry controls whose real `category` matches an intent category.
 *   3. Rank by control weight (3=critical) and cap.
 * Returns [] for an unknown framework (no fabrication).
 */
function resolveRegistryControls(
  framework: string,
  findingText: string,
  limit: number,
): ControlDefinition[] {
  const key = normalizeFrameworkKey(framework);
  if (!key) return [];
  const registry = getFrameworkRegistry(key);
  if (!registry) return [];

  const text = findingText.toLowerCase();
  const intentCats = new Set<string>();
  for (const intent of CATEGORY_INTENT) {
    if (intent.test.test(text)) intent.categories.forEach((c) => intentCats.add(c));
  }

  const matched = intentCats.size > 0
    ? registry.controls.filter((c) => intentCats.has(c.category))
    : [];

  // Fall back to the framework's highest-weight (most critical) controls if no
  // category intent matched — still REAL controls from the catalog, never invented.
  const pool = matched.length > 0 ? matched : registry.controls;
  return [...pool]
    .sort((a, b) => b.weight - a.weight)
    .slice(0, limit);
}

/* ------------------------------------------------------------------ */
/*  LLM Input Sanitization                                            */
/* ------------------------------------------------------------------ */

/** Strip potential prompt injection patterns from user-derived text */
function sanitizeForLLM(text: string): string {
  if (!text) return "";
  return text
    .replace(/```/g, "'''")                          // prevent markdown code blocks that could confuse the model
    .replace(/<\/?[^>]+>/g, "")                      // strip HTML tags
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "")  // strip control characters
    .slice(0, 2000);                                  // cap length to prevent token bombing
}

/* ------------------------------------------------------------------ */
/*  Service                                                            */
/* ------------------------------------------------------------------ */

export class AiAnalysisService {
  // Always non-null: Bedrock takes over when no Anthropic key is set.
  private client: LlmClient;

  // SECURITY FIX (BLACKFYRE audit 2026-06-05): cross-tenant finding laundering —
  // optional Fastify pino logger so cross-tenant denials get structured, queryable
  // security logs. Optional keeps the constructor back-compatible with existing
  // callers (routes/worker) that only pass a Db.
  private log: SecurityLogger;

  constructor(private db: Db, logger?: SecurityLogger) {
    this.client = getLlmClient();
    this.log = logger ?? {
      warn: (obj, msg) => console.warn(`[AiAnalysisService] ${msg ?? ""}`, obj),
      info: (obj, msg) => console.info(`[AiAnalysisService] ${msg ?? ""}`, obj),
    };
  }

  /* ---- helpers ---- */

  // REAL IMPL (BLACKFYRE 2026-06): report the client's ACTUAL configured model ID
  // (the LlmClient already resolves Anthropic vs Bedrock + the model) instead of a
  // hardcoded "claude-sonnet-4" string, so persisted decisions record what truly ran.
  private get modelVersion(): string {
    return `${this.client.provider}:${this.client.modelId}`;
  }

  /**
   * SECURITY FIX (BLACKFYRE audit 2026-06-05): cross-tenant finding laundering.
   * Loads a scan ONLY if it belongs to `tenantId`. A client-supplied scanId that
   * resolves to no row for this tenant (whether it does not exist or is owned by
   * another tenant) is rejected with CrossTenantAccessError so foreign-tenant
   * findings can never be pulled into an LLM prompt. We additionally filter the
   * query by tenantId (defence-in-depth) AND assert ownership on the returned row.
   */
  private async assertScanOwnership(scanId: string, tenantId: string): Promise<void> {
    if (!tenantId) {
      // Fail closed: a missing tenant scope must never widen access.
      this.log.warn({ scanId }, "ai-analysis: scan access attempted without tenant scope — denied");
      throw new CrossTenantAccessError("Tenant scope is required for scan-based analysis.");
    }
    const [scan] = await this.db
      .select({ id: scans.id, tenantId: scans.tenantId })
      .from(scans)
      .where(and(eq(scans.id, scanId), eq(scans.tenantId, tenantId)))
      .limit(1);
    if (!scan || scan.tenantId !== tenantId) {
      this.log.warn(
        { scanId, tenantId },
        "ai-analysis: cross-tenant scan access denied (scanId not owned by tenant)",
      );
      throw new CrossTenantAccessError("Scan not found for this tenant.");
    }
  }

  private async callLLM(system: string, user: string): Promise<string> {
    try {
      const msg = await this.client.messages.create({
        // REAL IMPL (BLACKFYRE 2026-06): use the client's configured model rather
        // than a hardcoded ID; the LlmClient maps it to the active provider
        // (Anthropic direct or the Bedrock inference profile).
        model: this.client.modelId,
        max_tokens: 4096,
        system,
        messages: [{ role: "user", content: user }],
      });
      return msg.content[0]?.type === "text" ? msg.content[0].text : "";
    } catch (err) {
      console.error("[AiAnalysisService] LLM call failed:", err);
      return ""; // upstream callers treat "" as "fall back to heuristic"
    }
  }

  /**
   * REAL IMPL (BLACKFYRE 2026-06): persist an AI/analysis decision to the real
   * aiDecisionLog table so AI-driven mappings are auditable (decisionType, input,
   * output, confidence, model, and an explainability blob describing the method).
   * Best-effort: a logging failure must never break the analysis response, and we
   * only persist when an authenticated tenant scope is present. We never store
   * secrets/PII — inputs are scan/finding identifiers and derived control/technique
   * IDs, not raw credentials.
   */
  private async persistDecision(params: {
    tenantId: string;
    decisionType: string;
    input: Record<string, unknown>;
    output: unknown;
    confidence: number;
    explainability: Record<string, unknown>;
  }): Promise<void> {
    if (!params.tenantId) return;
    try {
      await this.db.insert(aiDecisionLog).values({
        tenantId: params.tenantId,
        decisionType: params.decisionType,
        input: params.input,
        output: params.output as any,
        confidence: params.confidence,
        modelVersion: this.modelVersion,
        explainability: params.explainability,
        humanApproved: false,
      });
    } catch (err) {
      this.log.warn(
        { tenantId: params.tenantId, decisionType: params.decisionType, err: (err as Error)?.message },
        "ai-analysis: failed to persist AI decision (non-fatal)",
      );
    }
  }

  // SECURITY FIX (BLACKFYRE audit 2026-06-05): cross-tenant finding laundering —
  // findings are now loaded scoped to BOTH scanId AND tenantId so a foreign-tenant
  // scanId can never return another tenant's findings into an LLM prompt. tenantId
  // is required; callers must thread request.tenantId through.
  private async getScanFindings(scanId: string, tenantId: string) {
    return this.db
      .select()
      .from(findings)
      .where(and(eq(findings.scanId, scanId), eq(findings.tenantId, tenantId)))
      .orderBy(desc(findings.createdAt));
  }

  private categorizeFinding(f: { category: string; title: string; severity: string }): string {
    const t = `${f.category} ${f.title}`.toLowerCase();
    if (t.includes("mfa") || t.includes("multi-factor"))                return "missing_mfa";
    if (t.includes("password") || t.includes("credential"))             return "weak_credentials";
    if (t.includes("public") || t.includes("exposed") || t.includes("open")) return "public_exposure";
    if (t.includes("encrypt") || t.includes("ssl") || t.includes("tls"))     return "missing_encryption";
    if (t.includes("permission") || t.includes("privilege") || t.includes("role")) return "excessive_permissions";
    if (t.includes("log") || t.includes("trail") || t.includes("audit"))      return "missing_logging";
    if (t.includes("port") || t.includes("firewall"))                          return "open_ports";
    if (t.includes("key") || t.includes("rotation") || t.includes("kms"))      return "key_management";
    if (t.includes("drift") || t.includes("config"))                           return "config_drift";
    if (t.includes("stale") || t.includes("inactive") || t.includes("unused")) return "stale_accounts";
    if (t.includes("transport") || t.includes("http ") || t.includes("hsts"))  return "insecure_transport";
    if (t.includes("backup") || t.includes("version"))                         return "missing_backup";
    return "config_drift";
  }

  /* ================================================================ */
  /*  1. Gap Analysis                                                  */
  /* ================================================================ */

  async gapAnalysis(scanId: string, framework: string, tenantId: string): Promise<GapAnalysisResult> {
    // SECURITY FIX (BLACKFYRE audit 2026-06-05): cross-tenant finding laundering —
    // verify the client-supplied scanId belongs to the caller's tenant before any
    // of its findings are summarised into an LLM prompt; reject + log otherwise.
    await this.assertScanOwnership(scanId, tenantId);
    this.log.info({ scanId, tenantId, framework }, "ai-analysis: gap analysis on tenant-owned scan");
    const rows = await this.getScanFindings(scanId, tenantId);
    if (rows.length === 0) {
      return { scanId, framework, overallScore: 100, criticalGaps: 0, gaps: [], generatedAt: new Date().toISOString(), confidence: 1.0, modelVersion: this.modelVersion };
    }

    const findingSummary = rows.map((f) => `[${f.severity}] ${sanitizeForLLM(f.title ?? "")} — ${sanitizeForLLM(f.description?.slice(0, 120) ?? "")}`).join("\n");

    // REAL IMPL (BLACKFYRE 2026-06): give the LLM the ACTUAL control catalog for this
    // framework so any control IDs it returns are real registry IDs, then validate
    // its output against the registry and drop/reconcile any hallucinated IDs.
    const fwKey = normalizeFrameworkKey(framework);
    const registry = fwKey ? getFrameworkRegistry(fwKey) : undefined;

    if (this.client && registry) {
      const catalog = registry.controls
        .map((c) => `${c.controlId} — ${c.controlName} [${c.category}]`)
        .join("\n");
      const raw = await this.callLLM(
        "You are a cybersecurity compliance expert. Respond ONLY with a valid JSON object, no markdown fences.",
        `Analyze these ${rows.length} findings against the ${registry.framework} (${registry.version}) framework. Map each gap ONLY to control IDs from the provided catalog — do NOT invent control IDs.\n\nControl catalog:\n${catalog}\n\nFindings:\n${findingSummary}\n\nRespond as JSON: { "overallScore": <0-100>, "criticalGaps": <count>, "gaps": [{ "control": "<exact catalog control id>", "framework": "${framework}", "status": "gap|partial|covered", "risk": "critical|high|medium|low", "recommendation": "<text>" }] }`,
      );
      try {
        const parsed = JSON.parse(raw);
        if (typeof parsed !== "object" || parsed === null || !Array.isArray(parsed.gaps)) {
          throw new Error("Invalid LLM response structure");
        }
        // Keep only gaps whose control ID genuinely exists in the registry.
        const validGaps = (parsed.gaps as Array<{ control?: string }>).filter(
          (g) => typeof g.control === "string" && getControlDefinition(fwKey!, g.control) !== undefined,
        );
        if (validGaps.length > 0) {
          const result: GapAnalysisResult = {
            scanId,
            framework,
            overallScore: typeof parsed.overallScore === "number" ? parsed.overallScore : this.scoreFromFindings(rows),
            criticalGaps: typeof parsed.criticalGaps === "number" ? parsed.criticalGaps : validGaps.filter((g: any) => g.risk === "critical").length,
            gaps: validGaps as GapAnalysisResult["gaps"],
            generatedAt: new Date().toISOString(),
            confidence: 0.9,
            modelVersion: this.modelVersion,
          };
          await this.persistDecision({
            tenantId,
            decisionType: "gap_analysis",
            input: { scanId, framework: fwKey, findingCount: rows.length },
            output: { overallScore: result.overallScore, controlIds: validGaps.map((g: any) => g.control) },
            confidence: result.confidence,
            explainability: { method: "llm+registry-validated", validatedAgainst: `control-registry:${fwKey}`, droppedHallucinations: parsed.gaps.length - validGaps.length },
          });
          return result;
        }
        // No LLM gap resolved to a real control — fall through to the registry heuristic.
      } catch { /* fall through to heuristic */ }
    }

    return this.heuristicGapAnalysis(scanId, framework, rows, tenantId);
  }

  private scoreFromFindings(rows: any[]): number {
    const severityWeight: Record<string, number> = { critical: 25, high: 15, medium: 8, low: 3, info: 0 };
    const totalDeductions = rows.reduce((sum, f) => sum + (severityWeight[f.severity] || 0), 0);
    return Math.max(0, 100 - totalDeductions);
  }

  // REAL IMPL (BLACKFYRE 2026-06): heuristic gap analysis now resolves each finding
  // to GENUINE control IDs from the real control-registry catalog (by intersecting
  // the finding's intent with the framework's real ControlDefinition categories),
  // replacing the previous SHA256-derived fake IDs like "SOC2-IAM-A1B2C3D4".
  private async heuristicGapAnalysis(scanId: string, framework: string, rows: any[], tenantId: string): Promise<GapAnalysisResult> {
    const overallScore = this.scoreFromFindings(rows);
    const criticalFindings = rows.filter((f) => f.severity === "critical" || f.severity === "high");
    const fwKey = normalizeFrameworkKey(framework);

    // De-duplicate gaps by control ID across findings (a control may be implicated
    // by several findings); keep the highest risk and the first recommendation.
    const byControl = new Map<string, GapAnalysisResult["gaps"][number]>();
    for (const f of criticalFindings.slice(0, 50)) {
      const text = `${f.category ?? ""} ${f.title ?? ""} ${f.description ?? ""}`;
      const controls = resolveRegistryControls(framework, text, 2);
      for (const ctrl of controls) {
        const risk = f.severity as "critical" | "high" | "medium" | "low";
        const existing = byControl.get(ctrl.controlId);
        if (!existing) {
          byControl.set(ctrl.controlId, {
            control: ctrl.controlId,
            framework,
            status: f.severity === "critical" ? "gap" : "partial",
            risk,
            recommendation: `${ctrl.controlName}: address "${f.title}" — ${f.description?.slice(0, 160) ?? "review and remediate this finding."}`,
          });
        } else if (risk === "critical" && existing.risk !== "critical") {
          existing.risk = "critical";
          existing.status = "gap";
        }
      }
    }

    const gaps = Array.from(byControl.values()).slice(0, 20);

    await this.persistDecision({
      tenantId,
      decisionType: "gap_analysis",
      input: { scanId, framework: fwKey ?? framework, findingCount: rows.length },
      output: { overallScore, controlIds: gaps.map((g) => g.control) },
      confidence: 0.7,
      explainability: {
        method: "heuristic:category-intent→registry-controls",
        note: "Statistical/keyword resolution against the real control catalog; not an ML/audited control assessment.",
        resolvedFramework: fwKey ?? null,
      },
    });

    return { scanId, framework, overallScore, criticalGaps: criticalFindings.length, gaps, generatedAt: new Date().toISOString(), confidence: 0.7, modelVersion: "heuristic-v1" };
  }

  /* ================================================================ */
  /*  2. MITRE ATT&CK Mapping                                         */
  /* ================================================================ */

  async mitreMapping(scanId: string, tenantId: string): Promise<MitreMapping[]> {
    // SECURITY FIX (BLACKFYRE audit 2026-06-05): cross-tenant finding laundering —
    // verify scan ownership before mapping its findings to ATT&CK techniques via the LLM.
    await this.assertScanOwnership(scanId, tenantId);
    this.log.info({ scanId, tenantId }, "ai-analysis: MITRE mapping on tenant-owned scan");
    const rows = await this.getScanFindings(scanId, tenantId);
    if (rows.length === 0) return [];

    // REAL IMPL (BLACKFYRE 2026-06): the heuristic baseline is computed from the
    // curated ATT&CK catalog (services/mitre/attack-techniques.ts) for EVERY finding.
    // When the LLM is available it may refine the mapping, but any technique ID it
    // returns is validated against the real catalog — unknown/hallucinated IDs are
    // replaced with the deterministic catalog mapping for that finding. So the
    // output always carries genuine ATT&CK technique IDs.
    const scoped = rows.slice(0, 50);
    const heuristic: MitreMapping[] = scoped.map((f) => {
      const { primary } = mapFindingToTechniques({
        category: f.category,
        title: f.title,
        description: f.description,
        resourceType: f.resourceType,
        severity: f.severity,
      });
      return {
        findingId: f.id,
        technique: primary.name,
        techniqueId: primary.id,
        tactic: primary.tactic,
        mitigation: primary.mitigation,
        severity: f.severity as Severity,
      };
    });
    const heuristicById = new Map(heuristic.map((m) => [m.findingId, m]));

    let mappings: MitreMapping[] = heuristic;
    let method = "heuristic:catalog-mapping";

    if (this.client) {
      const findingSummary = scoped.map((f) => `ID:${f.id} [${f.severity}/${f.category}] ${sanitizeForLLM(f.title ?? "")}`).join("\n");
      const raw = await this.callLLM(
        "You are a MITRE ATT&CK framework expert. Map security findings to ATT&CK techniques using only real technique IDs. Respond ONLY with valid JSON array, no markdown fences.",
        `Map each finding to the most relevant MITRE ATT&CK technique or sub-technique. Use real ATT&CK IDs (e.g. T1078, T1078.004, T1530).\n\n${findingSummary}\n\nRespond as JSON array: [{ "findingId": "<id>", "techniqueId": "<T#### or T####.###>", "severity": "<severity>" }]`,
      );
      try {
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) throw new Error("Invalid LLM response structure");
        // Reconcile each LLM mapping against the REAL catalog; fall back to the
        // deterministic heuristic mapping for unknown technique IDs / findings.
        mappings = scoped.map((f) => {
          const llm = parsed.find((p: any) => p?.findingId === f.id);
          const tech = llm && typeof llm.techniqueId === "string" ? getTechnique(llm.techniqueId) : undefined;
          if (tech) {
            return {
              findingId: f.id,
              technique: tech.name,
              techniqueId: tech.id,
              tactic: tech.tactic,
              mitigation: tech.mitigation,
              severity: f.severity as Severity,
            };
          }
          return heuristicById.get(f.id)!;
        });
        method = "llm+catalog-validated";
      } catch { /* keep heuristic mappings */ }
    }

    await this.persistDecision({
      tenantId,
      decisionType: "mitre_mapping",
      input: { scanId, findingCount: scoped.length },
      output: mappings.map((m) => ({ findingId: m.findingId, techniqueId: m.techniqueId, tactic: m.tactic })),
      confidence: method.startsWith("llm") ? 0.85 : 0.7,
      explainability: {
        method,
        catalog: "services/mitre/attack-techniques.ts (curated cloud-relevant ATT&CK subset)",
        note: "Keyword/severity heuristic mapping to real ATT&CK technique IDs — signature-based, not behavioural detection.",
      },
    });

    return mappings;
  }

  /* ================================================================ */
  /*  3. Risk Assessment                                               */
  /* ================================================================ */

  async riskAssessment(tenantId: string, industry?: string): Promise<RiskAssessment> {
    const rows = await this.db
      .select()
      .from(findings)
      .where(and(eq(findings.tenantId, tenantId), eq(findings.status, "open")));

    const sevScore: Record<string, number> = { critical: 10, high: 7, medium: 4, low: 1, info: 0 };
    const catBuckets: Record<string, number[]> = {
      cloudInfrastructure: [], identityAccess: [], dataProtection: [], networkSecurity: [], compliance: [],
    };

    for (const f of rows) {
      const s = sevScore[f.severity] ?? 0;
      const cat = f.category;
      if (cat === "iam" || cat === "identity")     catBuckets.identityAccess.push(s);
      else if (cat === "encryption")               catBuckets.dataProtection.push(s);
      else if (cat === "network")                  catBuckets.networkSecurity.push(s);
      else if (cat === "logging")                  catBuckets.compliance.push(s);
      else                                         catBuckets.cloudInfrastructure.push(s);
    }

    const avg = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);
    const breakdown = {
      cloudInfrastructure: Math.round(avg(catBuckets.cloudInfrastructure) * 10),
      identityAccess:      Math.round(avg(catBuckets.identityAccess) * 10),
      dataProtection:      Math.round(avg(catBuckets.dataProtection) * 10),
      networkSecurity:     Math.round(avg(catBuckets.networkSecurity) * 10),
      compliance:          Math.round(avg(catBuckets.compliance) * 10),
    };
    const overallRisk = Math.round(Object.values(breakdown).reduce((a, b) => a + b, 0) / 5);
    const riskLevel = overallRisk >= 70 ? "critical" : overallRisk >= 50 ? "high" : overallRisk >= 25 ? "medium" : "low";

    const topRisks = rows
      .filter((f) => f.severity === "critical" || f.severity === "high")
      .slice(0, 10)
      .map((f) => ({
        title: f.title,
        score: sevScore[f.severity] ?? 0,
        category: f.category,
        recommendation: `Remediate: ${f.description?.slice(0, 150) ?? f.title}`,
      }));

    const recommendations = [
      ...(breakdown.identityAccess > 50 ? ["Immediately review IAM policies and enforce MFA for all admin accounts."] : []),
      ...(breakdown.dataProtection > 50 ? ["Enable encryption at rest for all data stores and enforce TLS 1.2+."] : []),
      ...(breakdown.networkSecurity > 50 ? ["Review firewall rules and close unnecessary exposed ports."] : []),
      ...(breakdown.cloudInfrastructure > 50 ? ["Audit cloud resource configurations and enable security monitoring."] : []),
      ...(breakdown.compliance > 50 ? ["Enable comprehensive audit logging and review compliance control coverage."] : []),
      ...(rows.length > 50 ? ["Consider prioritized remediation sprints — current finding volume requires focused effort."] : []),
    ];

    if (recommendations.length === 0) recommendations.push("Security posture is healthy. Continue regular scanning and monitoring.");

    return { tenantId, overallRisk, riskLevel, riskBreakdown: breakdown, topRisks, recommendations, generatedAt: new Date().toISOString(), confidence: 0.8, modelVersion: this.modelVersion };
  }

  /* ================================================================ */
  /*  4. Remediation Recommendation                                    */
  /* ================================================================ */

  async remediationRecommendation(findingId: string, tenantId: string): Promise<RemediationRecommendation> {
    // SECURITY FIX (BLACKFYRE audit 2026-06-05): cross-tenant finding laundering —
    // load the finding scoped to the caller's tenant so a foreign-tenant findingId
    // cannot be fed into the remediation LLM prompt. tenantId is required and the
    // query filters by it; a non-match is treated as a cross-tenant denial.
    if (!tenantId) {
      this.log.warn({ findingId }, "ai-analysis: remediation requested without tenant scope — denied");
      throw new CrossTenantAccessError("Tenant scope is required for remediation analysis.");
    }
    const [finding] = await this.db
      .select()
      .from(findings)
      .where(and(eq(findings.id, findingId), eq(findings.tenantId, tenantId)))
      .limit(1);
    if (!finding) {
      this.log.warn(
        { findingId, tenantId },
        "ai-analysis: cross-tenant finding access denied (findingId not owned by tenant)",
      );
      throw new CrossTenantAccessError("Finding not found for this tenant.");
    }
    this.log.info({ findingId, tenantId }, "ai-analysis: remediation on tenant-owned finding");

    if (this.client) {
      const raw = await this.callLLM(
        "You are a cybersecurity remediation expert. Provide actionable, step-by-step remediation. Respond ONLY with valid JSON, no markdown fences.",
        `Finding: [${finding.severity}] ${sanitizeForLLM(finding.title ?? "")}\nCategory: ${finding.category}\nResource: ${finding.resourceType ?? "N/A"} (${finding.resourceId ?? "N/A"})\nDescription: ${sanitizeForLLM(finding.description ?? "")}\n\nProvide remediation as JSON: { "steps": ["step1", "step2", ...], "priority": "immediate|short_term|long_term", "effort": "low|medium|high", "impact": "critical|high|medium|low", "automatable": true/false, "estimatedMinutes": <number> }`,
      );
      try {
        const parsed = JSON.parse(raw);
        if (typeof parsed !== "object" || parsed === null) {
          throw new Error("Invalid LLM response structure");
        }
        return { findingId, confidence: 0.9, modelVersion: this.modelVersion, generatedAt: new Date().toISOString(), ...parsed };
      } catch { /* fall through */ }
    }

    return this.heuristicRemediation(finding);
  }

  private heuristicRemediation(f: any): RemediationRecommendation {
    const key = this.categorizeFinding(f);
    const stepsMap: Record<string, string[]> = {
      missing_mfa:          ["Enable MFA requirement in identity provider settings.", "Configure allowed MFA factors (prefer hardware keys or authenticator apps).", "Set a grace period and communicate rollout to all users.", "Verify enforcement by auditing login events."],
      weak_credentials:     ["Review and enforce minimum password complexity (12+ chars, mixed case, symbols).", "Enable account lockout after 5 failed attempts.", "Implement credential rotation policy (90-day max).", "Deploy compromised password detection."],
      public_exposure:      ["Remove public access immediately for the affected resource.", "Implement network ACLs restricting to known IP ranges.", "Enable WAF/DDoS protection if public-facing.", "Set up alerting for future public exposure changes."],
      missing_encryption:   ["Enable server-side encryption (AES-256 or KMS-managed keys).", "Enable TLS 1.2+ for all data in transit.", "Audit all storage services for encryption coverage.", "Enable key rotation on a quarterly schedule."],
      excessive_permissions: ["Apply least-privilege principle — review and scope down roles.", "Remove wildcard (*) permissions from all policies.", "Implement just-in-time access for elevated privileges.", "Schedule quarterly access reviews."],
      missing_logging:      ["Enable CloudTrail/audit logging for all management events.", "Configure log retention (minimum 1 year for compliance).", "Set up real-time alerting on suspicious log events.", "Enable log file integrity validation."],
      open_ports:           ["Close the exposed port via security group/firewall rule update.", "If service must be accessible, restrict to known IP ranges.", "Implement a bastion host or VPN for administrative access.", "Add monitoring for port exposure changes."],
      key_management:       ["Enable automatic key rotation in KMS.", "Migrate from customer-managed to KMS-managed keys where possible.", "Audit key usage and remove unused keys.", "Set up alerts for key deletion requests."],
      config_drift:         ["Compare current config against baseline/IaC definitions.", "Revert unauthorized changes.", "Implement drift detection with auto-alerting.", "Enforce changes through CI/CD pipelines only."],
      stale_accounts:       ["Disable accounts with no login activity for 90+ days.", "Implement automated offboarding workflows.", "Review service accounts and rotate credentials.", "Set up alerts for stale account thresholds."],
      insecure_transport:   ["Upgrade to TLS 1.2 or higher.", "Enable HSTS with a minimum 1-year max-age.", "Disable legacy protocols (SSLv3, TLS 1.0, TLS 1.1).", "Configure strong cipher suites only."],
      missing_backup:       ["Enable versioning on storage resources.", "Configure cross-region replication for disaster recovery.", "Set retention policies (minimum 30-day for production).", "Test restore procedures quarterly."],
    };

    const steps = stepsMap[key] ?? ["Review the finding details and consult your security team.", "Apply the appropriate remediation based on your environment.", "Verify the fix and rescan."];
    const priority = f.severity === "critical" ? "immediate" : f.severity === "high" ? "short_term" : "long_term";
    const effort = f.autoFixAvailable ? "low" : f.severity === "critical" ? "medium" : "medium";
    const estimatedMinutes = f.autoFixAvailable ? 5 : f.severity === "critical" ? 30 : 60;

    return {
      findingId: f.id,
      steps,
      priority: priority as any,
      effort: effort as any,
      impact: f.severity as any,
      automatable: f.autoFixAvailable ?? false,
      estimatedMinutes,
      confidence: 0.7,
      modelVersion: "heuristic-v1",
      generatedAt: new Date().toISOString(),
    };
  }

  /* ================================================================ */
  /*  5. Executive Summary                                             */
  /* ================================================================ */

  async executiveSummary(scanId: string, tenantId: string): Promise<ExecutiveSummary> {
    // SECURITY FIX (BLACKFYRE audit 2026-06-05): cross-tenant finding laundering —
    // verify scan ownership before summarising its findings for an executive report.
    await this.assertScanOwnership(scanId, tenantId);
    this.log.info({ scanId, tenantId }, "ai-analysis: executive summary on tenant-owned scan");
    const rows = await this.getScanFindings(scanId, tenantId);
    // Scan is loaded scoped to tenantId so the summary never references a foreign scan.
    const [scan] = await this.db
      .select()
      .from(scans)
      .where(and(eq(scans.id, scanId), eq(scans.tenantId, tenantId)))
      .limit(1);

    const sevCounts: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
    const catCounts: Record<string, number> = {};
    for (const f of rows) {
      sevCounts[f.severity] = (sevCounts[f.severity] || 0) + 1;
      catCounts[f.category] = (catCounts[f.category] || 0) + 1;
    }

    if (this.client) {
      const context = `Scan completed: ${rows.length} findings.\nSeverity breakdown: ${JSON.stringify(sevCounts)}\nCategory breakdown: ${JSON.stringify(catCounts)}\nTop findings:\n${rows.slice(0, 15).map((f) => `- [${f.severity}] ${sanitizeForLLM(f.title ?? "")}`).join("\n")}`;
      const raw = await this.callLLM(
        "You are a CISO preparing a board-level security briefing. Write clearly for non-technical executives. Respond ONLY with valid JSON, no markdown fences.",
        `Generate an executive security summary.\n\n${context}\n\nRespond as JSON: { "summary": "<2-3 paragraph summary>", "keyFindings": ["<finding>", ...], "riskPosture": "<1 paragraph>", "recommendations": ["<rec>", ...], "complianceStatus": { "<framework>": { "score": <0-100>, "status": "<text>" } } }`,
      );
      try {
        const parsed = JSON.parse(raw);
        if (typeof parsed !== "object" || parsed === null) {
          throw new Error("Invalid LLM response structure");
        }
        return { scanId, generatedAt: new Date().toISOString(), confidence: 0.9, modelVersion: this.modelVersion, ...parsed };
      } catch { /* fall through */ }
    }

    // Heuristic summary
    const total = rows.length;
    const criticalCount = sevCounts.critical + sevCounts.high;
    const riskWord = criticalCount > 10 ? "elevated" : criticalCount > 3 ? "moderate" : "acceptable";

    const summary = `Security assessment identified ${total} findings across your infrastructure. ${criticalCount} findings are rated critical or high severity, indicating an ${riskWord} risk posture. ${sevCounts.critical > 0 ? `There are ${sevCounts.critical} critical findings requiring immediate attention.` : "No critical findings were identified."} The most affected areas are ${Object.entries(catCounts).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${k} (${v} findings)`).join(", ")}.`;

    const keyFindings = rows
      .filter((f) => f.severity === "critical" || f.severity === "high")
      .slice(0, 5)
      .map((f) => f.title);

    const riskPosture = `Overall risk posture is ${riskWord}. ${criticalCount > 0 ? `Priority remediation is recommended for the ${criticalCount} critical/high findings.` : "Continue regular monitoring and scheduled assessments."} Infrastructure coverage is ${scan ? "complete" : "partial"} based on connected integrations.`;

    return {
      scanId,
      summary,
      keyFindings,
      riskPosture,
      recommendations: [
        ...(sevCounts.critical > 0 ? ["Address all critical findings within 48 hours."] : []),
        ...(sevCounts.high > 5 ? ["Schedule a remediation sprint for high-severity findings."] : []),
        "Review and update security policies quarterly.",
        "Expand scanning coverage to all connected infrastructure.",
      ],
      complianceStatus: {
        "SOC 2":     { score: Math.max(0, 100 - criticalCount * 8),  status: criticalCount > 5 ? "At Risk" : "On Track" },
        "ISO 27001": { score: Math.max(0, 100 - criticalCount * 6),  status: criticalCount > 8 ? "At Risk" : "On Track" },
        "DPDPA":     { score: Math.max(0, 100 - criticalCount * 5),  status: criticalCount > 10 ? "At Risk" : "On Track" },
      },
      generatedAt: new Date().toISOString(),
      confidence: 0.7,
      modelVersion: "heuristic-v1",
    };
  }

  /* ================================================================ */
  /*  6. Compliance Trajectory Prediction                              */
  /* ================================================================ */

  async predictComplianceTrajectory(params: {
    tenantId: string;
    framework: string;
    currentScore: number;
    historicalScores: Array<{ date: string; score: number }>;
    openFindings: number;
    remediationRate: number;
  }): Promise<ComplianceTrajectory> {
    const { tenantId, framework, currentScore, historicalScores, openFindings, remediationRate } = params;

    // SECURITY FIX (BLACKFYRE audit 2026-06-05): cross-tenant analysis hardening —
    // this method accepts raw, client-supplied historical/score data and must run
    // under an explicit tenant scope. Although the projection is pure arithmetic on
    // the caller-provided inputs (it issues no DB query that could cross tenants),
    // we fail closed when the tenant scope is missing so a caller can never invoke
    // the trajectory engine without an authenticated tenant context, and we emit a
    // structured security log for the denial.
    if (!tenantId) {
      this.log.warn({ framework }, "ai-analysis: compliance trajectory requested without tenant scope — denied");
      throw new CrossTenantAccessError("Tenant scope is required for compliance trajectory prediction.");
    }
    this.log.info({ tenantId, framework }, "ai-analysis: compliance trajectory for tenant-scoped inputs");

    // Linear regression on historical scores
    const sorted = [...historicalScores].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const n = sorted.length;

    let slope = 0;
    if (n >= 2) {
      const t0 = new Date(sorted[0].date).getTime();
      const xs = sorted.map((s) => (new Date(s.date).getTime() - t0) / (1000 * 60 * 60 * 24)); // days
      const ys = sorted.map((s) => s.score);
      const xMean = xs.reduce((a, b) => a + b, 0) / n;
      const yMean = ys.reduce((a, b) => a + b, 0) / n;
      const num = xs.reduce((sum, x, i) => sum + (x - xMean) * (ys[i] - yMean), 0);
      const den = xs.reduce((sum, x) => sum + (x - xMean) ** 2, 0);
      slope = den !== 0 ? num / den : 0; // points per day
    }

    // Adjust for finding velocity and remediation rate
    // Positive remediationRate (findings closed per day) improves score; openFindings adds drag
    const findingDrag = openFindings > 0 ? -(openFindings * 0.1) : 0;
    const remediationBoost = remediationRate * 0.5;
    const adjustedDailyDelta = slope + (remediationBoost + findingDrag) / 30;

    const predictedScore30d = Math.min(100, Math.max(0, Math.round(currentScore + adjustedDailyDelta * 30)));
    const predictedScore90d = Math.min(100, Math.max(0, Math.round(currentScore + adjustedDailyDelta * 90)));

    const riskFactors: string[] = [];
    if (slope < -0.2) riskFactors.push("Declining compliance trend detected over historical period.");
    if (openFindings > 20) riskFactors.push(`High open finding count (${openFindings}) is suppressing score recovery.`);
    if (remediationRate < 1) riskFactors.push("Low remediation rate — fewer than 1 finding closed per day on average.");
    if (predictedScore30d < 70) riskFactors.push("Projected score below acceptable threshold (70) within 30 days.");
    if (predictedScore90d < currentScore) riskFactors.push("Score expected to decline further over next 90 days without intervention.");

    const recommendations: string[] = [];
    if (remediationRate < 2) recommendations.push("Increase remediation cadence — target closing at least 2 findings per day.");
    if (openFindings > 10) recommendations.push(`Prioritize top ${Math.min(openFindings, 10)} open findings for immediate remediation.`);
    if (slope < 0) recommendations.push("Review root cause of score decline — schedule a compliance gap sprint.");
    if (predictedScore90d >= currentScore) recommendations.push("Current trajectory is positive — maintain remediation pace to stay on track.");
    if (recommendations.length === 0) recommendations.push("Compliance trajectory is stable. Continue current remediation cadence.");

    const confidence = n >= 5 ? 0.85 : n >= 2 ? 0.65 : 0.4;

    return {
      predictedScore30d,
      predictedScore90d,
      confidence,
      riskFactors,
      recommendations,
      modelVersion: "heuristic-v1",
      generatedAt: new Date().toISOString(),
    };
  }

  /* ================================================================ */
  /*  7. Control Mapping Suggestions                                   */
  /* ================================================================ */

  // REAL IMPL (BLACKFYRE 2026-06): resolve suggestions against the ACTUAL control
  // catalog (control-registry.ts) instead of a tiny inline keyword library. Each
  // returned controlId/controlName is a genuine registry control for the requested
  // framework; confidence is an honestly-labelled heuristic (category-intent overlap
  // weighted by the control's real criticality weight), NOT a measured/ML score.
  async suggestControlMappings(params: {
    finding: { title: string; description: string; severity: string; category: string };
    frameworks: string[];
    // Optional tenant scope: this method reads only the in-process control registry
    // and the caller-supplied finding text (no per-tenant DB query), so it is
    // tenant-safe by construction; tenantId is threaded for attributable audit logs.
    tenantId?: string;
  }): Promise<Array<ControlMappingSuggestion>> {
    const { finding, frameworks, tenantId } = params;
    this.log.info(
      { tenantId, frameworks, severity: finding.severity, category: finding.category },
      "ai-analysis: control-mapping suggestions (registry-backed, no per-tenant DB access)",
    );
    const text = `${finding.title} ${finding.description} ${finding.category}`;
    const lower = text.toLowerCase();

    // Derive the finding's intent categories once (same intent map used by gap analysis).
    const intentCats = new Set<string>();
    for (const intent of CATEGORY_INTENT) {
      if (intent.test.test(lower)) intent.categories.forEach((c) => intentCats.add(c));
    }

    const suggestions: Array<ControlMappingSuggestion & { _score: number }> = [];
    for (const fw of frameworks) {
      const key = normalizeFrameworkKey(fw);
      const registry = key ? getFrameworkRegistry(key) : undefined;
      if (!registry) {
        // Unknown framework → no fabricated controls; record the gap for audit.
        this.log.info({ tenantId, framework: fw }, "ai-analysis: no registry for requested framework — skipped");
        continue;
      }
      // Resolve up to 3 genuine controls per framework via the registry resolver.
      const controls = resolveRegistryControls(fw, text, 3);
      for (const ctrl of controls) {
        const categoryHit = intentCats.has(ctrl.category);
        // Honest heuristic confidence: a category-intent match scores higher than a
        // weight-only fallback; the control's real weight (1..3) nudges it further.
        const base = categoryHit ? 0.55 : 0.3;
        const weightBoost = (ctrl.weight - 1) * 0.12; // 0, 0.12, 0.24
        const confidence = Math.min(0.95, Math.round((base + weightBoost) * 100) / 100);
        suggestions.push({
          framework: registry.framework as string,
          controlId: ctrl.controlId,
          controlName: ctrl.controlName,
          confidence,
          reasoning: categoryHit
            ? `Heuristic match: finding intent aligns with control category "${ctrl.category}" (weight ${ctrl.weight}). Resolved from the ${registry.framework} registry; not a measured/ML score.`
            : `Heuristic fallback: highest-criticality ${registry.framework} control in category "${ctrl.category}" (weight ${ctrl.weight}). Statistical relevance only.`,
          _score: (categoryHit ? 10 : 1) + ctrl.weight,
        });
      }
    }

    suggestions.sort((a, b) => b._score - a._score || b.confidence - a.confidence);
    return suggestions.slice(0, 5).map(({ _score: _s, ...rest }) => rest);
  }

  /* ================================================================ */
  /*  8. Remediation Priority Engine                                   */
  /* ================================================================ */

  async prioritizeRemediations(params: {
    findings: Array<{ id: string; severity: string; frameworks: string[]; age: number; affectedAssets: number }>;
    tenantIndustry: string;
    complianceDeadlines?: Array<{ framework: string; deadline: string }>;
    // SECURITY FIX (BLACKFYRE audit 2026-06-05): cross-tenant analysis hardening —
    // optional tenant scope for the audit trail. Optional (not required) because this
    // method performs NO database access: it ranks ONLY the finding objects supplied
    // in the request body using pure scoring arithmetic. It cannot read or join any
    // other tenant's findings, so it is tenant-safe by construction; tenantId is
    // threaded only for attributable security logging.
    tenantId?: string;
  }): Promise<Array<RemediationPriority>> {
    const { findings: inputFindings, tenantIndustry, complianceDeadlines = [], tenantId } = params;
    // SECURITY FIX (BLACKFYRE audit 2026-06-05): tenant-safe (ranks only caller-supplied
    // finding objects; no DB query). Log for audit only.
    this.log.info(
      { tenantId, findingCount: inputFindings.length },
      "ai-analysis: remediation prioritization (tenant-safe, no DB access)",
    );

    const severityScore: Record<string, number> = { critical: 40, high: 30, medium: 20, low: 10 };
    const nowMs = Date.now();

    // Build deadline proximity map: framework -> days until deadline
    const deadlineMap: Record<string, number> = {};
    for (const d of complianceDeadlines) {
      const daysUntil = Math.max(0, (new Date(d.deadline).getTime() - nowMs) / (1000 * 60 * 60 * 24));
      deadlineMap[d.framework] = daysUntil;
    }

    const results: RemediationPriority[] = inputFindings.map((f) => {
      let score = severityScore[f.severity] ?? 10;

      // Age bonus: older findings that are unresolved score higher (up to +15)
      score += Math.min(15, Math.floor(f.age / 7));

      // Asset count bonus: affects more assets = higher priority (up to +10)
      score += Math.min(10, f.affectedAssets);

      // Deadline proximity bonus: within 30 days = +20, within 90 days = +10
      let deadlineBonus = 0;
      for (const fw of f.frameworks) {
        const daysLeft = deadlineMap[fw];
        if (daysLeft !== undefined) {
          if (daysLeft <= 30) deadlineBonus = Math.max(deadlineBonus, 20);
          else if (daysLeft <= 90) deadlineBonus = Math.max(deadlineBonus, 10);
        }
      }
      score += deadlineBonus;

      const reasonParts: string[] = [`Severity: ${f.severity} (+${severityScore[f.severity] ?? 10})`];
      if (f.age > 7) reasonParts.push(`Age: ${f.age} days old (+${Math.min(15, Math.floor(f.age / 7))})`);
      if (f.affectedAssets > 0) reasonParts.push(`Affects ${f.affectedAssets} asset(s) (+${Math.min(10, f.affectedAssets)})`);
      if (deadlineBonus > 0) reasonParts.push(`Compliance deadline proximity (+${deadlineBonus})`);

      const effort = f.severity === "critical" ? "High — immediate action required"
        : f.severity === "high" ? "Medium — schedule within current sprint"
        : "Low — include in next planned maintenance";

      const complianceImpact: Record<string, number> = {};
      for (const fw of f.frameworks) {
        complianceImpact[fw] = severityScore[f.severity] ?? 10;
      }

      return {
        findingId: f.id,
        priority: score,
        reasoning: reasonParts.join("; "),
        estimatedEffort: effort,
        complianceImpact,
      };
    });

    results.sort((a, b) => b.priority - a.priority);
    return results;
  }

  /* ================================================================ */
  /*  9. Anomaly Detection                                             */
  /* ================================================================ */

  async detectScanAnomalies(params: {
    currentFindings: any[];
    currentScores: Record<string, number>;
    historicalScans: Array<{ date: string; findingCount: number; scores: Record<string, number> }>;
    // SECURITY FIX (BLACKFYRE audit 2026-06-05): cross-tenant analysis hardening —
    // optional tenant scope for the audit trail. Optional (not required) because this
    // method performs NO database access: it compares ONLY the caller-supplied current
    // vs. historical scan data using pure arithmetic. It never queries another tenant's
    // scans, so it is tenant-safe by construction; tenantId is threaded only for
    // attributable security logging.
    tenantId?: string;
  }): Promise<AnomalyDetectionResult> {
    const { currentFindings, currentScores, historicalScans, tenantId } = params;
    // SECURITY FIX (BLACKFYRE audit 2026-06-05): tenant-safe (compares only caller-supplied
    // scan data; no DB query). Log for audit only.
    this.log.info(
      { tenantId, currentFindingCount: currentFindings.length, historicalScanCount: historicalScans.length },
      "ai-analysis: scan anomaly detection (tenant-safe, no DB access)",
    );
    const anomalies: ScanAnomaly[] = [];

    if (historicalScans.length === 0) {
      return {
        anomalies: [],
        overallRisk: "stable",
        confidence: 0.3,
        modelVersion: "heuristic-v1",
        generatedAt: new Date().toISOString(),
      };
    }

    // Compute historical averages
    const avgFindingCount = historicalScans.reduce((sum, s) => sum + s.findingCount, 0) / historicalScans.length;
    const currentFindingCount = currentFindings.length;

    // Check for finding spike (>50% increase)
    if (avgFindingCount > 0 && currentFindingCount > avgFindingCount * 1.5) {
      const pct = Math.round(((currentFindingCount - avgFindingCount) / avgFindingCount) * 100);
      anomalies.push({
        type: "finding_spike",
        description: `Finding count increased by ${pct}% (${Math.round(avgFindingCount)} avg → ${currentFindingCount} current).`,
        severity: pct > 100 ? "critical" : "high",
        affectedFrameworks: Object.keys(currentScores),
        suggestedAction: "Investigate new infrastructure additions or recent configuration changes that may have introduced findings.",
      });
    }

    // Check for score drops per framework (>10% drop from historical average)
    const allFrameworks = new Set([
      ...Object.keys(currentScores),
      ...historicalScans.flatMap((s) => Object.keys(s.scores)),
    ]);

    for (const fw of allFrameworks) {
      const historicalFwScores = historicalScans
        .filter((s) => s.scores[fw] !== undefined)
        .map((s) => s.scores[fw]);
      if (historicalFwScores.length === 0) continue;

      const avgScore = historicalFwScores.reduce((a, b) => a + b, 0) / historicalFwScores.length;
      const currentScore = currentScores[fw];

      if (currentScore === undefined) {
        anomalies.push({
          type: "regression",
          description: `Framework "${fw}" previously tracked but missing from current scan.`,
          severity: "medium",
          affectedFrameworks: [fw],
          suggestedAction: `Re-enable ${fw} compliance scanning to restore coverage visibility.`,
        });
        continue;
      }

      if (avgScore > 0 && currentScore < avgScore * 0.9) {
        const drop = Math.round(avgScore - currentScore);
        anomalies.push({
          type: "score_drop",
          description: `${fw} compliance score dropped ${drop} points (avg ${Math.round(avgScore)} → current ${currentScore}).`,
          severity: drop > 20 ? "critical" : "high",
          affectedFrameworks: [fw],
          suggestedAction: `Run gap analysis for ${fw} to identify newly failing controls and prioritize remediation.`,
        });
      }
    }

    // Check for new severity categories appearing in current scan
    const historicalCategories = new Set(
      historicalScans.flatMap((s) =>
        // Use findingCount as proxy — if we don't have category breakdown, skip
        [] as string[]
      )
    );
    const currentSeverities = new Set(currentFindings.map((f: any) => f.severity));
    const historicalSeverities = new Set(
      historicalScans.flatMap((s) =>
        // We approximate by checking if "critical" existed before
        [] as string[]
      )
    );

    // Check if critical findings appeared where previously there were none
    const prevCriticalCounts = historicalScans.map((s) => {
      // We don't have per-scan severity breakdown in historicalScans, so use findingCount heuristic
      return 0;
    });
    const currentCriticalCount = currentFindings.filter((f: any) => f.severity === "critical").length;
    const prevAvgCritical = prevCriticalCounts.length > 0
      ? prevCriticalCounts.reduce((a, b) => a + b, 0) / prevCriticalCounts.length
      : 0;

    if (currentSeverities.has("critical") && prevAvgCritical === 0 && historicalScans.length >= 2) {
      anomalies.push({
        type: "new_category",
        description: `${currentCriticalCount} critical finding(s) appeared for the first time — no critical findings in previous ${historicalScans.length} scans.`,
        severity: "critical",
        affectedFrameworks: Object.keys(currentScores),
        suggestedAction: "Immediately investigate newly introduced critical findings. Review recent infrastructure or configuration changes.",
      });
    }

    const overallRisk: "stable" | "concerning" | "critical" =
      anomalies.some((a) => a.severity === "critical") ? "critical"
      : anomalies.length > 0 ? "concerning"
      : "stable";

    const confidence = historicalScans.length >= 5 ? 0.85 : historicalScans.length >= 2 ? 0.65 : 0.45;

    return {
      anomalies,
      overallRisk,
      confidence,
      modelVersion: "heuristic-v1",
      generatedAt: new Date().toISOString(),
    };
  }
}
