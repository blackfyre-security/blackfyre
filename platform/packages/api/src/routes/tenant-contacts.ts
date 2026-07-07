import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { tenantContacts, auditLogs } from "../db/schema.js";
import { notFound, badRequest } from "../utils/errors.js";
import { requireUUID } from "../utils/security-fixes.js";

const CONTACT_ROLES = [
  "primary_spoc",
  "billing",
  "security",
  "technical",
  "executive",
  "legal",
  "oncall_24x7",
] as const;

const createContactSchema = z.object({
  role: z.enum(CONTACT_ROLES),
  name: z.string().min(1).max(200),
  email: z.string().email().max(320),
  phone: z.string().max(50).optional(),
  timezone: z.string().max(64).optional(),
  isPrimary: z.boolean().optional().default(false),
  notes: z.string().max(2000).optional(),
});

const updateContactSchema = createContactSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export const tenantContactRoutes: FastifyPluginAsync = async (app) => {
  const adminOrEngineer = (app as any).requireRole("owner", "admin", "engineer");
  const authenticated = (app as any).requireRole("owner", "admin", "engineer", "viewer");

  // GET /api/tenant-contacts — list all contacts for current tenant
  app.get("/api/tenant-contacts", { preHandler: [authenticated] }, async (request) => {
    const rows = await app.db
      .select()
      .from(tenantContacts)
      .where(eq(tenantContacts.tenantId, request.tenantId));
    return { contacts: rows, total: rows.length };
  });

  // POST /api/tenant-contacts — add a new SPOC/contact
  app.post("/api/tenant-contacts", { preHandler: [adminOrEngineer] }, async (request, reply) => {
    const body = createContactSchema.parse(request.body);

    // If marking as primary, demote any existing primary for the same role.
    if (body.isPrimary) {
      await app.db.update(tenantContacts)
        .set({ isPrimary: false, updatedAt: new Date() })
        .where(and(
          eq(tenantContacts.tenantId, request.tenantId),
          eq(tenantContacts.role, body.role),
          eq(tenantContacts.isPrimary, true),
        ));
    }

    const [created] = await app.db.insert(tenantContacts).values({
      tenantId: request.tenantId,
      role: body.role,
      name: body.name,
      email: body.email,
      phone: body.phone,
      timezone: body.timezone,
      isPrimary: body.isPrimary ?? false,
      notes: body.notes,
    }).returning();

    await app.db.insert(auditLogs).values({
      tenantId: request.tenantId,
      actorType: "user",
      actorId: (request as any).user?.id ?? null,
      action: "tenant_contact.created",
      resourceType: "tenant_contact",
      resourceId: created.id,
      details: { role: body.role, email: body.email, isPrimary: body.isPrimary },
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"] ?? null,
    });

    return reply.status(201).send({ contact: created });
  });

  // PATCH /api/tenant-contacts/:id — update contact
  app.patch<{ Params: { id: string } }>("/api/tenant-contacts/:id", {
    preHandler: [adminOrEngineer],
  }, async (request, reply) => {
    requireUUID(request.params.id);
    const body = updateContactSchema.parse(request.body);

    const [existing] = await app.db
      .select()
      .from(tenantContacts)
      .where(and(
        eq(tenantContacts.id, request.params.id),
        eq(tenantContacts.tenantId, request.tenantId),
      ))
      .limit(1);

    if (!existing) throw notFound("Contact");

    if (body.isPrimary === true) {
      await app.db.update(tenantContacts)
        .set({ isPrimary: false, updatedAt: new Date() })
        .where(and(
          eq(tenantContacts.tenantId, request.tenantId),
          eq(tenantContacts.role, body.role ?? existing.role),
          eq(tenantContacts.isPrimary, true),
        ));
    }

    const [updated] = await app.db.update(tenantContacts)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(tenantContacts.id, existing.id))
      .returning();

    return reply.send({ contact: updated });
  });

  // DELETE /api/tenant-contacts/:id — soft-delete (set isActive=false)
  app.delete<{ Params: { id: string } }>("/api/tenant-contacts/:id", {
    preHandler: [adminOrEngineer],
  }, async (request, reply) => {
    requireUUID(request.params.id);

    const [existing] = await app.db
      .select()
      .from(tenantContacts)
      .where(and(
        eq(tenantContacts.id, request.params.id),
        eq(tenantContacts.tenantId, request.tenantId),
      ))
      .limit(1);

    if (!existing) throw notFound("Contact");

    if (existing.role === "primary_spoc" && existing.isPrimary) {
      throw badRequest(
        "primary_spoc_protected",
        "Cannot deactivate the primary SPOC. Promote another contact first.",
      );
    }

    await app.db.update(tenantContacts)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(tenantContacts.id, existing.id));

    return reply.status(204).send();
  });
};
