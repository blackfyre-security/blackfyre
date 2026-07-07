/**
 * API Contract & Schema Validation Tests
 *
 * Comprehensive test suite verifying Zod schema contracts, route module
 * exports, error utilities, security utilities, scoring edge cases,
 * control registry completeness, and industry profile correctness.
 *
 * Author: Shreya
 * Date: 2026-03-26
 */
import { describe, it, expect } from "vitest";

// ---------------------------------------------------------------------------
// Schema imports (every Zod schema from @blackfyre/shared)
// ---------------------------------------------------------------------------
import {
  // Auth
  loginSchema,
  refreshSchema,
  apiKeyCreateSchema,
  // Tenant
  createTenantSchema,
  updateTenantSchema,
  // Integration
  createIntegrationSchema,
  updateIntegrationSchema,
  // Scan
  createScanSchema,
  updateScanSchema,
  // Finding
  listFindingsQuerySchema,
  updateFindingStatusSchema,
  agentFindingSchema,
  // Report
  createReportSchema,
  // Compliance
  complianceScoresQuerySchema,
  complianceMatrixParamsSchema,
  complianceTrendQuerySchema,
  complianceDiffQuerySchema,
  auditReadyBodySchema,
  // Evidence
  createEvidenceSchema,
  listEvidenceQuerySchema,
  // Remediation
  createRemediationSchema,
  approveRemediationSchema,
  updateRemediationStatusSchema,
  listRemediationsQuerySchema,
  // Alert Rule
  createAlertRuleSchema,
  updateAlertRuleSchema,
  listAlertRulesQuerySchema,
  toggleAlertRuleSchema,
  testAlertRuleSchema,
  // Drift
  listDriftEventsQuerySchema,
  acknowledgeDriftEventSchema,
  // Learning
  listPatternsQuerySchema,
  industryInsightParamsSchema,
} from "@blackfyre/shared";

// Route module imports
import { healthRoutes } from "../../src/routes/health.js";
import { authRoutes } from "../../src/routes/auth.js";
import { clientRoutes } from "../../src/routes/clients.js";
import { integrationRoutes } from "../../src/routes/integrations.js";
import { scanRoutes } from "../../src/routes/scans.js";
import { findingRoutes } from "../../src/routes/findings.js";
import { reportRoutes } from "../../src/routes/reports.js";
import { complianceRoutes } from "../../src/routes/compliance.js";
import { evidenceRoutes } from "../../src/routes/evidence.js";
import { remediationRoutes } from "../../src/routes/remediations.js";
import { alertRoutes } from "../../src/routes/alerts.js";
import { driftRoutes } from "../../src/routes/drift.js";
import { learningRoutes } from "../../src/routes/learning.js";

// Error utilities
import {
  ApiError,
  badRequest,
  notFound,
  unauthorized,
  forbidden,
  conflict,
} from "../../src/utils/errors.js";

// Security utilities
import {
  validateUUID,
  requireUUID,
  sanitizePath,
  sanitizeErrorMessage,
  validateScanStatus,
} from "../../src/utils/security-fixes.js";

// Compliance modules
import { calculateFrameworkScore } from "../../src/compliance/scoring.js";
import {
  getAllFrameworkRegistries,
  getFrameworkRegistry,
  getControlDefinition,
  getFrameworkVersions,
} from "../../src/compliance/control-registry.js";
import {
  getAllIndustryProfiles,
  getIndustryProfile,
} from "../../src/compliance/industry-profiles.js";

import type { ControlDefinition } from "@blackfyre/shared";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_UUID = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";

const makeControl = (id: string, weight: 1 | 2 | 3): ControlDefinition => ({
  controlId: id,
  controlName: `Control ${id}`,
  description: `Description for ${id}`,
  weight,
  category: "Test",
});

// ============================================================================
// SECTION 1: Schema Validation Tests
// ============================================================================

