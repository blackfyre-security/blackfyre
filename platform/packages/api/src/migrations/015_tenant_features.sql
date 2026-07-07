-- 015_tenant_features.sql
-- Per-tenant feature overrides for plan-gated capabilities.
-- A tenant's plan tier determines DEFAULT features; rows here OVERRIDE
-- those defaults (grant a tier-locked feature, or revoke a default feature).

CREATE TABLE IF NOT EXISTS tenant_features (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  feature_key      VARCHAR(80)  NOT NULL,
  enabled          BOOLEAN      NOT NULL,
  reason           TEXT,
  granted_by       UUID         REFERENCES users(id),
  granted_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT tenant_features_unique UNIQUE (tenant_id, feature_key)
);

CREATE INDEX IF NOT EXISTS tenant_features_tenant_idx
  ON tenant_features (tenant_id);

CREATE INDEX IF NOT EXISTS tenant_features_feature_idx
  ON tenant_features (feature_key);

-- Optional: column to record custom plan label per tenant (e.g. "Custom — Defend + AI Ethics")
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS custom_plan_label VARCHAR(120);

-- Optional: column to record tenant-specific monthly price override (in paise)
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS monthly_price_inr INTEGER;
