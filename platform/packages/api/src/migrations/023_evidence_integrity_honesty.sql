-- ============================================================================
-- 023_evidence_integrity_honesty.sql
-- ============================================================================
-- REAL IMPL (BLACKFYRE 2026-06): tamper-evidence honesty for the evidence vault.
--
-- Sequencing: renamed from 022_evidence_integrity_honesty.sql to 023_* to restore
-- a monotonically-increasing migration sequence. 022 was already taken by
-- 022_evidence_chain.sql (which CREATEs the durable evidence_chain ledger table);
-- two files sharing migration number 022 violated versioning semantics and relied
-- on alphabetical tie-breaking. Both belong to the same 2026-06 audit/evidence
-- work and 022_evidence_chain.sql must apply first, so this honesty migration is
-- now 023. Neither file had been deployed, so the rename is replay-safe (the
-- _migrations tracking table records filenames; no applied row referenced the old
-- name).
--
-- Previously evidence-service.create() silently fell back to hashing collection
-- METADATA (findingId + collectedBy + timestamp) when no content was supplied,
-- and stored that digest in sha256_hash indistinguishably from a real
-- content hash. The vault + /verify endpoints then presented these records as
-- "tamper-evident" even though the digest never covered any evidence bytes.
--
-- This migration adds two columns that make the integrity claim explicit and
-- auditable:
--   hash_source        — what sha256_hash was computed over:
--                          'content'         caller-supplied evidence bytes
--                          'reference-fetch' bytes fetched from a URL (safeFetch)
--                          'metadata-only'   NO content hashed; NOT tamper-evident
--   integrity_verified — TRUE only when the digest covers real evidence bytes.
--
-- Existing rows pre-date content hashing and cannot be retroactively proven, so
-- they default to the honest, conservative state: metadata-only / not verified.
-- ============================================================================

ALTER TABLE evidence
  ADD COLUMN IF NOT EXISTS hash_source        varchar(20) NOT NULL DEFAULT 'metadata-only',
  ADD COLUMN IF NOT EXISTS integrity_verified boolean     NOT NULL DEFAULT false;

COMMENT ON COLUMN evidence.hash_source IS
  'What sha256_hash covers: content | reference-fetch | metadata-only. metadata-only is NOT content-tamper-evident.';
COMMENT ON COLUMN evidence.integrity_verified IS
  'TRUE only when sha256_hash covers real evidence bytes (content or reference-fetch). FALSE for metadata-only records.';
