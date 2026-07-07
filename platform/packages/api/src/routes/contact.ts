import type { FastifyPluginAsync } from "fastify";
import { and, desc, eq, sql } from "drizzle-orm";
import {
  contactSubmissionInputSchema,
  updateContactSubmissionSchema,
  leadNotificationRecipientInputSchema,
  updateLeadNotificationRecipientSchema,
  contactSubmissionStatusValues,
} from "@blackfyre/shared";
import { z } from "zod";
import {
  contactSubmissions,
  leadNotificationRecipients,
  users,
} from "../db/schema.js";
import { EmailChannel } from "../services/channels/email-channel.js";
import { ApiError } from "../utils/errors.js";

// In-memory IP rate limiter — 5 submissions per IP per hour. The Fastify
// global rate-limit plugin covers brute-force; this is a separate budget
// scoped specifically to the public contact endpoint so a legitimate spike
// elsewhere can't open the door for spam here.
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const RATE_LIMIT_MAX = 5;
const submissionsByIp = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const cutoff = now - RATE_LIMIT_WINDOW_MS;
  const hits = (submissionsByIp.get(ip) ?? []).filter((t) => t > cutoff);
  if (hits.length >= RATE_LIMIT_MAX) {
    submissionsByIp.set(ip, hits);
    return true;
  }
  hits.push(now);
  submissionsByIp.set(ip, hits);
  return false;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

interface LeadEmailPayload {
  id: string;
  name: string;
  email: string;
  company: string | null;
  preferredDate: string | null;
  preferredTime: string | null;
  topic: string | null;
  message: string | null;
  source: string;
  createdAt: Date;
}

function buildLeadEmail(p: LeadEmailPayload, adminUrl: string): { subject: string; html: string } {
  const company = p.company ? ` (${p.company})` : "";
  const subject = `New lead — ${p.name}${company}`;

  const rows = [
    ["Name", p.name],
    ["Email", `<a href="mailto:${escapeHtml(p.email)}">${escapeHtml(p.email)}</a>`],
    p.company ? ["Company", escapeHtml(p.company)] : null,
    p.topic ? ["Topic", escapeHtml(p.topic)] : null,
    p.preferredDate ? ["Date", escapeHtml(p.preferredDate)] : null,
    p.preferredTime ? ["Time", escapeHtml(p.preferredTime)] : null,
    p.message ? ["Message", escapeHtml(p.message).replace(/\n/g, "<br>")] : null,
  ].filter(Boolean) as [string, string][];

  const tableRows = rows
    .map(([k, v]) => `<tr><td style="padding:6px 12px 6px 0;vertical-align:top;color:#555"><b>${k}</b></td><td style="padding:6px 0">${v}</td></tr>`)
    .join("");

  const html = `<!DOCTYPE html><html><body style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:#222;padding:24px;max-width:600px">
  <h2 style="margin:0 0 8px">New lead — ${escapeHtml(p.name)}${p.company ? ` <span style="color:#888;font-weight:normal">(${escapeHtml(p.company)})</span>` : ""}</h2>
  <p style="color:#555;margin:0 0 16px">New contact form submission from the marketing website.</p>
  <table cellpadding="0" cellspacing="0" style="border-collapse:collapse">${tableRows}</table>
  <p style="margin-top:24px;color:#888;font-size:12px">
    Submission ID: <code>${escapeHtml(p.id)}</code> · Source: ${escapeHtml(p.source)} · ${p.createdAt.toISOString()}<br>
    <a href="${escapeHtml(adminUrl)}/contact-submissions">View in admin →</a>
  </p>
</body></html>`;

  return { subject, html };
}

const adminOnlyFactory = (app: any) => async (request: any, reply: any) => {
  await app.authenticate(request);
  const userId: string | undefined = request.userId;
  if (!userId) {
    return reply.status(401).send({ error: "Unauthorized" });
  }
  const [user] = await app.superDb
    .select({ isPlatformAdmin: users.isPlatformAdmin })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user || user.isPlatformAdmin !== true) {
    return reply.status(403).send({ error: "Forbidden — platform admin required" });
  }
};

