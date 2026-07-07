-- ============================================================================
-- 028_ics_assets.sql
-- REAL IMPL (BLACKFYRE 2026-06): persist the ICS/OT asset register.
--
-- Wave 2 persistence: discovered ICS/OT assets (Purdue-modelled PLCs, RTUs, HMIs,
-- etc.) lived only in an in-process Map (ics-asset-registry.ts `assets`) and were
-- lost on every restart — a P2 durability gap for a security/asset-inventory
-- control. Losing the register also loses the rogue-device baseline, so after a
-- restart every previously-known device would re-appear as "new" and the
-- baseline/rogue distinction would be meaningless. This migration creates a
-- tenant-scoped, RLS-enforced `ics_assets` table that the service now reads/writes
-- via parameterized SQL while keeping an in-process write-through cache for the
-- synchronous, hot frame-feed path.
--
-- Tenant isolation follows the 009a_rls_enforcement.sql pattern: ENABLE + FORCE
-- ROW LEVEL SECURITY with a tenant_isolation policy keyed on
-- current_setting('app.current_tenant', true)::uuid (missing_ok=true => an UNSET
-- context yields NULL => deny-all, fail closed). WITH CHECK mirrors USING so a row
-- can never be written into another tenant. The non-owner `app_user` role created
-- in 009a runs request-scoped queries and cannot bypass RLS; it picks up DML on
-- this table via ALTER DEFAULT PRIVILEGES (also from 009a). Idempotent: safe to
-- re-run (IF NOT EXISTS / DROP POLICY IF EXISTS).
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS ics_assets (
  -- Surrogate PK. The application-level asset identifier (deterministic
  -- "{ip}:{mac ?? 'unknown'}") is `asset_id`, unique per tenant; it is what the
  -- service's IcsAsset.id maps to.
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  asset_id          text        NOT NULL,
  ip_address        text        NOT NULL,
  mac_address       text,
  device_type       text        NOT NULL DEFAULT 'unknown',
  vendor            text,
  firmware_version  text,
  -- Observed application-layer protocols (e.g. {modbus,dnp3,bacnet}).
  protocols         text[]      NOT NULL DEFAULT '{}',
  -- Purdue Model level 0..5; NULL when not yet classified.
  purdue_level      smallint,
  -- Modbus unit IDs observed for this asset.
  unit_ids          integer[]   NOT NULL DEFAULT '{}',
  is_baseline       boolean     NOT NULL DEFAULT false,
  is_rogue          boolean     NOT NULL DEFAULT false,
  notes             text,
  first_seen_at     timestamptz NOT NULL DEFAULT now(),
  last_seen_at      timestamptz NOT NULL DEFAULT now(),
  -- asset_id is unique WITHIN a tenant (the service upserts on it).
  CONSTRAINT ics_assets_tenant_asset_id_unique UNIQUE (tenant_id, asset_id),
  -- Guard the small closed sets the service understands.
  CONSTRAINT ics_assets_device_type_chk CHECK (device_type IN (
    'plc', 'rtu', 'hmi', 'engineering_workstation', 'scada_server',
    'historian', 'ied', 'unknown'
  )),
  CONSTRAINT ics_assets_purdue_level_chk CHECK (
    purdue_level IS NULL OR (purdue_level BETWEEN 0 AND 5)
  )
);

CREATE INDEX IF NOT EXISTS ics_assets_tenant_idx ON ics_assets (tenant_id);
-- Supports the rogue/device-type/purdue-level filtered listAssets() queries.
CREATE INDEX IF NOT EXISTS ics_assets_tenant_rogue_idx
  ON ics_assets (tenant_id, is_rogue);

-- Defense-in-depth tenant isolation (see 009a_rls_enforcement.sql).
ALTER TABLE ics_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ics_assets FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_ics_assets ON ics_assets;
CREATE POLICY tenant_isolation_ics_assets ON ics_assets
  USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);

COMMIT;
