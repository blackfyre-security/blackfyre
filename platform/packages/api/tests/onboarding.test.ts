import { describe, it, expect } from "vitest";
import { getApp, createTestTenantAndUser } from "./helpers/setup.js";

describe("Onboarding endpoints", () => {
  describe("GET /api/onboarding/status", () => {
    it("returns step1Complete=false for fresh tenant", async () => {
      const { token } = await createTestTenantAndUser();
      const app = getApp();

      const res = await app.inject({
        method: "GET",
        url: "/api/onboarding/status",
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.step1Complete).toBe(false);
      expect(body.primarySpoc).toBeNull();
    });

    it("returns 401 without auth", async () => {
      const app = getApp();
      const res = await app.inject({
        method: "GET",
        url: "/api/onboarding/status",
      });
      expect(res.statusCode).toBe(401);
    });
  });

  describe("POST /api/onboarding/step-1", () => {
    const step1Payload = {
      legalName: "Acme Cloud Services Pvt. Ltd.",
      displayName: "Acme",
      websiteUrl: "https://acme.com",
      region: "us-east-1",
      primarySpoc: {
        name: "Priya Iyer",
        email: "priya@acme.com",
        phone: "+91 98000 12345",
        timezone: "Asia/Kolkata",
      },
      billingContact: {
        name: "Bilbo Baggins",
        email: "billing@acme.com",
      },
      tosAccepted: true,
      tosVersion: "2026-05-v1",
      dpaSigned: true,
      dpaSignerName: "Acme Legal",
      dpaSignerEmail: "legal@acme.com",
    };

    it("provisions a clientNumber and primary SPOC", async () => {
      const { token } = await createTestTenantAndUser();
      const app = getApp();

      const res = await app.inject({
        method: "POST",
        url: "/api/onboarding/step-1",
        headers: { authorization: `Bearer ${token}` },
        payload: step1Payload,
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.ok).toBe(true);
      expect(body.tenant.clientNumber).toMatch(/^BF-\d{4}-\d{6}$/);
      expect(body.tenant.legalName).toBe(step1Payload.legalName);
      expect(body.nextStep).toContain("step-2");
    });

    it("is idempotent — re-submitting does not generate a new clientNumber", async () => {
      const { token } = await createTestTenantAndUser();
      const app = getApp();

      const first = await app.inject({
        method: "POST",
        url: "/api/onboarding/step-1",
        headers: { authorization: `Bearer ${token}` },
        payload: step1Payload,
      });
      const firstClient = first.json().tenant.clientNumber;

      const second = await app.inject({
        method: "POST",
        url: "/api/onboarding/step-1",
        headers: { authorization: `Bearer ${token}` },
        payload: { ...step1Payload, displayName: "Acme Renamed" },
      });

      expect(second.statusCode).toBe(200);
      expect(second.json().tenant.clientNumber).toBe(firstClient);
      expect(second.json().tenant.displayName).toBe("Acme Renamed");
    });

    it("rejects payload missing tosAccepted", async () => {
      const { token } = await createTestTenantAndUser();
      const app = getApp();

      const res = await app.inject({
        method: "POST",
        url: "/api/onboarding/step-1",
        headers: { authorization: `Bearer ${token}` },
        payload: { ...step1Payload, tosAccepted: false },
      });

      expect(res.statusCode).toBe(400);
    });

    it("rejects non-admin roles", async () => {
      const { token } = await createTestTenantAndUser({ role: "viewer" });
      const app = getApp();

      const res = await app.inject({
        method: "POST",
        url: "/api/onboarding/step-1",
        headers: { authorization: `Bearer ${token}` },
        payload: step1Payload,
      });

      expect(res.statusCode).toBe(403);
    });
  });
});
