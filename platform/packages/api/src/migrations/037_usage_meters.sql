-- ============================================================================
-- 037_usage_meters.sql
-- REAL IMPL (BLACKFYRE 2026-06): durable per-tenant usage metering + quota state.
--
-- Wave 4 billing fix. Plans defined hard limits (cloud accounts, AI access,
-- scan cadence) in @blackfyre/shared PLANS / provisioning-service PLAN_FEATURES,
-- but NOTHING counted or enforced consumption: a Comply tenant could enqueue an
-- unbounded number of scans / AI calls and store unlimited evidence, so the
-- per-plan limits were "defined but unenforced". That is exactly the founder
-- mandate violation (nothing unenforced/hardcoded).
--
-- This migration creates the tenant-scoped `usage_meters` table: one row per
-- (tenant, metric, billing period). The current period is identified by
-- `period_start` (the first day of the calendar month, at UTC midnight). When the
-- month rolls over the inserted period_start changes, so a NEW row is created and
-- the quota naturally resets — there is no cron/reset job to forget to run.
--   - metric       : the metered dimension. Free-form text so new meters can be
--                    added without a schema change, but in practice one of
--                    'scans' | 'ai_calls' | 'evidence_bytes' (see usage-meter-service).
--   - period_start : first instant of the billing month (UTC), e.g. 2026-06-01.
--   - count        : bigint running total for that (tenant, metric, period).
--                    bigint because 'evidence_bytes' can exceed 2^31.
-- UNIQUE(tenant_id, metric, period_start) makes the service's
-- INSERT ... ON CONFLICT DO UPDATE upsert atomic and race-free under concurrency:
-- two concurrent increments for the same meter both target the same row and the
-- second blocks on the row lock, so no increment is lost.
--
-- Tenant isolation matches 009a_rls_enforcement.sql / 026_audit_chain_state.sql:
-- ENABLE + FORCE ROW LEVEL SECURITY with a fail-closed tenant_isolation policy
-- keyed on current_setting('app.current_tenant', true)::uuid (missing_ok=true =>
-- an UNSET context yields NULL => predicate false => deny-all). FORCE is required
-- because the app connects as the table owner (which would otherwise bypass RLS);
-- per-request queries run under SET ROLE app_user (NOBYPASSRLS).
--
-- Idempotent: safe to re-run (IF NOT EXISTS / DROP POLICY IF EXISTS / guarded
-- GRANT).
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS usage_meters (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  -- Metered dimension, e.g. 'scans' | 'ai_calls' | 'evidence_bytes'. Text (not an
  -- enum) so new meters can be introduced from the service without a migration.
  metric        text NOT NULL,
  -- First instant of the billing month (UTC midnight on day 1). A new month yields
  -- a new period_start => a new row => quota resets with zero moving parts.
  period_start  timestamptz NOT NULL,
  -- Running total for (tenant, metric, period). bigint: evidence_bytes can exceed
  -- 2^31 and large tenants can accumulate very high call counts.
  count         bigint NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  -- Exactly one row per (tenant, metric, period) — the anchor for the service's
  -- atomic INSERT ... ON CONFLICT DO UPDATE upsert.
  CONSTRAINT usage_meters_tenant_metric_period_key
    UNIQUE (tenant_id, metric, period_start)
);

-- Fast lookups for getUsage/enforceQuota: pin to a single (tenant, metric) and
-- read its current-period row. The UNIQUE constraint already provides the exact
-- (tenant, metric, period) match; this index keeps per-(tenant, metric) listings
-- (e.g. usage dashboards across periods) efficient too.
CREATE INDEX IF NOT EXISTS idx_usage_meters_tenant_metric
  ON usage_meters (tenant_id, metric);

-- ----------------------------------------------------------------------------
-- Tenant isolation: ENABLE + FORCE RLS with a fail-closed policy, mirroring
-- 009a_rls_enforcement.sql. Unset app.current_tenant => NULL => predicate false
-- => deny-all. WITH CHECK prevents writing a meter row for another tenant.
-- ----------------------------------------------------------------------------
ALTER TABLE usage_meters ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_meters FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_usage_meters ON usage_meters;
CREATE POLICY tenant_isolation_usage_meters ON usage_meters
  USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);

-- Grant DML to the non-owner application role (created in 009a). Default
-- privileges (also set in 009a) should already cover this, but assert explicitly
-- so the table is reachable even if applied against a DB where those defaults
-- were not in scope at table-creation time.
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_user') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON usage_meters TO app_user;
  END IF;
END $$;

COMMIT;
