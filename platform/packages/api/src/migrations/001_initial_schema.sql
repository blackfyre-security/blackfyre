-- 001_initial_schema.sql
-- Creates all tables, enums, indexes, and RLS policies for the BLACKFYRE platform.
-- Matches schema.ts exactly.

BEGIN;

-- ============================================================================
-- ENUMS
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE tenant_plan AS ENUM ('retainer', 'project', 'hourly', 'annual');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE industry_profile AS ENUM ('fintech', 'healthtech', 'saas', 'ecommerce', 'custom');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE onboarding_status AS ENUM ('pending', 'configuring', 'scanning', 'active', 'suspended');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('owner', 'admin', 'engineer', 'viewer');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE integration_type AS ENUM ('aws', 'azure', 'gcp', 'okta', 'azure_ad', 'google_workspace', 'jamf', 'intune', 'crowdstrike', 'network');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE integration_status AS ENUM ('active', 'error', 'expired');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE scan_status AS ENUM ('queued', 'running', 'completed', 'completed_partial', 'failed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE severity AS ENUM ('critical', 'high', 'medium', 'low', 'info');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE finding_status AS ENUM ('open', 'acknowledged', 'in_progress', 'resolved', 'dismissed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE finding_category AS ENUM ('iam', 'encryption', 'logging', 'network', 'endpoint', 'identity', 'config');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE remediation_tier AS ENUM ('auto', 'approval', 'manual');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE framework AS ENUM ('soc2', 'iso27001', 'hipaa', 'gdpr', 'pcidss');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE control_status AS ENUM ('pass', 'partial', 'fail', 'na');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE evidence_type AS ENUM ('config_snapshot', 'api_response', 'screenshot', 'manual_upload');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE remediation_status AS ENUM ('pending', 'approved', 'executing', 'completed', 'failed', 'rolled_back');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE alert_trigger_type AS ENUM ('severity', 'score_drop', 'drift', 'scan_complete', 'deadline', 'regulatory');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE report_type AS ENUM ('readiness', 'evidence_package', 'board_summary', 'gap_analysis');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE report_status AS ENUM ('generating', 'ready', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE drift_change_type AS ENUM ('created', 'modified', 'deleted');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- TABLES (ordered by foreign key dependencies)
-- ============================================================================

-- 1. tenants (no FK deps)
CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL,
  slug VARCHAR(100) NOT NULL UNIQUE,
  plan tenant_plan NOT NULL,
  industry_profile industry_profile NOT NULL DEFAULT 'custom',
  onboarding_status onboarding_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. users (FK -> tenants)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email VARCHAR(320) NOT NULL UNIQUE,
  name VARCHAR(200) NOT NULL,
  password_hash TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'viewer',
  mfa_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  mfa_secret TEXT,
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. api_keys (FK -> users, tenants)
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  key_hash TEXT NOT NULL,
  prefix VARCHAR(12) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ
);

-- 4. integrations (FK -> tenants)
CREATE TABLE IF NOT EXISTS integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  type integration_type NOT NULL,
  credential_ref TEXT NOT NULL,
  status integration_status NOT NULL DEFAULT 'active',
  last_verified_at TIMESTAMPTZ
);

-- 5. scans (FK -> tenants, users)
CREATE TABLE IF NOT EXISTS scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  triggered_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  frameworks TEXT[] NOT NULL,
  targets TEXT[] NOT NULL,
  status scan_status NOT NULL DEFAULT 'queued',
  progress INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_details TEXT,
  agent_swarm_id TEXT
);

-- 6. findings (FK -> scans, tenants)
CREATE TABLE IF NOT EXISTS findings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id UUID NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title VARCHAR(500) NOT NULL,
  description TEXT NOT NULL,
  severity severity NOT NULL,
  status finding_status NOT NULL DEFAULT 'open',
  category finding_category NOT NULL,
  resource_type VARCHAR(200),
  resource_id VARCHAR(500),
  resource_region VARCHAR(100),
  remediation_tier remediation_tier NOT NULL,
  auto_fix_available BOOLEAN NOT NULL DEFAULT FALSE,
  dedup_hash VARCHAR(64) NOT NULL
);

