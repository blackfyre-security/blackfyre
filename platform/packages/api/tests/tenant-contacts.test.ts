import { describe, it, expect } from "vitest";
import { getApp, createTestTenantAndUser } from "./helpers/setup.js";

describe("Tenant contacts endpoints", () => {
  const basePayload = {
    role: "billing" as const,
    name: "Bilbo Baggins",
    email: "billing@acme.com",
    phone: "+91 90000 11111",
    timezone: "Asia/Kolkata",
    isPrimary: true,
  };

  describe("POST /api/tenant-contacts", () => {
    it("creates a new contact", async () => {
      const { token } = await createTestTenantAndUser();
      const app = getApp();

      const res = await app.inject({
        method: "POST",
        url: "/api/tenant-contacts",
        headers: { authorization: `Bearer ${token}` },
        payload: basePayload,
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.contact.email).toBe(basePayload.email);
      expect(body.contact.role).toBe("billing");
      expect(body.contact.isPrimary).toBe(true);
    });

    it("auto-demotes existing primary when promoting a new one for same role", async () => {
      const { token } = await createTestTenantAndUser();
      const app = getApp();

      const first = await app.inject({
        method: "POST",
        url: "/api/tenant-contacts",
        headers: { authorization: `Bearer ${token}` },
        payload: basePayload,
      });
      const firstId = first.json().contact.id;

      await app.inject({
        method: "POST",
        url: "/api/tenant-contacts",
        headers: { authorization: `Bearer ${token}` },
        payload: {
          ...basePayload,
          email: "billing2@acme.com",
          name: "Frodo Baggins",
          isPrimary: true,
        },
      });

      const list = await app.inject({
        method: "GET",
        url: "/api/tenant-contacts",
        headers: { authorization: `Bearer ${token}` },
      });

      const contacts = list.json().contacts;
      const firstAfter = contacts.find((c: any) => c.id === firstId);
      expect(firstAfter.isPrimary).toBe(false);
      const primaries = contacts.filter((c: any) => c.role === "billing" && c.isPrimary === true);
      expect(primaries).toHaveLength(1);
    });

    it("rejects invalid email", async () => {
      const { token } = await createTestTenantAndUser();
      const app = getApp();

      const res = await app.inject({
        method: "POST",
        url: "/api/tenant-contacts",
        headers: { authorization: `Bearer ${token}` },
        payload: { ...basePayload, email: "not-an-email" },
      });

      expect(res.statusCode).toBe(400);
    });

    it("rejects viewer role", async () => {
      const { token } = await createTestTenantAndUser({ role: "viewer" });
      const app = getApp();

      const res = await app.inject({
        method: "POST",
        url: "/api/tenant-contacts",
        headers: { authorization: `Bearer ${token}` },
        payload: basePayload,
      });

      expect(res.statusCode).toBe(403);
    });
  });

  describe("DELETE /api/tenant-contacts/:id", () => {
    it("soft-deletes a non-primary-SPOC contact", async () => {
      const { token } = await createTestTenantAndUser();
      const app = getApp();

      const create = await app.inject({
        method: "POST",
        url: "/api/tenant-contacts",
        headers: { authorization: `Bearer ${token}` },
        payload: basePayload,
      });
      const id = create.json().contact.id;

      const del = await app.inject({
        method: "DELETE",
        url: `/api/tenant-contacts/${id}`,
        headers: { authorization: `Bearer ${token}` },
      });

      expect(del.statusCode).toBe(204);
    });

    it("blocks deleting a primary_spoc that is the active primary", async () => {
      const { token } = await createTestTenantAndUser();
      const app = getApp();

      const create = await app.inject({
        method: "POST",
        url: "/api/tenant-contacts",
        headers: { authorization: `Bearer ${token}` },
        payload: {
          ...basePayload,
          role: "primary_spoc",
          email: "spoc@acme.com",
          isPrimary: true,
        },
      });
      const id = create.json().contact.id;

      const del = await app.inject({
        method: "DELETE",
        url: `/api/tenant-contacts/${id}`,
        headers: { authorization: `Bearer ${token}` },
      });

      expect(del.statusCode).toBe(400);
      expect(del.json().error.code).toBe("primary_spoc_protected");
    });
  });
});
