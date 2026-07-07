-- ============================================================================
-- 029_ot_safety_acks.sql
-- REAL IMPL (BLACKFYRE 2026-06): persist OT/SCADA safety acknowledgments.
--
-- Wave 2 persistence: OT/SCADA safety-disclaimer acknowledgments previously lived
-- only in an in-process Map (ot-safety-gate.ts `acknowledgments`) and were lost on
-- every restart — a P3 durability gap that destroyed the COMPLIANCE AUDIT TRAIL for
-- a safety-critical control (who, on which tenant, from which IP, at what time, and
-- against which disclaimer version they assumed responsibility for enabling passive
-- OT monitoring). This migration creates a tenant-scoped, RLS-enforced
-- `ot_safety_acknowledgments` table that the service now reads/writes via
-- parameterized SQL so the acknowledgment record survives restarts and deploys.
--
-- The act of acknowledging is irreversible per tenant: a tenant has a single
-- current acknowledgment row (keyed by tenant_id), upserted on conflict, so the
-- latest acknowledger / version / IP / timestamp is retained without ever deleting
-- the trail. No secrets are stored here — only the actor's user id, the source IP,
-- the disclaimer version, and timestamps.
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

CREATE TABLE IF NOT EXISTS ot_safety_acknowledgments (
  -- Surrogate PK. Tenant isolation is by tenant_id; a tenant has exactly one
  -- current acknowledgment row (see the UNIQUE constraint below), upserted on it.
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  -- The actor who assumed responsibility. Stored as the user id only (no secrets,
  -- no credentials). References users(id) for referential integrity; the user
  -- record itself is tenant-scoped and RLS-isolated upstream.
  acknowledged_by     uuid        NOT NULL,
  -- Source IP captured at acknowledgment time for the audit trail. Free-form text
  -- so it can hold "unknown" or an x-forwarded-for value the service derived.
  ip_address          text        NOT NULL DEFAULT 'unknown',
  -- The disclaimer version the actor acknowledged (e.g. '1.0'); lets us prove which
  -- text was in force when responsibility was assumed.
  disclaimer_version  text        NOT NULL,
  acknowledged_at     timestamptz NOT NULL DEFAULT now(),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  -- One current acknowledgment per tenant; the service upserts on tenant_id so the
  -- "already acknowledged" no-op path stays idempotent and durable.
  CONSTRAINT ot_safety_acknowledgments_tenant_unique UNIQUE (tenant_id)
);

CREATE INDEX IF NOT EXISTS ot_safety_acknowledgments_tenant_idx
  ON ot_safety_acknowledgments (tenant_id);

-- Defense-in-depth tenant isolation (see 009a_rls_enforcement.sql).
ALTER TABLE ot_safety_acknowledgments ENABLE ROW LEVEL SECURITY;
ALTER TABLE ot_safety_acknowledgments FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_ot_safety_acknowledgments ON ot_safety_acknowledgments;
CREATE POLICY tenant_isolation_ot_safety_acknowledgments ON ot_safety_acknowledgments
  USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);

COMMIT;
