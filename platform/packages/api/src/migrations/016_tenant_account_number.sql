-- 016_tenant_account_number.sql
-- Adds an immutable customer-facing account number to every tenant.
-- Format: BFR-YYYY-NNNNNN  (e.g. BFR-2026-000142)
--   BFR    : BLACKFYRE prefix
--   YYYY   : year tenant was created
--   NNNNNN : 6-digit zero-padded monotonic counter from a dedicated sequence

CREATE SEQUENCE IF NOT EXISTS tenant_account_seq START 1;

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS account_number VARCHAR(20);

-- Backfill any existing rows (must run before the NOT NULL constraint)
UPDATE tenants
   SET account_number = 'BFR-'
                      || EXTRACT(YEAR FROM COALESCE(created_at, NOW()))::text
                      || '-'
                      || LPAD(nextval('tenant_account_seq')::text, 6, '0')
 WHERE account_number IS NULL;

ALTER TABLE tenants
  ALTER COLUMN account_number SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS tenants_account_number_idx
  ON tenants(account_number);

-- BEFORE INSERT trigger: auto-fill account_number when caller leaves it NULL.
-- Keeps existing INSERTs (which don't know about this column) working.
CREATE OR REPLACE FUNCTION tenants_set_account_number()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.account_number IS NULL THEN
    NEW.account_number := 'BFR-'
                        || EXTRACT(YEAR FROM COALESCE(NEW.created_at, NOW()))::text
                        || '-'
                        || LPAD(nextval('tenant_account_seq')::text, 6, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tenants_set_account_number_trg ON tenants;
CREATE TRIGGER tenants_set_account_number_trg
  BEFORE INSERT ON tenants
  FOR EACH ROW
  EXECUTE FUNCTION tenants_set_account_number();
