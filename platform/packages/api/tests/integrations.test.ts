import { describe, it, expect } from "vitest";
import { getApp, createTestTenantAndUser } from "./helpers/setup.js";
import postgres from "postgres";

const TEST_DB_URL = process.env.DATABASE_URL || "postgres://blackfyre:blackfyre_dev@localhost:5432/blackfyre";

/** Helper: insert an integration directly into the DB for a given tenant */
async function createTestIntegration(tenantId: string) {
  const sql = postgres(TEST_DB_URL);
  const [integration] = await sql`
    INSERT INTO integrations (tenant_id, type, credential_ref, status)
    VALUES (${tenantId}, 'aws', 'arn:aws:secretsmanager:us-east-1:123456:secret:test', 'active')
    RETURNING *
  `;
  await sql.end();
  return integration;
}

describe("Integration CRUD", () => {
  describe("GET /api/integrations", () => {
    it("lists integrations for authenticated users", async () => {
      const { token, tenant } = await createTestTenantAndUser({ role: "admin" });
      await createTestIntegration(tenant.id);
      const app = getApp();

      const res = await app.inject({
        method: "GET",
        url: "/api/integrations",
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().integrations).toBeInstanceOf(Array);
      expect(res.json().integrations.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("POST /api/integrations", () => {
    it("creates a new integration", async () => {
      const { token } = await createTestTenantAndUser({ role: "admin" });
      const app = getApp();

      const res = await app.inject({
        method: "POST",
        url: "/api/integrations",
        headers: { authorization: `Bearer ${token}` },
        payload: {
          type: "aws",
          credentialRef: "arn:aws:secretsmanager:us-east-1:123456:secret:prod-creds",
        },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.integration.type).toBe("aws");
      expect(body.integration.credentialRef).toBe(
        "arn:aws:secretsmanager:us-east-1:123456:secret:prod-creds",
      );
      expect(body.integration.status).toBe("active");
    });

    it("allows engineer role to create", async () => {
      const { token } = await createTestTenantAndUser({ role: "engineer" });
      const app = getApp();

      const res = await app.inject({
        method: "POST",
        url: "/api/integrations",
        headers: { authorization: `Bearer ${token}` },
        payload: {
          type: "gcp",
          credentialRef: "projects/my-project/secrets/gcp-creds/versions/latest",
        },
      });

      expect(res.statusCode).toBe(201);
    });
  });

  describe("GET /api/integrations/:id", () => {
    it("returns integration details", async () => {
      const { token, tenant } = await createTestTenantAndUser({ role: "admin" });
      const integration = await createTestIntegration(tenant.id);
      const app = getApp();

      const res = await app.inject({
        method: "GET",
        url: `/api/integrations/${integration.id}`,
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().integration.id).toBe(integration.id);
    });

    it("returns 404 for non-existent integration", async () => {
      const { token } = await createTestTenantAndUser({ role: "admin" });
      const app = getApp();

      const res = await app.inject({
        method: "GET",
        url: "/api/integrations/00000000-0000-0000-0000-000000000000",
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(404);
    });
  });

  describe("PATCH /api/integrations/:id", () => {
    it("updates integration fields", async () => {
      const { token, tenant } = await createTestTenantAndUser({ role: "admin" });
      const integration = await createTestIntegration(tenant.id);
      const app = getApp();

      const res = await app.inject({
        method: "PATCH",
        url: `/api/integrations/${integration.id}`,
        headers: { authorization: `Bearer ${token}` },
        payload: { status: "error" },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().integration.status).toBe("error");
    });

    it("returns 400 for empty update", async () => {
      const { token, tenant } = await createTestTenantAndUser({ role: "admin" });
      const integration = await createTestIntegration(tenant.id);
      const app = getApp();

      const res = await app.inject({
        method: "PATCH",
        url: `/api/integrations/${integration.id}`,
        headers: { authorization: `Bearer ${token}` },
        payload: {},
      });

      expect(res.statusCode).toBe(400);
    });
  });

  describe("DELETE /api/integrations/:id", () => {
    it("removes the integration", async () => {
      const { token, tenant } = await createTestTenantAndUser({ role: "admin" });
      const integration = await createTestIntegration(tenant.id);
      const app = getApp();

      const res = await app.inject({
        method: "DELETE",
        url: `/api/integrations/${integration.id}`,
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().message).toBe("Integration removed.");

      // Verify it is actually gone
      const getRes = await app.inject({
        method: "GET",
        url: `/api/integrations/${integration.id}`,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(getRes.statusCode).toBe(404);
    });
  });

  describe("RBAC", () => {
    it("returns 403 when viewer tries to create integration", async () => {
      const { token } = await createTestTenantAndUser({ role: "viewer" });
      const app = getApp();

      const res = await app.inject({
        method: "POST",
        url: "/api/integrations",
        headers: { authorization: `Bearer ${token}` },
        payload: {
          type: "aws",
          credentialRef: "arn:aws:secretsmanager:us-east-1:123456:secret:creds",
        },
      });

      expect(res.statusCode).toBe(403);
    });

    it("returns 403 when viewer tries to delete integration", async () => {
      const { token, tenant } = await createTestTenantAndUser({ role: "viewer" });
      const integration = await createTestIntegration(tenant.id);
      const app = getApp();

      const res = await app.inject({
        method: "DELETE",
        url: `/api/integrations/${integration.id}`,
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(403);
    });
  });

  describe("POST /api/integrations/:id/verify", () => {
    it("verifies integration credentials", async () => {
      const { token, tenant } = await createTestTenantAndUser({ role: "admin" });
      const integration = await createTestIntegration(tenant.id);
      const app = getApp();

      const res = await app.inject({
        method: "POST",
        url: `/api/integrations/${integration.id}/verify`,
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().message).toBe("Credential verification successful.");
      expect(res.json().integration.status).toBe("active");
      expect(res.json().integration.lastVerifiedAt).toBeTruthy();
    });

    it("returns 404 for non-existent integration", async () => {
      const { token } = await createTestTenantAndUser({ role: "admin" });
      const app = getApp();

      const res = await app.inject({
        method: "POST",
        url: "/api/integrations/00000000-0000-0000-0000-000000000000/verify",
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(404);
    });
  });
});
