import type { FastifyPluginAsync } from "fastify";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { users } from "../db/schema.js";
import { notFound, badRequest, conflict, forbidden } from "../utils/errors.js";
import { requireUUID } from "../utils/security-fixes.js";
import { hashPassword } from "../utils/password.js";
import { nanoid } from "nanoid";
import { planLimiter, normalizePlan } from "../services/provisioning-service.js";

/**
 * Team management — tenant-scoped CRUD over the users table, rendered by
 * the portal's /team page.
 */
export const teamRoutes: FastifyPluginAsync = async (app) => {
  const authenticated = (app as any).requireRole("owner", "admin", "engineer", "viewer");
  const adminOrOwner = (app as any).requireRole("owner", "admin");

  const roleEnum = z.enum(["owner", "admin", "engineer", "viewer"]);

  // SECURITY FIX (BLACKFYRE audit 2026-06-05): vertical privilege-escalation —
  // assignable roles are now strictly ordered so we can reject any attempt to
  // grant or invite at a role >= the caller's own. Higher number = more
  // privilege. `owner` is the apex: only an existing owner may grant/transfer
  // the owner role (admins must not create or elevate to owner). Auditor is a
  // cross-tenant role that is never assignable via this tenant-team surface, so
  // it is intentionally absent from this ranking and from roleEnum.
  const roleRank: Record<string, number> = {
    viewer: 0,
    engineer: 1,
    admin: 2,
    owner: 3,
  };

  const inviteSchema = z.object({
    email: z.string().email().max(320),
    name: z.string().min(1).max(200).optional(),
    role: roleEnum,
  });

  const updateRoleSchema = z.object({
    role: roleEnum,
  });

  function toTeamMember(u: typeof users.$inferSelect) {
    return {
      id: u.id,
      tenantId: u.tenantId,
      name: u.name,
      email: u.email,
      role: u.role,
      status: "active" as const,
      lastLoginAt: u.lastLogin ? u.lastLogin.toISOString() : null,
    };
  }

  // GET /api/team — list all team members for the current tenant
  app.get("/api/team", { preHandler: [authenticated] }, async (request) => {
    // SECURITY FIX (BLACKFYRE audit 2026-06-05): use the request-scoped,
    // RLS-bound handle so Postgres enforces tenant isolation even if the
    // explicit tenant filter is ever dropped. The tenant filter is retained as
    // harmless defense-in-depth.
    const rows = await request.db!
      .select()
      .from(users)
      .where(eq(users.tenantId, request.tenantId))
      .orderBy(users.createdAt)
      .limit(200);
    return { members: rows.map(toTeamMember) };
  });

  // POST /api/team/invite — create a new user for this tenant
  app.post("/api/team/invite", { preHandler: [adminOrOwner] }, async (request, reply) => {
    const body = inviteSchema.parse(request.body);

    // SECURITY FIX (BLACKFYRE audit 2026-06-05): vertical privilege-escalation —
    // an admin must not be able to provision an `owner` (or another admin)
    // account. Forbid inviting at a role greater than or equal to the caller's
    // own. Only an owner may invite an owner; admins are capped below owner.
    if (roleRank[body.role] >= roleRank[request.userRole]) {
      request.log.warn(
        {
          event: "team.invite.blocked",
          reason: "role_elevation",
          actorId: request.userId,
          actorRole: request.userRole,
          requestedRole: body.role,
          tenantId: request.tenantId,
        },
        "Blocked invite at a role >= the inviter's own role",
      );
      throw forbidden("You cannot invite a user at a role equal to or above your own");
    }

    // Check for duplicate email globally (users.email is unique).
    // Cross-tenant uniqueness check must bypass RLS, so superDb is correct here.
    const [existing] = await app.superDb
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, body.email))
      .limit(1);
    if (existing) throw conflict("EMAIL_EXISTS", `User ${body.email} already exists`);

    // REAL IMPL (BLACKFYRE 2026-06): enforce the plan's maxTeamMembers limit
    // BEFORE creating the user (Comply:3, Protect:10, Defend:unlimited). The limit
    // comes from PLAN_FEATURES via the provisioning service — nothing is hardcoded
    // here. We check after the duplicate-email guard so a rejected duplicate never
    // consumes a seat in the comparison. Counting on the RLS-bound request.db keeps
    // it tenant-scoped; blocked attempts throw 403 PLAN_LIMIT_REACHED {upgradeUrl}
    // and log at warn.
    await planLimiter(request.db!).assertCanAddTeamMember(
      request.tenantId,
      normalizePlan(request.tenantPlan),
      request.log,
    );

    // SECURITY FIX (BLACKFYRE audit 2026-06-05): never return the temp password
    // in the API response — it is a bearer credential and would leak through
    // logs, proxies, and the portal client. We persist a hash of a random
    // password the user can never know, forcing the invitee onto the existing
    // password-reset / first-login flow (out-of-band email) to set their own.
    const tempPassword = nanoid(32);
    const passwordHash = await hashPassword(tempPassword);

    const [created] = await request.db!
      .insert(users)
      .values({
        tenantId: request.tenantId,
        email: body.email,
        name: body.name ?? body.email.split("@")[0],
        passwordHash,
        role: body.role,
      })
      .returning();

    // SECURITY FIX (BLACKFYRE audit 2026-06-05): audit trail for account
    // provisioning. Sensitive-but-normal -> info. Never log the password.
    request.log.info(
      {
        event: "team.invite.ok",
        actorId: request.userId,
        actorRole: request.userRole,
        newUserId: created.id,
        grantedRole: created.role,
        tenantId: request.tenantId,
      },
      "Provisioned new team member",
    );

    // tempPassword is intentionally NOT returned; delivered out-of-band.
    return reply.status(201).send({
      member: toTeamMember(created),
    });
  });

  // PATCH /api/team/:id/role — change a member's role
  app.patch<{ Params: { id: string }; Body: unknown }>(
    "/api/team/:id/role",
    { preHandler: [adminOrOwner] },
    async (request) => {
      requireUUID(request.params.id);
      const { role } = updateRoleSchema.parse(request.body);

      // Load the target's current role (RLS-bound handle keeps this in-tenant).
      const [target] = await request.db!
        .select({ id: users.id, role: users.role })
        .from(users)
        .where(and(eq(users.id, request.params.id), eq(users.tenantId, request.tenantId)))
        .limit(1);
      if (!target) throw notFound("Team member");

      // SECURITY FIX (BLACKFYRE audit 2026-06-05): auditor is a cross-tenant role
      // managed exclusively via /api/auditors/*, and is intentionally absent from
      // `roleRank`. Without this guard the rank comparison below would evaluate
      // `roleRank[target.role]` to `undefined` for an auditor target, making
      // `undefined >= actorRank` false and silently permitting an admin/owner to
      // mutate an auditor's role via this tenant-team surface. Reject outright.
      if (target.role === "auditor") {
        request.log.warn(
          {
            event: "team.role.blocked",
            reason: "auditor_managed_separately",
            actorId: request.userId,
            actorRole: request.userRole,
            targetId: target.id,
            currentRole: target.role,
            requestedRole: role,
            tenantId: request.tenantId,
          },
          "Blocked role change on an auditor target via the team endpoint",
        );
        throw forbidden("Cannot modify auditor assignments via the team endpoint");
      }

      // SECURITY FIX (BLACKFYRE audit 2026-06-05): vertical privilege-escalation —
      // an admin could previously promote any user (including themselves) to
      // `owner`, and could grant/strip roles at or above their own level. We now
      // require: (1) only an `owner` may grant OR transfer the `owner` role —
      // admins can neither create nor elevate to owner; (2) no caller may assign
      // a role >= their own (admins are capped below owner); (3) no caller may
      // modify a member who already outranks them (e.g. an admin cannot demote
      // an owner). These collapse to a single rank comparison against the
      // caller, plus an explicit owner-only gate for any owner involvement.
      const actorRank = roleRank[request.userRole];
      const targetRequiresOwner = role === "owner" || target.role === "owner";

      if (targetRequiresOwner && request.userRole !== "owner") {
        request.log.warn(
          {
            event: "team.role.blocked",
            reason: "owner_role_requires_owner",
            actorId: request.userId,
            actorRole: request.userRole,
            targetId: target.id,
            currentRole: target.role,
            requestedRole: role,
            tenantId: request.tenantId,
          },
          "Blocked owner-role grant/transfer by a non-owner",
        );
        throw forbidden("Only an owner may grant or transfer the owner role");
      }

      if (roleRank[role] >= actorRank || roleRank[target.role] >= actorRank) {
        request.log.warn(
          {
            event: "team.role.blocked",
            reason: "role_elevation",
            actorId: request.userId,
            actorRole: request.userRole,
            targetId: target.id,
            currentRole: target.role,
            requestedRole: role,
            tenantId: request.tenantId,
          },
          "Blocked role change at or above the actor's own role",
        );
        throw forbidden("You cannot assign or modify a role at or above your own");
      }

      const [updated] = await request.db!
        .update(users)
        .set({ role })
        .where(and(eq(users.id, request.params.id), eq(users.tenantId, request.tenantId)))
        .returning();

      if (!updated) throw notFound("Team member");

      // SECURITY FIX (BLACKFYRE audit 2026-06-05): audit trail for role changes.
      request.log.info(
        {
          event: "team.role.changed",
          actorId: request.userId,
          actorRole: request.userRole,
          targetId: updated.id,
          fromRole: target.role,
          toRole: updated.role,
          tenantId: request.tenantId,
        },
        "Changed team member role",
      );
      return { member: toTeamMember(updated) };
    },
  );

  // DELETE /api/team/:id — remove a member
  app.delete<{ Params: { id: string } }>(
    "/api/team/:id",
    { preHandler: [adminOrOwner] },
    async (request) => {
      requireUUID(request.params.id);

      // Don't let an owner delete themselves — the tenant would have no owner
      if (request.params.id === request.userId) {
        throw badRequest("CANNOT_REMOVE_SELF", "You cannot remove yourself from the team");
      }

      // SECURITY FIX (BLACKFYRE audit 2026-06-05): vertical privilege-escalation —
      // the DELETE handler previously let any admin/owner remove ANY member with
      // no rank check, so an admin could delete an owner. Mirror the PATCH guards:
      // load the target's role (RLS-bound handle keeps this in-tenant) and reject
      // removing a member at or above the caller's own rank. The owner self-delete
      // guard above is insufficient on its own.
      const [target] = await request.db!
        .select({ id: users.id, role: users.role })
        .from(users)
        .where(and(eq(users.id, request.params.id), eq(users.tenantId, request.tenantId)))
        .limit(1);
      if (!target) throw notFound("Team member");

      // SECURITY FIX (BLACKFYRE audit 2026-06-05): auditor is a cross-tenant role
      // managed via /api/auditors/* and is intentionally absent from `roleRank`.
      // `roleRank["auditor"]` is `undefined`, so `undefined >= rank` would be false
      // and would let an admin/owner delete an auditor through this surface. Reject.
      if (target.role === "auditor") {
        request.log.warn(
          {
            event: "team.delete.blocked",
            reason: "auditor_managed_separately",
            actorId: request.userId,
            actorRole: request.userRole,
            targetId: target.id,
            currentRole: target.role,
            tenantId: request.tenantId,
          },
          "Blocked deletion of an auditor target via the team endpoint",
        );
        throw forbidden("Cannot remove auditor assignments via the team endpoint");
      }

      if (roleRank[target.role] >= roleRank[request.userRole]) {
        request.log.warn(
          {
            event: "team.delete.blocked",
            reason: "rank_escalation",
            actorId: request.userId,
            actorRole: request.userRole,
            targetId: target.id,
            currentRole: target.role,
            tenantId: request.tenantId,
          },
          "Blocked deletion of a member at or above the actor's own role",
        );
        throw forbidden("You cannot remove a user at or above your own role");
      }

      // SECURITY FIX (BLACKFYRE audit 2026-06-05): use the RLS-bound handle so
      // Postgres enforces tenant isolation on the delete; tenant filter kept as
      // defense-in-depth.
      const [deleted] = await request.db!
        .delete(users)
        .where(and(eq(users.id, request.params.id), eq(users.tenantId, request.tenantId)))
        .returning({ id: users.id });

      if (!deleted) throw notFound("Team member");
      return { success: true };
    },
  );
};
