import type { FastifyPluginAsync } from "fastify";
import { StakeholderService } from "../services/stakeholder-service.js";
import { notFound, badRequest } from "../utils/errors.js";
import { requireUUID } from "../utils/security-fixes.js";

export const stakeholderRoutes: FastifyPluginAsync = async (app) => {
  const authenticated = (app as any).requireRole("owner", "admin", "engineer", "viewer");
  const canManage = (app as any).requireRole("owner", "admin");

  // POST /api/stakeholder/links — create a new share link
  app.post("/api/stakeholder/links", { preHandler: [canManage] }, async (request, reply) => {
    const body = request.body as {
      label?: string;
      expiresAt?: string;
      frameworks?: string[];
      showRemediation?: boolean;
      showTrend?: boolean;
    };

    if (!body.label || typeof body.label !== "string" || body.label.trim().length === 0) {
      throw badRequest("MISSING_LABEL", "label is required");
    }

    const expiresAt = body.expiresAt ? new Date(body.expiresAt) : undefined;
    if (expiresAt && isNaN(expiresAt.getTime())) {
      throw badRequest("INVALID_EXPIRY", "expiresAt must be a valid ISO date string");
    }

    const service = new StakeholderService(app.db);
    const link = await service.createShareLink(request.tenantId, {
      label: body.label.trim(),
      expiresAt,
      frameworks: Array.isArray(body.frameworks) ? body.frameworks : undefined,
      showRemediation: typeof body.showRemediation === "boolean" ? body.showRemediation : false,
      showTrend: typeof body.showTrend === "boolean" ? body.showTrend : true,
      createdBy: request.userId,
    });

    return reply.status(201).send({ link });
  });

  // GET /api/stakeholder/links — list all share links for tenant
  app.get("/api/stakeholder/links", { preHandler: [authenticated] }, async (request) => {
    const service = new StakeholderService(app.db);
    const links = await service.listShareLinks(request.tenantId);
    return { links };
  });

  // DELETE /api/stakeholder/links/:id — revoke a share link
  app.delete<{ Params: { id: string } }>("/api/stakeholder/links/:id", {
    preHandler: [canManage],
  }, async (request, reply) => {
    requireUUID(request.params.id);
    const service = new StakeholderService(app.db);
    await service.revokeLink(request.params.id, request.tenantId);
    return reply.status(204).send();
  });

  // GET /api/stakeholder/dashboard/:token — PUBLIC, no auth required
  app.get<{ Params: { token: string } }>("/api/stakeholder/dashboard/:token", async (request, reply) => {
    const { token } = request.params;

    if (!token || typeof token !== "string" || token.length !== 64) {
      throw badRequest("INVALID_TOKEN", "Invalid or malformed token");
    }

    const service = new StakeholderService(app.db);

    // Handle expiry — surface 410 Gone
    let data: Awaited<ReturnType<typeof service.getDashboardData>>;
    try {
      data = await service.getDashboardData(token);
    } catch (err: any) {
      if (err?.statusCode === 410) {
        return reply.status(410).send({
          success: false,
          error: { code: "LINK_EXPIRED", message: "This stakeholder link has expired" },
        });
      }
      if (err?.statusCode === 404) {
        throw notFound("StakeholderLink");
      }
      throw err;
    }

    return { dashboard: data };
  });

  // PUT /api/stakeholder/branding — update tenant branding
  app.put("/api/stakeholder/branding", { preHandler: [canManage] }, async (request) => {
    const body = request.body as {
      logoUrl?: string;
      primaryColor?: string;
      secondaryColor?: string;
      companyName?: string;
      tagline?: string;
    };

    // Validate hex color format if provided
    const hexColorRegex = /^#[0-9A-Fa-f]{6}$/;
    if (body.primaryColor && !hexColorRegex.test(body.primaryColor)) {
      throw badRequest("INVALID_COLOR", "primaryColor must be a valid 6-digit hex color (e.g. #FF4D00)");
    }
    if (body.secondaryColor && !hexColorRegex.test(body.secondaryColor)) {
      throw badRequest("INVALID_COLOR", "secondaryColor must be a valid 6-digit hex color (e.g. #F59E0B)");
    }

    const service = new StakeholderService(app.db);
    const branding = await service.updateBranding(request.tenantId, {
      logoUrl: typeof body.logoUrl === "string" ? body.logoUrl : undefined,
      primaryColor: typeof body.primaryColor === "string" ? body.primaryColor : undefined,
      secondaryColor: typeof body.secondaryColor === "string" ? body.secondaryColor : undefined,
      companyName: typeof body.companyName === "string" ? body.companyName : undefined,
      tagline: typeof body.tagline === "string" ? body.tagline : undefined,
    });

    return { branding };
  });

  // GET /api/stakeholder/branding — get tenant branding
  app.get("/api/stakeholder/branding", { preHandler: [authenticated] }, async (request) => {
    const service = new StakeholderService(app.db);
    const branding = await service.getBranding(request.tenantId);
    return { branding };
  });
};
