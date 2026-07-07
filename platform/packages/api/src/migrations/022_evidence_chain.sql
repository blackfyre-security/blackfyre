-- ============================================================================
-- 022_evidence_chain.sql
-- REAL IMPL (BLACKFYRE 2026-06): durable, append-only, tamper-evident evidence
-- ledger.
--
-- The EvidenceChainService previously kept the "tamper-evident audit ledger" in a
-- volatile in-memory Map that was lost on every process restart / Lambda cold
-- start — a fake durability claim for a compliance product. This migration creates
-- the persistent, hash-chained, HMAC-signed `evidence_chain` table that backs the
-- real implementation. Each row is one chain entry:
--   - sha256     : the evidence item's own content digest (caller-supplied)
--   - prev_hash  : the entry_hash of the immediately preceding chain entry
--                  ("GENESIS" for seq=1)
--   - entry_hash : SHA-256 over the canonical (prev_hash + sha256 + metadata)
--                  payload — links each row to its predecessor (hash chain)
--   - entry_hmac : HMAC-SHA-256 over the same canonical payload, keyed by a
--                  server-side ledger key (from the encryption keyring). Present
--                  only when a key is configured; makes the chain tamper-EVIDENT
--                  against anyone without the key.
--
-- Tenant isolation matches 009a_rls_enforcement.sql: ENABLE + FORCE ROW LEVEL
-- SECURITY with a fail-closed tenant_isolation policy keyed on
-- current_setting('app.current_tenant', true) (missing_ok=true => unset context
-- yields NULL => deny-all). A UNIQUE index on (tenant_id, seq) makes the ledger
-- genuinely append-only per tenant: a duplicate sequence number (an attempted
-- insert/replay at an existing position) is rejected by the database.
--
-- Idempotent: safe to re-run (IF NOT EXISTS / DROP POLICY IF EXISTS).
-- ============================================================================

BEGIN;

-- 016_drizzle_tables.sql created an earlier `evidence_chain` stub with different
-- column names (chain_sequence / sha256_hash / previous_entry_hash, no entry_hmac).
-- That stub was never written to — the ledger lived in an in-memory Map before this
-- real impl — so the CREATE TABLE IF NOT EXISTS below would silently no-op against
-- the legacy shape and the `seq` index would then fail ("column seq does not exist").
-- Drop ONLY the legacy shape (detected by the absence of the canonical `seq` column)
-- so this migration is safe to re-run and never destroys a populated real chain.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'evidence_chain')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'evidence_chain' AND column_name = 'seq') THEN
    DROP TABLE evidence_chain CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS evidence_chain (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  evidence_id  text NOT NULL,
  seq          integer NOT NULL,
  sha256       text NOT NULL,
  prev_hash    text NOT NULL,
  entry_hash   text NOT NULL,
  -- HMAC-SHA-256 over the canonical payload. NULL when no server ledger key was
  -- configured at append time (entry is hash-chained but not cryptographically
  -- signed — the service reports such chains honestly as "unverified").
  entry_hmac   text,
  collected_at timestamptz NOT NULL DEFAULT now(),
  collected_by varchar(200) NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- Append-only guarantee per tenant: no two entries may share a sequence number.
-- This is what makes a replay / out-of-band insert at an existing position fail
-- closed at the database layer rather than silently corrupting the chain.
CREATE UNIQUE INDEX IF NOT EXISTS evidence_chain_tenant_seq_unique
  ON evidence_chain (tenant_id, seq);

-- Lookup by evidence id within a tenant (getEntryByEvidenceId).
CREATE INDEX IF NOT EXISTS evidence_chain_tenant_evidence_idx
  ON evidence_chain (tenant_id, evidence_id);

-- Ordered chain reads (verifyChain walks entries in seq order).
CREATE INDEX IF NOT EXISTS evidence_chain_tenant_collected_idx
  ON evidence_chain (tenant_id, collected_at);

-- ----------------------------------------------------------------------------
-- Tenant isolation: ENABLE + FORCE RLS with a fail-closed policy, mirroring
-- 009a_rls_enforcement.sql. FORCE is required because the app connects as the
-- table owner (which would otherwise bypass RLS); per-request queries run under
-- SET ROLE app_user, which is NOBYPASSRLS. Unset app.current_tenant => NULL =>
-- predicate false => deny-all.
-- ----------------------------------------------------------------------------
ALTER TABLE evidence_chain ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidence_chain FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_evidence_chain ON evidence_chain;
CREATE POLICY tenant_isolation_evidence_chain ON evidence_chain
  USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);

-- Grant DML to the non-owner application role (created in 009a). Default
-- privileges (also set in 009a) cover future grants, but assert explicitly so
-- this table is reachable even if applied against a DB where the defaults were
-- not in scope at table-creation time.
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_user') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON evidence_chain TO app_user;
  END IF;
END $$;

COMMIT;
