// REAL IMPL (BLACKFYRE 2026-06): durable, tenant-scoped incident store.
// APEX incidents and their response timelines previously lived only in two
// in-process Maps (`incidents` + `timelines`) plus two module-level counters and
// were ALL lost on every restart — a P2 durability gap for the incident-response
// control (it also wiped the SLA/response-time history the metrics endpoint
// reports). They are now persisted in the tenant-scoped, RLS-enforced
// `apex_incidents` + `apex_incident_timeline` tables (migration
// 031_apex_incidents.sql) and read/written via PARAMETERIZED raw SQL through the
// Drizzle `db` handle (db.execute(sql`... ${value} ...`)). The tables are
// intentionally NOT added to db/schema.ts (many agents run in parallel; concurrent
// schema.ts edits collide). The human-friendly INC-####/TL-# identifiers are kept
// as the stored text PKs and the next counter value is derived from MAX() on disk
// inside the insert transaction, so identifiers never collide after a restart.
import { sql, type SQL } from "drizzle-orm";
import type { Db } from "../../db/connection.js";

// REAL IMPL (BLACKFYRE 2026-06): the exact type of the handle Drizzle hands the
// transaction callback (a PgTransaction). Derived from Db so it stays correct
// without importing dialect-internal types or editing db/schema.ts. Helper methods
// that run inside a transaction accept this rather than the full Db.
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

/* ------------------------------------------------------------------ */
/*  Structured logger (Fastify/pino compatible)                        */
/* ------------------------------------------------------------------ */

// REAL IMPL (BLACKFYRE 2026-06): minimal structured-logger surface so the service
// can emit pino security/audit events (incident lifecycle transitions) when a
// Fastify/pino logger is passed, defaulting to a no-op so existing callers compile
// and run unchanged. Incident metadata (title/severity/status) is operational, not
// secret; we never log credentials or raw request bodies.
type Logger = {
  info: (obj: unknown, msg?: string) => void;
  warn: (obj: unknown, msg?: string) => void;
};

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface Incident {
  id: string;
  tenantId: string;
  title: string;
  description: string;
  severity: "p1" | "p2" | "p3" | "p4";
  sourceType: "finding" | "drift" | "threat";
  sourceId: string;
  sourceAgent: "scout" | "pulse" | "signal";
  status: "detected" | "triaged" | "investigating" | "contained" | "remediating" | "resolved" | "closed";
  assignedTo?: string;
  slaTargetMinutes: number;
  responseTimeMinutes?: number;
  rootCause?: string;
  lessonsLearned?: string;
  createdAt: Date;
  resolvedAt?: Date;
  closedAt?: Date;
}

export interface IncidentTimelineEntry {
  id: string;
  incidentId: string;
  action: string;
  details: string;
  performedBy: string;
  agentName?: string;
  performedAt: Date;
}

/* ------------------------------------------------------------------ */
/*  Row shapes (snake_case as returned by postgres-js)                 */
/* ------------------------------------------------------------------ */

interface IncidentRow {
  id: string;
  tenant_id: string;
  title: string;
  description: string;
  severity: Incident["severity"];
  source_type: Incident["sourceType"];
  source_id: string;
  source_agent: Incident["sourceAgent"];
  status: Incident["status"];
  assigned_to: string | null;
  sla_target_minutes: number;
  response_time_minutes: number | null;
  root_cause: string | null;
  lessons_learned: string | null;
  created_at: Date;
  resolved_at: Date | null;
  closed_at: Date | null;
}

interface TimelineRow {
  id: string;
  incident_id: string;
  action: string;
  details: string;
  performed_by: string;
  agent_name: string | null;
  performed_at: Date;
}

/* ------------------------------------------------------------------ */
/*  SLA Configuration                                                  */
/* ------------------------------------------------------------------ */

const SLA_TARGETS: Record<string, number> = {
  p1: 30,   // 30 minutes
  p2: 120,  // 2 hours
  p3: 480,  // 8 hours
  p4: 1440, // 24 hours
};

/* ------------------------------------------------------------------ */
/*  Incident Service                                                   */
/* ------------------------------------------------------------------ */

export class IncidentService {
  private readonly log: Logger;

