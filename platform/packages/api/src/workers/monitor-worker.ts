import type { SQSEvent, SQSRecord } from "aws-lambda";
import { eq, and, desc } from "drizzle-orm";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "../db/schema.js";
import { integrations, scans } from "../db/schema.js";
import { DriftService } from "../services/drift-service.js";
import { AlertService } from "../services/alert-service.js";
import { NotificationDispatcher } from "../services/notification-dispatcher.js";
import { ScanService } from "../services/scan-service.js";
import { IntegrationService } from "../services/integration-service.js";
import { SqsQueue } from "../queue/sqs-client.js";
import type { ScanJobData } from "../queue/scan-queue.js";

export interface MonitorJobData {
  tenantId: string;
  integrationId?: string;
  checkType: "drift" | "scheduled_scan" | "health_check";
  // REAL IMPL (BLACKFYRE 2026-06): optional id of the monitoring_schedules row that
  // produced this job. Present for schedule-driven monitors so the worker can advance
  // next_run_at after it ACTUALLY enqueues the scan. Absent for ad-hoc monitor jobs.
  scheduleId?: string;
}

// REAL IMPL (BLACKFYRE 2026-06): minimal structured logger (pino-compatible shape).
// The SQS Lambda worker has no Fastify/pino instance, so we emit console-backed
// structured JSON so credential binding / scan enqueue are auditable. Never log secrets.
type Logger = {
  info: (obj: unknown, msg?: string) => void;
  warn: (obj: unknown, msg?: string) => void;
};

const log: Logger = {
  info: (obj, msg) => console.log(JSON.stringify({ level: "info", msg, ...(obj as object) })),
  warn: (obj, msg) => console.warn(JSON.stringify({ level: "warn", msg, ...(obj as object) })),
};

// REAL IMPL (BLACKFYRE 2026-06): a scheduled scan needs frameworks; if the tenant has
// no prior scan to inherit from, fall back to the broad default set so the monitor
// still produces meaningful compliance coverage rather than skipping.
const DEFAULT_SCHEDULED_FRAMEWORKS = ["soc2", "iso27001"];

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function handler(event: SQSEvent): Promise<void> {
  const dbUrl = process.env.DATABASE_URL;

  if (!dbUrl) {
    console.error("[monitor-worker] DATABASE_URL not set");
    return;
  }

  const client = postgres(dbUrl, { max: 5 });
  const db = drizzle(client, { schema });

  for (const record of event.Records) {
    await processMonitorJob(record, db);
  }
}

async function processMonitorJob(
  record: SQSRecord,
  db: ReturnType<typeof drizzle<typeof schema>>,
): Promise<void> {
  const { data } = JSON.parse(record.body) as { jobName: string; data: MonitorJobData };
  const { tenantId, integrationId, checkType, scheduleId } = data;

  console.log(`[monitor-worker] Processing ${checkType} job for tenant ${tenantId}`);

  let attempt = 0;
  while (attempt < MAX_RETRIES) {
    try {
      switch (checkType) {
        case "drift":
          await runDriftCheck(db, tenantId, integrationId);
          break;
        case "scheduled_scan":
          await runScheduledScanCheck(db, tenantId, scheduleId);
          break;
        case "health_check":
          await runHealthCheck(db, tenantId, integrationId);
          break;
        default:
          console.warn(`[monitor-worker] Unknown checkType: ${checkType}`);
      }
      return;
    } catch (err) {
      attempt++;
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error(
        `[monitor-worker] Attempt ${attempt}/${MAX_RETRIES} failed for tenant ${tenantId}: ${errorMessage}`,
      );

      if (attempt < MAX_RETRIES) {
        await sleep(RETRY_DELAY_MS * attempt);
      } else {
        console.error(
          `[monitor-worker] All retries exhausted for tenant ${tenantId} checkType=${checkType}`,
        );
        throw err; // Let SQS handle DLQ routing
      }
    }
  }
}

