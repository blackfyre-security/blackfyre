import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NotificationDispatcher } from "../../src/services/notification-dispatcher.js";

describe("NotificationDispatcher", () => {
  let dispatcher: NotificationDispatcher;
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    dispatcher = new NotificationDispatcher();
    consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  describe("dispatch", () => {
    it("routes email channel to dispatchEmail", () => {
      const emailSpy = vi.spyOn(dispatcher, "dispatchEmail");
      dispatcher.dispatch("email", {
        subject: "Test",
        body: "Hello",
        to: "user@example.com",
      });
      expect(emailSpy).toHaveBeenCalledWith("user@example.com", "Test", "Hello");
    });

    it("routes slack channel to dispatchSlack", () => {
      const slackSpy = vi.spyOn(dispatcher, "dispatchSlack");
      dispatcher.dispatch("slack", {
        subject: "Test",
        body: "Hello",
        webhookUrl: "https://hooks.slack.com/services/xxx",
      });
      expect(slackSpy).toHaveBeenCalledWith("https://hooks.slack.com/services/xxx", "Hello");
    });

    it("routes webhook channel to dispatchWebhook", () => {
      const webhookSpy = vi.spyOn(dispatcher, "dispatchWebhook");
      const payload = {
        subject: "Test",
        body: "Hello",
        webhookUrl: "https://example.com/hook",
      };
      dispatcher.dispatch("webhook", payload);
      expect(webhookSpy).toHaveBeenCalledWith("https://example.com/hook", payload);
    });

    it("routes sms channel to dispatchSms", () => {
      const smsSpy = vi.spyOn(dispatcher, "dispatchSms");
      dispatcher.dispatch("sms", {
        subject: "Test",
        body: "Hello",
        to: "+15551234567",
      });
      expect(smsSpy).toHaveBeenCalledWith("+15551234567", "Hello");
    });

    it("logs unknown channel without throwing", () => {
      expect(() =>
        dispatcher.dispatch("pigeon", { subject: "Test", body: "Hello" }),
      ).not.toThrow();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Unknown channel: pigeon"),
      );
    });
  });

  describe("isInQuietHours", () => {
    it("returns false when quiet hours are not configured", () => {
      const rule = {
        quietHoursStart: null,
        quietHoursEnd: null,
        quietHoursTz: null,
      };
      expect(dispatcher.isInQuietHours(rule)).toBe(false);
    });

    it("returns false when only start is configured", () => {
      const rule = {
        quietHoursStart: "22:00",
        quietHoursEnd: null,
        quietHoursTz: null,
      };
      expect(dispatcher.isInQuietHours(rule)).toBe(false);
    });

    it("returns false when timezone is missing", () => {
      const rule = {
        quietHoursStart: "22:00",
        quietHoursEnd: "07:00",
        quietHoursTz: null,
      };
      expect(dispatcher.isInQuietHours(rule)).toBe(false);
    });

    it("returns true when current time is inside overnight quiet hours", () => {
      // Quiet hours: 22:00 - 07:00 UTC
      // Test with a time that is 23:00 UTC -> should be in quiet hours
      const rule = {
        quietHoursStart: "22:00",
        quietHoursEnd: "07:00",
        quietHoursTz: "UTC",
      };
      // Create a date that is 23:00 UTC
      const fakeNow = new Date("2026-03-26T23:00:00.000Z");
      expect(dispatcher.isInQuietHours(rule, fakeNow)).toBe(true);
    });

    it("returns true when current time is past midnight in overnight quiet hours", () => {
      // Quiet hours: 22:00 - 07:00 UTC
      // Test with 03:00 UTC -> should be in quiet hours
      const rule = {
        quietHoursStart: "22:00",
        quietHoursEnd: "07:00",
        quietHoursTz: "UTC",
      };
      const fakeNow = new Date("2026-03-26T03:00:00.000Z");
      expect(dispatcher.isInQuietHours(rule, fakeNow)).toBe(true);
    });

    it("returns false when current time is outside overnight quiet hours", () => {
      // Quiet hours: 22:00 - 07:00 UTC
      // Test with 12:00 UTC -> should NOT be in quiet hours
      const rule = {
        quietHoursStart: "22:00",
        quietHoursEnd: "07:00",
        quietHoursTz: "UTC",
      };
      const fakeNow = new Date("2026-03-26T12:00:00.000Z");
      expect(dispatcher.isInQuietHours(rule, fakeNow)).toBe(false);
    });

    it("returns true when current time is inside same-day quiet hours", () => {
      // Quiet hours: 09:00 - 17:00 UTC (daytime quiet)
      // Test with 12:00 UTC -> should be in quiet hours
      const rule = {
        quietHoursStart: "09:00",
        quietHoursEnd: "17:00",
        quietHoursTz: "UTC",
      };
      const fakeNow = new Date("2026-03-26T12:00:00.000Z");
      expect(dispatcher.isInQuietHours(rule, fakeNow)).toBe(true);
    });

    it("returns false when current time is outside same-day quiet hours", () => {
      // Quiet hours: 09:00 - 17:00 UTC
      // Test with 20:00 UTC -> should NOT be in quiet hours
      const rule = {
        quietHoursStart: "09:00",
        quietHoursEnd: "17:00",
        quietHoursTz: "UTC",
      };
      const fakeNow = new Date("2026-03-26T20:00:00.000Z");
      expect(dispatcher.isInQuietHours(rule, fakeNow)).toBe(false);
    });

    it("handles timezone conversion correctly", () => {
      // Quiet hours: 22:00 - 07:00 America/New_York (UTC-4 in March DST)
      // At 02:00 UTC, it's 22:00 ET -> should be in quiet hours
      const rule = {
        quietHoursStart: "22:00",
        quietHoursEnd: "07:00",
        quietHoursTz: "America/New_York",
      };
      const fakeNow = new Date("2026-03-26T02:00:00.000Z");
      expect(dispatcher.isInQuietHours(rule, fakeNow)).toBe(true);
    });

    it("handles timezone where UTC daytime maps to quiet hours", () => {
      // Quiet hours: 22:00 - 07:00 America/New_York
      // At 15:00 UTC, it's 11:00 ET -> should NOT be in quiet hours
      const rule = {
        quietHoursStart: "22:00",
        quietHoursEnd: "07:00",
        quietHoursTz: "America/New_York",
      };
      const fakeNow = new Date("2026-03-26T15:00:00.000Z");
      expect(dispatcher.isInQuietHours(rule, fakeNow)).toBe(false);
    });

    it("returns false at exact end boundary (exclusive)", () => {
      // Quiet hours: 22:00 - 07:00 UTC
      // At exactly 07:00 UTC -> should NOT be in quiet hours (end is exclusive)
      const rule = {
        quietHoursStart: "22:00",
        quietHoursEnd: "07:00",
        quietHoursTz: "UTC",
      };
      const fakeNow = new Date("2026-03-26T07:00:00.000Z");
      expect(dispatcher.isInQuietHours(rule, fakeNow)).toBe(false);
    });

    it("returns true at exact start boundary (inclusive)", () => {
      // Quiet hours: 22:00 - 07:00 UTC
      // At exactly 22:00 UTC -> should be in quiet hours (start is inclusive)
      const rule = {
        quietHoursStart: "22:00",
        quietHoursEnd: "07:00",
        quietHoursTz: "UTC",
      };
      const fakeNow = new Date("2026-03-26T22:00:00.000Z");
      expect(dispatcher.isInQuietHours(rule, fakeNow)).toBe(true);
    });
  });
});
