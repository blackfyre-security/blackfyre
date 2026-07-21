-- @dev-only
-- Migration 018 — Seed platform-admin account for Blackfyre staff
-- Guarded by `app.env = 'development'`: this only runs in dev / staging
-- (the migrate Lambda sets that explicitly). Production is untouched.
--
-- Login: admin@blackfyre.tech / admin@blackfyre  (staging only)
-- Tenant: assigned to the existing 'Acme' demo tenant for FK satisfaction —
-- platform_admin gates everything cross-tenant, so the tenant binding is
-- only structural.

DO $$
DECLARE
  acme_tenant_id uuid;
BEGIN
  IF current_setting('app.env', true) IS DISTINCT FROM 'development' THEN
    RAISE NOTICE 'Skipping 018_seed_blackfyre_admin: app.env != development';
    RETURN;
  END IF;

  SELECT id INTO acme_tenant_id FROM tenants WHERE slug = 'acme' OR name ILIKE 'acme%' LIMIT 1;
  IF acme_tenant_id IS NULL THEN
    -- Fall back to any tenant; we only need one for the FK
    SELECT id INTO acme_tenant_id FROM tenants LIMIT 1;
  END IF;
  IF acme_tenant_id IS NULL THEN
    RAISE NOTICE 'No tenants exist; skipping admin seed (run 003_seed_data first)';
    RETURN;
  END IF;

  INSERT INTO users (tenant_id, email, name, password_hash, role, is_platform_admin)
  VALUES (
    acme_tenant_id,
    'admin@blackfyre.tech',
    'Blackfyre Admin',
    '$argon2id$v=19$m=19456,t=2,p=1$agQp9y8/e0x2gLltbdoKkg$rHX+d4kSO6T5XJ1rkSjTX0x6Ct7D7qeoyB8QAelhgME',
    'admin',
    true
  )
  ON CONFLICT (email) DO UPDATE
    SET is_platform_admin = true,
        password_hash     = EXCLUDED.password_hash,
        name              = EXCLUDED.name;
END $$;
