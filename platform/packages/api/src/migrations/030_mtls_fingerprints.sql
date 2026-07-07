-- ============================================================================
-- 030_mtls_fingerprints.sql
-- REAL IMPL (BLACKFYRE 2026-06): persist the mTLS client-certificate allowlist.
--
-- Wave 2 persistence: the mTLS plugin (plugins/mtls.ts) built its per-tenant
-- allowed-fingerprint map ONCE at boot purely from the MTLS_ALLOWED_FINGERPRINTS
-- env var. Rotating or adding a client certificate therefore required a redeploy
-- (env change + restart) — a P3 operability gap for a security control. This
-- migration creates a tenant-scoped, RLS-enforced `mtls_fingerprints` table so
-- the allowlist can be managed in the database without redeploy. The plugin now
-- loads the allowlist from this table at boot and, on first boot when the table
-- is empty, seeds it from the env var (one-time bootstrap), after which the DB is
-- the source of truth. Verification behavior is unchanged: the plugin still keys
-- a Map<tenantId, Set<fingerprint>> and compares the presented cert fingerprint
-- exactly as before.
--
-- Tenant isolation follows the 009a_rls_enforcement.sql pattern: ENABLE + FORCE
-- ROW LEVEL SECURITY with a tenant_isolation policy keyed on
-- current_setting('app.current_tenant', true)::uuid (missing_ok=true => an UNSET
-- context yields NULL => deny-all, fail closed). WITH CHECK mirrors USING so a row
-- can never be written into another tenant. The non-owner `app_user` role created
-- in 009a runs request-scoped queries and cannot bypass RLS; it picks up DML on
-- this table via ALTER DEFAULT PRIVILEGES (also from 009a). Boot-time load + seed
-- run on the OWNER pool (superDb, bypasses RLS) because there is no tenant context
-- at boot — this is the same cross-tenant, pre-auth pattern auth.ts/scim-auth.ts
-- use. Idempotent: safe to re-run (IF NOT EXISTS / DROP POLICY IF EXISTS).
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS mtls_fingerprints (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  -- SHA-256 fingerprint, uppercase hex (matches computeFingerprint() in mtls.ts).
  fingerprint  text        NOT NULL,
  -- Optional human label for the cert (e.g. "edge-gateway-2026"); informational.
  label        text,
  -- Soft enable/disable without deleting, so a cert can be parked then re-enabled.
  enabled      boolean     NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  -- A fingerprint is unique WITHIN a tenant (the seed/manage paths upsert on it).
  CONSTRAINT mtls_fingerprints_tenant_fp_unique UNIQUE (tenant_id, fingerprint)
);

CREATE INDEX IF NOT EXISTS mtls_fingerprints_tenant_idx ON mtls_fingerprints (tenant_id);

-- Defense-in-depth tenant isolation (see 009a_rls_enforcement.sql).
ALTER TABLE mtls_fingerprints ENABLE ROW LEVEL SECURITY;
ALTER TABLE mtls_fingerprints FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_mtls_fingerprints ON mtls_fingerprints;
CREATE POLICY tenant_isolation_mtls_fingerprints ON mtls_fingerprints
  USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);

COMMIT;
