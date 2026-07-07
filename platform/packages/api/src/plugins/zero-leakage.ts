import fp from "fastify-plugin";
import type { FastifyPluginAsync } from "fastify";

const SKIP_PATHS = ["/health", "/healthz", "/ready", "/api/health"];

// Path prefixes that legitimately return cross-tenant data (platform-admin only routes).
// These routes enforce their own is_platform_admin check before responding.
const SKIP_PREFIXES = ["/api/admin/"];

// Fields whose values are treated as tenant identifiers
const TENANT_ID_FIELDS = new Set(["tenantId", "tenant_id", "organizationId", "organization_id"]);

// UUID v4 pattern for detecting raw UUIDs in response bodies
const UUID_PATTERN = /\b[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi;

// Per-tenant violation counters for anomaly detection (in-process, resets on restart)
const violationCounters = new Map<string, number>();

function incrementViolation(tenantId: string): number {
  const current = violationCounters.get(tenantId) ?? 0;
  const next = current + 1;
  violationCounters.set(tenantId, next);
  return next;
}

/**
 * Recursively scan a parsed JSON object for any tenant ID field whose value
 * does not match the expected tenant ID.
 *
 * Returns the first offending field path found, or null if the object is clean.
 */
function detectCrossTenantField(
  obj: unknown,
  expectedTenantId: string,
  path = "",
): string | null {
  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      const hit = detectCrossTenantField(obj[i], expectedTenantId, `${path}[${i}]`);
      if (hit) return hit;
    }
    return null;
  }

  if (obj !== null && typeof obj === "object") {
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      const fieldPath = path ? `${path}.${key}` : key;

      if (TENANT_ID_FIELDS.has(key) && typeof value === "string" && value !== expectedTenantId) {
        return fieldPath;
      }

      const nested = detectCrossTenantField(value, expectedTenantId, fieldPath);
      if (nested) return nested;
    }
    return null;
  }

  return null;
}

/**
 * Extract all UUID-like strings from the serialised JSON body.
 * Used to detect cross-tenant UUID leakage when a known tenant UUID set is provided.
 */
function extractUuids(body: string): string[] {
  return (body.match(UUID_PATTERN) ?? []).map((u) => u.toLowerCase());
}

const zeroLeakagePlugin: FastifyPluginAsync = async (app) => {
  // ---------------------------------------------------------------------------
  // preHandler — validate that tenant IDs in request params / body are coherent
  // ---------------------------------------------------------------------------
  app.addHook("preHandler", async (request, reply) => {
    const tenantId = (request as any).tenantId as string | undefined;
    if (!tenantId) return; // unauthenticated routes pass through

    const urlPath = request.url.split("?")[0];
    if (SKIP_PATHS.some((p) => urlPath === p || urlPath.startsWith(p + "/"))) return;
    if (SKIP_PREFIXES.some((p) => urlPath.startsWith(p))) return;

    // Check query parameters
    const query = request.query as Record<string, unknown>;
    for (const field of TENANT_ID_FIELDS) {
      if (field in query && query[field] !== tenantId) {
        const count = incrementViolation(tenantId);
        app.log.warn(
          { tenantId, field, provided: query[field], violationCount: count },
          "Zero-leakage: cross-tenant query param detected",
        );
        return reply.status(403).send({
          error: {
            code: "CROSS_TENANT_QUERY_PARAM",
            message: "Tenant ID in query does not match authenticated tenant",
          },
        });
      }
    }

    // Check request body (only for object payloads)
    const body = request.body;
    if (body !== null && typeof body === "object" && !Array.isArray(body)) {
      const bodyObj = body as Record<string, unknown>;
      for (const field of TENANT_ID_FIELDS) {
        if (field in bodyObj && bodyObj[field] !== tenantId) {
          const count = incrementViolation(tenantId);
          app.log.warn(
            { tenantId, field, provided: bodyObj[field], violationCount: count },
            "Zero-leakage: cross-tenant body field detected",
          );
          return reply.status(403).send({
            error: {
              code: "CROSS_TENANT_BODY_FIELD",
              message: "Tenant ID in request body does not match authenticated tenant",
            },
          });
        }
      }
    }
  });

  // ---------------------------------------------------------------------------
  // onSend — inspect ALL response bodies for cross-tenant data leakage
  // ---------------------------------------------------------------------------
  app.addHook("onSend", async (request, reply, payload) => {
    const tenantId = (request as any).tenantId as string | undefined;
    if (!tenantId) return payload;

    const urlPath = request.url.split("?")[0];
    if (SKIP_PATHS.some((p) => urlPath === p || urlPath.startsWith(p + "/"))) return payload;
    if (SKIP_PREFIXES.some((p) => urlPath.startsWith(p))) return payload;

    // Only inspect JSON responses
    const contentType = reply.getHeader("content-type") as string | undefined;
    if (!contentType?.includes("application/json")) return payload;

    if (typeof payload !== "string" || payload.length === 0) return payload;

    let parsed: unknown;
    try {
      parsed = JSON.parse(payload);
    } catch {
      return payload;
    }

    // Deep-scan for tenant ID fields with wrong values
    const crossTenantField = detectCrossTenantField(parsed, tenantId);
    if (crossTenantField) {
      const count = incrementViolation(tenantId);
      app.log.error(
        {
          tenantId,
          field: crossTenantField,
          url: request.url,
          method: request.method,
          violationCount: count,
          severity: "CRITICAL",
        },
        "ZERO-LEAKAGE ALERT: Cross-tenant data detected in response — blocking",
      );

      reply.status(500);
      return JSON.stringify({
        error: {
          code: "DATA_LEAKAGE_PREVENTED",
          message: "Response blocked: cross-tenant data detected",
        },
      });
    }

    return payload;
  });
};

export default fp(zeroLeakagePlugin, { name: "zero-leakage", dependencies: ["auth"] });
