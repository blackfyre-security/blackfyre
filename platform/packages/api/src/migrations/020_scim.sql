-- Migration 020_scim.sql  (ported from launch-blockers/w1-w4 016_scim.sql)
-- SCIM 2.0 provisioning support — RFC 7644/7643.
-- Adds scim_tokens table and extends users with SCIM-specific columns.
-- Soft-delete via deactivated_at is used on DELETE so audit trails are preserved
-- and IdPs that re-provision a deprovisioned user do not lose history.

CREATE TABLE IF NOT EXISTS scim_tokens (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  token_hash   text        NOT NULL UNIQUE,  -- argon2 hash of the bearer token
  name         text        NOT NULL,
  last_used_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  revoked_at   timestamptz
);

ALTER TABLE scim_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE scim_tokens FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_scim_tokens ON scim_tokens;
CREATE POLICY tenant_isolation_scim_tokens ON scim_tokens
  USING (tenant_id = current_setting('app.current_tenant')::uuid);

-- SCIM external ID fields on users
ALTER TABLE users ADD COLUMN IF NOT EXISTS scim_external_id  text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS scim_user_name    text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS deactivated_at    timestamptz;

-- Composite unique index: external_id is only unique within a tenant
CREATE UNIQUE INDEX IF NOT EXISTS users_tenant_scim_external_id_idx
  ON users (tenant_id, scim_external_id)
  WHERE scim_external_id IS NOT NULL;
