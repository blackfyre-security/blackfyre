-- ============================================================================
-- 009a_rls_enforcement.sql
-- SECURITY FIX (BLACKFYRE audit 2026-06-05): renamed from 010_rls_enforcement.sql.
-- The numeric prefix now reflects execution-order dependency: this foundational
-- tenant-isolation fix must run AFTER 009_refresh_tokens.sql but BEFORE the three
-- 010_* migrations (lexicographic sort orders 009a before 010_*), and the rename
-- also resolves the 010-prefix collision the audit flagged. The migration runner
-- (db/migrate.ts) discovers files via readdirSync().sort() and tracks applied
-- migrations by filename, so on a fresh database this name simply slots in at the
-- correct position.
-- SECURITY FIX (BLACKFYRE audit 2026-06-05): RLS fully inert — defense-in-depth
-- tenant isolation. The application connects as the TABLE OWNER, so Postgres
-- bypasses RLS by default, and the tenant context was being set on the wrong
-- pool at SESSION scope. This migration makes RLS actually enforce by:
--   1. providing a NON-owner, NON-superuser, NON-BYPASSRLS `app_user` role that
--      request-scoped queries run under via SET ROLE (the app process now drops
--      privileges per request — see plugins/auth.ts + app.ts request.db handle);
--   2. ENABLE + FORCE RLS on the core tenant-scoped tables so the policy is
--      applied even to the table owner;
--   3. (re)creating tenant-isolation policies that key on
--      current_setting('app.current_tenant', true) with the missing_ok=true flag
--      so an UNSET context yields NULL (deny-all) instead of throwing 42704, and
--      adding WITH CHECK so a row can never be written into another tenant.
--
-- Tenant tables created by LATER migrations (014/015/016/020) define their own
-- tenant_isolation policies + FORCE RLS; this migration deliberately covers the
-- core 001_initial_schema.sql tables (the ones that exist at this point) plus
-- the role/grants that every later SET ROLE depends on. Idempotent: safe to
-- re-run (IF NOT EXISTS / DROP POLICY IF EXISTS / guarded GRANTs).
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Non-owner application role. NOLOGIN is intentional: the app connects as the
--    owner and uses SET ROLE app_user per request, so app_user never logs in
--    directly. NOT superuser, NOT BYPASSRLS, NOT a table owner.
-- ----------------------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_user') THEN
    CREATE ROLE app_user NOLOGIN;
  END IF;
END $$;

-- Re-assert intended attributes even if an earlier migration created the role
-- with different ones. app_user must never bypass RLS or escalate.
-- NOTE: NOSUPERUSER/NOBYPASSRLS are superuser-only attributes — on managed
-- Postgres (AWS RDS) the master user is not a superuser and cannot set them, so
-- including them here fails with "permission denied to alter role". They are not
-- needed: CREATE ROLE ... NOLOGIN above never grants superuser/bypassrls (a fresh
-- role has neither), and on RDS no role can obtain them. We therefore re-assert
-- only the master-settable attributes; the no-escalation guarantee is preserved.
ALTER ROLE app_user NOLOGIN NOCREATEROLE NOCREATEDB;

-- DML on current + future app tables; USAGE/SELECT on sequences for nextval().
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO app_user;

-- Allow the application's login role(s) to SET ROLE app_user. The app connects
-- as the table owner; granting app_user TO that role (and to common bootstrap
-- roles) makes SET ROLE app_user succeed regardless of the owner name in this
-- environment. Guarded so a missing role is a no-op.
DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['blackfyre', 'postgres', CURRENT_USER] LOOP
    IF EXISTS (SELECT FROM pg_roles WHERE rolname = r) AND r <> 'app_user' THEN
      EXECUTE format('GRANT app_user TO %I', r);
    END IF;
  END LOOP;
END $$;

-- ----------------------------------------------------------------------------
-- 2 + 3. ENABLE + FORCE RLS and (re)create hardened, fail-closed policies on the
--    core tenant-scoped tables. Driven from a list for uniformity. Tables not
--    present in this environment are skipped (forward-compatible).
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  t text;
  tenant_keyed text[] := ARRAY[
    'users', 'api_keys', 'integrations', 'scans', 'findings', 'evidence',
    'alert_rules', 'reports', 'compliance_scores', 'drift_events'
  ];
BEGIN
  FOREACH t IN ARRAY tenant_keyed LOOP
    IF NOT EXISTS (
      SELECT FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t
    ) THEN
      CONTINUE;
    END IF;

    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_%s ON %I', t, t);
    -- USING gates reads/updates/deletes; WITH CHECK gates inserts/updates so a
    -- row can never be written into another tenant. missing_ok=true => unset
    -- context returns NULL => predicate false => deny-all (fail closed).
    EXECUTE format($f$
      CREATE POLICY tenant_isolation_%s ON %I
        USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
        WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid)
    $f$, t, t);
  END LOOP;
END $$;

-- tenants: isolated by id (not tenant_id).
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_tenants ON tenants;
CREATE POLICY tenant_isolation_tenants ON tenants
  USING (id = current_setting('app.current_tenant', true)::uuid)
  WITH CHECK (id = current_setting('app.current_tenant', true)::uuid);

-- remediations: no tenant_id column; isolate transitively via the parent
-- finding's tenant. WITH CHECK ensures a remediation can only be written for a
-- finding the current tenant owns.
ALTER TABLE remediations ENABLE ROW LEVEL SECURITY;
ALTER TABLE remediations FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_remediations ON remediations;
CREATE POLICY tenant_isolation_remediations ON remediations
  USING (finding_id IN (
    SELECT id FROM findings
    WHERE tenant_id = current_setting('app.current_tenant', true)::uuid
  ))
  WITH CHECK (finding_id IN (
    SELECT id FROM findings
    WHERE tenant_id = current_setting('app.current_tenant', true)::uuid
  ));

-- control_mappings: no tenant_id; isolate transitively via the parent finding.
DO $$ BEGIN
  IF EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'control_mappings'
  ) THEN
    EXECUTE 'ALTER TABLE control_mappings ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE control_mappings FORCE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_control_mappings ON control_mappings';
    EXECUTE $p$
      CREATE POLICY tenant_isolation_control_mappings ON control_mappings
        USING (finding_id IN (
          SELECT id FROM findings
          WHERE tenant_id = current_setting('app.current_tenant', true)::uuid
        ))
        WITH CHECK (finding_id IN (
          SELECT id FROM findings
          WHERE tenant_id = current_setting('app.current_tenant', true)::uuid
        ))
    $p$;
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- Note: cross-tenant reference tables intentionally have NO RLS and are NOT
-- granted tenant scoping: learning_patterns, threat_intel, regulatory_changes,
-- control_cross_mappings, remediation_playbooks, contact_submissions,
-- lead_notification_recipients. These are global / pre-tenant data. superDb
-- (the owner pool, no SET ROLE) is used for provisioning + platform-admin paths
-- and is documented to bypass RLS — callers there must filter tenant_id by hand.
-- ----------------------------------------------------------------------------

COMMIT;
