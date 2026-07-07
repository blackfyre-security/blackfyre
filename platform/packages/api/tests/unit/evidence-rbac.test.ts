import { describe, it, expect, beforeEach } from "vitest";

// Test the auditor scope enforcement logic directly
// This tests the pure function, not the Fastify plugin wrapper

describe("Evidence RBAC - Auditor Scope Enforcement", () => {
  // Import the requireAuditorScope function
  // It takes a request-like object and a framework string
  // Throws 403 if auditor lacks scope

  describe("requireAuditorScope", () => {
    let requireAuditorScope: (request: any, framework: string) => void;

    beforeEach(async () => {
      const mod = await import("../../src/plugins/auditor-scope.js");
      requireAuditorScope = mod.requireAuditorScope;
    });

    it("auditor with correct frameworkScope passes without error", () => {
      const request = {
        userRole: "auditor",
        frameworkScope: ["soc2", "iso27001"],
      };
      expect(() => requireAuditorScope(request, "soc2")).not.toThrow();
    });

    it("auditor with wrong frameworkScope throws 403", () => {
      const request = {
        userRole: "auditor",
        frameworkScope: ["soc2"],
      };
      expect(() => requireAuditorScope(request, "iso27001")).toThrow();
    });

    it("non-auditor role passes through without scope check", () => {
      const request = {
        userRole: "admin",
        frameworkScope: undefined,
      };
      expect(() => requireAuditorScope(request, "iso27001")).not.toThrow();
    });

    it("auditor with empty frameworkScope throws 403", () => {
      const request = {
        userRole: "auditor",
        frameworkScope: [],
      };
      expect(() => requireAuditorScope(request, "soc2")).toThrow();
    });

    it("auditor with undefined frameworkScope throws 403", () => {
      const request = {
        userRole: "auditor",
        frameworkScope: undefined,
      };
      expect(() => requireAuditorScope(request, "soc2")).toThrow();
    });
  });
});
