import fp from "fastify-plugin";
import type { FastifyPluginAsync } from "fastify";
import { AuditChainService } from "../services/audit-chain-service.js";

/** Map HTTP method to action verb */
function methodToVerb(method: string): string {
  switch (method) {
    case "POST":
      return "create";
    case "PATCH":
    case "PUT":
      return "update";
    case "DELETE":
      return "delete";
    default:
      return method.toLowerCase();
  }
}

/**
 * Derive an audit action string from HTTP method and URL path.
 * e.g. POST /api/scans -> "scan.create"
 *      PATCH /api/findings/abc-123 -> "finding.update"
 *      DELETE /api/alert-rules/xyz -> "alert-rule.delete"
 */
function deriveAction(method: string, url: string): string {
  // Strip query string
  const path = url.split("?")[0];

  // Match /api/<resource> or /api/<resource>/<id> patterns
  const segments = path.split("/").filter(Boolean);

  // Find the segment after "api"
  const apiIdx = segments.indexOf("api");
  if (apiIdx === -1 || apiIdx + 1 >= segments.length) {
    return `unknown.${methodToVerb(method)}`;
  }

  // Resource name: plurals -> singular, kebab-case preserved
  let resource = segments[apiIdx + 1];
  // Simple singularize: strip trailing 's' (handles scans->scan, findings->finding, etc.)
  if (resource.endsWith("ies")) {
    resource = resource.slice(0, -3) + "y";
  } else if (resource.endsWith("ses")) {
    // e.g. "addresses" -> leave as-is handled below won't match but that's fine
    resource = resource.slice(0, -2);
  } else if (resource.endsWith("s")) {
    resource = resource.slice(0, -1);
  }

  return `${resource}.${methodToVerb(method)}`;
}

/** Extract the resource ID from the URL if present */
function extractResourceId(url: string): string | undefined {
  const path = url.split("?")[0];
  const segments = path.split("/").filter(Boolean);
  const apiIdx = segments.indexOf("api");
  if (apiIdx === -1) return undefined;
  // /api/resource/:id
  if (apiIdx + 2 < segments.length) {
    return segments[apiIdx + 2];
  }
  return undefined;
}

/** Extract resource type from URL */
function extractResourceType(url: string): string | undefined {
  const path = url.split("?")[0];
  const segments = path.split("/").filter(Boolean);
  const apiIdx = segments.indexOf("api");
  if (apiIdx === -1 || apiIdx + 1 >= segments.length) return undefined;
  return segments[apiIdx + 1];
}

const SKIP_PATHS = ["/health", "/healthz", "/ready", "/api/health"];
const AUDITED_METHODS = new Set(["POST", "PATCH", "PUT", "DELETE"]);

const auditLogPlugin: FastifyPluginAsync = async (app) => {
  const chainService = new AuditChainService(app.db);

  app.addHook("onResponse", async (request, reply) => {
    // Only audit mutating methods
    if (!AUDITED_METHODS.has(request.method)) return;

    // Skip health check routes
    const urlPath = request.url.split("?")[0];
    if (SKIP_PATHS.some((p) => urlPath === p || urlPath.startsWith(p + "/"))) return;

    // Skip if no authenticated user (auth plugin sets these)
    const tenantId = (request as any).tenantId as string | undefined;
    const userId = (request as any).userId as string | undefined;
    if (!tenantId || !userId) return;

    // Only log successful mutations (2xx and 3xx)
    if (reply.statusCode >= 400) return;

    const action = deriveAction(request.method, request.url);
    const resourceType = extractResourceType(request.url);
    const resourceId = extractResourceId(request.url);
    const ipAddress = request.ip;
    const userAgent = request.headers["user-agent"] || undefined;

    // Await the chain write so failures are captured, but never propagate
    // errors to the caller — user requests must not fail due to audit issues.
    try {
      await chainService.logChained({
        tenantId,
        userId,
        action,
        resourceType,
        resourceId,
        ipAddress,
        userAgent,
      });
    } catch (err) {
      request.log.error(
        {
          err,
          auditEntry: { tenantId, userId, action, resourceType, resourceId, ipAddress },
        },
        "[AuditChainService] Failed to write chained audit log — entry may need manual replay",
      );
    }
  });
};

export default fp(auditLogPlugin, { name: "audit-log" });
