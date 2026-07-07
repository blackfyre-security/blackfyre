-- Phase 2: Evidence Vault schema extensions
-- Adds framework and s3_object_key to evidence table
-- Adds auditor role to user_role enum
-- Creates auditor_frameworks join table

-- Add columns to evidence table
ALTER TABLE evidence
  ADD COLUMN IF NOT EXISTS framework varchar(20),
  ADD COLUMN IF NOT EXISTS s3_object_key text;

-- Add auditor to user_role enum (must run outside transaction)
-- IF NOT EXISTS prevents failure on re-run
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'auditor';

-- Auditor framework assignments (many-to-many)
CREATE TABLE IF NOT EXISTS auditor_frameworks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  framework varchar(20) NOT NULL,
  assigned_by uuid REFERENCES users(id),
  assigned_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, framework)
);

CREATE INDEX IF NOT EXISTS auditor_frameworks_user_idx ON auditor_frameworks(user_id);
CREATE INDEX IF NOT EXISTS auditor_frameworks_tenant_idx ON auditor_frameworks(tenant_id);
