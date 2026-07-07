-- ============================================================================
-- 042_certification_readiness_assessments.sql
-- REAL IMPL (BLACKFYRE 2026-06): persist computed certification go/no-go
-- assessments (GAP-005).
--
-- GET /api/reports/readiness/:framework computes a real certification
-- readiness verdict { isReady, blockers, warnings } from the tenant's LATEST
-- compliance score for the framework + its open critical findings. Previously
-- there was NO certification-readiness endpoint at all and nothing was recorded,
-- so an auditor/board could not see "were we ready, and on what basis, at point
-- in time T". This migration creates the tenant-scoped, RLS-enforced
-- `certification_readiness_assessments` table that the route writes each time a
-- readiness check is run (via parameterized SQL — no db/schema.ts edit), giving a
-- durable, queryable history of go/no-go decisions and the score/blocker counts
-- they were based on.
--
-- Columns:
--   framework        — the framework the readiness verdict was computed for
--                      (validated against the framework enum so a bad value
--                      cannot be persisted).
--   is_ready         — the go/no-go verdict at computation time.
--   score            — the weighted compliance score (0-100) the verdict used.
--   blocker_count    — number of hard blockers found (drives is_ready=false).
--   warning_count    — number of soft warnings found.
--   open_critical    — open critical findings for the framework at that time.
--   details          — full structured { blockers, warnings, ... } snapshot as
--                      jsonb so the exact rationale is reproducible later.
--   computed_by      — the user who triggered the check (NULL for system runs).
--
-- Tenant isolation follows 009a_rls_enforcement.sql / 037_usage_meters.sql:
-- ENABLE + FORCE ROW LEVEL SECURITY with a fail-closed tenant_isolation policy
-- keyed on current_setting('app.current_tenant', true)::uuid (missing_ok=true =>
-- an UNSET context yields NULL => predicate false => deny-all). FORCE is required
-- because the app connects as the table owner (which would otherwise bypass RLS);
-- per-request queries run under SET ROLE app_user (NOBYPASSRLS). WITH CHECK
-- mirrors USING so an assessment row can never be written into another tenant.
-- Idempotent: safe to re-run (IF NOT EXISTS / DROP POLICY IF EXISTS / guarded
-- GRANT).
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS certification_readiness_assessments (
  id             uuid       PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid       NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  framework      framework  NOT NULL,
  is_ready       boolean    NOT NULL,
  score          integer    NOT NULL,
  blocker_count  integer    NOT NULL DEFAULT 0,
  warning_count  integer    NOT NULL DEFAULT 0,
  open_critical  integer    NOT NULL DEFAULT 0,
  details        jsonb      NOT NULL DEFAULT '{}'::jsonb,
  computed_by    uuid       REFERENCES users(id),
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- Most recent assessment per (tenant, framework) is the common read pattern
-- (dashboards / "are we ready now?"), so index tenant+framework newest-first.
CREATE INDEX IF NOT EXISTS certification_readiness_tenant_fw_idx
  ON certification_readiness_assessments (tenant_id, framework, created_at DESC);

-- ----------------------------------------------------------------------------
-- Tenant isolation: ENABLE + FORCE RLS with a fail-closed policy, mirroring
-- 009a_rls_enforcement.sql. Unset app.current_tenant => NULL => predicate false
-- => deny-all. WITH CHECK prevents writing an assessment for another tenant.
-- ----------------------------------------------------------------------------
ALTER TABLE certification_readiness_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE certification_readiness_assessments FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_certification_readiness ON certification_readiness_assessments;
CREATE POLICY tenant_isolation_certification_readiness ON certification_readiness_assessments
  USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);

-- Grant DML to the non-owner application role (created in 009a). ALTER DEFAULT
-- PRIVILEGES (also from 009a) should already cover this, but assert explicitly so
-- the table is reachable even if applied against a DB where those defaults were
-- not in scope at table-creation time.
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_user') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON certification_readiness_assessments TO app_user;
  END IF;
END $$;

COMMIT;
