import { describe, it, expect } from "vitest";
import { calculateFrameworkScore } from "../../src/compliance/scoring.js";
import type { ControlDefinition } from "@blackfyre/shared";

const makeControl = (id: string, weight: 1 | 2 | 3): ControlDefinition => ({
  controlId: id,
  controlName: `Control ${id}`,
  description: `Description for ${id}`,
  weight,
  category: "Test",
});

describe("calculateFrameworkScore", () => {
  it("returns 100 when all controls pass", () => {
    const controls = [makeControl("C1", 3), makeControl("C2", 2), makeControl("C3", 1)];
    const statusMap = new Map([
      ["C1", "pass" as const],
      ["C2", "pass" as const],
      ["C3", "pass" as const],
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

  it("returns 0 when all controls fail", () => {
    const controls = [makeControl("C1", 3), makeControl("C2", 2)];
    const statusMap = new Map([
      ["C1", "fail" as const],
      ["C2", "fail" as const],
    ]);
    const result = calculateFrameworkScore("soc2", controls, statusMap);
    expect(result.score).toBe(0);
    expect(result.failCount).toBe(2);
    expect(result.passCount).toBe(0);
  });

  it("gives partial controls 50% credit", () => {
    // Single weight-1 control at partial = 50% of weight 1 / weight 1 = 50
    const controls = [makeControl("C1", 1)];
    const statusMap = new Map([["C1", "partial" as const]]);
    const result = calculateFrameworkScore("soc2", controls, statusMap);
    expect(result.score).toBe(50);
    expect(result.partialCount).toBe(1);
  });

  it("excludes N/A controls from scoring", () => {
    const controls = [makeControl("C1", 3), makeControl("C2", 3)];
    const statusMap = new Map([
      ["C1", "pass" as const],
      ["C2", "na" as const],
    ]);
    const result = calculateFrameworkScore("soc2", controls, statusMap);
    expect(result.score).toBe(100); // Only C1 evaluated, it passes
    expect(result.naCount).toBe(1);
    expect(result.evaluatedControls).toBe(1);
    expect(result.totalControls).toBe(2);
  });

  it("weights critical controls higher than standard", () => {
    // C1: weight 3, pass => 3 points
    // C2: weight 1, fail => 0 points
    // total evaluated weight = 4, earned = 3, score = 75
    const controls = [makeControl("C1", 3), makeControl("C2", 1)];
    const statusMap = new Map([
      ["C1", "pass" as const],
      ["C2", "fail" as const],
    ]);
    const result = calculateFrameworkScore("soc2", controls, statusMap);
    expect(result.score).toBe(75);
  });

  it("treats unevaluated controls as not_evaluated (fail)", () => {
    const controls = [makeControl("C1", 2), makeControl("C2", 2)];
    // Only C1 has a status; C2 is missing from the map
    const statusMap = new Map([["C1", "pass" as const]]);
    const result = calculateFrameworkScore("soc2", controls, statusMap);
    // C1: pass => 2 points, C2: not evaluated => 0 points
    // total weight = 4, earned = 2, score = 50
    expect(result.score).toBe(50);
    expect(result.evaluatedControls).toBe(1);
  });

  it("returns 0 score and 0 evaluated when all controls are N/A", () => {
    const controls = [makeControl("C1", 3)];
    const statusMap = new Map([["C1", "na" as const]]);
    const result = calculateFrameworkScore("soc2", controls, statusMap);
    expect(result.score).toBe(0);
    expect(result.evaluatedControls).toBe(0);
    expect(result.naCount).toBe(1);
  });

  it("handles empty controls list", () => {
    const result = calculateFrameworkScore("soc2", [], new Map());
    expect(result.score).toBe(0);
    expect(result.totalControls).toBe(0);
    expect(result.evaluatedControls).toBe(0);
  });

  it("rounds score to nearest integer", () => {
    // C1: weight 3, pass => 3
    // C2: weight 2, partial => 1 (50% of 2)
    // total weight = 5, earned = 4, score = 80
    const controls = [makeControl("C1", 3), makeControl("C2", 2)];
    const statusMap = new Map([
      ["C1", "pass" as const],
      ["C2", "partial" as const],
    ]);
    const result = calculateFrameworkScore("soc2", controls, statusMap);
    expect(result.score).toBe(80);
  });
});
