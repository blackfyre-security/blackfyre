import type { FastifyPluginAsync } from "fastify";
import { eq, and, sql, count, desc, gte, lte, like, or } from "drizzle-orm";
import { z } from "zod";
import {
  tenants,
  users,
  scans,
  findings,
  auditLogs,
  complianceScores,
  tenantFeatures,
  evidence,
} from "../db/schema.js";
import type { Db } from "../db/connection.js";
import { badRequest, notFound, conflict } from "../utils/errors.js";
import { requireUUID, escapeLike } from "../utils/security-fixes.js";
import { hashPassword } from "../utils/password.js";
// REAL IMPL (BLACKFYRE 2026-06): pricing single-source-of-truth. Admin previously kept its own
// PLAN_PRICES (25k/75k/150k) which disagreed with the canonical marketing prices and made MRR
// wrong. Import the canonical per-plan tables from @blackfyre/shared instead.
import { PLAN_PRICE_INR, PLAN_PRICE_INR_PAISE, type PlanId } from "@blackfyre/shared";
import { AuditLogger } from "../services/audit-logger.js";
import { ProvisioningService } from "../services/provisioning-service.js";
import { TenantFeaturesService } from "../services/tenant-features-service.js";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// --- Zod validation schemas ---

const auditLogQuerySchema = z.object({
  userId: z.string().uuid().optional(),
  action: z.string().optional(),
  tenantId: z.string().uuid().optional(),
  resourceType: z.string().optional(),
  startDate: z.string().datetime({ offset: true }).optional(),
  endDate: z.string().datetime({ offset: true }).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

const userListQuerySchema = z.object({
  tenantId: z.string().uuid().optional(),
  role: z.enum(["owner", "admin", "engineer", "viewer", "auditor"]).optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

const createUserSchema = z.object({
  tenantId: z.string().uuid(),
  email: z.string().email().max(320),
  name: z.string().min(1).max(200),
  password: z.string().min(8).max(128),
  role: z.enum(["owner", "admin", "engineer", "viewer"]),
});

const updateUserSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  role: z.enum(["owner", "admin", "engineer", "viewer"]).optional(),
  isPlatformAdmin: z.boolean().optional(),
});

const evidenceAccessSchema = z.object({
  reason: z.string().min(20).max(1000),
});

const leaderboardQuerySchema = z.object({
  framework: z.enum(["soc2", "iso27001", "hipaa", "gdpr", "pcidss"]),
});

const featureOverrideSchema = z.object({
  featureKey: z.string().min(1).max(80),
  enabled: z.boolean(),
  reason: z.string().max(500).optional(),
});

const provisionClientSchema = z.object({
  companyName: z.string().min(1).max(200),
  ownerEmail: z.string().email().max(320),
  ownerName: z.string().min(1).max(200),
  plan: z.enum(["comply", "protect", "defend"]),
  industry: z.string().max(100).optional(),
  customPlanLabel: z.string().max(120).optional(),
  monthlyPriceInr: z.number().int().min(0).optional(),
  featureOverrides: z.array(featureOverrideSchema).optional(),
});

const tenantUpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  plan: z.enum(["comply", "protect", "defend"]).optional(),
  onboardingStatus: z.enum(["pending", "configuring", "scanning", "active", "suspended"]).optional(),
  customPlanLabel: z.string().max(120).nullable().optional(),
  monthlyPriceInr: z.number().int().min(0).nullable().optional(),
  industryProfile: z.enum(["fintech", "healthtech", "saas", "ecommerce", "aitech", "custom", "government"]).optional(),
});

const tenantFeaturesUpdateSchema = z.object({
  overrides: z.array(featureOverrideSchema).min(1),
});

// REAL IMPL (BLACKFYRE 2026-06): platform-settings PATCH body. Every key maps to a typed
// column in platform_settings (migration 038) so an unenforced/typo'd key cannot be smuggled
// in — unknown keys are stripped by the schema. notifications is the channel-enabled toggle
// block (no credentials). All fields optional: PATCH is a partial update.
const notificationsSettingsSchema = z.object({
  emailEnabled: z.boolean().optional(),
  slackEnabled: z.boolean().optional(),
  webhookEnabled: z.boolean().optional(),
});
const platformSettingsUpdateSchema = z.object({
  maintenanceMode: z.boolean().optional(),
  maxScansPerTenant: z.number().int().min(0).max(100000).optional(),
  retentionDays: z.number().int().min(1).max(36500).optional(),
  mfaRequired: z.boolean().optional(),
  sessionTimeout: z.number().int().min(60).max(86400).optional(),
  notifications: notificationsSettingsSchema.optional(),
});

// REAL IMPL (BLACKFYRE 2026-06): shape of a persisted platform_settings row (singleton).
type PlatformSettingsRow = {
  maintenance_mode: boolean;
  max_scans_per_tenant: number;
  retention_days: number;
  mfa_required: boolean;
  session_timeout: number;
  notifications: { emailEnabled?: boolean; slackEnabled?: boolean; webhookEnabled?: boolean };
};

// REAL IMPL (BLACKFYRE 2026-06): read the singleton platform_settings row (id = TRUE), seeding
// it if a fresh DB somehow lacks it. Platform-global table => owner pool (superDb), no RLS;
// parameterized SQL. Returns the typed row so callers map to the stable response shape.
async function readPlatformSettings(superDb: Db): Promise<PlatformSettingsRow> {
  const rows = (await superDb.execute(
    sql`INSERT INTO platform_settings (id) VALUES (TRUE)
        ON CONFLICT (id) DO UPDATE SET id = TRUE
        RETURNING maintenance_mode, max_scans_per_tenant, retention_days,
                  mfa_required, session_timeout, notifications`,
  )) as PlatformSettingsRow[];
  return rows[0];
}

