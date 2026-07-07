import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import type { Db } from "../db/connection.js";
import { NotificationDispatcher } from "./notification-dispatcher.js";

// REAL IMPL (BLACKFYRE 2026-06): the type of the argument the Drizzle transaction
// callback receives (a PgTransaction). Derived from Db so it stays correct if the
// driver changes — mirrors the `Tx` alias in services/apex/incident-service.ts.
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

/* ------------------------------------------------------------------ */
/*  Types                                                               */
/* ------------------------------------------------------------------ */

export interface CertInIncident {
  id: string;
  tenantId: string;
  findingId: string;
  severity: "critical" | "high";
  detectedAt: Date;
  slaDeadline: Date; // detectedAt + 6 hours
  status: "open" | "reported" | "overdue" | "acknowledged";
  reportedAt?: Date;
  certinReferenceId?: string;
}

export interface IncidentWithTimeRemaining extends CertInIncident {
  msRemaining: number;
  hoursRemaining: number;
  minutesRemaining: number;
  isOverdue: boolean;
}

type EscalationThreshold = "warning" | "urgent" | "critical" | "overdue";

// REAL IMPL (BLACKFYRE 2026-06): minimal structured-logger surface (Fastify/pino
// compatible) so SLA/escalation lifecycle events are emitted as structured
// security/audit records when a logger is wired, falling back to console. Incident
// metadata (tenant id, finding title, deadline, escalation level) is compliance
// telemetry, not a secret — we never log credentials or the CERT-In reference body.
interface SecurityLogger {
  info(obj: Record<string, unknown>, msg?: string): void;
  warn(obj: Record<string, unknown>, msg?: string): void;
  error(obj: Record<string, unknown>, msg?: string): void;
}

// REAL IMPL (BLACKFYRE 2026-06): shape of a certin_incidents row as postgres-js
// returns it (snake_case columns) for rehydration in hydrate().
interface CertInIncidentRow {
  id: string;
  tenant_id: string;
  finding_id: string;
  severity: string;
  detected_at: string | Date;
  sla_deadline: string | Date;
  status: string;
  reported_at: string | Date | null;
  certin_reference_id: string | null;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                           */
/* ------------------------------------------------------------------ */

const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

// Escalation triggers: fires when elapsed time crosses these marks
const THRESHOLDS: Array<{ elapsedMs: number; level: EscalationThreshold }> = [
  { elapsedMs: 2 * 60 * 60 * 1000, level: "warning" },   // 2hr elapsed  (4hr remaining)
  { elapsedMs: 5 * 60 * 60 * 1000, level: "urgent" },    // 5hr elapsed  (1hr remaining)
  { elapsedMs: 5.5 * 60 * 60 * 1000, level: "critical" }, // 5.5hr elapsed (30min remaining)
  { elapsedMs: SIX_HOURS_MS, level: "overdue" },          // 6hr elapsed  (deadline passed)
];

/* ------------------------------------------------------------------ */
/*  Service                                                             */
/* ------------------------------------------------------------------ */

export class CertInSlaService {
  // In-memory store keyed by tenantId -> incidentId -> incident. Retained as the
  // synchronous read/write cache so every existing public method signature stays
  // byte-for-byte identical (createIncident/markReported/get* remain sync).
  // REAL IMPL (BLACKFYRE 2026-06): this Map is now a CACHE in front of the durable
  // `certin_incidents` table, not the system of record. When a Db handle is wired
  // the cache is write-through to Postgres and rehydrated on startup, so the
  // regulatory SLA state survives process restarts / Lambda cold starts.
  private incidents = new Map<string, Map<string, CertInIncident>>();

  // Track which escalations have already fired: incidentId -> Set of levels fired.
  // REAL IMPL (BLACKFYRE 2026-06): mirrored to the durable
  // `certin_incident_escalations` ledger so a restart cannot re-fire an
  // already-sent warning/urgent/critical/overdue alert, and cannot silently drop a
  // pending one. The composite-PK insert in the DB is the authoritative fire-once
  // arbiter when persistent; this Set is the fast in-process check.
  private escalationsFired = new Map<string, Set<EscalationThreshold>>();

  private dispatcher = new NotificationDispatcher();

