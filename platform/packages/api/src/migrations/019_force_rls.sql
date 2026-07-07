-- ============================================================================
-- 019_force_rls.sql  (ported from launch-blockers/w1-w4 015_force_rls.sql)
-- ============================================================================
-- Hardening: enforce RLS against the connection role even when it owns the
-- table. By default Postgres bypasses RLS for table owners; without this
-- migration every tenant_isolation policy in 001_initial_schema.sql is inert
-- and the API connection sees every tenant's rows.
--
-- This was flagged by the 2026-05-21 CTO architecture review as the single
-- highest-impact security defect in the platform.
-- ============================================================================

ALTER TABLE tenants            FORCE ROW LEVEL SECURITY;
ALTER TABLE users              FORCE ROW LEVEL SECURITY;
ALTER TABLE api_keys           FORCE ROW LEVEL SECURITY;
ALTER TABLE integrations       FORCE ROW LEVEL SECURITY;
ALTER TABLE scans              FORCE ROW LEVEL SECURITY;
ALTER TABLE findings           FORCE ROW LEVEL SECURITY;
ALTER TABLE evidence           FORCE ROW LEVEL SECURITY;
ALTER TABLE remediations       FORCE ROW LEVEL SECURITY;
ALTER TABLE alert_rules        FORCE ROW LEVEL SECURITY;
ALTER TABLE reports            FORCE ROW LEVEL SECURITY;
ALTER TABLE compliance_scores  FORCE ROW LEVEL SECURITY;
ALTER TABLE drift_events       FORCE ROW LEVEL SECURITY;

-- superDb (administrative one-connection pool used by tenant provisioning,
-- platform-admin lookups, and audit-chain replay) MUST bypass RLS. Anything
-- using superDb must already filter by tenant_id manually. See
-- platform/packages/api/src/db/connection.ts for the contract.
