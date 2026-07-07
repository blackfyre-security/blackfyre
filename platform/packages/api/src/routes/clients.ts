import type { FastifyPluginAsync } from "fastify";
import { eq } from "drizzle-orm";
import { tenants, users } from "../db/schema.js";
import { createTenantSchema, updateTenantSchema } from "@blackfyre/shared";
import { notFound, conflict, badRequest } from "../utils/errors.js";
import { requireUUID } from "../utils/security-fixes.js";

export const clientRoutes: FastifyPluginAsync = async (app) => {
  const authenticated = (app as any).authenticate;

  // SECURITY FIX (BLACKFYRE audit 2026-06-05): broken tenant isolation / platform-operator exposure
  // — The /api/clients routes operate cross-tenant over app.superDb (list/read/modify/suspend/onboard
  // ANY tenant) yet were only gated by requireRole("owner","admin"), a TENANT-level role. That let any
  // tenant's own admin enumerate and mutate every other tenant. These are platform-operator routes, so
  // we replace the tenant-role guard with the same platform-admin check used by /api/admin/* (admin.ts):
  // authenticate, then require users.isPlatformAdmin === true (resolved via the RLS-bypassing owner pool,
  // since the caller's row may live in a different tenant context). 403 denials are logged for audit.
  const platformAdminOnly = async (request: any, reply: any) => {
    await (app as any).authenticate(request);
    const userId: string | undefined = request.userId;
    if (!userId) {
      request.log.warn(
        { route: request.routeOptions?.url ?? request.url, ip: request.ip },
        "clients: unauthenticated platform-admin request rejected (401)",
      );
      return reply.status(401).send({ error: "Unauthorized" });
    }
    const [user] = await app.superDb
      .select({ isPlatformAdmin: users.isPlatformAdmin })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!user || user.isPlatformAdmin !== true) {
      // SECURITY FIX (BLACKFYRE audit 2026-06-05): cross-tenant access denial — log the 403 so attempts
      // by tenant admins to reach platform-operator client routes are auditable. No secrets/PII logged.
      request.log.warn(
        {
          userId,
          tenantId: request.tenantId,
          route: request.routeOptions?.url ?? request.url,
          ip: request.ip,
        },
        "clients: non-platform-admin denied access to cross-tenant client route (403)",
      );
      return reply.status(403).send({ error: "Forbidden: platform admin access required" });
    }
  };
  const adminOnly = platformAdminOnly;

  // GET /api/clients
  app.get("/api/clients", { preHandler: [adminOnly] }, async () => {
    const rows = await app.superDb.select().from(tenants).orderBy(tenants.createdAt).limit(100);
    // Map to the shape the admin frontend expects (company/industry/status aliases).
    const clients = rows.map((t) => ({
      id: t.id,
      company: t.name,
      slug: t.slug,
      industry: t.industryProfile,
      industryProfile: t.industryProfile,
      plan: t.plan,
      status: t.onboardingStatus,
      onboardingStatus: t.onboardingStatus,
      complianceScore: 0,
      lastScan: null as string | null,
      createdAt: t.createdAt,
    }));
    return { clients };
  });

  // POST /api/clients
  app.post("/api/clients", { preHandler: [adminOnly] }, async (request, reply) => {
    const body = createTenantSchema.parse(request.body);

    // SECURITY FIX (BLACKFYRE audit 2026-06-05): platform-operator path — provisioning a new tenant is
    // inherently cross-tenant, so use the owner pool (app.superDb) explicitly now that access is gated by
    // platformAdminOnly. The handler is unreachable without a verified platform admin (logged above).
    // Check slug uniqueness
    const [existing] = await app.superDb
      .select({ id: tenants.id })
      .from(tenants)
      .where(eq(tenants.slug, body.slug))
      .limit(1);

    if (existing) throw conflict("SLUG_EXISTS", `Slug "${body.slug}" is already in use`);

    const [created] = await app.superDb
      .insert(tenants)
      .values({
        name: body.name,
        slug: body.slug,
        plan: body.plan,
        industryProfile: body.industryProfile,
      })
      .returning();

    return reply.status(201).send({ client: created });
  });

  // GET /api/clients/:id
  app.get<{ Params: { id: string } }>("/api/clients/:id", {
    preHandler: [adminOnly],
  }, async (request) => {
    requireUUID(request.params.id);
    // SECURITY FIX (BLACKFYRE audit 2026-06-05): cross-tenant read over owner pool, now reachable only by
    // a verified platform admin (platformAdminOnly guard). Log the privileged access for audit.
    request.log.info(
      { userId: request.userId, targetTenantId: request.params.id },
      "clients: platform admin reading tenant detail",
    );
    const [client] = await app.superDb
      .select()
      .from(tenants)
      .where(eq(tenants.id, request.params.id))
      .limit(1);

    if (!client) throw notFound("Client");
    return { client };
  });

  // PATCH /api/clients/:id
  app.patch<{ Params: { id: string } }>("/api/clients/:id", {
    preHandler: [adminOnly],
  }, async (request) => {
    requireUUID(request.params.id);
    const body = updateTenantSchema.parse(request.body);

    if (Object.keys(body).length === 0) {
      throw badRequest("EMPTY_UPDATE", "No fields to update");
    }

    // SECURITY FIX (BLACKFYRE audit 2026-06-05): cross-tenant mutation over owner pool, now reachable only
    // by a verified platform admin (platformAdminOnly guard). Log the privileged modification.
    request.log.info(
      { userId: request.userId, targetTenantId: request.params.id, fields: Object.keys(body) },
      "clients: platform admin updating tenant",
    );
    const [updated] = await app.superDb
      .update(tenants)
      .set(body)
      .where(eq(tenants.id, request.params.id))
      .returning();

    if (!updated) throw notFound("Client");
    return { client: updated };
  });

  // DELETE /api/clients/:id (soft: sets status to suspended)
  app.delete<{ Params: { id: string } }>("/api/clients/:id", {
    preHandler: [adminOnly],
  }, async (request) => {
    requireUUID(request.params.id);
    // SECURITY FIX (BLACKFYRE audit 2026-06-05): cross-tenant suspend over owner pool, now reachable only
    // by a verified platform admin (platformAdminOnly guard). Log the privileged suspension.
    request.log.info(
      { userId: request.userId, targetTenantId: request.params.id },
      "clients: platform admin suspending tenant",
    );
    const [updated] = await app.superDb
      .update(tenants)
      .set({ onboardingStatus: "suspended" })
      .where(eq(tenants.id, request.params.id))
      .returning();

    if (!updated) throw notFound("Client");
    return { client: updated, message: "Client suspended. Data wipe scheduled." };
  });

  // POST /api/clients/:id/onboard
  app.post<{ Params: { id: string } }>("/api/clients/:id/onboard", {
    preHandler: [adminOnly],
  }, async (request) => {
    requireUUID(request.params.id);
    // SECURITY FIX (BLACKFYRE audit 2026-06-05): cross-tenant onboard over owner pool, now reachable only
    // by a verified platform admin (platformAdminOnly guard). Log the privileged onboarding action.
    request.log.info(
      { userId: request.userId, targetTenantId: request.params.id },
      "clients: platform admin onboarding tenant",
    );
    const [client] = await app.superDb
      .select()
      .from(tenants)
      .where(eq(tenants.id, request.params.id))
      .limit(1);

    if (!client) throw notFound("Client");

    if (client.onboardingStatus !== "pending") {
      throw badRequest("INVALID_STATE", `Cannot onboard client in "${client.onboardingStatus}" state`);
    }

    const [updated] = await app.superDb
      .update(tenants)
      .set({ onboardingStatus: "configuring" })
      .where(eq(tenants.id, request.params.id))
      .returning();

    return { client: updated, message: "Onboarding started. Add integrations next." };
  });

  // POST /api/onboarding — Self-service onboarding from portal wizard
  app.post("/api/onboarding", {
    preHandler: [authenticated],
  }, async (request) => {
    const body = request.body as {
      companyName?: string;
      industry?: string;
      infrastructure?: Record<string, unknown>;
      scanConfig?: Record<string, unknown>;
    };

    // SECURITY FIX (BLACKFYRE audit 2026-06-05): tenant-scoped self-service write — this portal route
    // (unlike the platform-operator /api/clients routes above) must only touch the CALLER's own tenant.
    // Run it on the RLS-enforced handle (request.db, SET ROLE app_user + bound app.current_tenant) and keep
    // the explicit tenantId filter as defense-in-depth so a caller can never mutate another tenant.
    await request.db!
      .update(tenants)
      .set({ onboardingStatus: "configuring" })
      .where(eq(tenants.id, request.tenantId));

    return { success: true, message: "Onboarding submitted. Configure integrations to begin scanning." };
  });
};
