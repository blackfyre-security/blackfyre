import { describe, it, expect } from "vitest";

// === AGENT-74: DATABASE SCHEMA INTEGRITY ===
describe("Ghost DIV4: Database Schema Integrity", () => {
  it("exports all 14 tables", async () => {
    const schema = await import("../../src/db/schema.js");
    const tables = [
      "tenants", "users", "apiKeys", "integrations", "scans", "findings",
      "controlMappings", "evidence", "remediations", "alertRules", "reports",
      "complianceScores", "learningPatterns", "driftEvents",
    ];
    for (const t of tables) {
      expect(schema[t]).toBeDefined();
    }
  });

  it("exports all enums", async () => {
    const schema = await import("../../src/db/schema.js");
    const enums = [
      "tenantPlanEnum", "industryProfileEnum", "onboardingStatusEnum", "userRoleEnum",
      "integrationTypeEnum", "integrationStatusEnum", "scanStatusEnum", "severityEnum",
      "findingStatusEnum", "findingCategoryEnum", "remediationTierEnum", "frameworkEnum",
      "controlStatusEnum", "evidenceTypeEnum", "remediationStatusEnum", "alertTriggerTypeEnum",
      "reportTypeEnum", "reportStatusEnum", "driftChangeTypeEnum",
    ];
    for (const e of enums) {
      expect(schema[e]).toBeDefined();
    }
  });

  it("tenants table has required columns", async () => {
    const { tenants } = await import("../../src/db/schema.js");
    expect(tenants.id).toBeDefined();
    expect(tenants.name).toBeDefined();
    expect(tenants.slug).toBeDefined();
    expect(tenants.plan).toBeDefined();
  });

  it("findings table references scans and tenants", async () => {
    const { findings } = await import("../../src/db/schema.js");
    expect(findings.scanId).toBeDefined();
    expect(findings.tenantId).toBeDefined();
  });

  it("controlMappings references findings", async () => {
    const { controlMappings } = await import("../../src/db/schema.js");
    expect(controlMappings.findingId).toBeDefined();
    expect(controlMappings.framework).toBeDefined();
  });
});

// === AGENT-76: API ENDPOINT CONSISTENCY ===
describe("Ghost DIV4: Route Module Exports", () => {
  it("alerts route exports a function", async () => {
    const mod = await import("../../src/routes/alerts.js");
    expect(typeof mod.alertRoutes).toBe("function");
  });
  it("auth route exports a function", async () => {
    const mod = await import("../../src/routes/auth.js");
    expect(typeof mod.authRoutes).toBe("function");
  });
  it("clients route exports a function", async () => {
    const mod = await import("../../src/routes/clients.js");
    expect(typeof mod.clientRoutes).toBe("function");
  });
  it("compliance route exports a function", async () => {
    const mod = await import("../../src/routes/compliance.js");
    expect(typeof mod.complianceRoutes).toBe("function");
  });
  it("drift route exports a function", async () => {
    const mod = await import("../../src/routes/drift.js");
    expect(typeof mod.driftRoutes).toBe("function");
  });
  it("evidence route exports a function", async () => {
    const mod = await import("../../src/routes/evidence.js");
    expect(typeof mod.evidenceRoutes).toBe("function");
  });
  it("findings route exports a function", async () => {
    const mod = await import("../../src/routes/findings.js");
    expect(typeof mod.findingRoutes).toBe("function");
  });
  it("health route exports a function", async () => {
    const mod = await import("../../src/routes/health.js");
    expect(typeof mod.healthRoutes).toBe("function");
  });
  it("integrations route exports a function", async () => {
    const mod = await import("../../src/routes/integrations.js");
    expect(typeof mod.integrationRoutes).toBe("function");
  });
  it("learning route exports a function", async () => {
    const mod = await import("../../src/routes/learning.js");
    expect(typeof mod.learningRoutes).toBe("function");
  });
  it("remediations route exports a function", async () => {
    const mod = await import("../../src/routes/remediations.js");
    expect(typeof mod.remediationRoutes).toBe("function");
  });
  it("reports route exports a function", async () => {
    const mod = await import("../../src/routes/reports.js");
    expect(typeof mod.reportRoutes).toBe("function");
  });
  it("scans route exports a function", async () => {
    const mod = await import("../../src/routes/scans.js");
    expect(typeof mod.scanRoutes).toBe("function");
  });
});

