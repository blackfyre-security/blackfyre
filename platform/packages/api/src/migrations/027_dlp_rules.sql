-- ============================================================================
-- 027_dlp_rules.sql
-- REAL IMPL (BLACKFYRE 2026-06): persist custom DLP rules.
--
-- Wave 2 persistence: custom, tenant-authored DLP rules previously lived only in
-- an in-process Map (dlp-service.ts `tenantRules`) and were lost on every restart
-- — a P2 durability gap for a security control. This migration creates a
-- tenant-scoped, RLS-enforced `dlp_rules` table that the service now reads/writes
-- via parameterized SQL. Built-in default rules stay in code (DEFAULT_RULES) and
-- are NOT stored here; this table holds ONLY per-tenant custom rules.
--
-- Tenant isolation follows the 009a_rls_enforcement.sql pattern: ENABLE + FORCE
-- ROW LEVEL SECURITY with a tenant_isolation policy keyed on
-- current_setting('app.current_tenant', true)::uuid (missing_ok=true => an UNSET
-- context yields NULL => deny-all, fail closed). WITH CHECK mirrors USING so a row
-- can never be written into another tenant. The non-owner `app_user` role created
-- in 009a runs request-scoped queries and cannot bypass RLS; it picks up DML on
-- this table via ALTER DEFAULT PRIVILEGES (also from 009a). Idempotent: safe to
-- re-run (IF NOT EXISTS / DROP POLICY IF EXISTS).
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS dlp_rules (
  -- Surrogate PK. The application-level rule identifier (e.g. "dlp-custom-foo")
  -- is `rule_id`, unique per tenant; it is what the service's DlpRule.id maps to.
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  rule_id     text        NOT NULL,
  name        text        NOT NULL,
  -- Stored as the RegExp source + flags so the service can rehydrate `new RegExp(...)`.
  pattern     text        NOT NULL,
  flags       text        NOT NULL DEFAULT 'g',
  severity    text        NOT NULL,
  action      text        NOT NULL,
  category    text        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  -- rule_id is unique WITHIN a tenant (the service upserts on it).
  CONSTRAINT dlp_rules_tenant_rule_id_unique UNIQUE (tenant_id, rule_id),
  -- Guard the small closed sets the service understands.
  CONSTRAINT dlp_rules_severity_chk CHECK (severity IN ('critical', 'high', 'medium')),
  CONSTRAINT dlp_rules_action_chk   CHECK (action IN ('block', 'redact', 'alert'))
);

CREATE INDEX IF NOT EXISTS dlp_rules_tenant_idx ON dlp_rules (tenant_id);

-- Defense-in-depth tenant isolation (see 009a_rls_enforcement.sql).
ALTER TABLE dlp_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE dlp_rules FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_dlp_rules ON dlp_rules;
CREATE POLICY tenant_isolation_dlp_rules ON dlp_rules
  USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);

COMMIT;
