// REAL IMPL (BLACKFYRE 2026-06): security-regression unit suite. Locks the audit
// fixes already applied (2026-06-05) so they cannot silently regress. These tests
// exercise the REAL plugins/routes against a minimal real Fastify instance with
// only the external dependency decorators mocked (superDb / appSql / redis /
// config) — behavioural assertions, not source-string greps, so the controls are
// pinned by actual runtime behaviour:
//
//   (a) JWT verification pins HS256 and rejects non-"access" token types  -> plugins/auth.ts
//   (b) password-reset tokens are single-use via jti (issue + consume)    -> routes/auth.ts
//   (c) SSO state validation fails CLOSED (503) when app.redis is null    -> routes/auth.ts
//   (d) the in-memory rate-limit hardening plugin is REGISTERED + enforces -> plugins/rate-limit.ts + app.ts
//
// NOTE on (d): the audited, applied implementation is a custom in-memory sliding-
// window limiter exposed as the `rate-limit` fastify-plugin (see plugins/rate-limit.ts),
// NOT the upstream @fastify/rate-limit package (which is not a dependency of this
// service). We therefore assert the REAL control: that the rate-limit plugin is
// registered in app.ts and that it actually throttles (429) and emits the
// X-RateLimit-* headers. Testing for @fastify/rate-limit would assert a stub that
// does not exist in this codebase.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import Fastify, { type FastifyInstance } from "fastify";
import jwt from "@fastify/jwt";

// REAL IMPL (BLACKFYRE 2026-06): the forgot-password route dynamically imports the
// EmailChannel and calls sendEmail(). We stub ONLY that external SMTP boundary so the
// (b) jti-issuance assertion does not depend on (or attempt) a live SMTP connection.
// The single-use jti control under test is fully exercised against the real route.
vi.mock("../../src/services/channels/email-channel.js", () => ({
  EmailChannel: class {
    sendEmail = vi.fn(async () => {});
  },
}));

import authPlugin from "../../src/plugins/auth.js";
import rateLimitPlugin from "../../src/plugins/rate-limit.js";
import { authRoutes } from "../../src/routes/auth.js";
import { ApiError } from "../../src/utils/errors.js";

// ---------------------------------------------------------------------------
// Shared test fixtures
// ---------------------------------------------------------------------------
const JWT_SECRET = "test-secret-that-is-at-least-32-characters-long-for-tests"; // gitleaks:allow

const baseConfig = {
  JWT_SECRET,
  JWT_EXPIRES_IN: "15m",
  JWT_REFRESH_EXPIRES_IN: "7d",
  // SSO intentionally configured so the *callback* reaches state validation
  // (the fail-closed branch we are pinning) before any provider check.
  GOOGLE_CLIENT_ID: "test-google-client-id",
  GOOGLE_CLIENT_SECRET: "test-google-client-secret",
  GOOGLE_REDIRECT_URI: "http://localhost:3001/auth/google/callback",
  SMTP_HOST: "localhost",
  SMTP_PORT: 1025,
  SMTP_USER: "",
  SMTP_PASS: "",
  SMTP_FROM: "noreply@blackfyre.test",
};

/**
 * A drizzle-style chainable mock: every method returns the same chain and the
 * chain is awaitable (thenable), resolving to `result`. Covers
 * select().from().where().limit(), update().set().where(), delete().where(), etc.
 */
function chainable(result: unknown = []) {
  const chain: any = new Proxy(
    {},
    {
      get(_t, prop) {
        if (prop === "then") {
          return (resolve: (v: unknown) => void) => resolve(result);
        }
        // Any chain method (from/where/set/values/limit/insert/update/delete...)
        // returns the chain so the call sequence keeps composing.
        return () => chain;
      },
    },
  );
  return chain;
}

/** Mock app.superDb whose select/update/delete chains resolve to `selectResult`. */
function makeSuperDb(selectResult: unknown[] = []) {
  return {
    select: vi.fn(() => chainable(selectResult)),
    insert: vi.fn(() => chainable([])),
    update: vi.fn(() => chainable([])),
    delete: vi.fn(() => chainable([])),
  };
}

