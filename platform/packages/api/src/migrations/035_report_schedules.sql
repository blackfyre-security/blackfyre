-- ============================================================================
-- 035_report_schedules.sql
-- REAL IMPL (BLACKFYRE 2026-06): persist recurring report schedules (GAP-018).
--
-- POST /api/reports/schedule previously returned a hardcoded 201 and did NOTHING
-- — no row was written and no recurring job was enqueued, so "scheduled" reports
-- were never generated or emailed. This migration creates the tenant-scoped,
-- RLS-enforced `report_schedules` table that the route now writes (via
-- parameterized SQL) before enqueuing a repeatable BullMQ job that generates the
-- report and emails it to the configured recipients on the requested cadence.
--
-- Columns:
--   framework    — optional framework the report targets (NULL for board_summary).
--   cadence      — 'daily' | 'weekly' | 'monthly' (drives the BullMQ repeat rule).
--   recipients   — text[] of recipient email addresses (PII; never logged verbatim).
--   next_run_at  — next scheduled fire time, advanced by the worker after each run.
--   format       — output format requested ('pdf' today; column future-proofs csv/json).
--   report_type  — which generator to invoke (readiness | gap_analysis |
--                  board_summary | evidence_package), validated against the
--                  report_type enum so a bad type cannot be persisted.
--   bull_job_id  — the BullMQ repeatable-job key, stored so the schedule can be
--                  paused / removed and so we never double-register the same job.
--
-- Tenant isolation follows the 009a_rls_enforcement.sql pattern: ENABLE + FORCE
-- ROW LEVEL SECURITY with a tenant_isolation policy keyed on
-- current_setting('app.current_tenant', true)::uuid (missing_ok=true => an UNSET
-- context yields NULL => deny-all, fail closed). WITH CHECK mirrors USING so a
-- schedule row can never be written into another tenant. The non-owner `app_user`
-- role created in 009a runs request-scoped queries and cannot bypass RLS; it picks
-- up DML on this table via ALTER DEFAULT PRIVILEGES (also from 009a).
-- Idempotent: safe to re-run (IF NOT EXISTS / DROP POLICY IF EXISTS).
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS report_schedules (
  id            uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  report_type   report_type  NOT NULL,
  framework     varchar(20),
  cadence       varchar(16)  NOT NULL,            -- 'daily' | 'weekly' | 'monthly'
  recipients    text[]       NOT NULL DEFAULT '{}',
  format        varchar(16)  NOT NULL DEFAULT 'pdf',
  -- BullMQ repeatable-job key; lets the schedule be removed/paused and prevents
  -- duplicate registration of the same recurring job.
  bull_job_id   text,
  next_run_at   timestamptz,
  last_run_at   timestamptz,
  active        boolean      NOT NULL DEFAULT true,
  created_by    uuid         REFERENCES users(id),
  created_at    timestamptz  NOT NULL DEFAULT now(),
  updated_at    timestamptz  NOT NULL DEFAULT now()
);

-- The worker scans for due schedules within a tenant, soonest first.
CREATE INDEX IF NOT EXISTS report_schedules_tenant_due_idx
  ON report_schedules (tenant_id, active, next_run_at);

-- Defense-in-depth tenant isolation (see 009a_rls_enforcement.sql).
ALTER TABLE report_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_schedules FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_report_schedules ON report_schedules;
CREATE POLICY tenant_isolation_report_schedules ON report_schedules
  USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);

COMMIT;
