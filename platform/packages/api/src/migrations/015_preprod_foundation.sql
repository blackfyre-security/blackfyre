-- Migration 015: Pre-production foundation
-- Adds: client identity (tenants extension), cloud account trust (roleArn + externalId),
--       tenant contacts (SPOC roles), vault-backed integration credentials, audit log.
-- Required for: production onboarding of paying clients with multi-cloud trust + SOC2 audit trail.

-- =====================================================================
-- New enums
-- =====================================================================

DO $$ BEGIN
  CREATE TYPE region AS ENUM (
    'us-east-1', 'us-east-2', 'us-west-2',
    'eu-west-1', 'eu-west-2', 'eu-central-1',
    'ap-south-1', 'ap-southeast-1', 'ap-southeast-2', 'ap-northeast-1',
    'me-south-1', 'sa-east-1'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE tenant_status AS ENUM ('trial', 'active', 'suspended', 'churned');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE cloud_provider AS ENUM ('aws', 'azure', 'gcp');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE cloud_account_status AS ENUM ('pending', 'verifying', 'verified', 'error', 'suspended');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE contact_role AS ENUM (
    'primary_spoc', 'billing', 'security', 'technical', 'executive', 'legal', 'oncall_24x7'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE audit_actor_type AS ENUM ('user', 'system', 'integration', 'api_key');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE vault_provider AS ENUM ('aws_secrets_manager', 'hashicorp_vault', 'aws_kms_inline');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =====================================================================
-- Extend tenants table with client identity, contract, posture fields.
-- All new columns are nullable or defaulted so existing rows remain valid.
-- =====================================================================

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS client_number VARCHAR(32) UNIQUE,
  ADD COLUMN IF NOT EXISTS legal_name VARCHAR(300),
  ADD COLUMN IF NOT EXISTS display_name VARCHAR(200),
  ADD COLUMN IF NOT EXISTS logo_url TEXT,
  ADD COLUMN IF NOT EXISTS website_url TEXT,
  ADD COLUMN IF NOT EXISTS region region NOT NULL DEFAULT 'us-east-1',
  ADD COLUMN IF NOT EXISTS status tenant_status NOT NULL DEFAULT 'trial',
  ADD COLUMN IF NOT EXISTS contract_start_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS renewal_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS mrr_cents INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS mfa_required BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sso_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS data_residency_region region,
  ADD COLUMN IF NOT EXISTS tos_accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS tos_version VARCHAR(20),
  ADD COLUMN IF NOT EXISTS dpa_signed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS dpa_signer_name VARCHAR(200),
  ADD COLUMN IF NOT EXISTS dpa_signer_email VARCHAR(320);

CREATE INDEX IF NOT EXISTS tenants_client_number_idx ON tenants(client_number);
CREATE INDEX IF NOT EXISTS tenants_status_idx ON tenants(status);

-- Backfill client_number for existing rows using a deterministic format.
-- Format: BF-<YYYY>-<6-digit zero-padded sequence>
DO $$
DECLARE
  rec RECORD;
  seq INTEGER := 1;
  yr TEXT := to_char(NOW(), 'YYYY');
BEGIN
  FOR rec IN SELECT id FROM tenants WHERE client_number IS NULL ORDER BY created_at LOOP
    UPDATE tenants
       SET client_number = 'BF-' || yr || '-' || lpad(seq::text, 6, '0')
     WHERE id = rec.id;
    seq := seq + 1;
  END LOOP;
END $$;

-- =====================================================================
-- cloud_accounts — one client may link many cloud accounts (prod, staging, sandbox).
-- AWS: role_arn + external_id for cross-account sts:AssumeRole (confused-deputy mitigation).
-- Azure / GCP: provider-specific auth stored in credential_meta JSONB.
-- =====================================================================

CREATE TABLE IF NOT EXISTS cloud_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  provider cloud_provider NOT NULL,
  account_id VARCHAR(100) NOT NULL,
  account_alias VARCHAR(200),
  external_id VARCHAR(64) NOT NULL,
  role_arn TEXT,
  credential_meta JSONB,
  regions TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
  status cloud_account_status NOT NULL DEFAULT 'pending',
  last_verified_at TIMESTAMPTZ,
  verified_caller_arn TEXT,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, provider, account_id)
);

