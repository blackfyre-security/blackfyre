-- ============================================================================
-- 015b_schema_remediation.sql  (BLACKFYRE audit 2026-06-05)
-- FOUND DURING COMMUNITY DOCS VERIFICATION (2026-07): renamed from
-- 011_schema_remediation.sql. On a genuinely fresh database, migration
-- 011 ran before 015_preprod_foundation.sql, which is what actually
-- CREATE TABLEs integration_credentials — so FINDING 1 below (an ALTER TABLE
-- on that table) failed outright with "relation does not exist". The file's
-- own header claimed the migration was "order-independent", which is true for
-- FINDING 2/3 (columns/index on tables that exist since 001) but not FINDING 1.
-- Renamed (same fix pattern as 009a_rls_enforcement.sql) so it sorts after all
-- three 015_*.sql files and before 016_*.sql — content is unchanged and still
-- fully idempotent, so this is a safe re-apply on any environment that already
-- ran it under the old filename (nothing here has shipped to a live prod DB;
-- see docs/ARCHITECTURE.md — prod is not yet deployed).
-- ============================================================================
-- Additive, back-compatible remediation of three schema/code-drift findings.
-- No existing column is dropped. Every statement is idempotent (IF NOT EXISTS /
-- guarded blocks) so it is safe to re-run.
--
--   1) Encrypted credential storage on integration_credentials
--   2) Stripe billing columns on tenants (referenced via `as any` but missing)
--   3) UNIQUE dedup index on findings (tenant_id, dedup_hash) for idempotent upsert
-- ============================================================================


-- ----------------------------------------------------------------------------
-- FINDING 1: Encrypted credential storage
-- ----------------------------------------------------------------------------
-- integration_credentials currently stores only vault pointers (vault_ref,
-- kms_key_id). Some integration flows still persist secret material directly;
-- these additive, nullable columns let the credential path write envelope-
-- encrypted ciphertext (AES-256-GCM via EncryptionProviderService) alongside
-- the existing pointer columns instead of any plaintext. The plaintext-capable
-- vault_ref column is intentionally LEFT IN PLACE for back-compat; downstream
-- agents will stop writing plaintext and start populating these instead.
-- NEVER log these values — they hold wrapped secret material.
-- ----------------------------------------------------------------------------

ALTER TABLE integration_credentials
  ADD COLUMN IF NOT EXISTS credential_ciphertext text,  -- base64 envelope ciphertext
  ADD COLUMN IF NOT EXISTS credential_key_id     text,  -- KMS/managed key that wrapped it
  ADD COLUMN IF NOT EXISTS credential_alg        text,  -- cipher, e.g. 'aes-256-gcm'
  ADD COLUMN IF NOT EXISTS credential_nonce      text,  -- base64 GCM IV / nonce
  ADD COLUMN IF NOT EXISTS credential_auth_tag   text;  -- base64 GCM auth tag (tamper detection)

COMMENT ON COLUMN integration_credentials.credential_ciphertext IS 'BLACKFYRE audit 2026-06-05: base64 AES-256-GCM envelope ciphertext of the credential. Replaces plaintext storage. NULL for vault-ref-only rows.';
COMMENT ON COLUMN integration_credentials.credential_key_id     IS 'BLACKFYRE audit 2026-06-05: identifier of the KMS/managed key that encrypted credential_ciphertext.';
COMMENT ON COLUMN integration_credentials.credential_alg        IS 'BLACKFYRE audit 2026-06-05: encryption algorithm, e.g. aes-256-gcm.';
COMMENT ON COLUMN integration_credentials.credential_nonce      IS 'BLACKFYRE audit 2026-06-05: base64 GCM IV/nonce for credential_ciphertext.';
COMMENT ON COLUMN integration_credentials.credential_auth_tag   IS 'BLACKFYRE audit 2026-06-05: base64 GCM auth tag; required to detect tampering on decrypt.';


-- ----------------------------------------------------------------------------
-- FINDING 2: Stripe billing columns referenced via `as any` but missing
-- ----------------------------------------------------------------------------
-- routes/payments-stripe.ts reads/writes (tenants as any).stripeCustomerId,
-- stripeSubscriptionId, etc. The `as any` casts hid that the model lacked these
-- columns. stripe_customer_id / stripe_subscription_id are also created by
-- migration 021 (this block is idempotent and harmless if that ran first);
-- the price/status/period columns are added here so the subscription lifecycle
-- handlers have real, typed columns to populate. All nullable — Razorpay-only
-- tenants keep NULLs.
-- ----------------------------------------------------------------------------

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS stripe_customer_id     text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text,
  ADD COLUMN IF NOT EXISTS stripe_price_id        text,
  ADD COLUMN IF NOT EXISTS subscription_status    varchar(40),
  ADD COLUMN IF NOT EXISTS current_period_end     timestamptz;