  // REAL IMPL (BLACKFYRE 2026-06): optional durable backing store + structured
  // audit logger. BOTH are OPTIONAL and defaulted so existing callers
  // (`new CertInSlaService()` in queue/scan-worker.ts and routes/threat-intel.ts)
  // keep compiling and running with no DB wired — the Map alone behaves exactly as
  // before. When a Db handle is supplied, the incident + escalation state is
  // persisted to / hydrated from Postgres under tenant-scoped RLS. The Db is the
  // OWNER pool (app.db / worker deps.db); RLS is FORCE-enabled on these tables, so
  // every persistence statement binds app.current_tenant for the target tenant
  // inside its own transaction (is_local=true => auto-cleared at COMMIT, never
  // leaks to a pooled connection).
  private readonly db?: Db;
  private readonly log: SecurityLogger;

  constructor(db?: Db, logger?: SecurityLogger) {
    this.db = db;
    this.log = logger ?? {
      info: (obj, msg) => console.log(JSON.stringify({ level: "info", msg, ...obj })),
      warn: (obj, msg) => console.warn(JSON.stringify({ level: "warn", msg, ...obj })),
      error: (obj, msg) => console.error(JSON.stringify({ level: "error", msg, ...obj })),
    };
  }

  /* ---------------------------------------------------------------- */
  /*  1. Create incident                                                */
  /* ---------------------------------------------------------------- */

  createIncident(
    tenantId: string,
    findingId: string,
    severity: "critical" | "high",
    detectedAt: Date,
  ): CertInIncident {
    const id = randomUUID();
    const slaDeadline = new Date(detectedAt.getTime() + SIX_HOURS_MS);

    const incident: CertInIncident = {
      id,
      tenantId,
      findingId,
      severity,
      detectedAt,
      slaDeadline,
      status: "open",
    };

    const tenantMap = this.incidents.get(tenantId) ?? new Map<string, CertInIncident>();
    tenantMap.set(id, incident);
    this.incidents.set(tenantId, tenantMap);

    this.log.info(
      {
        event: "certin.incident.created",
        incidentId: id,
        tenantId,
        findingId,
        severity,
        slaDeadline: slaDeadline.toISOString(),
      },
      "CERT-In: SLA incident opened (6h reporting window started)",
    );

    // REAL IMPL (BLACKFYRE 2026-06): write-through so the incident survives a
    // restart. Fire-and-forget — the in-memory record is already created, and a
    // transient DB error must not break the (synchronous) finding-ingest path.
    this.persistIncidentAsync(incident);

    return incident;
  }

  /* ---------------------------------------------------------------- */
  /*  2. Mark as reported                                               */
  /* ---------------------------------------------------------------- */

  markReported(incidentId: string, certinReferenceId: string): CertInIncident | null {
    const incident = this.findIncident(incidentId);
    if (!incident) return null;

    incident.status = "reported";
    incident.reportedAt = new Date();
    incident.certinReferenceId = certinReferenceId;

    this.log.info(
      {
        event: "certin.incident.reported",
        incidentId,
        tenantId: incident.tenantId,
        certinReferenceId,
        reportedAt: incident.reportedAt.toISOString(),
      },
      "CERT-In: incident marked reported",
    );

    // REAL IMPL (BLACKFYRE 2026-06): durably record the report receipt so the
    // incident is not re-counted as open after a restart. Fire-and-forget.
    this.persistReportedAsync(incident);

    return incident;
  }

  /* ---------------------------------------------------------------- */
  /*  3. Get open incidents for a tenant                               */
  /* ---------------------------------------------------------------- */

  getOpenIncidents(tenantId: string): IncidentWithTimeRemaining[] {
    const now = Date.now();
    const tenantMap = this.incidents.get(tenantId);
    if (!tenantMap) return [];

    return Array.from(tenantMap.values())
      .filter((i) => i.status === "open" || i.status === "acknowledged")
      .map((i) => this.withTimeRemaining(i, now))
      .sort((a, b) => a.msRemaining - b.msRemaining); // most urgent first
  }

  /* ---------------------------------------------------------------- */
  /*  4. Get overdue incidents for a tenant                            */
  /* ---------------------------------------------------------------- */

  getOverdueIncidents(tenantId: string): IncidentWithTimeRemaining[] {
    const now = Date.now();
    const tenantMap = this.incidents.get(tenantId);
    if (!tenantMap) return [];

    return Array.from(tenantMap.values())
      .filter((i) => i.status === "overdue")
      .map((i) => this.withTimeRemaining(i, now))
      .sort((a, b) => a.detectedAt.getTime() - b.detectedAt.getTime());
  }

  /* ---------------------------------------------------------------- */
  /*  5. Get all incidents for a tenant (for listing)                  */
  /* ---------------------------------------------------------------- */

