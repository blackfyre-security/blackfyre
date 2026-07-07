-- ============================================================================
-- 032_certin_incidents.sql
-- REAL IMPL (BLACKFYRE 2026-06): durable CERT-In incident + escalation state.
--
-- Wave 2 persistence: the CERT-In 6-hour SLA tracker (certin-sla-service.ts) kept
-- BOTH of its moving state structures in per-process in-memory Maps:
--   - `incidents`        : tenant -> incident -> { status, deadline, reportedAt, ... }
--   - `escalationsFired` : incident -> Set<escalation level already alerted>
-- Both are LOST on every process restart / Lambda cold start. For a REGULATORY
-- SLA tracker that is a compliance break, not a caching nuisance: after a restart
-- the service would forget open incidents (so it would stop counting down toward
-- the mandatory CERT-In reporting deadline and never escalate them) and would
-- forget which escalation thresholds had already fired (so it could re-spam the
-- warning/urgent/critical/overdue alerts, or — worse — skip them entirely on a
-- fresh-but-recovered incident). This migration makes that state durable.
--
-- Two tenant-scoped tables:
--   certin_incidents             — one row per tracked incident. Holds the SLA
--                                  clock (detected_at, sla_deadline), lifecycle
--                                  status, and the report receipt (reported_at,
--                                  certin_reference_id). The deadline is stored
--                                  (not recomputed) so the 6h window is fixed at
--                                  detection time and survives clock/config drift.
--   certin_incident_escalations  — one row per (incident, level) escalation that
--                                  has already fired. Its presence is the idempotency
--                                  key: checkAndEscalate() only alerts a level when
--                                  no row exists, so a restart cannot re-fire an
--                                  already-sent alert. The composite PK enforces the
--                                  fire-once contract at the database.
--
-- Tenant isolation follows the 009a_rls_enforcement.sql pattern: ENABLE + FORCE
-- ROW LEVEL SECURITY with a tenant_isolation policy keyed on
-- current_setting('app.current_tenant', true)::uuid (missing_ok=true => an UNSET
-- context yields NULL => deny-all, fail closed). WITH CHECK mirrors USING so a row
-- can never be written into another tenant. FORCE is required because the app
-- connects as the table owner (which would otherwise bypass RLS); per-request /
-- per-job queries run with app.current_tenant bound for that tenant. The non-owner
-- `app_user` role created in 009a runs request-scoped queries and cannot bypass
-- RLS; it picks up DML on these tables via ALTER DEFAULT PRIVILEGES (also from
-- 009a), and the explicit guarded GRANT below asserts it even on databases where
-- those defaults were not in scope at table-creation time.
--
-- The escalations table isolates transitively via its parent incident's tenant
-- (it carries no tenant_id of its own — a (incident, level) escalation is
-- meaningless apart from its incident), mirroring the remediations/control_mappings
-- transitive policies in 009a_rls_enforcement.sql.
--
-- Idempotent: safe to re-run (IF NOT EXISTS / DROP POLICY IF EXISTS / guarded
-- GRANT). No app data is logged here; secrets are never stored in these tables.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. certin_incidents — the durable SLA-tracked incidents.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS certin_incidents (
  -- Matches CertInIncident.id (app-generated UUID). Used as the natural key by
  -- markReported(incidentId) and as the FK target of the escalations table.
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  -- The finding that triggered this incident (free text: the service passes the
  -- finding title from the agent feed, which is not a findings.id FK).
  finding_id          text        NOT NULL,
  -- Closed set the service understands. Only critical/high findings open a CERT-In
  -- incident, but the status set also covers the lifecycle transitions.
  severity            text        NOT NULL,
  -- Detection time + the FIXED 6h deadline (stored, not recomputed — see header).
  detected_at         timestamptz NOT NULL,
  sla_deadline        timestamptz NOT NULL,
  -- Lifecycle: open -> (acknowledged) -> reported, or open -> overdue.
  status              text        NOT NULL DEFAULT 'open',
  -- Report receipt, set by markReported(). NULL until reported.
  reported_at         timestamptz,
  certin_reference_id text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT certin_incidents_severity_chk
    CHECK (severity IN ('critical', 'high')),
  CONSTRAINT certin_incidents_status_chk
    CHECK (status IN ('open', 'reported', 'overdue', 'acknowledged'))
);

-- Read paths filter by tenant + status (open/overdue lists) and order by the
-- SLA clock; index the common access patterns.
CREATE INDEX IF NOT EXISTS certin_incidents_tenant_status_idx
  ON certin_incidents (tenant_id, status);
CREATE INDEX IF NOT EXISTS certin_incidents_tenant_deadline_idx
  ON certin_incidents (tenant_id, sla_deadline);

-- ----------------------------------------------------------------------------
-- 2. certin_incident_escalations — durable fire-once escalation ledger.
--    One row == "this level has already been alerted for this incident".
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS certin_incident_escalations (
  incident_id uuid        NOT NULL
    REFERENCES certin_incidents(id) ON DELETE CASCADE,
  -- warning | urgent | critical | overdue (the EscalationThreshold levels).
  level       text        NOT NULL,
  fired_at    timestamptz NOT NULL DEFAULT now(),
  -- The composite PK enforces fire-once: a second attempt to record the same
  -- (incident, level) conflicts, so an already-sent alert can never re-fire.
  PRIMARY KEY (incident_id, level),
  CONSTRAINT certin_incident_escalations_level_chk
    CHECK (level IN ('warning', 'urgent', 'critical', 'overdue'))
);

CREATE INDEX IF NOT EXISTS certin_incident_escalations_incident_idx
  ON certin_incident_escalations (incident_id);

-- ----------------------------------------------------------------------------
-- 3. Tenant isolation: ENABLE + FORCE RLS with fail-closed policies, mirroring
--    009a_rls_enforcement.sql. Unset app.current_tenant => NULL => predicate
--    false => deny-all. WITH CHECK prevents writing a row into another tenant.
-- ----------------------------------------------------------------------------
ALTER TABLE certin_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE certin_incidents FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_certin_incidents ON certin_incidents;
CREATE POLICY tenant_isolation_certin_incidents ON certin_incidents
  USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);

-- Escalations carry no tenant_id; isolate transitively via the parent incident's
-- tenant (mirrors the remediations / control_mappings transitive policies in
-- 009a_rls_enforcement.sql). WITH CHECK ensures an escalation can only be written
-- for an incident the current tenant owns.
ALTER TABLE certin_incident_escalations ENABLE ROW LEVEL SECURITY;
ALTER TABLE certin_incident_escalations FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_certin_incident_escalations
  ON certin_incident_escalations;
CREATE POLICY tenant_isolation_certin_incident_escalations
  ON certin_incident_escalations
  USING (incident_id IN (
    SELECT id FROM certin_incidents
    WHERE tenant_id = current_setting('app.current_tenant', true)::uuid
  ))
  WITH CHECK (incident_id IN (
    SELECT id FROM certin_incidents
    WHERE tenant_id = current_setting('app.current_tenant', true)::uuid
  ));

-- ----------------------------------------------------------------------------
-- 4. Grant DML to the non-owner application role (created in 009a). Default
--    privileges (also set in 009a) should already cover this, but assert it
--    explicitly so the tables are reachable even on a DB where those defaults
--    were not in scope at table-creation time.
-- ----------------------------------------------------------------------------
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_user') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON certin_incidents TO app_user;
    GRANT SELECT, INSERT, UPDATE, DELETE ON certin_incident_escalations TO app_user;
  END IF;
END $$;

COMMIT;
