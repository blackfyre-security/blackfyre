import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
// SECURITY FIX (BLACKFYRE audit 2026-06-05): import CrossTenantAccessError so the
// scan/finding-scoped handlers can catch cross-tenant denials and return a 404
// (notFound) instead of letting the error bubble to a 500 — a 500 vs 404 difference
// would leak whether a foreign-tenant scanId/findingId exists (existence oracle).
import { AiAnalysisService, CrossTenantAccessError } from "../services/ai-analysis-service.js";
import { notFound } from "../utils/errors.js";
import { describeLlmProvider } from "../services/llm/client.js";

export const aiRoutes: FastifyPluginAsync = async (app) => {
  const adminOrEngineer = (app as any).requireRole("owner", "admin", "engineer");
  const planGuard = app.requirePlan("Protect");

  // POST /api/ai/gap-analysis — LLM-powered compliance gap analysis
  app.post<{ Body: { scanId: string; framework: string } }>("/api/ai/gap-analysis", {
    preHandler: [adminOrEngineer, planGuard],
  }, async (request) => {
    const { scanId, framework } = request.body as { scanId: string; framework: string };
    // SECURITY FIX (BLACKFYRE audit 2026-06-05): pass the pino logger so cross-tenant
    // denials are structured-logged by the service (queryable security events).
    const service = new AiAnalysisService(app.db, request.server.log);
    // SECURITY FIX (BLACKFYRE audit 2026-06-05): pass caller's tenantId so the service's
    // assertScanOwnership() scopes the scan to this tenant (prevents cross-tenant scan analysis).
    try {
      return await service.gapAnalysis(scanId, framework, request.tenantId);
    } catch (err) {
      // SECURITY FIX (BLACKFYRE audit 2026-06-05): map cross-tenant denial to 404 so the
      // response is indistinguishable from "scan does not exist" (no existence oracle).
      if (err instanceof CrossTenantAccessError) {
        request.server.log.warn(
          { scanId, tenantId: request.tenantId, route: "gap-analysis" },
          "ai-analysis route: cross-tenant scan access denied — returning 404",
        );
        throw notFound("Scan");
      }
      throw err;
    }
  });

  // POST /api/ai/mitre-mapping — Map findings to MITRE ATT&CK framework
  app.post<{ Body: { scanId: string } }>("/api/ai/mitre-mapping", {
    preHandler: [adminOrEngineer, planGuard],
  }, async (request) => {
    const { scanId } = request.body as { scanId: string };
    // SECURITY FIX (BLACKFYRE audit 2026-06-05): pass the pino logger for structured denials.
    const service = new AiAnalysisService(app.db, request.server.log);
    // SECURITY FIX (BLACKFYRE audit 2026-06-05): scope scan to caller's tenant.
    try {
      const mappings = await service.mitreMapping(scanId, request.tenantId);
      return { scanId, mappings, count: mappings.length };
    } catch (err) {
      // SECURITY FIX (BLACKFYRE audit 2026-06-05): cross-tenant denial -> 404 (no existence oracle).
      if (err instanceof CrossTenantAccessError) {
        request.server.log.warn(
          { scanId, tenantId: request.tenantId, route: "mitre-mapping" },
          "ai-analysis route: cross-tenant scan access denied — returning 404",
        );
        throw notFound("Scan");
      }
      throw err;
    }
  });

  // POST /api/ai/risk-assessment — Business-context risk scoring
  app.post<{ Body: { industry?: string } }>("/api/ai/risk-assessment", {
    preHandler: [adminOrEngineer, planGuard],
  }, async (request) => {
    const { industry } = (request.body ?? {}) as { industry?: string };
    // SECURITY FIX (BLACKFYRE audit 2026-06-05): pass the pino logger so any service-side
    // security events are structured-logged. riskAssessment is already tenant-scoped by
    // request.tenantId (queries findings WHERE tenantId) so no cross-tenant catch is needed.
    const service = new AiAnalysisService(app.db, request.server.log);
    return service.riskAssessment(request.tenantId, industry);
  });

  // POST /api/ai/remediation/:findingId — AI remediation for a finding
  app.post<{ Params: { findingId: string } }>("/api/ai/remediation/:findingId", {
    preHandler: [adminOrEngineer, planGuard],
  }, async (request) => {
    const { findingId } = request.params;
    // SECURITY FIX (BLACKFYRE audit 2026-06-05): pass the pino logger for structured denials.
    const service = new AiAnalysisService(app.db, request.server.log);
    // SECURITY FIX (BLACKFYRE audit 2026-06-05): scope finding to caller's tenant.
    try {
      return await service.remediationRecommendation(findingId, request.tenantId);
    } catch (err) {
      // SECURITY FIX (BLACKFYRE audit 2026-06-05): cross-tenant finding denial -> 404
      // so a foreign-tenant findingId is indistinguishable from a non-existent one.
      if (err instanceof CrossTenantAccessError) {
        request.server.log.warn(
          { findingId, tenantId: request.tenantId, route: "remediation" },
          "ai-analysis route: cross-tenant finding access denied — returning 404",
        );
        throw notFound("Finding");
      }
      throw err;
    }
  });

  // POST /api/ai/executive-summary — Board-ready security summary
  app.post<{ Body: { scanId: string } }>("/api/ai/executive-summary", {
    preHandler: [adminOrEngineer, planGuard],
  }, async (request) => {
    const { scanId } = request.body as { scanId: string };
    // SECURITY FIX (BLACKFYRE audit 2026-06-05): pass the pino logger for structured denials.
    const service = new AiAnalysisService(app.db, request.server.log);
    // SECURITY FIX (BLACKFYRE audit 2026-06-05): scope scan to caller's tenant.
    try {
      return await service.executiveSummary(scanId, request.tenantId);
    } catch (err) {
      // SECURITY FIX (BLACKFYRE audit 2026-06-05): cross-tenant scan denial -> 404 (no existence oracle).
      if (err instanceof CrossTenantAccessError) {
        request.server.log.warn(
          { scanId, tenantId: request.tenantId, route: "executive-summary" },
          "ai-analysis route: cross-tenant scan access denied — returning 404",
        );
        throw notFound("Scan");
      }
      throw err;
    }
  });

  // GET /api/ai/capabilities — List AI analysis capabilities and status
  app.get("/api/ai/capabilities", {
    preHandler: [adminOrEngineer, planGuard],
  }, async () => {
    const { provider, modelId } = describeLlmProvider();
    return {
      mode: "llm",
      provider,
      model: modelId,
      capabilities: [
        { name: "gap_analysis", description: "Compliance gap analysis against frameworks", available: true },
        { name: "mitre_mapping", description: "MITRE ATT&CK technique mapping", available: true },
        { name: "risk_assessment", description: "Business-context risk scoring", available: true },
        { name: "remediation", description: "AI-powered remediation recommendations", available: true },
        { name: "executive_summary", description: "Board-ready security summaries", available: true },
        { name: "predict_compliance", description: "Compliance score trajectory prediction", available: true },
        { name: "suggest_mappings", description: "Control mapping suggestions for findings", available: true },
        { name: "prioritize_remediations", description: "Remediation priority scoring engine", available: true },
        { name: "detect_anomalies", description: "Scan anomaly detection across historical data", available: true },
      ],
    };
  });

  // ----------------------------------------------------------------
  // POST /api/ai/predict-compliance — Compliance trajectory prediction
  // ----------------------------------------------------------------

  const predictComplianceSchema = z.object({
    framework: z.string().min(1),
    currentScore: z.number().min(0).max(100),
    historicalScores: z.array(z.object({ date: z.string(), score: z.number() })),
    openFindings: z.number().int().min(0),
    remediationRate: z.number().min(0),
  });

  app.post("/api/ai/predict-compliance", {
    preHandler: [adminOrEngineer, planGuard],
  }, async (request) => {
    const body = predictComplianceSchema.parse(request.body);
    // SECURITY FIX (BLACKFYRE audit 2026-06-05): pass the pino logger so the service can
    // structured-log usage/denials. tenantId is already threaded into the call below.
    const service = new AiAnalysisService(app.db, request.server.log);
    return service.predictComplianceTrajectory({
      tenantId: request.tenantId,
      ...body,
    });
  });

  // ----------------------------------------------------------------
  // POST /api/ai/suggest-mappings — Control mapping suggestions
  // ----------------------------------------------------------------

  const suggestMappingsSchema = z.object({
    finding: z.object({
      title: z.string().min(1),
      description: z.string(),
      severity: z.string(),
      category: z.string(),
    }),
    frameworks: z.array(z.string()).min(1),
  });

  app.post("/api/ai/suggest-mappings", {
    preHandler: [adminOrEngineer, planGuard],
  }, async (request) => {
    const body = suggestMappingsSchema.parse(request.body);
    // SECURITY FIX (BLACKFYRE audit 2026-06-05): pass the pino logger for structured audit.
    const service = new AiAnalysisService(app.db, request.server.log);
    // SECURITY FIX (BLACKFYRE audit 2026-06-05): defense-in-depth — thread caller's tenantId
    // so the (DB-free, tenant-safe) suggestion call is attributable in security logs.
    const suggestions = await service.suggestControlMappings({ ...body, tenantId: request.tenantId });
    return { suggestions, count: suggestions.length };
  });

  // ----------------------------------------------------------------
  // POST /api/ai/prioritize — Remediation priority engine
  // ----------------------------------------------------------------

  const prioritizeSchema = z.object({
    findings: z.array(z.object({
      id: z.string(),
      severity: z.string(),
      frameworks: z.array(z.string()),
      age: z.number().int().min(0),
      affectedAssets: z.number().int().min(0),
    })).min(1),
    tenantIndustry: z.string(),
    complianceDeadlines: z.array(z.object({
      framework: z.string(),
      deadline: z.string(),
    })).optional(),
  });

  app.post("/api/ai/prioritize", {
    preHandler: [adminOrEngineer, planGuard],
  }, async (request) => {
    const body = prioritizeSchema.parse(request.body);
    // SECURITY FIX (BLACKFYRE audit 2026-06-05): pass the pino logger for structured audit.
    const service = new AiAnalysisService(app.db, request.server.log);
    // SECURITY FIX (BLACKFYRE audit 2026-06-05): defense-in-depth — thread caller's tenantId
    // so the (DB-free, tenant-safe) prioritization call is attributable in security logs.
    return service.prioritizeRemediations({ ...body, tenantId: request.tenantId });
  });

  // ----------------------------------------------------------------
  // POST /api/ai/detect-anomalies — Scan anomaly detection
  // ----------------------------------------------------------------

  const detectAnomaliesSchema = z.object({
    currentFindings: z.array(z.any()),
    currentScores: z.record(z.string(), z.number()),
    historicalScans: z.array(z.object({
      date: z.string(),
      findingCount: z.number().int().min(0),
      scores: z.record(z.string(), z.number()),
    })),
  });

  app.post("/api/ai/detect-anomalies", {
    preHandler: [adminOrEngineer, planGuard],
  }, async (request) => {
    const body = detectAnomaliesSchema.parse(request.body);
    // SECURITY FIX (BLACKFYRE audit 2026-06-05): pass the pino logger for structured audit.
    const service = new AiAnalysisService(app.db, request.server.log);
    // SECURITY FIX (BLACKFYRE audit 2026-06-05): defense-in-depth — thread caller's tenantId
    // so the (DB-free, tenant-safe) anomaly-detection call is attributable in security logs.
    return service.detectScanAnomalies({ ...body, tenantId: request.tenantId });
  });

  // ----------------------------------------------------------------
  // GET /api/ai/model-info — Model metadata
  // ----------------------------------------------------------------

  app.get("/api/ai/model-info", {
    preHandler: [adminOrEngineer, planGuard],
  }, async () => {
    const { provider, modelId } = describeLlmProvider();
    return {
      model: modelId,
      version: provider === "anthropic" ? "claude-sonnet-4" : "claude-sonnet-4-bedrock",
      mode: "llm",
      provider,
      capabilities: [
        "gap_analysis",
        "mitre_mapping",
        "risk_assessment",
        "remediation",
        "executive_summary",
        "predict_compliance",
        "suggest_mappings",
        "prioritize_remediations",
        "detect_anomalies",
      ],
    };
  });
};
