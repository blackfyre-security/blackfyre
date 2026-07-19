import { describe, it, expect } from "vitest";
import { getApp, createTestTenantAndUser } from "../helpers/setup.js";

/**
 * Cookie-based auth regression tests.
 *
 * The HttpOnly-cookie migration set bf_access_token / bf_refresh_token at
 * login, but the auth plugin only read the Authorization header and the
 * refresh route only read the body — so browser clients (which cannot read
 * HttpOnly cookies) were locked out of every authenticated route. These
 * tests pin the cookie transport end-to-end so it can't regress silently.
 */
describe("Cookie-based authentication", () => {
  it("authenticates a request carrying only the bf_access_token cookie", async () => {
    const app = getApp();
    const t = await createTestTenantAndUser({ email: `cookie-${Date.now()}@test.com` });

    const res = await app.inject({
      method: "GET",
      url: "/api/scans",
      headers: { cookie: `bf_access_token=${encodeURIComponent(t.token)}` },
    });
    expect(res.statusCode).toBe(200);
  });

  it("still rejects a request with neither header nor cookie", async () => {
    const app = getApp();
    const res = await app.inject({ method: "GET", url: "/api/scans" });
    expect(res.statusCode).toBe(401);
  });

  it("rejects a garbage cookie token", async () => {
    const app = getApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/scans",
      headers: { cookie: "bf_access_token=not-a-jwt" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("returns 401 (not 500) for a malformed percent-encoded cookie", async () => {
    const app = getApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/scans",
      headers: { cookie: "bf_access_token=%" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("prefers the Authorization header when both transports are present", async () => {
    const app = getApp();
    const t = await createTestTenantAndUser({ email: `cookie-hdr-${Date.now()}@test.com` });

    const res = await app.inject({
      method: "GET",
      url: "/api/scans",
      headers: {
        authorization: `Bearer ${t.token}`,
        cookie: "bf_access_token=not-a-jwt",
      },
    });
    expect(res.statusCode).toBe(200);
  });

  it("refreshes using only the bf_refresh_token cookie (empty body token)", async () => {
    const app = getApp();
    const email = `cookie-refresh-${Date.now()}@test.com`;
    await createTestTenantAndUser({ email });

    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email, password: "TestPass123!" },
    });
    expect(login.statusCode).toBe(200);

    const setCookies = ([] as string[]).concat(login.headers["set-cookie"] ?? []);
    const refreshCookie = setCookies
      .map((c) => c.split(";")[0])
      .find((c) => c.startsWith("bf_refresh_token="));
    expect(refreshCookie, "login must set the bf_refresh_token cookie").toBeTruthy();

    const res = await app.inject({
      method: "POST",
      url: "/api/auth/refresh",
      headers: { cookie: refreshCookie! },
      payload: {},
    });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).accessToken).toBeTruthy();
  });
});