CREATE INDEX IF NOT EXISTS cloud_accounts_tenant_idx ON cloud_accounts(tenant_id);
CREATE INDEX IF NOT EXISTS cloud_accounts_provider_account_idx ON cloud_accounts(provider, account_id);
CREATE INDEX IF NOT EXISTS cloud_accounts_status_idx ON cloud_accounts(status);

ALTER TABLE cloud_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY cloud_accounts_tenant_isolation ON cloud_accounts
  USING (tenant_id = current_setting('app.current_tenant', true)::uuid);

-- =====================================================================
-- tenant_contacts — SPOC and functional contacts. Multiple per role allowed
-- (primary + backup) so losing one person doesn't break the relationship.
-- =====================================================================

CREATE TABLE IF NOT EXISTS tenant_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  role contact_role NOT NULL,
  name VARCHAR(200) NOT NULL,
  email VARCHAR(320) NOT NULL,
  phone VARCHAR(50),
  timezone VARCHAR(64),
  is_primary BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tenant_contacts_tenant_role_idx ON tenant_contacts(tenant_id, role);
CREATE INDEX IF NOT EXISTS tenant_contacts_email_idx ON tenant_contacts(email);

-- Enforce only one is_primary per (tenant_id, role) for active contacts.
CREATE UNIQUE INDEX IF NOT EXISTS tenant_contacts_one_primary_per_role
  ON tenant_contacts(tenant_id, role)
  WHERE is_primary = true AND is_active = true;

ALTER TABLE tenant_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_contacts_tenant_isolation ON tenant_contacts
  USING (tenant_id = current_setting('app.current_tenant', true)::uuid);

-- =====================================================================
-- integration_credentials — vault-backed pointer table. The vault_ref is an
-- ARN or path; the worker resolves it at scan time. Plaintext secrets are
-- forbidden — enforced by application layer + this comment.
-- =====================================================================

CREATE TABLE IF NOT EXISTS integration_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  integration_id UUID NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  vault_provider vault_provider NOT NULL,
  vault_ref TEXT NOT NULL,
  kms_key_id TEXT,
  scopes TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
  last_rotated_at TIMESTAMPTZ,
  rotation_due_at TIMESTAMPTZ,
  last_read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS integration_credentials_tenant_idx ON integration_credentials(tenant_id);
CREATE INDEX IF NOT EXISTS integration_credentials_integration_idx ON integration_credentials(integration_id);
CREATE INDEX IF NOT EXISTS integration_credentials_rotation_due_idx ON integration_credentials(rotation_due_at);

ALTER TABLE integration_credentials ENABLE ROW LEVEL SECURITY;
CREATE POLICY integration_credentials_tenant_isolation ON integration_credentials
  USING (tenant_id = current_setting('app.current_tenant', true)::uuid);

-- =====================================================================
-- Extend existing audit_logs table to support system/integration actors.
-- SOC2/ISO27001 require attribution for every privileged action; the existing
-- table only supported user-attributed events. user_id becomes nullable so
-- non-user actors (system, integration, api_key) can be logged.
--
-- audit_logs is normally created by the drizzle migrator from src/db/schema.ts.
-- Defensive CREATE here so SQL-only deployments (sandboxes, fresh clusters)
-- don't fail on the ALTERs below.
-- =====================================================================

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  user_id UUID,
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50),
  resource_id VARCHAR(255),
  details JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS audit_logs_tenant_id_idx ON audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS audit_logs_user_id_idx ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS audit_logs_action_idx ON audit_logs(action);
CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx ON audit_logs(created_at);

ALTER TABLE audit_logs ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE audit_logs
  ADD COLUMN IF NOT EXISTS actor_type audit_actor_type NOT NULL DEFAULT 'user',
  ADD COLUMN IF NOT EXISTS actor_id VARCHAR(200),
  ADD COLUMN IF NOT EXISTS actor_email VARCHAR(320),
  ADD COLUMN IF NOT EXISTS outcome VARCHAR(20) NOT NULL DEFAULT 'success';

-- Widen resource columns to match new schema.
ALTER TABLE audit_logs ALTER COLUMN resource_type TYPE VARCHAR(100);
ALTER TABLE audit_logs ALTER COLUMN resource_id TYPE VARCHAR(500);

CREATE INDEX IF NOT EXISTS audit_logs_actor_type_idx ON audit_logs(actor_type);
CREATE INDEX IF NOT EXISTS audit_logs_resource_idx ON audit_logs(resource_type, resource_id);
-- =====================================================================
-- End migration 015
-- =====================================================================