/**
 * Mock app.appSql.reserve() returning a fake reserved connection (tagged-template).
 * `options.parsers/serializers` are present because drizzle(conn) (called by the REAL
 * populateTenantContext) writes type parsers onto client.options — without them the
 * driver throws and authenticate() would mis-report a generic 401.
 */
function makeAppSql() {
  const conn: any = vi.fn(async () => []); // tagged-template call resolves OK
  conn.release = vi.fn();
  conn.options = { parsers: {}, serializers: {} };
  return {
    reserve: vi.fn(async () => conn),
  };
}

/**
 * Build a minimal real Fastify app with the REAL auth plugin registered and a
 * tiny protected route guarded by the real requireRole(). External deps are
 * mocked decorators only.
 */
async function buildAuthApp(opts?: {
  redis?: unknown;
  superDb?: ReturnType<typeof makeSuperDb>;
}): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });

  app.decorate("config", { ...baseConfig } as any);
  app.decorate("superDb", (opts?.superDb ?? makeSuperDb([{ role: "admin" }])) as any);
  app.decorate("appSql", makeAppSql() as any);
  app.decorate("redis", (opts?.redis ?? null) as any);

  await app.register(authPlugin);

  // Real requireRole guard exercises authenticate(): jwtVerify (algorithm pin)
  // + the access-token-type enforcement, before any handler body runs.
  app.get(
    "/protected",
    { preHandler: (app as any).requireRole("admin") },
    async () => ({ ok: true }),
  );

  await app.ready();
  return app;
}

/**
 * Build a minimal real Fastify app with @fastify/jwt + the REAL authRoutes,
 * for exercising SSO state + password-reset jti behaviour without a DB.
 */
async function buildRoutesApp(opts?: {
  redis?: unknown;
  superDb?: ReturnType<typeof makeSuperDb>;
}): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });

  app.decorate("config", { ...baseConfig } as any);
  app.decorate("superDb", (opts?.superDb ?? makeSuperDb([])) as any);
  app.decorate("redis", (opts?.redis ?? null) as any);
  // authRoutes references these decorators at REGISTRATION time (mfa/setup,
  // mfa/confirm and api-key routes wire `app.authenticate` into their preHandler
  // and `app.db` into their handler closures). They are never invoked by the
  // SSO / reset-password paths under test, but must be present or route
  // registration throws ("preHandler hook should be a function"). The stub
  // authenticate is intentionally inert — none of the asserted endpoints use it.
  app.decorate("authenticate", (async () => {}) as any);
  app.decorate("appSql", makeAppSql() as any);
  app.decorate("db", makeSuperDb([]) as any);
  // requestId is referenced by some error responses in the route module.
  app.addHook("onRequest", async (req) => {
    (req as any).requestId = "test-request-id";
  });

  // Mirror app.ts's real error handler so we assert the REAL client-facing
  // envelope `{ success:false, error:{ code, message } }` that the audited routes
  // contractually emit (badRequest -> ApiError), plus the fail-closed plain errors
  // (Object.assign(new Error(), { statusCode: 503, code }) from requireRedis et al.).
  // Without this, Fastify's default serializer would flatten the body and the
  // error.code assertions could not pin the control's response shape.
  app.setErrorHandler((error: any, request, reply) => {
    const base = { requestId: (request as any).requestId, timestamp: new Date().toISOString() };
    if (error instanceof ApiError) {
      return reply.status(error.statusCode).send({
        success: false,
        error: { code: error.code, message: error.message, details: error.details, ...base },
      });
    }
    // Plain errors carrying a statusCode (fail-closed 503s, MFA_LOCKED 429s, ...).
    if (typeof error.statusCode === "number" && error.statusCode >= 400) {
      return reply.status(error.statusCode).send({
        success: false,
        error: { code: error.code ?? "ERROR", message: error.message, ...base },
      });
    }
    if (error.name === "ZodError" || error.validation) {
      return reply.status(400).send({
        success: false,
        error: { code: "VALIDATION_ERROR", message: error.message, ...base },
      });
    }
    return reply.status(500).send({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred", ...base },
    });
  });

  // authRoutes uses app.jwt.sign / app.jwt.verify directly.
  await app.register(jwt, {
    secret: JWT_SECRET,
    verify: { algorithms: ["HS256"] },
  });
  await app.register(authRoutes);

  await app.ready();
  return app;
}

