import type { FastifyPluginAsync } from "fastify";
import { eq, and, sql, count } from "drizzle-orm";
import { findings, controlMappings, evidence } from "../db/schema.js";
import { listFindingsQuerySchema, updateFindingStatusSchema } from "@blackfyre/shared";
import { notFound } from "../utils/errors.js";
import { requireUUID } from "../utils/security-fixes.js";
import { RemediationService } from "../services/remediation-service.js";
import { ComplianceService } from "../services/compliance-service.js";

export const findingRoutes: FastifyPluginAsync = async (app) => {
  // Findings are tenant-scoped — any authenticated user can read
  const authenticated = (app as any).requireRole("owner", "admin", "engineer", "viewer");
  const canUpdate = (app as any).requireRole("owner", "admin", "engineer");

  // GET /api/findings
  app.get("/api/findings", { preHandler: [authenticated] }, async (request) => {
    const query = listFindingsQuerySchema.parse(request.query);
    // SECURITY FIX (BLACKFYRE audit 2026-06-05): findings tenant isolation —
    // run on the RLS-enforced per-request handle (request.db) rather than the
    // owner pool (app.db), and keep the explicit tenantId predicate as
    // defense-in-depth (postgres-js can hand different connections to queries
    // within a request, so we never rely on RLS alone).
    const db = request.db ?? app.db;
    const conditions = [eq(findings.tenantId, request.tenantId)];

    if (query.scanId) conditions.push(eq(findings.scanId, query.scanId));
    if (query.severity) conditions.push(eq(findings.severity, query.severity));
    if (query.status) conditions.push(eq(findings.status, query.status));
    if (query.category) conditions.push(eq(findings.category, query.category));

    // Source filter (custom, prowler, checkov, semgrep, bandit)
    const source = (request.query as Record<string, string>).source;
    const validSources = ["custom", "prowler", "checkov", "semgrep", "bandit"];
    if (source && validSources.includes(source)) {
      conditions.push(eq(findings.source, source));
    }

    const where = and(...conditions);
    const offset = (query.page - 1) * query.limit;

    const [rows, [total]] = await Promise.all([
      db
        .select()
        .from(findings)
        .where(where)
        .limit(query.limit)
        .offset(offset)
        .orderBy(findings.severity),
      db
        .select({ count: count() })
        .from(findings)
        .where(where),
    ]);

    return {
      findings: rows,
      pagination: {
        limit: query.limit,
        offset,
        total: total.count,
      },
    };
  });

  // GET /api/findings/summary — must be before /:id to avoid route conflict
  app.get("/api/findings/summary", { preHandler: [authenticated] }, async (request) => {
    // SECURITY FIX (BLACKFYRE audit 2026-06-05): findings/summary cross-tenant
    // aggregation — this handler previously relied solely on the (inert) RLS
    // and would count EVERY tenant's findings. Add an explicit tenantId
    // predicate to both aggregates and run on the RLS-enforced request.db so a
    // caller can only ever see their own tenant's counts.
    const db = request.db ?? app.db;
    const [bySeverity, byStatus] = await Promise.all([
      db
        .select({
          severity: findings.severity,
          count: count(),
        })
        .from(findings)
        .where(eq(findings.tenantId, request.tenantId))
        .groupBy(findings.severity),
      db
        .select({
          status: findings.status,
          count: count(),
        })
        .from(findings)
        .where(eq(findings.tenantId, request.tenantId))
        .groupBy(findings.status),
    ]);

    return { bySeverity, byStatus };
  });

  // GET /api/findings/:id
  app.get<{ Params: { id: string } }>("/api/findings/:id", {
    preHandler: [authenticated],
  }, async (request) => {
    requireUUID(request.params.id);
    // SECURITY FIX (BLACKFYRE audit 2026-06-05): findings IDOR — fetch on the
    // RLS-enforced request.db with an explicit tenantId predicate; a finding id
    // owned by another tenant resolves to nothing and returns 404 (no leak).
    const db = request.db ?? app.db;
    const [finding] = await db
      .select()
      .from(findings)
      .where(and(eq(findings.id, request.params.id), eq(findings.tenantId, request.tenantId)))
      .limit(1);

    if (!finding) {
      request.log.warn(
        { event: "findings.access.denied", findingId: request.params.id, tenantId: request.tenantId },
        "Finding lookup returned no row for caller's tenant (not found or cross-tenant)",
      );
      throw notFound("Finding");
    }

    // controlMappings is reachable only via finding.id, which we have already
    // confirmed belongs to this tenant, so this follow-up read stays in-tenant.
    const mappings = await db
      .select()
      .from(controlMappings)
      .where(eq(controlMappings.findingId, finding.id));

    return { finding, controlMappings: mappings };
  });

  // PATCH /api/findings/:id/status
  app.patch<{ Params: { id: string } }>("/api/findings/:id/status", {
    preHandler: [canUpdate],
  }, async (request) => {
    requireUUID(request.params.id);
    const body = updateFindingStatusSchema.parse(request.body);

    // SECURITY FIX (BLACKFYRE audit 2026-06-05): findings status-write IDOR —
    // update on the RLS-enforced request.db with an explicit tenantId predicate
    // so a cross-tenant id matches no row, returning 404 instead of mutating
    // another tenant's finding.
    const [updated] = await (request.db ?? app.db)
      .update(findings)
      .set({ status: body.status })
      .where(and(eq(findings.id, request.params.id), eq(findings.tenantId, request.tenantId)))
      .returning();

    if (!updated) {
      request.log.warn(
        { event: "findings.update.denied", findingId: request.params.id, tenantId: request.tenantId },
        "Finding status update matched no row for caller's tenant (not found or cross-tenant)",
      );
      throw notFound("Finding");
    }
    return { finding: updated };
  });

  // PATCH /api/findings/:id — update status (spec Section 8 uses this path) (GAP-018)
  app.patch<{ Params: { id: string } }>("/api/findings/:id", {
    preHandler: [canUpdate],
  }, async (request) => {
    requireUUID(request.params.id);
    const body = updateFindingStatusSchema.parse(request.body);

    // SECURITY FIX (BLACKFYRE audit 2026-06-05): findings status-write IDOR —
    // update on the RLS-enforced request.db with an explicit tenantId predicate
    // so a cross-tenant id matches no row, returning 404 instead of mutating
    // another tenant's finding.
    const [updated] = await (request.db ?? app.db)
      .update(findings)
      .set({ status: body.status })
      .where(and(eq(findings.id, request.params.id), eq(findings.tenantId, request.tenantId)))
      .returning();

    if (!updated) {
      request.log.warn(
        { event: "findings.update.denied", findingId: request.params.id, tenantId: request.tenantId },
        "Finding status update matched no row for caller's tenant (not found or cross-tenant)",
      );
      throw notFound("Finding");
    }
    return { finding: updated };
  });

  // GET /api/findings/:id/evidence — evidence attached to a finding (GAP-018)
  app.get<{ Params: { id: string } }>("/api/findings/:id/evidence", {
    preHandler: [authenticated],
  }, async (request) => {
    requireUUID(request.params.id);
    // SECURITY FIX (BLACKFYRE audit 2026-06-05): findings/:id/evidence
    // cross-tenant read — this handler filtered ONLY by findingId and relied on
    // the (inert) RLS, so any caller could read another tenant's evidence by
    // guessing a finding id. First confirm the parent finding belongs to this
    // tenant (404 + denial log otherwise), then scope the evidence query by
    // tenantId too, all on the RLS-enforced request.db.
    const db = request.db ?? app.db;
    const [finding] = await db
      .select({ id: findings.id })
      .from(findings)
      .where(and(eq(findings.id, request.params.id), eq(findings.tenantId, request.tenantId)))
      .limit(1);

    if (!finding) {
      request.log.warn(
        { event: "findings.evidence.denied", findingId: request.params.id, tenantId: request.tenantId },
        "Evidence requested for finding not in caller's tenant (not found or cross-tenant)",
      );
      throw notFound("Finding");
    }

    const rows = await db
      .select()
      .from(evidence)
      .where(and(eq(evidence.findingId, request.params.id), eq(evidence.tenantId, request.tenantId)));

    return { evidence: rows };
  });

  // GET /api/findings/:id/cross-framework-impact — which frameworks/controls a
  // finding affects (GAP-002).
  // REAL IMPL (BLACKFYRE 2026-06): the finding's dedup_hash already links it across
  // frameworks. We resolve finding -> its control_mappings -> the set of affected
  // frameworks (direct), then expand each mapped control to the equivalent controls
  // it also breaks in OTHER frameworks via the real cross-mapping matrix, and return
  // the sibling findings sharing the same dedup_hash. Tenant-scoped: we first confirm
  // the finding belongs to the caller's tenant (404 + denial log otherwise) and run
  // every query on the RLS-enforced request.db.
  app.get<{ Params: { id: string } }>("/api/findings/:id/cross-framework-impact", {
    preHandler: [authenticated],
  }, async (request) => {
    requireUUID(request.params.id);
    const db = request.db ?? app.db;

    // Confirm the finding is in the caller's tenant before doing any impact work,
    // so a cross-tenant id returns 404 (not a leak) and is logged as a denial.
    const [finding] = await db
      .select({ id: findings.id })
      .from(findings)
      .where(and(eq(findings.id, request.params.id), eq(findings.tenantId, request.tenantId)))
      .limit(1);

    if (!finding) {
      request.log.warn(
        { event: "findings.cross_framework.denied", findingId: request.params.id, tenantId: request.tenantId },
        "Cross-framework impact requested for finding not in caller's tenant (not found or cross-tenant)",
      );
      throw notFound("Finding");
    }

    const service = new ComplianceService(db);
    const impact = await service.getCrossFrameworkImpact(request.tenantId, finding.id);

    request.log.info(
      {
        event: "findings.cross_framework.resolved",
        findingId: finding.id,
        tenantId: request.tenantId,
        frameworksAffected: impact.totalFrameworksAffected,
        linkedFindings: impact.linkedFindingIds.length,
      },
      "Resolved cross-framework impact for finding",
    );

    return { impact };
  });

  // POST /api/findings/:id/fix — trigger auto-fix or request approval (GAP-018)
  app.post<{ Params: { id: string } }>("/api/findings/:id/fix", {
    preHandler: [canUpdate],
  }, async (request) => {
    requireUUID(request.params.id);
    // SECURITY FIX (BLACKFYRE audit 2026-06-05): findings/:id/fix cross-tenant
    // write — the lookup previously filtered ONLY by findingId, so a caller
    // could queue a remediation against another tenant's finding. Add the
    // explicit tenantId predicate (404 + denial log on cross-tenant) and run
    // both the read and the RemediationService writes on the RLS-enforced
    // request.db.
    const db = request.db ?? app.db;
    const [finding] = await db
      .select()
      .from(findings)
      .where(and(eq(findings.id, request.params.id), eq(findings.tenantId, request.tenantId)))
      .limit(1);

    if (!finding) {
      request.log.warn(
        { event: "findings.fix.denied", findingId: request.params.id, tenantId: request.tenantId },
        "Auto-fix requested for finding not in caller's tenant (not found or cross-tenant)",
      );
      throw notFound("Finding");
    }

    const service = new RemediationService(db);
    const remediation = await service.create(request.tenantId, {
      findingId: finding.id,
      tier: finding.remediationTier,
    });

    return {
      remediation,
      message: finding.remediationTier === "auto"
        ? "Auto-fix queued for execution."
        : `Remediation created (tier: ${finding.remediationTier}). Approval may be required.`,
    };
  });
};