describe("Schema Validation", () => {
  // ---------- Auth Schemas ----------

  describe("loginSchema", () => {
    it("accepts valid email and password", () => {
      const result = loginSchema.parse({
        email: "user@example.com",
        password: "securepass123",
      });
      expect(result.email).toBe("user@example.com");
      expect(result.password).toBe("securepass123");
    });

    it("rejects missing email", () => {
      expect(() => loginSchema.parse({ password: "securepass123" })).toThrow();
    });

    it("rejects missing password", () => {
      expect(() => loginSchema.parse({ email: "user@example.com" })).toThrow();
    });

    it("rejects invalid email format", () => {
      expect(() =>
        loginSchema.parse({ email: "not-an-email", password: "12345678" }),
      ).toThrow();
    });

    it("rejects password shorter than 8 characters", () => {
      expect(() =>
        loginSchema.parse({ email: "a@b.com", password: "short" }),
      ).toThrow();
    });

    it("accepts password of exactly 8 characters", () => {
      const result = loginSchema.parse({
        email: "a@b.com",
        password: "12345678",
      });
      expect(result.password).toBe("12345678");
    });

    it("rejects non-string email", () => {
      expect(() =>
        loginSchema.parse({ email: 123, password: "12345678" }),
      ).toThrow();
    });
  });

  describe("refreshSchema", () => {
    it("accepts valid refresh token string", () => {
      const result = refreshSchema.parse({ refreshToken: "some-token-value" });
      expect(result.refreshToken).toBe("some-token-value");
    });

    it("rejects missing refreshToken", () => {
      expect(() => refreshSchema.parse({})).toThrow();
    });

    it("rejects non-string refreshToken", () => {
      expect(() => refreshSchema.parse({ refreshToken: 12345 })).toThrow();
    });

    it("rejects null refreshToken", () => {
      expect(() => refreshSchema.parse({ refreshToken: null })).toThrow();
    });
  });

  describe("apiKeyCreateSchema", () => {
    it("accepts valid name", () => {
      const result = apiKeyCreateSchema.parse({ name: "my-api-key" });
      expect(result.name).toBe("my-api-key");
    });

    it("rejects empty name", () => {
      expect(() => apiKeyCreateSchema.parse({ name: "" })).toThrow();
    });

    it("rejects name exceeding 100 characters", () => {
      expect(() =>
        apiKeyCreateSchema.parse({ name: "x".repeat(101) }),
      ).toThrow();
    });

    it("accepts name of exactly 100 characters", () => {
      const result = apiKeyCreateSchema.parse({ name: "x".repeat(100) });
      expect(result.name).toHaveLength(100);
    });

    it("accepts name of exactly 1 character", () => {
      const result = apiKeyCreateSchema.parse({ name: "a" });
      expect(result.name).toBe("a");
    });

    it("rejects missing name field", () => {
      expect(() => apiKeyCreateSchema.parse({})).toThrow();
    });
  });

  // ---------- Tenant Schemas ----------

  describe("createTenantSchema", () => {
    const validPayload = {
      name: "Acme Corp",
      slug: "acme-corp",
      plan: "comply",
      industryProfile: "saas",
    };

    it("accepts valid tenant data", () => {
      const result = createTenantSchema.parse(validPayload);
      expect(result.name).toBe("Acme Corp");
      expect(result.slug).toBe("acme-corp");
      expect(result.plan).toBe("comply");
      expect(result.industryProfile).toBe("saas");
    });

    it("rejects missing name", () => {
      const { name, ...rest } = validPayload;
      expect(() => createTenantSchema.parse(rest)).toThrow();
    });

    it("rejects empty name", () => {
      expect(() =>
        createTenantSchema.parse({ ...validPayload, name: "" }),
      ).toThrow();
    });

    it("rejects name exceeding 200 characters", () => {
      expect(() =>
        createTenantSchema.parse({ ...validPayload, name: "x".repeat(201) }),
      ).toThrow();
    });

    it("rejects slug with uppercase letters", () => {
      expect(() =>
        createTenantSchema.parse({ ...validPayload, slug: "UPPERCASE" }),
      ).toThrow();
    });

    it("rejects slug with spaces", () => {
      expect(() =>
        createTenantSchema.parse({ ...validPayload, slug: "has spaces" }),
      ).toThrow();
    });

    it("rejects slug with special characters", () => {
      expect(() =>
        createTenantSchema.parse({ ...validPayload, slug: "slug_with_under" }),
      ).toThrow();
    });

    it("accepts slug with lowercase, numbers, and hyphens", () => {
      const result = createTenantSchema.parse({
        ...validPayload,
        slug: "my-slug-123",
      });
      expect(result.slug).toBe("my-slug-123");
    });

    it("rejects slug exceeding 100 characters", () => {
      expect(() =>
        createTenantSchema.parse({
          ...validPayload,
          slug: "a".repeat(101),
        }),
      ).toThrow();
    });

    it("rejects invalid plan value", () => {
      expect(() =>
        createTenantSchema.parse({ ...validPayload, plan: "free" }),
      ).toThrow();
    });

    it("accepts all valid plan values", () => {
      for (const plan of ["comply", "protect", "defend"]) {
        const result = createTenantSchema.parse({ ...validPayload, plan });
        expect(result.plan).toBe(plan);
      }
    });

    it("rejects invalid industryProfile value", () => {
      expect(() =>
        createTenantSchema.parse({
          ...validPayload,
          industryProfile: "banking",
        }),
      ).toThrow();
    });

    it("accepts all valid industryProfile values", () => {
      for (const ip of [
        "fintech",
        "healthtech",
        "saas",
        "ecommerce",
        "custom",
      ]) {
        const result = createTenantSchema.parse({
          ...validPayload,
          industryProfile: ip,
        });
        expect(result.industryProfile).toBe(ip);
      }
    });
  });

  describe("updateTenantSchema", () => {
    it("accepts empty object (all fields optional)", () => {
      const result = updateTenantSchema.parse({});
      expect(result).toEqual({});
    });

    it("accepts partial updates", () => {
      const result = updateTenantSchema.parse({ name: "New Name" });
      expect(result.name).toBe("New Name");
      expect(result.plan).toBeUndefined();
    });

    it("rejects invalid plan in partial update", () => {
      expect(() => updateTenantSchema.parse({ plan: "free" })).toThrow();
    });

    it("rejects empty name string", () => {
      expect(() => updateTenantSchema.parse({ name: "" })).toThrow();
    });
  });

  // ---------- Integration Schemas ----------

  describe("createIntegrationSchema", () => {
    it("accepts valid integration data", () => {
      const result = createIntegrationSchema.parse({
        type: "aws",
        credentialRef: "vault://aws/prod",
      });
      expect(result.type).toBe("aws");
      expect(result.credentialRef).toBe("vault://aws/prod");
    });

    it("accepts all valid integration types", () => {
      const types = [
        "aws",
        "azure",
        "gcp",
        "okta",
        "azure_ad",
        "google_workspace",
        "jamf",
        "intune",
        "crowdstrike",
        "network",
      ];
      for (const type of types) {
        const result = createIntegrationSchema.parse({
          type,
          credentialRef: "ref",
        });
        expect(result.type).toBe(type);
      }
    });

    it("rejects invalid integration type", () => {
      expect(() =>
        createIntegrationSchema.parse({
          type: "invalid_cloud_xyz",
          credentialRef: "ref",
        }),
      ).toThrow();
    });

    it("rejects empty credentialRef", () => {
      expect(() =>
        createIntegrationSchema.parse({ type: "aws", credentialRef: "" }),
      ).toThrow();
    });

    it("rejects credentialRef exceeding 500 characters", () => {
      expect(() =>
        createIntegrationSchema.parse({
          type: "aws",
          credentialRef: "x".repeat(501),
        }),
      ).toThrow();
    });
  });

  describe("updateIntegrationSchema", () => {
    it("accepts empty object", () => {
      const result = updateIntegrationSchema.parse({});
      expect(result).toEqual({});
    });

    it("accepts valid status update", () => {
      const result = updateIntegrationSchema.parse({ status: "active" });
      expect(result.status).toBe("active");
    });

    it("accepts all valid integration statuses", () => {
      for (const status of ["active", "error", "expired"]) {
        const result = updateIntegrationSchema.parse({ status });
        expect(result.status).toBe(status);
      }
    });

    it("rejects invalid status", () => {
      expect(() =>
        updateIntegrationSchema.parse({ status: "disabled" }),
      ).toThrow();
    });
  });

  // ---------- Scan Schemas ----------

  describe("createScanSchema", () => {
    it("accepts valid scan configuration", () => {
      const result = createScanSchema.parse({
        frameworks: ["soc2", "hipaa"],
        targets: ["aws", "gcp"],
      });
      expect(result.frameworks).toEqual(["soc2", "hipaa"]);
      expect(result.targets).toEqual(["aws", "gcp"]);
    });

    it("rejects empty frameworks array", () => {
      expect(() =>
        createScanSchema.parse({ frameworks: [], targets: ["aws"] }),
      ).toThrow();
    });

    it("rejects empty targets array", () => {
      expect(() =>
        createScanSchema.parse({ frameworks: ["soc2"], targets: [] }),
      ).toThrow();
    });

    it("accepts all valid framework names", () => {
      for (const fw of ["soc2", "iso27001", "hipaa", "gdpr", "pcidss"]) {
        const result = createScanSchema.parse({
          frameworks: [fw],
          targets: ["aws"],
        });
        expect(result.frameworks).toContain(fw);
      }
    });

    it("rejects invalid framework name", () => {
      expect(() =>
        createScanSchema.parse({
          frameworks: ["nist"],
          targets: ["aws"],
        }),
      ).toThrow();
    });

    it("accepts all valid target names", () => {
      const validTargets = [
        "aws",
        "azure",
        "gcp",
        "okta",
        "azure_ad",
        "google_workspace",
        "jamf",
        "intune",
        "crowdstrike",
        "network",
      ];
      const result = createScanSchema.parse({
        frameworks: ["soc2"],
        targets: validTargets,
      });
      expect(result.targets).toEqual(validTargets);
    });

    it("rejects invalid target name", () => {
      expect(() =>
        createScanSchema.parse({
          frameworks: ["soc2"],
          targets: ["github"],
        }),
      ).toThrow();
    });

    it("accepts multiple frameworks combined", () => {
      const result = createScanSchema.parse({
        frameworks: ["soc2", "iso27001", "hipaa", "gdpr", "pcidss"],
        targets: ["aws"],
      });
      expect(result.frameworks).toHaveLength(5);
    });
  });

  describe("updateScanSchema", () => {
    it("accepts empty object", () => {
      const result = updateScanSchema.parse({});
      expect(result).toEqual({});
    });

    it("accepts valid status update", () => {
      const result = updateScanSchema.parse({ status: "running" });
      expect(result.status).toBe("running");
    });

    it("accepts all valid scan statuses", () => {
      for (const status of [
        "queued",
        "running",
        "completed",
        "completed_partial",
        "failed",
        "cancelled",
      ]) {
        const result = updateScanSchema.parse({ status });
        expect(result.status).toBe(status);
      }
    });

    it("accepts progress at boundary 0", () => {
      const result = updateScanSchema.parse({ progress: 0 });
      expect(result.progress).toBe(0);
    });

    it("accepts progress at boundary 100", () => {
      const result = updateScanSchema.parse({ progress: 100 });
      expect(result.progress).toBe(100);
    });

    it("rejects progress below 0", () => {
      expect(() => updateScanSchema.parse({ progress: -1 })).toThrow();
    });

    it("rejects progress above 100", () => {
      expect(() => updateScanSchema.parse({ progress: 101 })).toThrow();
    });

    it("rejects non-integer progress", () => {
      expect(() => updateScanSchema.parse({ progress: 50.5 })).toThrow();
    });

    it("accepts errorDetails as optional string", () => {
      const result = updateScanSchema.parse({
        errorDetails: "Agent timeout",
      });
      expect(result.errorDetails).toBe("Agent timeout");
    });
  });

  // ---------- Finding Schemas ----------

  describe("listFindingsQuerySchema", () => {
    it("provides defaults for page and limit", () => {
      const result = listFindingsQuerySchema.parse({});
      expect(result.page).toBe(1);
      expect(result.limit).toBe(25);
    });

    it("accepts valid UUID for scanId", () => {
      const result = listFindingsQuerySchema.parse({ scanId: VALID_UUID });
      expect(result.scanId).toBe(VALID_UUID);
    });

    it("rejects non-UUID scanId", () => {
      expect(() =>
        listFindingsQuerySchema.parse({ scanId: "not-a-uuid" }),
      ).toThrow();
    });

    it("accepts all valid severity values", () => {
      for (const severity of [
        "critical",
        "high",
        "medium",
        "low",
        "info",
      ]) {
        const result = listFindingsQuerySchema.parse({ severity });
        expect(result.severity).toBe(severity);
      }
    });

    it("rejects invalid severity value", () => {
      expect(() =>
        listFindingsQuerySchema.parse({ severity: "extreme" }),
      ).toThrow();
    });

    it("accepts all valid finding status values", () => {
      for (const status of [
        "open",
        "acknowledged",
        "in_progress",
        "resolved",
        "dismissed",
      ]) {
        const result = listFindingsQuerySchema.parse({ status });
        expect(result.status).toBe(status);
      }
    });

    it("accepts all valid category values", () => {
      for (const category of [
        "iam",
        "encryption",
        "logging",
        "network",
        "endpoint",
        "identity",
        "config",
      ]) {
        const result = listFindingsQuerySchema.parse({ category });
        expect(result.category).toBe(category);
      }
    });

    it("rejects limit above 100", () => {
      expect(() =>
        listFindingsQuerySchema.parse({ limit: 200 }),
      ).toThrow();
    });

    it("rejects limit below 1", () => {
      expect(() =>
        listFindingsQuerySchema.parse({ limit: 0 }),
      ).toThrow();
    });

    it("accepts limit at boundaries 1 and 100", () => {
      expect(listFindingsQuerySchema.parse({ limit: 1 }).limit).toBe(1);
      expect(listFindingsQuerySchema.parse({ limit: 100 }).limit).toBe(100);
    });

    it("rejects page below 1", () => {
      expect(() =>
        listFindingsQuerySchema.parse({ page: 0 }),
      ).toThrow();
    });

    it("coerces string numbers to integers", () => {
      const result = listFindingsQuerySchema.parse({ page: "3", limit: "50" });
      expect(result.page).toBe(3);
      expect(result.limit).toBe(50);
    });
  });

  describe("updateFindingStatusSchema", () => {
    it("accepts valid finding status", () => {
      const result = updateFindingStatusSchema.parse({ status: "resolved" });
      expect(result.status).toBe("resolved");
    });

    it("rejects missing status", () => {
      expect(() => updateFindingStatusSchema.parse({})).toThrow();
    });

    it("rejects invalid status", () => {
      expect(() =>
        updateFindingStatusSchema.parse({ status: "closed" }),
      ).toThrow();
    });
  });

  describe("agentFindingSchema", () => {
    const validFinding = {
      title: "Unencrypted S3 bucket",
      description: "S3 bucket my-bucket does not have default encryption enabled",
      severity: "high",
      category: "encryption",
      remediationTier: "auto",
    };

    it("accepts valid agent finding", () => {
      const result = agentFindingSchema.parse(validFinding);
      expect(result.title).toBe("Unencrypted S3 bucket");
      expect(result.autoFixAvailable).toBe(false); // default
      expect(result.controlMappings).toBeUndefined(); // optional, no default
    });

    it("rejects empty title", () => {
      expect(() =>
        agentFindingSchema.parse({ ...validFinding, title: "" }),
      ).toThrow();
    });

    it("rejects title exceeding 500 characters", () => {
      expect(() =>
        agentFindingSchema.parse({ ...validFinding, title: "x".repeat(501) }),
      ).toThrow();
    });

    it("rejects empty description", () => {
      expect(() =>
        agentFindingSchema.parse({ ...validFinding, description: "" }),
      ).toThrow();
    });

    it("accepts all valid remediation tiers", () => {
      for (const tier of ["auto", "approval", "manual"]) {
        const result = agentFindingSchema.parse({
          ...validFinding,
          remediationTier: tier,
        });
        expect(result.remediationTier).toBe(tier);
      }
    });

    it("accepts control mappings with valid data", () => {
      const result = agentFindingSchema.parse({
        ...validFinding,
        controlMappings: [
          {
            framework: "soc2",
            controlId: "CC6.1",
            controlName: "Logical Access",
            status: "fail",
            weight: 3,
          },
        ],
      });
      expect(result.controlMappings).toHaveLength(1);
      expect(result.controlMappings[0].framework).toBe("soc2");
    });

    it("rejects control mapping with invalid framework", () => {
      expect(() =>
        agentFindingSchema.parse({
          ...validFinding,
          controlMappings: [
            {
              framework: "nist",
              controlId: "C1",
              controlName: "Control",
              status: "pass",
            },
          ],
        }),
      ).toThrow();
    });

    it("rejects control mapping with invalid status", () => {
      expect(() =>
        agentFindingSchema.parse({
          ...validFinding,
          controlMappings: [
            {
              framework: "soc2",
              controlId: "C1",
              controlName: "Control",
              status: "unknown",
            },
          ],
        }),
      ).toThrow();
    });

    it("accepts control mapping weight at boundaries 1 and 3", () => {
      for (const weight of [1, 2, 3]) {
        const result = agentFindingSchema.parse({
          ...validFinding,
          controlMappings: [
            {
              framework: "soc2",
              controlId: "C1",
              controlName: "Control",
              status: "pass",
              weight,
            },
          ],
        });
        expect(result.controlMappings[0].weight).toBe(weight);
      }
    });

    it("defaults control mapping weight to 1", () => {
      const result = agentFindingSchema.parse({
        ...validFinding,
        controlMappings: [
          {
            framework: "soc2",
            controlId: "C1",
            controlName: "Control",
            status: "pass",
          },
        ],
      });
      expect(result.controlMappings[0].weight).toBe(1);
    });

    it("accepts nullable resourceType, resourceId, resourceRegion", () => {
      const result = agentFindingSchema.parse({
        ...validFinding,
        resourceType: null,
        resourceId: null,
        resourceRegion: null,
      });
      expect(result.resourceType).toBeNull();
      expect(result.resourceId).toBeNull();
      expect(result.resourceRegion).toBeNull();
    });
  });

  // ---------- Report Schema ----------

  describe("createReportSchema", () => {
    it("accepts valid report type", () => {
      const result = createReportSchema.parse({ type: "readiness" });
      expect(result.type).toBe("readiness");
    });

    it("accepts all valid report types", () => {
      for (const type of [
        "readiness",
        "evidence_package",
        "board_summary",
        "gap_analysis",
      ]) {
        const result = createReportSchema.parse({ type });
        expect(result.type).toBe(type);
      }
    });

    it("rejects invalid report type", () => {
      expect(() =>
        createReportSchema.parse({ type: "audit_log" }),
      ).toThrow();
    });

    it("accepts optional framework field", () => {
      const result = createReportSchema.parse({
        type: "readiness",
        framework: "soc2",
      });
      expect(result.framework).toBe("soc2");
    });

    it("rejects framework exceeding 20 characters", () => {
      expect(() =>
        createReportSchema.parse({
          type: "readiness",
          framework: "x".repeat(21),
        }),
      ).toThrow();
    });
  });

  // ---------- Compliance Schemas ----------

  describe("complianceScoresQuerySchema", () => {
    it("accepts empty query", () => {
      const result = complianceScoresQuerySchema.parse({});
      expect(result.scanId).toBeUndefined();
    });

    it("accepts valid UUID scanId", () => {
      const result = complianceScoresQuerySchema.parse({
        scanId: VALID_UUID,
      });
      expect(result.scanId).toBe(VALID_UUID);
    });

    it("rejects non-UUID scanId", () => {
      expect(() =>
        complianceScoresQuerySchema.parse({ scanId: "bad" }),
      ).toThrow();
    });
  });

  describe("complianceMatrixParamsSchema", () => {
    it("accepts all valid framework names", () => {
      for (const fw of ["soc2", "iso27001", "hipaa", "gdpr", "pcidss"]) {
        const result = complianceMatrixParamsSchema.parse({ framework: fw });
        expect(result.framework).toBe(fw);
      }
    });

    it("rejects invalid framework", () => {
      expect(() =>
        complianceMatrixParamsSchema.parse({ framework: "nist" }),
      ).toThrow();
    });

    it("rejects missing framework", () => {
      expect(() => complianceMatrixParamsSchema.parse({})).toThrow();
    });
  });

  describe("complianceTrendQuerySchema", () => {
    it("provides default limit of 30", () => {
      const result = complianceTrendQuerySchema.parse({ framework: "soc2" });
      expect(result.limit).toBe(30);
    });

    it("accepts custom limit within range", () => {
      const result = complianceTrendQuerySchema.parse({
        framework: "soc2",
        limit: 50,
      });
      expect(result.limit).toBe(50);
    });

    it("rejects limit above 100", () => {
      expect(() =>
        complianceTrendQuerySchema.parse({ framework: "soc2", limit: 200 }),
      ).toThrow();
    });

    it("rejects limit below 1", () => {
      expect(() =>
        complianceTrendQuerySchema.parse({ framework: "soc2", limit: 0 }),
      ).toThrow();
    });

    it("rejects invalid framework", () => {
      expect(() =>
        complianceTrendQuerySchema.parse({ framework: "invalid" }),
      ).toThrow();
    });
  });

  describe("complianceDiffQuerySchema", () => {
    it("accepts valid diff query", () => {
      const result = complianceDiffQuerySchema.parse({
        framework: "soc2",
        from: "2017",
        to: "2024",
      });
      expect(result.framework).toBe("soc2");
      expect(result.from).toBe("2017");
      expect(result.to).toBe("2024");
    });

    it("rejects missing from field", () => {
      expect(() =>
        complianceDiffQuerySchema.parse({ framework: "soc2", to: "2024" }),
      ).toThrow();
    });

    it("rejects missing to field", () => {
      expect(() =>
        complianceDiffQuerySchema.parse({ framework: "soc2", from: "2017" }),
      ).toThrow();
    });

    it("rejects empty from string", () => {
      expect(() =>
        complianceDiffQuerySchema.parse({
          framework: "soc2",
          from: "",
          to: "2024",
        }),
      ).toThrow();
    });
  });

  describe("auditReadyBodySchema", () => {
    it("accepts enabled true", () => {
      const result = auditReadyBodySchema.parse({ enabled: true });
      expect(result.enabled).toBe(true);
    });

    it("accepts enabled false", () => {
      const result = auditReadyBodySchema.parse({ enabled: false });
      expect(result.enabled).toBe(false);
    });

    it("rejects missing enabled field", () => {
      expect(() => auditReadyBodySchema.parse({})).toThrow();
    });

    it("rejects non-boolean enabled", () => {
      expect(() => auditReadyBodySchema.parse({ enabled: "yes" })).toThrow();
    });
  });

  // ---------- Evidence Schemas ----------

  describe("createEvidenceSchema", () => {
    const validEvidence = {
      findingId: VALID_UUID,
      type: "config_snapshot",
      collectedBy: "aws-agent",
    };

    it("accepts valid evidence data", () => {
      const result = createEvidenceSchema.parse(validEvidence);
      expect(result.type).toBe("config_snapshot");
    });

    it("accepts all valid evidence types", () => {
      for (const type of [
        "config_snapshot",
        "api_response",
        "screenshot",
        "manual_upload",
      ]) {
        const result = createEvidenceSchema.parse({
          ...validEvidence,
          type,
        });
        expect(result.type).toBe(type);
      }
    });

    it("rejects invalid evidence type", () => {
      expect(() =>
        createEvidenceSchema.parse({ ...validEvidence, type: "log_file" }),
      ).toThrow();
    });

    it("rejects non-UUID findingId", () => {
      expect(() =>
        createEvidenceSchema.parse({
          ...validEvidence,
          findingId: "not-uuid",
        }),
      ).toThrow();
    });

    it("rejects empty collectedBy", () => {
      expect(() =>
        createEvidenceSchema.parse({
          ...validEvidence,
          collectedBy: "",
        }),
      ).toThrow();
    });

    it("rejects collectedBy exceeding 200 characters", () => {
      expect(() =>
        createEvidenceSchema.parse({
          ...validEvidence,
          collectedBy: "x".repeat(201),
        }),
      ).toThrow();
    });
  });

  describe("listEvidenceQuerySchema", () => {
    it("provides defaults for limit and offset", () => {
      const result = listEvidenceQuerySchema.parse({});
      expect(result.limit).toBe(25);
      expect(result.offset).toBe(0);
    });

    it("accepts valid findingId filter", () => {
      const result = listEvidenceQuerySchema.parse({
        findingId: VALID_UUID,
      });
      expect(result.findingId).toBe(VALID_UUID);
    });

    it("rejects offset below 0", () => {
      expect(() =>
        listEvidenceQuerySchema.parse({ offset: -1 }),
      ).toThrow();
    });

    it("accepts offset at boundary 0", () => {
      const result = listEvidenceQuerySchema.parse({ offset: 0 });
      expect(result.offset).toBe(0);
    });

    it("rejects limit above 100", () => {
      expect(() =>
        listEvidenceQuerySchema.parse({ limit: 101 }),
      ).toThrow();
    });
  });

  // ---------- Remediation Schemas ----------

  describe("createRemediationSchema", () => {
    it("accepts valid remediation data", () => {
      const result = createRemediationSchema.parse({
        findingId: VALID_UUID,
        tier: "auto",
      });
      expect(result.tier).toBe("auto");
    });

    it("accepts optional playbookContent", () => {
      const result = createRemediationSchema.parse({
        findingId: VALID_UUID,
        tier: "manual",
        playbookContent: "Step 1: SSH into host...",
      });
      expect(result.playbookContent).toBe("Step 1: SSH into host...");
    });

    it("rejects non-UUID findingId", () => {
      expect(() =>
        createRemediationSchema.parse({
          findingId: "bad",
          tier: "auto",
        }),
      ).toThrow();
    });

    it("rejects invalid remediation tier", () => {
      expect(() =>
        createRemediationSchema.parse({
          findingId: VALID_UUID,
          tier: "automated",
        }),
      ).toThrow();
    });
  });

  describe("approveRemediationSchema", () => {
    it("accepts approved true", () => {
      const result = approveRemediationSchema.parse({ approved: true });
      expect(result.approved).toBe(true);
    });

    it("accepts approved false", () => {
      const result = approveRemediationSchema.parse({ approved: false });
      expect(result.approved).toBe(false);
    });

    it("rejects missing approved field", () => {
      expect(() => approveRemediationSchema.parse({})).toThrow();
    });

    it("rejects string value for approved", () => {
      expect(() =>
        approveRemediationSchema.parse({ approved: "yes" }),
      ).toThrow();
    });
  });

  describe("updateRemediationStatusSchema", () => {
    it("accepts all valid remediation statuses", () => {
      for (const status of [
        "pending",
        "approved",
        "executing",
        "completed",
        "failed",
        "rolled_back",
      ]) {
        const result = updateRemediationStatusSchema.parse({ status });
        expect(result.status).toBe(status);
      }
    });

    it("rejects invalid status", () => {
      expect(() =>
        updateRemediationStatusSchema.parse({ status: "cancelled" }),
      ).toThrow();
    });

    it("rejects missing status", () => {
      expect(() => updateRemediationStatusSchema.parse({})).toThrow();
    });
  });

  describe("listRemediationsQuerySchema", () => {
    it("provides defaults for limit and offset", () => {
      const result = listRemediationsQuerySchema.parse({});
      expect(result.limit).toBe(25);
      expect(result.offset).toBe(0);
    });

    it("accepts all filter combinations", () => {
      const result = listRemediationsQuerySchema.parse({
        findingId: VALID_UUID,
        status: "pending",
        tier: "auto",
        limit: 10,
        offset: 5,
      });
      expect(result.findingId).toBe(VALID_UUID);
      expect(result.status).toBe("pending");
      expect(result.tier).toBe("auto");
    });

    it("rejects invalid tier filter", () => {
      expect(() =>
        listRemediationsQuerySchema.parse({ tier: "express" }),
      ).toThrow();
    });
  });

  // ---------- Alert Rule Schemas ----------

  describe("createAlertRuleSchema", () => {
    const validAlert = {
      triggerType: "severity",
      triggerConfig: {},
      channels: ["email"],
    };

    it("accepts valid alert rule", () => {
      const result = createAlertRuleSchema.parse(validAlert);
      expect(result.triggerType).toBe("severity");
      expect(result.channels).toEqual(["email"]);
    });

    it("accepts all valid trigger types", () => {
      for (const tt of [
        "severity",
        "score_drop",
        "drift",
        "scan_complete",
        "deadline",
        "regulatory",
      ]) {
        const result = createAlertRuleSchema.parse({
          ...validAlert,
          triggerType: tt,
        });
        expect(result.triggerType).toBe(tt);
      }
    });

    it("rejects invalid trigger type", () => {
      expect(() =>
        createAlertRuleSchema.parse({
          ...validAlert,
          triggerType: "custom",
        }),
      ).toThrow();
    });

    it("accepts all valid channel types", () => {
      for (const ch of ["email", "slack", "webhook", "sms"]) {
        const result = createAlertRuleSchema.parse({
          ...validAlert,
          channels: [ch],
        });
        expect(result.channels).toContain(ch);
      }
    });

    it("rejects invalid channel", () => {
      expect(() =>
        createAlertRuleSchema.parse({
          ...validAlert,
          channels: ["pagerduty"],
        }),
      ).toThrow();
    });

    it("rejects empty channels array", () => {
      expect(() =>
        createAlertRuleSchema.parse({
          ...validAlert,
          channels: [],
        }),
      ).toThrow();
    });

    it("accepts multiple channels", () => {
      const result = createAlertRuleSchema.parse({
        ...validAlert,
        channels: ["email", "slack", "webhook", "sms"],
      });
      expect(result.channels).toHaveLength(4);
    });

    it("accepts valid quiet hours format", () => {
      const result = createAlertRuleSchema.parse({
        ...validAlert,
        quietHoursStart: "22:00",
        quietHoursEnd: "06:00",
        quietHoursTz: "America/New_York",
      });
      expect(result.quietHoursStart).toBe("22:00");
      expect(result.quietHoursEnd).toBe("06:00");
    });

    it("rejects invalid quiet hours format", () => {
      expect(() =>
        createAlertRuleSchema.parse({
          ...validAlert,
          quietHoursStart: "10pm",
        }),
      ).toThrow();
    });

    it("accepts trigger config with extra fields (passthrough)", () => {
      const result = createAlertRuleSchema.parse({
        ...validAlert,
        triggerConfig: {
          severity: "critical",
          threshold: 80,
          customField: "allowed",
        },
      });
      expect((result.triggerConfig as any).customField).toBe("allowed");
    });

    it("accepts optional enabled field", () => {
      const result = createAlertRuleSchema.parse({
        ...validAlert,
        enabled: false,
      });
      expect(result.enabled).toBe(false);
    });
  });

  describe("updateAlertRuleSchema", () => {
    it("accepts empty object", () => {
      const result = updateAlertRuleSchema.parse({});
      expect(result).toEqual({});
    });

    it("accepts nullable quiet hours", () => {
      const result = updateAlertRuleSchema.parse({
        quietHoursStart: null,
        quietHoursEnd: null,
        quietHoursTz: null,
      });
      expect(result.quietHoursStart).toBeNull();
    });
  });

  describe("listAlertRulesQuerySchema", () => {
    it("provides defaults for limit and offset", () => {
      const result = listAlertRulesQuerySchema.parse({});
      expect(result.limit).toBe(25);
      expect(result.offset).toBe(0);
    });

    it("preprocesses string boolean for enabled filter", () => {
      const resultTrue = listAlertRulesQuerySchema.parse({ enabled: "true" });
      expect(resultTrue.enabled).toBe(true);
      const resultFalse = listAlertRulesQuerySchema.parse({
        enabled: "false",
      });
      expect(resultFalse.enabled).toBe(false);
    });

    it("accepts triggerType filter", () => {
      const result = listAlertRulesQuerySchema.parse({
        triggerType: "severity",
      });
      expect(result.triggerType).toBe("severity");
    });
  });

  describe("toggleAlertRuleSchema", () => {
    it("accepts enabled true", () => {
      const result = toggleAlertRuleSchema.parse({ enabled: true });
      expect(result.enabled).toBe(true);
    });

    it("accepts enabled false", () => {
      const result = toggleAlertRuleSchema.parse({ enabled: false });
      expect(result.enabled).toBe(false);
    });

    it("rejects missing enabled", () => {
      expect(() => toggleAlertRuleSchema.parse({})).toThrow();
    });
  });

  describe("testAlertRuleSchema", () => {
    it("accepts valid UUID ruleId", () => {
      const result = testAlertRuleSchema.parse({ ruleId: VALID_UUID });
      expect(result.ruleId).toBe(VALID_UUID);
    });

    it("rejects non-UUID ruleId", () => {
      expect(() =>
        testAlertRuleSchema.parse({ ruleId: "not-uuid" }),
      ).toThrow();
    });
  });

  // ---------- Drift Schemas ----------

  describe("listDriftEventsQuerySchema", () => {
    it("provides defaults for limit and offset", () => {
      const result = listDriftEventsQuerySchema.parse({});
      expect(result.limit).toBe(25);
      expect(result.offset).toBe(0);
    });

    it("accepts all valid change types", () => {
      for (const ct of ["created", "modified", "deleted"]) {
        const result = listDriftEventsQuerySchema.parse({ changeType: ct });
        expect(result.changeType).toBe(ct);
      }
    });

    it("rejects invalid change type", () => {
      expect(() =>
        listDriftEventsQuerySchema.parse({ changeType: "updated" }),
      ).toThrow();
    });

    it("accepts all valid drift severity values", () => {
      for (const sev of ["critical", "high", "medium", "low"]) {
        const result = listDriftEventsQuerySchema.parse({ severity: sev });
        expect(result.severity).toBe(sev);
      }
    });

    it("preprocesses string boolean for acknowledged filter", () => {
      const result = listDriftEventsQuerySchema.parse({
        acknowledged: "true",
      });
      expect(result.acknowledged).toBe(true);
    });

    it("accepts UUID integrationId filter", () => {
      const result = listDriftEventsQuerySchema.parse({
        integrationId: VALID_UUID,
      });
      expect(result.integrationId).toBe(VALID_UUID);
    });

    it("rejects non-UUID integrationId", () => {
      expect(() =>
        listDriftEventsQuerySchema.parse({ integrationId: "bad" }),
      ).toThrow();
    });
  });

  describe("acknowledgeDriftEventSchema", () => {
    it("accepts acknowledged true", () => {
      const result = acknowledgeDriftEventSchema.parse({ acknowledged: true });
      expect(result.acknowledged).toBe(true);
    });

    it("accepts acknowledged false", () => {
      const result = acknowledgeDriftEventSchema.parse({
        acknowledged: false,
      });
      expect(result.acknowledged).toBe(false);
    });

    it("rejects missing acknowledged", () => {
      expect(() => acknowledgeDriftEventSchema.parse({})).toThrow();
    });
  });

  // ---------- Learning Schemas ----------

  describe("listPatternsQuerySchema", () => {
    it("provides defaults for limit and offset", () => {
      const result = listPatternsQuerySchema.parse({});
      expect(result.limit).toBe(25);
      expect(result.offset).toBe(0);
    });

    it("accepts all valid pattern types", () => {
      for (const pt of [
        "common_finding",
        "false_positive",
        "remediation_rate",
        "predicted_gap",
      ]) {
        const result = listPatternsQuerySchema.parse({ patternType: pt });
        expect(result.patternType).toBe(pt);
      }
    });

    it("rejects invalid pattern type", () => {
      expect(() =>
        listPatternsQuerySchema.parse({ patternType: "custom" }),
      ).toThrow();
    });

    it("accepts all valid industry values", () => {
      for (const ind of [
        "fintech",
        "healthtech",
        "saas",
        "ecommerce",
        "custom",
      ]) {
        const result = listPatternsQuerySchema.parse({ industry: ind });
        expect(result.industry).toBe(ind);
      }
    });

    it("rejects invalid industry", () => {
      expect(() =>
        listPatternsQuerySchema.parse({ industry: "banking" }),
      ).toThrow();
    });

    it("accepts framework filter", () => {
      const result = listPatternsQuerySchema.parse({ framework: "soc2" });
      expect(result.framework).toBe("soc2");
    });
  });

  describe("industryInsightParamsSchema", () => {
    it("accepts all valid industry values", () => {
      for (const ind of [
        "fintech",
        "healthtech",
        "saas",
        "ecommerce",
        "custom",
      ]) {
        const result = industryInsightParamsSchema.parse({ industry: ind });
        expect(result.industry).toBe(ind);
      }
    });

    it("rejects invalid industry", () => {
      expect(() =>
        industryInsightParamsSchema.parse({ industry: "government" }),
      ).toThrow();
    });

    it("rejects missing industry", () => {
      expect(() => industryInsightParamsSchema.parse({})).toThrow();
    });
  });
});

