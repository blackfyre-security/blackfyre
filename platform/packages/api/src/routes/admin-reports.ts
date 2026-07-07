/**
 * Admin report-export routes.
 *
 * POST /api/admin/reports/export — adminOnly. Generates a tamper-evident
 *   (and optionally encrypted) PDF report for a tenant and returns it as
 *   a base64-encoded JSON payload along with the SHA-256 fingerprint and,
 *   if encrypted, the AES-256 password.
 *
 * GET  /api/verify/report/:sha256 — public, no auth. Confirms a PDF's
 *   authenticity by looking the fingerprint up in `report_exports`.
 */
import type { FastifyPluginAsync } from "fastify";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { reportExports, users } from "../db/schema.js";
import {
  ReportExportService,
  type ReportType,
} from "../services/report-export-service.js";

const reportTypeSchema = z.enum([
  "tenant-health",
  "compliance-overview",
  "findings-rollup",
]);

const exportRequestSchema = z.object({
  tenantId: z.string().uuid(),
  reportType: reportTypeSchema,
  dateRange: z
    .object({ from: z.string(), to: z.string() })
    .optional(),
  encrypt: z.boolean().optional(),
  recipientEmail: z.string().email().max(255).optional(),
});

export const adminReportRoutes: FastifyPluginAsync = async (app) => {
  // Mirrors the `adminOnly` preHandler used in admin.ts: requires a
  // platform-admin flag on the user.
  const adminOnly = async (request: any, reply: any) => {
    const userId: string | undefined = request.userId;
    if (!userId) {
      return reply.status(401).send({ error: "Unauthorized" });
    }
    const db = app.superDb;
    const [user] = await db
      .select({ isPlatformAdmin: users.isPlatformAdmin, email: users.email })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!user || user.isPlatformAdmin !== true) {
      return reply.status(403).send({ error: "Forbidden: platform admin access required" });
    }
    // Stash email on the request so we don't re-fetch in the handler.
    (request as any).adminEmail = user.email;
  };

  // POST /api/admin/reports/export
  app.post(
    "/api/admin/reports/export",
    { preHandler: [adminOnly] },
    async (request, reply) => {
      const body = exportRequestSchema.parse(request.body);
      const userId: string = (request as any).userId;
      const adminEmail: string = (request as any).adminEmail ?? "admin@blackfyre";

      // SECURITY FIX (BLACKFYRE audit 2026-06-05): pass app.log so the
      // service's signing/encryption security logs (UNSIGNED fallbacks,
      // signature-embed failures, out-of-band encryption) emit at the route
      // level instead of being silently swallowed.
      const service = new ReportExportService(app.superDb, app.log);

      try {
        const result = await service.generateReport(
          {
            tenantId: body.tenantId,
            reportType: body.reportType as ReportType,
            dateRange: body.dateRange,
            encrypt: body.encrypt,
            recipientEmail: body.recipientEmail,
          },
          {
            userId,
            userEmail: adminEmail,
            ipAddress: request.ip,
            userAgent: request.headers["user-agent"] as string | undefined,
          },
        );

        return reply.send({
          pdfBase64: result.pdfBuffer.toString("base64"),
          sha256: result.sha256,
          reportType: result.reportType,
          encrypted: result.encrypted,
          password: result.password,
          // SECURITY FIX (BLACKFYRE audit 2026-06-05): surface the honest
          // `signed` boolean in the API contract so consumers can distinguish a
          // genuinely PKCS#7-signed PDF from an UNSIGNED fingerprint-only export.
          signed: result.signed,
          signedBy: result.signedBy,
          warnings: result.warnings,
        });
      } catch (err) {
        app.log.error({ err }, "[admin-reports] export failed");
        return reply.status(500).send({
          error: "Report export failed",
          message: err instanceof Error ? err.message : "unknown",
        });
      }
    },
  );

  // GET /api/verify/report/:sha256 — public.
  app.get<{ Params: { sha256: string } }>(
    "/api/verify/report/:sha256",
    async (request, reply) => {
      const sha = request.params.sha256;
      if (!/^[a-f0-9]{64}$/i.test(sha)) {
        return reply.status(400).send({ valid: false, error: "Invalid SHA-256 format" });
      }

      const [row] = await app.superDb
        .select({
          generatedAt: reportExports.generatedAt,
          reportType: reportExports.reportType,
          signedBy: reportExports.signedBy,
        })
        .from(reportExports)
        .where(eq(reportExports.sha256, sha.toLowerCase()))
        .limit(1);

      if (!row) {
        return reply.send({ valid: false });
      }

      return reply.send({
        valid: true,
        generatedAt: row.generatedAt,
        reportType: row.reportType,
        signedBy: row.signedBy,
      });
    },
  );
};
