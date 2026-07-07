-- ============================================================================
-- 039_oidc_provider_configs.sql
-- REAL IMPL (BLACKFYRE 2026-06): real per-tenant OAuth2/OIDC provider config for
-- enterprise SSO (Okta, Microsoft Entra / Azure AD, Google).
--
-- The existing `sso_configs` table (migration 014) is SAML-specific: its
-- entity_id / sso_url / certificate columns are NOT NULL and model an IdP X.509
-- assertion flow, not an OIDC client. POST /api/auth/sso previously accepted a
-- `provider` param but only `google` actually worked (env-var client creds);
-- every other provider returned 501. To support REAL OIDC for Okta + Entra (and
-- multi-tenant Google Workspace) we persist a tenant-scoped OIDC client config
-- the services/oidc-service.ts discovery + token-exchange + ID-token-verify flow
-- reads at request time. Client creds therefore live in the DB (per tenant) and
-- the env GOOGLE_* vars remain a single-tenant fallback for the default flow.
--
-- Tenant isolation follows the 009a_rls_enforcement.sql pattern: ENABLE + FORCE
-- ROW LEVEL SECURITY with a tenant_isolation policy keyed on
-- current_setting('app.current_tenant', true)::uuid (missing_ok=true => an UNSET
-- context yields NULL => deny-all, fail closed). WITH CHECK mirrors USING so a row
-- can never be written into another tenant. The non-owner `app_user` role created
-- in 009a runs request-scoped queries and cannot bypass RLS; it picks up DML on
-- this table via ALTER DEFAULT PRIVILEGES (also from 009a).
--
-- The SSO start/callback paths run BEFORE a user is authenticated, so there is no
-- tenant context to bind; oidc-service.ts reads these rows on the OWNER pool
-- (superDb, bypasses RLS) and filters tenant_id by hand — the same pre-auth,
-- cross-tenant pattern auth.ts / saml-service.ts / scim-auth.ts already use.
--
-- SECURITY: client_secret is a confidential OAuth credential. It is stored here
-- because the token-exchange (POST <token_endpoint>) requires it server-side; it
-- is NEVER logged (redact.ts denylist masks any *secret* key) and NEVER returned
-- to a browser. Admin write paths that persist it must do so over the owner pool.
--
-- Idempotent: safe to re-run (IF NOT EXISTS / DROP POLICY IF EXISTS).
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS oidc_provider_configs (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  -- 'google' | 'okta' | 'entra' (a.k.a. azure_ad / microsoft). The route maps
  -- provider aliases to these canonical values before lookup.
  provider       varchar(32) NOT NULL,
  -- OIDC issuer base URL, e.g. https://login.microsoftonline.com/<tenant>/v2.0
  -- or https://<org>.okta.com. Discovery resolves <issuer>/.well-known/openid-configuration.
  issuer         text        NOT NULL,
  client_id      text        NOT NULL,
  -- Confidential OAuth client secret. Never logged, never returned to clients.
  client_secret  text        NOT NULL,
  redirect_uri   text        NOT NULL,
  -- Space-delimited OAuth scopes; defaults to the OIDC minimum. Stored as text so
  -- a tenant can add e.g. Entra "User.Read" without a schema change.
  scopes         text        NOT NULL DEFAULT 'openid email profile',
  -- Role assigned to auto-provisioned SSO users (mirrors sso_configs.default_role).
  default_role   user_role   NOT NULL DEFAULT 'viewer',
  -- When false a matching user is required (no JIT create) — same semantics as
  -- saml-service auto_provision.
  auto_provision boolean     NOT NULL DEFAULT true,
  -- Soft enable/disable without deleting the row.
  enabled        boolean     NOT NULL DEFAULT false,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  -- One config per (tenant, provider) so a tenant can wire Okta AND Entra.
  CONSTRAINT oidc_provider_configs_tenant_provider_unique UNIQUE (tenant_id, provider)
);

CREATE INDEX IF NOT EXISTS oidc_provider_configs_tenant_idx
  ON oidc_provider_configs (tenant_id);

-- Defense-in-depth tenant isolation (see 009a_rls_enforcement.sql).
ALTER TABLE oidc_provider_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE oidc_provider_configs FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_oidc_provider_configs ON oidc_provider_configs;
CREATE POLICY tenant_isolation_oidc_provider_configs ON oidc_provider_configs
  USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);

COMMIT;