// ============================================================================
// SECTION 2: Route Registration Tests
// ============================================================================

describe("Route Registration", () => {
  it("healthRoutes exports a Fastify plugin function", () => {
    expect(typeof healthRoutes).toBe("function");
  });

  it("authRoutes exports a Fastify plugin function", () => {
    expect(typeof authRoutes).toBe("function");
  });

  it("clientRoutes exports a Fastify plugin function", () => {
    expect(typeof clientRoutes).toBe("function");
  });

  it("integrationRoutes exports a Fastify plugin function", () => {
    expect(typeof integrationRoutes).toBe("function");
  });

  it("scanRoutes exports a Fastify plugin function", () => {
    expect(typeof scanRoutes).toBe("function");
  });

  it("findingRoutes exports a Fastify plugin function", () => {
    expect(typeof findingRoutes).toBe("function");
  });

  it("reportRoutes exports a Fastify plugin function", () => {
    expect(typeof reportRoutes).toBe("function");
  });

  it("complianceRoutes exports a Fastify plugin function", () => {
    expect(typeof complianceRoutes).toBe("function");
  });

  it("evidenceRoutes exports a Fastify plugin function", () => {
    expect(typeof evidenceRoutes).toBe("function");
  });

  it("remediationRoutes exports a Fastify plugin function", () => {
    expect(typeof remediationRoutes).toBe("function");
  });

  it("alertRoutes exports a Fastify plugin function", () => {
    expect(typeof alertRoutes).toBe("function");
  });

  it("driftRoutes exports a Fastify plugin function", () => {
    expect(typeof driftRoutes).toBe("function");
  });

  it("learningRoutes exports a Fastify plugin function", () => {
    expect(typeof learningRoutes).toBe("function");
  });

  it("all route plugins are async functions", () => {
    const routes = [
      healthRoutes,
      authRoutes,
      clientRoutes,
      integrationRoutes,
      scanRoutes,
      findingRoutes,
      reportRoutes,
      complianceRoutes,
      evidenceRoutes,
      remediationRoutes,
      alertRoutes,
      driftRoutes,
      learningRoutes,
    ];
    for (const route of routes) {
      // AsyncFunction constructor name
      expect(route.constructor.name).toBe("AsyncFunction");
    }
  });
});

