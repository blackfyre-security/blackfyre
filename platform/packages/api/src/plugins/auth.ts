import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import fp from "fastify-plugin";
import jwt from "@fastify/jwt";
import { type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { eq, and, isNull, sql } from "drizzle-orm";
import { apiKeys, users, auditorFrameworks, tenants } from "../db/schema.js";
import * as schema from "../db/schema.js";
import { drizzleReserved } from "../db/connection.js";
import { unauthorized, forbidden, ApiError } from "../utils/errors.js";
import { verifyPassword } from "../utils/password.js";
import type { UserRole } from "@blackfyre/shared";
import type postgres from "postgres";

// SECURITY FIX (BLACKFYRE audit 2026-06-05): pin JWT verification algorithm —
// without an explicit allowlist @fastify/jwt accepts any algorithm the token
// header asserts. JWT_SECRET is a symmetric secret, so only HS256 is valid;
// pinning prevents algorithm-confusion attacks (e.g. forging tokens by swapping
// to a different HMAC variant or, with a leaked public key, to RS/ES).
const JWT_ALGORITHM = "HS256" as const;

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: {
      sub: string;
      tenantId?: string;
      role?: UserRole;
      type: "access" | "refresh" | "mfa_challenge" | "password_reset";
      frameworkScope?: string[];  // populated for auditor role
      // SECURITY FIX (BLACKFYRE audit 2026-06-05): jti enables single-use
      // password-reset tokens (consumed in redis) so a reset link can't be replayed.
      jti?: string;
    };
    user: {
      sub: string;
      tenantId?: string;
      role?: UserRole;
      type: "access" | "refresh" | "mfa_challenge" | "password_reset";
      frameworkScope?: string[];
      jti?: string;
    };
  }
}

declare module "fastify" {
  interface FastifyRequest {
    // SECURITY FIX (BLACKFYRE audit 2026-06-05): `tenantId` is populated by
    // authenticate() before any route handler runs (requireRole calls it in the
    // preHandler), so for every authenticated request it is a guaranteed non-null
    // string — hence the non-optional type that the ~30 tenant-scoped route
    // handlers rely on for compile-time safety. The audit-flagged "mismatch" with
    // the optional JWT payload field is intentional and is reconciled at the
    // authenticate() boundary: a token whose decoded.tenantId is absent never
    // reaches a handler, and populateTenantContext() fails closed (no request.db
    // bound, RLS deny-all) if the tenant context cannot be established. Widening
    // this to `string | undefined` here would force `!`/guards into every caller
    // for no runtime benefit (the reviewer notes runtime is already safe).
    tenantId: string;
    userId: string;
    userRole: UserRole;
    frameworkScope?: string[];  // populated for auditor role
    // SECURITY FIX (BLACKFYRE audit 2026-06-05): request-scoped, tenant-bound DB
    // handle. Queries run on a reserved connection that has dropped privileges to
    // the non-owner `app_user` role with app.current_tenant bound, so Postgres
    // RLS enforces tenant isolation. Routes MUST prefer `request.db` over
    // `app.db` for any tenant-scoped read/write. Undefined on unauthenticated
    // routes (no tenant context). See app.ts onResponse hook for release.
    db?: PostgresJsDatabase<typeof schema>;
    // Internal: the underlying reserved connection, released in onResponse.
    rlsConn?: postgres.ReservedSql;
  }
}

