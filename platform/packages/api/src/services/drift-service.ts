import { eq, and, desc, count, sql } from "drizzle-orm";
import { driftEvents, scans } from "../db/schema.js";
import type { Db } from "../db/connection.js";
import { notFound } from "../utils/errors.js";

// REAL IMPL (BLACKFYRE 2026-06): a persisted continuous-monitoring schedule row
// (migration 034_monitoring_schedules.sql). Snake_case fields mirror what Postgres
// returns via raw `db.execute(sql\`...\`)`.
export interface MonitoringScheduleRow {
  id: string;
  tenant_id: string;
  integration_id: string | null;
  cadence_seconds: number;
  next_run_at: Date;
  last_run_at: Date | null;
  enabled: boolean;
  check_type: string;
  job_ref: string | null;
}

export class DriftService {
  constructor(private db: Db) {}

  // --------------------------------------------------------------------------
  // REAL IMPL (BLACKFYRE 2026-06): continuous-monitoring schedules.
  // POST /api/monitoring/start | /stop used to return hardcoded success and do
  // nothing. These ADDITIVE methods persist a real monitoring_schedules row via
  // parameterized SQL (RLS tenant_isolation policy + explicit tenant_id predicate
  // for defense in depth) so a monitor survives restarts; the monitor-worker
  // reads due rows, ACTUALLY enqueues a scan, then advances next_run_at.
  // --------------------------------------------------------------------------

  /**
   * Create or re-enable a recurring monitor for a tenant (optionally scoped to a
   * single integration). Idempotent on (tenant_id, integration_id): a second
   * /start refreshes cadence and re-arms next_run_at rather than duplicating.
   * Returns the persisted row so the route can echo real schedule state.
   */
  async upsertSchedule(
    tenantId: string,
    opts: {
      integrationId?: string | null;
      cadenceSeconds?: number;
      checkType?: "scheduled_scan" | "drift" | "health_check";
      jobRef?: string | null;
    } = {},
  ): Promise<MonitoringScheduleRow> {
    const cadence = Math.max(300, Math.floor(opts.cadenceSeconds ?? 86_400));
    const integrationId = opts.integrationId ?? null;
    const checkType = opts.checkType ?? "scheduled_scan";
    const jobRef = opts.jobRef ?? null;

    // next_run_at fires one cadence from now so /start doesn't immediately stampede
    // the scan queue; the worker advances it on each run.
    const conflictTarget = integrationId
      ? sql`(tenant_id, integration_id) WHERE integration_id IS NOT NULL`
      : sql`(tenant_id) WHERE integration_id IS NULL`;

    const rows = (await this.db.execute(sql`
      INSERT INTO monitoring_schedules
        (tenant_id, integration_id, cadence_seconds, next_run_at, enabled, check_type, job_ref, updated_at)
      VALUES
        (${tenantId}, ${integrationId}, ${cadence},
         now() + (${cadence} * interval '1 second'), true, ${checkType}, ${jobRef}, now())
      ON CONFLICT ${conflictTarget} DO UPDATE SET
        cadence_seconds = EXCLUDED.cadence_seconds,
        next_run_at = now() + (EXCLUDED.cadence_seconds * interval '1 second'),
        enabled = true,
        check_type = EXCLUDED.check_type,
        job_ref = EXCLUDED.job_ref,
        updated_at = now()
      RETURNING id, tenant_id, integration_id, cadence_seconds, next_run_at,
                last_run_at, enabled, check_type, job_ref
    `)) as unknown as MonitoringScheduleRow[];

    return rows[0];
  }

  /**
   * Soft-stop monitoring for a tenant (optionally a single integration): flips
   * enabled=false rather than deleting, so the schedule + history survive and can
   * be re-enabled. Returns the number of schedules paused.
   */
  async disableSchedules(
    tenantId: string,
    integrationId?: string | null,
  ): Promise<number> {
    const rows = (await this.db.execute(
      integrationId
        ? sql`UPDATE monitoring_schedules
                 SET enabled = false, updated_at = now()
               WHERE tenant_id = ${tenantId} AND integration_id = ${integrationId} AND enabled = true
             RETURNING id`
        : sql`UPDATE monitoring_schedules
                 SET enabled = false, updated_at = now()
               WHERE tenant_id = ${tenantId} AND enabled = true
             RETURNING id`,
    )) as unknown as Array<{ id: string }>;
    return rows.length;
  }

