import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { AlertService } from "../../src/services/alert-service.js";

/**
 * Unit tests for AlertService.
 *
 * These tests use a mock DB to verify service logic without a real database.
 * The quiet-hours tests rely on the NotificationDispatcher (tested separately).
 */

function createMockDb(overrides: {
  selectResult?: unknown[];
  insertResult?: unknown[];
  updateResult?: unknown[];
  deleteResult?: unknown[];
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

  const deleteChain: Record<string, any> = {};
  deleteChain.where = vi.fn().mockResolvedValue(undefined);

  return {
    select: vi.fn().mockReturnValue(chainable(selectResult)),
    insert: vi.fn().mockReturnValue(insertChain),
    update: vi.fn().mockReturnValue(updateChain),
    delete: vi.fn().mockReturnValue(deleteChain),
    _insertChain: insertChain,
    _updateChain: updateChain,
  };
}

describe("AlertService", () => {
  describe("create", () => {
    it("returns the created alert rule", async () => {
      const expected = {
        id: "aaa-111",
        tenantId: "t-1",
        triggerType: "severity",
        triggerConfig: { severity: "critical" },
        channels: ["email"],
        quietHoursStart: null,
        quietHoursEnd: null,
        quietHoursTz: null,
        enabled: true,
      };

      const db = createMockDb({ insertResult: [expected] });
      const service = new AlertService(db as any);

      const result = await service.create("t-1", {
        triggerType: "severity",
        triggerConfig: { severity: "critical" },
        channels: ["email"],
      });

      expect(result).toEqual(expected);
      expect(db.insert).toHaveBeenCalled();
      expect(db._insertChain.values).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: "t-1",
          triggerType: "severity",
          channels: ["email"],
          enabled: true,
        }),
      );
    });

    it("passes quiet hours fields when provided", async () => {
      const expected = {
        id: "aaa-222",
        tenantId: "t-1",
        triggerType: "drift",
        triggerConfig: {},
        channels: ["slack"],
        quietHoursStart: "22:00",
        quietHoursEnd: "07:00",
        quietHoursTz: "America/New_York",
        enabled: true,
      };

      const db = createMockDb({ insertResult: [expected] });
      const service = new AlertService(db as any);

      const result = await service.create("t-1", {
        triggerType: "drift",
        triggerConfig: {},
        channels: ["slack"],
        quietHoursStart: "22:00",
        quietHoursEnd: "07:00",
        quietHoursTz: "America/New_York",
      });

      expect(result.quietHoursStart).toBe("22:00");
      expect(result.quietHoursEnd).toBe("07:00");
      expect(result.quietHoursTz).toBe("America/New_York");
    });
  });

  describe("toggle", () => {
    it("sets enabled to false", async () => {
      const updated = {
        id: "aaa-111",
        tenantId: "t-1",
        triggerType: "severity",
        triggerConfig: {},
        channels: ["email"],
        quietHoursStart: null,
        quietHoursEnd: null,
        quietHoursTz: null,
        enabled: false,
      };

      const db = createMockDb({ updateResult: [updated] });
      const service = new AlertService(db as any);

      const result = await service.toggle("aaa-111", "t-1", false);

      expect(result.enabled).toBe(false);
      expect(db.update).toHaveBeenCalled();
      expect(db._updateChain.set).toHaveBeenCalledWith({ enabled: false });
    });

    it("sets enabled to true", async () => {
      const updated = {
        id: "aaa-111",
        tenantId: "t-1",
        triggerType: "severity",
        triggerConfig: {},
        channels: ["email"],
        quietHoursStart: null,
        quietHoursEnd: null,
        quietHoursTz: null,
        enabled: true,
      };

      const db = createMockDb({ updateResult: [updated] });
      const service = new AlertService(db as any);

      const result = await service.toggle("aaa-111", "t-1", true);

      expect(result.enabled).toBe(true);
      expect(db._updateChain.set).toHaveBeenCalledWith({ enabled: true });
    });
  });

  describe("testRule", () => {
    it("returns test result with channel info", async () => {
      const rule = {
        id: "aaa-111",
        tenantId: "t-1",
        triggerType: "severity",
        triggerConfig: {},
        channels: ["email", "slack"],
        quietHoursStart: null,
        quietHoursEnd: null,
        quietHoursTz: null,
        enabled: true,
      };

      const db = createMockDb({ selectResult: [rule] });
      const service = new AlertService(db as any);

      const result = await service.testRule("aaa-111");

      expect(result.ruleId).toBe("aaa-111");
      expect(result.testResult).toBe("ok");
      expect(result.channels).toEqual(["email", "slack"]);
      expect(result.message).toContain("2 channel(s)");
    });
  });
});
