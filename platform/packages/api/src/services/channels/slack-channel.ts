// SECURITY FIX (BLACKFYRE audit 2026-06-05): SSRF — the previous hostname-string check
// (validateWebhookUrl) only inspected the literal hostname and was bypassable via
// DNS-rebinding to 169.254.169.254 / RFC1918 ranges. The tenant-controlled Slack
// webhook URL now goes through safeFetch(), which resolves DNS and rejects private/
// reserved/metadata targets and re-validates every redirect hop. SsrfBlockedError is
// caught to surface a clean error and a warn log.
import { safeFetch, SsrfBlockedError } from "../../lib/safe-fetch.js";

/**
 * SlackChannel — posts messages to Slack via an incoming webhook URL.
 *
 * Uses native fetch (Node 18+). Formats the message using Slack Block Kit
 * with a header block and a section body.
 *
 * Fails gracefully: logs the error but never throws.
 */
export class SlackChannel {
  async send(webhookUrl: string, message: string): Promise<void> {
    if (!webhookUrl) {
      console.log("[SlackChannel] Skipped (no webhook URL provided)");
      return;
    }

    const payload = {
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: "BLACKFYRE Alert",
            emoji: true,
          },
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: message,
          },
        },
      ],
    };

    try {
      // SECURITY FIX (BLACKFYRE audit 2026-06-05): SSRF — route through safeFetch()
      // instead of raw fetch(). Method/headers/body are preserved exactly; safeFetch
      // re-resolves DNS per redirect hop and blocks private/reserved/metadata targets.
      const response = await safeFetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const body = await response.text();
        console.error(
          `[SlackChannel] Webhook returned ${response.status}: ${body}`,
        );
        return;
      }

      console.log("[SlackChannel] Message posted successfully");
    } catch (err) {
      // SECURITY FIX (BLACKFYRE audit 2026-06-05): SSRF — distinguish a policy block
      // (internal/private/metadata target or rebind/redirect) from a benign delivery
      // failure. Emit a structured warn for the block; never log the message body.
      if (err instanceof SsrfBlockedError) {
        console.warn(JSON.stringify({ level: "warn", event: "ssrf.blocked", channel: "slack", phase: "send", url: webhookUrl, reason: err.message }));
        console.error(`[SlackChannel] Blocked outbound webhook: ${err.message}`);
        return;
      }
      console.error("[SlackChannel] Failed to post message:", err);
    }
  }
}