  getAllIncidents(tenantId: string): IncidentWithTimeRemaining[] {
    const now = Date.now();
    const tenantMap = this.incidents.get(tenantId);
    if (!tenantMap) return [];

    return Array.from(tenantMap.values())
      .map((i) => this.withTimeRemaining(i, now))
      .sort((a, b) => b.detectedAt.getTime() - a.detectedAt.getTime());
  }

  /* ---------------------------------------------------------------- */
  /*  6. Periodic escalation check                                      */
  /* ---------------------------------------------------------------- */

  async checkAndEscalate(): Promise<void> {
    const now = Date.now();

    for (const [, tenantMap] of this.incidents) {
      for (const [, incident] of tenantMap) {
        if (incident.status === "reported" || incident.status === "overdue") continue;

        const elapsedMs = now - incident.detectedAt.getTime();
        const fired = this.escalationsFired.get(incident.id) ?? new Set<EscalationThreshold>();

        for (const threshold of THRESHOLDS) {
          if (elapsedMs >= threshold.elapsedMs && !fired.has(threshold.level)) {
            // REAL IMPL (BLACKFYRE 2026-06): claim this (incident, level)
            // escalation durably BEFORE alerting. When persistent, an INSERT ...
            // ON CONFLICT DO NOTHING against certin_incident_escalations is the
            // authoritative fire-once gate: if the row already exists (e.g. it
            // fired before a restart but the in-memory Set was wiped), we skip the
            // alert instead of re-spamming. claimEscalation() returns false when
            // the row was already present.
            const claimed = await this.claimEscalation(incident, threshold.level);
            if (!claimed) {
              // Already fired durably (or the DB rejected the claim); reconcile the
              // in-memory Set and do not re-alert.
              fired.add(threshold.level);
              this.escalationsFired.set(incident.id, fired);
              continue;
            }

            fired.add(threshold.level);
            this.escalationsFired.set(incident.id, fired);

            if (threshold.level === "overdue") {
              incident.status = "overdue";
              // Durably flip the status so a restart does not re-escalate it.
              this.persistStatusAsync(incident);
            }

            await this.sendEscalationAlert(incident, threshold.level);
          }
        }
      }
    }
  }

  /* ---------------------------------------------------------------- */
  /*  Private helpers                                                   */
  /* ---------------------------------------------------------------- */

  private findIncident(incidentId: string): CertInIncident | undefined {
    for (const [, tenantMap] of this.incidents) {
      const incident = tenantMap.get(incidentId);
      if (incident) return incident;
    }
    return undefined;
  }

  private withTimeRemaining(incident: CertInIncident, now: number): IncidentWithTimeRemaining {
    const msRemaining = incident.slaDeadline.getTime() - now;
    const isOverdue = msRemaining <= 0;
    const absMs = Math.abs(msRemaining);
    const hoursRemaining = Math.floor(absMs / (60 * 60 * 1000));
    const minutesRemaining = Math.floor((absMs % (60 * 60 * 1000)) / 60_000);

    return {
      ...incident,
      msRemaining,
      hoursRemaining: isOverdue ? -hoursRemaining : hoursRemaining,
      minutesRemaining: isOverdue ? -minutesRemaining : minutesRemaining,
      isOverdue,
    };
  }

  private async sendEscalationAlert(
    incident: CertInIncident,
    level: EscalationThreshold,
  ): Promise<void> {
    const labels: Record<EscalationThreshold, string> = {
      warning: "WARNING",
      urgent: "URGENT",
      critical: "CRITICAL",
      overdue: "OVERDUE — COMPLIANCE VIOLATION",
    };

    const remainingMinutes = Math.max(
      0,
      Math.round((incident.slaDeadline.getTime() - Date.now()) / 60_000),
    );

    const subject = `[CERT-In SLA ${labels[level]}] Finding ${incident.findingId}`;
    const body =
      `CERT-In 6-hour SLA alert: ${labels[level]}\n\n` +
      `Incident ID  : ${incident.id}\n` +
      `Finding ID   : ${incident.findingId}\n` +
      `Tenant       : ${incident.tenantId}\n` +
      `Severity     : ${incident.severity}\n` +
      `Detected at  : ${incident.detectedAt.toISOString()}\n` +
      `SLA deadline : ${incident.slaDeadline.toISOString()}\n` +
      `Time remaining: ${remainingMinutes} minute(s)\n\n` +
      (level === "overdue"
        ? "ACTION REQUIRED: This incident has exceeded the mandatory 6-hour CERT-In reporting window. Immediate reporting to CERT-In is required for regulatory compliance."
        : `Please submit a CERT-In incident report before the deadline to remain compliant.`);

    try {
      await this.dispatcher.dispatch("email", {
        subject,
        body,
        to: process.env.CERTIN_ALERT_EMAIL ?? "security@blackfyre.com",
      });
    } catch (err) {
      this.log.error(
        {
          event: "certin.escalation.dispatch.failure",
          incidentId: incident.id,
          tenantId: incident.tenantId,
          level,
          error: err instanceof Error ? err.message : String(err),
        },
        "CERT-In: failed to dispatch escalation alert",
      );
    }

    this.log.warn(
      {
        event: "certin.escalation.fired",
        incidentId: incident.id,
        tenantId: incident.tenantId,
        level,
        findingId: incident.findingId,
        remainingMinutes,
      },
      "CERT-In: SLA escalation fired",
    );
  }

