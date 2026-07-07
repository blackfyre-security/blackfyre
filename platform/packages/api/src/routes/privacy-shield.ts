import type { FastifyPluginAsync } from "fastify";
import { PrivacyShieldService } from "../services/privacy-shield-service.js";
import { badRequest } from "../utils/errors.js";

export const privacyShieldRoutes: FastifyPluginAsync = async (app) => {
  const authenticated = (app as any).requireRole("owner", "admin", "engineer", "viewer");
  const adminOnly = (app as any).requireRole("owner", "admin");
  const planGuard = app.requirePlan("Defend");

  const svc = new PrivacyShieldService(app.db);

  // POST /api/privacy/dpia
  // Generate a Data Protection Impact Assessment for a processing activity
  app.post("/api/privacy/dpia", { preHandler: [adminOnly, planGuard] }, async (request, reply) => {
    const body = request.body as {
      processingActivity?: unknown;
      dataCategories?: unknown;
      purpose?: unknown;
    };

    if (!body?.processingActivity || typeof body.processingActivity !== "string") {
      throw badRequest("MISSING_FIELD", "processingActivity is required");
    }
    if (!Array.isArray(body?.dataCategories) || body.dataCategories.length === 0) {
      throw badRequest("MISSING_FIELD", "dataCategories array is required and must not be empty");
    }
    if (!body?.purpose || typeof body.purpose !== "string") {
      throw badRequest("MISSING_FIELD", "purpose is required");
    }

    const dpia = await svc.generateDpia(request.tenantId, {
      processingActivity: body.processingActivity,
      dataCategories: (body.dataCategories as unknown[]).map(String),
      purpose: body.purpose,
    });

    return reply.status(201).send({ dpia });
  });

  // GET /api/privacy/ropa
  // Generate / retrieve the Records of Processing Activities for the tenant
  app.get("/api/privacy/ropa", { preHandler: [authenticated, planGuard] }, async (request, reply) => {
    const ropa = await svc.generateRopa(request.tenantId);
    return reply.status(200).send({ ropa });
  });

  // GET /api/privacy/dashboard
  // Privacy dashboard data for the tenant
  app.get("/api/privacy/dashboard", { preHandler: [authenticated, planGuard] }, async (request, reply) => {
    const dashboard = await svc.getPrivacyDashboard(request.tenantId);
    return reply.status(200).send({ dashboard });
  });

  // GET /api/privacy/pdppl-status
  // PDPPL compliance check for the tenant
  app.get("/api/privacy/pdppl-status", { preHandler: [authenticated, planGuard] }, async (request, reply) => {
    const status = await svc.checkPdpplCompliance(request.tenantId);
    return reply.status(200).send({ status });
  });

  // GET /api/privacy/processing-activities
  // Auto-detected processing activities derived from scan findings
  app.get("/api/privacy/processing-activities", { preHandler: [authenticated, planGuard] }, async (request, reply) => {
    const activities = await svc.detectProcessingActivities(request.tenantId);
    return reply.status(200).send({ activities });
  });
};