// REAL IMPL (BLACKFYRE 2026-06): map a persisted row to the GET /settings response shape, which
// MUST stay byte-compatible with the previous hardcoded object. smtpConfigured/slackConfigured
// are derived from env (credentials live in env, never in the DB or logs).
function platformSettingsResponse(row: PlatformSettingsRow) {
  return {
    settings: {
      maintenanceMode: row.maintenance_mode,
      maxScansPerTenant: row.max_scans_per_tenant,
      retentionDays: row.retention_days,
      smtpConfigured: !!process.env.SMTP_HOST,
      slackConfigured: !!process.env.SLACK_WEBHOOK_URL,
    },
    frameworks: [] as string[],
    agents: [] as string[],
    notifications: {
      emailEnabled: row.notifications?.emailEnabled ?? false,
      slackEnabled: row.notifications?.slackEnabled ?? false,
      webhookEnabled: row.notifications?.webhookEnabled ?? false,
    },
    security: { mfaRequired: row.mfa_required, sessionTimeout: row.session_timeout, ipWhitelist: [] as string[] },
    platform: { name: "BLACKFYRE", version: "1.0.0", region: process.env.AWS_REGION ?? "ap-south-1" },
  };
}

// REAL IMPL (BLACKFYRE 2026-06): plan pricing now comes from the canonical PLANS table in
// @blackfyre/shared (PLAN_PRICE_INR / PLAN_PRICE_INR_PAISE). The previous local map drifted from
// marketing prices and produced wrong revenue. tenants.plan is the `tenant_plan` enum
// (comply | protect | defend) so only those keys can ever match a real row.
//
// monthlyRevenue / mrr / totalMRR are returned in whole INR (the admin/billing UI renders them
// with formatINR — no /100). mrrCents is derived from the canonical paise figure for the
// integer mrr_cents column / downstream precision.
function planPriceInr(plan: string): number {
  return PLAN_PRICE_INR[plan as PlanId] ?? 0;
}
function planPriceInrPaise(plan: string): number {
  return PLAN_PRICE_INR_PAISE[plan as PlanId] ?? 0;
}

// REAL IMPL (BLACKFYRE 2026-06): a tenant's EFFECTIVE monthly price. A tenant on a
// custom contract carries an explicit tenants.monthly_price_inr override (set by
// admin/provisioning); when present that is the real, billed amount and MUST win
// over the catalog list price. Otherwise we fall back to the canonical PLANS price
// (PLAN_PRICE_INR in @blackfyre/shared) for the tenant's plan. Returned in whole
// INR; the *Paise helper derives the integer paise figure for tenants.mrr_cents so
// MRR never drifts from the source of truth and is never hardcoded.
function effectiveMonthlyInr(t: { plan: string; monthlyPriceInr: number | null }): number {
  return t.monthlyPriceInr != null && t.monthlyPriceInr >= 0
    ? t.monthlyPriceInr
    : planPriceInr(t.plan);
}
function effectiveMonthlyPaise(t: { plan: string; monthlyPriceInr: number | null }): number {
  return t.monthlyPriceInr != null && t.monthlyPriceInr >= 0
    ? t.monthlyPriceInr * 100
    : planPriceInrPaise(t.plan);
}