  /** List a tenant's monitoring schedules (enabled + paused) for status display. */
  async listSchedules(tenantId: string): Promise<MonitoringScheduleRow[]> {
    return (await this.db.execute(sql`
      SELECT id, tenant_id, integration_id, cadence_seconds, next_run_at,
             last_run_at, enabled, check_type, job_ref
        FROM monitoring_schedules
       WHERE tenant_id = ${tenantId}
       ORDER BY created_at DESC
    `)) as unknown as MonitoringScheduleRow[];
  }

  /**
   * WORKER-ONLY. Fetch enabled schedules that are due (next_run_at <= now()) for a
   * tenant. The monitor-worker calls this on its `scheduled_scan` poll, enqueues a
   * scan per due schedule, then calls advanceSchedule(). Runs on the owner pool
   * (workers have no request RLS context) so a tenant_id predicate is required.
   */
  async getDueSchedules(tenantId: string): Promise<MonitoringScheduleRow[]> {
    return (await this.db.execute(sql`
      SELECT id, tenant_id, integration_id, cadence_seconds, next_run_at,
             last_run_at, enabled, check_type, job_ref
        FROM monitoring_schedules
       WHERE tenant_id = ${tenantId}
         AND enabled = true
         AND next_run_at <= now()
       ORDER BY next_run_at ASC
       LIMIT 100
    `)) as unknown as MonitoringScheduleRow[];
  }

  /**
   * WORKER-ONLY. Stamp last_run_at and advance next_run_at by the schedule's
   * cadence after the worker has actually enqueued the scan/check. Tenant-scoped.
   */
  async advanceSchedule(id: string, tenantId: string): Promise<void> {
    await this.db.execute(sql`
      UPDATE monitoring_schedules
         SET last_run_at = now(),
             next_run_at = now() + (cadence_seconds * interval '1 second'),
             updated_at = now()
       WHERE id = ${id} AND tenant_id = ${tenantId}
    `);
  }

  /**
   * Read real drift-detection state from scan history for an integration: the last
   * completed scan (the drift baseline) and the count of unacknowledged drift
   * events since then. The monitor-worker uses this so drift detection is grounded
   * in the DB, not a hardcoded window.
   */
  async getDriftState(
    tenantId: string,
    integrationId?: string | null,
  ): Promise<{ lastScanAt: Date | null; baselineScanId: string | null; unacknowledgedSince: number }> {
    const [lastScan] = await this.db
      .select({ id: scans.id, completedAt: scans.completedAt })
      .from(scans)
      .where(and(eq(scans.tenantId, tenantId), eq(scans.status, "completed")))
      .orderBy(desc(scans.completedAt))
      .limit(1);

    const lastScanAt = lastScan?.completedAt ? new Date(lastScan.completedAt) : null;

    const driftConds = [
      eq(driftEvents.tenantId, tenantId),
      eq(driftEvents.acknowledged, false),
    ];
    if (integrationId) driftConds.push(eq(driftEvents.integrationId, integrationId));
    if (lastScanAt) driftConds.push(sql`${driftEvents.detectedAt} >= ${lastScanAt}`);

    const [{ count: unack }] = await this.db
      .select({ count: count() })
      .from(driftEvents)
      .where(and(...driftConds));

    return {
      lastScanAt,
      baselineScanId: lastScan?.id ?? null,
      unacknowledgedSince: unack ?? 0,
    };
  }

  async create(tenantId: string, data: {
    integrationId: string;
    changeType: string;
    resourceType: string;
    resourceId: string;
    beforeState?: Record<string, unknown> | null;
    afterState?: Record<string, unknown> | null;
    severity: string;
  }) {
    const [created] = await this.db
      .insert(driftEvents)
      .values({
        tenantId,
        integrationId: data.integrationId,
        changeType: data.changeType as any,
        resourceType: data.resourceType,
        resourceId: data.resourceId,
        beforeState: data.beforeState ?? null,
        afterState: data.afterState ?? null,
        severity: data.severity as any,
      })
      .returning();

    return created;
  }

