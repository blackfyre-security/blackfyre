-- ============================================================================
-- 033_xai_manifests.sql
-- REAL IMPL (BLACKFYRE 2026-06): persist the XAI reasoning-manifest store.
--
-- Wave 2 persistence: explainable-AI (XAI) reasoning manifests lived only in a
-- single in-process Map (services/xai-reasoning-service.ts `manifestStore`,
-- keyed by findingId) and were ALL lost on every restart / Lambda cold start —
-- a P2 durability gap. These manifests are the audit/explainability record for
-- why a remediation was recommended (root cause, impact, alternatives, ethics /
-- ISO 42001 assessment, evidence chain, compliance-score deltas, confidence).
-- Losing them silently erases the reasoning history a compliance auditor or
-- human reviewer relies on. This migration creates a tenant-scoped, RLS-enforced
-- `xai_manifests` table that the service now reads/writes via parameterized SQL.
--
-- The rich nested reasoning / compliance-impact / ethics structures are stored
-- as jsonb so the manifest round-trips losslessly without coupling to a wide
-- column-per-field schema (and without editing db/schema.ts, which many parallel
-- work items touch concurrently). `id` is the application-level manifest UUID and
-- is stored as the text PK so a re-read returns the same identifier the generator
-- handed back to the caller.
--
-- Tenant isolation follows the 009a_rls_enforcement.sql pattern: ENABLE + FORCE
-- ROW LEVEL SECURITY with a tenant_isolation policy keyed on
-- current_setting('app.current_tenant', true)::uuid (missing_ok=true => an UNSET
-- context yields NULL => deny-all, fail closed). WITH CHECK mirrors USING so a
-- manifest row can never be written into another tenant. The non-owner `app_user`
-- role created in 009a runs request-scoped queries and cannot bypass RLS; it
-- picks up DML on this table via ALTER DEFAULT PRIVILEGES (also from 009a).
-- Idempotent: safe to re-run (IF NOT EXISTS / DROP POLICY IF EXISTS).
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS xai_manifests (
  -- Application-level manifest identifier (crypto.randomUUID()); stable across
  -- restarts and returned verbatim to the caller.
  id                  text        PRIMARY KEY,
  tenant_id           uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  finding_id          text        NOT NULL,
  remediation_type    text        NOT NULL,
  -- Nested explainability + governance structures persisted losslessly as jsonb.
  reasoning           jsonb       NOT NULL,
  compliance_impact   jsonb       NOT NULL,
  risk_reduction      integer     NOT NULL,
  confidence_score    numeric     NOT NULL,
  model_version       text        NOT NULL,
  -- Application-supplied manifest timestamp (ISO-8601 string from the service).
  manifest_timestamp  text        NOT NULL,
  created_at          timestamptz NOT NULL DEFAULT now()
);

-- getManifestHistory(findingId) reads every manifest for one finding within the
-- current tenant, newest first.
CREATE INDEX IF NOT EXISTS xai_manifests_tenant_finding_idx
  ON xai_manifests (tenant_id, finding_id, created_at DESC);

-- Defense-in-depth tenant isolation (see 009a_rls_enforcement.sql).
ALTER TABLE xai_manifests ENABLE ROW LEVEL SECURITY;
ALTER TABLE xai_manifests FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_xai_manifests ON xai_manifests;
CREATE POLICY tenant_isolation_xai_manifests ON xai_manifests
  USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);

COMMIT;
