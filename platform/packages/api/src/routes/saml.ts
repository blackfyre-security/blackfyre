import type { FastifyPluginAsync } from "fastify";
import { eq, and } from "drizzle-orm";
import { tenants, refreshTokens, users } from "../db/schema.js";
import { SamlService } from "../services/saml-service.js";
import { badRequest, notFound, forbidden } from "../utils/errors.js";
import { createHash } from "crypto";

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex").slice(0, 128);
}

export const samlRoutes: FastifyPluginAsync = async (app) => {
  const planGuard = app.requirePlan("Defend");
  // GET /api/auth/saml/metadata — public, returns SP metadata XML
  app.get("/api/auth/saml/metadata", async (request, reply) => {
    const { SAML_SP_ENTITY_ID, SAML_ACS_URL } = app.config;
    const service = new SamlService(app.db, app.superDb, request.log);
    const xml = service.generateSpMetadata(SAML_SP_ENTITY_ID, SAML_ACS_URL);
    return reply.type("application/xml").send(xml);
  });

  // REAL IMPL (BLACKFYRE 2026-06): per-tenant SP metadata. Public (an IdP admin
  // fetches it while configuring federation; it exposes only the SP's own public
  // entityID, ACS URL and X.509 SIGNING certificate — never any secret). The
  // entityID is tenant-scoped so multiple tenants federating with the same IdP each
  // get a distinct SP entity, and the embedded certificate is the tenant's
  // persisted, stable SP cert (migration 039).
  // GET /api/auth/saml/metadata/:tenantSlug
  app.get("/api/auth/saml/metadata/:tenantSlug", async (request, reply) => {
    const { tenantSlug } = request.params as { tenantSlug: string };

    const [tenant] = await app.superDb
      .select()
      .from(tenants)
      .where(eq(tenants.slug, tenantSlug))
      .limit(1);

    if (!tenant) throw notFound("Tenant");

    const { SAML_SP_ENTITY_ID, SAML_ACS_URL } = app.config;
    // Tenant-scoped SP entityID + ACS RelayState so the IdP round-trips the tenant.
    const entityId = `${SAML_SP_ENTITY_ID}/tenant/${tenant.slug}`;
    const service = new SamlService(app.db, app.superDb, request.log);
    const xml = await service.generateTenantSpMetadata(tenant.id, entityId, SAML_ACS_URL);
    return reply.type("application/xml").send(xml);
  });

  // POST /api/auth/saml/init/:tenantSlug — redirect to IdP SSO URL
  app.post("/api/auth/saml/init/:tenantSlug", async (request, reply) => {
    const { tenantSlug } = request.params as { tenantSlug: string };

    const [tenant] = await app.superDb
      .select()
      .from(tenants)
      .where(eq(tenants.slug, tenantSlug))
      .limit(1);

    if (!tenant) throw notFound("Tenant");

    const service = new SamlService(app.db, app.superDb, request.log);
    const config = await service.getConfig(tenant.id);

    if (!config || !config.enabled) {
      throw badRequest("SSO_NOT_CONFIGURED", "SSO is not configured or enabled for this tenant");
    }

    // Build a minimal SAML AuthnRequest
    const id = `_${crypto.randomUUID().replace(/-/g, "")}`;
    const issueInstant = new Date().toISOString();
    const { SAML_SP_ENTITY_ID, SAML_ACS_URL } = app.config;
    // REAL IMPL (BLACKFYRE 2026-06): use the same tenant-scoped SP entityID that the
    // per-tenant metadata endpoint publishes, so the IdP's trust config (keyed on
    // SP entityID) matches the Issuer it receives in the AuthnRequest.
    const spEntityId = `${SAML_SP_ENTITY_ID}/tenant/${tenant.slug}`;

    const authnRequest = Buffer.from(`<?xml version="1.0"?>
<samlp:AuthnRequest
  xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"
  xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"
  ID="${id}"
  Version="2.0"
  IssueInstant="${issueInstant}"
  AssertionConsumerServiceURL="${SAML_ACS_URL}"
  ProtocolBinding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST">
  <saml:Issuer>${spEntityId}</saml:Issuer>
</samlp:AuthnRequest>`).toString("base64");

    const redirectUrl = `${config.ssoUrl}?SAMLRequest=${encodeURIComponent(authnRequest)}&RelayState=${encodeURIComponent(tenantSlug)}`;
    return reply.redirect(302, redirectUrl);
  });

  // POST /api/auth/saml/acs — Assertion Consumer Service
  app.post("/api/auth/saml/acs", async (request, reply) => {
    const body = request.body as { SAMLResponse?: string; RelayState?: string };

    if (!body.SAMLResponse) {
      throw badRequest("SAML_MISSING", "SAMLResponse is required");
    }

    const tenantSlug = body.RelayState;
    if (!tenantSlug) {
      throw badRequest("SAML_RELAY_MISSING", "RelayState (tenant slug) is required");
    }

    const [tenant] = await app.superDb
      .select()
      .from(tenants)
      .where(eq(tenants.slug, tenantSlug))
      .limit(1);

    if (!tenant) throw notFound("Tenant");

    const service = new SamlService(app.db, app.superDb, request.log);

    const config = await service.getConfig(tenant.id);
    if (!config) throw badRequest("SSO_NOT_CONFIGURED", "SSO is not configured for this tenant");

    const { email, name } = await service.validateResponse(body.SAMLResponse, tenant.id);

    if (!config.autoProvision) {
      // REAL IMPL (BLACKFYRE 2026-06): scope the pre-existing-user check to THIS tenant —
      // a global email lookup could match a user in a different tenant and wrongly admit them.
      const [existing] = await app.superDb
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.email, email), eq(users.tenantId, tenant.id)))
        .limit(1);

      if (!existing) {
        return reply.status(403).send({
          success: false,
          error: {
            code: "SSO_ACCOUNT_NOT_FOUND",
            message: "Account not found. Contact your administrator.",
            requestId: request.requestId,
            timestamp: new Date().toISOString(),
          },
        });
      }
    }

    const user = await service.findOrCreateUser(tenant.id, email, name, config.defaultRole);

    // Check MFA before issuing tokens (security fix: SSO must not bypass MFA)
    if (user.mfaEnabled) {
      const mfaChallengeToken = app.jwt.sign(
        { sub: user.id, tenantId: user.tenantId, type: "mfa_challenge" as const },
        { expiresIn: "5m" },
      );
      return reply.send({ success: true, data: { mfaRequired: true, mfaChallengeToken } });
    }

    const accessToken = app.jwt.sign(
      { sub: user.id, tenantId: user.tenantId, role: user.role, type: "access" as const },
      { expiresIn: app.config.JWT_EXPIRES_IN },
    );

    const rawRefreshToken = app.jwt.sign(
      { sub: user.id, tenantId: user.tenantId, role: user.role, type: "refresh" as const },
      { expiresIn: app.config.JWT_REFRESH_EXPIRES_IN },
    );

    const refreshExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await app.superDb.insert(refreshTokens).values({
      userId: user.id,
      tenantId: user.tenantId,
      tokenHash: hashToken(rawRefreshToken),
      familyId: crypto.randomUUID(),
      expiresAt: refreshExpiry,
    });

    return reply.send({
      success: true,
      data: {
        accessToken,
        refreshToken: rawRefreshToken,
        user: { id: user.id, email: user.email, name: user.name, role: user.role },
      },
    });
  });

  // GET /api/auth/saml/config — admin only, returns SSO config for tenant
  app.get("/api/auth/saml/config", {
    preHandler: [(app as any).authenticate, planGuard],
  }, async (request, reply) => {
    if (request.userRole !== "admin" && request.userRole !== "owner") {
      throw forbidden("Only admin or owner can manage SSO configuration");
    }

    const service = new SamlService(app.db, app.superDb, request.log);
    const config = await service.getConfig(request.tenantId);

    if (!config) {
      return reply.status(404).send({
        success: false,
        error: {
          code: "SSO_NOT_CONFIGURED",
          message: "No SSO configuration found for this tenant",
          requestId: request.requestId,
          timestamp: new Date().toISOString(),
        },
      });
    }

    // Mask the certificate in the response for security
    return reply.send({
      success: true,
      data: {
        ...config,
        certificate: config.certificate ? `${config.certificate.slice(0, 40)}...` : null,
      },
    });
  });

  // PUT /api/auth/saml/config — admin only, saves SSO config
  app.put("/api/auth/saml/config", {
    preHandler: [(app as any).authenticate, planGuard],
  }, async (request, reply) => {
    if (request.userRole !== "admin" && request.userRole !== "owner") {
      throw forbidden("Only admin or owner can manage SSO configuration");
    }

    const body = request.body as {
      provider?: string;
      entityId?: string;
      ssoUrl?: string;
      certificate?: string;
      defaultRole?: string;
      autoProvision?: boolean;
      enabled?: boolean;
    };

    if (!body.provider || !body.entityId || !body.ssoUrl || !body.certificate) {
      throw badRequest("SSO_MISSING_FIELDS", "provider, entityId, ssoUrl, and certificate are required");
    }

    const allowedProviders = ["okta", "azure_ad", "google_workspace", "custom"];
    if (!allowedProviders.includes(body.provider)) {
      throw badRequest("SSO_INVALID_PROVIDER", `provider must be one of: ${allowedProviders.join(", ")}`);
    }

    const service = new SamlService(app.db, app.superDb, request.log);
    const config = await service.saveConfig(request.tenantId, {
      provider: body.provider,
      entityId: body.entityId,
      ssoUrl: body.ssoUrl,
      certificate: body.certificate,
      defaultRole: body.defaultRole as any,
      autoProvision: body.autoProvision,
      enabled: body.enabled,
    });

    return reply.send({ success: true, data: config });
  });
};
