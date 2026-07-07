/**
 * SSE Lambda handler for real-time scan progress streaming.
 *
 * Uses Lambda response streaming (awslambda.streamifyResponse) to emit
 * text/event-stream events. Polls the DB every 1.5s and pushes:
 *   - scan_progress  (percentage + current category)
 *   - new_finding     (each new finding with control mappings)
 *   - scan_complete   (terminal — closes stream)
 *   - scan_failed     (terminal — closes stream)
 *
 * Browser connects via EventSource with ?scanId=<uuid> and either an
 * `Authorization: Bearer <jwt>` header (preferred) or, only when the EventSource
 * client cannot set headers, a `?token=<jwt>` query param. The query token is
 * NEVER logged (see scrubbing below).
 */

import { jwtVerify } from "jose";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq, and, gt, asc, sql, count } from "drizzle-orm";
import { Redis } from "ioredis";
import * as schema from "./db/schema.js";
import type {
  SseEvent,
  ScanProgressEvent,
  NewFindingEvent,
  ScanCompleteEvent,
  ScanFailedEvent,
} from "@blackfyre/shared";

// ---------------------------------------------------------------------------
// Lambda streaming runtime globals (available at runtime, not importable)
// ---------------------------------------------------------------------------
declare const awslambda: {
  streamifyResponse: (handler: StreamHandler) => any;
  HttpResponseStream: {
    from(
      responseStream: any,
      metadata: { statusCode: number; headers: Record<string, string> },
    ): any;
  };
};

type StreamHandler = (
  event: any,
  responseStream: any,
  context: any,
) => Promise<void>;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const POLL_INTERVAL_MS = 1500;
const MAX_DURATION_MS = 14 * 60 * 1000; // stay under 15m Lambda timeout

// REAL IMPL (BLACKFYRE 2026-06): SSE per-connection cap & rate limit are now backed by
// the SHARED Redis store so the caps are GLOBAL across Lambda instances. Previously the
// counters lived in per-instance Maps, so behind N instances the effective limit became
// N x cap (weak DoS protection). The streaming Lambda runtime has no Fastify `app`, so we
// construct an ioredis client directly from REDIS_URL (lazily, reused across warm
// invocations). FAIL-CLOSED contract: when REDIS_URL is configured but the store is
// unavailable / errors, we REJECT the connection (deny) rather than admit unbounded
// streams. When REDIS_URL is UNSET (dev / test / single-instance) there is no distributed
// store to honour, so we fall back to the prior in-memory caps (fail-safe, behaviour
// unchanged for the happy path).
const MAX_CONCURRENT_PER_TENANT = 10;
const CONNECT_WINDOW_MS = 60_000;
const MAX_CONNECTS_PER_WINDOW = 60;
// Safety TTL on the per-tenant concurrency counter so a crashed/timed-out instance that
// never DECRements cannot permanently inflate the count and deny service. Comfortably
// larger than MAX_DURATION_MS so a live long-poll is never prematurely reset.
const CONCURRENCY_KEY_TTL_SEC = 16 * 60;
const REDIS_NS = "sse:";

// In-memory fallbacks — ONLY used when REDIS_URL is unset (no distributed store).
// Concurrent open streams per tenant on this instance.
const activeConnections = new Map<string, number>();
// Sliding-window connection-establishment counter per tenant on this instance.
const connectWindow = new Map<string, { count: number; resetAt: number }>();

// SECURITY FIX (BLACKFYRE audit 2026-06-05): evict expired connectWindow entries so
// the Map cannot grow unbounded across many short-lived tenants over a long-running
// instance's lifetime (slow memory leak / resource exhaustion). Entries are logically
// reset every window but were never removed; sweep stale ones every 60s.
setInterval(() => {
  const now = Date.now();
  for (const [tenantId, win] of connectWindow) {
    if (win.resetAt < now) connectWindow.delete(tenantId);
  }
}, 60_000).unref();