const authPlugin: FastifyPluginAsync = async (app) => {
  await app.register(jwt, {
    secret: app.config.JWT_SECRET,
    // SECURITY FIX (BLACKFYRE audit 2026-06-05): constrain accepted algorithms at
    // verify time so a forged token cannot dictate its own algorithm. Signing
    // continues to use the library default (HS256) for the symmetric secret, so
    // existing token issuance is unaffected.
    verify: { algorithms: [JWT_ALGORITHM] },
  });

  app.decorate("authenticate", async function (request: FastifyRequest) {
    // BUGFIX: the HttpOnly-cookie migration set bf_access_token at login but
    // nothing ever consumed it — browser clients (portal/admin static exports)
    // can't read an HttpOnly cookie to build an Authorization header, so every
    // cookie-authenticated request 401'd. When no Authorization header is
    // present, lift the token out of the cookie into the SAME Bearer
    // verification path (HS256 pinning and every downstream check unchanged).
    // CSRF for cookie-authenticated mutations is enforced by plugins/csrf.
    if (!request.headers.authorization) {
      const cookieToken = (request.headers.cookie ?? "")
        .split(";")
        .map((c) => c.trim().split("="))
        .find(([k]) => k === "bf_access_token")?.[1];
      if (cookieToken) {
        request.headers.authorization = `Bearer ${decodeURIComponent(cookieToken)}`;
      }
    }
    const authHeader = request.headers.authorization;
    const apiKeyHeader = request.headers["x-api-key"] as string | undefined;

    if (apiKeyHeader) {
      // API key auth — prefix lookup + hash verify (uses superDb to bypass RLS)
      const prefix = apiKeyHeader.slice(0, 8);
      const rows = await app.superDb
        .select()
        .from(apiKeys)
        .where(and(eq(apiKeys.prefix, prefix), isNull(apiKeys.revokedAt)));

      if (rows.length === 0) {
        // SECURITY FIX (BLACKFYRE audit 2026-06-05): log auth failures for
        // anomaly detection. Redact the key: only the non-secret prefix is kept.
        request.log.warn(
          { event: "auth.apikey.failure", reason: "unknown_prefix", prefix, ip: request.ip },
          "API key authentication failed",
        );
        throw unauthorized("Invalid API key");
      }

      const key = rows[0];
      const valid = await verifyPassword(key.keyHash, apiKeyHeader);
      if (!valid) {
        request.log.warn(
          { event: "auth.apikey.failure", reason: "hash_mismatch", prefix, ip: request.ip },
          "API key authentication failed",
        );
        throw unauthorized("Invalid API key");
      }

      // Look up actual user role (not hardcoded)
      const [user] = await app.superDb
        .select({ role: users.role })
        .from(users)
        .where(eq(users.id, key.userId))
        .limit(1);

      if (!user) throw unauthorized("API key owner not found");

      request.userId = key.userId;
      request.tenantId = key.tenantId;
      request.userRole = user.role;
      await populateTenantContext(request);
      return;
    }

    if (!authHeader?.startsWith("Bearer ")) {
      throw unauthorized();
    }

    try {
      const decoded = await request.jwtVerify() as {
        sub: string;
        tenantId: string;
        role: UserRole;
        type: "access" | "refresh" | "mfa_challenge" | "password_reset";
        frameworkScope?: string[];
      };
      // SECURITY FIX (BLACKFYRE audit 2026-06-05): enforce the `type` claim — a
      // bearer credential MUST be an access token. This blocks privilege
      // escalation by replaying a refresh / mfa_challenge / password_reset token
      // (which carry the same signature) as an access token.
      if (decoded.type !== "access") {
        request.log.warn(
          { event: "auth.jwt.wrong_type", tokenType: decoded.type, ip: request.ip },
          "Rejected JWT with non-access token type at bearer endpoint",
        );
        throw unauthorized("Invalid token type");
      }
      request.userId = decoded.sub;
      request.tenantId = decoded.tenantId;
      request.userRole = decoded.role;
      request.frameworkScope = decoded.frameworkScope;
      await populateTenantContext(request);
    } catch (err) {
      // Re-throw our own typed errors untouched (e.g. wrong token type above);
      // collapse everything else into a generic 401 without leaking jwt details.
      if (err instanceof ApiError) throw err;
      request.log.warn(
        { event: "auth.jwt.failure", ip: request.ip },
        "JWT verification failed",
      );
      throw unauthorized("Invalid or expired token");
    }
  });

  // Look up the authenticated tenant's plan + bind the RLS context.
  // Lives inside authenticate() because the global tenant-context preHandler
  // runs before route preHandlers (auth runs in route preHandlers via
  // requireRole), so request.tenantId isn't set yet at that point.
  async function populateTenantContext(request: FastifyRequest) {
    if (!request.tenantId) return;

    // SECURITY FIX (BLACKFYRE audit 2026-06-05): bind the tenant context on the
    // SAME connection that route queries use, under a non-owner role.
    //
    // Previously this set app.current_tenant on `superDb` (a different pool than
    // `app.db`) at SESSION scope (set_config false), so the binding (a) never
    // reached the query connection and (b) leaked across pooled requests. RLS
    // was therefore completely inert. We now reserve a dedicated connection,
    // SET ROLE to the non-owner `app_user` (which CANNOT bypass RLS), and bind
    // app.current_tenant on that reserved connection. `request.db` runs on it,
    // so Postgres enforces tenant isolation for every query. The connection is
    // RESET + released in app.ts's onResponse/onError hook so nothing leaks back
    // into the pool. Fail closed: if any step throws, request.db stays unset.
    const conn = await app.appSql.reserve();
    try {
      // Session-scope (is_local=false) is safe here because the connection is
      // dedicated to this request and explicitly RESET on release (see app.ts),
      // so it never leaks to another request. We avoid a transaction on purpose:
      // routes make external calls (SQS, S3, AI) mid-request and a long-held txn
      // would pin a connection and risk idle-in-transaction. SET ROLE drops owner
      // privileges to the RLS-enforced `app_user` for the whole request.
      await conn`SELECT set_config('app.current_tenant', ${request.tenantId}, false)`;
      await conn`SET ROLE app_user`;
    } catch (err) {
      // Release immediately so we don't strand a reserved connection.
      conn.release();
      request.log.error(
        { event: "rls.bind.failure", tenantId: request.tenantId },
        "Failed to bind tenant RLS context; denying request",
      );
      throw err;
    }
    request.rlsConn = conn;
    // drizzleReserved (not bare drizzle()) — postgres.js reserved connections lack
    // `.options` at runtime and drizzle 0.33 dereferences it at construction, which
    // made every authenticated request 401. See db/connection.ts for the full story.
    request.db = drizzleReserved(conn, app.appSql);
    request.log.info(
      { event: "rls.bind.ok", tenantId: request.tenantId },
      "Bound request-scoped tenant RLS context",
    );

    // Plan lookup uses superDb (owner pool, bypasses RLS) to read this tenant's
    // own row by id — cheap and isolated; the reserved conn stays clean for the
    // route's tenant-scoped queries.
    const [tenant] = await app.superDb
      .select({ plan: tenants.plan })
      .from(tenants)
      .where(eq(tenants.id, request.tenantId))
      .limit(1);
    request.tenantPlan = tenant?.plan ?? "comply";
  }

  // Role guard helper
  app.decorate(
    "requireRole",
    function (...roles: UserRole[]) {
      return async (request: FastifyRequest) => {
        await (app as any).authenticate(request);
        if (!roles.includes(request.userRole)) {
          throw forbidden(`Requires one of: ${roles.join(", ")}`);
        }
      };
    },
  );
};

export default fp(authPlugin, { name: "auth" });
