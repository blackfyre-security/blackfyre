import fp from "fastify-plugin";
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import { createHash, randomBytes } from "crypto";

const CSRF_COOKIE = "csrf_token";
const CSRF_HEADER = "x-csrf-token";

// Routes exempt from CSRF verification.
// SECURITY FIX (BLACKFYRE audit 2026-06-05): the Razorpay webhook lives at /api/payments/webhook
// (NOT under /api/webhooks/), so it was being 403'd by CSRF before its HMAC signature could be
// checked — breaking billing event delivery. Server-to-server webhooks authenticate via signature,
// not CSRF tokens, so they must be exempt. We exempt the EXACT webhook path only (via
// CSRF_EXEMPT_PATHS) rather than the whole /api/payments/ prefix, so the authenticated mutation
// routes (create-order, verify) keep CSRF protection. The Stripe webhook is already covered by the
// /api/webhooks/ prefix.
const CSRF_EXEMPT_PREFIXES = [
  "/api/auth/",
  "/api/webhooks/",
  "/api/health",
  "/scim/v2/",
  "/api/v1/contact",
];

// Exact paths exempt from CSRF (signature-authenticated server-to-server callbacks only).
const CSRF_EXEMPT_PATHS = [
  "/api/payments/webhook", // Razorpay webhook — verified by x-razorpay-signature HMAC
];

const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function isExempt(url: string): boolean {
  // Strip any query string before matching exact paths.
  const path = url.split("?")[0];
  if (CSRF_EXEMPT_PATHS.includes(path)) return true;
  return CSRF_EXEMPT_PREFIXES.some((prefix) => url.startsWith(prefix));
}

export function generateCsrfToken(): string {
  return randomBytes(32).toString("hex");
}

const csrfPlugin: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", async (request: FastifyRequest, reply: FastifyReply) => {
    if (!MUTATION_METHODS.has(request.method)) return;
    if (isExempt(request.url)) return;

    const rawCookie = request.headers.cookie ?? "";
    const cookieToken = rawCookie
      .split(";")
      .map((c) => c.trim().split("="))
      .find(([k]) => k === CSRF_COOKIE)?.[1];
    const headerToken = request.headers[CSRF_HEADER] as string | undefined;

    if (!cookieToken || !headerToken) {
      return reply.status(403).send({
        error: {
          code: "CSRF_TOKEN_MISSING",
          message: "CSRF token required. Include X-CSRF-Token header matching the csrf_token cookie.",
        },
      });
    }

    const cookieHash = createHash("sha256").update(cookieToken).digest("hex");
    const headerHash = createHash("sha256").update(headerToken).digest("hex");

    if (cookieHash !== headerHash) {
      return reply.status(403).send({
        error: {
          code: "CSRF_TOKEN_INVALID",
          message: "CSRF token mismatch.",
        },
      });
    }
  });
};

export default fp(csrfPlugin, { name: "csrf", dependencies: [] });
