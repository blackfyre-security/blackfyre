import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// vi.hoisted() runs BEFORE any vi.mock() factory or module imports.
// We need awslambda on globalThis before the handler module is evaluated.
// ---------------------------------------------------------------------------
const { mockWrite, mockEnd, VALID_TOKEN, TENANT_ID, USER_ID, getDbState } =
  vi.hoisted(() => {
    const mockWrite = vi.fn();
    const mockEnd = vi.fn();
    const VALID_TOKEN = "valid-jwt-token";
    const TENANT_ID = "t-tenant-1";
    const USER_ID = "u-user-1";

    const dbState = {
      results: [] as any[],
      callIndex: 0,
    };

    (globalThis as any).awslambda = {
      streamifyResponse: (fn: any) => fn,
      HttpResponseStream: {
        from: (_stream: any, _meta: any) => ({
          write: mockWrite,
          end: mockEnd,
        }),
      },
    };

    return {
      mockWrite,
      mockEnd,
      VALID_TOKEN,
      TENANT_ID,
      USER_ID,
      getDbState: () => dbState,
    };
  });

// ---------------------------------------------------------------------------
// Mock: jose
// ---------------------------------------------------------------------------
vi.mock("jose", () => ({
  jwtVerify: vi.fn(async (token: string) => {
    if (token === VALID_TOKEN) {
      return {
        payload: { sub: USER_ID, tenantId: TENANT_ID, role: "admin", type: "access" },
        protectedHeader: { alg: "HS256" },
      };
    }
    throw new Error("Invalid token");
  }),
}));

// ---------------------------------------------------------------------------
// Mock: DB layer
// ---------------------------------------------------------------------------

// Each db.select() call creates a fresh chain. The chain collects method
// calls (from/where/orderBy/limit) and resolves when awaited. The resolution
// pops the next result from the shared dbState.results array.
function createSelectChain() {
  const state = getDbState();
  let resolved = false;

  function consume() {
    if (resolved) return Promise.resolve([]);
    resolved = true;
    const result = state.results[state.callIndex] ?? [];
    state.callIndex++;
    return Promise.resolve(result);
  }

  const chain: any = {};
  // Every chainable method returns the chain itself
  chain.from = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockReturnValue(chain);
  chain.orderBy = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockImplementation(() => consume());

  // Make the chain thenable so `await chain` works when there's no .limit()
  chain.then = (resolve: any, reject: any) => consume().then(resolve, reject);

  return chain;
}

vi.mock("postgres", () => ({
  default: vi.fn(() => vi.fn()),
}));

vi.mock("drizzle-orm/postgres-js", () => ({
  drizzle: vi.fn(() => ({
    select: vi.fn().mockImplementation(() => createSelectChain()),
  })),
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((...args: any[]) => ({ op: "eq", args })),
  and: vi.fn((...args: any[]) => ({ op: "and", args })),
  gt: vi.fn((...args: any[]) => ({ op: "gt", args })),
  asc: vi.fn((col: any) => ({ op: "asc", col })),
  sql: vi.fn(),
  count: vi.fn(() => "count(*)"),
}));

vi.mock("../../src/db/schema.js", () => ({
  scans: {
    id: "scans.id",
    tenantId: "scans.tenant_id",
    status: "scans.status",
    progress: "scans.progress",
    errorDetails: "scans.error_details",
    completedAt: "scans.completed_at",
  },
  findings: {
    id: "findings.id",
    scanId: "findings.scan_id",
    tenantId: "findings.tenant_id",
    title: "findings.title",
    severity: "findings.severity",
    category: "findings.category",
    resourceId: "findings.resource_id",
    createdAt: "findings.created_at",
  },
  controlMappings: {
    findingId: "control_mappings.finding_id",
    framework: "control_mappings.framework",
    controlId: "control_mappings.control_id",
  },
}));

// ---------------------------------------------------------------------------
// Import handler AFTER all mocks
// ---------------------------------------------------------------------------
import { handler } from "../../src/sse-handler.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeEvent(params: Record<string, string> = {}) {
  return {
    requestContext: { http: { method: "GET" } },
    queryStringParameters: params,
  };
}

function parseSseEvents(): any[] {
  return mockWrite.mock.calls
    .map((call) => {
      const raw = call[0] as string;
      const match = raw.match(/^data: (.+)\n\n$/s);
      if (!match) return null;
      return JSON.parse(match[1]);
    })
    .filter(Boolean);
}