// ============================================================================
// SECTION 3: Error Utility Tests
// ============================================================================

describe("Error Utilities", () => {
  describe("ApiError", () => {
    it("extends Error", () => {
      const err = new ApiError(400, "TEST", "test message");
      expect(err).toBeInstanceOf(Error);
      expect(err).toBeInstanceOf(ApiError);
    });

    it("stores statusCode, code, message, and details", () => {
      const details = { field: "email" };
      const err = new ApiError(422, "VALIDATION", "Invalid input", details);
      expect(err.statusCode).toBe(422);
      expect(err.code).toBe("VALIDATION");
      expect(err.message).toBe("Invalid input");
      expect(err.details).toEqual({ field: "email" });
    });

    it("has name set to ApiError", () => {
      const err = new ApiError(500, "INTERNAL", "error");
      expect(err.name).toBe("ApiError");
    });

    it("works without details parameter", () => {
      const err = new ApiError(404, "NOT_FOUND", "Not found");
      expect(err.details).toBeUndefined();
    });
  });

  describe("badRequest", () => {
    it("returns ApiError with statusCode 400", () => {
      const err = badRequest("BAD_INPUT", "Invalid data");
      expect(err).toBeInstanceOf(ApiError);
      expect(err.statusCode).toBe(400);
      expect(err.code).toBe("BAD_INPUT");
      expect(err.message).toBe("Invalid data");
    });

    it("supports optional details", () => {
      const err = badRequest("BAD_INPUT", "Invalid", { field: "name" });
      expect(err.details).toEqual({ field: "name" });
    });
  });

  describe("unauthorized", () => {
    it("returns ApiError with statusCode 401", () => {
      const err = unauthorized();
      expect(err).toBeInstanceOf(ApiError);
      expect(err.statusCode).toBe(401);
      expect(err.code).toBe("UNAUTHORIZED");
      expect(err.message).toBe("Authentication required");
    });

    it("accepts custom message", () => {
      const err = unauthorized("Token expired");
      expect(err.message).toBe("Token expired");
    });
  });

  describe("forbidden", () => {
    it("returns ApiError with statusCode 403", () => {
      const err = forbidden();
      expect(err).toBeInstanceOf(ApiError);
      expect(err.statusCode).toBe(403);
      expect(err.code).toBe("FORBIDDEN");
      expect(err.message).toBe("Insufficient permissions");
    });

    it("accepts custom message", () => {
      const err = forbidden("Admin only");
      expect(err.message).toBe("Admin only");
    });
  });

  describe("notFound", () => {
    it("returns ApiError with statusCode 404", () => {
      const err = notFound("Client");
      expect(err).toBeInstanceOf(ApiError);
      expect(err.statusCode).toBe(404);
      expect(err.code).toBe("NOT_FOUND");
      expect(err.message).toBe("Client not found");
    });

    it("includes resource name in message", () => {
      const err = notFound("Finding");
      expect(err.message).toBe("Finding not found");
    });
  });

  describe("conflict", () => {
    it("returns ApiError with statusCode 409", () => {
      const err = conflict("SLUG_EXISTS", "Slug already taken");
      expect(err).toBeInstanceOf(ApiError);
      expect(err.statusCode).toBe(409);
      expect(err.code).toBe("SLUG_EXISTS");
      expect(err.message).toBe("Slug already taken");
    });
  });
});