  // REAL IMPL (BLACKFYRE 2026-06): the constructor still takes the `db` handle the
  // service already received; an OPTIONAL pino-compatible logger is appended and
  // defaulted, so existing callers (`new IncidentService(db)`) keep compiling.
  constructor(private db: Db, log?: Logger) {
    this.log = log ?? { info: () => {}, warn: () => {} };
  }

  /**
   * Create a new incident from agent escalation.
   *
   * REAL IMPL (BLACKFYRE 2026-06): the incident row and its first timeline entry
   * are written inside ONE transaction. The tenant is bound for the transaction
   * (set_config(..., is_local=true) => auto-cleared at COMMIT/ROLLBACK, never
   * leaks to a pooled connection) so the FORCE-RLS policy on apex_incidents is
   * satisfied even when the service runs on the table-owner pool. The INC-####
   * identifier is derived from MAX() within the bound tenant inside the same
   * transaction, so two concurrent creators cannot mint the same id and a restart
   * resumes numbering from disk instead of from 1.
   */
  async createIncident(tenantId: string, input: {
    title: string;
    description: string;
    severity: Incident["severity"];
    sourceType: Incident["sourceType"];
    sourceId: string;
    sourceAgent: Incident["sourceAgent"];
  }): Promise<Incident> {
    const slaTargetMinutes = SLA_TARGETS[input.severity] ?? 480;

    const incident = await this.db.transaction(async (tx) => {
      await tx.execute(
        sql`SELECT set_config('app.current_tenant', ${tenantId}, true)`,
      );

      // Derive the next INC-#### suffix from the max already on disk for this
      // tenant. The INSERT is in the same transaction, so a concurrent creator
      // blocks on the unique PK conflict rather than duplicating an id.
      const nextSeq = await this.nextSequence(
        tx,
        sql`SELECT COALESCE(MAX(CAST(SUBSTRING(id FROM 5) AS INTEGER)), 0) AS max_seq FROM apex_incidents`,
      );
      const id = `INC-${String(nextSeq).padStart(4, "0")}`;
      const createdAt = new Date();

      await tx.execute(
        sql`
          INSERT INTO apex_incidents (
            id, tenant_id, title, description, severity, source_type, source_id,
            source_agent, status, sla_target_minutes, created_at
          ) VALUES (
            ${id}, ${tenantId}::uuid, ${input.title}, ${input.description},
            ${input.severity}, ${input.sourceType}, ${input.sourceId},
            ${input.sourceAgent}, 'detected', ${slaTargetMinutes}, ${createdAt}
          )
        `,
      );

      await this.insertTimelineEntry(
        tx,
        id,
        "Incident created",
        `Created from ${input.sourceAgent} ${input.sourceType} detection`,
        "system",
        input.sourceAgent,
      );

      const built: Incident = {
        id,
        tenantId,
        title: input.title,
        description: input.description,
        severity: input.severity,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        sourceAgent: input.sourceAgent,
        status: "detected",
        slaTargetMinutes,
        createdAt,
      };
      return built;
    });

    this.log.info(
      {
        event: "apex.incident.created",
        tenantId,
        incidentId: incident.id,
        severity: incident.severity,
        sourceType: incident.sourceType,
        sourceAgent: incident.sourceAgent,
        slaTargetMinutes: incident.slaTargetMinutes,
      },
      "apex incident created",
    );

    return incident;
  }