function setDbResults(results: any[]) {
  const state = getDbState();
  state.results = results;
  state.callIndex = 0;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("sse-handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setDbResults([]);
    process.env.JWT_SECRET = "test-secret-key-for-unit-tests";
    process.env.DATABASE_URL = "postgresql://test:test@localhost/test";
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.JWT_SECRET;
    delete process.env.DATABASE_URL;
  });

  it("rejects requests with missing token query param (writes error event)", async () => {
    const event = makeEvent({ scanId: "scan-1" });
    await handler(event, {}, {});

    const events = parseSseEvents();
    expect(events.length).toBe(1);
    expect(events[0].type).toBe("error");
    expect(events[0].error).toContain("Missing required parameters");
    expect(mockEnd).toHaveBeenCalled();
  });

  it("rejects requests with invalid JWT (writes error event)", async () => {
    const event = makeEvent({ scanId: "scan-1", token: "bad-token" });
    await handler(event, {}, {});

    const events = parseSseEvents();
    expect(events.length).toBe(1);
    expect(events[0].type).toBe("error");
    expect(events[0].error).toContain("Invalid or expired token");
    expect(mockEnd).toHaveBeenCalled();
  });

  it("rejects requests for scans belonging to a different tenant (writes error event)", async () => {
    setDbResults([
      [{ id: "scan-1", tenantId: "t-OTHER-tenant", status: "running", progress: 0 }],
    ]);

    const event = makeEvent({ scanId: "scan-1", token: VALID_TOKEN });
    await handler(event, {}, {});

    const events = parseSseEvents();
    expect(events.length).toBe(1);
    expect(events[0].type).toBe("error");
    expect(events[0].error).toContain("Scan not found or access denied");
    expect(mockEnd).toHaveBeenCalled();
  });

  it("emits scan_progress event when scan progress changes", async () => {
    // The handler flow for a single poll iteration:
    //   1. Scan ownership: select().from(scans).where().limit(1)        -> consumes result[0]
    //   2. Poll progress:  select().from(scans).where().limit(1)        -> consumes result[1]
    //   3. Latest finding: select().from(findings).where().orderBy().limit(1) -> consumes result[2]
    //   4. New findings:   select().from(findings).where().orderBy()    -> consumes result[3] (thenable)
    //   5. sleep, then next iteration...
    //   6. Poll progress:  select().from(scans).where().limit(1)        -> consumes result[4]
    //   7. Latest finding: select().from(findings).where().orderBy().limit(1) -> consumes result[5]
    //   8. New findings:   select().from(findings).where().orderBy()    -> consumes result[6] (thenable)
    //   9. Count findings: select().from(findings).where()              -> consumes result[7] (thenable)
    setDbResults([
      // 1. Scan ownership
      [{ id: "scan-1", tenantId: TENANT_ID, status: "running", progress: 0 }],
      // 2. Poll 1 — scan progress
      [{ progress: 25, status: "running", errorDetails: null, completedAt: null }],
      // 3. Latest finding for category
      [{ category: "iam" }],
      // 4. New findings (empty)
      [],
      // 5. Poll 2 — scan completed
      [{ progress: 100, status: "completed", errorDetails: null, completedAt: new Date("2026-03-29") }],
      // 6. Latest finding for category
      [{ category: "s3" }],
      // 7. New findings
      [],
      // 8. Finding count
      [{ findingCount: 5 }],
    ]);

    vi.spyOn(globalThis, "setTimeout").mockImplementation((fn: any) => {
      fn();
      return 0 as any;
    });

    await handler(makeEvent({ scanId: "scan-1", token: VALID_TOKEN }), {}, {});

    const events = parseSseEvents();
    const progressEvents = events.filter((e: any) => e.type === "scan_progress");
    expect(progressEvents.length).toBeGreaterThanOrEqual(1);
    expect(progressEvents[0].progress).toBe(25);
    expect(progressEvents[0].currentCategory).toBe("iam");
  });

  it("emits new_finding event for findings with created_at > lastSeen", async () => {
    const findingDate = new Date("2026-03-29T10:00:00Z");

    setDbResults([
      // 1. Scan ownership
      [{ id: "scan-1", tenantId: TENANT_ID, status: "running", progress: 10 }],
      // 2. Poll 1 — scan progress
      [{ progress: 50, status: "running", errorDetails: null, completedAt: null }],
      // 3. Latest finding for category
      [{ category: "s3" }],
      // 4. New findings
      [{
        id: "f-1",
        title: "S3 bucket public",
        severity: "high",
        category: "s3",
        resourceId: "arn:aws:s3:::my-bucket",
        createdAt: findingDate,
      }],
      // 5. Control mappings for f-1 (thenable — no limit)
      [{ findingId: "f-1", framework: "soc2", controlId: "CC6.1" }],
      // 6. Poll 2 — scan completed
      [{ progress: 100, status: "completed", errorDetails: null, completedAt: new Date("2026-03-29T10:01:00Z") }],
      // 7. Latest finding for category
      [{ category: "s3" }],
      // 8. New findings (none after watermark)
      [],
      // 9. Finding count
      [{ findingCount: 1 }],
    ]);

    vi.spyOn(globalThis, "setTimeout").mockImplementation((fn: any) => {
      fn();
      return 0 as any;
    });

    await handler(makeEvent({ scanId: "scan-1", token: VALID_TOKEN }), {}, {});

    const events = parseSseEvents();
    const findingEvents = events.filter((e: any) => e.type === "new_finding");
    expect(findingEvents.length).toBe(1);
    expect(findingEvents[0].finding.id).toBe("f-1");
    expect(findingEvents[0].finding.title).toBe("S3 bucket public");
    expect(findingEvents[0].finding.severity).toBe("high");
    expect(findingEvents[0].finding.controlMappings).toEqual([
      { framework: "soc2", controlId: "CC6.1" },
    ]);
  });

  it("emits scan_complete event when scan status is 'completed' and closes stream", async () => {
    setDbResults([
      // 1. Scan ownership
      [{ id: "scan-1", tenantId: TENANT_ID, status: "running", progress: 0 }],
      // 2. Poll 1 — scan completed
      [{ progress: 100, status: "completed", errorDetails: null, completedAt: new Date("2026-03-29T12:00:00Z") }],
      // 3. Latest finding for category
      [{ category: "iam" }],
      // 4. New findings
      [],
      // 5. Finding count
      [{ findingCount: 12 }],
    ]);

    await handler(makeEvent({ scanId: "scan-1", token: VALID_TOKEN }), {}, {});

    const events = parseSseEvents();
    const completeEvents = events.filter((e: any) => e.type === "scan_complete");
    expect(completeEvents.length).toBe(1);
    expect(completeEvents[0].status).toBe("completed");
    expect(completeEvents[0].totalFindings).toBe(12);
    expect(completeEvents[0].completedAt).toBe("2026-03-29T12:00:00.000Z");
    expect(mockEnd).toHaveBeenCalled();
  });

  it("emits scan_failed event when scan status is 'failed' and closes stream", async () => {
    setDbResults([
      // 1. Scan ownership
      [{ id: "scan-1", tenantId: TENANT_ID, status: "running", progress: 0 }],
      // 2. Poll 1 — scan failed
      [{ progress: 30, status: "failed", errorDetails: "AWS credentials expired", completedAt: null }],
      // 3. Latest finding for category
      [{ category: "iam" }],
      // 4. New findings
      [],
      // 5. Finding count
      [{ findingCount: 3 }],
    ]);

    await handler(makeEvent({ scanId: "scan-1", token: VALID_TOKEN }), {}, {});

    const events = parseSseEvents();
    const failedEvents = events.filter((e: any) => e.type === "scan_failed");
    expect(failedEvents.length).toBe(1);
    expect(failedEvents[0].error).toBe("AWS credentials expired");
    expect(failedEvents[0].findingsBeforeFailure).toBe(3);
    expect(mockEnd).toHaveBeenCalled();
  });

  it("closes stream before 29-second Lambda timeout", async () => {
    let callCount = 0;
    const baseTime = 1_000_000;

    vi.spyOn(Date, "now").mockImplementation(() => {
      callCount++;
      if (callCount <= 1) return baseTime;
      return baseTime + 29_000;
    });

    setDbResults([
      // 1. Scan ownership
      [{ id: "scan-1", tenantId: TENANT_ID, status: "running", progress: 0 }],
    ]);

    await handler(makeEvent({ scanId: "scan-1", token: VALID_TOKEN }), {}, {});

    expect(mockEnd).toHaveBeenCalled();
    const events = parseSseEvents();
    const progressEvents = events.filter((e: any) => e.type === "scan_progress");
    expect(progressEvents.length).toBe(0);
  });
});
