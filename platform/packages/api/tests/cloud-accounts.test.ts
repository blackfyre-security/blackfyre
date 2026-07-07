import { describe, it, expect } from "vitest";
import { getApp, createTestTenantAndUser } from "./helpers/setup.js";

describe("Cloud accounts endpoints", () => {
  describe("POST /api/cloud-accounts/aws/init", () => {
    it("issues a per-tenant externalId and trust policy", async () => {
      const { token } = await createTestTenantAndUser();
      const app = getApp();

      const res = await app.inject({
        method: "POST",
        url: "/api/cloud-accounts/aws/init",
        headers: { authorization: `Bearer ${token}` },
        payload: {
          accountId: "123456789012",
          accountAlias: "Production · Mumbai",
          regions: ["us-east-1", "ap-south-1"],
        },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.cloudAccount.accountId).toBe("123456789012");
      expect(body.cloudAccount.externalId).toMatch(/^bfyr-/);
      expect(body.cloudAccount.status).toBe("pending");
      expect(body.trustPolicy.Statement[0].Condition.StringEquals["sts:ExternalId"]).toBe(
        body.cloudAccount.externalId,
      );
      expect(body.instructions.manualSteps).toBeInstanceOf(Array);
    });

    it("rejects malformed account IDs", async () => {
      const { token } = await createTestTenantAndUser();
      const app = getApp();

      const res = await app.inject({
        method: "POST",
        url: "/api/cloud-accounts/aws/init",
        headers: { authorization: `Bearer ${token}` },
        payload: { accountId: "12345", regions: ["us-east-1"] },
      });

      expect(res.statusCode).toBe(400);
    });

    it("requires at least one region", async () => {
      const { token } = await createTestTenantAndUser();
      const app = getApp();

      const res = await app.inject({
        method: "POST",
        url: "/api/cloud-accounts/aws/init",
        headers: { authorization: `Bearer ${token}` },
        payload: { accountId: "123456789012", regions: [] },
      });

      expect(res.statusCode).toBe(400);
    });

    it("rejects viewer role", async () => {
      const { token } = await createTestTenantAndUser({ role: "viewer" });
      const app = getApp();

      const res = await app.inject({
        method: "POST",
        url: "/api/cloud-accounts/aws/init",
        headers: { authorization: `Bearer ${token}` },
        payload: { accountId: "123456789012", regions: ["us-east-1"] },
      });

      expect(res.statusCode).toBe(403);
    });

    it("returns the same record on repeat init for same account (idempotent until verified)", async () => {
      const { token } = await createTestTenantAndUser();
      const app = getApp();
      const payload = { accountId: "123456789012", regions: ["us-east-1"] };

      const a = await app.inject({
        method: "POST",
        url: "/api/cloud-accounts/aws/init",
        headers: { authorization: `Bearer ${token}` },
        payload,
      });
      const b = await app.inject({
        method: "POST",
        url: "/api/cloud-accounts/aws/init",
        headers: { authorization: `Bearer ${token}` },
        payload,
      });

      expect(a.json().cloudAccount.id).toBe(b.json().cloudAccount.id);
      expect(a.json().cloudAccount.externalId).toBe(b.json().cloudAccount.externalId);
    });
  });

  describe("POST /api/cloud-accounts/aws/verify", () => {
    it("rejects an invalid role ARN format without calling STS", async () => {
      const { token } = await createTestTenantAndUser();
      const app = getApp();

      const init = await app.inject({
        method: "POST",
        url: "/api/cloud-accounts/aws/init",
        headers: { authorization: `Bearer ${token}` },
        payload: { accountId: "123456789012", regions: ["us-east-1"] },
      });
      const cloudAccountId = init.json().cloudAccount.id;

      const res = await app.inject({
        method: "POST",
        url: "/api/cloud-accounts/aws/verify",
        headers: { authorization: `Bearer ${token}` },
        payload: {
          cloudAccountId,
          roleArn: "not-an-arn",
        },
      });

      expect(res.statusCode).toBe(400);
    });

    it("returns 404 for unknown cloudAccountId", async () => {
      const { token } = await createTestTenantAndUser();
      const app = getApp();

      const res = await app.inject({
        method: "POST",
        url: "/api/cloud-accounts/aws/verify",
        headers: { authorization: `Bearer ${token}` },
        payload: {
          cloudAccountId: "00000000-0000-0000-0000-000000000000",
          roleArn: "arn:aws:iam::123456789012:role/BlackfyreReadOnlyRole",
        },
      });

      expect(res.statusCode).toBe(404);
    });
  });

  describe("GET /api/cloud-accounts", () => {
    it("lists tenant's cloud accounts", async () => {
      const { token } = await createTestTenantAndUser();
      const app = getApp();

      await app.inject({
        method: "POST",
        url: "/api/cloud-accounts/aws/init",
        headers: { authorization: `Bearer ${token}` },
        payload: { accountId: "123456789012", regions: ["us-east-1"] },
      });

      const res = await app.inject({
        method: "GET",
        url: "/api/cloud-accounts",
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.total).toBe(1);
      expect(body.cloudAccounts[0].accountId).toBe("123456789012");
    });
  });
});
