import fp from "fastify-plugin";
import type { FastifyPluginAsync, FastifyRequest } from "fastify";

/**
 * REAL IMPL (BLACKFYRE 2026-06): distributed, fail-closed sliding-window rate
 * limiter backed by the SHARED `app.redis` store (decorated in Wave 0, see
 * plugins/redis.ts). Previously this kept a per-instance in-memory `windowStore`,
 * so behind multiple Lambda instances / containers the effective limit was
 * N x MAX_REQUESTS — weak DoS protection. We now delegate counting to the atomic
 * `app.rateLimitConsume(key, limit, windowMs)` primitive (INCR + EXPIRE on Redis),
 * so the limit is GLOBAL across instances. When the store is unavailable
 * (`app.redis === null` or a Redis error) the helper returns `failClosed:true`
 * and we REJECT with 503 rather than admit unlimited traffic. A genuine limit
 * breach is still 429. No secrets/tokens are ever logged.
 */

// SECURITY FIX (BLACKFYRE audit 2026-06-05): proxy-aware client IP. `request.ip` is
// only trustworthy when Fastify's `trustProxy` is enabled; behind API Gateway / ALB
// the real client lives in X-Forwarded-For. We honour XFF ONLY when TRUST_PROXY is
// explicitly opted-in, so an attacker on a direct connection cannot spoof XFF to
// dodge or poison another client's bucket. When not trusted we use the socket IP.
function clientIp(request: FastifyRequest, trustProxy: boolean): string {
  if (trustProxy) {
    const xff = request.headers["x-forwarded-for"];
    const first = (Array.isArray(xff) ? xff[0] : xff)?.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.ip || "unknown";
}

// REAL IMPL (BLACKFYRE 2026-06): plan-based request multipliers. Higher tiers get a
// larger effective budget over the same window so paid customers are not throttled at
// the same ceiling as the base tier, while the limit stays GLOBAL (Redis-backed) and
// fail-closed. Unknown / unset plans fall back to the base multiplier (1x), never a
// larger one, so an unauthenticated or mis-attributed request can never buy headroom.
const PLAN_MULTIPLIERS: Record<string, number> = {
  comply: 1,
  protect: 3,
  defend: 10,
};

function planMultiplier(plan: string | undefined): number {
  if (!plan) return 1;
  return PLAN_MULTIPLIERS[plan] ?? 1;
}

const rateLimitPlugin: FastifyPluginAsync = async (app) => {
  const WINDOW_MS = 60_000;
  const BASE_MAX_REQUESTS = 100;

  // Opt-in trust of forwarding headers. Default off (fail-safe: socket IP only).
  const trustProxy =
    process.env.TRUST_PROXY === "true" ||
    process.env.TRUST_PROXY === "1" ||
    Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME); // Lambda sits behind a trusted GW

  app.addHook("onRequest", async (request, reply) => {
    // Allow health checks through unconditionally
    if (request.url.startsWith("/health") || request.url.startsWith("/api/health")) {
      return;
    }

    // SECURITY FIX (BLACKFYRE audit 2026-06-05): key the limiter by tenant+user once
    // authenticated (so one tenant/user cannot exhaust the global IP bucket and so a
    // shared NAT IP isn't collectively throttled), and fall back to a trusted client
    // IP pre-auth. Previously the key was tenant-only-or-raw-IP and not proxy-aware,
    // giving weak per-IP DoS protection.
    const tenantId = (request as FastifyRequest).tenantId;
    const userId = (request as FastifyRequest).userId;
    const tenantPlan = (request as FastifyRequest).tenantPlan;

    let key: string;
    if (tenantId && userId) {
      key = `tu:${tenantId}:${userId}`;
    } else if (tenantId) {
      key = `tenant:${tenantId}`;
    } else {
      key = `ip:${clientIp(request, trustProxy)}`;
    }

    // REAL IMPL (BLACKFYRE 2026-06): effective limit = base x plan multiplier. The
    // multiplier only applies to authenticated tenants; pre-auth IP-keyed requests
    // always use the base ceiling (planMultiplier(undefined) === 1).
    const maxRequests = BASE_MAX_REQUESTS * planMultiplier(tenantId ? tenantPlan : undefined);

    // REAL IMPL (BLACKFYRE 2026-06): atomic, distributed consume on the shared store.
    // Returns failClosed:true when app.redis is null or Redis errors → we 503.
    const result = await app.rateLimitConsume(key, maxRequests, WINDOW_MS);

    reply.header("X-RateLimit-Limit", maxRequests);
    reply.header("X-RateLimit-Remaining", Math.max(0, maxRequests - result.count));
    reply.header("X-RateLimit-Reset", result.resetAt);

    if (result.ok) return;

    if (result.failClosed) {
      // Shared store unavailable → fail CLOSED with 503. The redis plugin already logs
      // the fail-closed reason; we add request context here without logging secrets.
      request.log.warn(
        {
          event: "ratelimit.fail_closed",
          keyKind: key.split(":")[0],
          tenantId: tenantId ?? undefined,
          userId: userId ?? undefined,
          method: request.method,
          url: request.url,
        },
        "Rate-limit store unavailable; failing closed (503)",
      );
      reply.header("Retry-After", Math.ceil(WINDOW_MS / 1000));
      reply.status(503).send({
        error: {
          code: "RATE_LIMIT_STORE_UNAVAILABLE",
          message: "Rate limiting is temporarily unavailable. Please retry shortly.",
        },
      });
      return;
    }

    // SECURITY FIX (BLACKFYRE audit 2026-06-05): log throttle events at warn so
    // sustained abuse is observable. Never log secrets/tokens; only the key KIND and
    // opaque tenant/user ids are emitted.
    request.log.warn(
      {
        event: "ratelimit.throttled",
        keyKind: key.split(":")[0],
        tenantId: tenantId ?? undefined,
        // userId is an opaque id (not PII) and aids abuse triage.
        userId: userId ?? undefined,
        plan: tenantId ? tenantPlan ?? undefined : undefined,
        method: request.method,
        url: request.url,
        count: result.count,
        limit: maxRequests,
      },
      "Rate limit exceeded; rejecting request",
    );
    reply.header("Retry-After", Math.max(0, result.resetAt - Math.floor(Date.now() / 1000)));
    reply.status(429).send({
      error: { code: "RATE_LIMITED", message: "Too many requests. Try again later." },
    });
  });
};

export default fp(rateLimitPlugin, { name: "rate-limit" });
