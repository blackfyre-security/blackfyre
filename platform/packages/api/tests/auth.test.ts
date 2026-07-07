import { describe, it, expect } from "vitest";
import { getApp, createTestTenantAndUser } from "./helpers/setup.js";

describe("Auth endpoints", () => {
  describe("POST /api/auth/login", () => {
    it("returns tokens for valid credentials", async () => {
      const { email, password } = await createTestTenantAndUser();
      const app = getApp();

      const res = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: { email, password },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.accessToken).toBeDefined();
      expect(body.refreshToken).toBeDefined();
      expect(body.user.email).toBe(email);
    });

    it("returns 401 for wrong password", async () => {
      const { email } = await createTestTenantAndUser();
      const app = getApp();

      const res = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: { email, password: "WrongPass999!" },
      });

      expect(res.statusCode).toBe(401);
    });

    it("returns 401 for non-existent email", async () => {
      const app = getApp();

      const res = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: { email: "nobody@example.com", password: "Whatever1!" },
      });

      expect(res.statusCode).toBe(401);
    });
  });

  describe("POST /api/auth/refresh", () => {
    it("returns new token pair for valid refresh token", async () => {
      const { email, password } = await createTestTenantAndUser();
      const app = getApp();

      // Login first
      const loginRes = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: { email, password },
      });
      const { refreshToken } = loginRes.json();

      // Refresh
      const res = await app.inject({
        method: "POST",
        url: "/api/auth/refresh",
        payload: { refreshToken },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.accessToken).toBeDefined();
      expect(body.refreshToken).toBeDefined();
    });

    it("returns 401 for invalid refresh token", async () => {
      const app = getApp();

      const res = await app.inject({
        method: "POST",
        url: "/api/auth/refresh",
        payload: { refreshToken: "garbage-token" },
      });

      expect(res.statusCode).toBe(401);
    });
  });

  describe("POST /api/auth/api-key", () => {
    it("generates API key for authenticated user", async () => {
      const { token } = await createTestTenantAndUser();
      const app = getApp();

      const res = await app.inject({
        method: "POST",
        url: "/api/auth/api-key",
        headers: { authorization: `Bearer ${token}` },
        payload: { name: "CI/CD Key" },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.key).toMatch(/^bfk_/);
      expect(body.name).toBe("CI/CD Key");
    });

    it("returns 401 without auth", async () => {
      const app = getApp();

      const res = await app.inject({
        method: "POST",
        url: "/api/auth/api-key",
        payload: { name: "Test" },
      });

      expect(res.statusCode).toBe(401);
    });
  });
});
