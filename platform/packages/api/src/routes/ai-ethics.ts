import type { FastifyPluginAsync } from "fastify";
import { AiEthicsService } from "../services/ai-ethics-service.js";

export const aiEthicsRoutes: FastifyPluginAsync = async (app) => {
  const adminOrEngineer = (app as any).requireRole("owner", "admin", "engineer");
  const planGuard = app.requirePlan("Protect");

  // POST /api/ai-ethics/bias-assessment — Assess bias across 5 fairness dimensions
  app.post<{ Body: { modelId?: string; datasetMetrics?: any } }>("/api/ai-ethics/bias-assessment", {
    preHandler: [adminOrEngineer, planGuard],
  }, async (request) => {
    const { modelId, datasetMetrics } = (request.body ?? {}) as { modelId?: string; datasetMetrics?: any };
    const service = new AiEthicsService(app.db);
    return service.assessBias(request.tenantId, { modelId, datasetMetrics });
  });

  // POST /api/ai-ethics/fairness-score — Calculate fairness score from findings
  app.post<{ Body: { findings?: any[] } }>("/api/ai-ethics/fairness-score", {
    preHandler: [adminOrEngineer, planGuard],
  }, async (request) => {
    const { findings } = (request.body ?? {}) as { findings?: any[] };
    const service = new AiEthicsService(app.db);
    return service.calculateFairnessScore(request.tenantId, findings ?? []);
  });

  // GET /api/ai-ethics/transparency-report — Transparency report for AI decisions
  app.get<{ Querystring: { period?: string } }>("/api/ai-ethics/transparency-report", {
    preHandler: [adminOrEngineer, planGuard],
  }, async (request) => {
    const service = new AiEthicsService(app.db);
    return service.generateTransparencyReport(request.tenantId, { period: request.query.period });
  });

  // GET /api/ai-ethics/explain/:decisionId — Explain a specific AI decision
  app.get<{ Params: { decisionId: string } }>("/api/ai-ethics/explain/:decisionId", {
    preHandler: [adminOrEngineer, planGuard],
  }, async (request) => {
    const { decisionId } = request.params;
    const service = new AiEthicsService(app.db);
    return service.explainDecision(request.tenantId, decisionId);
  });

  // POST /api/ai-ethics/data-provenance — Track data provenance and lineage
  app.post<{ Body: { sourceId: string; metadata: any } }>("/api/ai-ethics/data-provenance", {
    preHandler: [adminOrEngineer, planGuard],
  }, async (request, reply) => {
    const { sourceId, metadata } = (request.body ?? {}) as { sourceId?: string; metadata?: any };
    if (!sourceId) {
      return reply.status(400).send({ error: { code: "VALIDATION_ERROR", message: "sourceId is required" } });
    }
    const service = new AiEthicsService(app.db);
    return service.trackDataProvenance(request.tenantId, { sourceId, metadata: metadata ?? {} });
  });

  // POST /api/ai-ethics/ethics-review — Comprehensive AI ethics review
  app.post<{ Body: { aiSystemId?: string } }>("/api/ai-ethics/ethics-review", {
    preHandler: [adminOrEngineer, planGuard],
  }, async (request) => {
    const { aiSystemId } = (request.body ?? {}) as { aiSystemId?: string };
    const service = new AiEthicsService(app.db);
    return service.conductEthicsReview(request.tenantId, aiSystemId);
  });

  // GET /api/ai-ethics/human-oversight — Human oversight compliance check
  app.get("/api/ai-ethics/human-oversight", {
    preHandler: [adminOrEngineer, planGuard],
  }, async (request) => {
    const service = new AiEthicsService(app.db);
    return service.checkHumanOversight(request.tenantId);
  });

  // GET /api/ai-ethics/dashboard — Ethics dashboard with aggregated metrics
  app.get("/api/ai-ethics/dashboard", {
    preHandler: [adminOrEngineer, planGuard],
  }, async (request) => {
    const service = new AiEthicsService(app.db);
    return service.getEthicsDashboard(request.tenantId);
  });

  // GET /api/ai-ethics/decisions — List AI decision log entries
  app.get<{ Querystring: { limit?: string; offset?: string } }>("/api/ai-ethics/decisions", {
    preHandler: [adminOrEngineer, planGuard],
  }, async (request) => {
    const limit = request.query.limit ? parseInt(request.query.limit, 10) : 50;
    const offset = request.query.offset ? parseInt(request.query.offset, 10) : 0;
    const service = new AiEthicsService(app.db);
    return service.getDecisionLog(request.tenantId, { limit, offset });
  });
};
