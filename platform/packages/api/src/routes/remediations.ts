import type { FastifyPluginAsync } from "fastify";
import { RemediationService } from "../services/remediation-service.js";
import {
  createRemediationSchema,
  approveRemediationSchema,
  listRemediationsQuerySchema,
} from "@blackfyre/shared";
import { requireUUID } from "../utils/security-fixes.js";
import { z } from "zod";

export const remediationRoutes: FastifyPluginAsync = async (app) => {
  const authenticated = (app as any).requireRole("owner", "admin", "engineer", "viewer");
  const adminOrEngineer = (app as any).requireRole("owner", "admin", "engineer");
  const adminOrOwner = (app as any).requireRole("owner", "admin");
  const planGuard = app.requirePlan("Protect");

  // GET /api/remediations
  app.get("/api/remediations", { preHandler: [authenticated, planGuard] }, async (request) => {
    const query = listRemediationsQuerySchema.parse(request.query);
    const service = new RemediationService(app.db);
    const { rows, total } = await service.listForFinding(request.tenantId, query);

    return {
      remediations: rows,
      pagination: {
        limit: query.limit,
        offset: query.offset,
        total,
      },
    };
  });

  // POST /api/remediations
  app.post("/api/remediations", { preHandler: [adminOrEngineer, planGuard] }, async (request, reply) => {
    const body = createRemediationSchema.parse(request.body);
    const service = new RemediationService(app.db);
    const created = await service.create(request.tenantId, body);

    return reply.status(201).send({ remediation: created });
  });

  // GET /api/remediations/:id
  app.get<{ Params: { id: string } }>("/api/remediations/:id", {
    preHandler: [authenticated, planGuard],
  }, async (request) => {
    requireUUID(request.params.id);
    const service = new RemediationService(app.db);
    const record = await service.getById(request.params.id, request.tenantId);
    return { remediation: record };
  });

  // POST /api/remediations/:id/approve
  app.post<{ Params: { id: string } }>("/api/remediations/:id/approve", {
    preHandler: [adminOrOwner, planGuard],
  }, async (request) => {
    requireUUID(request.params.id);
    const body = approveRemediationSchema.parse(request.body);
    const service = new RemediationService(app.db);

    if (!body.approved) {
      return { remediation: await service.getById(request.params.id, request.tenantId), message: "Approval declined" };
    }

    const updated = await service.approve(request.params.id, request.tenantId, request.userId);
    return { remediation: updated };
  });

  // POST /api/remediations/:id/execute
  app.post<{ Params: { id: string } }>("/api/remediations/:id/execute", {
    preHandler: [adminOrEngineer, planGuard],
  }, async (request) => {
    requireUUID(request.params.id);
    const service = new RemediationService(app.db);
    const updated = await service.execute(request.params.id, request.tenantId);
    return { remediation: updated };
  });

  // POST /api/remediations/:id/complete
  app.post<{ Params: { id: string } }>("/api/remediations/:id/complete", {
    preHandler: [adminOrEngineer, planGuard],
  }, async (request) => {
    requireUUID(request.params.id);
    const body = (request.body ?? {}) as { afterSnapshot?: Record<string, unknown> };
    const afterSnapshot = body.afterSnapshot ?? {};
    const service = new RemediationService(app.db);
    const updated = await service.complete(request.params.id, request.tenantId, afterSnapshot);
    return { remediation: updated };
  });
};