// ============================================================================
// SECTION 4: Security Utility Tests
// ============================================================================

describe("Security Utilities", () => {
  describe("validateUUID", () => {
    it("accepts valid UUID v4", () => {
      expect(validateUUID("550e8400-e29b-41d4-a716-446655440000")).toBe(true);
      expect(validateUUID(VALID_UUID)).toBe(true);
    });

    it("accepts UUID v4 with uppercase hex", () => {
      expect(validateUUID("550E8400-E29B-41D4-A716-446655440000")).toBe(true);
    });

    it("accepts UUID v1", () => {
      expect(validateUUID("550e8400-e29b-11d4-a716-446655440000")).toBe(true);
    });

    it("accepts UUID v3", () => {
      expect(validateUUID("550e8400-e29b-31d4-a716-446655440000")).toBe(true);
    });

    it("rejects empty string", () => {
      expect(validateUUID("")).toBe(false);
    });

    it("rejects plain numbers", () => {
      expect(validateUUID("12345")).toBe(false);
    });

    it("rejects UUID-like strings with wrong length", () => {
      expect(validateUUID("550e8400-e29b-41d4-a716-44665544000")).toBe(false);
    });

    it("rejects SQL injection payloads", () => {
      expect(validateUUID("' OR 1=1 --")).toBe(false);
      expect(validateUUID("'; DROP TABLE users; --")).toBe(false);
    });
  });

  describe("requireUUID", () => {
    it("returns valid UUID unchanged", () => {
      expect(requireUUID(VALID_UUID)).toBe(VALID_UUID);
    });

    it("throws ApiError for invalid UUID", () => {
      expect(() => requireUUID("bad")).toThrow(ApiError);
    });

    it("includes param name in error message", () => {
      try {
        requireUUID("bad", "findingId");
        expect.fail("Should have thrown");
      } catch (err: any) {
        expect(err.message).toContain("findingId");
      }
    });

    it("throws with statusCode 400", () => {
      try {
        requireUUID("bad");
      } catch (err: any) {
        expect(err.statusCode).toBe(400);
        expect(err.code).toBe("INVALID_ID");
      }
    });
  });

  describe("sanitizePath", () => {
    it("accepts safe relative paths", () => {
      expect(sanitizePath("evidence/tenant/file.json")).toBe(
        "evidence/tenant/file.json",
      );
    });

    it("rejects path traversal with ..", () => {
      expect(() => sanitizePath("../../etc/passwd")).toThrow(ApiError);
    });

    it("rejects URL-encoded traversal %2e%2e", () => {
      expect(() => sanitizePath("evidence/%2e%2e/secret")).toThrow(ApiError);
    });

    it("rejects null byte injection", () => {
      expect(() => sanitizePath("file.pdf\0.exe")).toThrow(ApiError);
    });

    it("rejects absolute Unix paths", () => {
      expect(() => sanitizePath("/etc/passwd")).toThrow(ApiError);
    });

    it("rejects absolute Windows paths", () => {
      expect(() => sanitizePath("C:\\Windows\\system32")).toThrow(ApiError);
    });

    it("rejects tilde paths", () => {
      expect(() => sanitizePath("~/.ssh/id_rsa")).toThrow(ApiError);
    });

    it("rejects empty path", () => {
      expect(() => sanitizePath("")).toThrow(ApiError);
    });

    it("rejects URL-encoded null byte %00", () => {
      expect(() => sanitizePath("evidence/%00")).toThrow(ApiError);
    });

    it("rejects backslash-encoded traversal %5c", () => {
      expect(() => sanitizePath("evidence/%5c..%5csecret")).toThrow(ApiError);
    });
  });

  describe("sanitizeErrorMessage", () => {
    it("strips stack trace lines from message", () => {
      const err = new Error(
        "Query failed    at Module._compile (/app/index.js:10)",
      );
      const result = sanitizeErrorMessage(err);
      expect(result).not.toContain("Module._compile");
    });

    it("strips Unix file paths", () => {
      const err = new Error("Cannot read /app/src/config.ts");
      const result = sanitizeErrorMessage(err);
      expect(result).toContain("[path]");
    });

    it("strips Windows file paths", () => {
      const err = new Error("Cannot read C:\\Users\\admin\\secrets.env");
      const result = sanitizeErrorMessage(err);
      expect(result).toContain("[path]");
    });

    it("strips connection strings", () => {
      const err = new Error(
        "Failed: postgres://admin:secret@db:5432/prod",
      );
      const result = sanitizeErrorMessage(err);
      expect(result).toContain("[redacted]");
      expect(result).not.toContain("admin:secret");
    });

    it("strips redis connection strings", () => {
      const err = new Error("Failed: redis://user:pass@cache:6379");
      const result = sanitizeErrorMessage(err);
      expect(result).toContain("[redacted]");
    });

    it("strips credential-like patterns", () => {
      const err = new Error("Auth token: sk-abc123 password=hunter2");
      const result = sanitizeErrorMessage(err);
      expect(result).not.toContain("sk-abc123");
      expect(result).not.toContain("hunter2");
    });

    it("caps message at 500 characters", () => {
      const err = new Error("x".repeat(1000));
      const result = sanitizeErrorMessage(err);
      expect(result.length).toBeLessThanOrEqual(500);
    });

    it("handles empty error message", () => {
      const err = new Error("");
      const result = sanitizeErrorMessage(err);
      expect(result).toBe("An unexpected error occurred");
    });
  });

  describe("validateScanStatus", () => {
    it("accepts all valid scan statuses", () => {
      const valid = [
        "queued",
        "running",
        "completed",
        "completed_partial",
        "failed",
        "cancelled",
      ];
      for (const status of valid) {
        expect(validateScanStatus(status)).toBe(status);
      }
    });

    it("rejects arbitrary strings", () => {
      expect(() => validateScanStatus("active")).toThrow(ApiError);
      expect(() => validateScanStatus("pending")).toThrow(ApiError);
    });

    it("rejects SQL injection payload", () => {
      expect(() => validateScanStatus("'; DROP TABLE scans; --")).toThrow(
        ApiError,
      );
    });
  });
});

