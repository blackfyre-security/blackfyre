-- 013_stakeholder_branding.sql
-- Adds tenant_branding and stakeholder_links tables for the DEFEND-tier
-- stakeholder dashboard feature with client branding support.

BEGIN;

CREATE TABLE IF NOT EXISTS tenant_branding (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  logo_url        VARCHAR(500),
  primary_color   VARCHAR(7) DEFAULT '#FF4D00',
  secondary_color VARCHAR(7) DEFAULT '#F59E0B',
  company_name    VARCHAR(200),
  tagline         VARCHAR(300),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS tenant_branding_tenant_id_idx ON tenant_branding (tenant_id);

CREATE TABLE IF NOT EXISTS stakeholder_links (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES tenants(id),
  token            VARCHAR(64) NOT NULL UNIQUE,
  label            VARCHAR(200) NOT NULL,
  expires_at       TIMESTAMPTZ,
  frameworks       TEXT[],
  show_remediation BOOLEAN DEFAULT FALSE,
  show_trend       BOOLEAN DEFAULT TRUE,
  created_by       UUID NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_accessed_at TIMESTAMPTZ,
  access_count     INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS stakeholder_links_tenant_id_idx ON stakeholder_links (tenant_id);
CREATE INDEX IF NOT EXISTS stakeholder_links_token_idx     ON stakeholder_links (token);

COMMIT;
