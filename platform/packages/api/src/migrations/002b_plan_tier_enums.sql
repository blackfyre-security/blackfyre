-- Add plan tier enum values early (needed by 003_seed_data.sql)
-- These are also added in 012_plan_tiers.sql with IF NOT EXISTS guards
ALTER TYPE tenant_plan ADD VALUE IF NOT EXISTS 'comply';
ALTER TYPE tenant_plan ADD VALUE IF NOT EXISTS 'protect';
ALTER TYPE tenant_plan ADD VALUE IF NOT EXISTS 'defend';
