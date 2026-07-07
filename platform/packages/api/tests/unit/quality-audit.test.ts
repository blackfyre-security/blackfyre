/**
 * Quality Audit Tests
 *
 * Comprehensive edge-case and gap-coverage tests added during the
 * QUEEN BEE quality audit. Each test section maps to a specific
 * audit finding (GAP-xxx / EDGE-xxx).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { calculateFrameworkScore } from "../../src/compliance/scoring.js";
import { RemediationService } from "../../src/services/remediation-service.js";
import { NotificationDispatcher } from "../../src/services/notification-dispatcher.js";
import type { ControlDefinition } from "@blackfyre/shared";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeControl = (id: string, weight: 1 | 2 | 3): ControlDefinition => ({
  controlId: id,
  controlName: `Control ${id}`,
  description: `Description for ${id}`,
  weight,
  category: "Test",
});

/** Create a mock Drizzle-like DB object for RemediationService. */
function createRemediationMockDb(initialRow: {
  id: string;
  findingId: string;
  tier: string;
  status: string;
  approvedBy: string | null;
  beforeSnapshot: Record<string, unknown> | null;
  afterSnapshot: Record<string, unknown> | null;
  playbookContent: string | null;
  executedAt: Date | null;
  completedAt: Date | null;
}) {
  const mockRow = { ...initialRow };

  // Drizzle chains are awaitable at any point. The mock mirrors that with a
  // thenable, then switches on the projection passed to .select() so the
  // service's 3 query shapes (tenant check, getById/list, count) each get
  // the right row shape.
  function makeThenable(rows: unknown[]) {
    const chain: Record<string, unknown> = {};
    for (const m of ["from", "where", "innerJoin", "limit", "offset", "orderBy"]) {
      chain[m] = vi.fn().mockReturnValue(chain);
    }
    chain.then = (onFulfilled: (rows: unknown[]) => unknown) =>
      Promise.resolve(rows).then(onFulfilled);
    return chain;
  }
  function makeSelectChain(projection: Record<string, unknown> | undefined) {
    const isCount = projection !== undefined && "count" in projection;
    const isTenantCheck =
      projection !== undefined && "id" in projection && !("remediation" in projection);
    if (isCount) return makeThenable([{ count: 1 }]);
    if (isTenantCheck) return makeThenable([{ id: mockRow.findingId }]);
    return makeThenable([{ remediation: { ...mockRow } }]);
  }

  const updatedRow = { ...mockRow };
  const insertChain = {
    values: vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([{ ...mockRow }]),
    }),
  };
  const updateChain = {
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockImplementation(async () => [{ ...updatedRow }]),
      }),
    }),
  };

  return {
    select: vi.fn().mockImplementation((projection) => makeSelectChain(projection)),
    insert: vi.fn().mockReturnValue(insertChain),
    update: vi.fn().mockReturnValue(updateChain),
    _updatedRow: updatedRow,
    _mockRow: mockRow,
  };
}

// Constant tenant used across all RemediationService tests post-marathon.
const TENANT = "t1";

const baseRemediationRow = {
  id: "r1",
  findingId: "f1",
  tier: "approval",
  status: "pending",
  approvedBy: null,
  beforeSnapshot: null,
  afterSnapshot: null,
  playbookContent: null,
  executedAt: null,
  completedAt: null,
};

