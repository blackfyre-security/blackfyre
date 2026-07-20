import type { FastifyPluginAsync, FastifyInstance } from "fastify";
import { sql } from "drizzle-orm";

const startedAt = Date.now();

// REAL IMPL (BLACKFYRE 2026-06): single source of truth for dependency checks so the
// public /health, the /api/health alias, and the K8s /api/health/ready probe all report
// the SAME, real connectivity status (previously the Redis check read a non-existent
// `app.scanQueue.opts.connection` — SqsQueue has no such field — so Redis health was
// always "unknown" / fabricated). Returns per-dependency status + measured latency.

interface DepCheck {
  status: "ok" | "error" | "skipped";
  latencyMs?: number;
  error?: string;
}

async function checkDatabase(app: FastifyInstance): Promise<DepCheck> {
  const start = performance.now();
  try {
    await app.db.execute(sql`SELECT 1`);
    return { status: "ok", latencyMs: Math.round(performance.now() - start) };
  } catch (err) {
    const message = err instanceof Error ? err.message : "DB unreachable";
    app.log.warn({ event: "health.db.unreachable", err: message }, "Health check: database unreachable");
    return { status: "error", latencyMs: Math.round(performance.now() - start), error: message };
  }
}

async function checkRedis(app: FastifyInstance): Promise<DepCheck> {
  // Redis is OPTIONAL (REDIS_URL unset -> app.redis === null). When not configured we
  // report "skipped" (a healthy state) rather than "error", matching the redis plugin's
  // fail-open-for-availability boot contract. A configured-but-unreachable Redis is a
  // real "error" so readiness can gate on it.
  const client = app.redis;
  if (client === null) {
    return { status: "skipped" };
  }
  const start = performance.now();
  try {
    await client.ping();
    return { status: "ok", latencyMs: Math.round(performance.now() - start) };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Redis unreachable";
    app.log.warn({ event: "health.redis.unreachable", err: message }, "Health check: redis unreachable");
    return { status: "error", latencyMs: Math.round(performance.now() - start), error: message };
  }
}

export const healthRoutes: FastifyPluginAsync = async (app) => {
  // Full health check with real dependency status (Postgres SELECT 1 + Redis PING).
  // Registered at both /health (historical path, probes/tests) and /api/health (task
  // requirement / spec). Returns 200 with status "healthy" when the database is up,
  // "degraded" when a dependency is down — the LB keeps routing while alerts fire.
  const fullHealthHandler = async () => {
    const uptime = Math.floor((Date.now() - startedAt) / 1000);
    const [database, redis] = await Promise.all([checkDatabase(app), checkRedis(app)]);

    // Queue health: SqsQueue is configured when it has a URL. No live round-trip here
    // (SQS has no cheap ping) — report "ok" when configured, "skipped" otherwise.
    const queues: DepCheck["status"] = app.scanQueue?.url ? "ok" : "skipped";

    // Overall status keys off the database (the hard dependency). A down/optional Redis
    // degrades but does not flip the public health to error.
    const status = database.status === "ok" ? "healthy" : "degraded";

    return {
      status,
      version: "0.1.0",
      uptime,
      checks: {
        database: database.status,
        redis: redis.status,
        queues,
      },
      latencyMs: {
        database: database.latencyMs,
        redis: redis.latencyMs,
      },
      timestamp: new Date().toISOString(),
    };
  };

  app.get("/health", fullHealthHandler);
  app.get("/api/health", fullHealthHandler);

  // Public deployment capabilities. The portal is a static export, so it cannot read
  // server env at build time and must ask at runtime which optional subsystems this
  // deployment actually has. Booleans only — never echo key material or its shape.
  //
  // `allowUnpaidRegistration` is what lets a self-hosted install sign up: it puts no
  // checkout in front of someone hosting the software themselves. It is an explicit
  // operator flag, NOT inferred from whether payment keys happen to be present, so a
  // secrets blip on a paid deployment cannot silently turn signup free.
  app.get("/api/v1/config", async () => {
    const razorpay = Boolean(app.config.RAZORPAY_KEY_ID);
    const stripe = Boolean(app.config.STRIPE_PUBLISHABLE_KEY);
    return {
      // The signup flow keys off this, and ONLY this. It is an explicit operator
      // setting, never inferred from key presence — see config.ts.
      allowUnpaidRegistration: app.config.ALLOW_UNPAID_REGISTRATION === "true",
      paymentsEnabled: razorpay || stripe,
      providers: { razorpay, stripe },
    };
  });

  // Kubernetes liveness probe — 200 if the process is up. No dependency checks so a
  // transient DB/Redis blip does not get the pod killed (that is readiness's job).
  app.get("/api/health/live", async () => {
    return { status: "alive", uptime: Math.floor((Date.now() - startedAt) / 1000), timestamp: new Date().toISOString() };
  });

  // Kubernetes readiness probe (GAP-015) — gates traffic on REAL dependency health.
  // 200 ready when the database is reachable (and a configured Redis is reachable);
  // 503 not_ready otherwise so the LB/ingress stops sending traffic to this instance.
  app.get("/api/health/ready", async (_request, reply) => {
    const [database, redis] = await Promise.all([checkDatabase(app), checkRedis(app)]);
    const checks = { database, redis };

    // Database is required for readiness; Redis only fails readiness when it is
    // CONFIGURED but unreachable (status === "error"). "skipped" (unconfigured) is fine.
    const ready = database.status === "ok" && redis.status !== "error";

    return reply.status(ready ? 200 : 503).send({
      status: ready ? "ready" : "not_ready",
      timestamp: new Date().toISOString(),
      checks,
    });
  });
};
