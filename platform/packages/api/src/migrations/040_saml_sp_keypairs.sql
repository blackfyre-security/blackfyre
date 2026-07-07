-- ============================================================================
-- 039_saml_sp_keypairs.sql
-- REAL IMPL (BLACKFYRE 2026-06): Wave 5 enterprise SAML. Per-tenant Service
-- Provider (SP) signing material + provider signing/digest preferences.
--
-- Why a new table (not columns on sso_configs):
--   * sso_configs holds the IdP side (entityId, ssoUrl, IdP certificate) and is
--     returned (cert-masked) by GET /api/auth/saml/config. The SP keypair below
--     contains a PRIVATE KEY (a secret) that must NEVER be serialized into that
--     response shape, so it lives in its own table that the config endpoints do
--     not select from. Keeping the response shape of /config stable was a
--     mandate; isolating the private key guarantees it.
--   * The SP keypair is generated lazily on first metadata/AuthnRequest use and
--     persisted so the published SP certificate is stable across restarts /
--     Lambda cold starts (an IdP pins the SP cert in its trust config — a
--     per-process ephemeral cert would break federation after a redeploy).
--
-- Follows the 009a_rls_enforcement.sql conventions: ENABLE + FORCE RLS, a
-- fail-closed tenant_isolation policy keyed on current_setting('app.current_tenant')
-- with missing_ok=true (unset context => NULL => deny-all), and WITH CHECK so a
-- row can never be written into another tenant. Idempotent (IF NOT EXISTS /
-- DROP POLICY IF EXISTS). The runner (db/migrate.ts) discovers files via
-- readdirSync().sort(); 039_ slots after 038_platform_settings.sql.
-- ============================================================================

BEGIN;

-- Provider-specific signing/digest preferences live alongside the SP keypair so a
-- single per-tenant row carries everything the ACS verifier and metadata endpoint
-- need. signature_algorithm / digest_algorithm are W3C XML-DSig URIs (e.g.
-- 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256'); they are enforced (not just
-- advertised) when verifying a signed assertion.
CREATE TABLE IF NOT EXISTS saml_sp_keypairs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
  -- SP X.509 self-signed certificate (PEM) published in SP metadata <KeyDescriptor>.
  sp_certificate TEXT NOT NULL,
  -- SP RSA private key (PEM). SECRET: never selected by /config, never logged.
  sp_private_key TEXT NOT NULL,
  -- Signing/digest preferences honored during assertion signature verification.
  want_assertions_signed BOOLEAN NOT NULL DEFAULT true,
  authn_requests_signed BOOLEAN NOT NULL DEFAULT false,
  signature_algorithm TEXT NOT NULL
    DEFAULT 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256',
  digest_algorithm TEXT NOT NULL
    DEFAULT 'http://www.w3.org/2001/04/xmlenc#sha256',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS saml_sp_keypairs_tenant_id_idx
  ON saml_sp_keypairs(tenant_id);

-- Fail-closed tenant isolation (matches 009a_rls_enforcement.sql semantics).
ALTER TABLE saml_sp_keypairs ENABLE ROW LEVEL SECURITY;
ALTER TABLE saml_sp_keypairs FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_saml_sp_keypairs ON saml_sp_keypairs;
CREATE POLICY tenant_isolation_saml_sp_keypairs ON saml_sp_keypairs
  USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);

COMMIT;