  /* ---------------------------------------------------------------- */
  /*  Durable persistence (additive — no public signature changes)     */
  /* ---------------------------------------------------------------- */
  //
  // REAL IMPL (BLACKFYRE 2026-06): the following are ADDITIVE members; none change
  // an existing public signature. They run PARAMETERIZED SQL through the Db
  // (Drizzle/postgres-js) handle against the certin_incidents +
  // certin_incident_escalations tables (migration 032_certin_incidents.sql), which
  // are intentionally NOT in db/schema.ts (parallel work items collide on schema.ts
  // edits). Every write binds app.current_tenant for the target tenant inside its
  // own transaction so FORCE RLS is satisfied even on the owner pool, and adds an
  // explicit tenant_id predicate for defense in depth. All are no-ops when the
  // instance was constructed without a Db handle.

  /**
   * Rehydrate this tenant's incident + escalation state from Postgres into the
   * in-process cache, then return the (time-annotated) incidents. Call on startup
   * or on a cache miss so subsequent synchronous getters and checkAndEscalate calls
   * see durable data. Falls back to the in-process cache when no Db handle is wired.
   */
  async getAllIncidentsPersistent(tenantId: string): Promise<IncidentWithTimeRemaining[]> {
    await this.hydrate(tenantId);
    return this.getAllIncidents(tenantId);
  }

  /**
   * Populate the in-process cache for a tenant from the durable tables. Restores
   * both the incident records and the per-incident set of already-fired escalation
   * levels, so the regulatory SLA clock and the fire-once escalation contract both
   * survive a restart. No-op when not persistent.
   */
  async hydrate(tenantId: string): Promise<void> {
    if (!this.db) return;

    const incidentRows = (await this.withTenant(tenantId, (tx) =>
      tx.execute(
        sql`SELECT id, tenant_id, finding_id, severity, detected_at, sla_deadline,
                   status, reported_at, certin_reference_id
            FROM certin_incidents
            WHERE tenant_id = ${tenantId}`,
      ),
    )) as unknown as CertInIncidentRow[];

    const tenantMap = new Map<string, CertInIncident>();
    for (const row of incidentRows) {
      const incident = this.rowToIncident(row);
      tenantMap.set(incident.id, incident);
    }
    this.incidents.set(tenantId, tenantMap);

    // Restore which escalation levels already fired for this tenant's incidents.
    const escalationRows = (await this.withTenant(tenantId, (tx) =>
      tx.execute(
        sql`SELECT e.incident_id, e.level
            FROM certin_incident_escalations e
            JOIN certin_incidents i ON i.id = e.incident_id
            WHERE i.tenant_id = ${tenantId}`,
      ),
    )) as unknown as Array<{ incident_id: string; level: string }>;

    for (const row of escalationRows) {
      const set = this.escalationsFired.get(row.incident_id) ?? new Set<EscalationThreshold>();
      set.add(row.level as EscalationThreshold);
      this.escalationsFired.set(row.incident_id, set);
    }

    this.log.info(
      {
        event: "certin.incidents.hydrated",
        tenantId,
        incidentCount: tenantMap.size,
        escalationCount: escalationRows.length,
      },
      "CERT-In: loaded SLA incident state from store",
    );
  }

  /** Fire-and-forget durable insert of a newly created incident. */
  private persistIncidentAsync(incident: CertInIncident): void {
    if (!this.db) return;
    void this.withTenant(incident.tenantId, (tx) =>
      tx.execute(
        sql`INSERT INTO certin_incidents (
              id, tenant_id, finding_id, severity, detected_at, sla_deadline, status
            ) VALUES (
              ${incident.id}, ${incident.tenantId}, ${incident.findingId},
              ${incident.severity}, ${incident.detectedAt}, ${incident.slaDeadline},
              ${incident.status}
            )
            ON CONFLICT (id) DO NOTHING`,
      ),
    ).catch((err) => this.logPersistFailure("create", incident, err));
  }