-- Webhook handler looks tenants up by stripe_customer_id on
-- customer.subscription.deleted; index it to avoid a full table scan per webhook.
CREATE INDEX IF NOT EXISTS tenants_stripe_customer_id_idx
  ON tenants (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

COMMENT ON COLUMN tenants.stripe_customer_id     IS 'BLACKFYRE audit 2026-06-05: Stripe Customer ID (cus_xxx). NULL for Razorpay-only tenants.';
COMMENT ON COLUMN tenants.stripe_subscription_id IS 'BLACKFYRE audit 2026-06-05: Stripe Subscription ID (sub_xxx). NULL until first Stripe checkout completes.';
COMMENT ON COLUMN tenants.stripe_price_id        IS 'BLACKFYRE audit 2026-06-05: Stripe Price ID (price_xxx) of the active subscription item.';
COMMENT ON COLUMN tenants.subscription_status    IS 'BLACKFYRE audit 2026-06-05: Stripe subscription status (active, past_due, canceled, ...).';
COMMENT ON COLUMN tenants.current_period_end     IS 'BLACKFYRE audit 2026-06-05: end of the current Stripe billing period; drives renewal/expiry logic.';


-- ----------------------------------------------------------------------------
-- FINDING 3: UNIQUE dedup index on findings for idempotent upsert
-- ----------------------------------------------------------------------------
-- services/finding-service.ts dedups on (tenant_id, dedup_hash) by SELECTing
-- before INSERT, but the existing findings_tenant_dedup_idx is NON-UNIQUE, so
-- two concurrent scans can both miss and both insert -> duplicate findings.
-- A UNIQUE index lets the service switch to ON CONFLICT (tenant_id, dedup_hash)
-- DO UPDATE (an idempotent upsert) and makes duplicates impossible at the DB.
--
-- Before creating the unique index we must collapse any duplicates that already
-- exist, re-pointing child rows to the survivor (the most-recently-created
-- finding per dedup key) so no foreign keys are orphaned. This is a one-time
-- data cleanup; it touches only rows that are already duplicates.
-- ----------------------------------------------------------------------------

DO $$
DECLARE
  has_dupes boolean;
BEGIN
  -- Only run the (potentially expensive) cleanup if duplicates actually exist.
  SELECT EXISTS (
    SELECT 1
    FROM findings
    GROUP BY tenant_id, dedup_hash
    HAVING COUNT(*) > 1
  ) INTO has_dupes;

  IF has_dupes THEN
    -- Map each duplicate (loser) finding id -> the survivor id for its dedup key.
    CREATE TEMP TABLE _finding_dupes ON COMMIT DROP AS
    SELECT
      f.id  AS dupe_id,
      first_value(f.id) OVER (
        PARTITION BY f.tenant_id, f.dedup_hash
        ORDER BY f.created_at DESC, f.id DESC
      ) AS keep_id
    FROM findings f;

    DELETE FROM _finding_dupes WHERE dupe_id = keep_id;  -- keep survivors out of the loser set

    -- Re-point child rows that reference findings.id onto the survivor.
    UPDATE control_mappings cm
      SET finding_id = d.keep_id
      FROM _finding_dupes d
      WHERE cm.finding_id = d.dupe_id;

    UPDATE evidence e
      SET finding_id = d.keep_id
      FROM _finding_dupes d
      WHERE e.finding_id = d.dupe_id;

    UPDATE remediations r
      SET finding_id = d.keep_id
      FROM _finding_dupes d
      WHERE r.finding_id = d.dupe_id;

    UPDATE finding_comments fc
      SET finding_id = d.keep_id
      FROM _finding_dupes d
      WHERE fc.finding_id = d.dupe_id;

    UPDATE finding_assignments fa
      SET finding_id = d.keep_id
      FROM _finding_dupes d
      WHERE fa.finding_id = d.dupe_id;

    -- Finally drop the now-orphaned duplicate findings.
    DELETE FROM findings f USING _finding_dupes d WHERE f.id = d.dupe_id;
  END IF;
END $$;

-- Enforce the dedup key. The existing non-unique findings_tenant_dedup_idx is
-- left in place for back-compat.
CREATE UNIQUE INDEX IF NOT EXISTS findings_tenant_dedup_unique
  ON findings (tenant_id, dedup_hash);

COMMENT ON INDEX findings_tenant_dedup_unique IS 'BLACKFYRE audit 2026-06-05: enforces finding dedup key so concurrent scans upsert (ON CONFLICT) instead of inserting duplicates.';