  /**
   * Auto-triage an incident based on severity and source.
   *
   * REAL IMPL (BLACKFYRE 2026-06): now reads/writes the durable row. An OPTIONAL
   * tenantId may be supplied to bind RLS context up front; otherwise it is resolved
   * from the fetched row (RLS still applies — see fetchIncident).
   */
  async triageIncident(incidentId: string, tenantId?: string): Promise<Incident | undefined> {
    const incident = await this.fetchIncident(incidentId, tenantId);
    if (!incident) return undefined;

    const responseTimeMinutes = Math.round(
      (new Date().getTime() - incident.createdAt.getTime()) / 60000,
    );

    await this.db.transaction(async (tx) => {
      await tx.execute(
        sql`SELECT set_config('app.current_tenant', ${incident.tenantId}, true)`,
      );
      await tx.execute(
        sql`
          UPDATE apex_incidents
          SET status = 'triaged', response_time_minutes = ${responseTimeMinutes}
          WHERE id = ${incidentId}
        `,
      );
      await this.insertTimelineEntry(
        tx,
        incidentId,
        "Auto-triaged",
        `Severity: ${incident.severity}, SLA: ${incident.slaTargetMinutes}min, Response: ${responseTimeMinutes}min`,
        "system",
        "apex",
      );
    });

    incident.status = "triaged";
    incident.responseTimeMinutes = responseTimeMinutes;

    const slaBreached = responseTimeMinutes > incident.slaTargetMinutes;
    this.log.info(
      {
        event: "apex.incident.triaged",
        tenantId: incident.tenantId,
        incidentId,
        severity: incident.severity,
        responseTimeMinutes,
        slaTargetMinutes: incident.slaTargetMinutes,
        slaBreached,
      },
      "apex incident triaged",
    );
    if (slaBreached) {
      this.log.warn(
        {
          event: "apex.incident.sla_breach",
          tenantId: incident.tenantId,
          incidentId,
          severity: incident.severity,
          responseTimeMinutes,
          slaTargetMinutes: incident.slaTargetMinutes,
        },
        "apex incident SLA breached",
      );
    }

    return incident;
  }

  /**
   * Update incident status with details.
   *
   * REAL IMPL (BLACKFYRE 2026-06): the status change, the optional root-cause /
   * lessons-learned fields, the resolved/closed timestamps, and the timeline entry
   * are all written in ONE transaction against the durable tables.
   */
  async updateIncidentStatus(
    incidentId: string,
    status: Incident["status"],
    details: { performedBy: string; notes?: string; rootCause?: string; lessonsLearned?: string },
    tenantId?: string,
  ): Promise<Incident | undefined> {
    const incident = await this.fetchIncident(incidentId, tenantId);
    if (!incident) return undefined;

    const resolvedAt = status === "resolved" ? new Date() : undefined;
    const closedAt = status === "closed" ? new Date() : undefined;
    const rootCause = details.rootCause ?? incident.rootCause ?? null;
    const lessonsLearned = details.lessonsLearned ?? incident.lessonsLearned ?? null;

    await this.db.transaction(async (tx) => {
      await tx.execute(
        sql`SELECT set_config('app.current_tenant', ${incident.tenantId}, true)`,
      );
      await tx.execute(
        sql`
          UPDATE apex_incidents
          SET status = ${status},
              root_cause = ${rootCause},
              lessons_learned = ${lessonsLearned},
              resolved_at = COALESCE(${resolvedAt ?? null}, resolved_at),
              closed_at = COALESCE(${closedAt ?? null}, closed_at)
          WHERE id = ${incidentId}
        `,
      );
      await this.insertTimelineEntry(
        tx,
        incidentId,
        `Status changed to ${status}`,
        details.notes ?? `Updated by ${details.performedBy}`,
        details.performedBy,
      );
    });

    incident.status = status;
    if (details.rootCause) incident.rootCause = details.rootCause;
    if (details.lessonsLearned) incident.lessonsLearned = details.lessonsLearned;
    if (resolvedAt) incident.resolvedAt = resolvedAt;
    if (closedAt) incident.closedAt = closedAt;

    this.log.info(
      {
        event: "apex.incident.status_changed",
        tenantId: incident.tenantId,
        incidentId,
        status,
        performedBy: details.performedBy,
      },
      "apex incident status changed",
    );

    return incident;
  }

  /**
   * Get incident timeline.
   */
  async getIncidentTimeline(incidentId: string, tenantId?: string): Promise<IncidentTimelineEntry[]> {
    const rows = await this.db.transaction(async (tx) => {
      if (tenantId) {
        await tx.execute(
          sql`SELECT set_config('app.current_tenant', ${tenantId}, true)`,
        );
      } else {
        await this.bindTenantForIncident(tx, incidentId);
      }
      return (await tx.execute(
        sql`
          SELECT id, incident_id, action, details, performed_by, agent_name, performed_at
          FROM apex_incident_timeline
          WHERE incident_id = ${incidentId}
          ORDER BY performed_at ASC
        `,
      )) as unknown as TimelineRow[];
    });

    return rows.map((r) => this.mapTimelineRow(r));
  }

