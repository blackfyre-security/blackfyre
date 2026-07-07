import { describe, it, expect } from "vitest";
import { getApp, createTestTenantAndUser } from "./helpers/setup.js";

describe("Findings CRUD", () => {
  describe("GET /api/findings", () => {
    it("lists findings (empty)", async () => {
      const { token } = await createTestTenantAndUser({ role: "admin" });
      const app = getApp();

      const res = await app.inject({
        method: "GET",
        url: "/api/findings",
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.findings).toBeInstanceOf(Array);
      expect(body.findings).toHaveLength(0);
      expect(body.pagination).toBeDefined();
      expect(body.pagination.total).toBe(0);
    });

    it("returns 403 for unauthenticated requests", async () => {
      const app = getApp();

      const res = await app.inject({
        method: "GET",
        url: "/api/findings",
      });

      expect(res.statusCode).toBe(401);
    });
  });

  describe("GET /api/findings/:id", () => {
    it("returns 404 for non-existent finding", async () => {
      const { token } = await createTestTenantAndUser({ role: "admin" });
      const app = getApp();

      const res = await app.inject({
        method: "GET",
        url: "/api/findings/00000000-0000-0000-0000-000000000000",
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(404);
    });
  });

  describe("PATCH /api/findings/:id/status", () => {
    it("returns 404 when updating non-existent finding", async () => {
      const { token } = await createTestTenantAndUser({ role: "admin" });
      const app = getApp();

      const res = await app.inject({
        method: "PATCH",
        url: "/api/findings/00000000-0000-0000-0000-000000000000/status",
        headers: { authorization: `Bearer ${token}` },
        payload: { status: "acknowledged" },
      });

      expect(res.statusCode).toBe(404);
    });

    it("returns 403 for viewer role", async () => {
      const { token } = await createTestTenantAndUser({ role: "viewer" });
      const app = getApp();

      const res = await app.inject({
        method: "PATCH",
        url: "/api/findings/00000000-0000-0000-0000-000000000000/status",
        headers: { authorization: `Bearer ${token}` },
        payload: { status: "acknowledged" },
      });

      expect(res.statusCode).toBe(403);
    });
  });

  describe("GET /api/findings/summary", () => {
    it("returns empty summary", async () => {
      const { token } = await createTestTenantAndUser({ role: "admin" });
      const app = getApp();

      const res = await app.inject({
        method: "GET",
        url: "/api/findings/summary",
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.bySeverity).toBeInstanceOf(Array);
      expect(body.byStatus).toBeInstanceOf(Array);
    });
  });
});
