import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { eq, and, desc, sql } from "drizzle-orm";
import { tenants, tenantContacts, auditLogs } from "../db/schema.js";
import { badRequest } from "../utils/errors.js";

const REGIONS = [
  "us-east-1", "us-east-2", "us-west-2",
  "eu-west-1", "eu-west-2", "eu-central-1",
  "ap-south-1", "ap-southeast-1", "ap-southeast-2", "ap-northeast-1",
  "me-south-1", "sa-east-1",
] as const;

const contactInput = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email().max(320),
  phone: z.string().max(50).optional(),
  timezone: z.string().max(64).optional(),
});

const step1Schema = z.object({
  legalName: z.string().min(1).max(300),
  displayName: z.string().min(1).max(200),
  websiteUrl: z.string().url().optional(),
  region: z.enum(REGIONS),
  dataResidencyRegion: z.enum(REGIONS).optional(),
  primarySpoc: contactInput,
  billingContact: contactInput,
  securityContact: contactInput.optional(),
  tosAccepted: z.literal(true),
  tosVersion: z.string().max(20),
  dpaSigned: z.literal(true),
  dpaSignerName: z.string().min(1).max(200),
  dpaSignerEmail: z.string().email().max(320),
});

async function generateNextClientNumber(db: any): Promise<string> {
  const year = new Date().getUTCFullYear();
  const prefix = `BF-${year}-`;
  const [latest] = await db
    .select({ clientNumber: tenants.clientNumber })
    .from(tenants)
    .where(sql`${tenants.clientNumber} LIKE ${prefix + "%"}`)
    .orderBy(desc(tenants.clientNumber))
    .limit(1);

  let next = 1;
  if (latest?.clientNumber) {
    const m = latest.clientNumber.match(/-(\d+)$/);
    if (m) next = parseInt(m[1], 10) + 1;
  }
  return prefix + String(next).padStart(6, "0");
}

