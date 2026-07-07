import fp from "fastify-plugin";
import type { FastifyPluginAsync } from "fastify";

const securityHeadersPlugin: FastifyPluginAsync = async (app) => {
  app.addHook("onSend", async (_request, reply) => {
    // Standard security headers
    reply.header("X-Content-Type-Options", "nosniff");
    reply.header("X-Frame-Options", "DENY");
    reply.header("X-XSS-Protection", "0"); // Modern approach — rely on CSP
    reply.header("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
    reply.header(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'"
    );
    reply.header("Referrer-Policy", "strict-origin-when-cross-origin");
    reply.header("Permissions-Policy", "camera=(), microphone=(), geolocation=()");

    // API versioning
    reply.header("X-API-Version", "1.0.0");
    reply.header("X-Blackfyre-Region", process.env.BLACKFYRE_REGION || "in-1");

    // Remove server fingerprint
    reply.removeHeader("X-Powered-By");
  });
};

export default fp(securityHeadersPlugin, { name: "security-headers" });