// === SERVICE METHOD COMPLETENESS ===
describe("Ghost DIV4: Service Method Completeness", () => {
  it("ComplianceService has all required methods", async () => {
    const { ComplianceService } = await import("../../src/services/compliance-service.js");
    const service = new ComplianceService(null as any);
    expect(typeof service.getScores).toBe("function");
    expect(typeof service.getMatrix).toBe("function");
    expect(typeof service.getTrend).toBe("function");
    expect(typeof service.snapshotScores).toBe("function");
    expect(typeof service.getFrameworkDiff).toBe("function");
    expect(typeof service.getIndustryRecommendations).toBe("function");
    expect(typeof service.getAvailableFrameworks).toBe("function");
    expect(typeof service.getAllProfiles).toBe("function");
  });

  it("EvidenceService has all required methods", async () => {
    const { EvidenceService } = await import("../../src/services/evidence-service.js");
    const service = new EvidenceService(null as any);
    expect(typeof service.create).toBe("function");
    expect(typeof service.listForFinding).toBe("function");
    expect(typeof service.getById).toBe("function");
  });

  it("RemediationService has all required methods", async () => {
    const { RemediationService } = await import("../../src/services/remediation-service.js");
    const service = new RemediationService(null as any);
    expect(typeof service.create).toBe("function");
    expect(typeof service.approve).toBe("function");
    expect(typeof service.execute).toBe("function");
    expect(typeof service.complete).toBe("function");
    expect(typeof service.fail).toBe("function");
    expect(typeof service.rollback).toBe("function");
    expect(typeof service.getById).toBe("function");
    expect(typeof service.listForFinding).toBe("function");
  });

  it("AlertService has all required methods", async () => {
    const { AlertService } = await import("../../src/services/alert-service.js");
    const service = new AlertService(null as any);
    expect(typeof service.create).toBe("function");
    expect(typeof service.update).toBe("function");
    expect(typeof service.delete).toBe("function");
    expect(typeof service.getById).toBe("function");
    expect(typeof service.list).toBe("function");
    expect(typeof service.toggle).toBe("function");
    expect(typeof service.testRule).toBe("function");
  });

  it("DriftService has all required methods", async () => {
    const { DriftService } = await import("../../src/services/drift-service.js");
    const service = new DriftService(null as any);
    expect(typeof service.create).toBe("function");
    expect(typeof service.list).toBe("function");
    expect(typeof service.getById).toBe("function");
    expect(typeof service.acknowledge).toBe("function");
    expect(typeof service.getStats).toBe("function");
    expect(typeof service.getRecentForIntegration).toBe("function");
  });

  it("LearningService has all required methods", async () => {
    const { LearningService } = await import("../../src/services/learning-service.js");
    const service = new LearningService(null as any);
    expect(typeof service.analyzeFindings).toBe("function");
    expect(typeof service.analyzeRemediations).toBe("function");
    expect(typeof service.markFalsePositive).toBe("function");
    expect(typeof service.getIndustryInsight).toBe("function");
    expect(typeof service.getPredictedGaps).toBe("function");
    expect(typeof service.getStats).toBe("function");
    expect(typeof service.listPatterns).toBe("function");
    expect(typeof service.runLearningCycle).toBe("function");
  });

  it("ReportGeneratorService has all required methods", async () => {
    const { ReportGeneratorService } = await import("../../src/services/report-generator.js");
    const service = new ReportGeneratorService(null as any);
    expect(typeof service.generateReadiness).toBe("function");
    expect(typeof service.generateGapAnalysis).toBe("function");
    expect(typeof service.generateBoardSummary).toBe("function");
    expect(typeof service.generateEvidencePackage).toBe("function");
  });

  it("NotificationDispatcher is stateless (no db constructor)", async () => {
    const mod = await import("../../src/services/notification-dispatcher.js");
    expect(mod.NotificationDispatcher).toBeDefined();
    const dispatcher = new mod.NotificationDispatcher();
    expect(typeof dispatcher.dispatch).toBe("function");
    expect(typeof dispatcher.isInQuietHours).toBe("function");
  });
});

