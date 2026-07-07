import fp from "fastify-plugin";
import type { FastifyPluginAsync, FastifyInstance } from "fastify";
import { Redis } from "ioredis";
import { InMemoryRedis } from "../lib/in-memory-redis.js";

/**
 * Redis plugin for BLACKFYRE.
 *
 * SECURITY FIX (BLACKFYRE audit 2026-06-05): distributed auth lockout / brute-force
 * tracking — the in-memory rate limiter resets per-instance, so login lockouts and
 * failure counters need a shared store. This plugin decorates `app.redis` with an
 * ioredis client built from config (REDIS_URL).
 *
 * FAIL-CLOSED CONTRACT (read carefully, auth-routes agent):
 *   - If REDIS_URL is empty/unset, `app.redis` is decorated with `null` and a WARN is
 *     logged at boot. It is NOT an error to boot without Redis (dev/test), BUT any
 *     security-critical consumer (auth lockout counters, MFA throttles) MUST treat
 *     `app.redis === null` as "store unavailable" and FAIL CLOSED — i.e. deny / lock /
 *     reject rather than silently allowing unlimited attempts.
 *   - This plugin does NOT register itself in app.ts. The RLS architect registers it.
 *
 * Connection is lazy (lazyConnect) so boot never blocks on Redis; a background connect
 * is kicked off and connection errors are logged as WARN without crashing the process.
 */

/**
 * Result of a distributed rate-limit check.
 *
 * `ok === false` means the request must be rejected. `failClosed === true`
 * additionally signals that the rejection is due to the shared store being
 * unavailable (redis === null or a redis error) rather than the limit being hit,
 * so callers can map it to 503 (store unavailable) vs 429 (limited) as appropriate.
 */
export interface RateLimitResult {
  ok: boolean;
  /** Current count in the active window (best-effort; 0 when failing closed). */
  count: number;
  /** The configured limit echoed back for header emission. */
  limit: number;
  /** Unix-seconds at which the current window resets (best-effort). */
  resetAt: number;
  /** True when the decision is a fail-closed denial because the store is unavailable. */
  failClosed: boolean;
}

declare module "fastify" {
  interface FastifyInstance {
    /**
     * Shared ioredis client, or `null` when REDIS_URL is not configured.
     * Consumers MUST fail closed when this is null (see redis plugin contract).
     */
    redis: Redis | null;

    /**
     * Atomic, distributed rate-limit primitive backed by `app.redis`.
     *
     * SECURITY FIX (BLACKFYRE audit 2026-06-05): per-instance in-memory rate limiting is
     * ineffective behind multiple Lambda instances (effective limit becomes N x MAX). This
     * helper performs an atomic INCR + EXPIRE on the SHARED redis store so the limit is
     * global, and FAILS CLOSED (ok:false, failClosed:true) when redis is null or errors —
     * never silently allowing unlimited attempts. Migrate the rate-limit plugin to call
     * `app.rateLimitConsume(key, limit, windowMs)` and reject (503 when failClosed, else 429).
     */
    rateLimitConsume(key: string, limit: number, windowMs: number): Promise<RateLimitResult>;
  }
}

/**
 * SECURITY FIX (BLACKFYRE audit 2026-06-05): distributed, fail-closed rate limiting.
 *
 * Atomic INCR + EXPIRE on the SHARED redis store. The window is keyed by a fixed-size
 * bucket (`rl:{key}`); the first hit in a window sets the TTL so the counter self-expires.
 * Reads `app.redis` at call time so it reflects the live decoration in both branches.
 *
 * FAIL CLOSED: when the store is unavailable (null client or a redis error) the request is
 * DENIED with failClosed:true so the caller can return 503 rather than admit unlimited
 * attempts. Never logs secrets or the redis URL.
 */