  /**
   * Get incident by ID.
   */
  async getIncident(incidentId: string, tenantId?: string): Promise<Incident | undefined> {
    return this.fetchIncident(incidentId, tenantId);
  }

  /**
   * List incidents for a tenant.
   *
   * REAL IMPL (BLACKFYRE 2026-06): filters are applied as PARAMETERIZED SQL
   * predicates; the optional severity/status/sourceAgent filters are appended only
   * when present so no unused bind values leak into the query.
   */
  async listIncidents(tenantId: string, filter?: {
    status?: string;
    severity?: string;
    sourceAgent?: string;
    limit?: number;
  }): Promise<Incident[]> {
    const limit = filter?.limit ?? 50;

    const rows = await this.db.transaction(async (tx) => {
      await tx.execute(
        sql`SELECT set_config('app.current_tenant', ${tenantId}, true)`,
      );

      const conditions = [sql`tenant_id = ${tenantId}::uuid`];
      if (filter?.status) conditions.push(sql`status = ${filter.status}`);
      if (filter?.severity) conditions.push(sql`severity = ${filter.severity}`);
      if (filter?.sourceAgent) conditions.push(sql`source_agent = ${filter.sourceAgent}`);

      let whereClause = conditions[0];
      for (let i = 1; i < conditions.length; i++) {
        whereClause = sql`${whereClause} AND ${conditions[i]}`;
      }

      return (await tx.execute(
        sql`
          SELECT id, tenant_id, title, description, severity, source_type, source_id,
                 source_agent, status, assigned_to, sla_target_minutes,
                 response_time_minutes, root_cause, lessons_learned, created_at,
                 resolved_at, closed_at
          FROM apex_incidents
          WHERE ${whereClause}
          ORDER BY created_at DESC
          LIMIT ${limit}
        `,
      )) as unknown as IncidentRow[];
    });

    return rows.map((r) => this.mapIncidentRow(r));
  }

  /**
   * Get incident metrics.
   *
   * REAL IMPL (BLACKFYRE 2026-06): computed with aggregate SQL so the numbers are
   * derived from the durable store (including incidents created before the current
   * process started), not from a per-process Map.
   */
  async getIncidentMetrics(tenantId: string): Promise<{
    total: number;
    open: number;
    resolved: number;
    avgResponseMinutes: number;
    slaBreaches: number;
  }> {
    const rows = await this.db.transaction(async (tx) => {
      await tx.execute(
        sql`SELECT set_config('app.current_tenant', ${tenantId}, true)`,
      );
      return (await tx.execute(
        sql`
          SELECT
            COUNT(*)::int AS total,
            COUNT(*) FILTER (
              WHERE status NOT IN ('resolved', 'closed')
            )::int AS open,
            COUNT(*) FILTER (
              WHERE status IN ('resolved', 'closed')
            )::int AS resolved,
            COALESCE(
              ROUND(AVG(response_time_minutes) FILTER (
                WHERE response_time_minutes IS NOT NULL
              )),
              0
            )::int AS avg_response_minutes,
            COUNT(*) FILTER (
              WHERE response_time_minutes IS NOT NULL
                AND response_time_minutes > sla_target_minutes
            )::int AS sla_breaches
          FROM apex_incidents
          WHERE tenant_id = ${tenantId}::uuid
        `,
      )) as unknown as Array<{
        total: number;
        open: number;
        resolved: number;
        avg_response_minutes: number;
        sla_breaches: number;
      }>;
    });

    const m = rows[0];
    return {
      total: m?.total ?? 0,
      open: m?.open ?? 0,
      resolved: m?.resolved ?? 0,
      avgResponseMinutes: m?.avg_response_minutes ?? 0,
      slaBreaches: m?.sla_breaches ?? 0,
    };
  }

  /* ---------------------------------------------------------------- */
  /*  Internal helpers                                                */
  /* ---------------------------------------------------------------- */

