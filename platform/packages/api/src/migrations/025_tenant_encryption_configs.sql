-- ============================================================================
-- 025_tenant_encryption_configs.sql
-- REAL IMPL (BLACKFYRE 2026-06): durable per-tenant sovereignty configuration.
--
-- EncryptionProviderService previously kept each tenant's EncryptionConfig
-- (BYOK mode + key references) and GeoPin (data-residency constraints) in
-- per-process in-memory Maps that were LOST on every restart / Lambda cold
-- start. For a sovereignty / data-residency product that means a tenant's BYOK
-- selection and geo-pinning silently EVAPORATE after a deploy, and the service
-- falls back to vendor-managed encryption in an arbitrary region — a fake
-- durability claim. This migration creates the persistent, RLS-isolated tables
-- that back the real implementation:
--
--   tenant_encryption_configs : one row per tenant. The encryption MODE plus the
--     non-secret key REFERENCES (AWS KMS key ARN; Azure Key Vault URL / key name
--     / key version; Azure service-principal tenant + client ids; region).
--     The Azure CLIENT SECRET is stored as an AES-256-GCM SecretEnvelope
--     (azure_client_secret_enc, JSONB) produced by EncryptionProviderService
--     .encryptSecret() — it is NEVER stored in plaintext. NULL when no service
--     principal is configured (DefaultAzureCredential / managed identity path).
--
--   tenant_geo_pins : one row per tenant. The allowed regions, primary region,
--     applicable data-residency law, and whether enforcement is active.
--
-- Tenant isolation matches 009a_rls_enforcement.sql / 022_evidence_chain.sql:
-- ENABLE + FORCE ROW LEVEL SECURITY with a fail-closed tenant_isolation policy
-- keyed on current_setting('app.current_tenant', true)::uuid (missing_ok=true =>
-- unset context yields NULL => predicate false => deny-all). FORCE is required
-- because the app connects as the table owner; per-request queries run under
-- SET ROLE app_user (NOBYPASSRLS).
--
-- Idempotent: safe to re-run (IF NOT EXISTS / DROP POLICY IF EXISTS / guarded
-- GRANTs).
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- tenant_encryption_configs: per-tenant BYOK / managed encryption selection.
-- PRIMARY KEY is tenant_id (exactly one config per tenant — setTenantConfig is
-- an upsert). Only NON-secret key references live here; the Azure client secret
-- is an encrypted SecretEnvelope, never plaintext.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tenant_encryption_configs (
  tenant_id               uuid PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  mode                    varchar(40) NOT NULL DEFAULT 'blackfyre-managed',
  aws_kms_key_arn         text,
  azure_key_vault_url     text,
  azure_key_name          text,
  azure_key_version       text,
  azure_tenant_id         text,
  azure_client_id         text,
  -- AES-256-GCM SecretEnvelope JSON (ciphertext/nonce/authTag/keyId/alg) of the
  -- Azure service-principal client secret. NEVER plaintext. NULL when no service
  -- principal is configured.
  azure_client_secret_enc jsonb,
  region                  text,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- tenant_geo_pins: per-tenant geographic pinning / data-residency constraints.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tenant_geo_pins (
  tenant_id          uuid PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  allowed_regions    text[] NOT NULL DEFAULT '{}',
  primary_region     text NOT NULL,
  data_residency_law text NOT NULL DEFAULT '',
  enforced           boolean NOT NULL DEFAULT false,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- Tenant isolation: ENABLE + FORCE RLS with fail-closed policies, mirroring
-- 009a_rls_enforcement.sql. Unset app.current_tenant => NULL => deny-all.
-- ----------------------------------------------------------------------------
ALTER TABLE tenant_encryption_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_encryption_configs FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_tenant_encryption_configs ON tenant_encryption_configs;
CREATE POLICY tenant_isolation_tenant_encryption_configs ON tenant_encryption_configs
  USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);

ALTER TABLE tenant_geo_pins ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_geo_pins FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_tenant_geo_pins ON tenant_geo_pins;
CREATE POLICY tenant_isolation_tenant_geo_pins ON tenant_geo_pins
  USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);

-- ----------------------------------------------------------------------------
-- Grant DML to the non-owner application role (created in 009a). Default
-- privileges (also set in 009a) cover future grants, but assert explicitly so
-- these tables are reachable even if applied against a DB where the defaults
-- were not in scope at table-creation time.
-- ----------------------------------------------------------------------------
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_user') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON tenant_encryption_configs TO app_user;
    GRANT SELECT, INSERT, UPDATE, DELETE ON tenant_geo_pins TO app_user;
  END IF;
END $$;

COMMIT;
