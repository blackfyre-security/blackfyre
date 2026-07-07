-- Schema-drift fixes: tables and columns declared in Drizzle schema but missing
-- from the original 001_initial_schema.sql.

-- 1. scans.created_at
ALTER TABLE scans
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
UPDATE scans SET created_at = COALESCE(started_at, NOW()) WHERE created_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_scans_created_at ON scans (created_at DESC);

-- 2. findings.created_at
ALTER TABLE findings
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS findings_created_at_idx ON findings (created_at DESC);

-- 3. audit_logs table
CREATE TABLE IF NOT EXISTS audit_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL,
  action          VARCHAR(100) NOT NULL,
  resource_type   VARCHAR(50),
  resource_id     VARCHAR(255),
  details         JSONB,
  ip_address      VARCHAR(45),
  user_agent      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS audit_logs_tenant_id_idx ON audit_logs (tenant_id);
CREATE INDEX IF NOT EXISTS audit_logs_user_id_idx ON audit_logs (user_id);
CREATE INDEX IF NOT EXISTS audit_logs_action_idx ON audit_logs (action);
CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx ON audit_logs (created_at);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_audit_logs ON audit_logs;
CREATE POLICY tenant_isolation_audit_logs ON audit_logs
  USING (tenant_id = current_setting('app.current_tenant')::uuid);

-- 4. ai_decision_log table (consumed by /api/ai-ethics/dashboard)
CREATE TABLE IF NOT EXISTS ai_decision_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  decision_type   VARCHAR(100) NOT NULL,
  input           JSONB,
  output          JSONB,
  confidence      REAL,
  model_version   VARCHAR(100),
  explainability  JSONB,
  human_approved  BOOLEAN NOT NULL DEFAULT FALSE,
  approved_by     UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ai_decision_log_tenant_id_idx ON ai_decision_log (tenant_id);
CREATE INDEX IF NOT EXISTS ai_decision_log_type_idx ON ai_decision_log (decision_type);

ALTER TABLE ai_decision_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_ai_decision_log ON ai_decision_log;
CREATE POLICY tenant_isolation_ai_decision_log ON ai_decision_log
  USING (tenant_id = current_setting('app.current_tenant')::uuid);

-- 5. ai_ethics_reviews table (consumed by /api/ai-ethics/dashboard)
CREATE TABLE IF NOT EXISTS ai_ethics_reviews (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  review_type     VARCHAR(50) NOT NULL,
  ai_system_id    VARCHAR(255),
  overall_score   INTEGER,
  dimensions      JSONB,
  findings        JSONB,
  recommendations JSONB,
  status          VARCHAR(30) NOT NULL DEFAULT 'completed',
  reviewed_by     UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ai_ethics_reviews_tenant_id_idx ON ai_ethics_reviews (tenant_id);

ALTER TABLE ai_ethics_reviews ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_ai_ethics_reviews ON ai_ethics_reviews;
CREATE POLICY tenant_isolation_ai_ethics_reviews ON ai_ethics_reviews
  USING (tenant_id = current_setting('app.current_tenant')::uuid);
