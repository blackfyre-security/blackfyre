import { createHmac } from "node:crypto";
// SECURITY FIX (BLACKFYRE audit 2026-06-05): SSRF — the previous hostname-string check
// (validateWebhookUrl) was bypassable via DNS-rebinding to 169.254.169.254 / RFC1918
// (it only inspected the literal hostname, never the resolved IP). Tenant-controlled
// webhook URLs now go through safeFetch(), which resolves DNS and rejects private/
// reserved/metadata targets, and re-validates every redirect hop. SsrfBlockedError is
// caught to surface a clean error and a warn log.
import { safeFetch, SsrfBlockedError } from "../../lib/safe-fetch.js";

/**
 * WebhookChannel — POSTs a JSON payload to an arbitrary URL.
 *
 * Security:
 *  - HMAC-SHA256 signature in `X-Blackfyre-Signature` header
 *  - Timestamp in `X-Blackfyre-Timestamp` for replay protection
 *
 * The signing secret is read from WEBHOOK_SIGNING_SECRET env var at
 * construction time.  If not set, the signature header is omitted and
 * a warning is logged once.
 *
 * Fails gracefully: logs the error but never throws.
 */
export class WebhookChannel {
  private secret: string;
  private warnedNoSecret = false;

  constructor(secret?: string) {
    this.secret = secret ?? process.env.WEBHOOK_SIGNING_SECRET ?? "";
  }

  async send(url: string, payload: unknown): Promise<void> {
    if (!url) {
      console.log("[WebhookChannel] Skipped (no URL provided)");
      return;
    }

    const body = JSON.stringify(payload);
    const timestamp = Math.floor(Date.now() / 1000).toString();

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Blackfyre-Timestamp": timestamp,
    };

    if (this.secret) {
      const signaturePayload = `${timestamp}.${body}`;
      const signature = createHmac("sha256", this.secret)
        .update(signaturePayload)
        .digest("hex");
      headers["X-Blackfyre-Signature"] = signature;
    } else if (!this.warnedNoSecret) {
      console.warn(
        "[WebhookChannel] WEBHOOK_SIGNING_SECRET not set — requests will not be signed.",
      );
      this.warnedNoSecret = true;
    }

    try {
      // SECURITY FIX (BLACKFYRE audit 2026-06-05): SSRF — route through safeFetch()
      // instead of raw fetch(). Method/headers/body are preserved exactly; safeFetch
      // re-resolves DNS per redirect hop and blocks private/reserved/metadata targets.
      const response = await safeFetch(url, {
        method: "POST",
        headers,
        body,
      });

      if (!response.ok) {
        const respBody = await response.text();
        console.error(
          `[WebhookChannel] POST ${url} returned ${response.status}: ${respBody}`,
        );
        return;
      }

      console.log(`[WebhookChannel] Delivered to ${url}`);
    } catch (err) {
      // SECURITY FIX (BLACKFYRE audit 2026-06-05): SSRF — distinguish a policy block
      // (target is internal/private/metadata or rebind/redirect) from a benign delivery
      // failure. Emit a structured warn for the block; never log the payload or secret.
      if (err instanceof SsrfBlockedError) {
        console.warn(JSON.stringify({ level: "warn", event: "ssrf.blocked", channel: "webhook", phase: "send", url, reason: err.message }));
        console.error(`[WebhookChannel] Blocked outbound webhook to ${url}: ${err.message}`);
        return;
      }
      console.error(`[WebhookChannel] Failed to POST ${url}:`, err);
    }
  }
}
