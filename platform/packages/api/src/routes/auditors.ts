import type { FastifyPluginAsync } from "fastify";
import { eq, and } from "drizzle-orm";
import { auditorFrameworks, users } from "../db/schema.js";
import { z } from "zod";
import { notFound } from "../utils/errors.js";
import { requireUUID } from "../utils/security-fixes.js";

const inviteAuditorSchema = z.object({
  userId: z.string().uuid(),
  framework: z.string().min(1).max(20),
});

export const auditorRoutes: FastifyPluginAsync = async (app) => {
  const adminOnly = (app as any).requireRole("owner", "admin");

  // POST /api/auditors/invite — invite a user as auditor for a framework
  app.post("/api/auditors/invite", { preHandler: [adminOnly] }, async (request, reply) => {
    const body = inviteAuditorSchema.parse(request.body);

    // SECURITY FIX (BLACKFYRE audit 2026-06-05): use the RLS-bound request.db so
    // Postgres RLS enforces tenant isolation (was app.db, which bypasses RLS).
    // Falls back to app.db only if unset; this route runs behind requireRole so
    // request.db is always populated. The explicit tenantId predicate below is
    // retained as defense-in-depth against cross-tenant user enumeration.
    const db = request.db ?? app.db;

    // Verify user exists and belongs to same tenant
    const [user] = await db
      .select()
      .from(users)
      .where(and(eq(users.id, body.userId), eq(users.tenantId, request.tenantId)))
      .limit(1);

    if (!user) {
      // SECURITY FIX (BLACKFYRE audit 2026-06-05): 404 (not 403) on a cross-tenant
      // or missing user so the response does not confirm existence in another
      // tenant. Log the denial at warn for anomaly detection (no PII logged).
      request.log.warn(
        { event: "auditor.invite.denied", targetUserId: body.userId, tenantId: request.tenantId },
        "Auditor invite denied: target user not found in tenant",
      );
      throw notFound("User");
    }

    const assignment = await db.transaction(async (tx) => {
      // Update user role to auditor if not already
      if (user.role !== "auditor") {
        // SECURITY FIX (BLACKFYRE audit 2026-06-05): scope the role update with an
        // explicit tenantId predicate (defense-in-depth alongside RLS) so it can
        // never mutate a same-id user in another tenant.
        await tx
          .update(users)
          .set({ role: "auditor" as any })
          .where(and(eq(users.id, body.userId), eq(users.tenantId, request.tenantId)));
      }

      // Insert auditor framework assignment
      const [row] = await tx
        .insert(auditorFrameworks)
        .values({
          userId: body.userId,
          tenantId: request.tenantId,
          framework: body.framework,
          assignedBy: request.userId,
        })
        .onConflictDoNothing()
        .returning();

      return row;
    });

    return reply.status(201).send({
      assignment: assignment ?? {
        userId: body.userId,
        framework: body.framework,
        status: "already_assigned",
      },
    });
  });

  // GET /api/auditors — list auditor assignments for tenant
  app.get("/api/auditors", { preHandler: [adminOnly] }, async (request) => {
    // SECURITY FIX (BLACKFYRE audit 2026-06-05): list via the RLS-bound request.db
    // (was app.db). The explicit tenantId predicate is kept as defense-in-depth so
    // the list can never enumerate another tenant's auditor assignments.
    const db = request.db ?? app.db;
    const assignments = await db
      .select()
      .from(auditorFrameworks)
      .where(eq(auditorFrameworks.tenantId, request.tenantId));

    return { auditors: assignments };
  });

  // DELETE /api/auditors/:userId/frameworks/:framework — revoke auditor access
  app.delete<{ Params: { userId: string; framework: string } }>(
    "/api/auditors/:userId/frameworks/:framework",
    { preHandler: [adminOnly] },
    async (request) => {
      requireUUID(request.params.userId);

      // SECURITY FIX (BLACKFYRE audit 2026-06-05): revoke via the RLS-bound
      // request.db (was app.db). The delete already filters on tenantId; that
      // explicit predicate is retained as defense-in-depth so a cross-tenant
      // assignment can never be revoked.
      const db = request.db ?? app.db;
      const [deleted] = await db
        .delete(auditorFrameworks)
        .where(
          and(
            eq(auditorFrameworks.userId, request.params.userId),
            eq(auditorFrameworks.framework, request.params.framework),
            eq(auditorFrameworks.tenantId, request.tenantId),
          ),
        )
        .returning();

      if (!deleted) {
        // SECURITY FIX (BLACKFYRE audit 2026-06-05): 404 (not 403) on a
        // cross-tenant / missing assignment; log the denial at warn (no PII).
        request.log.warn(
          {
            event: "auditor.revoke.denied",
            targetUserId: request.params.userId,
            framework: request.params.framework,
            tenantId: request.tenantId,
          },
          "Auditor revoke denied: assignment not found in tenant",
        );
        throw notFound("Auditor assignment");
      }
      return { deleted };
    },
  );
};