export const onboardingRoutes: FastifyPluginAsync = async (app) => {
  const adminOnly = (app as any).requireRole("owner", "admin");
  const authenticated = (app as any).requireRole("owner", "admin", "engineer", "viewer");

  // GET /api/onboarding/status — current onboarding state for the tenant
  app.get("/api/onboarding/status", { preHandler: [authenticated] }, async (request) => {
    const [tenant] = await app.db
      .select()
      .from(tenants)
      .where(eq(tenants.id, request.tenantId))
      .limit(1);

    if (!tenant) {
      return { step1Complete: false, onboardingStatus: "pending" };
    }

    const step1Complete = Boolean(
      tenant.clientNumber &&
      tenant.legalName &&
      tenant.tosAcceptedAt &&
      tenant.dpaSignedAt,
    );

    const primarySpoc = (await app.db
      .select()
      .from(tenantContacts)
      .where(and(
        eq(tenantContacts.tenantId, request.tenantId),
        eq(tenantContacts.role, "primary_spoc"),
        eq(tenantContacts.isPrimary, true),
        eq(tenantContacts.isActive, true),
      ))
      .limit(1))[0];

    return {
      tenant: {
        id: tenant.id,
        clientNumber: tenant.clientNumber,
        legalName: tenant.legalName,
        displayName: tenant.displayName,
        region: tenant.region,
        status: tenant.status,
        onboardingStatus: tenant.onboardingStatus,
        tosAcceptedAt: tenant.tosAcceptedAt,
        dpaSignedAt: tenant.dpaSignedAt,
      },
      primarySpoc: primarySpoc ?? null,
      step1Complete,
    };
  });

  // POST /api/onboarding/step-1 — capture client identity + SPOC + legal acceptance.
  // Idempotent: re-submitting updates fields, doesn't re-generate clientNumber.
  app.post("/api/onboarding/step-1", { preHandler: [adminOnly] }, async (request, reply) => {
    const body = step1Schema.parse(request.body);

    const [existing] = await app.db
      .select()
      .from(tenants)
      .where(eq(tenants.id, request.tenantId))
      .limit(1);

    if (!existing) {
      throw badRequest("tenant_not_found", "Tenant context not found");
    }

    const clientNumber = existing.clientNumber ?? await generateNextClientNumber(app.db);
    const now = new Date();

    const [updated] = await app.db.update(tenants)
      .set({
        clientNumber,
        legalName: body.legalName,
        displayName: body.displayName,
        websiteUrl: body.websiteUrl,
        region: body.region,
        dataResidencyRegion: body.dataResidencyRegion ?? body.region,
        tosAcceptedAt: now,
        tosVersion: body.tosVersion,
        dpaSignedAt: now,
        dpaSignerName: body.dpaSignerName,
        dpaSignerEmail: body.dpaSignerEmail,
        onboardingStatus: "configuring",
        status: existing.status === "trial" ? "trial" : existing.status,
        updatedAt: now,
      })
      .where(eq(tenants.id, request.tenantId))
      .returning();

    // Upsert primary SPOC.
    const [existingPrimary] = await app.db
      .select()
      .from(tenantContacts)
      .where(and(
        eq(tenantContacts.tenantId, request.tenantId),
        eq(tenantContacts.role, "primary_spoc"),
        eq(tenantContacts.isPrimary, true),
      ))
      .limit(1);

    if (existingPrimary) {
      await app.db.update(tenantContacts)
        .set({
          name: body.primarySpoc.name,
          email: body.primarySpoc.email,
          phone: body.primarySpoc.phone,
          timezone: body.primarySpoc.timezone,
          isActive: true,
          updatedAt: now,
        })
        .where(eq(tenantContacts.id, existingPrimary.id));
    } else {
      await app.db.insert(tenantContacts).values({
        tenantId: request.tenantId,
        role: "primary_spoc",
        name: body.primarySpoc.name,
        email: body.primarySpoc.email,
        phone: body.primarySpoc.phone,
        timezone: body.primarySpoc.timezone,
        isPrimary: true,
      });
    }

    // Upsert billing contact.
    const [existingBilling] = await app.db
      .select()
      .from(tenantContacts)
      .where(and(
        eq(tenantContacts.tenantId, request.tenantId),
        eq(tenantContacts.role, "billing"),
        eq(tenantContacts.isPrimary, true),
      ))
      .limit(1);

    if (existingBilling) {
      await app.db.update(tenantContacts)
        .set({
          name: body.billingContact.name,
          email: body.billingContact.email,
          phone: body.billingContact.phone,
          timezone: body.billingContact.timezone,
          isActive: true,
          updatedAt: now,
        })
        .where(eq(tenantContacts.id, existingBilling.id));
    } else {
      await app.db.insert(tenantContacts).values({
        tenantId: request.tenantId,
        role: "billing",
        name: body.billingContact.name,
        email: body.billingContact.email,
        phone: body.billingContact.phone,
        timezone: body.billingContact.timezone,
        isPrimary: true,
      });
    }

    // Security contact (optional).
    if (body.securityContact) {
      const [existingSec] = await app.db
        .select()
        .from(tenantContacts)
        .where(and(
          eq(tenantContacts.tenantId, request.tenantId),
          eq(tenantContacts.role, "security"),
          eq(tenantContacts.isPrimary, true),
        ))
        .limit(1);

      if (existingSec) {
        await app.db.update(tenantContacts)
          .set({
            name: body.securityContact.name,
            email: body.securityContact.email,
            phone: body.securityContact.phone,
            timezone: body.securityContact.timezone,
            isActive: true,
            updatedAt: now,
          })
          .where(eq(tenantContacts.id, existingSec.id));
      } else {
        await app.db.insert(tenantContacts).values({
          tenantId: request.tenantId,
          role: "security",
          name: body.securityContact.name,
          email: body.securityContact.email,
          phone: body.securityContact.phone,
          timezone: body.securityContact.timezone,
          isPrimary: true,
        });
      }
    }

    await app.db.insert(auditLogs).values({
      tenantId: request.tenantId,
      actorType: "user",
      actorId: (request as any).user?.id ?? null,
      action: "onboarding.step_1.completed",
      resourceType: "tenant",
      resourceId: request.tenantId,
      details: {
        clientNumber,
        legalName: body.legalName,
        region: body.region,
        tosVersion: body.tosVersion,
      },
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"] ?? null,
    });

    return reply.status(200).send({
      ok: true,
      tenant: {
        id: updated.id,
        clientNumber: updated.clientNumber,
        legalName: updated.legalName,
        displayName: updated.displayName,
        region: updated.region,
        onboardingStatus: updated.onboardingStatus,
      },
      nextStep: "/onboarding/step-2-aws-connect",
    });
  });
};