// ===========================================================================
// (a) JWT verification pins HS256 and rejects non-access token types
// ===========================================================================
describe("(a) plugins/auth.ts — JWT algorithm pinning + token-type enforcement", () => {
  let app: FastifyInstance;

  afterEach(async () => {
    if (app) await app.close();
  });

  it("accepts a valid HS256 access token (positive control)", async () => {
    app = await buildAuthApp({
      redis: { get: vi.fn(), set: vi.fn(), del: vi.fn() },
      // populateTenantContext: tenant plan lookup
      superDb: makeSuperDb([{ plan: "comply" }]),
    });

    // Sign with the plugin's own jwt instance => correct secret + default HS256.
    const token = (app as any).jwt.sign({
      sub: "u-1",
      tenantId: "t-1",
      role: "admin",
      type: "access",
    });

    const res = await app.inject({
      method: "GET",
      url: "/protected",
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
  });

  it("rejects a token signed with a NON-HS256 algorithm (algorithm-confusion guard)", async () => {
    app = await buildAuthApp();

    // Forge a token with the same shared secret but a different HMAC algorithm.
    // If the verifier did not pin algorithms, HS512 would be accepted.
    const jose = await import("jose");
    const forged = await new jose.SignJWT({
      sub: "attacker",
      tenantId: "t-1",
      role: "admin",
      type: "access",
    })
      .setProtectedHeader({ alg: "HS512" })
      .sign(new TextEncoder().encode(JWT_SECRET));

    const res = await app.inject({
      method: "GET",
      url: "/protected",
      headers: { authorization: `Bearer ${forged}` },
    });

    // Pinned to [HS256] => verification fails => generic 401, never the handler body.
    expect(res.statusCode).toBe(401);
    expect(res.json()).not.toHaveProperty("ok");
  });

  it("source pins the verify algorithm to exactly HS256 (no widening)", () => {
    const src = fs.readFileSync(
      path.resolve(__dirname, "../../src/plugins/auth.ts"),
      "utf-8",
    );
    expect(src).toMatch(/JWT_ALGORITHM\s*=\s*"HS256"/);
    expect(src).toMatch(/verify:\s*\{\s*algorithms:\s*\[\s*JWT_ALGORITHM\s*\]/);
    // Guard against an accidental multi-algorithm widening.
    expect(src).not.toMatch(/algorithms:\s*\[[^\]]*,[^\]]*\]/);
  });

  it("rejects a refresh token replayed at a bearer (access-only) endpoint", async () => {
    app = await buildAuthApp();
    const refresh = (app as any).jwt.sign({
      sub: "u-1",
      tenantId: "t-1",
      role: "admin",
      type: "refresh",
    });

    const res = await app.inject({
      method: "GET",
      url: "/protected",
      headers: { authorization: `Bearer ${refresh}` },
    });

    expect(res.statusCode).toBe(401);
    expect(res.json().message).toMatch(/Invalid token type/i);
  });

  it("rejects a password_reset token replayed at a bearer endpoint", async () => {
    app = await buildAuthApp();
    const reset = (app as any).jwt.sign({
      sub: "u-1",
      type: "password_reset",
      jti: "some-jti",
    });

    const res = await app.inject({
      method: "GET",
      url: "/protected",
      headers: { authorization: `Bearer ${reset}` },
    });

    expect(res.statusCode).toBe(401);
    expect(res.json().message).toMatch(/Invalid token type/i);
  });

  it("rejects an mfa_challenge token replayed at a bearer endpoint", async () => {
    app = await buildAuthApp();
    const mfa = (app as any).jwt.sign({
      sub: "u-1",
      tenantId: "t-1",
      role: "admin",
      type: "mfa_challenge",
    });

    const res = await app.inject({
      method: "GET",
      url: "/protected",
      headers: { authorization: `Bearer ${mfa}` },
    });

    expect(res.statusCode).toBe(401);
  });
});

// ===========================================================================
// (b) password-reset tokens are single-use via jti
// ===========================================================================
describe("(b) routes/auth.ts — password-reset tokens are single-use via jti", () => {
  let app: FastifyInstance;

  afterEach(async () => {
    if (app) await app.close();
  });

  function signReset(appInst: FastifyInstance, jti?: string) {
    const payload: Record<string, unknown> = { sub: "u-1", type: "password_reset" };
    if (jti !== undefined) payload.jti = jti;
    return (appInst as any).jwt.sign(payload, { expiresIn: "1h" });
  }

  it("forgot-password stores a single-use jti in redis (pwreset_jti:<jti>) and mints a token carrying it", async () => {
    // (...args) so .mock.calls captures the (key, val, "EX", ttl) the route passes.
    const set = vi.fn(async (..._args: unknown[]) => "OK");
    app = await buildRoutesApp({
      redis: { set, get: vi.fn(), del: vi.fn() },
      // forgot-password looks up the user by email
      superDb: makeSuperDb([{ id: "u-1", email: "user@blackfyre.test" }]),
    });

    const res = await app.inject({
      method: "POST",
      url: "/api/auth/forgot-password",
      payload: { email: "user@blackfyre.test" },
    });

    expect(res.statusCode).toBe(200);
    // jti is written to redis with a TTL == token expiry (single-use binding).
    expect(set).toHaveBeenCalledTimes(1);
    const [key, val, exFlag, ttl] = set.mock.calls[0];
    expect(String(key)).toMatch(/^pwreset_jti:/);
    expect(val).toBe("1");
    expect(exFlag).toBe("EX");
    expect(ttl).toBe(3600);
  });

  it("reset-password CONSUMES the jti (redis.del) — first use deletes exactly that key and succeeds", async () => {
    const del = vi.fn(async (..._args: unknown[]) => 1); // first use: key existed => del returns 1
    const superDb = makeSuperDb([]);
    app = await buildRoutesApp({
      redis: { del, set: vi.fn(), get: vi.fn() },
      superDb,
    });

    const token = signReset(app, "jti-aaa");
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/reset-password",
      payload: { token, password: "NewPassw0rd!" },
    });

    expect(res.statusCode).toBe(200);
    // It deletes the EXACT jti key carried in the token.
    expect(del).toHaveBeenCalledTimes(1);
    expect(String(del.mock.calls[0][0])).toBe("pwreset_jti:jti-aaa");
    // On success the password is updated and refresh tokens are revoked.
    expect(superDb.update).toHaveBeenCalled();
    expect(superDb.delete).toHaveBeenCalled();
  });

  it("reset-password REJECTS a replayed token (redis.del returns 0 => already consumed/unknown)", async () => {
    const del = vi.fn(async () => 0); // replay: key already gone
    const superDb = makeSuperDb([]);
    app = await buildRoutesApp({
      redis: { del, set: vi.fn(), get: vi.fn() },
      superDb,
    });

    const token = signReset(app, "jti-bbb");
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/reset-password",
      payload: { token, password: "NewPassw0rd!" },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe("INVALID_TOKEN");
    // Crucially: a rejected (replayed) token must NOT mutate the password.
    expect(superDb.update).not.toHaveBeenCalled();
  });

  it("reset-password REJECTS a token with no jti (pre-control token => not single-use enforceable)", async () => {
    const del = vi.fn(async () => 0);
    const superDb = makeSuperDb([]);
    app = await buildRoutesApp({
      redis: { del, set: vi.fn(), get: vi.fn() },
      superDb,
    });

    const token = signReset(app); // no jti
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/reset-password",
      payload: { token, password: "NewPassw0rd!" },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe("INVALID_TOKEN");
    // No store consume attempted and no mutation.
    expect(del).not.toHaveBeenCalled();
    expect(superDb.update).not.toHaveBeenCalled();
  });

  it("reset-password FAILS CLOSED (503) when redis is null (cannot verify single-use)", async () => {
    const superDb = makeSuperDb([]);
    app = await buildRoutesApp({ redis: null, superDb });

    const token = signReset(app, "jti-ccc");
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/reset-password",
      payload: { token, password: "NewPassw0rd!" },
    });

    expect(res.statusCode).toBe(503);
    expect(superDb.update).not.toHaveBeenCalled();
  });

  it("source consumes the jti via an atomic redis.del keyed on the token jti", () => {
    const src = fs.readFileSync(
      path.resolve(__dirname, "../../src/routes/auth.ts"),
      "utf-8",
    );
    expect(src).toMatch(/redis\.del\(`pwreset_jti:\$\{decoded\.jti\}`\)/);
    // Only a del that returned exactly 1 is treated as a valid first use.
    expect(src).toMatch(/consumed\s*!==\s*1/);
  });
});

