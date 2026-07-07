-- Migrate plan enum from consulting models to SaaS tiers
ALTER TYPE tenant_plan ADD VALUE IF NOT EXISTS 'comply';
ALTER TYPE tenant_plan ADD VALUE IF NOT EXISTS 'protect';
ALTER TYPE tenant_plan ADD VALUE IF NOT EXISTS 'defend';

-- Migrate existing data to new tiers
UPDATE tenants SET plan = 'protect' WHERE plan IN ('retainer', 'project');
UPDATE tenants SET plan = 'comply' WHERE plan = 'hourly';
UPDATE tenants SET plan = 'defend' WHERE plan = 'annual';