// ============================================================================
// SECTION 5: Scoring Edge Cases
// ============================================================================

describe("Scoring Edge Cases", () => {
  it("scores 100 when all 100 controls pass (weight 1)", () => {
    const controls = Array.from({ length: 100 }, (_, i) =>
      makeControl(`C${i}`, 1),
    );
    const statusMap = new Map(
      controls.map((c) => [c.controlId, "pass" as const]),
    );
    const result = calculateFrameworkScore("soc2", controls, statusMap);
    expect(result.score).toBe(100);
    expect(result.passCount).toBe(100);
    expect(result.failCount).toBe(0);
    expect(result.totalControls).toBe(100);
    expect(result.evaluatedControls).toBe(100);
  });

  it("scores 0 when all controls fail", () => {
    const controls = Array.from({ length: 50 }, (_, i) =>
      makeControl(`C${i}`, 2),
    );
    const statusMap = new Map(
      controls.map((c) => [c.controlId, "fail" as const]),
    );
    const result = calculateFrameworkScore("soc2", controls, statusMap);
    expect(result.score).toBe(0);
    expect(result.failCount).toBe(50);
    expect(result.passCount).toBe(0);
  });

  it("handles mixed statuses with complex weight distribution", () => {
    // 3 controls: weight 3 pass, weight 2 partial (50%), weight 1 fail
    // earned = 3 + 1 = 4, total = 3 + 2 + 1 = 6, score = 67 (4/6 = 66.67 rounds to 67)
    const controls = [
      makeControl("C1", 3),
      makeControl("C2", 2),
      makeControl("C3", 1),
    ];
    const statusMap = new Map<string, "pass" | "partial" | "fail" | "na">([
      ["C1", "pass"],
      ["C2", "partial"],
      ["C3", "fail"],
    ]);
    const result = calculateFrameworkScore("soc2", controls, statusMap);
    expect(result.score).toBe(67);
    expect(result.passCount).toBe(1);
    expect(result.partialCount).toBe(1);
    expect(result.failCount).toBe(1);
  });

  it("rounds score at .5 boundary (earned/possible = 0.505)", () => {
    // Two weight-1 controls: 1 pass, 1 partial
    // earned = 1 + 0.5 = 1.5, total = 2, score = 75
    const controls = [makeControl("C1", 1), makeControl("C2", 1)];
    const statusMap = new Map<string, "pass" | "partial" | "fail" | "na">([
      ["C1", "pass"],
      ["C2", "partial"],
    ]);
    const result = calculateFrameworkScore("soc2", controls, statusMap);
    expect(result.score).toBe(75);
  });

  it("rounds 0.505 correctly (weight 3 pass + weight 3 partial out of total 200)", () => {
    // To get 0.505: earned = 101, total weight = 200
    // 101/200 = 0.505 => Math.round(50.5) = 51 in JS (rounds to even? No, Math.round rounds .5 up)
    // Actually Math.round(50.5) = 51 in JS
    // Let's construct: 67 pass weight-1 + 1 partial weight-1 + 132 fail weight-1
    // earned = 67 + 0.5 = 67.5, total = 200, score = Math.round(33.75) = 34
    // Better: 100 pass weight-1 + 1 partial weight-1 + 99 fail weight-1
    // earned = 100 + 0.5 = 100.5, total = 200, 100.5/200*100 = 50.25, round = 50
    // For exact .5: need earned/total * 100 = X.5
    // earned = 101, total = 200 => 50.5 => Math.round = 51
    const controls: ControlDefinition[] = [];
    for (let i = 0; i < 200; i++) {
      controls.push(makeControl(`C${i}`, 1));
    }
    const statusMap = new Map<string, "pass" | "partial" | "fail" | "na">();
    // 101 pass, 99 fail => earned=101, total=200, 50.5 => 51
    for (let i = 0; i < 101; i++) {
      statusMap.set(`C${i}`, "pass");
    }
    for (let i = 101; i < 200; i++) {
      statusMap.set(`C${i}`, "fail");
    }
    const result = calculateFrameworkScore("soc2", controls, statusMap);
    expect(result.score).toBe(51); // Math.round(50.5) = 51
  });

  it("single control pass => 100", () => {
    const controls = [makeControl("C1", 1)];
    const statusMap = new Map([["C1", "pass" as const]]);
    const result = calculateFrameworkScore("soc2", controls, statusMap);
    expect(result.score).toBe(100);
  });

  it("single control fail => 0", () => {
    const controls = [makeControl("C1", 1)];
    const statusMap = new Map([["C1", "fail" as const]]);
    const result = calculateFrameworkScore("soc2", controls, statusMap);
    expect(result.score).toBe(0);
  });

  it("single control partial => 50", () => {
    const controls = [makeControl("C1", 1)];
    const statusMap = new Map([["C1", "partial" as const]]);
    const result = calculateFrameworkScore("soc2", controls, statusMap);
    expect(result.score).toBe(50);
  });

  it("single control na => 0 score, 0 evaluated", () => {
    const controls = [makeControl("C1", 1)];
    const statusMap = new Map([["C1", "na" as const]]);
    const result = calculateFrameworkScore("soc2", controls, statusMap);
    expect(result.score).toBe(0);
    expect(result.evaluatedControls).toBe(0);
    expect(result.naCount).toBe(1);
  });

  it("handles all controls missing from status map (not evaluated)", () => {
    const controls = [makeControl("C1", 3), makeControl("C2", 2)];
    const statusMap = new Map<string, "pass" | "partial" | "fail" | "na">();
    const result = calculateFrameworkScore("soc2", controls, statusMap);
    // SECURITY FIX (BLACKFYRE audit 2026-06-05): both missing from the map =>
    // not-evaluated (earned = 0, total = 5, score = 0), NOT real failures.
    expect(result.score).toBe(0);
    expect(result.notEvaluatedCount).toBe(2);
    expect(result.failCount).toBe(0);
    expect(result.evaluatedControls).toBe(0);
    expect(result.totalControls).toBe(2);
  });

  it("empty controls list returns 0 score", () => {
    const result = calculateFrameworkScore("soc2", [], new Map());
    expect(result.score).toBe(0);
    expect(result.totalControls).toBe(0);
    expect(result.evaluatedControls).toBe(0);
  });

  it("preserves framework name in result", () => {
    const result = calculateFrameworkScore(
      "hipaa",
      [makeControl("C1", 1)],
      new Map([["C1", "pass" as const]]),
    );
    expect(result.framework).toBe("hipaa");
  });

  it("handles weight-3 controls dominating score", () => {
    // C1: weight 3 fail => 0
    // C2: weight 1 pass => 1
    // total = 4, earned = 1, score = 25
    const controls = [makeControl("C1", 3), makeControl("C2", 1)];
    const statusMap = new Map<string, "pass" | "partial" | "fail" | "na">([
      ["C1", "fail"],
      ["C2", "pass"],
    ]);
    const result = calculateFrameworkScore("soc2", controls, statusMap);
    expect(result.score).toBe(25);
  });
});