// === SCHEMA BOUNDARY EDGE CASES ===
describe("Ghost DIV4: Schema Boundary Edge Cases", () => {
  it("scan schema rejects empty frameworks array", async () => {
    const { createScanSchema } = await import("@blackfyre/shared");
    const result = createScanSchema.safeParse({ frameworks: [], targets: ["aws"] });
    expect(result.success).toBe(false);
  });

  it("scan schema rejects empty targets array", async () => {
    const { createScanSchema } = await import("@blackfyre/shared");
    const result = createScanSchema.safeParse({ frameworks: ["soc2"], targets: [] });
    expect(result.success).toBe(false);
  });

  it("alert rule schema rejects empty channels array", async () => {
    const { createAlertRuleSchema } = await import("@blackfyre/shared");
    const result = createAlertRuleSchema.safeParse({
      triggerType: "severity",
      triggerConfig: {},
      channels: [],
    });
    expect(result.success).toBe(false);
  });

  it("compliance trend schema enforces limit min=1", async () => {
    const { complianceTrendQuerySchema } = await import("@blackfyre/shared");
    const result = complianceTrendQuerySchema.safeParse({ framework: "soc2", limit: 0 });
    expect(result.success).toBe(false);
  });

  it("compliance trend schema enforces limit max=100", async () => {
    const { complianceTrendQuerySchema } = await import("@blackfyre/shared");
    const result = complianceTrendQuerySchema.safeParse({ framework: "soc2", limit: 101 });
    expect(result.success).toBe(false);
  });

  it("compliance matrix rejects invalid framework", async () => {
    const { complianceMatrixParamsSchema } = await import("@blackfyre/shared");
    const result = complianceMatrixParamsSchema.safeParse({ framework: "invalid" });
    expect(result.success).toBe(false);
  });

  it("compliance diff requires all fields", async () => {
    const { complianceDiffQuerySchema } = await import("@blackfyre/shared");
    const result = complianceDiffQuerySchema.safeParse({ framework: "soc2" });
    expect(result.success).toBe(false);
  });
});

// === APP.TS ROUTE REGISTRATION ===
describe("Ghost DIV4: App Route Registration", () => {
  it("app.ts imports and registers all route modules", async () => {
    const { readFileSync } = await import("fs");
    const { resolve } = await import("path");
    const appContent = readFileSync(resolve(__dirname, "../../src/app.ts"), "utf-8");

    const expectedRoutes = [
      "healthRoutes", "authRoutes", "clientRoutes", "integrationRoutes",
      "scanRoutes", "findingRoutes", "reportRoutes", "complianceRoutes",
      "evidenceRoutes", "remediationRoutes", "alertRoutes", "driftRoutes",
      "learningRoutes",
    ];

    for (const route of expectedRoutes) {
      expect(appContent).toContain(route);
    }
  });

  it("app.ts registers rate-limit and security-headers plugins", async () => {
    const { readFileSync } = await import("fs");
    const { resolve } = await import("path");
    const appContent = readFileSync(resolve(__dirname, "../../src/app.ts"), "utf-8");
    expect(appContent).toContain("rateLimitPlugin");
    expect(appContent).toContain("securityHeadersPlugin");
    expect(appContent).toContain("requestLoggerPlugin");
  });
});