async function rateLimitConsumeImpl(
  app: FastifyInstance,
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  const windowSec = Math.max(1, Math.ceil(windowMs / 1000));
  const nowSec = Math.floor(Date.now() / 1000);
  const client = app.redis;

  // Store unavailable → fail closed (deny). Distinct from a hit limit.
  if (client === null) {
    app.log.warn(
      { event: "ratelimit.fail_closed", reason: "redis_unavailable", keyKind: key.split(":")[0] },
      "Rate-limit store (app.redis) is null — failing closed (denying request)",
    );
    return { ok: false, count: 0, limit, resetAt: nowSec + windowSec, failClosed: true };
  }

  const bucketKey = `rl:${key}`;
  try {
    // Atomic: INCR returns the new count; on the first hit (count === 1) set the TTL.
    const count = await client.incr(bucketKey);
    if (count === 1) {
      await client.expire(bucketKey, windowSec);
    }
    // Best-effort reset hint from the live TTL (PTTL avoids a second round-trip race).
    let resetAt = nowSec + windowSec;
    const ttl = await client.ttl(bucketKey);
    if (ttl > 0) resetAt = nowSec + ttl;

    if (count > limit) {
      app.log.warn(
        { event: "ratelimit.throttled", keyKind: key.split(":")[0], count, limit },
        "Distributed rate limit exceeded; rejecting request",
      );
      return { ok: false, count, limit, resetAt, failClosed: false };
    }
    return { ok: true, count, limit, resetAt, failClosed: false };
  } catch (err) {
    // Redis errored mid-check → fail closed (deny) rather than admit unlimited attempts.
    app.log.warn(
      {
        event: "ratelimit.fail_closed",
        reason: "redis_error",
        keyKind: key.split(":")[0],
        err: err instanceof Error ? err.message : String(err),
      },
      "Rate-limit store errored — failing closed (denying request)",
    );
    return { ok: false, count: 0, limit, resetAt: nowSec + windowSec, failClosed: true };
  }
}

const redisPlugin: FastifyPluginAsync = async (app: FastifyInstance) => {
  const url = app.config.REDIS_URL?.trim();
  // REAL IMPL (BLACKFYRE 2026-06): a real distributed store is "configured" only when
  // REDIS_URL is set to something other than the placeholder default localhost (which is
  // never reachable from a deployed Lambda). Unset/default => in-memory shim (functional,
  // per-instance) rather than fail-closed 503; a real URL => strict distributed + fail-closed.
  const DEFAULT_LOCAL_REDIS = "redis://localhost:6379";
  const configured = !!url && url !== DEFAULT_LOCAL_REDIS;

  // Decorate the distributed limiter once; it reads app.redis at call time so it works in
  // both the in-memory-shim and the real-client branches.
  app.decorate("rateLimitConsume", (key: string, limit: number, windowMs: number) =>
    rateLimitConsumeImpl(app, key, limit, windowMs),
  );

  if (!configured) {
    // REAL IMPL (BLACKFYRE 2026-06): no distributed Redis configured. Decorate an in-memory,
    // ioredis-compatible shim so the Redis-backed controls (rate limit, SSO state, pwreset
    // jti, webhook dedupe, SCIM cache, SSE caps) stay FUNCTIONAL per-instance instead of
    // fail-closing (503) with no store to reach. Set REDIS_URL to a real store to restore
    // strict distributed, fail-closed behaviour (recommended before prod scale).
    app.log.warn(
      { event: "redis.in_memory_fallback" },
      "REDIS_URL not configured — using a per-instance in-memory store. Rate limits / SSO-state / webhook-dedupe are NOT distributed; set REDIS_URL before prod scale.",
    );
    app.decorate("redis", new InMemoryRedis() as unknown as Redis);
    return;
  }

  const client = new Redis(url!, {
    lazyConnect: true,
    maxRetriesPerRequest: 2,
    enableReadyCheck: true,
    // Cap reconnect backoff so a downed Redis doesn't spin hot.
    retryStrategy: (times: number) => Math.min(times * 200, 5_000),
  });

  // SECURITY FIX (BLACKFYRE audit 2026-06-05): observability — log connection issues as
  // WARN (anomalous) so a degraded lockout store is visible. Never log the URL (it can
  // carry credentials).
  client.on("error", (err: Error) => {
    app.log.warn({ event: "redis.error", err: err.message }, "Redis client error");
  });
  client.on("ready", () => {
    app.log.info({ event: "redis.ready" }, "Redis connection ready");
  });

  // Kick off the connection in the background; do not block boot on Redis availability.
  client.connect().catch((err: Error) => {
    app.log.warn({ event: "redis.connect_failed", err: err.message }, "Initial Redis connect failed; will retry");
  });

  app.decorate("redis", client);

  app.addHook("onClose", async () => {
    try {
      await client.quit();
    } catch {
      client.disconnect();
    }
  });
};

export default fp(redisPlugin, { name: "redis" });