async function runDriftCheck(
  db: ReturnType<typeof drizzle<typeof schema>>,
  tenantId: string,
  integrationId?: string,
): Promise<void> {
  const driftService = new DriftService(db as any);
  const alertService = new AlertService(db as any);
  const dispatcher = new NotificationDispatcher();

  // Determine which integrations to check
  const integrationFilter = integrationId
    ? [eq(integrations.tenantId, tenantId), eq(integrations.id, integrationId)]
    : [eq(integrations.tenantId, tenantId)];

  const targetIntegrations = await db
    .select()
    .from(integrations)
    .where(and(...integrationFilter))
    .limit(50);

  if (targetIntegrations.length === 0) {
    console.log(`[monitor-worker] No integrations found for tenant ${tenantId}`);
    return;
  }

  // REAL IMPL (BLACKFYRE 2026-06): the drift baseline is read from REAL scan history,
  // not a hardcoded 24h window. "New" drift = unacknowledged drift detected since the
  // tenant's last completed scan (the known-good baseline). When no scan exists yet we
  // fall back to a 24h window so a brand-new tenant still gets alerts.
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  for (const integration of targetIntegrations) {
    const driftState = await driftService.getDriftState(tenantId, integration.id);
    const baseline = driftState.lastScanAt ?? oneDayAgo;

    const recentDrift = await driftService.getRecentForIntegration(integration.id, 10);

    const newDriftEvents = recentDrift.filter(
      (e) => e.detectedAt && new Date(e.detectedAt) > baseline && !e.acknowledged,
    );

    log.info(
      {
        event: "monitor.drift_check.state",
        tenantId,
        integrationId: integration.id,
        baselineScanId: driftState.baselineScanId,
        baselineAt: baseline.toISOString(),
        unacknowledgedSinceBaseline: driftState.unacknowledgedSince,
        newDriftEvents: newDriftEvents.length,
      },
      "drift state read from scan history",
    );

    if (newDriftEvents.length === 0) {
      console.log(
        `[monitor-worker] No new drift for integration ${integration.id} (${integration.type})`,
      );
      continue;
    }

    console.log(
      `[monitor-worker] Detected ${newDriftEvents.length} drift event(s) for integration ${integration.id}`,
    );

    // Fetch enabled drift alert rules for this tenant
    const { rows: driftRules } = await alertService.list(tenantId, {
      triggerType: "drift",
      enabled: true,
    });

    for (const rule of driftRules) {
      if (dispatcher.isInQuietHours(rule)) {
        console.log(`[monitor-worker] Alert rule ${rule.id} in quiet hours — skipping`);
        continue;
      }

      const highSeverityEvents = newDriftEvents.filter(
        (e) => e.severity === "critical" || e.severity === "high",
      );
      if (highSeverityEvents.length === 0) continue;

      const subject = `[BLACKFYRE] Drift Alert: ${highSeverityEvents.length} change(s) detected`;
      const body = buildDriftAlertBody(integration.type, highSeverityEvents);

      for (const channel of rule.channels) {
        try {
          await dispatcher.dispatch(channel, { subject, body });
          console.log(
            `[monitor-worker] Alert dispatched via ${channel} for rule ${rule.id}`,
          );
        } catch (err) {
          console.error(
            `[monitor-worker] Failed to dispatch alert via ${channel}: ${err}`,
          );
        }
      }
    }
  }
}

