import type { FastifyPluginAsync } from "fastify";
import { and, desc, eq, lt, or } from "drizzle-orm";
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
  // The cursor is the PAIR (createdAt, id), not createdAt alone. `created_at`
  // defaults to now(), which is transaction-stable, so every row written in one
  // transaction shares an identical timestamp; a page boundary landing inside such
  // a group would skip the rest of it forever. A JS Date is also only
  // millisecond-precision against a microsecond column, which loses rows the same
  // way. Both are unacceptable on an audit trail — silently omitting entries is
  // exactly what this route exists to prevent.
  before: z.coerce.date().optional(),
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
    // (createdAt, id) < (before, beforeId), expressed for Postgres via OR so the
    // composite index is still usable.
    if (q.before && q.beforeId) {
      predicates.push(
        or(
          lt(auditLogs.createdAt, q.before),
          and(eq(auditLogs.createdAt, q.before), lt(auditLogs.id, q.beforeId)),
        )!,
      );
    } else if (q.before) {
      predicates.push(lt(auditLogs.createdAt, q.before));
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
      // Both halves of the cursor — pass them back as `before` and `beforeId`.
      nextBefore: hasMore ? page[page.length - 1]?.createdAt ?? null : null,
      nextBeforeId: hasMore ? page[page.length - 1]?.id ?? null : null,
    };
  });
};
