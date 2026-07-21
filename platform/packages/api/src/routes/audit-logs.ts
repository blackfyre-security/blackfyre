import type { FastifyPluginAsync } from "fastify";
import { and, desc, eq, lt, or, sql } from "drizzle-orm";
import { z } from "zod";
import { auditLogs } from "../db/schema.js";

/**
 * Tenant-scoped audit trail.
 *
 * The only reader for `audit_logs` used to be the operator console's
 * cross-tenant `GET /api/admin/audit-logs`, which is not part of the
 * open-source release (ADR-0005). Without this route a self-hosted install
 * writes an audit trail nobody can read — untenable for a compliance product,
 * where "show me who did what" is the product.
 *
 * Reads go through `request.db`, the RLS-bound handle, so Postgres enforces
 * tenant isolation below the query. The explicit tenantId predicate is
 * defence-in-depth, matching the convention in routes/team.ts.
 */

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  // Keyset pagination. Offset pagination on an append-heavy table drifts as rows
  // arrive mid-scroll and degrades on large tenants.
  //
  // The cursor is the id of the last row returned — NOT a timestamp. created_at is
  // timestamptz (microseconds); a JS Date, and the ISO string it serialises to, are
  // millisecond-precision. Round-tripping the timestamp truncates it, so every row
  // in the sub-millisecond remainder falls outside both branches of the comparison
  // and is silently skipped. Passing only the id lets Postgres resolve the exact
  // stored value server-side, at full precision.
  beforeId: z.string().uuid().optional(),
  action: z.string().max(100).optional(),
  outcome: z.enum(["success", "failure"]).optional(),
});

export const auditLogRoutes: FastifyPluginAsync = async (app) => {
  // Audit trails routinely record who viewed or changed sensitive settings, so
  // reading them is an owner/admin capability rather than a general one.
  const adminOrOwner = (app as any).requireRole("owner", "admin");

  app.get("/api/audit-logs", { preHandler: [adminOrOwner] }, async (request) => {
    const q = querySchema.parse(request.query);

    const predicates = [eq(auditLogs.tenantId, request.tenantId)];
    // (created_at, id) < (SELECT created_at, id FROM audit_logs WHERE id = cursor)
    // Row-comparison form, so Postgres can range-scan it, and the boundary values
    // never leave the database. The subquery is tenant-scoped too: a cursor naming
    // another tenant's row resolves to NULL, the comparison is NULL, and the page
    // comes back empty rather than leaking an ordering position.
    if (q.beforeId) {
      predicates.push(
        sql`(${auditLogs.createdAt}, ${auditLogs.id}) < (
          SELECT a2.created_at, a2.id FROM audit_logs a2
          WHERE a2.id = ${q.beforeId} AND a2.tenant_id = ${request.tenantId}
        )`,
      );
    }
    if (q.action) predicates.push(eq(auditLogs.action, q.action));
    if (q.outcome) predicates.push(eq(auditLogs.outcome, q.outcome));

    // Fetch one extra row to determine whether another page exists without a
    // second COUNT query.
    const rows = await request.db!
      .select()
      .from(auditLogs)
      .where(and(...predicates))
      .orderBy(desc(auditLogs.createdAt), desc(auditLogs.id))
      .limit(q.limit + 1);

    const hasMore = rows.length > q.limit;
    const page = hasMore ? rows.slice(0, q.limit) : rows;

    return {
      entries: page.map((r) => ({
        id: r.id,
        action: r.action,
        actorType: r.actorType,
        actorEmail: r.actorEmail,
        resourceType: r.resourceType,
        resourceId: r.resourceId,
        outcome: r.outcome,
        ipAddress: r.ipAddress,
        createdAt: r.createdAt,
        // `details` is deliberately omitted from the list view: it is free-form
        // JSON written by many call sites and can carry incidental payload
        // fragments. Summary fields above are the vetted surface.
      })),
      hasMore,
      // Pass this back as `beforeId` to fetch the next page.
      nextBeforeId: hasMore ? page[page.length - 1]?.id ?? null : null,
    };
  });
};
