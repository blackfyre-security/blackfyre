import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import {
  listDriftEventsQuerySchema,
  acknowledgeDriftEventSchema,
} from "@blackfyre/shared";
import { DriftService } from "../services/drift-service.js";

// REAL IMPL (BLACKFYRE 2026-06): body for POST /api/monitoring/start. All optional
// so the historical no-body call still works (tenant-wide daily scheduled-scan
// monitor). cadenceSeconds floored to 5 min in the service; default 24h.
const startMonitoringSchema = z.object({
  integrationId: z.string().uuid().optional(),
  cadenceSeconds: z.number().int().min(300).max(2_592_000).optional(),
  checkType: z.enum(["scheduled_scan", "drift", "health_check"]).optional(),
});

const stopMonitoringSchema = z.object({
  integrationId: z.string().uuid().optional(),
});

export const driftRoutes: FastifyPluginAsync = async (app) => {
  const authenticated = (app as any).requireRole("owner", "admin", "engineer", "viewer");
  const adminOrEngineer = (app as any).requireRole("owner", "admin", "engineer");
  const planGuard = app.requirePlan("Defend");

  // GET /api/drift — list drift events for tenant
  app.get("/api/drift", { preHandler: [authenticated, planGuard] }, async (request) => {
    const query = listDriftEventsQuerySchema.parse(request.query);
    const service = new DriftService(app.db);
    const { rows, total } = await service.list(request.tenantId, {
      integrationId: query.integrationId,
      changeType: query.changeType,
      severity: query.severity,
      acknowledged: query.acknowledged,
      limit: query.limit,
      offset: query.offset,
    });
    return {
      driftEvents: rows,
      pagination: { limit: query.limit, offset: query.offset, total },
    };
  });

  // GET /api/drift/stats — get drift statistics for tenant
  app.get("/api/drift/stats", { preHandler: [authenticated, planGuard] }, async (request) => {
    const service = new DriftService(app.db);
    const stats = await service.getStats(request.tenantId);
    return { stats };
  });

  // GET /api/drift/:id — get single drift event
  app.get<{ Params: { id: string } }>("/api/drift/:id", {
    preHandler: [authenticated, planGuard],
  }, async (request) => {
    const service = new DriftService(app.db);
    const event = await service.getByIdForTenant(request.params.id, request.tenantId);
    return { driftEvent: event };
  });

  // POST /api/drift/:id/acknowledge — acknowledge/unacknowledge drift event
  app.post<{ Params: { id: string } }>("/api/drift/:id/acknowledge", {
    preHandler: [adminOrEngineer, planGuard],
  }, async (request) => {
    const body = acknowledgeDriftEventSchema.parse(request.body);
    const service = new DriftService(app.db);
    const updated = await service.acknowledgeForTenant(request.params.id, request.tenantId, body.acknowledged);
    return { driftEvent: updated };
  });

  // --- Monitoring aliases for spec compliance (GAP-018) ---
  // These map the spec's /api/monitoring/* paths to drift + integration functionality.

  // GET /api/monitoring/status — connection status for all integrations
  app.get("/api/monitoring/status", { preHandler: [authenticated, planGuard] }, async (request) => {
    const { integrations } = await import("../db/schema.js");
    const { eq } = await import("drizzle-orm");
    const rows = await app.db
      .select()
      .from(integrations)
      .where(eq(integrations.tenantId, request.tenantId))
      .orderBy(integrations.type)
      .limit(100);
    return {
      integrations: rows.map((i) => ({
        id: i.id,
        type: i.type,
        status: i.status,
        lastVerifiedAt: i.lastVerifiedAt,
      })),
    };
  });

  // GET /api/monitoring/alerts — drift alerts (alias for drift events)
  app.get("/api/monitoring/alerts", { preHandler: [authenticated, planGuard] }, async (request) => {
    const query = listDriftEventsQuerySchema.parse(request.query);
    const service = new DriftService(app.db);
    const { rows, total } = await service.list(request.tenantId, {
      integrationId: query.integrationId,
      changeType: query.changeType,
      severity: query.severity,
      acknowledged: query.acknowledged,
      limit: query.limit,
      offset: query.offset,
    });
    return { alerts: rows, pagination: { limit: query.limit, offset: query.offset, total } };
  });

  // POST /api/monitoring/start — start REAL continuous monitoring.
  // REAL IMPL (BLACKFYRE 2026-06): previously returned hardcoded {status:"started"}
  // and did nothing. Now it (1) persists/re-arms a tenant-scoped monitoring_schedules
  // row via parameterized SQL on the RLS-enforced request.db handle, and (2) enqueues a
  // recurring monitor job on the MONITOR_QUEUE (SqsQueue) that the monitor-worker
  // consumes to ACTUALLY enqueue scans / run drift checks when due. The job_ref (SQS
  // messageId) is stored on the row so /stop can correlate the cancellation. The poller
  // (workers/poller-monitor.ts) re-derives due work from next_run_at, so the schedule
  // survives a worker restart even if the in-flight SQS message is lost.
  app.post("/api/monitoring/start", { preHandler: [adminOrEngineer, planGuard] }, async (request) => {
    const body = startMonitoringSchema.parse(request.body ?? {});
    const db = (request.db ?? app.db) as typeof app.db;
    const service = new DriftService(db);

    // First persist the schedule (so a row exists even if the queue is down), then
    // enqueue the kick-off monitor job. enqueue failures must not silently succeed:
    // surface them so the caller knows monitoring did not arm.
    let schedule = await service.upsertSchedule(request.tenantId, {
      integrationId: body.integrationId ?? null,
      cadenceSeconds: body.cadenceSeconds,
      checkType: body.checkType ?? "scheduled_scan",
    });

    let jobRef: string | null = null;
    if (app.monitorQueue?.url) {
      // SqsQueue.add(jobName, data) wraps the payload as { jobName, data } itself, so
      // the second arg is the bare MonitorJobData (no double-wrapping).
      const { messageId } = await app.monitorQueue.add(`monitor-${schedule.id}`, {
        tenantId: request.tenantId,
        integrationId: body.integrationId ?? undefined,
        checkType: body.checkType ?? "scheduled_scan",
        scheduleId: schedule.id,
      });
      jobRef = messageId || null;
      // Persist the queue correlation id back onto the row.
      schedule = await service.upsertSchedule(request.tenantId, {
        integrationId: body.integrationId ?? null,
        cadenceSeconds: schedule.cadence_seconds,
        checkType: schedule.check_type as "scheduled_scan" | "drift" | "health_check",
        jobRef,
      });
    }

    request.log.info(
      {
        event: "monitoring.start",
        tenantId: request.tenantId,
        scheduleId: schedule.id,
        integrationId: body.integrationId ?? null,
        cadenceSeconds: schedule.cadence_seconds,
        checkType: schedule.check_type,
        enqueued: jobRef !== null,
      },
      "continuous monitoring started",
    );

    return {
      status: "started",
      schedule: {
        id: schedule.id,
        integrationId: schedule.integration_id,
        cadenceSeconds: schedule.cadence_seconds,
        nextRunAt: schedule.next_run_at,
        checkType: schedule.check_type,
        enabled: schedule.enabled,
      },
      message: jobRef
        ? "Continuous monitoring activated. The first check is scheduled and a monitor job was enqueued."
        : "Continuous monitoring schedule persisted. The monitor poller will pick it up on its next cycle.",
    };
  });

  // POST /api/monitoring/stop — stop REAL continuous monitoring.
  // REAL IMPL (BLACKFYRE 2026-06): previously returned hardcoded {status:"stopped"}.
  // Now it soft-pauses (enabled=false) the tenant's monitoring_schedules row(s) via
  // parameterized SQL on the RLS-enforced request.db handle, so the monitor poller
  // stops selecting them as due. History is retained (re-enable with /start). Returns
  // the real count of schedules paused.
  app.post("/api/monitoring/stop", { preHandler: [adminOrEngineer, planGuard] }, async (request) => {
    const body = stopMonitoringSchema.parse(request.body ?? {});
    const db = (request.db ?? app.db) as typeof app.db;
    const service = new DriftService(db);

    const paused = await service.disableSchedules(request.tenantId, body.integrationId ?? null);

    request.log.info(
      {
        event: "monitoring.stop",
        tenantId: request.tenantId,
        integrationId: body.integrationId ?? null,
        pausedCount: paused,
      },
      "continuous monitoring stopped",
    );

    return {
      status: "stopped",
      pausedCount: paused,
      message:
        paused > 0
          ? `Continuous monitoring deactivated (${paused} schedule(s) paused).`
          : "No active monitoring schedules to stop.",
    };
  });
};
