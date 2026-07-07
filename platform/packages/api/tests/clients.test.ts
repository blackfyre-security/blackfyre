import { describe, it, expect } from "vitest";
import { getApp, createTestTenantAndUser } from "./helpers/setup.js";

describe("Client (Tenant) CRUD", () => {
  describe("GET /api/clients", () => {
    it("lists clients for admin users", async () => {
      const { token } = await createTestTenantAndUser({ role: "admin" });
      const app = getApp();

      const res = await app.inject({
        method: "GET",
        url: "/api/clients",
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().clients).toBeInstanceOf(Array);
    });

    it("returns 403 for viewer role", async () => {
      const { token } = await createTestTenantAndUser({ role: "viewer" });
      const app = getApp();

      const res = await app.inject({
        method: "GET",
        url: "/api/clients",
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(403);
    });
  });

  describe("POST /api/clients", () => {
    it("creates a new client", async () => {
      const { token } = await createTestTenantAndUser({ role: "admin" });
      const app = getApp();

      const res = await app.inject({
        method: "POST",
        url: "/api/clients",
        headers: { authorization: `Bearer ${token}` },
        payload: {
          name: "Acme Corp",
          slug: "acme-corp",
          plan: "retainer",
          industryProfile: "fintech",
        },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.client.name).toBe("Acme Corp");
      expect(body.client.slug).toBe("acme-corp");
      expect(body.client.onboardingStatus).toBe("pending");
    });

    it("returns 409 for duplicate slug", async () => {
      const { token } = await createTestTenantAndUser({ role: "admin" });
      const app = getApp();

      // Create first
      await app.inject({
        method: "POST",
        url: "/api/clients",
        headers: { authorization: `Bearer ${token}` },
        payload: { name: "First", slug: "dup-slug", plan: "project", industryProfile: "saas" },
      });

      // Try duplicate
      const res = await app.inject({
        method: "POST",
        url: "/api/clients",
        headers: { authorization: `Bearer ${token}` },
        payload: { name: "Second", slug: "dup-slug", plan: "hourly", industryProfile: "saas" },
      });

      expect(res.statusCode).toBe(409);
    });
  });

  describe("GET /api/clients/:id", () => {
    it("returns client details", async () => {
      const { token, tenant } = await createTestTenantAndUser({ role: "admin" });
      const app = getApp();

      const res = await app.inject({
        method: "GET",
        url: `/api/clients/${tenant.id}`,
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().client.id).toBe(tenant.id);
    });

    it("returns 404 for non-existent client", async () => {
      const { token } = await createTestTenantAndUser({ role: "admin" });
      const app = getApp();

      const res = await app.inject({
        method: "GET",
        url: "/api/clients/00000000-0000-0000-0000-000000000000",
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(404);
    });
  });

  describe("PATCH /api/clients/:id", () => {
    it("updates client fields", async () => {
      const { token, tenant } = await createTestTenantAndUser({ role: "admin" });
      const app = getApp();

      const res = await app.inject({
        method: "PATCH",
        url: `/api/clients/${tenant.id}`,
        headers: { authorization: `Bearer ${token}` },
        payload: { name: "Updated Corp" },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().client.name).toBe("Updated Corp");
    });
  });

  describe("DELETE /api/clients/:id", () => {
    it("suspends client (soft delete)", async () => {
      const { token, tenant } = await createTestTenantAndUser({ role: "admin" });
      const app = getApp();

      const res = await app.inject({
        method: "DELETE",
        url: `/api/clients/${tenant.id}`,
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().client.onboardingStatus).toBe("suspended");
    });
  });

  describe("POST /api/clients/:id/onboard", () => {
    it("transitions from pending to configuring", async () => {
      const { token, tenant } = await createTestTenantAndUser({ role: "admin" });
      const app = getApp();

      const res = await app.inject({
        method: "POST",
        url: `/api/clients/${tenant.id}/onboard`,
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().client.onboardingStatus).toBe("configuring");
    });

    it("returns 400 if client is not in pending state", async () => {
      const { token, tenant } = await createTestTenantAndUser({ role: "admin" });
      const app = getApp();

      // First onboard (pending → configuring)
      await app.inject({
        method: "POST",
        url: `/api/clients/${tenant.id}/onboard`,
        headers: { authorization: `Bearer ${token}` },
      });

      // Try again (configuring → should fail)
      const res = await app.inject({
        method: "POST",
        url: `/api/clients/${tenant.id}/onboard`,
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(400);
    });
  });
});