  async list(tenantId: string, filters: {
    integrationId?: string;
    changeType?: string;
    severity?: string;
    acknowledged?: boolean;
    limit?: number;
    offset?: number;
  } = {}) {
    const conditions = [eq(driftEvents.tenantId, tenantId)];

    if (filters.integrationId) {
      conditions.push(eq(driftEvents.integrationId, filters.integrationId));
    }
    if (filters.changeType) {
      conditions.push(eq(driftEvents.changeType, filters.changeType as any));
    }
    if (filters.severity) {
      conditions.push(eq(driftEvents.severity, filters.severity as any));
    }
    if (filters.acknowledged !== undefined) {
      conditions.push(eq(driftEvents.acknowledged, filters.acknowledged));
    }

    const where = and(...conditions);
    const limit = filters.limit ?? 25;
    const offset = filters.offset ?? 0;

    const [rows, [totalResult]] = await Promise.all([
      this.db
        .select()
        .from(driftEvents)
        .where(where)
        .limit(limit)
        .offset(offset)
        .orderBy(desc(driftEvents.detectedAt)),
      this.db
        .select({ count: count() })
        .from(driftEvents)
        .where(where),
    ]);

    return { rows, total: totalResult?.count ?? 0 };
  }

  async getById(id: string) {
    const [event] = await this.db
      .select()
      .from(driftEvents)
      .where(eq(driftEvents.id, id))
      .limit(1);

    if (!event) throw notFound("Drift event");
    return event;
  }

  async getByIdForTenant(id: string, tenantId: string) {
    const [event] = await this.db
      .select()
      .from(driftEvents)
      .where(and(eq(driftEvents.id, id), eq(driftEvents.tenantId, tenantId)))
      .limit(1);

    if (!event) throw notFound("Drift event");
    return event;
  }

  async acknowledge(id: string, acknowledged: boolean) {
    const [updated] = await this.db
      .update(driftEvents)
      .set({ acknowledged })
      .where(eq(driftEvents.id, id))
      .returning();

    if (!updated) throw notFound("Drift event");
    return updated;
  }

  async acknowledgeForTenant(id: string, tenantId: string, acknowledged: boolean) {
    const [updated] = await this.db
      .update(driftEvents)
      .set({ acknowledged })
      .where(and(eq(driftEvents.id, id), eq(driftEvents.tenantId, tenantId)))
      .returning();

    if (!updated) throw notFound("Drift event");
    return updated;
  }

  async getStats(tenantId: string) {
    const conditions = [eq(driftEvents.tenantId, tenantId)];
    const where = and(...conditions);

    const [totalResult, unacknowledgedResult, bySeverityResult, byChangeTypeResult] =
      await Promise.all([
        this.db
          .select({ count: count() })
          .from(driftEvents)
          .where(where),
        this.db
          .select({ count: count() })
          .from(driftEvents)
          .where(and(...conditions, eq(driftEvents.acknowledged, false))),
        this.db
          .select({
            severity: driftEvents.severity,
            count: count(),
          })
          .from(driftEvents)
          .where(where)
          .groupBy(driftEvents.severity),
        this.db
          .select({
            changeType: driftEvents.changeType,
            count: count(),
          })
          .from(driftEvents)
          .where(where)
          .groupBy(driftEvents.changeType),
      ]);

    return {
      total: totalResult[0].count,
      unacknowledged: unacknowledgedResult[0].count,
      bySeverity: Object.fromEntries(bySeverityResult.map((r) => [r.severity, r.count])),
      byChangeType: Object.fromEntries(byChangeTypeResult.map((r) => [r.changeType, r.count])),
    };
  }

  async getRecentForIntegration(integrationId: string, limit = 10) {
    const rows = await this.db
      .select()
      .from(driftEvents)
      .where(eq(driftEvents.integrationId, integrationId))
      .limit(limit)
      .orderBy(desc(driftEvents.detectedAt));

    return rows;
  }
}
