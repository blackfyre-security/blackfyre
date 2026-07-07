-- ============================================================================
-- 026_audit_chain_state.sql
-- REAL IMPL (BLACKFYRE 2026-06): durable per-tenant audit hash-chain head.
--
-- P1 integrity fix. AuditChainService kept the chain's two pieces of moving
-- state — the last chain hash (`lastChainHash`) and the per-tenant sequence
-- counter (`sequenceCounters`) — in per-process in-memory Maps. Those Maps are
-- LOST on every process restart / Lambda cold start, so after a restart the
-- service had no authoritative head and would re-seed from whatever it could
-- scavenge, racing concurrent writers and risking sequence resets / forked
-- chains. For a tamper-evident audit ledger that is an integrity break, not a
-- caching nuisance.
--
-- This migration creates the durable, tenant-scoped `audit_chain_state` table:
-- exactly one row per tenant holding the authoritative chain head
--   - last_chain_hash : the chainHash of the most recently appended entry
--                       (GENESIS sentinel until the first entry is written)
--   - last_sequence   : the sequenceNumber of that entry (0 before the first)
-- The service now reads + updates this row INSIDE the same transaction that
-- inserts the audit_logs entry, taking a row lock (SELECT ... FOR UPDATE) on the
-- per-tenant head so two concurrent appenders for one tenant are serialized by
-- the database — the chain head survives restarts AND cannot fork under
-- concurrency.
--
-- Tenant isolation matches 009a_rls_enforcement.sql / 022_evidence_chain.sql:
-- ENABLE + FORCE ROW LEVEL SECURITY with a fail-closed tenant_isolation policy
-- keyed on current_setting('app.current_tenant', true)::uuid (missing_ok=true =>
-- an UNSET context yields NULL => predicate false => deny-all). FORCE is required
-- because the app connects as the table owner (which would otherwise bypass RLS);
-- per-request queries run under SET ROLE app_user (NOBYPASSRLS).
--
-- tenant_id is the PRIMARY KEY: there is at most one head row per tenant, so the
-- upsert (INSERT ... ON CONFLICT (tenant_id) DO UPDATE) the service uses is the
-- authoritative, race-free way to advance the head.
--
-- Idempotent: safe to re-run (IF NOT EXISTS / DROP POLICY IF EXISTS / guarded
-- GRANT).
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS audit_chain_state (
  tenant_id        uuid PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  -- chainHash of the most recently appended entry. The GENESIS sentinel
  -- (matching AuditChainService.GENESIS_HASH) is used before the first entry.
  last_chain_hash  text NOT NULL DEFAULT
    'genesis:0000000000000000000000000000000000000000000000000000000000000000',
  -- sequenceNumber of the most recently appended entry (0 before the first).
  last_sequence    bigint NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- Tenant isolation: ENABLE + FORCE RLS with a fail-closed policy, mirroring
-- 009a_rls_enforcement.sql. Unset app.current_tenant => NULL => predicate false
-- => deny-all. WITH CHECK prevents writing a head row for another tenant.
-- ----------------------------------------------------------------------------
ALTER TABLE audit_chain_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_chain_state FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_audit_chain_state ON audit_chain_state;
CREATE POLICY tenant_isolation_audit_chain_state ON audit_chain_state
  USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);

-- Grant DML to the non-owner application role (created in 009a). Default
-- privileges (also set in 009a) should already cover this, but assert explicitly
-- so the table is reachable even if applied against a DB where those defaults
-- were not in scope at table-creation time.
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_user') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON audit_chain_state TO app_user;
  END IF;
END $$;

COMMIT;