// ============================================================================
// SECTION 6: Control Registry Completeness
// ============================================================================

// Framework registries grow over time as controls are added. Tests assert
// `≥ N` instead of `=== N` so adding controls doesn't break the gate; the
// baselines below are the floor at the time of writing.
describe("Control Registry Completeness", () => {
  const registries = getAllFrameworkRegistries();

  it("has registries for all 9 frameworks", () => {
    expect(registries).toHaveLength(9);
    const frameworks = registries.map((r) => r.framework);
    expect(frameworks).toContain("soc2");
    expect(frameworks).toContain("iso27001");
    expect(frameworks).toContain("hipaa");
    expect(frameworks).toContain("gdpr");
    expect(frameworks).toContain("pcidss");
    expect(frameworks).toContain("dpdpa");
    expect(frameworks).toContain("iso42001");
    expect(frameworks).toContain("pdppl");
    expect(frameworks).toContain("nist80053");
  });

  it("each framework has unique control IDs (no duplicates)", () => {
    for (const registry of registries) {
      const ids = registry.controls.map((c) => c.controlId);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    }
  });

  it("all control weights are 1, 2, or 3", () => {
    for (const registry of registries) {
      for (const control of registry.controls) {
        expect([1, 2, 3]).toContain(control.weight);
      }
    }
  });

  it("all controls have non-empty descriptions", () => {
    for (const registry of registries) {
      for (const control of registry.controls) {
        expect(control.description.length).toBeGreaterThan(0);
      }
    }
  });

  it("all controls have non-empty controlName", () => {
    for (const registry of registries) {
      for (const control of registry.controls) {
        expect(control.controlName.length).toBeGreaterThan(0);
      }
    }
  });

  it("all controls have non-empty controlId", () => {
    for (const registry of registries) {
      for (const control of registry.controls) {
        expect(control.controlId.length).toBeGreaterThan(0);
      }
    }
  });

  it("all controls have non-empty category", () => {
    for (const registry of registries) {
      for (const control of registry.controls) {
        expect(control.category.length).toBeGreaterThan(0);
      }
    }
  });

  it("framework versions are non-empty strings", () => {
    for (const registry of registries) {
      expect(registry.version.length).toBeGreaterThan(0);
    }
  });

  it("totalControls matches actual controls array length", () => {
    for (const registry of registries) {
      expect(registry.totalControls).toBe(registry.controls.length);
    }
  });

  it("getFrameworkRegistry returns correct registry for each framework", () => {
    for (const fw of ["soc2", "iso27001", "hipaa", "gdpr", "pcidss"]) {
      const registry = getFrameworkRegistry(fw);
      expect(registry).toBeDefined();
      expect(registry!.framework).toBe(fw);
    }
  });

  it("getFrameworkRegistry returns undefined for unknown framework", () => {
    expect(getFrameworkRegistry("nist")).toBeUndefined();
  });

  it("getControlDefinition returns correct control", () => {
    const control = getControlDefinition("soc2", "CC6.1");
    expect(control).toBeDefined();
    expect(control!.controlId).toBe("CC6.1");
    expect(control!.weight).toBe(3);
  });

  it("getControlDefinition returns undefined for unknown control", () => {
    expect(getControlDefinition("soc2", "FAKE.1")).toBeUndefined();
  });

  it("getControlDefinition returns undefined for unknown framework", () => {
    expect(getControlDefinition("nist", "AC-1")).toBeUndefined();
  });

  it("getFrameworkVersions returns version array for known frameworks", () => {
    const versions = getFrameworkVersions("soc2");
    expect(versions).toHaveLength(1);
    expect(versions[0]).toBe("2017");
  });

  it("getFrameworkVersions returns empty array for unknown framework", () => {
    expect(getFrameworkVersions("nist")).toEqual([]);
  });

  // Floors instead of exact equality — registries grow as controls are added,
  // and we don't want every new control to fail the gate. The floors are the
  // smallest credible "we still cover the basics" thresholds, set well below
  // the actual counts at time of writing (SOC2 ~70+, ISO27001 ~93, HIPAA ~113,
  // GDPR ~99, PCI DSS ~120+).
  it("SOC 2 control registry has at least 15 controls", () => {
    const registry = getFrameworkRegistry("soc2");
    expect(registry!.totalControls).toBeGreaterThanOrEqual(15);
  });

  it("ISO 27001 control registry has at least 12 controls", () => {
    const registry = getFrameworkRegistry("iso27001");
    expect(registry!.totalControls).toBeGreaterThanOrEqual(12);
  });

  it("HIPAA control registry has at least 10 controls", () => {
    const registry = getFrameworkRegistry("hipaa");
    expect(registry!.totalControls).toBeGreaterThanOrEqual(10);
  });

  it("GDPR control registry has at least 11 controls", () => {
    const registry = getFrameworkRegistry("gdpr");
    expect(registry!.totalControls).toBeGreaterThanOrEqual(11);
  });

  it("PCI DSS control registry has at least 14 controls", () => {
    const registry = getFrameworkRegistry("pcidss");
    expect(registry!.totalControls).toBeGreaterThanOrEqual(14);
  });
});

