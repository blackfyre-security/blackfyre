import type { FastifyPluginAsync } from "fastify";
import { CryptoShredService, PrivateLinkService } from "../services/crypto-shred-service.js";
import { badRequest } from "../utils/errors.js";

const VALID_PROVIDERS = ["aws", "azure", "gcp"] as const;

// Process-level singleton — mirrors the pattern used in sovereignty.ts and
// confidential-compute.ts where services are instantiated once per plugin.
const privateLinkService = new PrivateLinkService();

export const satelliteHardeningRoutes: FastifyPluginAsync = async (app) => {
  const authenticated = (app as any).requireRole("owner", "admin", "engineer", "viewer");
  const adminOnly = (app as any).requireRole("owner", "admin");

  // ------------------------------------------------------------------ //
  //  Crypto Shred                                                        //
  // ------------------------------------------------------------------ //

  // POST /api/sovereignty/crypto-shred
  // Trigger cryptographic shred of all tenant data after BYOK key revocation.
  // Requires confirmation token to prevent accidental invocation.
  app.post("/api/sovereignty/crypto-shred", { preHandler: [adminOnly] }, async (request, reply) => {
    const body = request.body as {
      confirmation?: unknown;
      reason?: unknown;
    };

    if (body?.confirmation !== "CONFIRM_SHRED") {
      throw badRequest(
        "CONFIRMATION_REQUIRED",
        'confirmation must equal "CONFIRM_SHRED" to proceed',
      );
    }
    if (!body?.reason || typeof body.reason !== "string") {
      throw badRequest("MISSING_FIELD", "reason is required");
    }

    const service = new CryptoShredService(app.db);
    const report = await service.shredTenantData(request.tenantId, body.reason);

    return reply.status(200).send({ report });
  });

  // GET /api/sovereignty/crypto-shred/verify
  // Verify that a previous shred operation completed for the authenticated tenant.
  app.get("/api/sovereignty/crypto-shred/verify", { preHandler: [adminOnly] }, async (request) => {
    const service = new CryptoShredService(app.db);
    const result = await service.verifyShred(request.tenantId);
    return { verification: result };
  });

  // ------------------------------------------------------------------ //
  //  Private Link / VPC Peering                                         //
  // ------------------------------------------------------------------ //

  // POST /api/sovereignty/private-link
  // Configure Private Link or VPC Peering for the tenant's network topology.
  app.post("/api/sovereignty/private-link", { preHandler: [adminOnly] }, async (request, reply) => {
    const body = request.body as {
      provider?: unknown;
      serviceName?: unknown;
      vpcEndpointId?: unknown;
      publicInternetBlocked?: unknown;
    };

    if (!body?.provider || typeof body.provider !== "string") {
      throw badRequest("MISSING_FIELD", "provider is required");
    }
    if (!VALID_PROVIDERS.includes(body.provider as (typeof VALID_PROVIDERS)[number])) {
      throw badRequest(
        "INVALID_PROVIDER",
        `provider must be one of: ${VALID_PROVIDERS.join(", ")}`,
      );
    }
    if (!body?.serviceName || typeof body.serviceName !== "string") {
      throw badRequest("MISSING_FIELD", "serviceName is required");
    }

    const config = privateLinkService.configurePrivateLink(request.tenantId, {
      provider: body.provider as (typeof VALID_PROVIDERS)[number],
      serviceName: body.serviceName,
      vpcEndpointId: typeof body.vpcEndpointId === "string" ? body.vpcEndpointId : undefined,
      publicInternetBlocked: body.publicInternetBlocked === true,
    });

    return reply.status(201).send({ config });
  });

  // GET /api/sovereignty/private-link
  // Retrieve the Private Link configuration for the authenticated tenant.
  app.get("/api/sovereignty/private-link", { preHandler: [authenticated] }, async (request) => {
    const config = privateLinkService.getPrivateLinkConfig(request.tenantId);
    return { config: config ?? null };
  });

  // GET /api/sovereignty/network-status
  // Full network topology audit — used by sovereignty compliance reports.
  app.get("/api/sovereignty/network-status", { preHandler: [authenticated] }, async (request) => {
    const status = privateLinkService.getNetworkStatus(request.tenantId);
    return { networkStatus: status };
  });
};
