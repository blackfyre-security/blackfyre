import type { FastifyPluginAsync } from "fastify";
import { ComplianceService } from "../services/compliance-service.js";
import {
  complianceScoresQuerySchema,
  complianceMatrixParamsSchema,
  complianceTrendQuerySchema,
  complianceDiffQuerySchema,
  auditReadyBodySchema,
} from "@blackfyre/shared";
import { tenants } from "../db/schema.js";
import { eq } from "drizzle-orm";

export const complianceRoutes: FastifyPluginAsync = async (app) => {
  const authenticated = (app as any).requireRole("owner", "admin", "engineer", "viewer");
  const adminOrEngineer = (app as any).requireRole("owner", "admin", "engineer");

  // GET /api/compliance/scores
  app.get("/api/compliance/scores", { preHandler: [authenticated] }, async (request) => {
    const query = complianceScoresQuerySchema.parse(request.query);
    // SECURITY FIX (BLACKFYRE audit 2026-06-05): drive the service with the
    // RLS-bound request.db (was app.db, which bypasses RLS). This route runs
    // behind requireRole so request.db is set; app.db is only a fallback. The
    // service already filters by request.tenantId (explicit defense-in-depth).
    const service = new ComplianceService(request.db ?? app.db);
    const scores = await service.getScores(request.tenantId, query.scanId);
    return { scores };
  });

  // GET /api/compliance/matrix/:framework
  app.get<{ Params: { framework: string } }>("/api/compliance/matrix/:framework", {
    preHandler: [authenticated],
  }, async (request) => {
    const params = complianceMatrixParamsSchema.parse(request.params);
    // SECURITY FIX (BLACKFYRE audit 2026-06-05): use the RLS-bound request.db
    // (was app.db). Service filters by request.tenantId (defense-in-depth).
    const service = new ComplianceService(request.db ?? app.db);
    const matrix = await service.getMatrix(request.tenantId, params.framework);
    return { matrix };
  });

  // GET /api/compliance/trend
  app.get("/api/compliance/trend", { preHandler: [authenticated] }, async (request) => {
    const query = complianceTrendQuerySchema.parse(request.query);
    // SECURITY FIX (BLACKFYRE audit 2026-06-05): use the RLS-bound request.db
    // (was app.db). Service filters by request.tenantId (defense-in-depth).
    const service = new ComplianceService(request.db ?? app.db);
    const trend = await service.getTrend(request.tenantId, query.framework, query.limit);
    return { trend };
  });

  // GET /api/compliance/diff
  app.get("/api/compliance/diff", { preHandler: [authenticated] }, async (request) => {
    const query = complianceDiffQuerySchema.parse(request.query);
    // SECURITY FIX (BLACKFYRE audit 2026-06-05): pass the RLS-bound request.db for
    // consistency (was app.db). getFrameworkDiff is a static framework computation
    // and is not tenant-scoped, but we keep no app.db handle in authenticated paths.
    const service = new ComplianceService(request.db ?? app.db);
    const diff = service.getFrameworkDiff(query.framework, query.from, query.to);
    return { diff };
  });

  // POST /api/compliance/audit-ready
  app.post("/api/compliance/audit-ready", { preHandler: [adminOrEngineer] }, async (request) => {
    const body = auditReadyBodySchema.parse(request.body);
    const tenantId = request.tenantId;

    // SECURITY FIX (BLACKFYRE audit 2026-06-05): update the tenant row on the
    // RLS-bound request.db (was app.db, which bypasses RLS). The explicit
    // tenants.id == request.tenantId predicate is the defense-in-depth tenant
    // scope; RLS further guarantees this can only ever touch the caller's tenant.
    const db = request.db ?? app.db;
    const [updated] = await db
      .update(tenants)
      .set({
        onboardingStatus: body.enabled ? "active" : "configuring",
        updatedAt: new Date(),
      })
      .where(eq(tenants.id, tenantId))
      .returning();

    if (!updated) {
      // SECURITY FIX (BLACKFYRE audit 2026-06-05): a no-op update here is
      // anomalous (the caller's own tenant row should always exist under RLS) —
      // log at warn for investigation. No secrets/PII logged.
      request.log.warn(
        { event: "compliance.audit_ready.no_op", tenantId },
        "Audit-ready toggle matched no tenant row under RLS context",
      );
    }

    return {
      auditReady: body.enabled,
      tenant: updated,
      message: body.enabled
        ? "Audit-ready mode enabled. Evidence collection will prioritize auditor-expected formats."
        : "Audit-ready mode disabled. Returning to standard scanning mode.",
    };
  });

  // GET /api/compliance/frameworks
  app.get("/api/compliance/frameworks", { preHandler: [authenticated] }, async () => {
    const service = new ComplianceService(null as any);
    const frameworks = service.getAvailableFrameworks();
    return {
      frameworks: frameworks.map((f) => ({
        framework: f.framework,
        version: f.version,
        totalControls: f.totalControls,
      })),
    };
  });

  // GET /api/compliance/industry-profiles
  app.get("/api/compliance/industry-profiles", { preHandler: [authenticated] }, async () => {
    const service = new ComplianceService(null as any);
    return { profiles: service.getAllProfiles() };
  });
};
