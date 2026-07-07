-- Adds the 19 tables defined in Drizzle schema.ts but never created in SQL,
-- plus the 14 enums they depend on. Idempotent (uses IF NOT EXISTS / DO blocks).
--
-- Tables: control_cross_mappings, copilot_conversations, remediation_playbooks,
--   finding_correlations, agent_learning, scan_templates, nist_baselines,
--   remediation_workflow_steps, change_windows, evidence_chain, threat_intel,
--   threat_matches, compliance_deadlines, regulatory_changes,
--   compliance_autopilot, autopilot_actions, incidents, incident_timeline,
--   finding_comments, finding_assignments, tenant_branding, tenant_sovereignty
--
-- All tenant-scoped tables get RLS enabled with the standard
-- `tenant_id = current_setting('app.current_tenant')::uuid` policy as
-- defense-in-depth alongside explicit WHERE clauses in the application.

-- ============================================================================
-- ENUMS
-- ============================================================================

DO $$ BEGIN CREATE TYPE encryption_mode AS ENUM ('blackfyre-managed','client-byok-aws','client-byok-azure'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE mapping_strength AS ENUM ('exact','strong','partial','weak'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE copilot_intent AS ENUM ('gap_analysis','findings_query','remediation_query','analytics_query','risk_assessment','benchmarking','drift_query','readiness_assessment','general'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE nist_impact_level AS ENUM ('low','moderate','high'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE scan_profile AS ENUM ('quick','standard','deep'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE workflow_step_status AS ENUM ('pending','running','completed','failed','skipped'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE deadline_status AS ENUM ('upcoming','due','overdue','completed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE regulatory_change_type AS ENUM ('new_version','amendment','guidance','enforcement'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE incident_severity AS ENUM ('p1','p2','p3','p4'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE incident_status AS ENUM ('detected','triaged','investigating','contained','remediating','resolved','closed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE incident_source_type AS ENUM ('finding','drift','threat'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE agent_name AS ENUM ('scout','shield','helix','pulse','cortex','ledger','signal'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE autopilot_action_type AS ENUM ('scan','collect_evidence','remediate','report','alert','drift_response'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE autopilot_action_status AS ENUM ('pending','approved','running','completed','failed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================================
-- TABLES — global / cross-tenant reference data
-- ============================================================================

CREATE TABLE IF NOT EXISTS control_cross_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_framework framework NOT NULL,
  source_control_id VARCHAR(50) NOT NULL,
  target_framework framework NOT NULL,
  target_control_id VARCHAR(50) NOT NULL,
  mapping_strength mapping_strength NOT NULL,
  mapping_rationale TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ccm_source_idx ON control_cross_mappings (source_framework, source_control_id);
CREATE INDEX IF NOT EXISTS ccm_target_idx ON control_cross_mappings (target_framework, target_control_id);

CREATE TABLE IF NOT EXISTS remediation_playbooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category finding_category NOT NULL,
  severity severity NOT NULL,
  cloud_provider VARCHAR(20) NOT NULL,
  title VARCHAR(500) NOT NULL,
  steps JSONB NOT NULL,
  cli_commands JSONB,
  iac_fix TEXT,
  effort_hours REAL,
  risk_level VARCHAR(20),
  rollback_plan TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS playbooks_category_idx ON remediation_playbooks (category);

CREATE TABLE IF NOT EXISTS threat_intel (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source VARCHAR(50) NOT NULL,
  cve_id VARCHAR(50),
  title VARCHAR(500) NOT NULL,
  description TEXT,
  severity severity NOT NULL,
  affected_products TEXT[],
  mitre_techniques TEXT[],
  source_url TEXT,
  published_at TIMESTAMPTZ,
  ingested_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS threat_intel_sev_idx ON threat_intel (severity);

CREATE TABLE IF NOT EXISTS regulatory_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  framework VARCHAR(20),
  change_type regulatory_change_type NOT NULL,
  title VARCHAR(500) NOT NULL,
  summary TEXT,
  impact_level severity NOT NULL,
  effective_date TIMESTAMPTZ,
  source_url TEXT,
  ai_analysis JSONB,
  published_at TIMESTAMPTZ,
  ingested_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- TABLES — tenant-scoped
-- ============================================================================

CREATE TABLE IF NOT EXISTS copilot_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  intent_classification copilot_intent NOT NULL,
  response JSONB NOT NULL,
  sources JSONB,
  confidence REAL,
  feedback_rating INTEGER,
  session_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS copilot_conv_tenant_idx ON copilot_conversations (tenant_id);
CREATE INDEX IF NOT EXISTS copilot_conv_session_idx ON copilot_conversations (session_id);

CREATE TABLE IF NOT EXISTS finding_correlations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id UUID NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  chain_name VARCHAR(300) NOT NULL,
  chain_description TEXT,
  combined_severity severity NOT NULL,
  finding_ids UUID[] NOT NULL,
  mitre_techniques TEXT[],
  exploit_narrative TEXT,
  business_impact TEXT,
  correlation_type VARCHAR(50) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS finding_corr_tenant_idx ON finding_correlations (tenant_id);
CREATE INDEX IF NOT EXISTS finding_corr_scan_idx ON finding_correlations (scan_id);

CREATE TABLE IF NOT EXISTS agent_learning (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_type VARCHAR(100) NOT NULL,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  finding_pattern JSONB,
  total_occurrences INTEGER NOT NULL DEFAULT 0,
  false_positives INTEGER NOT NULL DEFAULT 0,
  suppression_recommended BOOLEAN NOT NULL DEFAULT FALSE,
  confidence INTEGER NOT NULL DEFAULT 50,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS agent_learning_agent_idx ON agent_learning (agent_type);
CREATE INDEX IF NOT EXISTS agent_learning_tenant_idx ON agent_learning (tenant_id);

CREATE TABLE IF NOT EXISTS scan_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  profile scan_profile NOT NULL,
  configuration JSONB NOT NULL,
  is_scheduled BOOLEAN NOT NULL DEFAULT FALSE,
  cron_expression VARCHAR(100),
  last_used_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS scan_templates_tenant_idx ON scan_templates (tenant_id);

CREATE TABLE IF NOT EXISTS nist_baselines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  impact_level nist_impact_level NOT NULL,
  custom_additions JSONB,
  custom_removals JSONB,
  tailoring_rationale TEXT,
  selected_by UUID REFERENCES users(id),
  selected_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS nist_baselines_tenant_idx ON nist_baselines (tenant_id);

CREATE TABLE IF NOT EXISTS remediation_workflow_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  remediation_id UUID NOT NULL REFERENCES remediations(id) ON DELETE CASCADE,
  step_number INTEGER NOT NULL,
  step_name VARCHAR(50) NOT NULL,
  status workflow_step_status NOT NULL DEFAULT 'pending',
  input JSONB,
  output JSONB,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_details TEXT
);
CREATE INDEX IF NOT EXISTS workflow_steps_remediation_idx ON remediation_workflow_steps (remediation_id);

CREATE TABLE IF NOT EXISTS change_windows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title VARCHAR(300) NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  approved_change_types JSONB,
  approved_resources JSONB,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS change_windows_tenant_idx ON change_windows (tenant_id);

CREATE TABLE IF NOT EXISTS evidence_chain (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  evidence_id UUID NOT NULL REFERENCES evidence(id) ON DELETE CASCADE,
  sha256_hash VARCHAR(64) NOT NULL,
  previous_entry_hash VARCHAR(64) NOT NULL,
  entry_hash VARCHAR(64) NOT NULL,
  chain_sequence INTEGER NOT NULL,
  collected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  collected_by VARCHAR(200) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS evidence_chain_tenant_idx ON evidence_chain (tenant_id);
CREATE INDEX IF NOT EXISTS evidence_chain_seq_idx ON evidence_chain (tenant_id, chain_sequence);

CREATE TABLE IF NOT EXISTS threat_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  threat_id UUID NOT NULL REFERENCES threat_intel(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  resource_type VARCHAR(200),
  resource_id VARCHAR(500),
  match_reason TEXT,
  match_confidence REAL,
  acknowledged BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS threat_matches_tenant_idx ON threat_matches (tenant_id);

CREATE TABLE IF NOT EXISTS compliance_deadlines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title VARCHAR(300) NOT NULL,
  description TEXT,
  framework VARCHAR(20),
  deadline_date TIMESTAMPTZ NOT NULL,
  reminder_days JSONB,
  status deadline_status NOT NULL DEFAULT 'upcoming',
  readiness_score INTEGER DEFAULT 0,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS deadlines_tenant_idx ON compliance_deadlines (tenant_id);

CREATE TABLE IF NOT EXISTS compliance_autopilot (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  framework framework NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  configuration JSONB NOT NULL,
  last_scan_at TIMESTAMPTZ,
  next_scan_at TIMESTAMPTZ,
  auto_fixes_count INTEGER NOT NULL DEFAULT 0,
  pending_approvals_count INTEGER NOT NULL DEFAULT 0,
  monthly_ai_cost REAL NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS autopilot_tenant_idx ON compliance_autopilot (tenant_id);

CREATE TABLE IF NOT EXISTS autopilot_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  autopilot_id UUID NOT NULL REFERENCES compliance_autopilot(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  action_type autopilot_action_type NOT NULL,
  agent_name agent_name NOT NULL,
  details JSONB,
  status autopilot_action_status NOT NULL DEFAULT 'pending',
  cost_tokens INTEGER NOT NULL DEFAULT 0,
  executed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS autopilot_actions_tenant_idx ON autopilot_actions (tenant_id);
CREATE INDEX IF NOT EXISTS autopilot_actions_stat_idx ON autopilot_actions (status);

CREATE TABLE IF NOT EXISTS incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  severity incident_severity NOT NULL,
  source_type incident_source_type NOT NULL,
  source_id UUID,
  source_agent agent_name,
  status incident_status NOT NULL DEFAULT 'detected',
  assigned_to UUID REFERENCES users(id),
  sla_target_minutes INTEGER NOT NULL,
  response_time_minutes INTEGER,
  root_cause TEXT,
  lessons_learned TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS incidents_tenant_idx ON incidents (tenant_id);
CREATE INDEX IF NOT EXISTS incidents_stat_idx ON incidents (status);

CREATE TABLE IF NOT EXISTS incident_timeline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  action VARCHAR(200) NOT NULL,
  details TEXT,
  performed_by VARCHAR(200) NOT NULL,
  agent_name agent_name,
  performed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS incident_tl_incident_idx ON incident_timeline (incident_id);

CREATE TABLE IF NOT EXISTS finding_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  finding_id UUID NOT NULL REFERENCES findings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS finding_comments_finding_idx ON finding_comments (finding_id);

CREATE TABLE IF NOT EXISTS finding_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  finding_id UUID NOT NULL REFERENCES findings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  assigned_by UUID NOT NULL REFERENCES users(id),
  due_date TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS finding_assign_finding_idx ON finding_assignments (finding_id);

CREATE TABLE IF NOT EXISTS tenant_branding (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  logo_url VARCHAR(500),
  primary_color VARCHAR(7) DEFAULT '#FF4D00',
  secondary_color VARCHAR(7) DEFAULT '#F59E0B',
  company_name VARCHAR(200),
  tagline VARCHAR(300),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tenant_sovereignty (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
  encryption_mode encryption_mode NOT NULL DEFAULT 'blackfyre-managed',
  kms_key_arn TEXT,
  azure_key_vault_url TEXT,
  azure_key_name TEXT,
  allowed_regions TEXT[] NOT NULL DEFAULT '{}',
  primary_region VARCHAR(100) NOT NULL DEFAULT 'ap-south-1',
  data_residency_law VARCHAR(50),
  geo_pin_enforced BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS tenant_sovereignty_tenant_id_idx ON tenant_sovereignty (tenant_id);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE copilot_conversations          ENABLE ROW LEVEL SECURITY;
ALTER TABLE finding_correlations           ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_learning                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE scan_templates                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE nist_baselines                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE change_windows                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidence_chain                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE threat_matches                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_deadlines           ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_autopilot           ENABLE ROW LEVEL SECURITY;
ALTER TABLE autopilot_actions              ENABLE ROW LEVEL SECURITY;
ALTER TABLE incidents                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE finding_comments               ENABLE ROW LEVEL SECURITY;
ALTER TABLE finding_assignments            ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_branding                ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_sovereignty             ENABLE ROW LEVEL SECURITY;
ALTER TABLE remediation_workflow_steps     ENABLE ROW LEVEL SECURITY;
ALTER TABLE incident_timeline              ENABLE ROW LEVEL SECURITY;

-- Standard tenant_isolation policy
DO $$ DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'copilot_conversations','finding_correlations','agent_learning','scan_templates',
    'nist_baselines','change_windows','evidence_chain','threat_matches',
    'compliance_deadlines','compliance_autopilot','autopilot_actions','incidents',
    'finding_comments','finding_assignments','tenant_branding','tenant_sovereignty'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_%I ON %I', t, t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation_%I ON %I USING (tenant_id = current_setting(''app.current_tenant'')::uuid)',
      t, t
    );
  END LOOP;
END $$;

-- Indirect tenant scoping (no tenant_id column — joins through parent table)
DROP POLICY IF EXISTS tenant_isolation_remediation_workflow_steps ON remediation_workflow_steps;
CREATE POLICY tenant_isolation_remediation_workflow_steps ON remediation_workflow_steps
  USING (remediation_id IN (
    SELECT r.id FROM remediations r
    JOIN findings f ON r.finding_id = f.id
    WHERE f.tenant_id = current_setting('app.current_tenant')::uuid
  ));

DROP POLICY IF EXISTS tenant_isolation_incident_timeline ON incident_timeline;
CREATE POLICY tenant_isolation_incident_timeline ON incident_timeline
  USING (incident_id IN (
    SELECT id FROM incidents WHERE tenant_id = current_setting('app.current_tenant')::uuid
  ));

-- Tables with no tenant_id (cross-tenant reference data) — no RLS needed:
-- control_cross_mappings, remediation_playbooks, threat_intel, regulatory_changes
