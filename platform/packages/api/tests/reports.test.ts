import { describe, it, expect } from "vitest";
import { getApp, createTestTenantAndUser } from "./helpers/setup.js";

describe("Reports CRUD", () => {
  describe("GET /api/reports", () => {
    it("lists reports (empty)", async () => {
      const { token } = await createTestTenantAndUser({ role: "admin" });
      const app = getApp();

      const res = await app.inject({
        method: "GET",
        url: "/api/reports",
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.reports).toBeInstanceOf(Array);
      expect(body.reports).toHaveLength(0);
    });
  });

  describe("POST /api/reports", () => {
    it("creates a new report request", async () => {
      const { token } = await createTestTenantAndUser({ role: "admin" });
      const app = getApp();

      const res = await app.inject({
        method: "POST",
        url: "/api/reports",
        headers: { authorization: `Bearer ${token}` },
        payload: {
          type: "readiness",
          framework: "soc2",
        },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.report.type).toBe("readiness");
      expect(body.report.framework).toBe("soc2");
      expect(body.report.status).toBe("generating");
    });

    it("creates a report without optional framework", async () => {
      const { token } = await createTestTenantAndUser({ role: "admin" });
      const app = getApp();

      const res = await app.inject({
        method: "POST",
        url: "/api/reports",
        headers: { authorization: `Bearer ${token}` },
        payload: {
          type: "board_summary",
        },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.report.type).toBe("board_summary");
      expect(body.report.framework).toBeNull();
    });

    it("returns 403 for viewer role", async () => {
      const { token } = await createTestTenantAndUser({ role: "viewer" });
      const app = getApp();

      const res = await app.inject({
        method: "POST",
        url: "/api/reports",
        headers: { authorization: `Bearer ${token}` },
        payload: {
          type: "readiness",
        },
      });

      expect(res.statusCode).toBe(403);
    });
  });

  describe("GET /api/reports/:id", () => {
    it("returns 404 for non-existent report", async () => {
      const { token } = await createTestTenantAndUser({ role: "admin" });
      const app = getApp();

      const res = await app.inject({
        method: "GET",
        url: "/api/reports/00000000-0000-0000-0000-000000000000",
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(404);
    });
  });

  describe("GET /api/reports/:id/download", () => {
    it("returns 404 for non-existent report", async () => {
      const { token } = await createTestTenantAndUser({ role: "admin" });
      const app = getApp();

      const res = await app.inject({
        method: "GET",
        url: "/api/reports/00000000-0000-0000-0000-000000000000/download",
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(404);
    });
  });
});
