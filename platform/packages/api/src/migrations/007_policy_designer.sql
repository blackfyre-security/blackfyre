-- Phase 6: Automatic Policy Designer schema
-- Adds generated_policies table for storing tenant-customized security policies

CREATE TABLE IF NOT EXISTS generated_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  template_id varchar(100) NOT NULL,
  title varchar(300) NOT NULL,
  framework text[] NOT NULL,
  category varchar(100) NOT NULL,
  content text NOT NULL,
  customization jsonb NOT NULL,
  version varchar(20) NOT NULL DEFAULT '1.0',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS generated_policies_tenant_id_idx ON generated_policies(tenant_id);
CREATE INDEX IF NOT EXISTS generated_policies_template_id_idx ON generated_policies(template_id);