-- 7. control_mappings (FK -> findings)
CREATE TABLE IF NOT EXISTS control_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  finding_id UUID NOT NULL REFERENCES findings(id) ON DELETE CASCADE,
  framework framework NOT NULL,
  control_id VARCHAR(50) NOT NULL,
  control_name VARCHAR(300) NOT NULL,
  status control_status NOT NULL,
  weight INTEGER NOT NULL DEFAULT 1
);

-- 8. evidence (FK -> findings, tenants)
CREATE TABLE IF NOT EXISTS evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  finding_id UUID NOT NULL REFERENCES findings(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  type evidence_type NOT NULL,
  storage_path TEXT NOT NULL,
  sha256_hash VARCHAR(64) NOT NULL,
  collected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  collected_by VARCHAR(200) NOT NULL
);

-- 9. remediations (FK -> findings, users)
CREATE TABLE IF NOT EXISTS remediations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  finding_id UUID NOT NULL REFERENCES findings(id) ON DELETE CASCADE,
  tier remediation_tier NOT NULL,
  status remediation_status NOT NULL DEFAULT 'pending',
  approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  before_snapshot JSONB,
  after_snapshot JSONB,
  playbook_content TEXT,
  executed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

-- 10. alert_rules (FK -> tenants)
CREATE TABLE IF NOT EXISTS alert_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  trigger_type alert_trigger_type NOT NULL,
  trigger_config JSONB NOT NULL,
  channels TEXT[] NOT NULL,
  quiet_hours_start VARCHAR(5),
  quiet_hours_end VARCHAR(5),
  quiet_hours_tz VARCHAR(50),
  enabled BOOLEAN NOT NULL DEFAULT TRUE
);

-- 11. reports (FK -> tenants)
CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  type report_type NOT NULL,
  framework VARCHAR(20),
  status report_status NOT NULL DEFAULT 'generating',
  storage_path TEXT,
  share_token VARCHAR(64),
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

-- 12. compliance_scores (FK -> tenants, scans)
CREATE TABLE IF NOT EXISTS compliance_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  scan_id UUID NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
  framework framework NOT NULL,
  score INTEGER NOT NULL,
  pass_count INTEGER NOT NULL,
  partial_count INTEGER NOT NULL,
  fail_count INTEGER NOT NULL,
  na_count INTEGER NOT NULL,
  total_controls INTEGER NOT NULL,
  snapshot_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 13. learning_patterns (no FK)
CREATE TABLE IF NOT EXISTS learning_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern_type VARCHAR(50) NOT NULL,
  industry industry_profile NOT NULL,
  framework framework,
  category VARCHAR(200) NOT NULL,
  metric VARCHAR(200) NOT NULL,
  value INTEGER NOT NULL,
  sample_size INTEGER NOT NULL DEFAULT 0,
  confidence INTEGER NOT NULL DEFAULT 0,
  last_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 14. drift_events (FK -> tenants, integrations)
CREATE TABLE IF NOT EXISTS drift_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  integration_id UUID NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  change_type drift_change_type NOT NULL,
  resource_type VARCHAR(200) NOT NULL,
  resource_id VARCHAR(500) NOT NULL,
  before_state JSONB,
  after_state JSONB,
  severity severity NOT NULL,
  acknowledged BOOLEAN NOT NULL DEFAULT FALSE,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Foreign key indexes
CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_tenant ON api_keys(tenant_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_prefix ON api_keys(prefix);
CREATE INDEX IF NOT EXISTS idx_integrations_tenant ON integrations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_scans_tenant ON scans(tenant_id);
CREATE INDEX IF NOT EXISTS idx_scans_triggered_by ON scans(triggered_by);
CREATE INDEX IF NOT EXISTS idx_scans_status ON scans(status);
CREATE INDEX IF NOT EXISTS idx_findings_scan ON findings(scan_id);
CREATE INDEX IF NOT EXISTS idx_findings_tenant ON findings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_findings_severity ON findings(severity);
CREATE INDEX IF NOT EXISTS idx_findings_dedup ON findings(dedup_hash);
CREATE INDEX IF NOT EXISTS idx_control_mappings_finding ON control_mappings(finding_id);
CREATE INDEX IF NOT EXISTS idx_evidence_finding ON evidence(finding_id);
CREATE INDEX IF NOT EXISTS idx_evidence_tenant ON evidence(tenant_id);
CREATE INDEX IF NOT EXISTS idx_remediations_finding ON remediations(finding_id);
CREATE INDEX IF NOT EXISTS idx_remediations_approved_by ON remediations(approved_by);
CREATE INDEX IF NOT EXISTS idx_alert_rules_tenant ON alert_rules(tenant_id);
CREATE INDEX IF NOT EXISTS idx_reports_tenant ON reports(tenant_id);
CREATE INDEX IF NOT EXISTS idx_compliance_scores_tenant ON compliance_scores(tenant_id);
CREATE INDEX IF NOT EXISTS idx_compliance_scores_scan ON compliance_scores(scan_id);
CREATE INDEX IF NOT EXISTS idx_drift_events_tenant ON drift_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_drift_events_integration ON drift_events(integration_id);

-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_findings_scan_tenant ON findings(scan_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_control_mappings_finding_framework ON control_mappings(finding_id, framework);
CREATE INDEX IF NOT EXISTS idx_compliance_scores_tenant_framework ON compliance_scores(tenant_id, framework);
CREATE INDEX IF NOT EXISTS idx_drift_events_tenant_detected ON drift_events(tenant_id, detected_at);
CREATE INDEX IF NOT EXISTS idx_learning_patterns_type_industry ON learning_patterns(pattern_type, industry);

-- ============================================================================
-- ROW-LEVEL SECURITY
-- ============================================================================

-- Create app role for API connections (idempotent)
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_user') THEN
    CREATE ROLE app_user;
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO app_user;

-- Enable RLS on all tenant-scoped tables
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE remediations ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE drift_events ENABLE ROW LEVEL SECURITY;

-- RLS policies: tenant isolation via app.current_tenant session variable
-- tenants: isolated by id
CREATE POLICY tenant_isolation_tenants ON tenants
  USING (id = current_setting('app.current_tenant')::uuid);

-- All other tenant-scoped tables: isolated by tenant_id
CREATE POLICY tenant_isolation_users ON users
  USING (tenant_id = current_setting('app.current_tenant')::uuid);

CREATE POLICY tenant_isolation_api_keys ON api_keys
  USING (tenant_id = current_setting('app.current_tenant')::uuid);

CREATE POLICY tenant_isolation_integrations ON integrations
  USING (tenant_id = current_setting('app.current_tenant')::uuid);

CREATE POLICY tenant_isolation_scans ON scans
  USING (tenant_id = current_setting('app.current_tenant')::uuid);

CREATE POLICY tenant_isolation_findings ON findings
  USING (tenant_id = current_setting('app.current_tenant')::uuid);

CREATE POLICY tenant_isolation_evidence ON evidence
  USING (tenant_id = current_setting('app.current_tenant')::uuid);

CREATE POLICY tenant_isolation_alert_rules ON alert_rules
  USING (tenant_id = current_setting('app.current_tenant')::uuid);

CREATE POLICY tenant_isolation_reports ON reports
  USING (tenant_id = current_setting('app.current_tenant')::uuid);

CREATE POLICY tenant_isolation_compliance_scores ON compliance_scores
  USING (tenant_id = current_setting('app.current_tenant')::uuid);

CREATE POLICY tenant_isolation_drift_events ON drift_events
  USING (tenant_id = current_setting('app.current_tenant')::uuid);

-- remediations: accessed via finding join, RLS through finding_id lookup
-- We use a subquery policy to enforce tenant isolation transitively
CREATE POLICY tenant_isolation_remediations ON remediations
  USING (finding_id IN (
    SELECT id FROM findings
    WHERE tenant_id = current_setting('app.current_tenant')::uuid
  ));

-- Note: control_mappings and learning_patterns have no tenant_id.
-- control_mappings are accessed through findings (which have RLS).
-- learning_patterns are global (cross-tenant aggregated data).

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Auto-update updated_at on tenants
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_tenants_updated_at ON tenants;
CREATE TRIGGER trg_tenants_updated_at
  BEFORE UPDATE ON tenants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

COMMIT;
