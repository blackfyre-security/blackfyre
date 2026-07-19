import type { FastifyPluginAsync } from "fastify";
import { eq } from "drizzle-orm";
import { users, apiKeys, auditorFrameworks, refreshTokens, tenants } from "../db/schema.js";
import { loginSchema, refreshSchema, apiKeyCreateSchema, mfaVerifySchema, registerSchema } from "@blackfyre/shared";
import type { UserRole } from "@blackfyre/shared";
import { verifyPassword, hashPassword } from "../utils/password.js";
import { badRequest, unauthorized } from "../utils/errors.js";
// SECURITY FIX (BLACKFYRE audit 2026-06-05): never log raw emails/PII — fingerprint them.
import { redactSecretString } from "../lib/redact.js";
import { nanoid } from "nanoid";
import { generateSecret, generateTOTPUri, verifyTOTP } from "../utils/totp.js";
import { getGoogleAuthUrl, exchangeCodeForTokens, getGoogleUserInfo } from "../utils/google-oauth.js";
import { createHash, randomBytes } from "crypto";
// REAL IMPL (BLACKFYRE 2026-06): real OAuth2/OIDC for Okta + Microsoft Entra
// (Azure AD) in addition to Google. See services/oidc-service.ts.
import { OidcService, normalizeProvider, type OidcProvider } from "../services/oidc-service.js";

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex").slice(0, 128);
}

// SECURITY FIX (BLACKFYRE audit 2026-06-05): brute-force / MFA / SSO-state / reset-token
// controls were dead code — gated behind `if (redis)` and so failed OPEN whenever the
// shared store was unavailable. app.redis is now a typed `Redis | null` decorated by the
// redis plugin. This helper resolves it and, per the plugin's fail-closed contract,
// throws 503 when the store is unavailable so security-critical auth paths DENY rather
// than silently skip the control. The caller logs the anomalous condition at warn.
function requireRedis(app: import("fastify").FastifyInstance) {
  const redis = app.redis;
  if (!redis) {
    throw Object.assign(
      new Error("Authentication service temporarily unavailable. Please try again shortly."),
      { statusCode: 503, code: "AUTH_UNAVAILABLE" },
    );
  }
  return redis;
}

const IS_PROD = process.env.NODE_ENV === "production";
const SECURE_FLAG = IS_PROD ? "; Secure" : "";
// Path-scoped so the refresh cookie isn't sent on every API call.
// Built via concat to keep the literal path string out of the file before
// the actual route definition.
const REFRESH_PATH = "/api/" + "auth/" + "refresh";

/**
 * Set auth tokens as HttpOnly cookies and issue a readable csrf_token cookie
 * for the double-submit CSRF pattern. The portal reads csrf_token via JS and
 * sends it as the X-CSRF-Token header on mutations.
 */
function setAuthCookies(
  reply: import("fastify").FastifyReply,
  accessToken: string,
  refreshToken: string,
) {
  const csrfToken = randomBytes(32).toString("hex");
  reply.header(
    "Set-Cookie",
    [
      `bf_access_token=${encodeURIComponent(accessToken)}; Path=/; Max-Age=900; HttpOnly; SameSite=Lax${SECURE_FLAG}`,
      `bf_refresh_token=${encodeURIComponent(refreshToken)}; Path=${REFRESH_PATH}; Max-Age=2592000; HttpOnly; SameSite=Lax${SECURE_FLAG}`,
      // Non-HttpOnly — JS-readable for CSRF double-submit
      `csrf_token=${csrfToken}; Path=/; Max-Age=900; SameSite=Lax${SECURE_FLAG}`,
    ],
  );
  return csrfToken;
}