export const adminRoutes: FastifyPluginAsync = async (app) => {
  const adminOnly = async (request: any, reply: any) => {
    await (app as any).authenticate(request);
    const userId: string | undefined = request.userId;
    if (!userId) {
      return reply.status(401).send({ error: "Unauthorized" });
    }
    const db = app.superDb;
    const [user] = await db
      .select({ isPlatformAdmin: users.isPlatformAdmin })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!user || user.isPlatformAdmin !== true) {
      return reply.status(403).send({ error: "Forbidden: platform admin access required" });
    }
  };

  // GET /api/admin/stats — Cross-tenant dashboard stats
  app.get("/api/admin/stats", { preHandler: [adminOnly] }, async () => {
    const db = app.superDb;

    const [
      [tenantTotal],
      [tenantActive],
      [userTotal],
      [scanRecent],
      [findingOpen],
      [findingCritical],
      [avgScore],
      planCounts,
    ] = await Promise.all([
      // Total tenant count
      db.select({ count: count() }).from(tenants),
      // Active tenant count
      db.select({ count: count() }).from(tenants).where(eq(tenants.onboardingStatus, "active")),
      // Total user count
      db.select({ count: count() }).from(users),
      // Total scan count (last 30 days)
      db.select({ count: count() }).from(scans).where(
        gte(scans.createdAt, sql`now() - interval '30 days'`),
      ),
      // Total open finding count
      db.select({ count: count() }).from(findings).where(eq(findings.status, "open")),
      // Total critical finding count
      db.select({ count: count() }).from(findings).where(
        and(eq(findings.severity, "critical"), eq(findings.status, "open")),
      ),
      // Average compliance score across all tenants
      db.select({ avg: sql<number>`coalesce(avg(${complianceScores.score}), 0)::int` }).from(complianceScores),
      // Count tenants by plan type
      db.select({ plan: tenants.plan, count: count() }).from(tenants).groupBy(tenants.plan),
    ]);

    // REAL IMPL (BLACKFYRE 2026-06): compute REAL MRR by summing each ACTIVE tenant's
    // EFFECTIVE monthly price — tenants.monthly_price_inr when the tenant is on a custom
    // contract, else the canonical PLANS price for its plan. The previous aggregate
    // multiplied a per-plan list price by a groupBy count, which silently dropped every
    // custom-contract override and counted suspended tenants as paying, overstating MRR.
    // We pull the per-tenant pricing fields for active tenants and reduce. mrrCents stays
    // an integer derived from paise so there is no float drift; mrr is whole INR for the UI.
    const activeRows = await db
      .select({
        plan: tenants.plan,
        monthlyPriceInr: tenants.monthlyPriceInr,
      })
      .from(tenants)
      .where(eq(tenants.onboardingStatus, "active"));

    let mrr = 0;
    let mrrCents = 0;
    for (const row of activeRows) {
      mrr += effectiveMonthlyInr(row);
      mrrCents += effectiveMonthlyPaise(row);
    }
    const activeTenantCount = activeRows.length;
    // ARR = MRR * 12; ARPC (average revenue per client) over active tenants.
    const arr = mrr * 12;
    const arpc = activeTenantCount > 0 ? Math.round(mrr / activeTenantCount) : 0;

    return {
      stats: {
        // Names the admin frontend expects
        totalClients: tenantTotal.count,
        activeScans: scanRecent.count,
        totalFindings: findingOpen.count,
        criticalFindings: findingCritical.count,
        totalUsers: userTotal.count,
        avgComplianceScore: avgScore.avg,
        monthlyRevenue: mrr,
        systemUptime: 99.9,  // placeholder until real uptime metric is wired
        // Aliases kept for any other consumer
        totalTenants: tenantTotal.count,
        activeTenants: tenantActive.count,
        scansLast30Days: scanRecent.count,
        openFindings: findingOpen.count,
        mrr,
        mrrCents,
        // REAL IMPL (BLACKFYRE 2026-06): expose ARR, ARPC and the active-tenant count
        // the MRR figure is actually derived from (was previously absent).
        arr,
        arpc,
        activeTenantCount,
        planBreakdown: planCounts,
      },
    };
  });

  // GET /api/admin/audit-logs — Cross-tenant audit log search
  app.get("/api/admin/audit-logs", { preHandler: [adminOnly] }, async (request) => {
    const query = auditLogQuerySchema.parse(request.query);
    const db = app.superDb;

    const conditions = [];
    if (query.userId) conditions.push(eq(auditLogs.userId, query.userId));
    if (query.action) conditions.push(eq(auditLogs.action, query.action));
    if (query.tenantId) conditions.push(eq(auditLogs.tenantId, query.tenantId));
    if (query.resourceType) conditions.push(eq(auditLogs.resourceType, query.resourceType));
    if (query.startDate) conditions.push(gte(auditLogs.createdAt, new Date(query.startDate)));
    if (query.endDate) conditions.push(lte(auditLogs.createdAt, new Date(query.endDate)));

    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const offset = (query.page - 1) * query.limit;

    const [rows, [total]] = await Promise.all([
      db
        .select({
          id: auditLogs.id,
          tenantId: auditLogs.tenantId,
          tenantName: tenants.name,
          userId: auditLogs.userId,
          userName: users.name,
          userEmail: users.email,
          action: auditLogs.action,
          resourceType: auditLogs.resourceType,
          resourceId: auditLogs.resourceId,
          details: auditLogs.details,
          ipAddress: auditLogs.ipAddress,
          userAgent: auditLogs.userAgent,
          createdAt: auditLogs.createdAt,
        })
        .from(auditLogs)
        .leftJoin(users, eq(auditLogs.userId, users.id))
        .leftJoin(tenants, eq(auditLogs.tenantId, tenants.id))
        .where(where)
        .orderBy(desc(auditLogs.createdAt))
        .limit(query.limit)
        .offset(offset),
      db.select({ count: count() }).from(auditLogs).where(where),
    ]);

    // Frontend expects { logs: [...] }; keep auditLogs alias for any other consumers.
    const logs = rows.map((r) => ({
      ...r,
      timestamp: r.createdAt,
    }));
    return {
      logs,
      auditLogs: logs,
      pagination: {
        page: query.page,
        limit: query.limit,
        total: total.count,
      },
    };
  });

  // GET /api/admin/users — Cross-tenant user list
  app.get("/api/admin/users", { preHandler: [adminOnly] }, async (request) => {
    const query = userListQuerySchema.parse(request.query);
    const db = app.superDb;

    const conditions = [];
    if (query.tenantId) conditions.push(eq(users.tenantId, query.tenantId));
    if (query.role) conditions.push(eq(users.role, query.role));
    if (query.search) {
      conditions.push(
        or(
          like(users.email, `%${escapeLike(query.search)}%`),
          like(users.name, `%${escapeLike(query.search)}%`),
        ),
      );
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const offset = (query.page - 1) * query.limit;

    const [rows, [total]] = await Promise.all([
      db
        .select({
          id: users.id,
          tenantId: users.tenantId,
          tenantName: tenants.name,
          email: users.email,
          name: users.name,
          role: users.role,
          mfaEnabled: users.mfaEnabled,
          lastLogin: users.lastLogin,
          createdAt: users.createdAt,
        })
        .from(users)
        .leftJoin(tenants, eq(users.tenantId, tenants.id))
        .where(where)
        .orderBy(users.createdAt)
        .limit(query.limit)
        .offset(offset),
      db.select({ count: count() }).from(users).where(where),
    ]);

    return {
      users: rows,
      pagination: {
        page: query.page,
        limit: query.limit,
        total: total.count,
      },
    };
  });

  // POST /api/admin/users — Create user in any tenant
  app.post("/api/admin/users", { preHandler: [adminOnly] }, async (request, reply) => {
    const body = createUserSchema.parse(request.body);
    const db = app.superDb;

    // Validate tenant exists
    const [tenant] = await db
      .select({ id: tenants.id })
      .from(tenants)
      .where(eq(tenants.id, body.tenantId))
      .limit(1);

    if (!tenant) throw notFound("Tenant");

    // Check email uniqueness
    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, body.email))
      .limit(1);

    if (existing) throw conflict("EMAIL_EXISTS", `Email "${body.email}" is already in use`);

    // Hash password with Argon2
    const passwordHash = await hashPassword(body.password);

    const [created] = await db
      .insert(users)
      .values({
        tenantId: body.tenantId,
        email: body.email,
        name: body.name,
        passwordHash,
        role: body.role,
      })
      .returning();

    // Audit log the user creation
    const logger = new AuditLogger(db);
    await logger.log({
      tenantId: body.tenantId,
      userId: request.userId,
      action: "admin.user.create",
      resourceType: "user",
      resourceId: created.id,
      details: { email: body.email, role: body.role },
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"],
    });

    return reply.status(201).send({
      user: {
        id: created.id,
        tenantId: created.tenantId,
        email: created.email,
        name: created.name,
        role: created.role,
        createdAt: created.createdAt,
      },
    });
  });

  // GET /api/admin/compliance/leaderboard — Ranked client scores
  app.get("/api/admin/compliance/leaderboard", { preHandler: [adminOnly] }, async (request) => {
    const query = leaderboardQuerySchema.parse(request.query);
    const db = app.superDb;

    // For each tenant: get latest compliance score for the requested framework
    // Using a lateral join pattern via subquery
    const rows = await db
      .select({
        tenantId: tenants.id,
        tenantName: tenants.name,
        score: complianceScores.score,
        lastScanDate: complianceScores.snapshotAt,
        scanId: complianceScores.scanId,
      })
      .from(tenants)
      .innerJoin(
        complianceScores,
        and(
          eq(complianceScores.tenantId, tenants.id),
          eq(complianceScores.framework, query.framework),
        ),
      )
      .where(
        eq(
          complianceScores.snapshotAt,
          sql`(
            SELECT MAX(${complianceScores.snapshotAt})
            FROM ${complianceScores} cs2
            WHERE cs2.tenant_id = ${tenants.id}
              AND cs2.framework = ${query.framework}
          )`,
        ),
      )
      .orderBy(desc(complianceScores.score));

    // Get finding counts per tenant for these results
    const tenantIds = rows.map((r) => r.tenantId);
    let findingCounts: Record<string, number> = {};

    if (tenantIds.length > 0) {
      const fcRows = await db
        .select({
          tenantId: findings.tenantId,
          count: count(),
        })
        .from(findings)
        .where(
          and(
            eq(findings.status, "open"),
            sql`${findings.tenantId} = ANY(${tenantIds})`,
          ),
        )
        .groupBy(findings.tenantId);

      findingCounts = Object.fromEntries(fcRows.map((r) => [r.tenantId, r.count]));
    }

    const leaderboard = rows.map((r) => ({
      tenantId: r.tenantId,
      tenantName: r.tenantName,
      score: r.score,
      lastScanDate: r.lastScanDate,
      findingCount: findingCounts[r.tenantId] ?? 0,
    }));

    return { leaderboard, framework: query.framework };
  });

  // GET /api/admin/billing — Platform billing summary
  app.get("/api/admin/billing", { preHandler: [adminOnly] }, async () => {
    const db = app.superDb;
    const allTenants = await db
      .select({
        id: tenants.id,
        name: tenants.name,
        plan: tenants.plan,
        monthlyPriceInr: tenants.monthlyPriceInr,
        onboardingStatus: tenants.onboardingStatus,
        createdAt: tenants.createdAt,
      })
      .from(tenants)
      .limit(100);

    const activeTenants = allTenants.filter((t) => t.onboardingStatus !== "suspended");
    // REAL IMPL (BLACKFYRE 2026-06): MRR sums each active tenant's EFFECTIVE monthly price —
    // tenants.monthly_price_inr override when set, else the canonical PLANS price. Previously
    // every tenant was charged the catalog list price, dropping custom contracts. mrr is whole
    // INR for the UI; mrrCents is the integer paise sum (no float drift).
    const mrr = activeTenants.reduce((sum, t) => sum + effectiveMonthlyInr(t), 0);
    const mrrCents = activeTenants.reduce((sum, t) => sum + effectiveMonthlyPaise(t), 0);
    const arpc = activeTenants.length > 0 ? Math.round(mrr / activeTenants.length) : 0;

    return {
      billing: {
        totalMRR: mrr,
        activeSubscriptions: activeTenants.length,
        churnRate: 0,
        avgRevenuePerClient: arpc,
      },
      mrr,
      mrrCents,
      arr: mrr * 12,
      arpc,
      activeTenantCount: activeTenants.length,
      totalClients: allTenants.length,
      activeClients: activeTenants.length,
      clients: allTenants.map((t) => ({
        id: t.id,
        name: t.name,
        plan: t.plan,
        // REAL IMPL (BLACKFYRE 2026-06): surface the effective per-tenant monthly price so the
        // billing UI shows what each client is actually billed (override-aware), not the list price.
        monthlyPriceInr: effectiveMonthlyInr(t),
        status: t.onboardingStatus,
        createdAt: t.createdAt,
      })),
      mrrTrend: [],
      // REAL IMPL (BLACKFYRE 2026-06): plan breakdown enumerated from the canonical INR table.
      plans: (Object.keys(PLAN_PRICE_INR) as PlanId[]).map((name) => ({
        name,
        price: PLAN_PRICE_INR[name],
        count: activeTenants.filter((t) => t.plan === name).length,
      })),
    };
  });

  // GET /api/admin/settings — Platform settings (platform-global, gated by platform-admin)
  // REAL IMPL (BLACKFYRE 2026-06): read REAL settings from the platform_settings singleton row
  // (migration 038) instead of returning a hardcoded object. Owner pool (superDb), no RLS — this
  // is platform-global config, not tenant data; access is gated by adminOnly (is_platform_admin).
  app.get("/api/admin/settings", { preHandler: [adminOnly] }, async () => {
    const row = await readPlatformSettings(app.superDb);
    return platformSettingsResponse(row);
  });

  // PATCH /api/admin/settings — Update platform settings
  // REAL IMPL (BLACKFYRE 2026-06): persist the change to platform_settings (was a no-op that
  // returned Object.keys(body) and dropped the update). Validated by Zod (unknown keys stripped),
  // upserted into the singleton row via parameterized SQL, then audited. Response shape stays
  // { success, updated } so existing callers are unaffected.
  app.patch("/api/admin/settings", { preHandler: [adminOnly] }, async (request) => {
    const body = platformSettingsUpdateSchema.parse(request.body ?? {});
    const keys = Object.keys(body);
    if (keys.length === 0) {
      throw badRequest("EMPTY_UPDATE", "At least one setting must be provided");
    }

    // Merge notifications onto the existing jsonb so a partial notifications PATCH does not
    // clobber unspecified channels. Each scalar column updates only if present (COALESCE keeps
    // the stored value when the parameter is NULL). updated_by records the acting platform admin.
    // Explicit casts on every bound parameter so a NULL placeholder (field absent from this
    // partial PATCH) has a determinable type for COALESCE — postgres-js sends untyped NULLs.
    await app.superDb.execute(
      sql`
        UPDATE platform_settings SET
          maintenance_mode     = COALESCE(${body.maintenanceMode ?? null}::boolean, maintenance_mode),
          max_scans_per_tenant = COALESCE(${body.maxScansPerTenant ?? null}::integer, max_scans_per_tenant),
          retention_days       = COALESCE(${body.retentionDays ?? null}::integer, retention_days),
          mfa_required         = COALESCE(${body.mfaRequired ?? null}::boolean, mfa_required),
          session_timeout      = COALESCE(${body.sessionTimeout ?? null}::integer, session_timeout),
          notifications        = notifications || COALESCE(${
            body.notifications ? JSON.stringify(body.notifications) : null
          }::jsonb, '{}'::jsonb),
          updated_at           = now(),
          updated_by           = ${request.userId ?? null}::uuid
        WHERE id = TRUE
      `,
    );

    // Audit: this is a PLATFORM-GLOBAL change with no tenant context, and audit_logs.tenant_id
    // is NOT NULL (tenant-scoped). Rather than forge a fake tenant_id (which would pollute
    // tenant audit queries) the durable audit trail is the platform_settings.updated_by /
    // updated_at columns written by the UPDATE above, plus this structured pino log. No
    // card/secret data is logged — only which setting keys changed and the acting admin.
    request.log.info(
      { event: "admin.settings.update", updated: keys, userId: request.userId },
      "platform settings updated",
    );

    return { success: true, updated: keys };
  });

  // POST /api/admin/provision-client — Platform admin provisions a client directly
  app.post("/api/admin/provision-client", { preHandler: [adminOnly] }, async (request, reply) => {
    const body = provisionClientSchema.parse(request.body);
    const db = app.superDb;

    // Reject if email already in use
    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, body.ownerEmail))
      .limit(1);
    if (existing) throw conflict("EMAIL_EXISTS", `Email "${body.ownerEmail}" is already in use`);

    const svc = new ProvisioningService(db, db);
    const { tenant, user, tempPassword } = await svc.adminProvisionClient({
      companyName: body.companyName,
      ownerEmail: body.ownerEmail,
      ownerName: body.ownerName,
      plan: body.plan,
      industry: body.industry,
    });

    // Apply custom plan label / price if provided
    let finalTenant = tenant;
    if (body.customPlanLabel !== undefined || body.monthlyPriceInr !== undefined) {
      const patch: Record<string, unknown> = { updatedAt: new Date() };
      if (body.customPlanLabel !== undefined) patch.customPlanLabel = body.customPlanLabel;
      if (body.monthlyPriceInr !== undefined) patch.monthlyPriceInr = body.monthlyPriceInr;
      const [updated] = await db
        .update(tenants)
        .set(patch)
        .where(eq(tenants.id, tenant.id))
        .returning();
      finalTenant = updated;
    }

    // Apply per-feature overrides if provided
    const featuresSvc = new TenantFeaturesService(db);
    if (body.featureOverrides && body.featureOverrides.length > 0) {
      await featuresSvc.applyMatrix(tenant.id, body.featureOverrides, request.userId!);
    }
    const effective = await featuresSvc.getEffectiveFeatures(tenant.id);

    const logger = new AuditLogger(db);
    await logger.log({
      tenantId: tenant.id,
      userId: request.userId,
      action: "admin.client.provision",
      resourceType: "tenant",
      resourceId: tenant.id,
      details: {
        companyName: body.companyName,
        plan: body.plan,
        ownerEmail: body.ownerEmail,
        customPlanLabel: body.customPlanLabel,
        monthlyPriceInr: body.monthlyPriceInr,
        overrideCount: body.featureOverrides?.length ?? 0,
      },
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"],
    });

    return reply.status(201).send({
      client: {
        id: finalTenant.id,
        tenantId: finalTenant.id,
        accountNumber: finalTenant.accountNumber,
        company: finalTenant.name,
        plan: finalTenant.plan,
        status: finalTenant.onboardingStatus,
        customPlanLabel: finalTenant.customPlanLabel,
        monthlyPriceInr: finalTenant.monthlyPriceInr,
        ownerEmail: user.email,
        ownerName: user.name,
      },
      features: effective.features,
      tempPassword,
    });
  });

  // GET /api/admin/features — feature catalog (no tenant context)
  app.get("/api/admin/features", { preHandler: [adminOnly] }, async () => {
    const svc = new TenantFeaturesService(app.superDb);
    return { features: svc.catalog() };
  });

  // GET /api/admin/tenants — list all tenants with counts
  app.get("/api/admin/tenants", { preHandler: [adminOnly] }, async () => {
    const db = app.superDb;

    const rows = await db
      .select({
        id: tenants.id,
        accountNumber: tenants.accountNumber,
        name: tenants.name,
        slug: tenants.slug,
        plan: tenants.plan,
        customPlanLabel: tenants.customPlanLabel,
        monthlyPriceInr: tenants.monthlyPriceInr,
        industryProfile: tenants.industryProfile,
        onboardingStatus: tenants.onboardingStatus,
        createdAt: tenants.createdAt,
      })
      .from(tenants)
      .orderBy(desc(tenants.createdAt))
      .limit(200);

    if (rows.length === 0) return { tenants: [] };

    const tenantIds = rows.map((r: { id: string }) => r.id);

    const [userCountRows, overrideCountRows] = await Promise.all([
      db
        .select({ tenantId: users.tenantId, count: count() })
        .from(users)
        .where(sql`${users.tenantId} = ANY(${tenantIds})`)
        .groupBy(users.tenantId),
      db
        .select({ tenantId: tenantFeatures.tenantId, count: count() })
        .from(tenantFeatures)
        .where(sql`${tenantFeatures.tenantId} = ANY(${tenantIds})`)
        .groupBy(tenantFeatures.tenantId),
    ]);

    const userCounts = Object.fromEntries(
      userCountRows.map((r: { tenantId: string; count: number }) => [r.tenantId, r.count]),
    );
    const overrideCounts = Object.fromEntries(
      overrideCountRows.map((r: { tenantId: string; count: number }) => [r.tenantId, r.count]),
    );

    return {
      tenants: rows.map((r: typeof rows[number]) => ({
        ...r,
        userCount: userCounts[r.id] ?? 0,
        overrideCount: overrideCounts[r.id] ?? 0,
      })),
    };
  });

  // GET /api/admin/tenants/:id — full tenant detail with owner, features, stats
  app.get("/api/admin/tenants/:id", { preHandler: [adminOnly] }, async (request) => {
    const { id } = request.params as { id: string };
    requireUUID(id, "id");
    const db = app.superDb;

    const [tenant] = await db
      .select()
      .from(tenants)
      .where(eq(tenants.id, id))
      .limit(1);

    if (!tenant) throw notFound("Tenant");

    const [
      [owner],
      effective,
      [userCountRow],
      [scanCountRow],
      [openFindingRow],
      [overrideCountRow],
    ] = await Promise.all([
      db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          lastLogin: users.lastLogin,
        })
        .from(users)
        .where(and(eq(users.tenantId, id), eq(users.role, "owner")))
        .orderBy(users.createdAt)
        .limit(1),
      new TenantFeaturesService(db).getEffectiveFeatures(id),
      db.select({ count: count() }).from(users).where(eq(users.tenantId, id)),
      db.select({ count: count() }).from(scans).where(eq(scans.tenantId, id)),
      db
        .select({ count: count() })
        .from(findings)
        .where(and(eq(findings.tenantId, id), eq(findings.status, "open"))),
      db.select({ count: count() }).from(tenantFeatures).where(eq(tenantFeatures.tenantId, id)),
    ]);

    return {
      tenant,
      owner: owner ?? null,
      features: effective,
      stats: {
        userCount: userCountRow.count,
        scanCount: scanCountRow.count,
        openFindingCount: openFindingRow.count,
        overrideCount: overrideCountRow.count,
      },
    };
  });

  // PATCH /api/admin/tenants/:id — update tenant fields
  app.patch("/api/admin/tenants/:id", { preHandler: [adminOnly] }, async (request) => {
    const { id } = request.params as { id: string };
    requireUUID(id, "id");
    const body = tenantUpdateSchema.parse(request.body);

    if (Object.keys(body).length === 0) {
      throw badRequest("EMPTY_UPDATE", "At least one field must be provided");
    }

    const db = app.superDb;
    const [existing] = await db
      .select({
        id: tenants.id,
        plan: tenants.plan,
        monthlyPriceInr: tenants.monthlyPriceInr,
        mrrCents: tenants.mrrCents,
      })
      .from(tenants)
      .where(eq(tenants.id, id))
      .limit(1);
    if (!existing) throw notFound("Tenant");

    // REAL IMPL (BLACKFYRE 2026-06): when admin changes plan and/or monthly_price_inr the
    // tenant's stored MRR (tenants.mrr_cents) must move with it — that column previously
    // defaulted to 0 and was never maintained, so a custom-priced tenant reported 0 revenue.
    // Resolve the EFFECTIVE post-patch price (override wins, else canonical PLANS price) and,
    // if either pricing field is touched, recompute mrr_cents and write it in the SAME
    // transaction as the field update + audit row so the persisted MRR can never drift from
    // the tenant's plan/override. body.monthlyPriceInr may be explicitly null (clear override
    // => fall back to plan price), so we distinguish "key present" from "value set".
    const pricingTouched =
      Object.prototype.hasOwnProperty.call(body, "plan") ||
      Object.prototype.hasOwnProperty.call(body, "monthlyPriceInr");

    const nextPlan = body.plan ?? existing.plan;
    const nextMonthlyPriceInr = Object.prototype.hasOwnProperty.call(body, "monthlyPriceInr")
      ? (body.monthlyPriceInr ?? null)
      : existing.monthlyPriceInr;
    const nextMrrCents = effectiveMonthlyPaise({
      plan: nextPlan,
      monthlyPriceInr: nextMonthlyPriceInr,
    });

    const updated = await db.transaction(async (tx) => {
      const [row] = await tx
        .update(tenants)
        .set({
          ...body,
          ...(pricingTouched ? { mrrCents: nextMrrCents } : {}),
          updatedAt: new Date(),
        })
        .where(eq(tenants.id, id))
        .returning();

      // Audit row written inside the same transaction so a plan/price change and its
      // audit trail commit atomically (both or neither). The tx handle exposes the same
      // insert API AuditLogger uses; the double-cast is the codebase's standard escape hatch
      // for passing a PgTransaction where a Db is typed (see scim.ts `tx: any`).
      await new AuditLogger(tx as unknown as Db).log({
        tenantId: id,
        userId: request.userId!,
        action: "admin.tenant.update",
        resourceType: "tenant",
        resourceId: id,
        details: {
          ...body,
          ...(pricingTouched
            ? { previousMrrCents: existing.mrrCents, mrrCents: nextMrrCents }
            : {}),
        },
        ipAddress: request.ip,
        userAgent: request.headers["user-agent"],
      });

      return row;
    });

    if (pricingTouched) {
      // Structured pino log — pricing/MRR is operationally significant. No card/secret data.
      request.log.info(
        {
          event: "admin.tenant.mrr_updated",
          tenantId: id,
          plan: nextPlan,
          monthlyPriceInr: nextMonthlyPriceInr,
          previousMrrCents: existing.mrrCents,
          mrrCents: nextMrrCents,
        },
        "tenant MRR recomputed from plan/price change",
      );
    }

    return { tenant: updated };
  });

  // PATCH /api/admin/tenants/:id/features — apply feature override matrix
  app.patch("/api/admin/tenants/:id/features", { preHandler: [adminOnly] }, async (request) => {
    const { id } = request.params as { id: string };
    requireUUID(id, "id");
    const body = tenantFeaturesUpdateSchema.parse(request.body);
    const db = app.superDb;

    const [existing] = await db
      .select({ id: tenants.id })
      .from(tenants)
      .where(eq(tenants.id, id))
      .limit(1);
    if (!existing) throw notFound("Tenant");

    const svc = new TenantFeaturesService(db);
    const features = await svc.applyMatrix(id, body.overrides, request.userId!);

    const logger = new AuditLogger(db);
    await logger.log({
      tenantId: id,
      userId: request.userId!,
      action: "admin.tenant.features.update",
      resourceType: "tenant",
      resourceId: id,
      details: { count: body.overrides.length, changes: body.overrides },
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"],
    });

    return { features };
  });

  // PATCH /api/admin/users/:id — update a user's name/role/isPlatformAdmin
  app.patch<{ Params: { id: string } }>("/api/admin/users/:id", { preHandler: [adminOnly] }, async (request, reply) => {
    requireUUID(request.params.id);
    const body = updateUserSchema.parse(request.body);
    const db = app.superDb;

    const [existing] = await db.select({ id: users.id, tenantId: users.tenantId }).from(users).where(eq(users.id, request.params.id)).limit(1);
    if (!existing) throw notFound("User");

    const [updated] = await db.update(users).set({
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.role !== undefined ? { role: body.role } : {}),
      ...(body.isPlatformAdmin !== undefined ? { isPlatformAdmin: body.isPlatformAdmin } : {}),
    }).where(eq(users.id, request.params.id)).returning();

    const logger = new AuditLogger(db);
    await logger.log({
      tenantId: existing.tenantId,
      userId: request.userId,
      action: "admin.user.update",
      resourceType: "user",
      resourceId: request.params.id,
      details: body,
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"],
    });

    return reply.send({ user: { id: updated.id, name: updated.name, role: updated.role, email: updated.email } });
  });

  // DELETE /api/admin/users/:id — delete a user
  app.delete<{ Params: { id: string } }>("/api/admin/users/:id", { preHandler: [adminOnly] }, async (request, reply) => {
    requireUUID(request.params.id);
    const db = app.superDb;

    const [existing] = await db.select({ id: users.id, tenantId: users.tenantId, email: users.email }).from(users).where(eq(users.id, request.params.id)).limit(1);
    if (!existing) throw notFound("User");

    await db.delete(users).where(eq(users.id, request.params.id));

    const logger = new AuditLogger(db);
    await logger.log({
      tenantId: existing.tenantId,
      userId: request.userId,
      action: "admin.user.delete",
      resourceType: "user",
      resourceId: request.params.id,
      details: { email: existing.email },
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"],
    });

    return reply.status(204).send();
  });

  // POST /api/admin/findings/:id/acknowledge
  app.post<{ Params: { id: string } }>("/api/admin/findings/:id/acknowledge", { preHandler: [adminOnly] }, async (request, reply) => {
    requireUUID(request.params.id);
    const db = app.superDb;

    const [finding] = await db.select({ id: findings.id, tenantId: findings.tenantId, status: findings.status }).from(findings).where(eq(findings.id, request.params.id)).limit(1);
    if (!finding) throw notFound("Finding");

    const [updated] = await db.update(findings).set({ status: "acknowledged" }).where(eq(findings.id, request.params.id)).returning({ id: findings.id, status: findings.status });

    const logger = new AuditLogger(db);
    await logger.log({
      tenantId: finding.tenantId,
      userId: request.userId,
      action: "admin.finding.acknowledge",
      resourceType: "finding",
      resourceId: request.params.id,
      details: { previousStatus: finding.status },
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"],
    });

    return reply.send({ finding: updated });
  });

  // POST /api/admin/findings/:id/dismiss
  app.post<{ Params: { id: string } }>("/api/admin/findings/:id/dismiss", { preHandler: [adminOnly] }, async (request, reply) => {
    requireUUID(request.params.id);
    const db = app.superDb;

    const [finding] = await db.select({ id: findings.id, tenantId: findings.tenantId, status: findings.status }).from(findings).where(eq(findings.id, request.params.id)).limit(1);
    if (!finding) throw notFound("Finding");

    const [updated] = await db.update(findings).set({ status: "dismissed" }).where(eq(findings.id, request.params.id)).returning({ id: findings.id, status: findings.status });

    const logger = new AuditLogger(db);
    await logger.log({
      tenantId: finding.tenantId,
      userId: request.userId,
      action: "admin.finding.dismiss",
      resourceType: "finding",
      resourceId: request.params.id,
      details: { previousStatus: finding.status },
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"],
    });

    return reply.send({ finding: updated });
  });

  // POST /api/admin/scans/:id/cancel
  app.post<{ Params: { id: string } }>("/api/admin/scans/:id/cancel", { preHandler: [adminOnly] }, async (request, reply) => {
    requireUUID(request.params.id);
    const db = app.superDb;

    const [scan] = await db.select({ id: scans.id, tenantId: scans.tenantId, status: scans.status }).from(scans).where(eq(scans.id, request.params.id)).limit(1);
    if (!scan) throw notFound("Scan");
    if (scan.status !== "running" && scan.status !== "queued") {
      throw badRequest("INVALID_STATUS", `Cannot cancel scan with status "${scan.status}"`);
    }

    const [updated] = await db.update(scans).set({ status: "cancelled" }).where(eq(scans.id, request.params.id)).returning({ id: scans.id, status: scans.status });

    const logger = new AuditLogger(db);
    await logger.log({
      tenantId: scan.tenantId,
      userId: request.userId,
      action: "admin.scan.cancel",
      resourceType: "scan",
      resourceId: request.params.id,
      details: { previousStatus: scan.status },
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"],
    });

    return reply.send({ scan: updated });
  });

  // POST /api/admin/evidence/:id/access — SOC2 CC8.1 justified access, returns 5-min presigned URL
  app.post<{ Params: { id: string }; Body: { reason: string } }>("/api/admin/evidence/:id/access", { preHandler: [adminOnly] }, async (request, reply) => {
    requireUUID(request.params.id);
    const { reason } = evidenceAccessSchema.parse(request.body);
    const db = app.superDb;

    const [ev] = await db
      .select({ id: evidence.id, tenantId: evidence.tenantId, s3ObjectKey: evidence.s3ObjectKey, storagePath: evidence.storagePath })
      .from(evidence)
      .where(eq(evidence.id, request.params.id))
      .limit(1);

    if (!ev) throw notFound("Evidence");

    const s3Key = ev.s3ObjectKey ?? ev.storagePath;
    if (!s3Key) throw badRequest("MISSING_S3_KEY", "Evidence has no S3 object key");

    const bucket = process.env.EVIDENCE_S3_BUCKET;
    if (!bucket) throw badRequest("CONFIG_ERROR", "EVIDENCE_S3_BUCKET not configured");

    const s3 = new S3Client({ region: process.env.AWS_REGION ?? "ap-south-1" });
    const command = new GetObjectCommand({ Bucket: bucket, Key: s3Key });
    const url = await getSignedUrl(s3, command, { expiresIn: 300 });

    const logger = new AuditLogger(db);
    await logger.log({
      tenantId: ev.tenantId,
      userId: request.userId,
      action: "admin.evidence.access",
      resourceType: "evidence",
      resourceId: request.params.id,
      details: { reason, s3Key },
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"],
    });

    return reply.send({ url, expiresIn: 300 });
  });

  // GET /api/admin/evidence — paginated list of all evidence across tenants
  app.get("/api/admin/evidence", { preHandler: [adminOnly] }, async (request) => {
    const query = z.object({
      tenantId: z.string().uuid().optional(),
      framework: z.string().optional(),
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(25),
    }).parse(request.query);

    const db = app.superDb;
    const conditions = [];
    if (query.tenantId) conditions.push(eq(evidence.tenantId, query.tenantId));
    if (query.framework) conditions.push(eq(evidence.framework, query.framework));
    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const offset = (query.page - 1) * query.limit;

    const [rows, [total]] = await Promise.all([
      db.select({
        id: evidence.id,
        tenantId: evidence.tenantId,
        tenantName: tenants.name,
        type: evidence.type,
        framework: evidence.framework,
        collectedAt: evidence.collectedAt,
        collectedBy: evidence.collectedBy,
        s3ObjectKey: evidence.s3ObjectKey,
      })
        .from(evidence)
        .leftJoin(tenants, eq(evidence.tenantId, tenants.id))
        .where(where)
        .orderBy(desc(evidence.collectedAt))
        .limit(query.limit)
        .offset(offset),
      db.select({ count: count() }).from(evidence).where(where),
    ]);

    return { evidence: rows, pagination: { page: query.page, limit: query.limit, total: total.count } };
  });
};