// REAL IMPL (BLACKFYRE 2026-06): scheduled monitoring used to ONLY notify ("log in to
// trigger a new scan") even when a scan was due — the monitor never actually started a
// scan, so "continuous monitoring" did nothing. This now reads the tenant's REAL
// monitoring_schedules rows (persisted by POST /api/monitoring/start), and for every
// schedule that is due it ACTUALLY enqueues a scan via ScanService.create() (which puts
// a real job on the scan queue), then advances next_run_at by the schedule's cadence so
// the recurrence is durable across worker restarts. A concurrent-scan guard prevents
// stampeding the queue; a scan_complete alert is still dispatched as a side effect.
async function runScheduledScanCheck(
  db: ReturnType<typeof drizzle<typeof schema>>,
  tenantId: string,
  scheduleId?: string,
): Promise<void> {
  const driftService = new DriftService(db as any);

  // Pull the REAL persisted schedules that are due now. If a specific scheduleId was
  // carried on the job, restrict to it; otherwise sweep all of the tenant's due rows.
  const dueSchedules = (await driftService.getDueSchedules(tenantId)).filter(
    (s) => !scheduleId || s.id === scheduleId,
  );

  if (dueSchedules.length === 0) {
    // Honor an explicit scheduleId that exists but isn't due yet (or was paused): no-op.
    log.info(
      { event: "monitor.scheduled_scan.none_due", tenantId, scheduleId: scheduleId ?? null },
      "no monitoring schedules due",
    );
    return;
  }

  // Concurrent-scan guard: never enqueue if the tenant already has work in flight.
  const activeScans = await db
    .select({ id: scans.id })
    .from(scans)
    .where(
      and(
        eq(scans.tenantId, tenantId),
        eq(scans.status, "running"),
      ),
    )
    .limit(1);

  if (activeScans.length > 0) {
    log.info(
      { event: "monitor.scheduled_scan.skip_active", tenantId },
      "tenant has an active scan — deferring scheduled scan, schedules left due",
    );
    return;
  }

  // Inherit frameworks from the last completed scan so the scheduled scan matches the
  // tenant's compliance posture; fall back to the default set on a first-ever scan.
  const [lastScan] = await db
    .select({ frameworks: scans.frameworks, targets: scans.targets, completedAt: scans.completedAt })
    .from(scans)
    .where(and(eq(scans.tenantId, tenantId), eq(scans.status, "completed")))
    .orderBy(desc(scans.completedAt))
    .limit(1);

  const inheritedFrameworks =
    lastScan?.frameworks && lastScan.frameworks.length > 0
      ? lastScan.frameworks
      : DEFAULT_SCHEDULED_FRAMEWORKS;

  // ScanService.create() requires a real scan queue handle. The monitor worker resolves
  // the same SCAN_QUEUE_URL the API/scan-worker use; inline integration secrets are
  // envelope-encrypted by the service contract (never plaintext on the queue).
  const scanService = new ScanService(
    db as any,
    new SqsQueue<ScanJobData>(process.env.SCAN_QUEUE_URL ?? ""),
    log,
  );
  const integrationService = new IntegrationService(db as any);
  const dispatcher = new NotificationDispatcher();
  const alertService = new AlertService(db as any);
  const { rows: scanRules } = await alertService.list(tenantId, {
    triggerType: "scan_complete",
    enabled: true,
  });

  for (const schedule of dueSchedules) {
    // Determine scan targets. A per-integration schedule scans just that integration's
    // type; a tenant-wide sweep scans all active integration types.
    let targets: string[];
    if (schedule.integration_id) {
      const active = await integrationService.getActiveForTenant(tenantId);
      const resolved = active.find((i) => i.id === schedule.integration_id);
      if (!resolved) {
        log.warn(
          { event: "monitor.scheduled_scan.no_integration", tenantId, scheduleId: schedule.id },
          "schedule references no active integration — skipping but advancing next_run_at",
        );
        await driftService.advanceSchedule(schedule.id, tenantId);
        continue;
      }
      targets = [resolved.type];
    } else {
      const active = await integrationService.getActiveForTenant(tenantId);
      targets = [...new Set(active.map((i) => i.type))];
      if (targets.length === 0) {
        log.warn(
          { event: "monitor.scheduled_scan.no_active_integrations", tenantId, scheduleId: schedule.id },
          "no active integrations for tenant-wide schedule — advancing next_run_at without scan",
        );
        await driftService.advanceSchedule(schedule.id, tenantId);
        continue;
      }
    }

    try {
      // REAL DISPATCH: actually enqueue a scan. This puts a real job on the scan queue;
      // the scan-worker picks it up exactly as if a user had triggered it.
      const scan = await scanService.create(tenantId, "monitor-worker", {
        frameworks: inheritedFrameworks,
        targets,
      });

      // Advance the recurrence only AFTER the scan is successfully enqueued.
      await driftService.advanceSchedule(schedule.id, tenantId);

      log.info(
        {
          event: "monitor.scheduled_scan.enqueued",
          tenantId,
          scheduleId: schedule.id,
          scanId: scan.id,
          integrationId: schedule.integration_id,
          frameworks: inheritedFrameworks,
          targetCount: targets.length,
        },
        "scheduled scan enqueued by monitor",
      );

      // Side-effect notification (best-effort; failure must not block the scan).
      for (const rule of scanRules) {
        if (dispatcher.isInQuietHours(rule)) continue;
        const subject = `[BLACKFYRE] Scheduled compliance scan started`;
        const body = `A scheduled compliance scan (id ${scan.id}) was automatically started for your BLACKFYRE account by continuous monitoring.`;
        for (const channel of rule.channels) {
          try {
            await dispatcher.dispatch(channel, { subject, body });
          } catch (err) {
            log.warn(
              { event: "monitor.scheduled_scan.notify_failed", tenantId, channel, error: String(err) },
              "failed to send scheduled scan notification",
            );
          }
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // SCAN_LIMIT_REACHED is expected back-pressure — leave the schedule due so the
      // next poll retries; other errors bubble to the SQS retry/DLQ path.
      if ((err as { code?: string })?.code === "SCAN_LIMIT_REACHED") {
        log.info(
          { event: "monitor.scheduled_scan.backpressure", tenantId, scheduleId: schedule.id },
          "scan limit reached — leaving schedule due for next poll",
        );
        continue;
      }
      log.warn(
        { event: "monitor.scheduled_scan.enqueue_failed", tenantId, scheduleId: schedule.id, error: message },
        "failed to enqueue scheduled scan",
      );
      throw err;
    }
  }
}

async function runHealthCheck(
  db: ReturnType<typeof drizzle<typeof schema>>,
  tenantId: string,
  integrationId?: string,
): Promise<void> {
  const integrationFilter = integrationId
    ? [eq(integrations.tenantId, tenantId), eq(integrations.id, integrationId)]
    : [eq(integrations.tenantId, tenantId), eq(integrations.status, "error")];

  const errorIntegrations = await db
    .select()
    .from(integrations)
    .where(and(...integrationFilter))
    .limit(20);

  if (errorIntegrations.length === 0) {
    console.log(`[monitor-worker] All integrations healthy for tenant ${tenantId}`);
    return;
  }

  console.log(
    `[monitor-worker] ${errorIntegrations.length} integration(s) in error state for tenant ${tenantId}`,
  );

  const alertService = new AlertService(db as any);
  const dispatcher = new NotificationDispatcher();
  const { rows: rules } = await alertService.list(tenantId, { enabled: true });

  const subject = `[BLACKFYRE] Integration health alert: ${errorIntegrations.length} integration(s) in error`;
  const body = [
    `The following integrations require attention:`,
    ...errorIntegrations.map((i) => `  • ${i.type} (ID: ${i.id})`),
    ``,
    `Please review your credentials and reconnect affected integrations.`,
  ].join("\n");

  for (const rule of rules) {
    if (dispatcher.isInQuietHours(rule)) continue;

    for (const channel of rule.channels) {
      try {
        await dispatcher.dispatch(channel, { subject, body });
      } catch (err) {
        console.error(
          `[monitor-worker] Failed to send health alert via ${channel}: ${err}`,
        );
      }
    }
  }
}

function buildDriftAlertBody(
  integrationType: string,
  events: Array<{
    changeType: string;
    resourceType: string;
    resourceId: string;
    severity: string;
    detectedAt: Date | null;
  }>,
): string {
  const lines = [
    `Drift detected in your ${integrationType.toUpperCase()} integration:`,
    ``,
    ...events.map(
      (e) =>
        `  • [${e.severity.toUpperCase()}] ${e.changeType} on ${e.resourceType}/${e.resourceId}` +
        (e.detectedAt ? ` at ${new Date(e.detectedAt).toISOString()}` : ""),
    ),
    ``,
    `Log in to BLACKFYRE to review and acknowledge these changes.`,
  ];
  return lines.join("\n");
}

export function startMonitorWorker(): void {
  console.log("[monitor-worker] Monitor worker ready — listening for SQS events");
}