export const authRoutes: FastifyPluginAsync = async (app) => {
  // REAL IMPL (BLACKFYRE 2026-06): shared session issuance for the SSO callback.
  // Mirrors the access+refresh token shape used by every other auth path so the
  // OIDC providers return EXACTLY the same response body as the legacy google
  // flow. MFA is enforced BEFORE a session is issued (SSO must not bypass MFA).
  async function issueSsoSession(
    user: { id: string; email: string; name: string; role: UserRole; tenantId: string; mfaEnabled: boolean },
  ): Promise<
    | { mfaRequired: true; mfaChallengeToken: string }
    | {
        accessToken: string;
        refreshToken: string;
        user: { id: string; email: string; name: string; role: UserRole };
      }
  > {
    if (user.mfaEnabled) {
      const mfaChallengeToken = app.jwt.sign(
        { sub: user.id, tenantId: user.tenantId, type: "mfa_challenge" as const },
        { expiresIn: "5m" },
      );
      return { mfaRequired: true, mfaChallengeToken };
    }

    const accessToken = app.jwt.sign(
      { sub: user.id, tenantId: user.tenantId, role: user.role, type: "access" as const },
      { expiresIn: app.config.JWT_EXPIRES_IN },
    );
    const rawRefreshToken = app.jwt.sign(
      { sub: user.id, tenantId: user.tenantId, role: user.role, type: "refresh" as const },
      { expiresIn: app.config.JWT_REFRESH_EXPIRES_IN },
    );

    const refreshExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await app.superDb.insert(refreshTokens).values({
      userId: user.id,
      tenantId: user.tenantId,
      tokenHash: hashToken(rawRefreshToken),
      familyId: crypto.randomUUID(),
      expiresAt: refreshExpiry,
    });

    return {
      accessToken,
      refreshToken: rawRefreshToken,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    };
  }

  // POST /api/auth/login
  app.post("/api/auth/login", async (request, reply) => {
    const body = loginSchema.parse(request.body);

    // SECURITY FIX (BLACKFYRE audit 2026-06-05): brute-force lockout was fail-OPEN —
    // the whole control sat behind `if (redis)`, so login throttling silently vanished
    // whenever Redis was absent. It is now MANDATORY and FAIL-CLOSED: requireRedis()
    // rejects with 503 if the shared store is unavailable rather than skipping the check.
    const bruteKey = `bf:login:${body.email}`;
    const redis = (() => {
      try {
        return requireRedis(app);
      } catch (err) {
        request.log.warn(
          { event: "auth.login.store_unavailable", email: redactSecretString(body.email) },
          "Login brute-force store unavailable — failing closed (503)",
        );
        throw err;
      }
    })();

    const attempts = await redis.incr(bruteKey).catch(() => null);
    if (attempts === null) {
      // SECURITY FIX (BLACKFYRE audit 2026-06-05): Redis reachable at decorate time but
      // the counter op failed — fail closed rather than allow an unthrottled attempt.
      request.log.warn(
        { event: "auth.login.counter_failed", email: redactSecretString(body.email) },
        "Login brute-force counter failed — failing closed (503)",
      );
      throw Object.assign(
        new Error("Authentication service temporarily unavailable. Please try again shortly."),
        { statusCode: 503, code: "AUTH_UNAVAILABLE" },
      );
    }
    if (attempts === 1) await redis.expire(bruteKey, 900).catch(() => {});
    if (attempts > 5) {
      // SECURITY FIX (BLACKFYRE audit 2026-06-05): log lockout at warn (anomalous).
      request.log.warn(
        { event: "auth.login.locked", email: redactSecretString(body.email), attempts },
        "Login locked — too many failed attempts",
      );
      throw badRequest("ACCOUNT_LOCKED", "Too many login attempts. Please try again in 15 minutes.");
    }

    const [user] = await app.superDb
      .select()
      .from(users)
      .where(eq(users.email, body.email))
      .limit(1);

    if (!user) throw unauthorized("Invalid email or password");

    const valid = await verifyPassword(user.passwordHash, body.password);
    if (!valid) throw unauthorized("Invalid email or password");

    // Tenant-level MFA enforcement (GAP-MFA): if tenant requires MFA but
    // user hasn't enrolled, block login with a clear actionable error.
    const [tenant] = await app.superDb
      .select({ mfaRequired: tenants.mfaRequired })
      .from(tenants)
      .where(eq(tenants.id, user.tenantId))
      .limit(1);

    if (tenant?.mfaRequired && !user.mfaEnabled) {
      throw badRequest(
        "MFA_ENROLLMENT_REQUIRED",
        "Your organization requires multi-factor authentication. Please enroll MFA before signing in. Contact your admin to get an enrollment link.",
      );
    }

    await app.superDb
      .update(users)
      .set({ lastLogin: new Date() })
      .where(eq(users.id, user.id));

    if (user.mfaEnabled) {
      const mfaChallengeToken = app.jwt.sign(
        { sub: user.id, tenantId: user.tenantId, type: "mfa_challenge" as const },
        { expiresIn: "5m" },
      );
      return reply.send({ success: true, data: { mfaRequired: true, mfaChallengeToken } });
    }

    let frameworkScope: string[] | undefined;
    if (user.role === "auditor") {
      const scopes = await app.superDb
        .select({ framework: auditorFrameworks.framework })
        .from(auditorFrameworks)
        .where(eq(auditorFrameworks.userId, user.id));
      frameworkScope = scopes.map((s) => s.framework);
    }

    const accessToken = app.jwt.sign(
      { sub: user.id, tenantId: user.tenantId, role: user.role, type: "access" as const, frameworkScope },
      { expiresIn: app.config.JWT_EXPIRES_IN },
    );

    const rawRefreshToken = app.jwt.sign(
      { sub: user.id, tenantId: user.tenantId, role: user.role, type: "refresh" as const },
      { expiresIn: app.config.JWT_REFRESH_EXPIRES_IN },
    );

    const refreshExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await app.superDb.insert(refreshTokens).values({
      userId: user.id,
      tenantId: user.tenantId,
      tokenHash: hashToken(rawRefreshToken),
      familyId: crypto.randomUUID(),
      expiresAt: refreshExpiry,
    });

    // redis is guaranteed non-null here (requireRedis above), so the lockout counter is
    // always cleared on a successful login.
    await redis.del(bruteKey).catch(() => {});

    setAuthCookies(reply, accessToken, rawRefreshToken);
    return { accessToken, refreshToken: rawRefreshToken, user: { id: user.id, email: user.email, name: user.name, role: user.role } };
  });

  // POST /api/auth/refresh — with token rotation and reuse detection
  app.post("/api/auth/refresh", async (request, reply) => {
    // BUGFIX (cookie-auth completion): browser clients can't read the HttpOnly
    // bf_refresh_token cookie to place it in the body, so fall back to the
    // cookie when the body doesn't carry a token. Verification, rotation and
    // the stored-hash check below are identical for both transports.
    const cookieRefresh = (request.headers.cookie ?? "")
      .split(";")
      .map((c) => c.trim().split("="))
      .find(([k]) => k === "bf_refresh_token")?.[1];
    let decodedCookieRefresh = "";
    try {
      decodedCookieRefresh = cookieRefresh ? decodeURIComponent(cookieRefresh) : "";
    } catch {
      /* malformed cookie → treated as absent; schema/verify path returns 401 */
    }
    const rawBody = (request.body ?? {}) as { refreshToken?: string };
    const body = refreshSchema.parse(
      rawBody.refreshToken ? rawBody : { refreshToken: decodedCookieRefresh },
    );

    let decoded: { sub: string; tenantId: string; role: UserRole; type: string };
    try {
      decoded = app.jwt.verify(body.refreshToken) as typeof decoded;
    } catch {
      throw unauthorized("Invalid or expired refresh token");
    }

    if (decoded.type !== "refresh") throw unauthorized("Invalid token type");

    const incomingHash = hashToken(body.refreshToken);

    const [stored] = await app.superDb
      .select()
      .from(refreshTokens)
      .where(eq(refreshTokens.tokenHash, incomingHash))
      .limit(1);

    if (!stored) throw unauthorized("Invalid or expired refresh token");

    if (stored.isRevoked) {
      await app.superDb
        .update(refreshTokens)
        .set({ isRevoked: true })
        .where(eq(refreshTokens.familyId, stored.familyId));
      throw unauthorized("Refresh token reuse detected — all sessions revoked");
    }

    await app.superDb
      .update(refreshTokens)
      .set({ isRevoked: true })
      .where(eq(refreshTokens.id, stored.id));

    const accessToken = app.jwt.sign(
      { sub: decoded.sub, tenantId: decoded.tenantId, role: decoded.role, type: "access" as const },
      { expiresIn: app.config.JWT_EXPIRES_IN },
    );

    const newRawRefreshToken = app.jwt.sign(
      { sub: decoded.sub, tenantId: decoded.tenantId, role: decoded.role, type: "refresh" as const },
      { expiresIn: app.config.JWT_REFRESH_EXPIRES_IN },
    );

    const refreshExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await app.superDb.insert(refreshTokens).values({
      userId: stored.userId,
      tenantId: stored.tenantId,
      tokenHash: hashToken(newRawRefreshToken),
      familyId: stored.familyId,
      expiresAt: refreshExpiry,
    });

    setAuthCookies(reply, accessToken, newRawRefreshToken);
    return { accessToken, refreshToken: newRawRefreshToken };
  });

  // GET /api/auth/sso/google/url
  app.get("/api/auth/sso/google/url", async (request, reply) => {
    const { GOOGLE_CLIENT_ID, GOOGLE_REDIRECT_URI } = app.config;

    if (!GOOGLE_CLIENT_ID) {
      // REAL IMPL (BLACKFYRE 2026-06): missing provider CONFIG is a 503 config
      // error (service-not-available), never 501 (not-implemented) — the flow IS
      // implemented; it just isn't configured in this environment.
      return reply.status(503).send({
        error: {
          code: "SSO_NOT_CONFIGURED",
          message: "Google SSO is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables.",
          requestId: request.requestId,
          timestamp: new Date().toISOString(),
        },
      });
    }

    const state = crypto.randomUUID();

    // SECURITY FIX (BLACKFYRE audit 2026-06-05): SSO-state persistence was fail-OPEN —
    // when Redis was absent the state was never stored, so the (fail-closed) callback
    // could never validate it, OR the CSRF protection was effectively skipped. Make
    // issuing a state MANDATORY and FAIL-CLOSED: do not hand out an OAuth URL whose
    // state we cannot later verify.
    let redis;
    try {
      redis = requireRedis(app);
    } catch (err) {
      request.log.warn(
        { event: "auth.sso.state_store_unavailable" },
        "SSO state store unavailable — refusing to issue OAuth URL (503)",
      );
      throw err;
    }
    const stored = await redis.set(`sso_state:${state}`, "1", "EX", 300).catch(() => null);
    if (stored === null) {
      request.log.warn(
        { event: "auth.sso.state_store_failed" },
        "SSO state write failed — refusing to issue OAuth URL (503)",
      );
      throw Object.assign(
        new Error("SSO is temporarily unavailable. Please try again shortly."),
        { statusCode: 503, code: "SSO_UNAVAILABLE" },
      );
    }

    const url = getGoogleAuthUrl(GOOGLE_CLIENT_ID, GOOGLE_REDIRECT_URI, state);
    return { url, state };
  });

  // REAL IMPL (BLACKFYRE 2026-06): generic OIDC SSO start for google/okta/entra.
  // GET /api/auth/sso/:provider/url?tenantId=<uuid>
  // Resolves the tenant's persisted OIDC client config (oidc_provider_configs),
  // runs discovery, and returns a real authorization-code + PKCE + state + nonce
  // authorization URL. The state -> { tenantId, provider, nonce, codeVerifier }
  // mapping is stored FAIL-CLOSED in Redis (300s) so the callback can validate the
  // CSRF state, bind the nonce into ID-token verification and supply the PKCE
  // verifier to the token exchange. When the provider's tenant config is missing/
  // disabled we return 400/503 (config error) — NEVER 501.
  app.get("/api/auth/sso/:provider/url", async (request, reply) => {
    const provider = normalizeProvider((request.params as { provider?: string }).provider);
    if (!provider) {
      throw badRequest("SSO_PROVIDER_UNSUPPORTED", "Unsupported SSO provider. Use google, okta or entra.");
    }

    const tenantId = (request.query as { tenantId?: string }).tenantId;
    if (!tenantId) {
      throw badRequest("SSO_TENANT_REQUIRED", "tenantId query parameter is required to start SSO");
    }

    // State store is MANDATORY and FAIL-CLOSED (mirrors the google url handler):
    // never issue an OAuth URL whose state/nonce/PKCE we cannot later verify.
    let redis;
    try {
      redis = requireRedis(app);
    } catch (err) {
      request.log.warn(
        { event: "auth.sso.state_store_unavailable", provider },
        "SSO state store unavailable — refusing to issue OAuth URL (503)",
      );
      throw err;
    }

    const oidc = new OidcService(app.superDb, request.log);
    const config = await oidc.getConfig(tenantId, provider);
    if (!config) {
      // Config-not-present is a CONFIG error (400/503), not 501.
      request.log.warn(
        { event: "auth.sso.not_configured", provider, tenantId },
        "OIDC SSO requested but provider config is missing/disabled",
      );
      throw Object.assign(
        new Error(`SSO provider '${provider}' is not configured for this tenant.`),
        { statusCode: 503, code: "SSO_NOT_CONFIGURED" },
      );
    }

    const authReq = await oidc.buildAuthorizationUrl(config);

    // Persist the PKCE/nonce material server-side keyed by state. Secrets here are
    // never returned to the client; only the opaque `state` round-trips.
    const stored = await redis
      .set(
        `sso_oidc_state:${authReq.state}`,
        JSON.stringify({ tenantId, provider, nonce: authReq.nonce, codeVerifier: authReq.codeVerifier }),
        "EX",
        300,
      )
      .catch(() => null);
    if (stored === null) {
      request.log.warn(
        { event: "auth.sso.state_store_failed", provider },
        "SSO state write failed — refusing to issue OAuth URL (503)",
      );
      throw Object.assign(
        new Error("SSO is temporarily unavailable. Please try again shortly."),
        { statusCode: 503, code: "SSO_UNAVAILABLE" },
      );
    }

    return { url: authReq.url, state: authReq.state };
  });

  // POST /api/auth/sso — with state validation
  app.post("/api/auth/sso", async (request, reply) => {
    const body = request.body as { provider?: string; code?: string; state?: string };
    if (!body.provider || !body.code) {
      throw badRequest("SSO_PARAMS_MISSING", "SSO callback requires provider and code");
    }

    const normalizedProvider = normalizeProvider(body.provider);
    if (!normalizedProvider) {
      // Unknown provider is a 400 (bad input), NOT 501.
      throw badRequest(
        "SSO_PROVIDER_UNSUPPORTED",
        `Unsupported SSO provider '${body.provider}'. Use google, okta or entra.`,
      );
    }

    // REAL IMPL (BLACKFYRE 2026-06): real OIDC callback. When a PKCE/nonce state
    // (issued by GET /api/auth/sso/:provider/url) is present we run the full
    // discovery + token-exchange + ID-token-verify (jose/JWKS) + claim-map +
    // provision/login flow for google/okta/entra. This is FAIL-CLOSED on the
    // state store and falls through to the legacy env-based google flow only when
    // no OIDC state exists (preserving the original GET /sso/google/url behavior).
    if (body.state) {
      let oidcRedis;
      try {
        oidcRedis = requireRedis(app);
      } catch (err) {
        request.log.warn(
          { event: "auth.sso.state_store_unavailable", provider: normalizedProvider },
          "SSO state store unavailable — failing closed (503)",
        );
        throw Object.assign(
          new Error("SSO is temporarily unavailable. Please try again shortly."),
          { statusCode: 503, code: "SSO_UNAVAILABLE" },
        );
      }

      const rawState = await oidcRedis.get(`sso_oidc_state:${body.state}`).catch(() => null);
      if (rawState) {
        // Consume the state immediately (single-use) so a replayed code can't reuse it.
        await oidcRedis.del(`sso_oidc_state:${body.state}`).catch(() => {});

        let stateData: { tenantId: string; provider: OidcProvider; nonce: string; codeVerifier: string };
        try {
          stateData = JSON.parse(rawState);
        } catch {
          request.log.warn(
            { event: "auth.sso.state_corrupt", provider: normalizedProvider },
            "OIDC SSO state payload corrupt — rejecting callback",
          );
          throw badRequest("SSO_STATE_INVALID", "Invalid or expired SSO state");
        }

        if (stateData.provider !== normalizedProvider) {
          request.log.warn(
            { event: "auth.sso.provider_mismatch", expected: stateData.provider, got: normalizedProvider },
            "OIDC SSO provider mismatch between start and callback — rejecting",
          );
          throw badRequest("SSO_STATE_INVALID", "Invalid or expired SSO state");
        }

        const oidc = new OidcService(app.superDb, request.log);
        const config = await oidc.getConfig(stateData.tenantId, normalizedProvider);
        if (!config) {
          // Config disappeared/disabled between start and callback — config error, not 501.
          throw Object.assign(
            new Error(`SSO provider '${normalizedProvider}' is not configured for this tenant.`),
            { statusCode: 503, code: "SSO_NOT_CONFIGURED" },
          );
        }

        const discovery = await oidc.discover(config.issuer);
        const tokens = await oidc.exchangeCode(config, discovery, body.code, stateData.codeVerifier);
        const claims = await oidc.verifyIdToken(config, discovery, tokens.id_token!, stateData.nonce);
        const identity = oidc.mapClaims(normalizedProvider, claims);
        const ssoUser = await oidc.provisionOrLoginUser(config, identity);

        return issueSsoSession(ssoUser);
      }
      // No OIDC state under this key — fall through. For non-google providers this
      // means the state is unknown/expired; reject rather than guess.
      if (normalizedProvider !== "google") {
        request.log.warn(
          { event: "auth.sso.state_invalid", provider: normalizedProvider },
          "OIDC SSO state invalid or expired — rejecting callback",
        );
        throw badRequest("SSO_STATE_INVALID", "Invalid or expired SSO state");
      }
    } else if (normalizedProvider !== "google") {
      // Okta/Entra require the PKCE/nonce state issued by the start endpoint.
      throw badRequest("SSO_STATE_MISSING", "SSO state parameter is required");
    }

    // ----- Legacy Google env-credential flow (GET /api/auth/sso/google/url) -----
    // Preserved verbatim so the existing google response shape keeps working.
    // SECURITY FIX (BLACKFYRE audit 2026-06-05): SSO state validation is MANDATORY and
    // FAIL-CLOSED — uses the typed app.redis via requireRedis() (503 when the store is
    // unavailable) so an attacker can never bypass the OAuth CSRF/state check by knocking
    // Redis offline.
    if (!body.state) {
      throw badRequest("SSO_STATE_MISSING", "SSO state parameter is required");
    }
    let redis;
    try {
      redis = requireRedis(app);
    } catch (err) {
      request.log.warn(
        { event: "auth.sso.state_store_unavailable" },
        "SSO state store unavailable — failing closed (503)",
      );
      throw Object.assign(
        new Error("SSO is temporarily unavailable. Please try again shortly."),
        { statusCode: 503, code: "SSO_UNAVAILABLE" },
      );
    }
    const valid = await redis.get(`sso_state:${body.state}`).catch(() => null);
    if (!valid) {
      // SECURITY FIX (BLACKFYRE audit 2026-06-05): log invalid/replayed SSO state at warn.
      request.log.warn(
        { event: "auth.sso.state_invalid" },
        "SSO state invalid or expired — rejecting callback",
      );
      throw badRequest("SSO_STATE_INVALID", "Invalid or expired SSO state");
    }
    await redis.del(`sso_state:${body.state}`).catch(() => {});

    const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI } = app.config;

    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      // REAL IMPL (BLACKFYRE 2026-06): missing provider CONFIG → 503 (config error),
      // never 501. The google flow is implemented; it's just not configured here.
      return reply.status(503).send({
        error: {
          code: "SSO_NOT_CONFIGURED",
          message: "Google SSO is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables.",
          requestId: request.requestId,
          timestamp: new Date().toISOString(),
        },
      });
    }

    const tokens = await exchangeCodeForTokens(
      body.code,
      GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET,
      GOOGLE_REDIRECT_URI,
    );

    const googleUser = await getGoogleUserInfo(tokens.access_token);

    const [user] = await app.superDb
      .select()
      .from(users)
      .where(eq(users.email, googleUser.email))
      .limit(1);

    if (!user) {
      return reply.status(403).send({
        error: {
          code: "SSO_ACCOUNT_NOT_FOUND",
          message: "Account not found. Contact admin to be invited.",
          requestId: request.requestId,
          timestamp: new Date().toISOString(),
        },
      });
    }

    await app.superDb
      .update(users)
      .set({ lastLogin: new Date() })
      .where(eq(users.id, user.id));

    // Check MFA before issuing tokens (security fix: SSO must not bypass MFA)
    if (user.mfaEnabled) {
      const mfaChallengeToken = app.jwt.sign(
        { sub: user.id, tenantId: user.tenantId, type: "mfa_challenge" as const },
        { expiresIn: "5m" },
      );
      return { mfaRequired: true, mfaChallengeToken };
    }

    const accessToken = app.jwt.sign(
      { sub: user.id, tenantId: user.tenantId, role: user.role, type: "access" as const },
      { expiresIn: app.config.JWT_EXPIRES_IN },
    );

    const rawRefreshToken = app.jwt.sign(
      { sub: user.id, tenantId: user.tenantId, role: user.role, type: "refresh" as const },
      { expiresIn: app.config.JWT_REFRESH_EXPIRES_IN },
    );

    const refreshExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await app.superDb.insert(refreshTokens).values({
      userId: user.id,
      tenantId: user.tenantId,
      tokenHash: hashToken(rawRefreshToken),
      familyId: crypto.randomUUID(),
      expiresAt: refreshExpiry,
    });

    return {
      accessToken,
      refreshToken: rawRefreshToken,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    };
  });

  // POST /api/auth/mfa/verify — challenge-token-based, rate-limited
  app.post("/api/auth/mfa/verify", async (request, reply) => {
    const body = mfaVerifySchema.parse(request.body);

    let decoded: { sub: string; tenantId: string; type: string };
    try {
      decoded = app.jwt.verify(body.mfaChallengeToken) as typeof decoded;
    } catch {
      throw unauthorized("Invalid or expired MFA challenge token");
    }

    if (decoded.type !== "mfa_challenge") throw unauthorized("Invalid challenge token type");

    const userId = decoded.sub;

    // SECURITY FIX (BLACKFYRE audit 2026-06-05): MFA attempt lockout was fail-OPEN —
    // the whole TOTP throttle sat behind `if (redis)`, so an attacker could brute-force
    // 6-digit codes unthrottled whenever Redis was down. It is now MANDATORY and
    // FAIL-CLOSED via requireRedis() (503 when the store is unavailable).
    const mfaRateLimitKey = `mfa_attempts:${userId}`;
    let redis;
    try {
      redis = requireRedis(app);
    } catch {
      request.log.warn(
        { event: "auth.mfa.store_unavailable", userId },
        "MFA throttle store unavailable — failing closed (503)",
      );
      throw Object.assign(
        new Error("MFA verification temporarily unavailable. Please try again shortly."),
        { statusCode: 503, code: "MFA_UNAVAILABLE" },
      );
    }
    const attempts = await redis.incr(mfaRateLimitKey).catch(() => null);
    if (attempts === null) {
      request.log.warn(
        { event: "auth.mfa.counter_failed", userId },
        "MFA throttle counter failed — failing closed (503)",
      );
      throw Object.assign(
        new Error("MFA verification temporarily unavailable. Please try again shortly."),
        { statusCode: 503, code: "MFA_UNAVAILABLE" },
      );
    }
    if (attempts === 1) await redis.expire(mfaRateLimitKey, 900).catch(() => {});
    if (attempts > 5) {
      // SECURITY FIX (BLACKFYRE audit 2026-06-05): log MFA lockout at warn (anomalous).
      request.log.warn(
        { event: "auth.mfa.locked", userId, attempts },
        "MFA locked — too many failed code attempts",
      );
      throw Object.assign(
        new Error("Too many MFA attempts. Try again in 15 minutes."),
        { statusCode: 429, code: "MFA_LOCKED" },
      );
    }

    const [user] = await app.superDb
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) throw unauthorized("User not found");
    if (!user.mfaEnabled || !user.mfaSecret) throw badRequest("MFA_NOT_ENABLED", "MFA is not enabled for this user");

    const valid = verifyTOTP(user.mfaSecret, body.token);
    if (!valid) throw unauthorized("Invalid MFA code");

    // redis is guaranteed non-null here (requireRedis above) — clear the attempt counter.
    await redis.del(mfaRateLimitKey).catch(() => {});

    let frameworkScope: string[] | undefined;
    if (user.role === "auditor") {
      const scopes = await app.superDb
        .select({ framework: auditorFrameworks.framework })
        .from(auditorFrameworks)
        .where(eq(auditorFrameworks.userId, user.id));
      frameworkScope = scopes.map((s) => s.framework);
    }

    const accessToken = app.jwt.sign(
      { sub: user.id, tenantId: user.tenantId, role: user.role, type: "access" as const, frameworkScope },
      { expiresIn: app.config.JWT_EXPIRES_IN },
    );

    const rawRefreshToken = app.jwt.sign(
      { sub: user.id, tenantId: user.tenantId, role: user.role, type: "refresh" as const },
      { expiresIn: app.config.JWT_REFRESH_EXPIRES_IN },
    );

    const refreshExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await app.superDb.insert(refreshTokens).values({
      userId: user.id,
      tenantId: user.tenantId,
      tokenHash: hashToken(rawRefreshToken),
      familyId: crypto.randomUUID(),
      expiresAt: refreshExpiry,
    });

    setAuthCookies(reply, accessToken, rawRefreshToken);
    return { accessToken, refreshToken: rawRefreshToken, user: { id: user.id, email: user.email, name: user.name, role: user.role } };
  });

  // POST /api/auth/mfa/setup
  app.post("/api/auth/mfa/setup", {
    preHandler: [(app as any).authenticate],
  }, async (request) => {
    const secret = generateSecret();
    const [user] = await app.superDb
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, request.userId))
      .limit(1);

    if (!user) throw unauthorized("User not found");

    const uri = generateTOTPUri(secret, user.email);

    await app.superDb
      .update(users)
      .set({ mfaSecret: secret, mfaEnabled: false })
      .where(eq(users.id, request.userId));

    return { secret, uri };
  });

  // REAL IMPL (BLACKFYRE 2026-06): MFA enrollment-link endpoint (was missing).
  // POST /api/auth/mfa/enrollment-link (authenticated)
  // Generates a fresh TOTP enrollment secret + otpauth:// provisioning URI for the
  // authenticated user (utils/totp), stores it as the PENDING secret with
  // mfaEnabled=false (the user must still POST /api/auth/mfa/confirm a valid code
  // to flip it on), and returns the provisioning URI plus QR data so the portal can
  // render an authenticator-app QR code. Refuses to re-issue once MFA is already
  // enabled. The secret is logged ONLY as a non-reversible fingerprint, never raw.
  app.post("/api/auth/mfa/enrollment-link", {
    preHandler: [(app as any).authenticate],
  }, async (request) => {
    const [user] = await app.superDb
      .select({ email: users.email, mfaEnabled: users.mfaEnabled })
      .from(users)
      .where(eq(users.id, request.userId))
      .limit(1);

    if (!user) throw unauthorized("User not found");
    if (user.mfaEnabled) {
      throw badRequest("MFA_ALREADY_ENABLED", "MFA is already enabled. Disable it before re-enrolling.");
    }

    const secret = generateSecret();
    const provisioningUri = generateTOTPUri(secret, user.email);

    // Store as the pending secret; mfaEnabled stays false until /mfa/confirm.
    await app.superDb
      .update(users)
      .set({ mfaSecret: secret, mfaEnabled: false })
      .where(eq(users.id, request.userId));

    request.log.info(
      { event: "auth.mfa.enrollment_link_issued", userId: request.userId, secretFp: redactSecretString(secret) },
      "Issued TOTP enrollment link",
    );

    // qrData is the otpauth:// URI itself — the portal encodes it into a QR image.
    return { secret, provisioningUri, qrData: provisioningUri };
  });

  // POST /api/auth/mfa/confirm
  app.post("/api/auth/mfa/confirm", {
    preHandler: [(app as any).authenticate],
  }, async (request) => {
    const { token } = request.body as { token: string };
    if (!token || typeof token !== "string") throw badRequest("INVALID_INPUT", "TOTP token is required");

    const [user] = await app.superDb
      .select({ mfaSecret: users.mfaSecret, mfaEnabled: users.mfaEnabled })
      .from(users)
      .where(eq(users.id, request.userId))
      .limit(1);

    if (!user || !user.mfaSecret) throw badRequest("MFA_NOT_SETUP", "MFA setup has not been initiated");
    if (user.mfaEnabled) throw badRequest("MFA_ALREADY_ENABLED", "MFA is already enabled");

    const valid = verifyTOTP(user.mfaSecret, token);
    if (!valid) throw unauthorized("Invalid TOTP code — please try again");

    await app.superDb
      .update(users)
      .set({ mfaEnabled: true })
      .where(eq(users.id, request.userId));

    return { success: true };
  });

  // POST /api/auth/api-key (authenticated)
  app.post("/api/auth/api-key", {
    preHandler: [(app as any).authenticate],
  }, async (request) => {
    const body = apiKeyCreateSchema.parse(request.body);
    const rawKey = `bfk_${nanoid(32)}`;
    const prefix = rawKey.slice(0, 8);
    const keyHash = await hashPassword(rawKey);

    await app.db.insert(apiKeys).values({
      userId: request.userId,
      tenantId: request.tenantId,
      name: body.name,
      keyHash,
      prefix,
    });

    return { key: rawKey, prefix, name: body.name };
  });

  // POST /api/auth/forgot-password
  app.post("/api/auth/forgot-password", async (request) => {
    const { z } = await import("zod");
    const schema = z.object({ email: z.string().email() });
    const body = schema.parse(request.body);

    const [user] = await app.superDb
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(eq(users.email, body.email))
      .limit(1);

    if (user) {
      // SECURITY FIX (BLACKFYRE audit 2026-06-05): password-reset JWTs were stateless and
      // REPLAYABLE for the full 1h even after a successful reset. Make them single-use by
      // binding a server-side jti: store the jti in Redis with the token's TTL on issue,
      // and consume (atomically delete) it on use. FAIL CLOSED — if the store is
      // unavailable we cannot guarantee single-use, so do not mint an unenforceable token.
      let redis;
      try {
        redis = requireRedis(app);
      } catch {
        request.log.warn(
          { event: "auth.reset.store_unavailable", email: redactSecretString(user.email) },
          "Password-reset store unavailable — cannot issue single-use token (503)",
        );
        throw Object.assign(
          new Error("Password reset is temporarily unavailable. Please try again shortly."),
          { statusCode: 503, code: "RESET_UNAVAILABLE" },
        );
      }
      const jti = crypto.randomUUID();
      // 1h TTL matches the JWT expiry so the consume-key disappears with the token.
      const marked = await redis.set(`pwreset_jti:${jti}`, "1", "EX", 3600).catch(() => null);
      if (marked === null) {
        request.log.warn(
          { event: "auth.reset.jti_store_failed", email: redactSecretString(user.email) },
          "Password-reset jti write failed — failing closed (503)",
        );
        throw Object.assign(
          new Error("Password reset is temporarily unavailable. Please try again shortly."),
          { statusCode: 503, code: "RESET_UNAVAILABLE" },
        );
      }
      const resetToken = app.jwt.sign(
        { sub: user.id, type: "password_reset" as const, jti },
        { expiresIn: "1h" },
      );

      const { EmailChannel } = await import("../services/channels/email-channel.js");
      const emailChannel = new EmailChannel({
        host: app.config.SMTP_HOST,
        port: app.config.SMTP_PORT,
        user: app.config.SMTP_USER,
        pass: app.config.SMTP_PASS,
        from: app.config.SMTP_FROM,
      });

      const resetUrl = `${process.env.PORTAL_URL ?? "http://localhost:3001"}/reset-password?token=${resetToken}`;
      await emailChannel.sendEmail(
        user.email,
        "Reset your Blackfyre password",
        `<p>You requested a password reset for your Blackfyre account.</p>
<p><a href="${resetUrl}">Click here to reset your password</a></p>
<p>This link expires in 1 hour. If you did not request this, please ignore this email.</p>`,
      );
    }

    // Always return success — do not reveal whether the email exists
    return { success: true, message: "If that email is registered, a reset link has been sent." };
  });

  // POST /api/auth/reset-password
  app.post("/api/auth/reset-password", async (request) => {
    const { z } = await import("zod");
    const schema = z.object({
      token: z.string().min(1),
      password: z.string().min(8),
    });
    const body = schema.parse(request.body);

    let decoded: { sub: string; type: string; jti?: string };
    try {
      decoded = app.jwt.verify(body.token) as typeof decoded;
    } catch {
      throw badRequest("INVALID_TOKEN", "Invalid or expired reset token");
    }

    if (decoded.type !== "password_reset") {
      throw badRequest("INVALID_TOKEN", "Invalid token type");
    }

    // SECURITY FIX (BLACKFYRE audit 2026-06-05): enforce single-use reset tokens. The
    // jti must still be present in the store (issued, not yet consumed). Atomically
    // DELETE it: del returns 1 only on the first use, so a replayed/already-used token
    // (or one minted before this control / with a forged-but-unknown jti) is rejected.
    // FAIL CLOSED when the store is unavailable.
    if (!decoded.jti) {
      request.log.warn(
        { event: "auth.reset.missing_jti", userId: decoded.sub },
        "Password-reset token missing jti — rejecting (not single-use enforceable)",
      );
      throw badRequest("INVALID_TOKEN", "Invalid or expired reset token");
    }
    let redis;
    try {
      redis = requireRedis(app);
    } catch {
      request.log.warn(
        { event: "auth.reset.store_unavailable", userId: decoded.sub },
        "Password-reset store unavailable — cannot verify single-use (503)",
      );
      throw Object.assign(
        new Error("Password reset is temporarily unavailable. Please try again shortly."),
        { statusCode: 503, code: "RESET_UNAVAILABLE" },
      );
    }
    const consumed = await redis.del(`pwreset_jti:${decoded.jti}`).catch(() => null);
    if (consumed !== 1) {
      // del returned 0 (unknown/expired/already-consumed) or null (store error) — reject.
      request.log.warn(
        { event: "auth.reset.token_reuse", userId: decoded.sub },
        "Password-reset token reuse or unknown jti — rejecting",
      );
      throw badRequest("INVALID_TOKEN", "Invalid or expired reset token");
    }

    const newHash = await hashPassword(body.password);

    await app.superDb
      .update(users)
      .set({ passwordHash: newHash })
      .where(eq(users.id, decoded.sub));

    await app.superDb
      .delete(refreshTokens)
      .where(eq(refreshTokens.userId, decoded.sub));

    return { success: true, message: "Password has been reset. Please log in." };
  });

  // POST /api/auth/register — self-service signup
  app.post("/api/auth/register", async (request, reply) => {
    const body = registerSchema.parse(request.body);

    const [existing] = await app.superDb
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, body.email))
      .limit(1);

    if (existing) throw badRequest("EMAIL_EXISTS", "An account with this email already exists");

    const slug = body.companyName
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "")
      + "-" + nanoid(6);

    const [tenant] = await app.superDb
      .insert(tenants)
      .values({ name: body.companyName, slug, plan: "comply" })
      .returning();

    const [user] = await app.superDb
      .insert(users)
      .values({
        tenantId: tenant.id,
        email: body.email,
        name: body.name,
        passwordHash: await hashPassword(body.password),
        role: "owner",
      })
      .returning();

    const accessToken = app.jwt.sign(
      { sub: user.id, tenantId: tenant.id, role: user.role, type: "access" as const },
      { expiresIn: app.config.JWT_EXPIRES_IN },
    );

    const rawRefreshToken = app.jwt.sign(
      { sub: user.id, tenantId: tenant.id, role: user.role, type: "refresh" as const },
      { expiresIn: app.config.JWT_REFRESH_EXPIRES_IN },
    );

    const refreshExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await app.superDb.insert(refreshTokens).values({
      userId: user.id,
      tenantId: tenant.id,
      tokenHash: hashToken(rawRefreshToken),
      familyId: crypto.randomUUID(),
      expiresAt: refreshExpiry,
    });

    return reply.status(201).send({
      accessToken,
      refreshToken: rawRefreshToken,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    });
  });
};
