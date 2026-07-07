import type { FastifyPluginAsync } from "fastify";
import {
  listPatternsQuerySchema,
  industryInsightParamsSchema,
} from "@blackfyre/shared";
import { LearningService } from "../services/learning-service.js";

export const learningRoutes: FastifyPluginAsync = async (app) => {
  const authenticated = (app as any).requireRole("owner", "admin", "engineer", "viewer");
  const adminOrEngineer = (app as any).requireRole("owner", "admin", "engineer");

  // GET /api/learning/patterns — list patterns with filters
  app.get("/api/learning/patterns", { preHandler: [authenticated] }, async (request) => {
    const query = listPatternsQuerySchema.parse(request.query);
    const service = new LearningService(app.db);
    const result = await service.listPatterns({
      patternType: query.patternType,
      industry: query.industry,
      framework: query.framework,
      limit: query.limit,
      offset: query.offset,
    });
    return {
      patterns: result.patterns,
      pagination: { limit: query.limit, offset: query.offset, total: result.total },
    };
  });

  // GET /api/learning/stats — aggregate stats
  app.get("/api/learning/stats", { preHandler: [authenticated] }, async () => {
    const service = new LearningService(app.db);
    const stats = await service.getStats();
    return { stats };
  });

  // GET /api/learning/insights/:industry — industry insight
  app.get<{ Params: { industry: string } }>("/api/learning/insights/:industry", {
    preHandler: [authenticated],
  }, async (request) => {
    const params = industryInsightParamsSchema.parse(request.params);
    const service = new LearningService(app.db);
    const insight = await service.getIndustryInsight(params.industry);
    return { insight };
  });

  // GET /api/learning/predictions/:industry — predicted gaps
  app.get<{ Params: { industry: string } }>("/api/learning/predictions/:industry", {
    preHandler: [authenticated],
  }, async (request) => {
    const params = industryInsightParamsSchema.parse(request.params);
    const query = request.query as { framework?: string };
    const service = new LearningService(app.db);
    const predictions = await service.getPredictedGaps(params.industry, query.framework);
    return { predictions };
  });

  // POST /api/learning/analyze — trigger learning cycle for current tenant
  app.post("/api/learning/analyze", { preHandler: [adminOrEngineer] }, async (request) => {
    const service = new LearningService(app.db);
    await service.runLearningCycle(request.tenantId);
    return { message: "Learning cycle completed" };
  });

  // POST /api/findings/:id/false-positive — mark a finding as false positive
  app.post<{ Params: { id: string } }>("/api/findings/:id/false-positive", {
    preHandler: [adminOrEngineer],
  }, async (request) => {
    const service = new LearningService(app.db);
    await service.markFalsePositive(request.params.id);
    return { message: "Finding marked as false positive" };
  });

  // GET /api/admin/learning — alias for spec compliance (GAP-018)
  app.get("/api/admin/learning", { preHandler: [adminOrEngineer] }, async () => {
    const service = new LearningService(app.db);
    const stats = await service.getStats();
    return { stats };
  });

  // GET /api/admin/agents — agent swarm status (GAP-018)
  app.get("/api/admin/agents", { preHandler: [adminOrEngineer] }, async () => {
    const { getAllAgents } = await import("../agents/registry.js");
    const agents = getAllAgents();
    return {
      agents: agents.map((a) => ({
        type: a.type,
        displayName: a.displayName,
        supportedIntegrations: a.supportedIntegrations,
        status: "available",
      })),
      total: agents.length,
    };
  });
};
