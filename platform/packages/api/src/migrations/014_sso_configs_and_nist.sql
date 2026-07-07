-- Migration 014: SSO Configs table + NIST 800-53 framework enum value
-- Required for: SAML/SSO authentication, NIST 800-53 compliance scanning

-- Add nist80053 to framework enum
ALTER TYPE framework ADD VALUE IF NOT EXISTS 'nist80053';

-- Create SSO configuration table for SAML/SSO per tenant
CREATE TABLE IF NOT EXISTS sso_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL UNIQUE REFERENCES tenants(id),
  provider VARCHAR(50) NOT NULL,
  entity_id TEXT NOT NULL,
  sso_url TEXT NOT NULL,
  certificate TEXT NOT NULL,
  default_role user_role NOT NULL DEFAULT 'viewer',
  auto_provision BOOLEAN NOT NULL DEFAULT true,
  enabled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for tenant lookup
CREATE INDEX IF NOT EXISTS sso_configs_tenant_id_idx ON sso_configs(tenant_id);

-- RLS policy for sso_configs
ALTER TABLE sso_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY sso_configs_tenant_isolation ON sso_configs
  USING (tenant_id = current_setting('app.current_tenant', true)::uuid);
