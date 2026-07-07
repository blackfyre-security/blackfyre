-- 002_compliance_learning_tables.sql
-- Creates compliance_scores and learning_patterns tables
-- that were defined in schema.ts but missing from the initial migration.
-- Gap: GAP-021

CREATE TABLE IF NOT EXISTS compliance_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  scan_id UUID NOT NULL REFERENCES scans(id),
  framework framework NOT NULL,
  score INTEGER NOT NULL,
  pass_count INTEGER NOT NULL,
  partial_count INTEGER NOT NULL,
  fail_count INTEGER NOT NULL,
  na_count INTEGER NOT NULL,
  total_controls INTEGER NOT NULL,
  snapshot_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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

-- Indexes
CREATE INDEX IF NOT EXISTS idx_compliance_scores_tenant ON compliance_scores(tenant_id);
CREATE INDEX IF NOT EXISTS idx_compliance_scores_scan ON compliance_scores(scan_id);
CREATE INDEX IF NOT EXISTS idx_compliance_scores_framework ON compliance_scores(framework);
CREATE INDEX IF NOT EXISTS idx_learning_patterns_type ON learning_patterns(pattern_type);
CREATE INDEX IF NOT EXISTS idx_learning_patterns_industry ON learning_patterns(industry);

-- RLS for compliance_scores (tenant-scoped)
ALTER TABLE compliance_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON compliance_scores
  USING (tenant_id = current_setting('app.current_tenant')::uuid);

-- Grant permissions to app_user role
GRANT SELECT, INSERT, UPDATE, DELETE ON compliance_scores TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON learning_patterns TO app_user;
