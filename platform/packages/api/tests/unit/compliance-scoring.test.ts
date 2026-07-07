import { describe, it, expect } from "vitest";
import { calculateFrameworkScore } from "../../src/compliance/scoring.js";
import { getFrameworkRegistry } from "../../src/compliance/control-registry.js";
import type { ControlDefinition } from "@blackfyre/shared";

/** Helper to build a minimal ControlDefinition for testing. */
const makeControl = (id: string, weight: 1 | 2 | 3): ControlDefinition => ({
  controlId: id,
  controlName: `Control ${id}`,
  description: `Description for ${id}`,
  weight,
  category: "Test",
});

describe("calculateFrameworkScore", () => {
  it("returns 100% when all controls pass", () => {
    const controls = [
      makeControl("C1", 3),
      makeControl("C2", 2),
      makeControl("C3", 1),
    ];
    const statusMap = new Map<string, "pass" | "partial" | "fail" | "na">([
      ["C1", "pass"],
      ["C2", "pass"],
      ["C3", "pass"],
    ]);

    const result = calculateFrameworkScore("soc2", controls, statusMap);

    expect(result.score).toBe(100);
    expect(result.passCount).toBe(3);
    expect(result.failCount).toBe(0);
    expect(result.partialCount).toBe(0);
    expect(result.naCount).toBe(0);
    expect(result.totalControls).toBe(3);
    expect(result.evaluatedControls).toBe(3);
  });

  it("returns 0% when all controls fail", () => {
    const controls = [
      makeControl("C1", 3),
      makeControl("C2", 2),
      makeControl("C3", 1),
    ];
    const statusMap = new Map<string, "pass" | "partial" | "fail" | "na">([
      ["C1", "fail"],
      ["C2", "fail"],
      ["C3", "fail"],
    ]);

    const result = calculateFrameworkScore("soc2", controls, statusMap);

    expect(result.score).toBe(0);
    expect(result.passCount).toBe(0);
    expect(result.failCount).toBe(3);
    expect(result.evaluatedControls).toBe(3);
  });

  it("gives partial controls 50% credit", () => {
    // Single weight-1 control at partial => 0.5 / 1 = 50%
    const controls = [makeControl("C1", 1)];
    const statusMap = new Map<string, "pass" | "partial" | "fail" | "na">([
      ["C1", "partial"],
    ]);

    const result = calculateFrameworkScore("soc2", controls, statusMap);

    expect(result.score).toBe(50);
    expect(result.partialCount).toBe(1);
    expect(result.evaluatedControls).toBe(1);
  });

  it("correctly calculates a mix of pass/partial/fail with weights", () => {
    const controls = [
      makeControl("C1", 3), // critical, pass   => 3
      makeControl("C2", 2), // important, partial => 1  (50% of 2)
      makeControl("C3", 1), // standard, fail    => 0
    ];
    const statusMap = new Map<string, "pass" | "partial" | "fail" | "na">([
      ["C1", "pass"],
      ["C2", "partial"],
      ["C3", "fail"],
    ]);

    const result = calculateFrameworkScore("soc2", controls, statusMap);

    // totalWeight = 3 + 2 + 1 = 6
    // earned = 3 + 1 + 0 = 4
    // score = round(4/6 * 100) = round(66.67) = 67
    expect(result.score).toBe(67);
    expect(result.passCount).toBe(1);
    expect(result.partialCount).toBe(1);
    expect(result.failCount).toBe(1);
    expect(result.evaluatedControls).toBe(3);
  });

  it("excludes NA controls from total weight", () => {
    const controls = [
      makeControl("C1", 3),
      makeControl("C2", 3),
    ];
    const statusMap = new Map<string, "pass" | "partial" | "fail" | "na">([
      ["C1", "pass"],
      ["C2", "na"],
    ]);

    const result = calculateFrameworkScore("soc2", controls, statusMap);

    // Only C1 is scored: totalWeight = 3, earned = 3, score = 100
    expect(result.score).toBe(100);
    expect(result.naCount).toBe(1);
    expect(result.evaluatedControls).toBe(1);
    expect(result.totalControls).toBe(2);
  });

  it("returns 0 for empty entries", () => {
    const result = calculateFrameworkScore("soc2", [], new Map());

    expect(result.score).toBe(0);
    expect(result.totalControls).toBe(0);
    expect(result.evaluatedControls).toBe(0);
    expect(result.passCount).toBe(0);
    expect(result.failCount).toBe(0);
    expect(result.partialCount).toBe(0);
    expect(result.naCount).toBe(0);
  });

  it("returns 0 when all controls are NA (no weight to score against)", () => {
    const controls = [makeControl("C1", 3), makeControl("C2", 2)];
    const statusMap = new Map<string, "pass" | "partial" | "fail" | "na">([
      ["C1", "na"],
      ["C2", "na"],
    ]);

    const result = calculateFrameworkScore("soc2", controls, statusMap);

    expect(result.score).toBe(0);
    expect(result.naCount).toBe(2);
    expect(result.evaluatedControls).toBe(0);
  });

  it("weights critical controls (3) higher than standard controls (1)", () => {
    const controls = [
      makeControl("C1", 3), // critical, pass => 3
      makeControl("C2", 1), // standard, fail => 0
    ];
    const statusMap = new Map<string, "pass" | "partial" | "fail" | "na">([
      ["C1", "pass"],
      ["C2", "fail"],
    ]);

    const result = calculateFrameworkScore("soc2", controls, statusMap);

    // totalWeight = 4, earned = 3, score = round(75) = 75
    expect(result.score).toBe(75);
  });

  it("treats controls missing from the statusMap as not-evaluated (0 credit)", () => {
    const controls = [makeControl("C1", 2), makeControl("C2", 2)];
    // Only C1 is in the map
    const statusMap = new Map<string, "pass" | "partial" | "fail" | "na">([
      ["C1", "pass"],
    ]);

    const result = calculateFrameworkScore("soc2", controls, statusMap);

    // totalWeight = 4, earned = 2, score = 50
    expect(result.score).toBe(50);
    // C2 is not evaluated, so evaluatedControls only counts C1
    expect(result.evaluatedControls).toBe(1);
    // C2 is missing from the map => not-evaluated, NOT a real failure.
    // SECURITY FIX (BLACKFYRE audit 2026-06-05): un-scanned controls must not
    // inflate failCount; they bucket into notEvaluatedCount instead.
    expect(result.notEvaluatedCount).toBe(1);
    expect(result.failCount).toBe(0);
  });
});

describe("DPDPA control registry", () => {
  it("has 8 DPDPA controls registered with correct totalControls", () => {
    const registry = getFrameworkRegistry("dpdpa");

    expect(registry).toBeDefined();
    expect(registry!.totalControls).toBe(8);
    expect(registry!.controls).toHaveLength(8);
    expect(registry!.version).toBe("2023");
    expect(registry!.framework).toBe("dpdpa");

    // Verify first and last control IDs
    const controlIds = registry!.controls.map((c) => c.controlId);
    expect(controlIds).toContain("DPDPA-S8-1");
    expect(controlIds).toContain("DPDPA-S10-1");
  });
});
