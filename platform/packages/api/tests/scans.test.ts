import { describe, it, expect } from "vitest";
import { getApp, createTestTenantAndUser } from "./helpers/setup.js";

describe("Scan CRUD", () => {
  describe("GET /api/scans", () => {
    it("lists scans for current tenant", async () => {
      const { token } = await createTestTenantAndUser({ role: "admin" });
      const app = getApp();

      const res = await app.inject({
        method: "GET",
        url: "/api/scans",
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().scans).toBeInstanceOf(Array);
    });
  });

  describe("POST /api/scans", () => {
    it("creates a scan with frameworks and targets", async () => {
      const { token } = await createTestTenantAndUser({ role: "admin" });
      const app = getApp();

      const res = await app.inject({
        method: "POST",
        url: "/api/scans",
        headers: { authorization: `Bearer ${token}` },
        payload: {
          frameworks: ["soc2", "hipaa"],
          targets: ["aws", "okta"],
        },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.scan.frameworks).toEqual(["soc2", "hipaa"]);
      expect(body.scan.targets).toEqual(["aws", "okta"]);
      expect(body.scan.status).toBe("queued");
      expect(body.scan.progress).toBe(0);
    });

    it("returns 403 for viewer role (RBAC)", async () => {
      const { token } = await createTestTenantAndUser({ role: "viewer" });
      const app = getApp();

      const res = await app.inject({
        method: "POST",
        url: "/api/scans",
        headers: { authorization: `Bearer ${token}` },
        payload: {
          frameworks: ["soc2"],
          targets: ["aws"],
        },
      });

      expect(res.statusCode).toBe(403);
    });
  });

  describe("GET /api/scans/:id", () => {
    it("returns scan details by ID", async () => {
      const { token } = await createTestTenantAndUser({ role: "admin" });
      const app = getApp();

      // Create a scan first
      const createRes = await app.inject({
        method: "POST",
        url: "/api/scans",
        headers: { authorization: `Bearer ${token}` },
        payload: {
          frameworks: ["iso27001"],
          targets: ["azure"],
        },
      });

      const scanId = createRes.json().scan.id;

      const res = await app.inject({
        method: "GET",
        url: `/api/scans/${scanId}`,
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().scan.id).toBe(scanId);
      expect(res.json().scan.frameworks).toEqual(["iso27001"]);
    });

    it("returns 404 for non-existent scan", async () => {
      const { token } = await createTestTenantAndUser({ role: "admin" });
      const app = getApp();

      const res = await app.inject({
        method: "GET",
        url: "/api/scans/00000000-0000-0000-0000-000000000000",
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(404);
    });
  });

  describe("POST /api/scans/:id/cancel", () => {
    it("cancels a queued scan", async () => {
      const { token } = await createTestTenantAndUser({ role: "admin" });
      const app = getApp();

      // Create a scan (starts as queued)
      const createRes = await app.inject({
        method: "POST",
        url: "/api/scans",
        headers: { authorization: `Bearer ${token}` },
        payload: {
          frameworks: ["gdpr"],
          targets: ["gcp"],
        },
      });

      const scanId = createRes.json().scan.id;

      const res = await app.inject({
        method: "POST",
        url: `/api/scans/${scanId}/cancel`,
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().scan.status).toBe("cancelled");
      expect(res.json().message).toBe("Scan cancelled.");
    });

    it("returns 400 when cancelling a completed scan", async () => {
      const { token } = await createTestTenantAndUser({ role: "admin" });
      const app = getApp();

      // Create and then complete a scan
      const createRes = await app.inject({
        method: "POST",
        url: "/api/scans",
        headers: { authorization: `Bearer ${token}` },
        payload: {
          frameworks: ["pcidss"],
          targets: ["aws"],
        },
      });

      const scanId = createRes.json().scan.id;

      // Update status to completed via PATCH
      await app.inject({
        method: "PATCH",
        url: `/api/scans/${scanId}`,
        headers: { authorization: `Bearer ${token}` },
        payload: { status: "completed", progress: 100 },
      });

      // Try to cancel
      const res = await app.inject({
        method: "POST",
        url: `/api/scans/${scanId}/cancel`,
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(400);
    });
  });
});