// REAL IMPL (BLACKFYRE 2026-06): lazily-initialized, warm-reused ioredis client for the
// streaming Lambda. Returns null when REDIS_URL is unset (dev/test/single-instance) so
// callers transparently fall back to the in-memory caps. Connection errors are logged as
// structured warnings but never throw at module scope; per-op errors fail closed below.
let redisClient: Redis | null = null;
let redisInitialized = false;

function getRedis(): Redis | null {
  if (redisInitialized) return redisClient;
  redisInitialized = true;
  const url = process.env.REDIS_URL?.trim();
  if (!url) {
    // No shared store configured — caps fall back to per-instance in-memory state.
    return null;
  }
  try {
    redisClient = new Redis(url, {
      lazyConnect: true,
      maxRetriesPerRequest: 2,
      enableReadyCheck: true,
      retryStrategy: (times: number) => Math.min(times * 200, 5_000),
    });
    // Never log the URL (it can embed credentials); only the error message.
    redisClient.on("error", (err: Error) => {
      logSse("warn", "sse.redis.error", { msg: err.message });
    });
    redisClient.connect().catch((err: Error) => {
      logSse("warn", "sse.redis.connect_failed", { msg: err.message });
    });
  } catch (err) {
    logSse("warn", "sse.redis.init_failed", {
      msg: err instanceof Error ? err.message : "unknown",
    });
    redisClient = null;
  }
  return redisClient;
}

// SECURITY FIX (BLACKFYRE audit 2026-06-05): structured stdout logging for the SSE
// Lambda (no Fastify/pino instance available in the streaming runtime). Emits a single
// JSON line per security-relevant event for CloudWatch. NEVER pass tokens/secrets here.
function logSse(
  level: "info" | "warn" | "error",
  event: string,
  fields: Record<string, unknown> = {},
): void {
  try {
    const line = JSON.stringify({ level, event, component: "sse-handler", ...fields });
    if (level === "error") console.error(line);
    else if (level === "warn") console.warn(line);
    else console.log(line);
  } catch {
    // Logging must never break the stream.
  }
}

type AcquireResult =
  | { ok: true; backend: "redis" | "memory" }
  | { ok: false; reason: "concurrency" | "rate" | "store_unavailable" };

// REAL IMPL (BLACKFYRE 2026-06): in-memory acquire — ONLY reached when REDIS_URL is
// unset. Reserves a slot in both the concurrency and rate accounting on this instance.
function tryAcquireInMemory(tenantId: string): AcquireResult {
  const now = Date.now();

  // Rate limit: connection establishments per tenant per window.
  let win = connectWindow.get(tenantId);
  if (!win || win.resetAt < now) {
    win = { count: 0, resetAt: now + CONNECT_WINDOW_MS };
    connectWindow.set(tenantId, win);
  }
  if (win.count >= MAX_CONNECTS_PER_WINDOW) {
    return { ok: false, reason: "rate" };
  }

  // Concurrency cap: simultaneous open streams per tenant.
  const open = activeConnections.get(tenantId) ?? 0;
  if (open >= MAX_CONCURRENT_PER_TENANT) {
    return { ok: false, reason: "concurrency" };
  }

  win.count++;
  activeConnections.set(tenantId, open + 1);
  return { ok: true, backend: "memory" };
}