  /**
   * Fetch one incident by id, binding RLS context. When tenantId is supplied it is
   * bound directly; otherwise the parent incident's tenant is resolved (still
   * RLS-scoped: the resolve itself runs under whatever context the connection
   * already carries, and the policy denies rows from other tenants).
   */
  private async fetchIncident(incidentId: string, tenantId?: string): Promise<Incident | undefined> {
    const rows = await this.db.transaction(async (tx) => {
      if (tenantId) {
        await tx.execute(
          sql`SELECT set_config('app.current_tenant', ${tenantId}, true)`,
        );
      } else {
        await this.bindTenantForIncident(tx, incidentId);
      }
      return (await tx.execute(
        sql`
          SELECT id, tenant_id, title, description, severity, source_type, source_id,
                 source_agent, status, assigned_to, sla_target_minutes,
                 response_time_minutes, root_cause, lessons_learned, created_at,
                 resolved_at, closed_at
          FROM apex_incidents
          WHERE id = ${incidentId}
          LIMIT 1
        `,
      )) as unknown as IncidentRow[];
    });

    const row = rows[0];
    return row ? this.mapIncidentRow(row) : undefined;
  }

  /**
   * Resolve and bind the tenant that owns an incident when the caller did not pass
   * one. The lookup reads tenant_id directly; the subsequent set_config makes the
   * remaining statements in the transaction RLS-correct for that tenant. If the
   * incident is not visible (or does not exist) the context is left unset, so the
   * deny-all policy returns no rows — fail closed.
   */
  private async bindTenantForIncident(tx: Tx, incidentId: string): Promise<void> {
    const rows = (await tx.execute(
      sql`SELECT tenant_id FROM apex_incidents WHERE id = ${incidentId} LIMIT 1`,
    )) as unknown as Array<{ tenant_id: string }>;
    const tenantId = rows[0]?.tenant_id;
    if (tenantId) {
      await tx.execute(
        sql`SELECT set_config('app.current_tenant', ${tenantId}, true)`,
      );
    }
  }

  /**
   * Insert one timeline entry within an existing transaction. The TL-# identifier
   * is derived from MAX() across the timeline table inside the same transaction so
   * it stays unique and durable across restarts. The tenant context must already
   * be bound by the caller (createIncident/triage/update all set it first).
   */
  private async insertTimelineEntry(
    tx: Tx,
    incidentId: string,
    action: string,
    details: string,
    performedBy: string,
    agentName?: string,
  ): Promise<void> {
    const nextSeq = await this.nextSequence(
      tx,
      sql`SELECT COALESCE(MAX(CAST(SUBSTRING(id FROM 4) AS INTEGER)), 0) AS max_seq FROM apex_incident_timeline`,
    );
    const id = `TL-${nextSeq}`;
    await tx.execute(
      sql`
        INSERT INTO apex_incident_timeline (
          id, incident_id, action, details, performed_by, agent_name, performed_at
        ) VALUES (
          ${id}, ${incidentId}, ${action}, ${details}, ${performedBy},
          ${agentName ?? null}, ${new Date()}
        )
      `,
    );
  }

  /** Read MAX(suffix)+1 for an INC-/TL- counter inside the given transaction. */
  private async nextSequence(tx: Tx, query: SQL): Promise<number> {
    const rows = (await tx.execute(query)) as unknown as Array<{ max_seq: string | number }>;
    return Number(rows[0]?.max_seq ?? 0) + 1;
  }

  private mapIncidentRow(row: IncidentRow): Incident {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      title: row.title,
      description: row.description,
      severity: row.severity,
      sourceType: row.source_type,
      sourceId: row.source_id,
      sourceAgent: row.source_agent,
      status: row.status,
      assignedTo: row.assigned_to ?? undefined,
      slaTargetMinutes: Number(row.sla_target_minutes),
      responseTimeMinutes: row.response_time_minutes == null ? undefined : Number(row.response_time_minutes),
      rootCause: row.root_cause ?? undefined,
      lessonsLearned: row.lessons_learned ?? undefined,
      createdAt: new Date(row.created_at),
      resolvedAt: row.resolved_at ? new Date(row.resolved_at) : undefined,
      closedAt: row.closed_at ? new Date(row.closed_at) : undefined,
    };
  }

  private mapTimelineRow(row: TimelineRow): IncidentTimelineEntry {
    return {
      id: row.id,
      incidentId: row.incident_id,
      action: row.action,
      details: row.details,
      performedBy: row.performed_by,
      agentName: row.agent_name ?? undefined,
      performedAt: new Date(row.performed_at),
    };
  }
}
