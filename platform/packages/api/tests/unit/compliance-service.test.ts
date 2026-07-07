import { describe, it, expect } from "vitest";
import { ComplianceService } from "../../src/services/compliance-service.js";
import { getFrameworkRegistry, getAllFrameworkRegistries } from "../../src/compliance/control-registry.js";

describe("ComplianceService", () => {
  describe("getIndustryRecommendations", () => {
    it("returns priority frameworks for fintech", () => {
      const service = new ComplianceService(null as any);
      const result = service.getIndustryRecommendations("fintech");
      expect(result).toBeDefined();
      expect(result!.priorityFrameworks).toContain("pcidss");
      expect(result!.priorityFrameworks).toContain("soc2");
    });

    it("returns priority frameworks for healthtech", () => {
      const service = new ComplianceService(null as any);
      const result = service.getIndustryRecommendations("healthtech");
      expect(result).toBeDefined();
      expect(result!.priorityFrameworks).toContain("hipaa");
    });

    it("returns undefined for unknown industry", () => {
      const service = new ComplianceService(null as any);
      const result = service.getIndustryRecommendations("aerospace");
      expect(result).toBeUndefined();
    });
  });

  describe("getAvailableFrameworks", () => {
    it("returns all 9 framework registries", () => {
      const service = new ComplianceService(null as any);
      const frameworks = service.getAvailableFrameworks();
      expect(frameworks.length).toBe(9);
      const ids = frameworks.map((f) => f.framework);
      expect(ids).toContain("soc2");
      expect(ids).toContain("iso27001");
      expect(ids).toContain("hipaa");
      expect(ids).toContain("gdpr");
      expect(ids).toContain("pcidss");
      expect(ids).toContain("dpdpa");
      expect(ids).toContain("iso42001");
      expect(ids).toContain("pdppl");
      expect(ids).toContain("nist80053");
    });
  });

  describe("getAllIndustryProfiles", () => {
    it("returns all 6 industry profiles", () => {
      const service = new ComplianceService(null as any);
      const profiles = service.getAllProfiles();
      expect(profiles.length).toBe(6);
      const ids = profiles.map((p) => p.id);
      expect(ids).toContain("fintech");
      expect(ids).toContain("healthtech");
      expect(ids).toContain("saas");
      expect(ids).toContain("ecommerce");
      expect(ids).toContain("custom");
      expect(ids).toContain("government");
    });
  });

  describe("control registry integration", () => {
    it("SOC 2 has controls with correct weights", () => {
      const registry = getFrameworkRegistry("soc2");
      expect(registry).toBeDefined();
      expect(registry!.controls.length).toBeGreaterThan(0);
      const critical = registry!.controls.filter((c) => c.weight === 3);
      expect(critical.length).toBeGreaterThan(0);
    });

    it("all frameworks have at least 8 controls", () => {
      const registries = getAllFrameworkRegistries();
      for (const reg of registries) {
        expect(reg.controls.length).toBeGreaterThanOrEqual(8);
      }
    });

    it("each control has a unique ID within its framework", () => {
      const registries = getAllFrameworkRegistries();
      for (const reg of registries) {
        const ids = reg.controls.map((c) => c.controlId);
        const unique = new Set(ids);
        expect(unique.size).toBe(ids.length);
      }
    });
  });
});