// REAL IMPL (BLACKFYRE 2026-06): distributed acquire on the SHARED Redis store. Both caps
// are GLOBAL across Lambda instances. Atomic primitives:
//   * rate window  -> INCR rl key; first hit sets EXPIRE (self-expiring window).
//   * concurrency  -> INCR active key (refresh a safety TTL); on cap breach DECR back.
// FAIL CLOSED: any Redis error denies the connection (reason "store_unavailable") rather
// than admitting an unbounded stream. On a concurrency-cap breach we DECR the speculative
// increment so a rejected attempt does not leak a slot.
async function tryAcquireRedis(redis: Redis, tenantId: string): Promise<AcquireResult> {
  const rateKey = `${REDIS_NS}rl:${tenantId}`;
  const activeKey = `${REDIS_NS}active:${tenantId}`;
  try {
    // 1) Rate limit window.
    const rateCount = await redis.incr(rateKey);
    if (rateCount === 1) {
      await redis.expire(rateKey, Math.ceil(CONNECT_WINDOW_MS / 1000));
    }
    if (rateCount > MAX_CONNECTS_PER_WINDOW) {
      return { ok: false, reason: "rate" };
    }

    // 2) Concurrency cap. Increment first, then check; roll back if over.
    const openCount = await redis.incr(activeKey);
    // Refresh the safety TTL so a stranded counter self-heals if a release is missed.
    await redis.expire(activeKey, CONCURRENCY_KEY_TTL_SEC);
    if (openCount > MAX_CONCURRENT_PER_TENANT) {
      // Roll back the speculative increment so the rejected attempt frees its slot.
      await redis.decr(activeKey).catch(() => {});
      return { ok: false, reason: "concurrency" };
    }

    return { ok: true, backend: "redis" };
  } catch (err) {
    // Store configured but unavailable → FAIL CLOSED (deny). Never log the URL/secrets.
    logSse("warn", "sse.cap.fail_closed", {
      tenantId,
      reason: "redis_error",
      msg: err instanceof Error ? err.message : "unknown",
    });
    return { ok: false, reason: "store_unavailable" };
  }
}

// Returns ok:true (reserving a slot) when the tenant may open another connection.
// Uses Redis (global cap, fail-closed) when REDIS_URL is configured; otherwise the
// per-instance in-memory caps. The caller MUST reject on ok:false.
async function tryAcquireConnectionSlot(tenantId: string): Promise<AcquireResult> {
  const redis = getRedis();
  if (redis) return tryAcquireRedis(redis, tenantId);
  return tryAcquireInMemory(tenantId);
}

// REAL IMPL (BLACKFYRE 2026-06): release a held connection slot. On Redis, DECR the
// per-tenant active counter (floored at 0 to avoid a stranded negative). In-memory path
// mirrors the prior behaviour. Best-effort: a release failure is logged, never thrown.
async function releaseConnectionSlot(tenantId: string, backend: "redis" | "memory"): Promise<void> {
  if (backend === "redis") {
    const redis = getRedis();
    if (!redis) return;
    const activeKey = `${REDIS_NS}active:${tenantId}`;
    try {
      const remaining = await redis.decr(activeKey);
      // Guard against an underflow (e.g. a counter reset by TTL between acquire/release).
      if (remaining < 0) await redis.set(activeKey, "0");
    } catch (err) {
      logSse("warn", "sse.cap.release_failed", {
        tenantId,
        msg: err instanceof Error ? err.message : "unknown",
      });
    }
    return;
  }
  const open = activeConnections.get(tenantId) ?? 0;
  if (open <= 1) activeConnections.delete(tenantId);
  else activeConnections.set(tenantId, open - 1);
}

const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS ?? "http://localhost:3001,http://localhost:3003")
  .split(",")
  .map((o) => o.trim());

function getCorsOrigin(origin: string | undefined): string {
  if (origin && ALLOWED_ORIGINS.includes(origin)) return origin;
  return ALLOWED_ORIGINS[0] ?? "";
}

function getCorsHeaders(origin: string | undefined): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": getCorsOrigin(origin),
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createDb() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL must be set");
  }
  const client = postgres(connectionString, { max: 5 });
  return drizzle(client, { schema });
}

