import type { FastifyPluginAsync } from "fastify";
import { ThreatIntelService } from "../services/threat-intel-service.js";
import { CertInSlaService } from "../services/certin-sla-service.js";

// Module-level singleton so incident state persists across requests.
// Replace with a DB-backed service in production.
const certInSlaService = new CertInSlaService();

export const threatIntelRoutes: FastifyPluginAsync = async (app) => {
  const adminOrEngineer = (app as any).requireRole("owner", "admin", "engineer");
  const adminOnly = (app as any).requireRole("owner", "admin");
  const planGuard = app.requirePlan("Defend");

  // GET /api/threat-intel/cves — Recent CVEs with optional filters
  app.get<{ Querystring: { days?: string; severity?: string; keyword?: string } }>("/api/threat-intel/cves", {
    preHandler: [adminOrEngineer, planGuard],
  }, async (request) => {
    const service = new ThreatIntelService(app.db);
    const days = Math.min(Math.max(Number(request.query.days) || 7, 1), 90);
    const cves = await service.getRecentCves({
      days,
      severity: request.query.severity,
      keyword: request.query.keyword,
    });
    return { cves, count: cves.length, period: `${days} days` };
  });

  // GET /api/threat-intel/kev — CISA Known Exploited Vulnerabilities
  app.get<{ Querystring: { search?: string } }>("/api/threat-intel/kev", {
    preHandler: [adminOrEngineer, planGuard],
  }, async (request) => {
    const service = new ThreatIntelService(app.db);
    const entries = await service.getKevCatalog(request.query.search);
    return { vulnerabilities: entries, count: entries.length };
  });

  // GET /api/threat-intel/correlations — CVE-to-finding correlations
  app.get("/api/threat-intel/correlations", {
    preHandler: [adminOrEngineer, planGuard],
  }, async (request) => {
    const service = new ThreatIntelService(app.db);
    const correlations = await service.correlateWithFindings(request.tenantId);
    return {
      correlations,
      count: correlations.length,
      kevMatches: correlations.filter((c) => c.isKev).length,
    };
  });

  // GET /api/threat-intel/dashboard — Threat landscape overview
  app.get("/api/threat-intel/dashboard", {
    preHandler: [adminOrEngineer, planGuard],
  }, async (request) => {
    const service = new ThreatIntelService(app.db);
    return service.getDashboard(request.tenantId);
  });

  // GET /api/threat-intel/advisories — CERT-In advisories
  app.get("/api/threat-intel/advisories", {
    preHandler: [adminOrEngineer, planGuard],
  }, async () => {
    const service = new ThreatIntelService(app.db);
    const advisories = await service.getCertInAdvisories();
    return { advisories, count: advisories.length };
  });

  // GET /api/threat-intel/vulnerability/:cveId — Single CVE detail
  app.get<{ Params: { cveId: string } }>("/api/threat-intel/vulnerability/:cveId", {
    preHandler: [adminOrEngineer, planGuard],
  }, async (request, reply) => {
    const service = new ThreatIntelService(app.db);
    const cve = await service.getCveById(request.params.cveId);
    if (!cve) {
      return reply.status(404).send({ error: { code: "NOT_FOUND", message: "CVE not found" } });
    }
    return cve;
  });

  // POST /api/threat-intel/refresh — Force refresh all feeds (admin only)
  app.post("/api/threat-intel/refresh", {
    preHandler: [adminOnly, planGuard],
  }, async () => {
    const service = new ThreatIntelService(app.db);
    return service.forceRefresh();
  });

  // GET /api/threat-intel/certin-sla — List all tracked incidents with SLA status
  app.get("/api/threat-intel/certin-sla", {
    preHandler: [adminOrEngineer, planGuard],
  }, async (request) => {
    const incidents = certInSlaService.getAllIncidents(request.tenantId);
    return {
      incidents,
      count: incidents.length,
      openCount: incidents.filter((i) => i.status === "open" || i.status === "acknowledged").length,
      overdueCount: incidents.filter((i) => i.status === "overdue").length,
    };
  });

  // GET /api/threat-intel/certin-sla/overdue — Get overdue incidents
  app.get("/api/threat-intel/certin-sla/overdue", {
    preHandler: [adminOrEngineer, planGuard],
  }, async (request) => {
    const incidents = certInSlaService.getOverdueIncidents(request.tenantId);
    return { incidents, count: incidents.length };
  });

  // POST /api/threat-intel/certin-sla/:id/report — Mark incident as reported
  app.post<{
    Params: { id: string };
    Body: { certinReferenceId: string };
  }>("/api/threat-intel/certin-sla/:id/report", {
    preHandler: [adminOrEngineer, planGuard],
  }, async (request, reply) => {
    const { id } = request.params;
    const { certinReferenceId } = request.body ?? {};

    if (!certinReferenceId) {
      return reply.status(400).send({
        error: { code: "VALIDATION_ERROR", message: "certinReferenceId is required" },
      });
    }

    const updated = certInSlaService.markReported(id, certinReferenceId);
    if (!updated) {
      return reply.status(404).send({
        error: { code: "NOT_FOUND", message: "CERT-In incident not found" },
      });
    }

    return { incident: updated };
  });
};
