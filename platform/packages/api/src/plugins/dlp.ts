import fp from "fastify-plugin";
import type { FastifyPluginAsync } from "fastify";
import { DlpService } from "../services/dlp-service.js";

const SKIP_PATHS = ["/health", "/healthz", "/ready", "/api/health"];

const dlpPlugin: FastifyPluginAsync = async (app) => {
  // REAL IMPL (BLACKFYRE 2026-06): construct with the DB handle + logger so persisted
  // per-tenant DLP rules (dlp_rules table) are connected and survive restart.
  const dlpService = new DlpService(app.db, app.log);
  app.addHook("onSend", async (request, reply, payload) => {
    const urlPath = request.url.split("?")[0];
    if (SKIP_PATHS.some((p) => urlPath === p || urlPath.startsWith(p + "/"))) return payload;

    // Only scan string (JSON/text) payloads — skip binary/streams
    if (typeof payload !== "string" || payload.length === 0) return payload;

    // Only scan JSON responses to avoid double-encoding plain text errors
    const contentType = reply.getHeader("content-type") as string | undefined;
    if (!contentType?.includes("application/json")) return payload;

    const result = dlpService.scanContent(payload);
    if (result.clean) return payload;

    const tenantId = (request as any).tenantId ?? "unknown";

    // Determine the highest-priority action across all violations
    const hasBlock = result.violations.some((v) => v.action === "block");
    const hasRedact = result.violations.some((v) => v.action === "redact");

    if (hasBlock) {
      app.log.warn(
        {
          tenantId,
          url: request.url,
          method: request.method,
          violations: result.violations.map((v) => ({
            id: v.ruleId,
            name: v.ruleName,
            severity: v.severity,
            matches: v.matchCount,
          })),
        },
        "DLP: response blocked — sensitive content detected",
      );

      reply.status(451);
      return JSON.stringify({
        error: {
          code: "DLP_CONTENT_BLOCKED",
          message: "Content blocked by DLP policy",
        },
      });
    }

    if (hasRedact && result.redactedContent !== undefined) {
      app.log.warn(
        {
          tenantId,
          url: request.url,
          method: request.method,
          violations: result.violations.map((v) => ({
            id: v.ruleId,
            name: v.ruleName,
            severity: v.severity,
            matches: v.matchCount,
          })),
        },
        "DLP: sensitive content redacted in response",
      );

      return result.redactedContent;
    }

    // action === "alert" only — log and allow through
    app.log.warn(
      {
        tenantId,
        url: request.url,
        method: request.method,
        violations: result.violations.map((v) => ({
          id: v.ruleId,
          name: v.ruleName,
          severity: v.severity,
          matches: v.matchCount,
        })),
      },
      "DLP: alert-level sensitive content in response (allowed through)",
    );

    return payload;
  });
};

export default fp(dlpPlugin, { name: "dlp" });