function writeSseEvent(stream: any, event: SseEvent | { type: string; error: string }): void {
  stream.write(`data: ${JSON.stringify(event)}\n\n`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------
export const handler = awslambda.streamifyResponse(
  async (event: any, responseStream: any, _context: any) => {
    // --- CORS preflight ------------------------------------------------
    const method =
      event.requestContext?.http?.method ??
      event.httpMethod ??
      "GET";
    const requestOrigin: string | undefined =
      event.headers?.origin ?? event.headers?.Origin;

    if (method === "OPTIONS") {
      const preflight = awslambda.HttpResponseStream.from(responseStream, {
        statusCode: 200,
        headers: getCorsHeaders(requestOrigin),
      });
      preflight.end();
      return;
    }

    // --- Parse query parameters ----------------------------------------
    const qs = event.queryStringParameters ?? {};
    const scanId: string | undefined = qs.scanId;

    // SECURITY FIX (BLACKFYRE audit 2026-06-05): SSE token handling — prefer the
    // Authorization: Bearer header (not logged by gateways) over the ?token= query
    // param (which lands in access logs / browser history / referrers). Only fall
    // back to the query token when the header is absent (EventSource cannot set
    // headers). Whenever the query token is used we MUST scrub it before any logging.
    const authHeader: string | undefined =
      event.headers?.authorization ?? event.headers?.Authorization;
    const headerToken =
      authHeader && /^Bearer\s+/i.test(authHeader)
        ? authHeader.replace(/^Bearer\s+/i, "").trim()
        : undefined;
    const queryToken: string | undefined = qs.token;
    const token: string | undefined = headerToken ?? queryToken;
    const tokenFromQuery = !headerToken && Boolean(queryToken);

    if (tokenFromQuery) {
      // Visibility into the riskier path WITHOUT ever emitting the token value.
      logSse("warn", "sse.token.query_param_used", {
        scanId,
        msg: "SSE token supplied via query string; prefer Authorization header",
      });
    }

    if (!scanId || !token) {
      const errStream = awslambda.HttpResponseStream.from(responseStream, {
        statusCode: 200,
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
          ...getCorsHeaders(requestOrigin),
        },
      });
      // SECURITY FIX (BLACKFYRE audit 2026-06-05): the token may now arrive via the
      // Authorization: Bearer header, so the old "query parameters" wording misled
      // consumers. Describe both accepted token transports explicitly.
      writeSseEvent(errStream, {
        type: "error",
        error:
          "Missing required parameters: scanId and token (provide token via Authorization: Bearer header or ?token=<jwt>)",
      });
      errStream.end();
      return;
    }

    // --- Validate JWT --------------------------------------------------
    let tenantId: string;
    let userId: string | undefined;
    try {
      const jwtSecret = process.env.JWT_SECRET;
      if (!jwtSecret) {
        throw new Error("JWT_SECRET must be set");
      }
      const secret = new TextEncoder().encode(jwtSecret);
      // Pin the algorithm so a forged token cannot dictate its own (mirrors auth.ts).
      const { payload } = await jwtVerify(token, secret, { algorithms: ["HS256"] });

      // SECURITY FIX (BLACKFYRE audit 2026-06-05): SSE token-type confusion — this
      // endpoint previously accepted ANY valid JWT, so a refresh / password_reset /
      // mfa_challenge token could open a real-time data stream. Require type==="access"
      // and a bound tenant; reject everything else.
      const tokenType = (payload as any).type;
      if (tokenType !== "access") {
        logSse("warn", "sse.auth.wrong_token_type", {
          scanId,
          tokenType: typeof tokenType === "string" ? tokenType : "unknown",
          tokenFromQuery,
          msg: "Rejected SSE connection: token is not an access token",
        });
        throw new Error("Token is not an access token");
      }

      tenantId = (payload as any).tenantId;
      userId = (payload as any).sub;
      if (!tenantId) {
        throw new Error("tenantId missing from token");
      }
    } catch (err) {
      logSse("warn", "sse.auth.rejected", {
        scanId,
        tokenFromQuery,
        // Reason only — never the token itself.
        reason: err instanceof Error ? err.message : "invalid token",
      });
      const errStream = awslambda.HttpResponseStream.from(responseStream, {
        statusCode: 200,
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
          ...getCorsHeaders(requestOrigin),
        },
      });
      writeSseEvent(errStream, { type: "error", error: "Invalid or expired token" });
      errStream.end();
      return;
    }

    // --- Per-connection cap & rate limit (post-auth, keyed by tenant) ---
    // SECURITY FIX (BLACKFYRE audit 2026-06-05): bound concurrent streams and the
    // connection rate per tenant to blunt resource-exhaustion DoS on this endpoint.
    // REAL IMPL (BLACKFYRE 2026-06): caps are now GLOBAL (Redis) when REDIS_URL is set,
    // and fail CLOSED when the shared store is unavailable.
    const slot = await tryAcquireConnectionSlot(tenantId);
    if (!slot.ok) {
      logSse("warn", "sse.throttled", {
        scanId,
        tenantId,
        userId,
        reason: slot.reason,
        msg:
          slot.reason === "concurrency"
            ? "Too many concurrent SSE streams for tenant"
            : slot.reason === "rate"
              ? "SSE connection rate limit exceeded for tenant"
              : "SSE cap store unavailable; failing closed",
      });
      const errStream = awslambda.HttpResponseStream.from(responseStream, {
        statusCode: 200,
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
          ...getCorsHeaders(requestOrigin),
        },
      });
      writeSseEvent(errStream, {
        type: "error",
        error:
          slot.reason === "store_unavailable"
            ? "Service temporarily unavailable. Try again later."
            : "Too many concurrent connections. Try again later.",
      });
      errStream.end();
      return;
    }

    // From here on a connection slot is held — guarantee its release in `finally`.
    // Capture the backend so release targets the same store the slot was taken from.
    const slotBackend = slot.backend;
    try {
    // --- Verify scan ownership -----------------------------------------
    const db = createDb();

    const [scanRow] = await db
      .select({
        id: schema.scans.id,
        tenantId: schema.scans.tenantId,
        status: schema.scans.status,
        progress: schema.scans.progress,
      })
      .from(schema.scans)
      .where(eq(schema.scans.id, scanId))
      .limit(1);

    if (!scanRow || scanRow.tenantId !== tenantId) {
      // SECURITY FIX (BLACKFYRE audit 2026-06-05): log cross-tenant / not-found scan
      // access denials (403-equivalent) for the SSE stream without leaking the token.
      logSse("warn", "sse.access_denied", {
        scanId,
        tenantId,
        userId,
        found: Boolean(scanRow),
        msg: "Scan not found or belongs to another tenant",
      });
      const errStream = awslambda.HttpResponseStream.from(responseStream, {
        statusCode: 200,
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
          ...getCorsHeaders(requestOrigin),
        },
      });
      writeSseEvent(errStream, {
        type: "error",
        error: "Scan not found or access denied",
      });
      errStream.end();
      return;
    }

    // --- Start streaming -----------------------------------------------
    // Sensitive-but-normal access: an authenticated tenant opened a live data stream.
    logSse("info", "sse.stream.opened", {
      scanId,
      tenantId,
      userId,
      tokenFromQuery,
    });
    const httpStream = awslambda.HttpResponseStream.from(responseStream, {
      statusCode: 200,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        ...getCorsHeaders(requestOrigin),
      },
    });

    const startTime = Date.now();
    let lastProgress = -1;
    let lastSeenAt = new Date(0); // epoch — get all findings on first poll

    // --- Poll loop ------------------------------------------------------
    while (Date.now() - startTime < MAX_DURATION_MS) {
      // 1) Query scan progress
      const [currentScan] = await db
        .select({
          progress: schema.scans.progress,
          status: schema.scans.status,
          errorDetails: schema.scans.errorDetails,
          completedAt: schema.scans.completedAt,
        })
        .from(schema.scans)
        .where(eq(schema.scans.id, scanId))
        .limit(1);

      if (!currentScan) {
        writeSseEvent(httpStream, { type: "error", error: "Scan disappeared" });
        break;
      }

      // 2) Emit progress if changed
      if (currentScan.progress !== lastProgress) {
        lastProgress = currentScan.progress;

        // Derive current category from most recent finding
        let currentCategory = "initializing";
        const [latestFinding] = await db
          .select({ category: schema.findings.category })
          .from(schema.findings)
          .where(eq(schema.findings.scanId, scanId))
          .orderBy(sql`${schema.findings.createdAt} desc`)
          .limit(1);

        if (latestFinding) {
          currentCategory = latestFinding.category;
        }

        const progressEvent: ScanProgressEvent = {
          type: "scan_progress",
          progress: currentScan.progress,
          currentCategory,
        };
        writeSseEvent(httpStream, progressEvent);
      }

      // 3) Query new findings since lastSeen
      const newFindings = await db
        .select({
          id: schema.findings.id,
          title: schema.findings.title,
          severity: schema.findings.severity,
          category: schema.findings.category,
          resourceId: schema.findings.resourceId,
          createdAt: schema.findings.createdAt,
        })
        .from(schema.findings)
        .where(
          and(
            eq(schema.findings.scanId, scanId),
            gt(schema.findings.createdAt, lastSeenAt),
          ),
        )
        .orderBy(asc(schema.findings.createdAt));

      if (newFindings.length > 0) {
        // Batch-fetch control mappings for ALL new findings in one query
        const findingIds = newFindings.map((f) => f.id);
        const allMappings = await db
          .select({
            findingId: schema.controlMappings.findingId,
            framework: schema.controlMappings.framework,
            controlId: schema.controlMappings.controlId,
          })
          .from(schema.controlMappings)
          .where(sql`${schema.controlMappings.findingId} IN ${findingIds}`);

        // Group mappings by findingId
        const mappingsByFinding = new Map<string, { framework: string; controlId: string }[]>();
        for (const m of allMappings) {
          const arr = mappingsByFinding.get(m.findingId) ?? [];
          arr.push({ framework: m.framework, controlId: m.controlId });
          mappingsByFinding.set(m.findingId, arr);
        }

        for (const finding of newFindings) {
          const findingEvent: NewFindingEvent = {
            type: "new_finding",
            finding: {
              id: finding.id,
              title: finding.title,
              severity: finding.severity,
              category: finding.category,
              resourceId: finding.resourceId,
              controlMappings: mappingsByFinding.get(finding.id) ?? [],
            },
          };
          writeSseEvent(httpStream, findingEvent);

          // Advance lastSeen watermark
          if (finding.createdAt && finding.createdAt > lastSeenAt) {
            lastSeenAt = finding.createdAt;
          }
        }
      }

      // 4) Terminal states
      if (
        currentScan.status === "completed" ||
        currentScan.status === "completed_partial"
      ) {
        const [{ findingCount }] = await db
          .select({ findingCount: count() })
          .from(schema.findings)
          .where(eq(schema.findings.scanId, scanId));

        const completeEvent: ScanCompleteEvent = {
          type: "scan_complete",
          status: currentScan.status as "completed" | "completed_partial",
          totalFindings: Number(findingCount),
          completedAt: currentScan.completedAt?.toISOString() ?? new Date().toISOString(),
        };
        writeSseEvent(httpStream, completeEvent);
        break;
      }

      if (currentScan.status === "failed") {
        const [{ findingCount }] = await db
          .select({ findingCount: count() })
          .from(schema.findings)
          .where(eq(schema.findings.scanId, scanId));

        const failedEvent: ScanFailedEvent = {
          type: "scan_failed",
          error: currentScan.errorDetails ?? "Unknown error",
          findingsBeforeFailure: Number(findingCount),
        };
        writeSseEvent(httpStream, failedEvent);
        break;
      }

      // 5) Sleep before next poll
      await sleep(POLL_INTERVAL_MS);
    }

    httpStream.end();
    } finally {
      // SECURITY FIX (BLACKFYRE audit 2026-06-05): always free the per-tenant
      // connection slot so a crashed/timed-out stream cannot permanently consume a
      // slot and deny service to the tenant. REAL IMPL (BLACKFYRE 2026-06): release
      // against the same backend (Redis or in-memory) the slot was acquired from.
      await releaseConnectionSlot(tenantId, slotBackend);
      logSse("info", "sse.stream.closed", { scanId, tenantId, userId });
    }
  },
);
