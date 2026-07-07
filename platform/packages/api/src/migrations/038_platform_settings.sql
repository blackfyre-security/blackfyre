-- ============================================================================
-- 038_platform_settings.sql
-- REAL IMPL (BLACKFYRE 2026-06): persist PLATFORM-GLOBAL settings (Wave 4).
--
-- GET/PATCH /api/admin/settings previously returned and accepted a HARDCODED
-- object: maintenanceMode:false, maxScansPerTenant:10, retentionDays:365,
-- mfaRequired:false, sessionTimeout:900, etc. The PATCH handler computed
-- Object.keys(body) and threw the change away — nothing was stored, so toggling
-- maintenance mode or tightening retention did nothing across restarts. For a
-- founder mandate of "nothing unenforced / hardcoded", platform settings must be
-- durable and authoritative.
--
-- This migration creates the platform-global `platform_settings` table. Unlike
-- the tenant-scoped tables in 009a_rls_enforcement.sql this is NOT tenant data:
-- it is a single, platform-wide configuration row shared by every tenant and the
-- platform-admin console. It therefore deliberately has NO tenant_id column, NO
-- ROW LEVEL SECURITY and NO tenant_isolation policy — RLS keyed on
-- app.current_tenant would make a platform-global row unreadable (fail-closed
-- deny-all) under the per-request SET ROLE app_user connection. Access is gated
-- in the application layer instead: only the platform-admin preHandler
-- (users.is_platform_admin = true) can read or write it, and the route uses the
-- owner pool (app.superDb, no SET ROLE) which is documented to bypass RLS for
-- platform-admin paths.
--
-- Schema: a single authoritative row pinned by a CHECK-constrained singleton id.
-- `id` is fixed to TRUE so there can only ever be one row (ON CONFLICT (id) DO
-- UPDATE makes the upsert the route uses race-free). Settings live in a typed set
-- of columns (so a typo cannot smuggle in an unenforced key) plus a `notifications`
-- jsonb for the channel-enabled flags the response shape carries. No card or
-- secret data is ever stored here — SMTP/Slack credentials stay in env; this row
-- only records operator toggles. Defaults mirror the previous hardcoded values so
-- the response shape is unchanged on a fresh DB.
--
-- Idempotent: safe to re-run (IF NOT EXISTS / guarded GRANT / ON CONFLICT seed).
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS platform_settings (
  -- Singleton guard: exactly one row, always id = TRUE. The route upserts with
  -- ON CONFLICT (id) so concurrent writers converge on this one row.
  id                   boolean PRIMARY KEY DEFAULT TRUE,
  maintenance_mode     boolean NOT NULL DEFAULT FALSE,
  max_scans_per_tenant integer NOT NULL DEFAULT 10,
  retention_days       integer NOT NULL DEFAULT 365,
  mfa_required         boolean NOT NULL DEFAULT FALSE,
  session_timeout      integer NOT NULL DEFAULT 900,
  -- channel-enabled toggles for the notifications block of the response shape.
  -- Credentials are NOT stored here (SMTP/Slack secrets stay in env); these are
  -- operator on/off switches only.
  notifications        jsonb  NOT NULL DEFAULT '{"emailEnabled":false,"slackEnabled":false,"webhookEnabled":false}'::jsonb,
  updated_at           timestamptz NOT NULL DEFAULT now(),
  -- the platform-admin user id that last wrote the row (audit/forensics).
  updated_by           uuid REFERENCES users(id) ON DELETE SET NULL,
  -- Enforce the singleton: id may only ever be TRUE.
  CONSTRAINT platform_settings_singleton CHECK (id = TRUE)
);

-- Seed the single authoritative row with the previous hardcoded defaults so the
-- GET response shape is identical on a fresh database. ON CONFLICT no-op keeps
-- this idempotent and never clobbers operator-set values on re-run.
INSERT INTO platform_settings (id) VALUES (TRUE)
  ON CONFLICT (id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- NO ROW LEVEL SECURITY: this is a platform-global table (see header). It is
-- read/written exclusively through the platform-admin-gated route on the owner
-- pool (app.superDb). Grant DML to the non-owner app_user role created in 009a
-- for completeness/defence-in-depth, guarded so a missing role is a no-op.
-- ----------------------------------------------------------------------------
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_user') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON platform_settings TO app_user;
  END IF;
END $$;

COMMIT;