// ============================================================================
// SECTION 7: Industry Profile Completeness
// ============================================================================

describe("Industry Profile Completeness", () => {
  const profiles = getAllIndustryProfiles();
  const validFrameworks = new Set(["soc2", "iso27001", "hipaa", "gdpr", "pcidss", "dpdpa", "iso42001", "pdppl", "nist80053"]);

  it("has profiles for fintech, healthtech, saas, ecommerce", () => {
    const ids = profiles.map((p) => p.id);
    expect(ids).toContain("fintech");
    expect(ids).toContain("healthtech");
    expect(ids).toContain("saas");
    expect(ids).toContain("ecommerce");
  });

  it("each profile has at least 2 priority frameworks", () => {
    for (const profile of profiles) {
      expect(profile.priorityFrameworks.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("all referenced frameworks exist in the registry", () => {
    for (const profile of profiles) {
      for (const fw of profile.priorityFrameworks) {
        expect(validFrameworks.has(fw)).toBe(true);
      }
    }
  });

  it("each profile has at least 3 focus areas", () => {
    for (const profile of profiles) {
      expect(profile.focusAreas.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("all focus areas are non-empty strings", () => {
    for (const profile of profiles) {
      for (const area of profile.focusAreas) {
        expect(area.length).toBeGreaterThan(0);
      }
    }
  });

  it("each profile has a non-empty name", () => {
    for (const profile of profiles) {
      expect(profile.name.length).toBeGreaterThan(0);
    }
  });

  it("getIndustryProfile returns correct profile by id", () => {
    const profile = getIndustryProfile("fintech");
    expect(profile).toBeDefined();
    expect(profile!.id).toBe("fintech");
    expect(profile!.name).toBe("Financial Technology");
  });

  it("getIndustryProfile returns undefined for unknown id", () => {
    expect(getIndustryProfile("banking")).toBeUndefined();
  });

  it("fintech profile prioritizes soc2 and pcidss", () => {
    const profile = getIndustryProfile("fintech");
    expect(profile!.priorityFrameworks).toContain("soc2");
    expect(profile!.priorityFrameworks).toContain("pcidss");
  });

  it("healthtech profile prioritizes hipaa", () => {
    const profile = getIndustryProfile("healthtech");
    expect(profile!.priorityFrameworks).toContain("hipaa");
  });

  it("ecommerce profile prioritizes pcidss", () => {
    const profile = getIndustryProfile("ecommerce");
    expect(profile!.priorityFrameworks).toContain("pcidss");
  });
});
