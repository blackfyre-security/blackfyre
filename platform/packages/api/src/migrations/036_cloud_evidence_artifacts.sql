-- ============================================================================
-- 036_cloud_evidence_artifacts.sql
-- REAL IMPL (BLACKFYRE 2026-06): persist REAL collected cloud evidence (GAP — the
-- ledger EvidenceCollectorService used to fabricate artifacts and return them
-- without persisting). collectCloudEvidence() / collectConfigSnapshot() now pull
-- live artifacts via the tenant integration's cloud SDK (the same STS-AssumeRole /
-- service-principal / service-account credential resolution the Wave-1 auditors
-- use) and write the collected artifact — together with the SHA-256 content hash
-- computed over the actual artifact bytes — into this tenant-scoped table so the
-- evidence is durable, hash-verifiable, and auditor-traceable.
--
-- This table holds CONTROL/CONFIG evidence collected proactively against an
-- integration (keyed on integration_id), distinct from the existing `evidence`
-- table which is keyed on a specific finding_id. Both are content-hashed.
--
-- Columns:
--   integration_id   — the integration the artifact was pulled from (cloud SDK).
--   control_id       — the compliance control the artifact is evidence for.
--   framework        — the framework the control belongs to.
--   artifact_type    — kind of artifact ('config_snapshot' | 'api_response' | ...).
--   artifact_kind    — 'cloud_evidence' (single control) | 'config_snapshot'
--                      (point-in-time enumeration of all resources).
--   provider         — resolved cloud provider ('aws' | 'azure' | 'gcp' | ...).
--   content          — the collected artifact serialized as JSON text. This is
--                      the EXACT byte source the sha256_hash is computed over.
--   sha256_hash      — hex SHA-256 of `content`; tamper-evident integrity anchor.
--   resource_count   — number of real resources captured (config snapshots).
--   collected_by     — actor marker ('system:evidence-collector').
--   collected_at     — collection timestamp.
--
-- Tenant isolation follows the 009a_rls_enforcement.sql pattern: ENABLE + FORCE
-- ROW LEVEL SECURITY with a tenant_isolation policy keyed on
-- current_setting('app.current_tenant', true)::uuid (missing_ok=true => an UNSET
-- context yields NULL => deny-all, fail closed). WITH CHECK mirrors USING so an
-- artifact row can never be written into another tenant. The non-owner `app_user`
-- role created in 009a runs request-scoped queries and cannot bypass RLS; it
-- picks up DML on this table via ALTER DEFAULT PRIVILEGES (also from 009a).
-- Idempotent: safe to re-run (IF NOT EXISTS / DROP POLICY IF EXISTS).
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS cloud_evidence_artifacts (
  id              uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  integration_id  uuid         NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  control_id      varchar(64),
  framework       varchar(20),
  artifact_type   varchar(40)  NOT NULL DEFAULT 'config_snapshot',
  artifact_kind   varchar(32)  NOT NULL DEFAULT 'cloud_evidence',
  provider        varchar(20),
  content         text         NOT NULL,
  sha256_hash     varchar(64)  NOT NULL,
  resource_count  integer      NOT NULL DEFAULT 0,
  collected_by    varchar(200) NOT NULL DEFAULT 'system:evidence-collector',
  collected_at    timestamptz  NOT NULL DEFAULT now()
);

-- Lookups by tenant + integration (latest first) and by tenant + control.
CREATE INDEX IF NOT EXISTS cloud_evidence_artifacts_tenant_integration_idx
  ON cloud_evidence_artifacts (tenant_id, integration_id, collected_at DESC);
CREATE INDEX IF NOT EXISTS cloud_evidence_artifacts_tenant_control_idx
  ON cloud_evidence_artifacts (tenant_id, control_id);

-- Defense-in-depth tenant isolation (see 009a_rls_enforcement.sql).
ALTER TABLE cloud_evidence_artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE cloud_evidence_artifacts FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_cloud_evidence_artifacts ON cloud_evidence_artifacts;
CREATE POLICY tenant_isolation_cloud_evidence_artifacts ON cloud_evidence_artifacts
  USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);

COMMIT;
