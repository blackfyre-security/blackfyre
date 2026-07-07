-- ============================================================================
-- 031_apex_incidents.sql
-- REAL IMPL (BLACKFYRE 2026-06): persist the APEX incident response store.
--
-- Wave 2 persistence: APEX incidents and their response timelines lived only in
-- two in-process Maps (services/apex/incident-service.ts `incidents` + `timelines`)
-- plus two module-level counters, and were ALL lost on every restart — a P2
-- durability gap for the incident-response control. Losing incidents also loses
-- the SLA/response-time history the metrics endpoint reports, and resetting the
-- in-memory counters would let post-restart inserts reuse INC-/TL- identifiers
-- that already exist on disk. This migration creates two tenant-scoped,
-- RLS-enforced tables — `apex_incidents` (the incident record) and
-- `apex_incident_timeline` (the append-only response timeline) — that the service
-- now reads/writes via parameterized SQL. The human-friendly INC-####/TL-#
-- identifiers remain the application-level IDs; they are stored as the text PKs so
-- the next counter value is derived from MAX() on disk and never collides after a
-- restart.
--
-- Tenant isolation follows the 009a_rls_enforcement.sql pattern: ENABLE + FORCE
-- ROW LEVEL SECURITY with a tenant_isolation policy keyed on
-- current_setting('app.current_tenant', true)::uuid (missing_ok=true => an UNSET
-- context yields NULL => deny-all, fail closed). WITH CHECK mirrors USING so a row
-- can never be written into another tenant. `apex_incident_timeline` has no
-- tenant_id column of its own; it is isolated transitively via its parent
-- incident (the same approach 009a uses for remediations / control_mappings), so a
-- timeline row can only ever be read or written for an incident the current tenant
-- owns. The non-owner `app_user` role created in 009a runs request-scoped queries
-- and cannot bypass RLS; it picks up DML on these tables via ALTER DEFAULT
-- PRIVILEGES (also from 009a). Idempotent: safe to re-run
-- (IF NOT EXISTS / DROP POLICY IF EXISTS).
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS apex_incidents (
  -- Application-level incident identifier ("INC-0001"); stable across restarts.
  id                      text        PRIMARY KEY,
  tenant_id               uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title                   text        NOT NULL,
  description             text        NOT NULL,
  severity                text        NOT NULL,
  source_type             text        NOT NULL,
  source_id               text        NOT NULL,
  source_agent            text        NOT NULL,
  status                  text        NOT NULL DEFAULT 'detected',
  assigned_to             text,
  sla_target_minutes      integer     NOT NULL,
  response_time_minutes   integer,
  root_cause              text,
  lessons_learned         text,
  created_at              timestamptz NOT NULL DEFAULT now(),
  resolved_at             timestamptz,
  closed_at               timestamptz,
  -- Guard the small closed sets the service understands.
  CONSTRAINT apex_incidents_severity_chk CHECK (
    severity IN ('p1', 'p2', 'p3', 'p4')
  ),
  CONSTRAINT apex_incidents_source_type_chk CHECK (
    source_type IN ('finding', 'drift', 'threat')
  ),
  CONSTRAINT apex_incidents_source_agent_chk CHECK (
    source_agent IN ('scout', 'pulse', 'signal')
  ),
  CONSTRAINT apex_incidents_status_chk CHECK (
    status IN (
      'detected', 'triaged', 'investigating', 'contained',
      'remediating', 'resolved', 'closed'
    )
  )
);

CREATE INDEX IF NOT EXISTS apex_incidents_tenant_idx
  ON apex_incidents (tenant_id);
-- Supports listIncidents() default ordering (newest first) and the
-- status/severity/source_agent filtered list + metrics scans.
CREATE INDEX IF NOT EXISTS apex_incidents_tenant_created_idx
  ON apex_incidents (tenant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS apex_incident_timeline (
  -- Application-level timeline identifier ("TL-1"); stable across restarts.
  id              text        PRIMARY KEY,
  incident_id     text        NOT NULL REFERENCES apex_incidents(id) ON DELETE CASCADE,
  action          text        NOT NULL,
  details         text        NOT NULL,
  performed_by    text        NOT NULL,
  agent_name      text,
  performed_at    timestamptz NOT NULL DEFAULT now()
);

-- getIncidentTimeline() reads all entries for one incident, oldest first.
CREATE INDEX IF NOT EXISTS apex_incident_timeline_incident_idx
  ON apex_incident_timeline (incident_id, performed_at ASC);

-- Defense-in-depth tenant isolation (see 009a_rls_enforcement.sql).
ALTER TABLE apex_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE apex_incidents FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_apex_incidents ON apex_incidents;
CREATE POLICY tenant_isolation_apex_incidents ON apex_incidents
  USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);

-- apex_incident_timeline: no tenant_id column; isolate transitively via the
-- parent incident's tenant. WITH CHECK ensures a timeline row can only be written
-- for an incident the current tenant owns.
ALTER TABLE apex_incident_timeline ENABLE ROW LEVEL SECURITY;
ALTER TABLE apex_incident_timeline FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_apex_incident_timeline ON apex_incident_timeline;
CREATE POLICY tenant_isolation_apex_incident_timeline ON apex_incident_timeline
  USING (incident_id IN (
    SELECT id FROM apex_incidents
    WHERE tenant_id = current_setting('app.current_tenant', true)::uuid
  ))
  WITH CHECK (incident_id IN (
    SELECT id FROM apex_incidents
    WHERE tenant_id = current_setting('app.current_tenant', true)::uuid
  ));

COMMIT;
