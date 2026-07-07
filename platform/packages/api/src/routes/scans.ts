import type { FastifyPluginAsync } from "fastify";
import { eq, and } from "drizzle-orm";
import { findings } from "../db/schema.js";
import { createScanSchema, updateScanSchema } from "@blackfyre/shared";
import { badRequest } from "../utils/errors.js";
import { ScanService } from "../services/scan-service.js";
import { UsageMeterService } from "../services/usage-meter-service.js";
import type { Plan } from "../services/provisioning-service.js";
import { requireUUID, validateScanStatus } from "../utils/security-fixes.js";
import type { ScanStatus } from "@blackfyre/shared";
import { redactCredentials } from "../lib/redact.js";

export const scanRoutes: FastifyPluginAsync = async (app) => {
  const adminOrEngineer = (app as any).requireRole("owner", "admin", "engineer");
  const adminOnly = (app as any).requireRole("owner", "admin");

  // GET /api/scans — list scans for current tenant via ScanService, optional ?status= filter
  app.get<{ Querystring: { status?: string; limit?: string; offset?: string } }>("/api/scans", {
    preHandler: [adminOrEngineer],
  }, async (request) => {
    const statusFilter = request.query.status
      ? validateScanStatus(request.query.status) as ScanStatus
      : undefined;
    const limit = Math.min(Math.max(Number(request.query.limit) || 25, 1), 100);
    const offset = Math.max(Number(request.query.offset) || 0, 0);

    // SECURITY FIX (BLACKFYRE audit 2026-06-05): Scans IDOR — query through the
    // RLS-enforced per-request handle (request.db) rather than the owner pool (app.db),
    // so Postgres row-level security pins every scan read to the caller's tenant.
    const service = new ScanService(request.db!, app.scanQueue, request.log);
    const { scans: rows, total } = await service.list(request.tenantId, {
      status: statusFilter,
      limit,
      offset,
    });

    // SECURITY FIX (BLACKFYRE audit 2026-06-05): credential leakage in API responses —
    // scan records carry repoSource (JSONB) which may hold credentialRef /
    // credentialEnvelope. Redact any secret-keyed fields before returning so encrypted
    // envelopes (and any legacy plaintext) are masked as [REDACTED] in the response.
    return {
      scans: redactCredentials(rows),
      pagination: { limit, offset, total },
    };
  });

  // POST /api/scans — create and queue a new scan via ScanService + SQS
  app.post("/api/scans", { preHandler: [adminOrEngineer] }, async (request, reply) => {
    const body = createScanSchema.parse(request.body);

    // REAL IMPL (BLACKFYRE 2026-06): real plan-quota enforcement for scans. The
    // per-plan scan allowance was previously defined (PLANS[plan].scanCadence) but
    // unenforced — a tenant could enqueue unbounded scans. enforceQuota() reads the
    // current billing-period 'scans' meter and throws 402 QUOTA_EXCEEDED (with
    // upgradeUrl) when the plan's monthly quota is already reached, BEFORE any work
    // is enqueued. Runs on the RLS-enforced per-request handle so the meter read is
    // pinned to the caller's tenant. The 402 propagates through the standard
    // ApiError handler, so success response shapes are unchanged.
    const usage = new UsageMeterService(request.db!, request.log);
    const plan = (request.tenantPlan ?? "comply") as Plan;
    await usage.enforceQuota(request.tenantId, "scans", plan);

    // SECURITY FIX (BLACKFYRE audit 2026-06-05): plaintext cloud creds on the scan queue —
    // run via request.db (RLS) and pass request.log so the service can encrypt inline
    // credential material and audit the credential-reference binding.
    const service = new ScanService(request.db!, app.scanQueue, request.log);
    const scan = await service.create(request.tenantId, request.userId, body);

    // REAL IMPL (BLACKFYRE 2026-06): only AFTER a successful create + enqueue do we
    // bill the meter, so a failed enqueue does not consume quota. Counting here (not
    // in the service) keeps usage accounting at the billing boundary and the period
    // resets naturally when period_start rolls to the next month.
    await usage.increment(request.tenantId, "scans", 1);
    // SECURITY FIX (BLACKFYRE audit 2026-06-05): credential leakage in API responses —
    // redact secret-keyed fields (e.g. repoSource.credentialRef / credentialEnvelope)
    // before returning the freshly-created scan to the client.
    return reply
      .status(202)
      .send({ scan: redactCredentials(scan), message: "Scan queued for processing" });
  });

  // GET /api/scans/:id — get single scan with progress
  app.get<{ Params: { id: string } }>("/api/scans/:id", {
    preHandler: [adminOrEngineer],
  }, async (request) => {
    requireUUID(request.params.id);
    // SECURITY FIX (BLACKFYRE audit 2026-06-05): Scans IDOR — resolve the scan via
    // request.db (RLS) AND with an explicit tenant predicate, so another tenant's scan id
    // returns 404 instead of disclosing the record. Log cross-tenant misses at warn.
    const service = new ScanService(request.db!, app.scanQueue, request.log);
    try {
      const scan = await service.getById(request.params.id, request.tenantId);
      // SECURITY FIX (BLACKFYRE audit 2026-06-05): credential leakage in API responses —
      // mask any secret-keyed fields (repoSource.credentialRef / credentialEnvelope)
      // before returning the scan record.
      return { scan: redactCredentials(scan) };
    } catch (err) {
      request.log.warn(
        {
          event: "scan.access.denied",
          tenantId: request.tenantId,
          scanId: request.params.id,
          userId: request.userId,
        },
        "scan not found for tenant (cross-tenant access blocked or missing)",
      );
      throw err;
    }
  });

  // PATCH /api/scans/:id — update scan status/progress (admin only, internal use)
  app.patch<{ Params: { id: string } }>("/api/scans/:id", {
    preHandler: [adminOnly],
  }, async (request) => {
    requireUUID(request.params.id);
    const body = updateScanSchema.parse(request.body);

    if (Object.keys(body).length === 0) {
      throw badRequest("EMPTY_UPDATE", "No fields to update");
    }

    const updateData: Record<string, unknown> = {};
    if (body.status !== undefined) updateData.status = body.status;
    if (body.progress !== undefined) updateData.progress = body.progress;
    if (body.errorDetails !== undefined) updateData.errorDetails = body.errorDetails;

    if (body.status === "running") {
      updateData.startedAt = new Date();
    }
    if (body.status === "completed" || body.status === "completed_partial" || body.status === "failed") {
      updateData.completedAt = new Date();
    }

    // SECURITY FIX (BLACKFYRE audit 2026-06-05): Scans IDOR — the inline UPDATE filtered on
    // `eq(scans.id, ...)` only, letting an admin mutate another tenant's scan by id. The
    // update now runs through request.db (RLS) and the tenant-scoped service method, so a
    // scan in another tenant is not found rather than mutated. Cross-tenant misses log at warn.
    const service = new ScanService(request.db!, app.scanQueue, request.log);
    try {
      const updated = await service.updateForTenant(
        request.params.id,
        request.tenantId,
        updateData,
      );
      // SECURITY FIX (BLACKFYRE audit 2026-06-05): credential leakage in API responses —
      // redact secret-keyed fields on the updated scan record before returning it.
      return { scan: redactCredentials(updated) };
    } catch (err) {
      request.log.warn(
        {
          event: "scan.update.denied",
          tenantId: request.tenantId,
          scanId: request.params.id,
          userId: request.userId,
        },
        "scan update target not found for tenant (cross-tenant mutation blocked or missing)",
      );
      throw err;
    }
  });

  // POST /api/scans/:id/cancel — cancel a queued or running scan
  app.post<{ Params: { id: string } }>("/api/scans/:id/cancel", {
    preHandler: [adminOrEngineer],
  }, async (request) => {
    requireUUID(request.params.id);
    // SECURITY FIX (BLACKFYRE audit 2026-06-05): Scans IDOR — cancel is tenant-scoped via
    // request.db (RLS) + explicit tenantId, preventing cross-tenant DoS (cancelling another
    // tenant's running scan). Cross-tenant misses log at warn.
    const service = new ScanService(request.db!, app.scanQueue, request.log);
    try {
      const scan = await service.cancel(request.params.id, request.tenantId);
      // SECURITY FIX (BLACKFYRE audit 2026-06-05): credential leakage in API responses —
      // redact secret-keyed fields on the cancelled scan record before returning it.
      return { scan: redactCredentials(scan), message: "Scan cancelled." };
    } catch (err) {
      request.log.warn(
        {
          event: "scan.cancel.denied",
          tenantId: request.tenantId,
          scanId: request.params.id,
          userId: request.userId,
        },
        "scan cancel target not found for tenant (cross-tenant cancel blocked or missing)",
      );
      throw err;
    }
  });

  // GET /api/scans/:id/findings — findings for a specific scan (GAP-018)
  app.get<{ Params: { id: string } }>("/api/scans/:id/findings", {
    preHandler: [adminOrEngineer],
  }, async (request) => {
    requireUUID(request.params.id);
    // SECURITY FIX (BLACKFYRE audit 2026-06-05): Scans IDOR — verify the scan exists FOR
    // THIS TENANT (request.db RLS + tenant predicate) before returning its findings, so a
    // scan id from another tenant returns 404 rather than leaking finding existence/data.
    const service = new ScanService(request.db!, app.scanQueue, request.log);
    try {
      await service.getById(request.params.id, request.tenantId);
    } catch (err) {
      request.log.warn(
        {
          event: "scan.findings.access.denied",
          tenantId: request.tenantId,
          scanId: request.params.id,
          userId: request.userId,
        },
        "scan findings requested for a scan not in tenant (cross-tenant access blocked or missing)",
      );
      throw err;
    }

    const rows = await request.db!
      .select()
      .from(findings)
      .where(and(
        eq(findings.scanId, request.params.id),
        eq(findings.tenantId, request.tenantId),
      ))
      .orderBy(findings.severity);

    return { findings: rows };
  });
};