export const contactRoutes: FastifyPluginAsync = async (app) => {
  const adminOnly = adminOnlyFactory(app);
  const db = app.superDb;

  // ---------------------------------------------------------------------
  // PUBLIC: POST /api/v1/contact — submit a lead
  // ---------------------------------------------------------------------
  app.post("/api/v1/contact", async (request, reply) => {
    const ip = request.ip ?? "unknown";

    if (isRateLimited(ip)) {
      return reply.status(429).send({
        success: false,
        error: { code: "RATE_LIMITED", message: "Too many submissions from this address. Try again later." },
      });
    }

    const parsed = contactSubmissionInputSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: parsed.error.issues[0]?.message ?? "Invalid submission",
          details: parsed.error.flatten().fieldErrors,
        },
      });
    }

    const input = parsed.data;
    const isSpam = Boolean(input.website && input.website.length > 0);

    const [row] = await db
      .insert(contactSubmissions)
      .values({
        name: input.name,
        email: input.email,
        company: input.company || null,
        preferredDate: input.preferredDate || null,
        preferredTime: input.preferredTime || null,
        topic: input.topic || null,
        message: input.message || null,
        source: input.source || "website-booking",
        ipAddress: ip.slice(0, 64),
        userAgent: (request.headers["user-agent"] ?? "").toString().slice(0, 4000) || null,
        status: isSpam ? "spam" : "new",
      })
      .returning({
        id: contactSubmissions.id,
        createdAt: contactSubmissions.createdAt,
      });

    if (isSpam || !row) {
      // Always return 202 so bots get no signal that they were caught.
      return reply.status(202).send({ success: true });
    }

    // Notify recipients (fire-and-forget; failures are logged but never
    // block the form's success response).
    void notifyLeadRecipients(app, {
      id: row.id,
      name: input.name,
      email: input.email,
      company: input.company || null,
      preferredDate: input.preferredDate || null,
      preferredTime: input.preferredTime || null,
      topic: input.topic || null,
      message: input.message || null,
      source: input.source || "website-booking",
      createdAt: row.createdAt,
    }).catch((err) => app.log.error({ msg: "Lead notification failed", submissionId: row.id, err }));

    return reply.status(202).send({ success: true });
  });

  // ---------------------------------------------------------------------
  // ADMIN: contact submissions list / detail / update
  // ---------------------------------------------------------------------
  const listQuerySchema = z.object({
    status: z.enum(contactSubmissionStatusValues).optional(),
    limit:  z.coerce.number().int().min(1).max(200).default(50),
    offset: z.coerce.number().int().min(0).default(0),
  });

  app.get("/api/admin/contact-submissions", { preHandler: [adminOnly] }, async (request) => {
    const query = listQuerySchema.parse(request.query);
    const conditions = query.status
      ? [eq(contactSubmissions.status, query.status)]
      : [];
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [rows, [{ total }]] = await Promise.all([
      db.select().from(contactSubmissions)
        .where(where)
        .orderBy(desc(contactSubmissions.createdAt))
        .limit(query.limit)
        .offset(query.offset),
      db.select({ total: sql<number>`count(*)::int` }).from(contactSubmissions).where(where),
    ]);

    return { success: true, data: { items: rows, total, limit: query.limit, offset: query.offset } };
  });

  app.get("/api/admin/contact-submissions/:id", { preHandler: [adminOnly] }, async (request, reply) => {
    const params = z.object({ id: z.string().uuid() }).parse(request.params);
    const [row] = await db
      .select()
      .from(contactSubmissions)
      .where(eq(contactSubmissions.id, params.id))
      .limit(1);
    if (!row) {
      return reply.status(404).send({ success: false, error: { code: "NOT_FOUND", message: "Submission not found" } });
    }
    return { success: true, data: row };
  });

  app.patch("/api/admin/contact-submissions/:id", { preHandler: [adminOnly] }, async (request, reply) => {
    const params = z.object({ id: z.string().uuid() }).parse(request.params);
    const patch = updateContactSubmissionSchema.parse(request.body ?? {});

    if (patch.status === undefined && patch.notes === undefined) {
      throw new ApiError(400, "VALIDATION_ERROR", "Provide status and/or notes to update.");
    }

    const [row] = await db
      .update(contactSubmissions)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(contactSubmissions.id, params.id))
      .returning();

    if (!row) {
      return reply.status(404).send({ success: false, error: { code: "NOT_FOUND", message: "Submission not found" } });
    }
    return { success: true, data: row };
  });

  // ---------------------------------------------------------------------
  // ADMIN: lead notification recipients CRUD
  // ---------------------------------------------------------------------
  app.get("/api/admin/lead-notification-recipients", { preHandler: [adminOnly] }, async () => {
    const rows = await db
      .select()
      .from(leadNotificationRecipients)
      .orderBy(desc(leadNotificationRecipients.createdAt));
    return { success: true, data: rows };
  });

  app.post("/api/admin/lead-notification-recipients", { preHandler: [adminOnly] }, async (request, reply) => {
    const input = leadNotificationRecipientInputSchema.parse(request.body ?? {});
    try {
      const [row] = await db
        .insert(leadNotificationRecipients)
        .values({
          email: input.email,
          name: input.name || null,
          isActive: input.isActive ?? true,
        })
        .returning();
      return reply.status(201).send({ success: true, data: row });
    } catch (err: any) {
      // unique violation on email
      if (err?.code === "23505") {
        return reply.status(409).send({ success: false, error: { code: "DUPLICATE", message: "This email is already a recipient." } });
      }
      throw err;
    }
  });

  app.patch("/api/admin/lead-notification-recipients/:id", { preHandler: [adminOnly] }, async (request, reply) => {
    const params = z.object({ id: z.string().uuid() }).parse(request.params);
    const patch = updateLeadNotificationRecipientSchema.parse(request.body ?? {});

    if (patch.name === undefined && patch.isActive === undefined) {
      throw new ApiError(400, "VALIDATION_ERROR", "Provide name and/or isActive to update.");
    }

    const [row] = await db
      .update(leadNotificationRecipients)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(leadNotificationRecipients.id, params.id))
      .returning();

    if (!row) {
      return reply.status(404).send({ success: false, error: { code: "NOT_FOUND", message: "Recipient not found" } });
    }
    return { success: true, data: row };
  });

  app.delete("/api/admin/lead-notification-recipients/:id", { preHandler: [adminOnly] }, async (request, reply) => {
    const params = z.object({ id: z.string().uuid() }).parse(request.params);
    const result = await db
      .delete(leadNotificationRecipients)
      .where(eq(leadNotificationRecipients.id, params.id))
      .returning({ id: leadNotificationRecipients.id });
    if (result.length === 0) {
      return reply.status(404).send({ success: false, error: { code: "NOT_FOUND", message: "Recipient not found" } });
    }
    return reply.status(204).send();
  });
};

// ---------------------------------------------------------------------
// Helper: send notification email to all active recipients
// ---------------------------------------------------------------------
async function notifyLeadRecipients(app: any, payload: LeadEmailPayload): Promise<void> {
  const db = app.superDb;
  const config = app.config;

  const recipients = await db
    .select({ email: leadNotificationRecipients.email })
    .from(leadNotificationRecipients)
    .where(eq(leadNotificationRecipients.isActive, true));

  if (recipients.length === 0) {
    app.log.warn({ msg: "No active lead notification recipients — skipping email", submissionId: payload.id });
    return;
  }

  const adminUrl = process.env.ADMIN_URL ?? "https://admin.blackfyre.tech";
  const { subject, html } = buildLeadEmail(payload, adminUrl);

  const channel = new EmailChannel({
    host: config.SMTP_HOST,
    port: config.SMTP_PORT,
    user: config.SMTP_USER,
    pass: config.SMTP_PASS,
    from: config.SMTP_FROM,
  });

  await Promise.all(
    recipients.map((r: { email: string }) => channel.sendEmail(r.email, subject, html)),
  );
}
