import * as Sentry from "@sentry/node";
import type { FastifyInstance } from "fastify";
import { ApiError } from "./utils/errors.js";

// REAL IMPL (BLACKFYRE 2026-06): Sentry error-reporting wiring.
//
// Previously this module called Sentry.init() as an unconditional import
// side-effect reading process.env directly, and was imported by NOTHING — so
// Sentry was effectively dead code (no errors were ever reported and, worse,
// init ran at module-eval time even in tests). This now exposes an explicit
// initSentry(app, config) that buildApp() calls during boot. Both runtime
// entrypoints (index.ts server + lambda.ts) go through buildApp(), so a single
// call site covers every deployment shape.
//
// Contract:
//   - DSN sourced from config.SENTRY_DSN when present, else process.env.SENTRY_DSN
//     (config.ts does not yet surface the field; the fallback keeps this real
//     today and forward-compatible once it does). When unset → no-op + boot warn.
//   - On error, an unhandled (non-ApiError, non-validation, 5xx) error is reported.
//     Expected/handled client errors (ApiError, Zod/Fastify validation, <500) are
//     NOT reported — they are normal control flow, not incidents.
//   - PII/secrets are scrubbed before send: no auth headers, cookies, request
//     bodies, query strings, or user emails ever leave the process. Only coarse,
//     non-sensitive correlation tags (tenantId, requestId, route, method) are sent.

// Narrow shape so we accept the typed Config without importing a SENTRY_DSN field
// that config.ts does not declare yet. Any object exposing NODE_ENV works.
interface SentryConfigLike {
  NODE_ENV: string;
  SENTRY_DSN?: string;
  SENTRY_RELEASE?: string;
}

// REAL IMPL (BLACKFYRE 2026-06): header allowlist scrub. Anything not on this
// list is dropped from the event before transmission. Authorization, Cookie,
// X-API-Key, X-CSRF-Token etc. are therefore never sent to Sentry.
const SAFE_HEADERS = new Set(["content-type", "content-length", "user-agent", "accept"]);

let initialized = false;

/**
 * REAL IMPL (BLACKFYRE 2026-06): scrub all PII/secrets from a Sentry event.
 * Strips request bodies, cookies, query strings, and non-allowlisted headers,
 * and removes the user object entirely (we never send emails/usernames).
 */
function scrubEvent(event: Sentry.ErrorEvent): Sentry.ErrorEvent {
  // Never attach user identity (email/username/ip). tenantId is carried as a tag.
  delete event.user;

  if (event.request) {
    // Drop the raw body, query string, and cookies outright — these can contain
    // credentials, tokens, and tenant data.
    delete event.request.data;
    delete event.request.query_string;
    delete event.request.cookies;

    if (event.request.headers) {
      const safe: Record<string, string> = {};
      for (const [key, value] of Object.entries(event.request.headers)) {
        if (SAFE_HEADERS.has(key.toLowerCase()) && typeof value === "string") {
          safe[key] = value;
        }
      }
      event.request.headers = safe;
    }
  }

  return event;
}

/**
 * REAL IMPL (BLACKFYRE 2026-06): true if an error should be reported as an
 * unhandled incident. Handled/expected errors (ApiError, Zod/Fastify validation,
 * any explicit <500) are normal API control flow and are excluded.
 */
function isUnhandled(error: Error & { statusCode?: number; validation?: unknown; code?: string }): boolean {
  if (error instanceof ApiError) return false;
  if (error.name === "ZodError") return false;
  if (error.validation) return false;
  if (typeof error.statusCode === "number" && error.statusCode < 500) return false;
  return true;
}

/**
 * REAL IMPL (BLACKFYRE 2026-06): initialize Sentry and attach a Fastify error
 * hook. Safe to call once per app instance. No-ops (with a boot warn) when no DSN
 * is configured so local/dev/test and DSN-less deploys run cleanly.
 */
export function initSentry(app: FastifyInstance, config: SentryConfigLike): void {
  const dsn = (config.SENTRY_DSN ?? process.env.SENTRY_DSN ?? "").trim();

  if (!dsn) {
    // Graceful no-op: error reporting is disabled but the app is fully functional.
    app.log.warn(
      { event: "sentry.disabled" },
      "SENTRY_DSN not set — Sentry error reporting disabled (no-op)",
    );
    return;
  }

  if (!initialized) {
    Sentry.init({
      dsn,
      environment: config.NODE_ENV,
      release: config.SENTRY_RELEASE ?? process.env.SENTRY_RELEASE,
      // 10% of traces in prod, full sampling elsewhere for debuggability.
      tracesSampleRate: config.NODE_ENV === "production" ? 0.1 : 1.0,
      // Belt-and-braces: even if a future integration tries to attach PII, this
      // flag keeps it off; we explicitly opt out of sending default PII.
      sendDefaultPii: false,
      // Final scrub gate — every outbound event passes through here.
      beforeSend: (event) => scrubEvent(event),
    });
    initialized = true;
    app.log.info(
      { event: "sentry.initialized", environment: config.NODE_ENV },
      "Sentry error reporting initialized",
    );
  }

  // REAL IMPL (BLACKFYRE 2026-06): report unhandled errors with only coarse,
  // non-sensitive correlation context. Runs alongside the existing onError hook
  // in app.ts (which releases the RLS connection); Fastify invokes all onError
  // hooks, so ordering with that hook is independent.
  app.addHook("onError", async (request, _reply, error) => {
    const err = error as Error & { statusCode?: number; validation?: unknown; code?: string };
    if (!isUnhandled(err)) return;

    Sentry.withScope((scope) => {
      // Tags are low-cardinality, non-PII correlation keys only.
      scope.setTag("route", request.routeOptions?.url ?? "unknown");
      scope.setTag("method", request.method);
      const requestId = (request as { requestId?: string }).requestId;
      if (requestId) scope.setTag("requestId", requestId);
      const tenantId = (request as { tenantId?: string }).tenantId;
      if (tenantId) scope.setTag("tenantId", tenantId);
      Sentry.captureException(err);
    });
  });
}
