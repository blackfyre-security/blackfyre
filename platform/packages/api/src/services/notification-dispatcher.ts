/**
 * NotificationDispatcher — routes notifications to channel-specific handlers.
 *
 * Email, Slack, Webhook, and SMS channels are all backed by real implementations.
 * The isInQuietHours method is a real implementation using timezone math.
 */

// REAL IMPL (BLACKFYRE 2026-06): SMS dispatch now hits the live Twilio REST API
// via safeFetch (SSRF-safe). No Twilio SDK is required — we POST the form-encoded
// Messages.json endpoint with HTTP Basic auth. safeFetch re-resolves DNS per
// redirect hop and blocks private/reserved/metadata targets.
import { safeFetch, SsrfBlockedError } from "../lib/safe-fetch.js";
import { EmailChannel } from "./channels/email-channel.js";
import { SlackChannel } from "./channels/slack-channel.js";
import { WebhookChannel } from "./channels/webhook-channel.js";

export interface NotificationPayload {
  subject: string;
  body: string;
  to?: string;
  webhookUrl?: string;
}

export interface AlertRuleForQuietHours {
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  quietHoursTz: string | null;
}

export class NotificationDispatcher {
  private emailChannel: EmailChannel;
  private slackChannel: SlackChannel;
  private webhookChannel: WebhookChannel;

  constructor() {
    this.emailChannel = new EmailChannel({
      host: process.env.SMTP_HOST ?? "",
      port: parseInt(process.env.SMTP_PORT ?? "587", 10),
      user: process.env.SMTP_USER ?? "",
      pass: process.env.SMTP_PASS ?? "",
      from: process.env.SMTP_FROM ?? "noreply@blackfyre.com",
    });
    this.slackChannel = new SlackChannel();
    this.webhookChannel = new WebhookChannel();
  }

  /**
   * Routes a notification to the correct channel handler.
   */
  async dispatch(channel: string, payload: NotificationPayload): Promise<void> {
    switch (channel) {
      case "email":
        await this.dispatchEmail(payload.to ?? "unknown", payload.subject, payload.body);
        break;
      case "slack":
        await this.dispatchSlack(payload.webhookUrl ?? "", payload.body);
        break;
      case "webhook":
        await this.dispatchWebhook(payload.webhookUrl ?? "", payload);
        break;
      case "sms":
        await this.dispatchSms(payload.to ?? "", payload.body);
        break;
      default:
        console.log(`[NotificationDispatcher] Unknown channel: ${channel}`);
    }
  }

  /**
   * Sends an email notification via SMTP.
   */
  async dispatchEmail(to: string, subject: string, body: string): Promise<void> {
    await this.emailChannel.sendEmail(to, subject, body);
  }

  /**
   * Posts a message to a Slack incoming webhook.
   */
  async dispatchSlack(webhookUrl: string, message: string): Promise<void> {
    await this.slackChannel.send(webhookUrl, message);
  }

  /**
   * POSTs a JSON payload to a webhook URL with HMAC signing.
   */
  async dispatchWebhook(url: string, payload: unknown): Promise<void> {
    await this.webhookChannel.send(url, payload);
  }

