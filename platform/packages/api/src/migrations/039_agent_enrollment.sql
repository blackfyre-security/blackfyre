-- ============================================================================
-- 039_agent_enrollment.sql
-- REAL IMPL (BLACKFYRE 2026-06): on-prem agent enrollment + liveness.
--
-- Wave 5 (enterprise auth): the on-prem scanning agent had NO server-side
-- credential store, so the documented agent endpoints (enroll / heartbeat /
-- findings / commands / sync) could not authenticate. This migration adds the
-- `agent_enrollments` table that backs them. A tenant owner/admin issues an
-- enrollment which mints a ONE-TIME agent token of the form
-- `bfagent_<token_prefix>.<secret>`; only a salted Argon2id HASH of the full
-- token is persisted (never the token itself), alongside the indexed
-- `token_prefix` so authentication is a single-row lookup (constant work — one
-- Argon2 verify), exactly like the SCIM structured-token / API-key prefix path.
--
-- mTLS: an enrollment MAY pin a client-certificate `fingerprint` (uppercase
-- SHA-256 hex, matching computeFingerprint() in plugins/mtls.ts). When present,
-- the agent route additionally requires the presented client cert (validated by
-- the mtls plugin + mtls_fingerprints allowlist from Wave 2) to match before the
-- request is accepted — bearer token AND certificate must both check out.
--
-- Tenant isolation follows the 009a_rls_enforcement.sql pattern: ENABLE + FORCE
-- ROW LEVEL SECURITY with a tenant_isolation policy keyed on
-- current_setting('app.current_tenant', true)::uuid (missing_ok=true => an UNSET
-- context yields NULL => deny-all, fail closed). WITH CHECK mirrors USING so a
-- row can never be written into another tenant. The non-owner `app_user` role
-- (009a) runs request-scoped, RLS-bound writes (enroll runs on the owner/admin's
-- request.db); it picks up DML on this table via ALTER DEFAULT PRIVILEGES (009a).
-- Agent-token authentication itself is a cross-tenant, pre-auth lookup with no
-- tenant context yet, so it runs on the OWNER pool (superDb, bypasses RLS) and
-- hand-filters by the token_prefix → row → tenant_id chain, the same pattern
-- scim-auth.ts / auth.ts use for bearer/API-key resolution.
--
-- Idempotent: IF NOT EXISTS on table/indexes, DROP POLICY IF EXISTS before
-- CREATE POLICY. Safe to re-run.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS agent_enrollments (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  -- The user (owner/admin) who issued the enrollment. Used as scans.triggered_by
  -- when the agent submits findings (scans.triggered_by is a NOT NULL FK to users).
  created_by   uuid        NOT NULL REFERENCES users(id),
  -- Indexed, non-secret prefix of the agent token (`bfagent_<token_prefix>.<secret>`).
  -- Authentication looks the row up by this prefix, then Argon2-verifies the full
  -- token against token_hash — single-row, constant-work (no full-table scan).
  token_prefix text        NOT NULL,
  -- Argon2id hash of the FULL one-time token. The raw token is returned exactly
  -- once at enroll time and never persisted.
  token_hash   text        NOT NULL,
  -- Optional pinned mTLS client-certificate fingerprint (uppercase SHA-256 hex).
  -- When set, the agent request must also present a matching client certificate.
  fingerprint  text,
  -- Human label for the agent install (e.g. "dc1-edge-collector"); informational.
  label        text,
  -- Soft enable/disable without deleting, so an agent can be parked then re-enabled
  -- (also the revocation mechanism — a disabled enrollment cannot authenticate).
  enabled      boolean     NOT NULL DEFAULT true,
  -- Liveness: updated on every authenticated heartbeat/sync/findings call.
  last_seen_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- Single-row token resolution by indexed prefix (the bearer fast path).
CREATE INDEX IF NOT EXISTS agent_enrollments_token_prefix_idx
  ON agent_enrollments (token_prefix);

-- Tenant-scoped listing / management.
CREATE INDEX IF NOT EXISTS agent_enrollments_tenant_idx
  ON agent_enrollments (tenant_id);

-- A token_prefix must be globally unique so prefix resolution is unambiguous
-- across tenants (the secret half still gates access; uniqueness only ensures the
-- prefix maps to exactly one enrollment).
CREATE UNIQUE INDEX IF NOT EXISTS agent_enrollments_token_prefix_unique
  ON agent_enrollments (token_prefix);

-- ----------------------------------------------------------------------------
-- RLS: tenant isolation (see 009a_rls_enforcement.sql).
-- ----------------------------------------------------------------------------
ALTER TABLE agent_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_enrollments FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_agent_enrollments ON agent_enrollments;
CREATE POLICY tenant_isolation_agent_enrollments ON agent_enrollments
  USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);

-- ----------------------------------------------------------------------------
-- agent_commands: server-queued commands an agent polls for via
-- GET /api/agent/commands and acknowledges via POST /api/agent/sync. Tenant
-- scoped; isolated transitively via the parent enrollment so a command can never
-- be read/written across tenants. status flows queued -> delivered -> acked.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS agent_commands (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  enrollment_id uuid       NOT NULL REFERENCES agent_enrollments(id) ON DELETE CASCADE,
  -- Command verb (e.g. "run_scan", "update_config", "rotate_token"); bounded by the
  -- route's Zod schema. payload is opaque, agent-interpreted JSON (no secrets here).
  command      text        NOT NULL,
  payload      jsonb       NOT NULL DEFAULT '{}'::jsonb,
  status       text        NOT NULL DEFAULT 'queued',
  created_at   timestamptz NOT NULL DEFAULT now(),
  delivered_at timestamptz,
  acked_at     timestamptz
);

CREATE INDEX IF NOT EXISTS agent_commands_enrollment_status_idx
  ON agent_commands (enrollment_id, status);

ALTER TABLE agent_commands ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_commands FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_agent_commands ON agent_commands;
CREATE POLICY tenant_isolation_agent_commands ON agent_commands
  USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);

COMMIT;
