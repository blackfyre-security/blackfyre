import { describe, it, expect } from "vitest";
import { getApp } from "./helpers/setup.js";

describe("GET /health", () => {
  it("returns healthy status with checks", async () => {
    const app = getApp();
    const res = await app.inject({ method: "GET", url: "/health" });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toMatch(/^(healthy|degraded)$/);
    expect(body.version).toBe("0.1.0");
    expect(body.uptime).toBeTypeOf("number");
    expect(body.checks).toBeDefined();
    expect(body.checks.database).toBeDefined();
    expect(body.checks.redis).toBeDefined();
    expect(body.timestamp).toBeDefined();
  });

  it("includes security headers", async () => {
    const app = getApp();
    const res = await app.inject({ method: "GET", url: "/health" });

    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-frame-options"]).toBe("DENY");
    expect(res.headers["x-xss-protection"]).toBe("0");
    expect(res.headers["strict-transport-security"]).toBe(
      "max-age=31536000; includeSubDomains; preload",
    );
    expect(res.headers["referrer-policy"]).toBe(
      "strict-origin-when-cross-origin",
    );
  });

  it("excludes rate-limit headers on health endpoint", async () => {
    const app = getApp();
    const res = await app.inject({ method: "GET", url: "/health" });

    // Health endpoint bypasses rate limiting intentionally
    expect(res.headers["x-ratelimit-limit"]).toBeUndefined();
  });
});

describe("GET /api/health/live", () => {
  it("returns alive status", async () => {
    const app = getApp();
    const res = await app.inject({ method: "GET", url: "/api/health/live" });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe("alive");
  });
});

describe("GET /api/health/ready", () => {
  it("returns readiness status", async () => {
    const app = getApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/health/ready",
    });

    // May be 200 or 503 depending on DB connectivity in test env
    const body = res.json();
    expect(body.status).toMatch(/^(ready|not_ready)$/);
  });
});
