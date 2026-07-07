import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import { createIntegrationSchema, updateIntegrationSchema } from "@blackfyre/shared";
import { badRequest } from "../utils/errors.js";
import { requireUUID } from "../utils/security-fixes.js";
import { IntegrationService } from "../services/integration-service.js";
import { redactCredentials } from "../lib/redact.js";
import { safeFetch, SsrfBlockedError } from "../lib/safe-fetch.js";

/** Provider types that require the Protect plan tier */
const PROTECT_TIER_PROVIDERS = new Set(["azure", "gcp"]);

/** Provider names accepted by the onboarding credential test (pre-creation).
 *  Disambiguates POST /api/integrations/:key/test: a known provider name means
 *  an onboarding identity check, anything else is an existing integration UUID.
 *  Real integration ids are UUIDs, never these literals, so there's no clash. */
const ONBOARDING_PROVIDERS = new Set(["aws", "azure", "gcp"]);

export const integrationRoutes: FastifyPluginAsync = async (app) => {
  const adminOrEngineer = (app as any).requireRole("owner", "admin", "engineer");
  const authenticated = (app as any).requireRole("owner", "admin", "engineer", "viewer");
  const requireProtect = (app as any).requirePlan("Protect");

  // Body-aware plan gate: rejects with 403 if integration type is azure/gcp
  // and the tenant is on the base Comply tier.
  async function requireProtectForCloudProvider(request: FastifyRequest, reply: FastifyReply) {
    const body = request.body as { type?: string } | undefined;
    if (body?.type && PROTECT_TIER_PROVIDERS.has(body.type.toLowerCase())) {
      return requireProtect(request, reply);
    }
  }

  // GET /api/integrations — list integrations for current tenant (uses RLS)
  app.get("/api/integrations", { preHandler: [authenticated] }, async (request) => {
    const service = new IntegrationService(request.db ?? app.db, request.log);
    const { rows, total } = await service.list(request.tenantId);
    // SECURITY FIX (BLACKFYRE audit 2026-06-05): plaintext creds returned in
    // GET /api/integrations — service.list() already strips credentialRef; redact again
    // defensively so no secret-keyed value can ever be serialized to the client.
    return redactCredentials({ integrations: rows, total });
  });

  // POST /api/integrations — create integration (admin/engineer only)
  // azure/gcp types additionally require Protect plan
  app.post("/api/integrations", { preHandler: [adminOrEngineer, requireProtectForCloudProvider] }, async (request, reply) => {
    const body = createIntegrationSchema.parse(request.body);

    // SECURITY FIX (BLACKFYRE audit 2026-06-05): plaintext cloud creds stored at rest —
    // route the create through IntegrationService so inline secret material (Azure
    // clientSecret, GCP SA key, AWS keys) is AES-256-GCM envelope-encrypted into
    // integration_credentials instead of being written plaintext into credential_ref.
    // The service returns a secret-free projection (no credentialRef) which we redact
    // again defensively before sending.
    const service = new IntegrationService(request.db ?? app.db, request.log);
    const created = await service.create(request.tenantId, {
      type: body.type,
      credentialRef: body.credentialRef,
    });

    return reply.status(201).send(redactCredentials({ integration: created }));
  });

  // GET /api/integrations/:id — get single integration
  app.get<{ Params: { id: string } }>("/api/integrations/:id", {
    preHandler: [authenticated],
  }, async (request) => {
    requireUUID(request.params.id);
    // SECURITY FIX (BLACKFYRE audit 2026-06-05): plaintext creds returned in
    // GET /api/integrations/:id — use getSafeById() which projects out credentialRef, then
    // redact defensively so no secret material is ever serialized to the client.
    const service = new IntegrationService(request.db ?? app.db, request.log);
    const integration = await service.getSafeById(request.params.id, request.tenantId);
    return redactCredentials({ integration });
  });

  // PATCH /api/integrations/:id — update integration
  app.patch<{ Params: { id: string } }>("/api/integrations/:id", {
    preHandler: [adminOrEngineer],
  }, async (request) => {
    requireUUID(request.params.id);
    const body = updateIntegrationSchema.parse(request.body);

    if (Object.keys(body).length === 0) {
      throw badRequest("EMPTY_UPDATE", "No fields to update");
    }

    // SECURITY FIX (BLACKFYRE audit 2026-06-05): plaintext cloud creds stored at rest —
    // route the update through IntegrationService so a new inline credentialRef is
    // envelope-encrypted rather than written plaintext; response is secret-free + redacted.
    const service = new IntegrationService(request.db ?? app.db, request.log);
    const updated = await service.updateForTenant(request.params.id, request.tenantId, body);
    return redactCredentials({ integration: updated });
  });

  // DELETE /api/integrations/:id — remove integration
  app.delete<{ Params: { id: string } }>("/api/integrations/:id", {
    preHandler: [adminOrEngineer],
  }, async (request) => {
    requireUUID(request.params.id);
    const service = new IntegrationService(request.db ?? app.db, request.log);
    const removed = await service.removeForTenant(request.params.id, request.tenantId);
    // SECURITY FIX (BLACKFYRE audit 2026-06-05): plaintext creds returned in responses —
    // removeForTenant returns a secret-free projection; redact defensively.
    return redactCredentials({ integration: removed, message: "Integration removed." });
  });

  // POST /api/integrations/:id/verify — trigger credential verification (legacy)
  app.post<{ Params: { id: string } }>("/api/integrations/:id/verify", {
    preHandler: [adminOrEngineer],
  }, async (request) => {
    requireUUID(request.params.id);
    // SECURITY FIX (BLACKFYRE audit 2026-06-05): cross-tenant credential access — pass
    // request.tenantId so the legacy verify path is tenant-scoped exactly like /:id/test
    // and cannot decrypt another tenant's credentials.
    const service = new IntegrationService(request.db ?? app.db, request.log);
    const result = await service.testConnection(request.params.id, request.tenantId);
    return redactCredentials({ ...result, message: "Credential verification complete." });
  });

  // POST /api/integrations/:key/test — unified to avoid a Fastify route
  // collision (":id/test" and ":provider/test" are the same path shape, which
  // makes Fastify throw FST_ERR_DUPLICATED_ROUTE at boot). If :key is a known
  // provider name it's an onboarding credential identity check (pre-creation,
  // returns { ok, identity?, error? }); otherwise :key is an existing
  // integration UUID and we test its live connection via scanning agents.
  // SECURITY FIX (BLACKFYRE audit 2026-06-05): the provider branch below performs a REAL
  // per-provider auth check via safeFetch (no fake "ok", no raw-secret echo); the UUID
  // branch is tenant-scoped so a user cannot test/decrypt another tenant's integration.
  app.post<{ Params: { key: string } }>("/api/integrations/:key/test", {
    preHandler: [adminOrEngineer],
  }, async (request, reply) => {
    const { key } = request.params;

    // Existing-integration connection test (UUID) — not an onboarding provider.
    if (!ONBOARDING_PROVIDERS.has(key.toLowerCase())) {
      requireUUID(key);
      // SECURITY FIX (BLACKFYRE audit 2026-06-05): tenant-scope the connection test so a
      // user in TenantA cannot test/decrypt TenantB's integration by UUID; redact the result.
      const service = new IntegrationService(request.db ?? app.db, request.log);
      return redactCredentials(await service.testConnection(key, request.tenantId));
    }

    const provider = key.toLowerCase();
    const body = request.body as Record<string, string>;

    // SECURITY FIX (BLACKFYRE audit 2026-06-05): credential access auditability — record
    // that a credential test ran (provider + tenant only) at info; never the secret.
    request.log.info(
      { event: "integration.credential.test", provider, tenantId: request.tenantId },
      "credential test requested",
    );

    if (provider === "aws") {
      const { STSClient, GetCallerIdentityCommand } = await import("@aws-sdk/client-sts");
      try {
        const client = new STSClient({
          region: body.region ?? "us-east-1",
          credentials: {
            accessKeyId: body.accessKeyId ?? "",
            secretAccessKey: body.secretAccessKey ?? "",
          },
        });
        const res = await client.send(new GetCallerIdentityCommand({}));
        return { ok: true, status: "verified", identity: res.Arn ?? res.UserId };
      } catch (err: any) {
        request.log.warn(
          { event: "integration.credential.test_failed", provider, tenantId: request.tenantId },
          "AWS credential verification failed",
        );
        return reply.status(400).send({ ok: false, status: "verification_failed", error: err.message ?? "AWS credential verification failed" });
      }
    }

    if (provider === "azure") {
      if (!body.tenantId || !body.clientId || !body.clientSecret) {
        return reply.status(400).send({ ok: false, status: "invalid_request", error: "tenantId, clientId and clientSecret are required" });
      }
      try {
        // SECURITY FIX (BLACKFYRE audit 2026-06-05): SSRF — body.tenantId is tenant
        // controlled and interpolated into the token URL; use safeFetch so a crafted
        // value cannot redirect the call to an internal/metadata host. encodeURIComponent
        // keeps it inside the path segment.
        const tokenRes = await safeFetch(
          `https://login.microsoftonline.com/${encodeURIComponent(body.tenantId)}/oauth2/v2.0/token`,
          {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              grant_type: "client_credentials",
              client_id: body.clientId,
              client_secret: body.clientSecret,
              scope: "https://management.azure.com/.default",
            }).toString(),
          },
          { log: request.log },
        );
        const data = await tokenRes.json() as any;
        if (!tokenRes.ok || data.error) {
          request.log.warn(
            { event: "integration.credential.test_failed", provider, tenantId: request.tenantId },
            "Azure credential verification failed",
          );
          return reply.status(400).send({ ok: false, status: "verification_failed", error: data.error_description ?? "Azure credential verification failed" });
        }
        // identity is non-secret (clientId/tenantId); the clientSecret is never echoed.
        return { ok: true, status: "verified", identity: `app:${body.clientId}@tenant:${body.tenantId}` };
      } catch (err: any) {
        if (err instanceof SsrfBlockedError) {
          request.log.warn(
            { event: "ssrf.blocked", provider, tenantId: request.tenantId },
            "Azure credential test blocked by SSRF policy",
          );
          return reply.status(400).send({ ok: false, status: "blocked", error: "Azure tenant endpoint rejected by URL policy" });
        }
        request.log.warn(
          { event: "integration.credential.test_failed", provider, tenantId: request.tenantId },
          "Azure credential verification error",
        );
        return reply.status(400).send({ ok: false, status: "verification_failed", error: "Azure credential verification failed" });
      }
    }

    if (provider === "gcp") {
      if (!body.serviceAccountKey) {
        return reply.status(400).send({ ok: false, status: "invalid_request", error: "serviceAccountKey is required" });
      }
      let sa: { client_email?: string; private_key?: string; token_uri?: string; project_id?: string };
      try {
        sa = JSON.parse(body.serviceAccountKey);
      } catch {
        return reply.status(400).send({ ok: false, status: "invalid_request", error: "Invalid service account key JSON" });
      }
      if (!sa.client_email || !sa.private_key) {
        return reply.status(400).send({ ok: false, status: "invalid_request", error: "Invalid service account key — missing client_email/private_key" });
      }

      // SECURITY FIX (BLACKFYRE audit 2026-06-05): GCP path faked "ok" with no real auth —
      // perform a REAL service-account auth: sign a JWT bearer assertion with the SA
      // private key and exchange it at Google's OAuth2 token endpoint (via safeFetch).
      // Only a successful token exchange yields ok:true; otherwise we return
      // status:"unverified" instead of pretending success. The private_key is used only to
      // sign locally and is NEVER logged or echoed.
      try {
        const { createSign } = await import("node:crypto");
        const tokenUri = "https://oauth2.googleapis.com/token";
        const now = Math.floor(Date.now() / 1000);
        const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
        const claims = Buffer.from(JSON.stringify({
          iss: sa.client_email,
          scope: "https://www.googleapis.com/auth/cloud-platform.read-only",
          aud: tokenUri,
          iat: now,
          exp: now + 3600,
        })).toString("base64url");
        const signingInput = `${header}.${claims}`;
        const signature = createSign("RSA-SHA256")
          .update(signingInput)
          .sign(sa.private_key)
          .toString("base64url");
        const assertion = `${signingInput}.${signature}`;

        const tokenRes = await safeFetch(
          tokenUri,
          {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
              assertion,
            }).toString(),
          },
          { log: request.log },
        );
        const data = await tokenRes.json() as any;
        if (!tokenRes.ok || data.error || !data.access_token) {
          request.log.warn(
            { event: "integration.credential.test_failed", provider, tenantId: request.tenantId },
            "GCP credential verification failed",
          );
          // Real failure (bad/revoked key) — do NOT fake success.
          return reply.status(400).send({
            ok: false,
            status: "verification_failed",
            error: data.error_description ?? data.error ?? "GCP credential verification failed",
            identity: `${sa.client_email} (project: ${sa.project_id ?? "unknown"})`,
          });
        }
        // Token exchange succeeded — credentials are genuinely valid.
        return { ok: true, status: "verified", identity: `${sa.client_email} (project: ${sa.project_id ?? "unknown"})` };
      } catch (err: any) {
        if (err instanceof SsrfBlockedError) {
          request.log.warn(
            { event: "ssrf.blocked", provider, tenantId: request.tenantId },
            "GCP credential test blocked by SSRF policy",
          );
          return reply.status(400).send({ ok: false, status: "blocked", error: "GCP token endpoint rejected by URL policy" });
        }
        // We could not complete the exchange (e.g. local signing failed / network).
        // SECURITY: return status:"unverified" rather than a misleading ok:true.
        request.log.warn(
          { event: "integration.credential.test_unverified", provider, tenantId: request.tenantId },
          "GCP credential could not be verified",
        );
        return reply.status(400).send({
          ok: false,
          status: "unverified",
          error: "Service account key is structurally valid but could not be verified against Google",
          identity: `${sa.client_email} (project: ${sa.project_id ?? "unknown"})`,
        });
      }
    }

    return reply.status(400).send({ ok: false, status: "unsupported", error: `Unsupported provider: ${provider}` });
  });
};
