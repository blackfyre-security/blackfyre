-- Migration 024_scim_groups.sql
-- REAL IMPL (BLACKFYRE 2026-06): durable SCIM 2.0 Groups (RFC 7643 §4.2 / RFC 7644).
--
-- SCIM Groups + their memberships previously lived in a process-global, capped
-- in-memory Map (routes/scim.ts groupStore): lost on every restart and evicted
-- under load (silent data loss). Wave-2 persistence mandate: nothing that must
-- survive a restart may be in-memory. This migration introduces the two
-- tenant-scoped tables that back SCIM Groups so provisioned groups + members are
-- durable.
--
-- Tenant isolation follows the 009a_rls_enforcement.sql pattern: ENABLE + FORCE
-- ROW LEVEL SECURITY with a tenant_isolation policy keyed on
-- current_setting('app.current_tenant', true)::uuid (missing_ok=true => unset
-- context yields NULL => deny-all, fail closed) and a WITH CHECK so a row can
-- never be written into another tenant. This RLS is defense-in-depth: SCIM
-- requests authenticate via scimAuthenticate (which does NOT bind app.current_tenant
-- / SET ROLE app_user), so the SCIM route runs on the owner pool (superDb, which
-- bypasses RLS) and additionally hand-filters every query by tenant_id — exactly
-- as the SCIM Users handlers already do. The policy still protects the data if
-- these tables are ever reached from an app_user / RLS-bound connection.
--
-- scim_group_members has no tenant_id of its own; it is isolated transitively via
-- its parent scim_groups row (same approach as remediations/control_mappings in
-- 009a). ON DELETE CASCADE keeps memberships consistent when a group is removed.
--
-- Idempotent: IF NOT EXISTS on tables/indexes, DROP POLICY IF EXISTS before
-- CREATE POLICY. Safe to re-run. Placed at prefix 024 so it sorts after the
-- existing SCIM migration (020_scim.sql, which created scim_tokens + tenants).

CREATE TABLE IF NOT EXISTS scim_groups (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  external_id  text,
  display_name text        NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- displayName lookups + tenant-scoped listing.
CREATE INDEX IF NOT EXISTS scim_groups_tenant_idx
  ON scim_groups (tenant_id);

-- externalId is only unique within a tenant (matches the users SCIM convention).
CREATE UNIQUE INDEX IF NOT EXISTS scim_groups_tenant_external_id_idx
  ON scim_groups (tenant_id, external_id)
  WHERE external_id IS NOT NULL;

-- Group memberships. value is the SCIM member "value" (typically the user id);
-- the optional display/type columns preserve the member sub-attributes an IdP
-- may send so the round-tripped Group resource is identical to what was stored.
-- position preserves the IdP-supplied member ordering for deterministic replay.
CREATE TABLE IF NOT EXISTS scim_group_members (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id     uuid        NOT NULL REFERENCES scim_groups(id) ON DELETE CASCADE,
  value        text        NOT NULL,
  display      text,
  type         text,
  ref          text,
  position     integer     NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS scim_group_members_group_idx
  ON scim_group_members (group_id);

-- ----------------------------------------------------------------------------
-- RLS: tenant isolation (defense-in-depth; see header).
-- ----------------------------------------------------------------------------
ALTER TABLE scim_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE scim_groups FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_scim_groups ON scim_groups;
CREATE POLICY tenant_isolation_scim_groups ON scim_groups
  USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);

-- scim_group_members has no tenant_id; isolate transitively via the parent group.
ALTER TABLE scim_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE scim_group_members FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_scim_group_members ON scim_group_members;
CREATE POLICY tenant_isolation_scim_group_members ON scim_group_members
  USING (group_id IN (
    SELECT id FROM scim_groups
    WHERE tenant_id = current_setting('app.current_tenant', true)::uuid
  ))
  WITH CHECK (group_id IN (
    SELECT id FROM scim_groups
    WHERE tenant_id = current_setting('app.current_tenant', true)::uuid
  ));
