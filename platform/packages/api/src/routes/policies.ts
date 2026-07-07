import type { FastifyPluginAsync } from "fastify";
import { PolicyDesignerService } from "../services/policy-designer-service.js";
import { requireUUID } from "../utils/security-fixes.js";
import { badRequest } from "../utils/errors.js";

const SUPPORTED_FRAMEWORKS = ["soc2", "iso27001", "hipaa", "gdpr", "pcidss", "dpdpa"] as const;
const SUPPORTED_INDUSTRIES = ["finance", "healthcare", "saas", "retail", "manufacturing", "government"] as const;

export const policyRoutes: FastifyPluginAsync = async (app) => {
  const authenticated = (app as any).requireRole("owner", "admin", "engineer", "viewer");
  const adminOrEngineer = (app as any).requireRole("owner", "admin", "engineer");

  // GET /api/policies/templates
  // List all policy templates with optional filters: ?framework=soc2&category=access_control&industry=finance
  app.get("/api/policies/templates", { preHandler: [authenticated] }, async (request) => {
    const query = request.query as Record<string, string>;
    const service = new PolicyDesignerService(app.db);

    const templates = service.listTemplates({
      framework: query.framework,
      category: query.category,
      industry: query.industry,
    });

    return {
      templates: templates.map((t) => ({
        id: t.id,
        framework: t.framework,
        category: t.category,
        title: t.title,
        description: t.description,
        applicableIndustries: t.applicableIndustries,
        requiredForTier: t.requiredForTier,
        sectionCount: t.sections.length,
      })),
      total: templates.length,
    };
  });

  // GET /api/policies/templates/:id
  // Get full template detail including all sections and content
  app.get<{ Params: { id: string } }>(
    "/api/policies/templates/:id",
    { preHandler: [authenticated] },
    async (request) => {
      const service = new PolicyDesignerService(app.db);
      const template = service.getTemplate(request.params.id);
      return { template };
    },
  );

  // POST /api/policies/generate
  // Generate a customized policy document from a template
  app.post("/api/policies/generate", { preHandler: [adminOrEngineer] }, async (request, reply) => {
    const body = request.body as {
      templateId?: unknown;
      customization?: {
        companyName?: unknown;
        industry?: unknown;
        effectiveDate?: unknown;
        reviewFrequency?: unknown;
        dataTypes?: unknown;
        jurisdictions?: unknown;
        policyOwner?: unknown;
        approvedBy?: unknown;
      };
    };

    if (!body?.templateId || typeof body.templateId !== "string") {
      throw badRequest("MISSING_FIELD", "templateId is required");
    }
    if (!body?.customization) {
      throw badRequest("MISSING_FIELD", "customization object is required");
    }

    const c = body.customization;
    if (!c.companyName || typeof c.companyName !== "string") {
      throw badRequest("MISSING_FIELD", "customization.companyName is required");
    }
    if (!c.effectiveDate || typeof c.effectiveDate !== "string") {
      throw badRequest("MISSING_FIELD", "customization.effectiveDate is required");
    }
    if (!c.reviewFrequency || typeof c.reviewFrequency !== "string") {
      throw badRequest("MISSING_FIELD", "customization.reviewFrequency is required");
    }

    const customization = {
      companyName: c.companyName as string,
      industry: (c.industry as string) ?? "general",
      effectiveDate: c.effectiveDate as string,
      reviewFrequency: c.reviewFrequency as string,
      dataTypes: Array.isArray(c.dataTypes) ? (c.dataTypes as string[]) : undefined,
      jurisdictions: Array.isArray(c.jurisdictions) ? (c.jurisdictions as string[]) : undefined,
      policyOwner: typeof c.policyOwner === "string" ? c.policyOwner : undefined,
      approvedBy: typeof c.approvedBy === "string" ? c.approvedBy : undefined,
    };

    const service = new PolicyDesignerService(app.db);
    const content = service.generatePolicy(body.templateId, customization);
    const saved = await service.saveGeneratedPolicy(
      request.tenantId,
      body.templateId,
      customization,
      content,
    );

    return reply.status(201).send({ policy: saved });
  });

  // GET /api/policies/gaps
  // Analyze policy gaps for the tenant — ?frameworks=soc2,iso27001
  app.get("/api/policies/gaps", { preHandler: [authenticated] }, async (request) => {
    const query = request.query as Record<string, string>;
    const rawFrameworks = query.frameworks ?? "";
    const frameworks = rawFrameworks
      .split(",")
      .map((f) => f.trim().toLowerCase())
      .filter(Boolean);

    if (frameworks.length === 0) {
      throw badRequest("MISSING_PARAM", "frameworks query parameter is required (comma-separated)");
    }

    const invalid = frameworks.filter((f) => !SUPPORTED_FRAMEWORKS.includes(f as any));
    if (invalid.length > 0) {
      throw badRequest("INVALID_FRAMEWORK", `Unknown frameworks: ${invalid.join(", ")}. Supported: ${SUPPORTED_FRAMEWORKS.join(", ")}`);
    }

    const service = new PolicyDesignerService(app.db);
    const result = await service.analyzeGaps(request.tenantId, frameworks);

    return {
      frameworks,
      required: result.required.map((t) => ({
        id: t.id,
        title: t.title,
        category: t.category,
        framework: t.framework,
        requiredForTier: t.requiredForTier,
      })),
      existingTemplateIds: result.existing,
      gaps: result.gaps.map((t) => ({
        id: t.id,
        title: t.title,
        category: t.category,
        framework: t.framework,
        requiredForTier: t.requiredForTier,
      })),
      coverage: result.coverage,
      gapCount: result.gaps.length,
    };
  });

  // GET /api/policies/compliance/:framework
  // Check policy compliance coverage for a specific framework
  app.get<{ Params: { framework: string } }>(
    "/api/policies/compliance/:framework",
    { preHandler: [authenticated] },
    async (request) => {
      const framework = request.params.framework.toLowerCase();
      if (!SUPPORTED_FRAMEWORKS.includes(framework as any)) {
        throw badRequest("INVALID_FRAMEWORK", `Unknown framework '${framework}'. Supported: ${SUPPORTED_FRAMEWORKS.join(", ")}`);
      }

      const service = new PolicyDesignerService(app.db);
      const result = await service.checkCompliance(request.tenantId, framework);
      return { compliance: result };
    },
  );

  // GET /api/policies/presets/:industry
  // Get industry-specific policy preset bundle
  app.get<{ Params: { industry: string } }>(
    "/api/policies/presets/:industry",
    { preHandler: [authenticated] },
    async (request) => {
      const industry = request.params.industry.toLowerCase();
      if (!SUPPORTED_INDUSTRIES.includes(industry as any)) {
        throw badRequest("INVALID_INDUSTRY", `Unknown industry '${industry}'. Supported: ${SUPPORTED_INDUSTRIES.join(", ")}`);
      }

      const service = new PolicyDesignerService(app.db);
      const templates = service.getIndustryPreset(industry);

      return {
        industry,
        templates: templates.map((t) => ({
          id: t.id,
          title: t.title,
          category: t.category,
          framework: t.framework,
          description: t.description,
          requiredForTier: t.requiredForTier,
        })),
        count: templates.length,
      };
    },
  );

  // POST /api/policies/bulk-generate
  // Generate all missing policies for specified frameworks
  app.post("/api/policies/bulk-generate", { preHandler: [adminOrEngineer] }, async (request, reply) => {
    const body = request.body as {
      frameworks?: unknown;
      customization?: {
        companyName?: unknown;
        industry?: unknown;
        effectiveDate?: unknown;
        reviewFrequency?: unknown;
        dataTypes?: unknown;
        jurisdictions?: unknown;
        policyOwner?: unknown;
        approvedBy?: unknown;
      };
    };

    if (!Array.isArray(body?.frameworks) || body.frameworks.length === 0) {
      throw badRequest("MISSING_FIELD", "frameworks array is required");
    }
    if (!body?.customization?.companyName) {
      throw badRequest("MISSING_FIELD", "customization.companyName is required");
    }
    if (!body?.customization?.effectiveDate) {
      throw badRequest("MISSING_FIELD", "customization.effectiveDate is required");
    }
    if (!body?.customization?.reviewFrequency) {
      throw badRequest("MISSING_FIELD", "customization.reviewFrequency is required");
    }

    const frameworks = (body.frameworks as unknown[])
      .map((f) => String(f).toLowerCase())
      .filter((f) => SUPPORTED_FRAMEWORKS.includes(f as any));

    const customization = {
      companyName: String(body.customization.companyName),
      industry: String(body.customization.industry ?? "general"),
      effectiveDate: String(body.customization.effectiveDate),
      reviewFrequency: String(body.customization.reviewFrequency),
      dataTypes: Array.isArray(body.customization.dataTypes)
        ? (body.customization.dataTypes as string[])
        : undefined,
      jurisdictions: Array.isArray(body.customization.jurisdictions)
        ? (body.customization.jurisdictions as string[])
        : undefined,
      policyOwner: typeof body.customization.policyOwner === "string"
        ? body.customization.policyOwner
        : undefined,
      approvedBy: typeof body.customization.approvedBy === "string"
        ? body.customization.approvedBy
        : undefined,
    };

    const service = new PolicyDesignerService(app.db);
    const gapResult = await service.analyzeGaps(request.tenantId, frameworks);

    const generated = [];
    for (const template of gapResult.gaps) {
      const content = service.generatePolicy(template.id, customization);
      const saved = await service.saveGeneratedPolicy(
        request.tenantId,
        template.id,
        customization,
        content,
      );
      generated.push({ id: saved.id, templateId: template.id, title: template.title });
    }

    return reply.status(201).send({
      generated,
      count: generated.length,
      frameworks,
      coverageAfter: generated.length === 0 ? gapResult.coverage : 100,
    });
  });

  // GET /api/policies
  // List all generated policies for the tenant
  app.get("/api/policies", { preHandler: [authenticated] }, async (request) => {
    const service = new PolicyDesignerService(app.db);
    const policies = await service.listGeneratedPolicies(request.tenantId);
    return { policies, total: policies.length };
  });

  // GET /api/policies/:id
  // Get a specific generated policy (full content)
  app.get<{ Params: { id: string } }>(
    "/api/policies/:id",
    { preHandler: [authenticated] },
    async (request) => {
      requireUUID(request.params.id);
      const service = new PolicyDesignerService(app.db);
      const policy = await service.getGeneratedPolicy(request.tenantId, request.params.id);
      return { policy };
    },
  );

  // DELETE /api/policies/:id
  // Delete a generated policy
  app.delete<{ Params: { id: string } }>(
    "/api/policies/:id",
    { preHandler: [adminOrEngineer] },
    async (request, reply) => {
      requireUUID(request.params.id);
      const service = new PolicyDesignerService(app.db);
      await service.deleteGeneratedPolicy(request.tenantId, request.params.id);
      return reply.status(204).send();
    },
  );
};