  /**
   * Sends an SMS via the Twilio REST API.
   *
   * REAL IMPL (BLACKFYRE 2026-06): replaces the previous console stub. POSTs to
   *   https://api.twilio.com/2010-04-01/Accounts/{SID}/Messages.json
   * with HTTP Basic auth (SID:AUTH_TOKEN) and a form-urlencoded body
   * (From=&To=&Body=). No Twilio SDK is pulled in; the request is routed through
   * safeFetch so a tenant/config-controlled endpoint can never be coerced into an
   * SSRF target. If Twilio is not configured (missing SID / token / from-number)
   * we emit a structured warn and no-op rather than crashing — mirroring the
   * graceful-degradation contract of the Email/Slack channels.
   *
   * Fails gracefully: any delivery error is logged (never the auth token or body)
   * and swallowed so a flaky SMS provider cannot take down the caller.
   */
  async dispatchSms(to: string, message: string): Promise<void> {
    const accountSid = process.env.TWILIO_ACCOUNT_SID ?? "";
    const authToken = process.env.TWILIO_AUTH_TOKEN ?? "";
    const fromNumber = process.env.TWILIO_FROM ?? "";

    if (!accountSid || !authToken || !fromNumber) {
      // Structured warn — never include the (absent) token. No-op, do not crash.
      console.warn(
        JSON.stringify({
          level: "warn",
          event: "sms.skipped",
          channel: "sms",
          reason: "twilio_not_configured",
          hasTo: Boolean(to),
        }),
      );
      return;
    }

    if (!to) {
      console.warn(
        JSON.stringify({
          level: "warn",
          event: "sms.skipped",
          channel: "sms",
          reason: "missing_recipient",
        }),
      );
      return;
    }

    const url = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(accountSid)}/Messages.json`;
    const form = new URLSearchParams({ From: fromNumber, To: to, Body: message });
    // HTTP Basic auth: base64("SID:AUTH_TOKEN"). Computed locally; never logged.
    const basic = Buffer.from(`${accountSid}:${authToken}`).toString("base64");

    try {
      const response = await safeFetch(url, {
        method: "POST",
        headers: {
          Authorization: `Basic ${basic}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: form.toString(),
      });

      if (!response.ok) {
        // Twilio returns a JSON error body; surface status + code/message but NOT
        // the request body (may contain sensitive alert content) or our auth header.
        let providerCode: unknown;
        let providerMessage: unknown;
        try {
          const errBody = (await response.json()) as { code?: unknown; message?: unknown };
          providerCode = errBody?.code;
          providerMessage = errBody?.message;
        } catch {
          // non-JSON error body — leave provider fields undefined
        }
        console.error(
          JSON.stringify({
            level: "error",
            event: "sms.failed",
            channel: "sms",
            status: response.status,
            providerCode,
            providerMessage,
          }),
        );
        return;
      }

      console.log(
        JSON.stringify({ level: "info", event: "sms.sent", channel: "sms", status: response.status }),
      );
    } catch (err) {
      if (err instanceof SsrfBlockedError) {
        console.warn(
          JSON.stringify({ level: "warn", event: "ssrf.blocked", channel: "sms", phase: "send", reason: err.message }),
        );
        return;
      }
      const reason = err instanceof Error ? err.message : String(err);
      console.error(
        JSON.stringify({ level: "error", event: "sms.failed", channel: "sms", reason }),
      );
    }
  }

  /**
   * Checks whether the current moment falls within the rule's quiet hours window.
   *
   * Quiet hours are specified in the rule's timezone (e.g. "22:00" to "07:00" in "America/New_York").
   * The method converts the current UTC time to the rule's timezone, then checks if it
   * falls within the start-end window — handling the overnight wrap-around case.
   *
   * Returns false if quiet hours are not configured (any of the three fields is null).
   */
  isInQuietHours(rule: AlertRuleForQuietHours, now?: Date): boolean {
    if (!rule.quietHoursStart || !rule.quietHoursEnd || !rule.quietHoursTz) {
      return false;
    }

    const currentTime = now ?? new Date();

    // Get current time in the rule's timezone
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: rule.quietHoursTz,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

    const parts = formatter.formatToParts(currentTime);
    const hourPart = parts.find((p) => p.type === "hour");
    const minutePart = parts.find((p) => p.type === "minute");

    if (!hourPart || !minutePart) {
      return false;
    }

    const currentMinutes = parseInt(hourPart.value, 10) * 60 + parseInt(minutePart.value, 10);

    const [startH, startM] = rule.quietHoursStart.split(":").map(Number);
    const [endH, endM] = rule.quietHoursEnd.split(":").map(Number);

    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    // Handle overnight window (e.g. 22:00 -> 07:00)
    if (startMinutes <= endMinutes) {
      // Same-day window (e.g. 09:00 -> 17:00)
      return currentMinutes >= startMinutes && currentMinutes < endMinutes;
    } else {
      // Overnight window (e.g. 22:00 -> 07:00)
      return currentMinutes >= startMinutes || currentMinutes < endMinutes;
    }
  }
}
