import type { FastifyPluginAsync } from "fastify";
import {
  createAlertRuleSchema,
  updateAlertRuleSchema,
  listAlertRulesQuerySchema,
  toggleAlertRuleSchema,
} from "@blackfyre/shared";
import { AlertService } from "../services/alert-service.js";
import { NotificationDispatcher } from "../services/notification-dispatcher.js";
import { badRequest } from "../utils/errors.js";

export const alertRoutes: FastifyPluginAsync = async (app) => {
  const authenticated = (app as any).requireRole("owner", "admin", "engineer", "viewer");
  const adminOrEngineer = (app as any).requireRole("owner", "admin", "engineer");
  const adminOnly = (app as any).requireRole("owner", "admin");

  // GET /api/alerts — list alert rules for tenant
  app.get("/api/alerts", { preHandler: [authenticated] }, async (request) => {
    const query = listAlertRulesQuerySchema.parse(request.query);
    const service = new AlertService(app.db);
    const { rows, total } = await service.list(request.tenantId, {
      triggerType: query.triggerType,
      enabled: query.enabled,
      limit: query.limit,
      offset: query.offset,
    });
    return {
      alertRules: rows,
      pagination: { limit: query.limit, offset: query.offset, total },
    };
  });

  // POST /api/alerts — create alert rule
  app.post("/api/alerts", { preHandler: [adminOrEngineer] }, async (request, reply) => {
    const body = createAlertRuleSchema.parse(request.body);
    const service = new AlertService(app.db);
    const created = await service.create(request.tenantId, {
      triggerType: body.triggerType,
      triggerConfig: body.triggerConfig,
      channels: body.channels,
      quietHoursStart: body.quietHoursStart,
      quietHoursEnd: body.quietHoursEnd,
      quietHoursTz: body.quietHoursTz,
      enabled: body.enabled,
    });
    return reply.status(201).send({ alertRule: created });
  });

  // GET /api/alerts/:id — get single rule
  app.get<{ Params: { id: string } }>("/api/alerts/:id", {
    preHandler: [authenticated],
  }, async (request) => {
    const service = new AlertService(app.db);
    const rule = await service.getById(request.params.id, request.tenantId);
    return { alertRule: rule };
  });

  // PATCH /api/alerts/:id — update rule
  app.patch<{ Params: { id: string } }>("/api/alerts/:id", {
    preHandler: [adminOrEngineer],
  }, async (request) => {
    const body = updateAlertRuleSchema.parse(request.body);

    if (Object.keys(body).length === 0) {
      throw badRequest("EMPTY_UPDATE", "No fields to update");
    }

    const service = new AlertService(app.db);
    const updated = await service.update(request.params.id, request.tenantId, body);
    return { alertRule: updated };
  });

  // DELETE /api/alerts/:id — delete rule (admin only)
  app.delete<{ Params: { id: string } }>("/api/alerts/:id", {
    preHandler: [adminOnly],
  }, async (request) => {
    const service = new AlertService(app.db);
    const removed = await service.delete(request.params.id, request.tenantId);
    return { alertRule: removed, message: "Alert rule deleted." };
  });

  // POST /api/alerts/:id/toggle — enable/disable rule
  app.post<{ Params: { id: string } }>("/api/alerts/:id/toggle", {
    preHandler: [adminOrEngineer],
  }, async (request) => {
    const body = toggleAlertRuleSchema.parse(request.body);
    const service = new AlertService(app.db);
    const updated = await service.toggle(request.params.id, request.tenantId, body.enabled);
    return { alertRule: updated };
  });

  // POST /api/alerts/:id/test — send a REAL test notification through the dispatcher.
  // REAL IMPL (BLACKFYRE 2026-06): testRule() now performs the actual dispatch to every
  // configured channel (email/slack/webhook/sms) and reports which were sent vs
  // suppressed by quiet hours. The previous duplicate dispatch loop here (which used
  // the now-removed SMS stub and re-fetched the rule) has been removed so a single
  // test send happens.
  app.post<{ Params: { id: string } }>("/api/alerts/:id/test", {
    preHandler: [adminOrEngineer],
  }, async (request) => {
    const service = new AlertService(app.db);
    const dispatcher = new NotificationDispatcher();
    return service.testRule(request.params.id, request.tenantId, dispatcher);
  });
};
