-- 010_missing_enums.sql
-- Note: ALTER TYPE ADD VALUE cannot run inside a transaction in PostgreSQL
ALTER TYPE industry_profile ADD VALUE IF NOT EXISTS 'aitech';
ALTER TYPE industry_profile ADD VALUE IF NOT EXISTS 'government';
ALTER TYPE framework ADD VALUE IF NOT EXISTS 'iso42001';
ALTER TYPE framework ADD VALUE IF NOT EXISTS 'pdppl';