// ===========================================================================
// (c) SSO state validation fails closed when redis is null
// ===========================================================================
describe("(c) routes/auth.ts — SSO state validation fails CLOSED when redis is null", () => {
  let app: FastifyInstance;

  afterEach(async () => {
    if (app) await app.close();
  });

  it("SSO callback (POST /api/auth/sso) returns 503 (not a bypass) when redis is null", async () => {
    app = await buildRoutesApp({ redis: null });

    const res = await app.inject({
      method: "POST",
      url: "/api/auth/sso",
      payload: { provider: "google", code: "auth-code", state: "some-state" },
    });

    // Must DENY (503) — never silently accept the callback by skipping state check.
    expect(res.statusCode).toBe(503);
  });

  it("SSO callback still requires a state param even when reachable", async () => {
    // redis present but irrelevant: missing state must be rejected before lookup.
    app = await buildRoutesApp({
      redis: { get: vi.fn(async () => "1"), del: vi.fn(), set: vi.fn() },
    });

    const res = await app.inject({
      method: "POST",
      url: "/api/auth/sso",
      payload: { provider: "google", code: "auth-code" },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe("SSO_STATE_MISSING");
  });

  it("SSO callback rejects an invalid/expired state (redis.get miss) without proceeding", async () => {
    const get = vi.fn(async (..._args: unknown[]) => null); // state not found
    app = await buildRoutesApp({
      redis: { get, del: vi.fn(), set: vi.fn() },
    });

    const res = await app.inject({
      method: "POST",
      url: "/api/auth/sso",
      payload: { provider: "google", code: "auth-code", state: "bogus-state" },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe("SSO_STATE_INVALID");
    // REAL IMPL (BLACKFYRE 2026-06): the multi-provider OIDC flow looks the state up under
    // sso_oidc_state:<state> first, then falls back to the legacy sso_state:<state> key.
    // The security property under test is that the bogus state IS looked up (no bypass);
    // accept either key.
    expect(get.mock.calls.some((c) => String(c[0]).endsWith(":bogus-state"))).toBe(true);
  });

  it("SSO authorize-URL issue (GET /api/auth/sso/google/url) refuses (503) when redis is null", async () => {
    app = await buildRoutesApp({ redis: null });

    const res = await app.inject({ method: "GET", url: "/api/auth/sso/google/url" });

    // Must not hand out an OAuth URL whose state can never be verified later.
    expect(res.statusCode).toBe(503);
  });

  it("source: SSO state path uses requireRedis() (fail-closed) and validates via sso_state:<state>", () => {
    const src = fs.readFileSync(
      path.resolve(__dirname, "../../src/routes/auth.ts"),
      "utf-8",
    );
    expect(src).toMatch(/redis\.get\(`sso_state:\$\{body\.state\}`\)/);
    expect(src).toMatch(/requireRedis\(app\)/);
    // requireRedis throws 503 when app.redis is null (fail-closed contract).
    expect(src).toMatch(/statusCode:\s*503/);
  });
});

// ===========================================================================
// (d) the rate-limit hardening plugin is registered + enforces limits
// ===========================================================================
// REAL IMPL (BLACKFYRE 2026-06): the limiter now consumes the shared
// app.rateLimitConsume primitive (Redis INCR+EXPIRE in prod, decorated by
// plugins/redis.ts). This in-memory fake lets the test exercise the plugin's
// real enforcement (429 / X-RateLimit headers / remaining) without Redis.
function makeFakeRateLimit() {
  const store = new Map<string, { count: number; resetAt: number }>();
  return (key: string, limit: number, windowMs: number) => {
    const now = Date.now();
    let e = store.get(key);
    if (!e || e.resetAt <= now) {
      e = { count: 0, resetAt: now + windowMs };
      store.set(key, e);
    }
    e.count += 1;
    return Promise.resolve({ ok: e.count <= limit, count: e.count, failClosed: false, resetAt: e.resetAt });
  };
}
describe("(d) rate-limit hardening plugin is registered (app.ts) and enforces limits", () => {
  let app: FastifyInstance;

  beforeEach(() => {
    vi.useFakeTimers(); // avoid the plugin's 60s eviction setInterval leaking real timers
  });

  afterEach(async () => {
    vi.useRealTimers();
    if (app) await app.close();
  });

  it("app.ts registers the rate-limit plugin before auth", () => {
    const appSrc = fs.readFileSync(
      path.resolve(__dirname, "../../src/app.ts"),
      "utf-8",
    );
    // Imported and registered.
    expect(appSrc).toMatch(
      /import\s+rateLimitPlugin\s+from\s+["']\.\/plugins\/rate-limit\.js["']/,
    );
    expect(appSrc).toMatch(/app\.register\(rateLimitPlugin\)/);

    // Registered ahead of the auth plugin (hardening before auth).
    const rlIdx = appSrc.indexOf("app.register(rateLimitPlugin)");
    const authIdx = appSrc.indexOf("app.register(authPlugin)");
    expect(rlIdx).toBeGreaterThan(-1);
    expect(authIdx).toBeGreaterThan(-1);
    expect(rlIdx).toBeLessThan(authIdx);
  });

  it("the rate-limit plugin registers under the fastify-plugin name 'rate-limit'", async () => {
    app = Fastify({ logger: false });
    await app.register(rateLimitPlugin);
    await app.ready();
    // fastify-plugin records the declared name; presence proves a real registration.
    expect((app as any).pluginName ?? "").toContain("rate-limit");
  });

  it("emits X-RateLimit-* headers and returns 429 once the window limit is exceeded", async () => {
    app = Fastify({ logger: false });
    app.decorate("rateLimitConsume", makeFakeRateLimit());
    await app.register(rateLimitPlugin);
    app.get("/ping", async () => ({ ok: true }));
    await app.ready();

    let last;
    // MAX_REQUESTS in the plugin is 100; 101st request in the window must 429.
    for (let i = 0; i < 101; i++) {
      last = await app.inject({ method: "GET", url: "/ping", remoteAddress: "203.0.113.7" });
    }

    expect(last!.statusCode).toBe(429);
    expect(last!.json().error.code).toBe("RATE_LIMITED");
    // Headers are present on throttled responses too.
    expect(last!.headers["x-ratelimit-limit"]).toBeDefined();
    expect(last!.headers["x-ratelimit-remaining"]).toBeDefined();
    expect(last!.headers["x-ratelimit-reset"]).toBeDefined();
  });

  it("does NOT throttle requests under the limit and decrements remaining", async () => {
    app = Fastify({ logger: false });
    app.decorate("rateLimitConsume", makeFakeRateLimit());
    await app.register(rateLimitPlugin);
    app.get("/ping", async () => ({ ok: true }));
    await app.ready();

    const first = await app.inject({ method: "GET", url: "/ping", remoteAddress: "198.51.100.9" });
    const second = await app.inject({ method: "GET", url: "/ping", remoteAddress: "198.51.100.9" });

    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);
    expect(Number(first.headers["x-ratelimit-remaining"])).toBeGreaterThan(
      Number(second.headers["x-ratelimit-remaining"]),
    );
  });

  it("lets /health through unconditionally (never throttled)", async () => {
    app = Fastify({ logger: false });
    await app.register(rateLimitPlugin);
    app.get("/health", async () => ({ status: "ok" }));
    await app.ready();

    let last;
    for (let i = 0; i < 105; i++) {
      last = await app.inject({ method: "GET", url: "/health", remoteAddress: "192.0.2.5" });
    }
    expect(last!.statusCode).toBe(200);
  });
});
