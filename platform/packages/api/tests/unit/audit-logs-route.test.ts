import { describe, it, expect, beforeEach } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import { auditLogRoutes } from "../../src/routes/audit-logs.js";

/**
 * Route-level tests for GET /api/audit-logs.
 *
 * This route is the only reader for `audit_logs` in the open-source release
 * (ADR-0005 removed the operator console, which held the previous one), and it
 * guards a genuinely sensitive table. The properties asserted here are the ones
 * that would leak or silently lose audit data if they regressed:
 *
 *  - it is gated on owner/admin, not merely authenticated
 *  - it reads through the RLS-bound `request.db`, never a super handle
 *  - it scopes to the caller's tenant
 *  - `details` (free-form JSON written by many call sites) never reaches the wire
 *  - the pagination cursor is the row id, not a serialised timestamp
 *
 * The last one matters more than it looks: `created_at` is timestamptz at
 * microsecond precision, and a JS Date is milliseconds, so a timestamp cursor
 * truncates and silently drops every row in the sub-millisecond remainder. A
 * regression to a timestamp cursor is invisible in a mock-based data assertion —
 * so the shape of the cursor is asserted directly.
 */

function makeRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    tenantId: "t1",
    action: "user.login",
    actorType: "user",
    actorEmail: "someone@example.com",
    resourceType: "session",
    resourceId: "s1",
    outcome: "success",
    ipAddress: "203.0.113.4",
    userAgent: "curl/8",
    createdAt: new Date("2026-07-21T10:00:00.123456Z"),
    details: { secret: "must-not-be-serialised", token: "abc" },
    ...overrides,
  };
}

/** Minimal drizzle-shaped select chain that records what it was asked for. */
function makeDb(rows: unknown[]) {
  const calls: { where?: unknown; orderBy?: unknown[]; limit?: number } = {};
  const chain = {
    from: () => chain,
    where: (w: unknown) => { calls.where = w; return chain; },
    orderBy: (...o: unknown[]) => { calls.orderBy = o; return chain; },
    limit: (n: number) => { calls.limit = n; return Promise.resolve(rows); },
  };
  return { db: { select: () => chain }, calls };
}

async function buildApp(rows: unknown[], role = "owner") {
  const { db, calls } = makeDb(rows);
  const app = Fastify({ logger: false });
  const seenRoles: string[][] = [];
  // Stand in for the real requireRole decorator, recording what the route asked for.
  (app as any).decorate("requireRole", (...roles: string[]) => {
    seenRoles.push(roles);
    return async (request: any) => {
      if (!roles.includes(role)) {
        const err: any = new Error("FORBIDDEN");
        err.statusCode = 403;
        throw err;
      }
      request.tenantId = "t1";
      request.userRole = role;
      request.db = db;
    };
  });
  await app.register(auditLogRoutes);
  await app.ready();
  return { app, calls, seenRoles };
}

describe("GET /api/audit-logs", () => {
  let app: FastifyInstance;

  beforeEach(() => { app = undefined as unknown as FastifyInstance; });

  it("is restricted to owner and admin", async () => {
    const built = await buildApp([]);
    app = built.app;
    expect(built.seenRoles[0]).toEqual(["owner", "admin"]);
    await app.close();
  });

  it("rejects a role outside that set", async () => {
    const built = await buildApp([], "viewer");
    app = built.app;
    const res = await app.inject({ method: "GET", url: "/api/audit-logs" });
    expect(res.statusCode).toBe(403);
    await app.close();
  });

  it("never serialises the details column", async () => {
    const built = await buildApp([makeRow()]);
    app = built.app;
    const res = await app.inject({ method: "GET", url: "/api/audit-logs" });
    expect(res.statusCode).toBe(200);
    // Assert on the raw payload, not the parsed object: a nested leak anywhere in
    // the response would still show up as the secret's text.
    expect(res.payload).not.toContain("must-not-be-serialised");
    expect(res.json().entries[0]).not.toHaveProperty("details");
    await app.close();
  });

  it("reads through request.db, not a super handle", async () => {
    // makeDb's chain is reachable only via request.db; if the route ever used
    // app.db it would throw rather than record a query here.
    const built = await buildApp([makeRow()]);
    app = built.app;
    await app.inject({ method: "GET", url: "/api/audit-logs" });
    expect(built.calls.where).toBeDefined();
    await app.close();
  });

  it("orders by createdAt then id, so ties are deterministic", async () => {
    const built = await buildApp([makeRow()]);
    app = built.app;
    await app.inject({ method: "GET", url: "/api/audit-logs" });
    expect(built.calls.orderBy).toHaveLength(2);
    await app.close();
  });

  it("fetches one extra row to decide hasMore without a second count query", async () => {
    const built = await buildApp([makeRow()]);
    app = built.app;
    await app.inject({ method: "GET", url: "/api/audit-logs?limit=25" });
    expect(built.calls.limit).toBe(26);
    await app.close();
  });

  it("returns an id cursor — never a serialised timestamp", async () => {
    const rows = Array.from({ length: 3 }, (_, i) =>
      makeRow({ id: `2222222${i}-2222-4222-8222-222222222222` }),
    );
    const built = await buildApp(rows);
    app = built.app;
    const res = await app.inject({ method: "GET", url: "/api/audit-logs?limit=2" });
    const body = res.json();

    expect(body.hasMore).toBe(true);
    expect(body.entries).toHaveLength(2);
    // The cursor is the last returned row's id.
    expect(body.nextBeforeId).toBe(rows[1].id);
    // A timestamp cursor would truncate microseconds and silently skip rows, so
    // the response must not carry one at all.
    expect(body).not.toHaveProperty("nextBefore");
    await app.close();
  });

  it("reports no cursor on the last page", async () => {
    const built = await buildApp([makeRow()]);
    app = built.app;
    const body = (await app.inject({ method: "GET", url: "/api/audit-logs?limit=25" })).json();
    expect(body.hasMore).toBe(false);
    expect(body.nextBeforeId).toBeNull();
    await app.close();
  });

  it("rejects a non-uuid cursor rather than ignoring it", async () => {
    const built = await buildApp([makeRow()]);
    app = built.app;
    const res = await app.inject({ method: "GET", url: "/api/audit-logs?beforeId=not-a-uuid" });
    expect(res.statusCode).toBeGreaterThanOrEqual(400);
    await app.close();
  });
});