  /** Fire-and-forget durable update recording a CERT-In report receipt. */
  private persistReportedAsync(incident: CertInIncident): void {
    if (!this.db) return;
    void this.withTenant(incident.tenantId, (tx) =>
      tx.execute(
        sql`UPDATE certin_incidents
            SET status = 'reported',
                reported_at = ${incident.reportedAt ?? new Date()},
                certin_reference_id = ${incident.certinReferenceId ?? null},
                updated_at = now()
            WHERE id = ${incident.id}
              AND tenant_id = ${incident.tenantId}`,
      ),
    ).catch((err) => this.logPersistFailure("report", incident, err));
  }

  /** Fire-and-forget durable status flip (e.g. open -> overdue). */
  private persistStatusAsync(incident: CertInIncident): void {
    if (!this.db) return;
    void this.withTenant(incident.tenantId, (tx) =>
      tx.execute(
        sql`UPDATE certin_incidents
            SET status = ${incident.status}, updated_at = now()
            WHERE id = ${incident.id}
              AND tenant_id = ${incident.tenantId}`,
      ),
    ).catch((err) => this.logPersistFailure("status", incident, err));
  }

  /**
   * Durably claim a (incident, level) escalation. Returns true if THIS call
   * recorded the escalation for the first time (so the alert should fire), false
   * if it was already recorded (already fired — skip to avoid re-spamming after a
   * restart). When not persistent, always returns true (in-memory Set alone gates
   * fire-once, exactly as the original behavior).
   */
  private async claimEscalation(
    incident: CertInIncident,
    level: EscalationThreshold,
  ): Promise<boolean> {
    if (!this.db) return true;
    try {
      const rows = (await this.withTenant(incident.tenantId, (tx) =>
        tx.execute(
          sql`INSERT INTO certin_incident_escalations (incident_id, level)
              VALUES (${incident.id}, ${level})
              ON CONFLICT (incident_id, level) DO NOTHING
              RETURNING incident_id`,
        ),
      )) as unknown as Array<{ incident_id: string }>;
      // A returned row means the INSERT won (first claim); empty means a row
      // already existed (already fired durably) — do not re-alert.
      return rows.length > 0;
    } catch (err) {
      // On a transient DB error, fall back to the in-memory fire-once gate (the
      // caller still records the level in escalationsFired) so escalation is not
      // blocked entirely. Log it as an audit event.
      this.log.error(
        {
          event: "certin.escalation.claim.failure",
          incidentId: incident.id,
          tenantId: incident.tenantId,
          level,
          error: err instanceof Error ? err.message : String(err),
        },
        "CERT-In: failed to durably claim escalation; relying on in-memory gate",
      );
      return true;
    }
  }

  /**
   * Run a unit of work with app.current_tenant bound to `tenantId` for THIS
   * transaction only (is_local=true => auto-cleared at COMMIT/ROLLBACK, never
   * leaking to a pooled connection). Required because these tables are FORCE-RLS
   * and the Db handle is the table OWNER pool, which is still subject to the
   * tenant_isolation policy. Mirrors the per-transaction bind in
   * audit-chain-service.ts.
   */
  private async withTenant<T>(
    tenantId: string,
    fn: (tx: Tx) => Promise<T>,
  ): Promise<T> {
    return this.db!.transaction(async (tx) => {
      await tx.execute(sql`SELECT set_config('app.current_tenant', ${tenantId}, true)`);
      return fn(tx);
    });
  }

  private logPersistFailure(
    op: "create" | "report" | "status",
    incident: CertInIncident,
    err: unknown,
  ): void {
    this.log.error(
      {
        event: "certin.incident.persist.failure",
        op,
        incidentId: incident.id,
        tenantId: incident.tenantId,
        error: err instanceof Error ? err.message : String(err),
      },
      "CERT-In: failed to persist incident state durably; cached in-memory only",
    );
  }

  /** Rehydrate a CertInIncident from a stored row. */
  private rowToIncident(row: CertInIncidentRow): CertInIncident {
    const incident: CertInIncident = {
      id: row.id,
      tenantId: row.tenant_id,
      findingId: row.finding_id,
      severity: row.severity as "critical" | "high",
      detectedAt: new Date(row.detected_at),
      slaDeadline: new Date(row.sla_deadline),
      status: row.status as CertInIncident["status"],
    };
    if (row.reported_at) incident.reportedAt = new Date(row.reported_at);
    if (row.certin_reference_id) incident.certinReferenceId = row.certin_reference_id;
    return incident;
  }
}
