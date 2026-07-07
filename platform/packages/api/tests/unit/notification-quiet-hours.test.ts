import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  NotificationDispatcher,
  type AlertRuleForQuietHours,
} from "../../src/services/notification-dispatcher.js";

describe("NotificationDispatcher — isInQuietHours", () => {
  let dispatcher: NotificationDispatcher;
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Suppress console output from the NotificationDispatcher constructor
    consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    dispatcher = new NotificationDispatcher();
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  // ---------------------------------------------------------------
  // Not configured
  // ---------------------------------------------------------------

  it("returns false when quiet hours are not configured (all nulls)", () => {
    const rule: AlertRuleForQuietHours = {
      quietHoursStart: null,
      quietHoursEnd: null,
      quietHoursTz: null,
    };
    expect(dispatcher.isInQuietHours(rule)).toBe(false);
  });

  it("returns false when only start is set", () => {
    const rule: AlertRuleForQuietHours = {
      quietHoursStart: "22:00",
      quietHoursEnd: null,
      quietHoursTz: null,
    };
    expect(dispatcher.isInQuietHours(rule)).toBe(false);
  });

  it("returns false when timezone is missing", () => {
    const rule: AlertRuleForQuietHours = {
      quietHoursStart: "22:00",
      quietHoursEnd: "07:00",
      quietHoursTz: null,
    };
    expect(dispatcher.isInQuietHours(rule)).toBe(false);
  });

  // ---------------------------------------------------------------
  // Same-day window  (e.g. 09:00 - 17:00)
  // ---------------------------------------------------------------

  it("returns true when current time is inside a same-day window", () => {
    const rule: AlertRuleForQuietHours = {
      quietHoursStart: "09:00",
      quietHoursEnd: "17:00",
      quietHoursTz: "UTC",
    };
    // 12:00 UTC is inside 09:00-17:00
    const fakeNow = new Date("2026-03-26T12:00:00.000Z");
    expect(dispatcher.isInQuietHours(rule, fakeNow)).toBe(true);
  });

  it("returns false when current time is outside a same-day window", () => {
    const rule: AlertRuleForQuietHours = {
      quietHoursStart: "09:00",
      quietHoursEnd: "17:00",
      quietHoursTz: "UTC",
    };
    // 20:00 UTC is outside 09:00-17:00
    const fakeNow = new Date("2026-03-26T20:00:00.000Z");
    expect(dispatcher.isInQuietHours(rule, fakeNow)).toBe(false);
  });

  it("returns false when current time is before a same-day window", () => {
    const rule: AlertRuleForQuietHours = {
      quietHoursStart: "09:00",
      quietHoursEnd: "17:00",
      quietHoursTz: "UTC",
    };
    // 06:00 UTC is before 09:00
    const fakeNow = new Date("2026-03-26T06:00:00.000Z");
    expect(dispatcher.isInQuietHours(rule, fakeNow)).toBe(false);
  });

  // ---------------------------------------------------------------
  // Overnight window  (e.g. 22:00 - 07:00)
  // ---------------------------------------------------------------

  it("returns true when current time is in the evening portion of overnight window", () => {
    const rule: AlertRuleForQuietHours = {
      quietHoursStart: "22:00",
      quietHoursEnd: "07:00",
      quietHoursTz: "UTC",
    };
    // 23:00 UTC is in the 22:00-07:00 window
    const fakeNow = new Date("2026-03-26T23:00:00.000Z");
    expect(dispatcher.isInQuietHours(rule, fakeNow)).toBe(true);
  });

  it("returns true when current time is past midnight in overnight window", () => {
    const rule: AlertRuleForQuietHours = {
      quietHoursStart: "22:00",
      quietHoursEnd: "07:00",
      quietHoursTz: "UTC",
    };
    // 03:00 UTC is in the 22:00-07:00 window (past midnight)
    const fakeNow = new Date("2026-03-26T03:00:00.000Z");
    expect(dispatcher.isInQuietHours(rule, fakeNow)).toBe(true);
  });

  it("returns false when current time is during the day outside overnight window", () => {
    const rule: AlertRuleForQuietHours = {
      quietHoursStart: "22:00",
      quietHoursEnd: "07:00",
      quietHoursTz: "UTC",
    };
    // 12:00 UTC is outside the 22:00-07:00 window
    const fakeNow = new Date("2026-03-26T12:00:00.000Z");
    expect(dispatcher.isInQuietHours(rule, fakeNow)).toBe(false);
  });

  // ---------------------------------------------------------------
  // Boundary conditions
  // ---------------------------------------------------------------

  it("returns true at exactly the start time (start is inclusive)", () => {
    const rule: AlertRuleForQuietHours = {
      quietHoursStart: "22:00",
      quietHoursEnd: "07:00",
      quietHoursTz: "UTC",
    };
    // Exactly 22:00 UTC
    const fakeNow = new Date("2026-03-26T22:00:00.000Z");
    expect(dispatcher.isInQuietHours(rule, fakeNow)).toBe(true);
  });

  it("returns false at exactly the end time (end is exclusive)", () => {
    const rule: AlertRuleForQuietHours = {
      quietHoursStart: "22:00",
      quietHoursEnd: "07:00",
      quietHoursTz: "UTC",
    };
    // Exactly 07:00 UTC
    const fakeNow = new Date("2026-03-26T07:00:00.000Z");
    expect(dispatcher.isInQuietHours(rule, fakeNow)).toBe(false);
  });

  it("returns true at exactly the start of a same-day window (inclusive)", () => {
    const rule: AlertRuleForQuietHours = {
      quietHoursStart: "09:00",
      quietHoursEnd: "17:00",
      quietHoursTz: "UTC",
    };
    const fakeNow = new Date("2026-03-26T09:00:00.000Z");
    expect(dispatcher.isInQuietHours(rule, fakeNow)).toBe(true);
  });

  it("returns false at exactly the end of a same-day window (exclusive)", () => {
    const rule: AlertRuleForQuietHours = {
      quietHoursStart: "09:00",
      quietHoursEnd: "17:00",
      quietHoursTz: "UTC",
    };
    const fakeNow = new Date("2026-03-26T17:00:00.000Z");
    expect(dispatcher.isInQuietHours(rule, fakeNow)).toBe(false);
  });
});
