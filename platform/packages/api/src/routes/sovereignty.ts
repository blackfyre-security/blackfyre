import type { FastifyPluginAsync } from "fastify";
import { EncryptionProviderService } from "../services/encryption-provider-service.js";
import type { EncryptionConfig, EncryptedField, GeoPin } from "../services/encryption-provider-service.js";
import { badRequest } from "../utils/errors.js";

const VALID_MODES = ["blackfyre-managed", "client-byok-aws", "client-byok-azure"] as const;

export const sovereigntyRoutes: FastifyPluginAsync = async (app) => {
  // REAL IMPL (BLACKFYRE 2026-06): construct with the owner DB pool so tenant
  // encryption configs + geo pins persist to Postgres (tenant_encryption_configs /
  // tenant_geo_pins) and survive restart. superDb is correct for this cross-tenant,
  // boot-capable service; RLS on the tables is defense-in-depth.
  const encryptionService = new EncryptionProviderService(app.log, app.superDb);
  const authenticated = (app as any).requireRole("owner", "admin", "engineer", "viewer");
  const adminOnly = (app as any).requireRole("owner", "admin");

  // GET /api/sovereignty/status
  // Full sovereignty compliance audit for the authenticated tenant
  app.get("/api/sovereignty/status", { preHandler: [authenticated] }, async (request) => {
    // REAL IMPL (BLACKFYRE 2026-06): load this tenant's persisted config/geo-pin into
    // the cache so the status reflects durable state after a restart/cold start.
    await encryptionService.hydrateTenant(request.tenantId);
    const status = encryptionService.getSovereigntyStatus(request.tenantId);
    return { status };
  });

  // POST /api/sovereignty/encryption/config
  // Set encryption mode and key references for the tenant
  app.post("/api/sovereignty/encryption/config", { preHandler: [adminOnly] }, async (request, reply) => {
    const body = request.body as {
      mode?: unknown;
      awsKmsKeyArn?: unknown;
      azureKeyVaultUrl?: unknown;
      azureKeyName?: unknown;
      region?: unknown;
    };

    if (!body?.mode || typeof body.mode !== "string") {
      throw badRequest("MISSING_FIELD", "mode is required");
    }
    if (!VALID_MODES.includes(body.mode as (typeof VALID_MODES)[number])) {
      throw badRequest(
        "INVALID_MODE",
        `mode must be one of: ${VALID_MODES.join(", ")}`,
      );
    }

    const config: EncryptionConfig = {
      mode: body.mode as EncryptionConfig["mode"],
      awsKmsKeyArn: typeof body.awsKmsKeyArn === "string" ? body.awsKmsKeyArn : undefined,
      azureKeyVaultUrl: typeof body.azureKeyVaultUrl === "string" ? body.azureKeyVaultUrl : undefined,
      azureKeyName: typeof body.azureKeyName === "string" ? body.azureKeyName : undefined,
      region: typeof body.region === "string" ? body.region : undefined,
    };

    if (config.mode === "client-byok-aws" && !config.awsKmsKeyArn) {
      throw badRequest("MISSING_FIELD", "awsKmsKeyArn is required for client-byok-aws mode");
    }
    if (config.mode === "client-byok-azure" && (!config.azureKeyVaultUrl || !config.azureKeyName)) {
      throw badRequest("MISSING_FIELD", "azureKeyVaultUrl and azureKeyName are required for client-byok-azure mode");
    }

    encryptionService.setTenantConfig(request.tenantId, config);

    return reply.status(200).send({
      message: "Encryption configuration updated",
      config: {
        mode: config.mode,
        keyId: config.awsKmsKeyArn
          ?? (config.azureKeyVaultUrl ? `${config.azureKeyVaultUrl}/${config.azureKeyName}` : null),
        region: config.region ?? null,
      },
    });
  });

  // POST /api/sovereignty/geo-pin
  // Set geographic pinning constraints for the tenant
  app.post("/api/sovereignty/geo-pin", { preHandler: [adminOnly] }, async (request, reply) => {
    const body = request.body as {
      allowedRegions?: unknown;
      primaryRegion?: unknown;
      dataResidencyLaw?: unknown;
      enforced?: unknown;
    };

    if (!Array.isArray(body?.allowedRegions) || body.allowedRegions.length === 0) {
      throw badRequest("MISSING_FIELD", "allowedRegions array is required and must not be empty");
    }
    if (!body?.primaryRegion || typeof body.primaryRegion !== "string") {
      throw badRequest("MISSING_FIELD", "primaryRegion is required");
    }

    const pin: GeoPin = {
      tenantId: request.tenantId,
      allowedRegions: (body.allowedRegions as unknown[]).map(String),
      primaryRegion: body.primaryRegion,
      dataResidencyLaw: typeof body.dataResidencyLaw === "string" ? body.dataResidencyLaw : "",
      enforced: body.enforced === true,
    };

    encryptionService.setGeoPin(pin);

    return reply.status(200).send({ message: "Geographic pin configured", pin });
  });

  // GET /api/sovereignty/geo-pin
  // Get current geo pin config for the tenant
  app.get("/api/sovereignty/geo-pin", { preHandler: [authenticated] }, async (request) => {
    const pin = encryptionService.getGeoPin(request.tenantId);
    const check = encryptionService.enforceGeoPin(request.tenantId);

    return {
      pin: pin ?? null,
      currentRegion: check.currentRegion,
      compliant: check.allowed,
    };
  });

  // POST /api/sovereignty/encrypt-field
  // Encrypt a plaintext value using the tenant's configured key
  app.post("/api/sovereignty/encrypt-field", { preHandler: [adminOnly] }, async (request, reply) => {
    const body = request.body as { plaintext?: unknown };

    if (!body?.plaintext || typeof body.plaintext !== "string") {
      throw badRequest("MISSING_FIELD", "plaintext is required");
    }

    const encrypted = await encryptionService.encryptField(request.tenantId, body.plaintext);
    return reply.status(200).send({ encrypted });
  });

  // POST /api/sovereignty/decrypt-field
  // Decrypt an EncryptedField using the tenant's configured key
  app.post("/api/sovereignty/decrypt-field", { preHandler: [adminOnly] }, async (request, reply) => {
    const body = request.body as { encrypted?: unknown };

    if (!body?.encrypted || typeof body.encrypted !== "object") {
      throw badRequest("MISSING_FIELD", "encrypted object is required");
    }

    const field = body.encrypted as Partial<EncryptedField>;
    if (!field.ciphertext || !field.iv || !field.authTag || !field.mode) {
      throw badRequest("MISSING_FIELD", "encrypted must include ciphertext, iv, authTag, and mode");
    }

    const plaintext = await encryptionService.decryptField(request.tenantId, field as EncryptedField);
    return reply.status(200).send({ plaintext });
  });

  // POST /api/sovereignty/key-test
  // Test BYOK key connectivity without encrypting real data
  app.post("/api/sovereignty/key-test", { preHandler: [adminOnly] }, async (request) => {
    const result = await encryptionService.testKeyConnectivity(request.tenantId);
    return { connectivity: result };
  });
};