// ---------------------------------------------------------------------------
// GAP-001 / EDGE-001: Compliance scoring with all-NA controls
// ---------------------------------------------------------------------------
describe("Scoring edge cases (GAP-001)", () => {
  it("returns score 0 when ALL controls are NA across multiple controls", () => {
    const controls = [
      makeControl("C1", 3),
      makeControl("C2", 2),
      makeControl("C3", 1),
    ];
    const statusMap = new Map<string, "pass" | "fail" | "partial" | "na">([
      ["C1", "na"],
      ["C2", "na"],
      ["C3", "na"],
    ]);

    const result = calculateFrameworkScore("soc2", controls, statusMap);

    expect(result.score).toBe(0);
    expect(result.naCount).toBe(3);
    expect(result.passCount).toBe(0);
    expect(result.failCount).toBe(0);
    expect(result.partialCount).toBe(0);
    expect(result.evaluatedControls).toBe(0);
    expect(result.totalControls).toBe(3);
  });

  it("correctly handles mix of NA and not-evaluated controls", () => {
    // C1: pass (weight 3) => 3 earned
    // C2: na   => excluded
    // C3: not in map (weight 1) => fail, 0 earned
    // totalWeight = 3+1 = 4, earned = 3, score = 75
    const controls = [
      makeControl("C1", 3),
      makeControl("C2", 2),
      makeControl("C3", 1),
    ];
    const statusMap = new Map<string, "pass" | "fail" | "partial" | "na">([
      ["C1", "pass"],
      ["C2", "na"],
    ]);

    const result = calculateFrameworkScore("soc2", controls, statusMap);

    expect(result.score).toBe(75);
    expect(result.naCount).toBe(1);
    expect(result.passCount).toBe(1);
    // C3 is missing from map => not-evaluated, NOT a real failure.
    // SECURITY FIX (BLACKFYRE audit 2026-06-05): un-scanned controls bucket
    // into notEvaluatedCount, leaving failCount for real evaluated failures.
    expect(result.notEvaluatedCount).toBe(1);
    expect(result.failCount).toBe(0);
    expect(result.evaluatedControls).toBe(1); // only C1 is evaluated
  });

  it("handles single NA control", () => {
    const controls = [makeControl("C1", 3)];
    const statusMap = new Map<string, "pass" | "fail" | "partial" | "na">([
      ["C1", "na"],
    ]);

    const result = calculateFrameworkScore("soc2", controls, statusMap);

    expect(result.score).toBe(0);
    expect(result.naCount).toBe(1);
    expect(result.totalControls).toBe(1);
    expect(result.evaluatedControls).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// GAP-002 / EDGE-002: ComplianceService.getScores with empty findings
// ---------------------------------------------------------------------------
describe("ComplianceService scoring with empty data (GAP-002)", () => {
  it("calculateFrameworkScore returns 0 for framework with no evaluated controls", () => {
    // When no status entries exist (empty map), every control has 0 credit
    // but still contributes weight.
    const controls = [
      makeControl("C1", 3),
      makeControl("C2", 2),
      makeControl("C3", 1),
    ];
    const emptyMap = new Map<string, "pass" | "fail" | "partial" | "na">();

    const result = calculateFrameworkScore("soc2", controls, emptyMap);

    expect(result.score).toBe(0);
    // SECURITY FIX (BLACKFYRE audit 2026-06-05): an empty status map means
    // nothing was evaluated, so these are not-evaluated (not failures).
    expect(result.notEvaluatedCount).toBe(3);
    expect(result.failCount).toBe(0);
    expect(result.passCount).toBe(0);
    expect(result.evaluatedControls).toBe(0); // none were actually evaluated
    expect(result.totalControls).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// GAP-003 / EDGE-003: Remediation state machine — exhaustive invalid transitions
// ---------------------------------------------------------------------------
describe("Remediation state machine — all invalid transitions (GAP-003)", () => {
  // Valid transitions:
  //   pending   -> approved (approve)
  //   pending   -> executing (execute, auto-tier ONLY)
  //   approved  -> executing (execute)
  //   executing -> completed (complete)
  //   executing -> failed (fail)
  //   completed -> rolled_back (rollback)
  //   failed    -> rolled_back (rollback)
  //
  // Everything else should throw INVALID_STATE.

  // --- approve: only valid from pending ---
  const approveInvalidStates = ["approved", "executing", "completed", "failed", "rolled_back"];
  for (const status of approveInvalidStates) {
    it(`rejects approve from '${status}' state`, async () => {
      const db = createRemediationMockDb({ ...baseRemediationRow, status });
      const service = new RemediationService(db as any);
      await expect(service.approve("r1", TENANT, "user-1")).rejects.toThrow("Cannot approve");
    });
  }

  // --- execute: valid from approved; valid from pending ONLY for auto-tier ---
  it("rejects execute from pending for approval-tier", async () => {
    const db = createRemediationMockDb({
      ...baseRemediationRow,
      tier: "approval",
      status: "pending",
    });
    const service = new RemediationService(db as any);
    await expect(service.execute("r1", TENANT)).rejects.toThrow("Cannot execute");
  });

  it("rejects execute from pending for manual-tier", async () => {
    const db = createRemediationMockDb({
      ...baseRemediationRow,
      tier: "manual",
      status: "pending",
    });
    const service = new RemediationService(db as any);
    await expect(service.execute("r1", TENANT)).rejects.toThrow("Cannot execute");
  });

  it("allows execute from pending for auto-tier", async () => {
    const db = createRemediationMockDb({
      ...baseRemediationRow,
      tier: "auto",
      status: "pending",
    });
    db._updatedRow.status = "executing";
    const service = new RemediationService(db as any);
    const result = await service.execute("r1", TENANT);
    expect(result.status).toBe("executing");
  });

  const executeInvalidStates = ["executing", "completed", "failed", "rolled_back"];
  for (const status of executeInvalidStates) {
    it(`rejects execute from '${status}' state`, async () => {
      const db = createRemediationMockDb({ ...baseRemediationRow, status });
      const service = new RemediationService(db as any);
      await expect(service.execute("r1", TENANT)).rejects.toThrow("Cannot execute");
    });
  }

  // --- complete: only valid from executing ---
  const completeInvalidStates = ["pending", "approved", "completed", "failed", "rolled_back"];
  for (const status of completeInvalidStates) {
    it(`rejects complete from '${status}' state`, async () => {
      const db = createRemediationMockDb({ ...baseRemediationRow, status });
      const service = new RemediationService(db as any);
      await expect(service.complete("r1", TENANT, {})).rejects.toThrow("Cannot complete");
    });
  }

  // --- fail: only valid from executing ---
  const failInvalidStates = ["pending", "approved", "completed", "failed", "rolled_back"];
  for (const status of failInvalidStates) {
    it(`rejects fail from '${status}' state`, async () => {
      const db = createRemediationMockDb({ ...baseRemediationRow, status });
      const service = new RemediationService(db as any);
      await expect(service.fail("r1", TENANT, "error")).rejects.toThrow("Cannot fail");
    });
  }

  // --- rollback: only valid from completed or failed ---
  const rollbackInvalidStates = ["pending", "approved", "executing", "rolled_back"];
  for (const status of rollbackInvalidStates) {
    it(`rejects rollback from '${status}' state`, async () => {
      const db = createRemediationMockDb({ ...baseRemediationRow, status });
      const service = new RemediationService(db as any);
      await expect(service.rollback("r1", TENANT)).rejects.toThrow("Cannot rollback");
    });
  }
});

// ---------------------------------------------------------------------------
// GAP-004: Alert rule with missing optional fields
// ---------------------------------------------------------------------------
describe("Alert rule with missing optional fields (GAP-004)", () => {
  it("quiet hours dispatcher returns false when only quietHoursStart is set", () => {
    const dispatcher = new NotificationDispatcher();
    expect(
      dispatcher.isInQuietHours({
        quietHoursStart: "22:00",
        quietHoursEnd: null,
        quietHoursTz: null,
      }),
    ).toBe(false);
  });

  it("quiet hours dispatcher returns false when only quietHoursEnd is set", () => {
    const dispatcher = new NotificationDispatcher();
    expect(
      dispatcher.isInQuietHours({
        quietHoursStart: null,
        quietHoursEnd: "07:00",
        quietHoursTz: null,
      }),
    ).toBe(false);
  });

  it("quiet hours dispatcher returns false when only quietHoursTz is set", () => {
    const dispatcher = new NotificationDispatcher();
    expect(
      dispatcher.isInQuietHours({
        quietHoursStart: null,
        quietHoursEnd: null,
        quietHoursTz: "UTC",
      }),
    ).toBe(false);
  });

  it("quiet hours returns false when all fields are null", () => {
    const dispatcher = new NotificationDispatcher();
    expect(
      dispatcher.isInQuietHours({
        quietHoursStart: null,
        quietHoursEnd: null,
        quietHoursTz: null,
      }),
    ).toBe(false);
  });

  it("quiet hours handles start == end (zero-width window) as always-on same-day", () => {
    // When start == end, startMinutes <= endMinutes is true
    // and currentMinutes >= start && currentMinutes < end is never true
    // (since start == end means range is empty)
    const dispatcher = new NotificationDispatcher();
    expect(
      dispatcher.isInQuietHours(
        {
          quietHoursStart: "12:00",
          quietHoursEnd: "12:00",
          quietHoursTz: "UTC",
        },
        new Date("2026-03-26T12:00:00.000Z"),
      ),
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// GAP-005: Report generation with no completed scans
// ---------------------------------------------------------------------------
describe("Report generation with no completed scans (GAP-005)", () => {
  it("calculateFrameworkScore returns 0 for empty controls list (no data)", () => {
    const result = calculateFrameworkScore("soc2", [], new Map());
    expect(result.score).toBe(0);
    expect(result.totalControls).toBe(0);
    expect(result.evaluatedControls).toBe(0);
    expect(result.passCount).toBe(0);
    expect(result.failCount).toBe(0);
    expect(result.partialCount).toBe(0);
    expect(result.naCount).toBe(0);
  });

  it("scoring produces 0 when all controls are unevaluated (empty status map)", () => {
    const controls = [
      makeControl("C1", 3),
      makeControl("C2", 2),
      makeControl("C3", 1),
      makeControl("C4", 3),
    ];
    const emptyMap = new Map<string, "pass" | "fail" | "partial" | "na">();

    const result = calculateFrameworkScore("iso27001", controls, emptyMap);

    expect(result.score).toBe(0);
    // totalWeight = 3+2+1+3 = 9, earned = 0
    expect(result.totalControls).toBe(4);
    // SECURITY FIX (BLACKFYRE audit 2026-06-05): all missing from map =>
    // not-evaluated (0 credit, conservative score) rather than false failures.
    expect(result.notEvaluatedCount).toBe(4);
    expect(result.failCount).toBe(0);
    expect(result.evaluatedControls).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// GAP-006: Drift service with empty results (tested via DriftService mock)
// ---------------------------------------------------------------------------
describe("Drift service with empty results (GAP-006)", () => {
  it("DriftService.list returns empty array when no events exist", async () => {
    // Simulate DriftService behavior: list() returns whatever the DB returns
    const { DriftService } = await import("../../src/services/drift-service.js");

    const chainable = () => {
      const chain: Record<string, any> = {};
      chain.from = vi.fn().mockReturnValue(chain);
      chain.where = vi.fn().mockReturnValue(chain);
      chain.limit = vi.fn().mockReturnValue(chain);
      chain.offset = vi.fn().mockReturnValue(chain);
      chain.orderBy = vi.fn().mockReturnValue(chain);
      chain.groupBy = vi.fn().mockReturnValue(chain);
      chain.then = (resolve: (v: unknown) => void) => resolve([]);
      return chain;
    };

    const mockDb = {
      select: vi.fn().mockImplementation(chainable),
    };

    const service = new DriftService(mockDb as any);
    const result = await service.list("tenant-1");
    expect(result).toEqual({ rows: [], total: 0 });
  });

  it("DriftService.getById throws notFound for nonexistent event", async () => {
    const { DriftService } = await import("../../src/services/drift-service.js");

    const chainable = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    };

    const mockDb = {
      select: vi.fn().mockReturnValue(chainable),
    };

    const service = new DriftService(mockDb as any);
    await expect(service.getById("nonexistent")).rejects.toThrow("Drift event not found");
  });

  it("DriftService.acknowledge throws notFound for nonexistent event", async () => {
    const { DriftService } = await import("../../src/services/drift-service.js");

    const updateChain: Record<string, any> = {};
    updateChain.set = vi.fn().mockReturnValue(updateChain);
    updateChain.where = vi.fn().mockReturnValue(updateChain);
    updateChain.returning = vi.fn().mockResolvedValue([]);

    const mockDb = {
      update: vi.fn().mockReturnValue(updateChain),
    };

    const service = new DriftService(mockDb as any);
    await expect(service.acknowledge("nonexistent", true)).rejects.toThrow(
      "Drift event not found",
    );
  });
});

// ---------------------------------------------------------------------------
// GAP-007: EvidenceService.listForFinding with empty results
// ---------------------------------------------------------------------------
describe("EvidenceService.listForFinding with empty results (GAP-007)", () => {
  it("returns empty rows and total 0 when no evidence exists", async () => {
    const { EvidenceService } = await import("../../src/services/evidence-service.js");

    const chainable = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      offset: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockResolvedValue([]),
    };

    const countChainable = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([{ count: 0 }]),
    };

    let callCount = 0;
    const mockDb = {
      select: vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) return chainable;
        return countChainable;
      }),
    };

    const service = new EvidenceService(mockDb as any);
    const { rows, total } = await service.listForFinding("tenant-1", {
      limit: 25,
      offset: 0,
    });

    expect(rows).toEqual([]);
    expect(total).toBe(0);
  });

  it("returns empty rows when filtering by nonexistent findingId", async () => {
    const { EvidenceService } = await import("../../src/services/evidence-service.js");

    const chainable = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      offset: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockResolvedValue([]),
    };

    const countChainable = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([{ count: 0 }]),
    };

    let callCount = 0;
    const mockDb = {
      select: vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) return chainable;
        return countChainable;
      }),
    };

    const service = new EvidenceService(mockDb as any);
    const { rows, total } = await service.listForFinding("tenant-1", {
      findingId: "nonexistent-finding-id",
      limit: 25,
      offset: 0,
    });

    expect(rows).toEqual([]);
    expect(total).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Additional: RemediationService.listForFinding with empty results
// ---------------------------------------------------------------------------
describe("RemediationService.listForFinding with empty results", () => {
  it("returns empty rows and total 0 when no remediations exist", async () => {
    // listForFinding fires two queries in parallel: the row list and the
    // count. Both share a `.where(...)` and the count's projection has
    // `count` in it; the list's has `remediation`. Drive both off the
    // projection arg passed to .select().
    function thenable(rows: unknown[]) {
      const c: Record<string, unknown> = {};
      for (const m of ["from", "where", "innerJoin", "limit", "offset", "orderBy"]) {
        c[m] = vi.fn().mockReturnValue(c);
      }
      c.then = (f: (r: unknown[]) => unknown) => Promise.resolve(rows).then(f);
      return c;
    }
    const mockDb = {
      select: vi.fn().mockImplementation((projection?: Record<string, unknown>) => {
        if (projection && "count" in projection) return thenable([{ count: 0 }]);
        return thenable([]); // empty list shape
      }),
    };

    const service = new RemediationService(mockDb as any);
    const { rows, total } = await service.listForFinding(TENANT, {
      limit: 25,
      offset: 0,
    });

    expect(rows).toEqual([]);
    expect(total).toBe(0);
  });
});
