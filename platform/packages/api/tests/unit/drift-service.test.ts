import { describe, it, expect, vi } from "vitest";
import { DriftService } from "../../src/services/drift-service.js";

function createMockDb(overrides: {
  selectResult?: unknown[];
  insertResult?: unknown[];
  updateResult?: unknown[];
} = {}) {
  const selectResult = overrides.selectResult ?? [];
  const insertResult = overrides.insertResult ?? [];
  const updateResult = overrides.updateResult ?? [];

  const chainable = (result: unknown[]) => {
    const chain: Record<string, any> = {};
    chain.from = vi.fn().mockReturnValue(chain);
    chain.where = vi.fn().mockReturnValue(chain);
    chain.limit = vi.fn().mockReturnValue(chain);
    chain.offset = vi.fn().mockReturnValue(chain);
    chain.orderBy = vi.fn().mockReturnValue(chain);
    chain.groupBy = vi.fn().mockReturnValue(chain);
    chain.returning = vi.fn().mockResolvedValue(result);
    chain.then = (resolve: (v: unknown) => void) => resolve(result);
    return chain;
  };

  const insertChain: Record<string, any> = {};
  insertChain.values = vi.fn().mockReturnValue(insertChain);
  insertChain.returning = vi.fn().mockResolvedValue(insertResult);

  const updateChain: Record<string, any> = {};
  updateChain.set = vi.fn().mockReturnValue(updateChain);
  updateChain.where = vi.fn().mockReturnValue(updateChain);
  updateChain.returning = vi.fn().mockResolvedValue(updateResult);

  return {
    select: vi.fn().mockReturnValue(chainable(selectResult)),
    insert: vi.fn().mockReturnValue(insertChain),
    update: vi.fn().mockReturnValue(updateChain),
    _insertChain: insertChain,
    _updateChain: updateChain,
  };
}

describe("DriftService", () => {
  describe("create", () => {
    it("returns the created drift event", async () => {
      const expected = {
        id: "de-001",
        tenantId: "t-1",
        integrationId: "int-1",
        changeType: "modified",
        resourceType: "aws:iam:policy",
        resourceId: "arn:aws:iam::123456:policy/Admin",
        beforeState: { effect: "Deny" },
        afterState: { effect: "Allow" },
        severity: "high",
        acknowledged: false,
        detectedAt: new Date("2026-03-26T10:00:00Z"),
      };

      const db = createMockDb({ insertResult: [expected] });
      const service = new DriftService(db as any);

      const result = await service.create("t-1", {
        integrationId: "int-1",
        changeType: "modified",
        resourceType: "aws:iam:policy",
        resourceId: "arn:aws:iam::123456:policy/Admin",
        beforeState: { effect: "Deny" },
        afterState: { effect: "Allow" },
        severity: "high",
      });

      expect(result).toEqual(expected);
      expect(db.insert).toHaveBeenCalled();
      expect(db._insertChain.values).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: "t-1",
          integrationId: "int-1",
          changeType: "modified",
          resourceType: "aws:iam:policy",
          severity: "high",
        }),
      );
    });
  });

  describe("acknowledge", () => {
    it("sets acknowledged to true", async () => {
      const updated = {
        id: "de-001",
        tenantId: "t-1",
        integrationId: "int-1",
        changeType: "modified",
        resourceType: "aws:iam:policy",
        resourceId: "arn:aws:iam::123456:policy/Admin",
        severity: "high",
        acknowledged: true,
        detectedAt: new Date("2026-03-26T10:00:00Z"),
      };

      const db = createMockDb({ updateResult: [updated] });
      const service = new DriftService(db as any);

      const result = await service.acknowledge("de-001", true);

      expect(result.acknowledged).toBe(true);
      expect(db.update).toHaveBeenCalled();
      expect(db._updateChain.set).toHaveBeenCalledWith({ acknowledged: true });
    });

    it("sets acknowledged to false", async () => {
      const updated = {
        id: "de-001",
        tenantId: "t-1",
        integrationId: "int-1",
        changeType: "created",
        resourceType: "aws:s3:bucket",
        resourceId: "my-bucket",
        severity: "medium",
        acknowledged: false,
        detectedAt: new Date("2026-03-26T10:00:00Z"),
      };

      const db = createMockDb({ updateResult: [updated] });
      const service = new DriftService(db as any);

      const result = await service.acknowledge("de-001", false);

      expect(result.acknowledged).toBe(false);
      expect(db._updateChain.set).toHaveBeenCalledWith({ acknowledged: false });
    });
  });

  describe("getStats", () => {
    it("returns correct structure with severity and changeType counts", async () => {
      // getStats runs 4 parallel queries; we need to mock select() to return
      // different results for each call.
      const totalResult = [{ count: 15 }];
      const unacknowledgedResult = [{ count: 8 }];
      const bySeverityResult = [
        { severity: "critical", count: 3 },
        { severity: "high", count: 5 },
        { severity: "medium", count: 4 },
        { severity: "low", count: 3 },
      ];
      const byChangeTypeResult = [
        { changeType: "created", count: 4 },
        { changeType: "modified", count: 7 },
        { changeType: "deleted", count: 4 },
      ];

      const results = [totalResult, unacknowledgedResult, bySeverityResult, byChangeTypeResult];
      let callIndex = 0;

      const chainable = () => {
        const idx = callIndex++;
        const result = results[idx] ?? [];
        const chain: Record<string, any> = {};
        chain.from = vi.fn().mockReturnValue(chain);
        chain.where = vi.fn().mockReturnValue(chain);
        chain.limit = vi.fn().mockReturnValue(chain);
        chain.offset = vi.fn().mockReturnValue(chain);
        chain.orderBy = vi.fn().mockReturnValue(chain);
        chain.groupBy = vi.fn().mockReturnValue(chain);
        chain.returning = vi.fn().mockResolvedValue(result);
        chain.then = (resolve: (v: unknown) => void) => resolve(result);
        return chain;
      };

      const db = {
        select: vi.fn().mockImplementation(chainable),
        insert: vi.fn(),
        update: vi.fn(),
      };

      const service = new DriftService(db as any);
      const stats = await service.getStats("t-1");

      expect(stats.total).toBe(15);
      expect(stats.unacknowledged).toBe(8);
      expect(stats.bySeverity).toEqual({
        critical: 3,
        high: 5,
        medium: 4,
        low: 3,
      });
      expect(stats.byChangeType).toEqual({
        created: 4,
        modified: 7,
        deleted: 4,
      });
    });
  });
});
