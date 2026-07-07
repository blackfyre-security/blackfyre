-- ============================================================================
-- 034_monitoring_schedules.sql
-- REAL IMPL (BLACKFYRE 2026-06): persist continuous-monitoring schedules.
--
-- Wave 3 "make it actually fire": POST /api/monitoring/start and /stop used to
-- return hardcoded {status:"started"|"stopped"} JSON and did NOTHING — no row
-- written, no job enqueued, so continuous monitoring was a no-op. This migration
-- creates the tenant-scoped, RLS-enforced `monitoring_schedules` table that the
-- drift-service now reads/writes via parameterized SQL. Each row is a recurring
-- monitor for ONE integration (or a tenant-wide drift sweep when integration_id
-- is NULL): it records the cadence, the next_run_at the monitor poller compares
-- against, and an `enabled` flag (stop = enabled=false, NOT a hard delete, so the
-- schedule + its history survive a restart and can be re-enabled).
--
-- The monitor-worker (SQS `scheduled_scan`/`drift` check) reads due schedules
-- (enabled = true AND next_run_at <= now()), ACTUALLY enqueues a scan via
-- ScanService.create() when a scan is due, then advances next_run_at by the
-- cadence. The route enqueues/cancels the repeatable monitor job on the
-- MONITOR_QUEUE (SqsQueue) and persists/flips the row in the same request.
--
-- Tenant isolation follows the 009a_rls_enforcement.sql pattern: ENABLE + FORCE
-- ROW LEVEL SECURITY with a tenant_isolation policy keyed on
-- current_setting('app.current_tenant', true)::uuid (missing_ok=true => an UNSET
-- context yields NULL => deny-all, fail closed). WITH CHECK mirrors USING so a
-- row can never be written into another tenant. The non-owner `app_user` role
-- from 009a runs request-scoped queries and cannot bypass RLS; it picks up DML on
-- this table via ALTER DEFAULT PRIVILEGES (also from 009a). Idempotent: safe to
-- re-run (IF NOT EXISTS / DROP POLICY IF EXISTS).
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS monitoring_schedules (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  -- NULL => tenant-wide drift sweep across all integrations. Non-NULL => a
  -- per-integration monitor. ON DELETE CASCADE so removing an integration tears
  -- down its monitor.
  integration_id  uuid        REFERENCES integrations(id) ON DELETE CASCADE,
  -- Recurrence in seconds (the monitor poll/scan interval). Constrained to a sane
  -- floor (>= 5 min) so a misconfigured cadence can't hammer the scan queue.
  cadence_seconds integer     NOT NULL DEFAULT 86400,
  -- The monitor poller compares this against now(); when due, it enqueues a scan
  -- (or drift check) and advances this by cadence_seconds.
  next_run_at     timestamptz NOT NULL DEFAULT now(),
  last_run_at     timestamptz,
  -- stop = enabled=false (soft pause), NOT a hard delete.
  enabled         boolean     NOT NULL DEFAULT true,
  -- Which monitor check this schedule drives. Mirrors monitor-worker's checkType.
  check_type      text        NOT NULL DEFAULT 'scheduled_scan',
  -- Opaque reference to the enqueued repeatable monitor job (SQS messageId), kept
  -- so /stop can correlate the cancellation. Never a secret.
  job_ref         text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  -- At most ONE schedule per (tenant, integration) target. integration_id NULL is
  -- the tenant-wide sweep; NULLs are distinct in a UNIQUE index, so we enforce a
  -- single tenant-wide row via a partial unique index below.
  CONSTRAINT monitoring_schedules_cadence_chk CHECK (cadence_seconds >= 300),
  CONSTRAINT monitoring_schedules_check_type_chk
    CHECK (check_type IN ('scheduled_scan', 'drift', 'health_check'))
);

-- One monitor per (tenant, integration). For the tenant-wide sweep
-- (integration_id IS NULL) a partial unique index guarantees a single row.
CREATE UNIQUE INDEX IF NOT EXISTS monitoring_schedules_tenant_integration_uq
  ON monitoring_schedules (tenant_id, integration_id)
  WHERE integration_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS monitoring_schedules_tenant_sweep_uq
  ON monitoring_schedules (tenant_id)
  WHERE integration_id IS NULL;

-- Hot path for the poller: due, enabled schedules.
CREATE INDEX IF NOT EXISTS monitoring_schedules_due_idx
  ON monitoring_schedules (next_run_at)
  WHERE enabled = true;

CREATE INDEX IF NOT EXISTS monitoring_schedules_tenant_idx
  ON monitoring_schedules (tenant_id);

-- Defense-in-depth tenant isolation (see 009a_rls_enforcement.sql).
ALTER TABLE monitoring_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE monitoring_schedules FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_monitoring_schedules ON monitoring_schedules;
CREATE POLICY tenant_isolation_monitoring_schedules ON monitoring_schedules
  USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);

COMMIT;
