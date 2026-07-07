import { describe, it, expect, vi, beforeEach } from "vitest";
import { RemediationService } from "../../src/services/remediation-service.js";

/**
 * Drizzle's chained query is awaitable at any point — `await db.select().from(t)`
 * works, and so does `await db.select().from(t).where(...).limit(1)`. The mock
 * needs to mirror that: every chain method returns the chain, AND the chain is
 * thenable so the final `await` resolves to the rows.
 */
function makeThenableChain(rows: unknown[]) {
  const chain: Record<string, unknown> = {};
  for (const method of ["from", "where", "innerJoin", "limit", "offset", "orderBy"]) {
    chain[method] = vi.fn().mockReturnValue(chain);
  }
  chain.then = (onFulfilled: (rows: unknown[]) => unknown) =>
    Promise.resolve(rows).then(onFulfilled);
  return chain as Record<string, ReturnType<typeof vi.fn>> & PromiseLike<unknown[]>;
}

function createMockDb(initialStatus = "pending", opts: { rowExists?: boolean } = {}) {
  const mockRow = {
    id: "r1",
    findingId: "f1",
    tier: "auto",
    status: initialStatus,
    approvedBy: null,
    beforeSnapshot: null,
    afterSnapshot: null,
    playbookContent: null,
    executedAt: null,
    completedAt: null,
  };
  const rowExists = opts.rowExists ?? true;

  // RemediationService uses 4 distinct select shapes:
  //   .select({ id: findings.id }).from(findings).where(...).limit(1)  → tenant check
  //   .select({ remediation: remediations }).from(...).innerJoin(...)  → get one / list
  //   .select({ count: count() }).from(...).innerJoin(...)             → total for paginated list
  // The mock switches on the projection so tests don't need to thread the right
  // rows through every chain manually.
  function makeSelectChain(projection: Record<string, unknown> | undefined) {
    const isCount = projection !== undefined && "count" in projection;
    const isTenantCheck =
      projection !== undefined && "id" in projection && !("remediation" in projection);

    if (isCount) return makeThenableChain([{ count: rowExists ? 1 : 0 }]);
    if (isTenantCheck) {
      return makeThenableChain(rowExists ? [{ id: mockRow.findingId }] : []);
    }
    // Default: { remediation: row } (matches the explicit projection in the service)
    return makeThenableChain(rowExists ? [{ remediation: { ...mockRow } }] : []);
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

// Post-marathon, every public method takes `tenantId` as the first/second arg
// for cross-tenant isolation. Tests use "t1" as the constant tenant.
const TENANT = "t1";

describe("RemediationService", () => {
  describe("create", () => {
    it("inserts a remediation record with pending status", async () => {
      const mockDb = createMockDb();
      const service = new RemediationService(mockDb as any);

      const result = await service.create(TENANT, {
        findingId: "f1",
        tier: "auto",
      });

      expect(mockDb.insert).toHaveBeenCalled();
      expect(result).toBeDefined();
      expect(result.status).toBe("pending");
    });
  });

  describe("approve", () => {
    it("transitions from pending to approved", async () => {
      const mockDb = createMockDb("pending");
      mockDb._updatedRow.status = "approved";
      mockDb._updatedRow.approvedBy = "user-1";
      const service = new RemediationService(mockDb as any);

      const result = await service.approve("r1", TENANT, "user-1");
      expect(mockDb.update).toHaveBeenCalled();
      expect(result.status).toBe("approved");
      expect(result.approvedBy).toBe("user-1");
    });

    it("rejects approval when not in pending state", async () => {
      const mockDb = createMockDb("executing");
      const service = new RemediationService(mockDb as any);

      await expect(service.approve("r1", TENANT, "user-1")).rejects.toThrow("Cannot approve");
    });
  });

  describe("execute", () => {
    it("transitions from approved to executing", async () => {
      const mockDb = createMockDb("approved");
      mockDb._updatedRow.status = "executing";
      const service = new RemediationService(mockDb as any);

      const result = await service.execute("r1", TENANT);
      expect(result.status).toBe("executing");
    });

    it("rejects execution when already completed", async () => {
      const mockDb = createMockDb("completed");
      const service = new RemediationService(mockDb as any);

      await expect(service.execute("r1", TENANT)).rejects.toThrow("Cannot execute");
    });
  });

  describe("complete", () => {
    it("transitions from executing to completed", async () => {
      const mockDb = createMockDb("executing");
      mockDb._updatedRow.status = "completed";
      const service = new RemediationService(mockDb as any);

      const result = await service.complete("r1", TENANT, { fixed: true });
      expect(result.status).toBe("completed");
    });

    it("rejects completion when not executing", async () => {
      const mockDb = createMockDb("pending");
      const service = new RemediationService(mockDb as any);

      await expect(service.complete("r1", TENANT, {})).rejects.toThrow("Cannot complete");
    });
  });

  describe("fail", () => {
    it("transitions from executing to failed", async () => {
      const mockDb = createMockDb("executing");
      mockDb._updatedRow.status = "failed";
      const service = new RemediationService(mockDb as any);

      const result = await service.fail("r1", TENANT, "timeout error");
      expect(result.status).toBe("failed");
    });
  });

  describe("rollback", () => {
    it("transitions from completed to rolled_back", async () => {
      const mockDb = createMockDb("completed");
      mockDb._updatedRow.status = "rolled_back";
      const service = new RemediationService(mockDb as any);

      const result = await service.rollback("r1", TENANT);
      expect(result.status).toBe("rolled_back");
    });

    it("transitions from failed to rolled_back", async () => {
      const mockDb = createMockDb("failed");
      mockDb._updatedRow.status = "rolled_back";
      const service = new RemediationService(mockDb as any);

      const result = await service.rollback("r1", TENANT);
      expect(result.status).toBe("rolled_back");
    });

    it("rejects rollback when in pending state", async () => {
      const mockDb = createMockDb("pending");
      const service = new RemediationService(mockDb as any);

      await expect(service.rollback("r1", TENANT)).rejects.toThrow("Cannot rollback");
    });
  });

  describe("getById", () => {
    it("returns a remediation record when found", async () => {
      const mockDb = createMockDb();
      const service = new RemediationService(mockDb as any);

      const result = await service.getById("r1", TENANT);
      expect(result.id).toBe("r1");
    });

    it("throws notFound when record does not exist", async () => {
      const mockDb = createMockDb("pending", { rowExists: false });
      const service = new RemediationService(mockDb as any);

      await expect(service.getById("nonexistent", TENANT)).rejects.toThrow("Remediation not found");
    });
  });
});
