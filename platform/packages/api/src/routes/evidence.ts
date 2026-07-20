import type { FastifyPluginAsync } from "fastify";
import { EvidenceService } from "../services/evidence-service.js";
import { EvidenceS3Service } from "../services/evidence-s3.js";
import { EvidenceBundleService } from "../services/evidence-bundle.js";
import { createEvidenceSchema, listEvidenceQuerySchema, listVaultQuerySchema } from "@blackfyre/shared";
import { notFound } from "../utils/errors.js";
import { requireUUID } from "../utils/security-fixes.js";
import { auditorScopePreHandler } from "../plugins/auditor-scope.js";
import type { EvidenceJobData } from "../workers/evidence-worker.js";
import { eq, and } from "drizzle-orm";
import { reports } from "../db/schema.js";

export const evidenceRoutes: FastifyPluginAsync = async (app) => {
  // Auditors can read evidence (scoped to their frameworks)
  const authenticated = (app as any).requireRole("owner", "admin", "engineer", "viewer", "auditor");
  const adminOrEngineer = (app as any).requireRole("owner", "admin", "engineer");

  // Instantiate S3 service (used for verify + download)
  const evidenceS3 = new EvidenceS3Service(
    app.config.EVIDENCE_BUCKET,
    app.config.AWS_REGION,
  );

  // GET /api/evidence/vault — tamper-evident vault listing (EVID-01)
  // Auditors MUST provide framework filter; other roles can optionally filter.
  app.get("/api/evidence/vault", {
    preHandler: [authenticated, auditorScopePreHandler("query")],
  }, async (request) => {
    const query = listVaultQuerySchema.parse(request.query);
    const service = new EvidenceService(request.db!);
    const { rows, total } = await service.listVault(request.tenantId, query);

    return {
      vault: rows.map((r) => ({
        id: r.id,
        findingId: r.findingId,
        type: r.type,
        framework: r.framework,
        sha256Hash: r.sha256Hash,
        collectedAt: r.collectedAt,
        collectedBy: r.collectedBy,
        hasS3Object: !!r.s3ObjectKey,
      })),
      pagination: {
        limit: query.limit,
        offset: query.offset,
        total,
      },
    };
  });

  // GET /api/evidence — existing listing (by finding, backward compatible)
  app.get("/api/evidence", { preHandler: [authenticated] }, async (request) => {
    const query = listEvidenceQuerySchema.parse(request.query);
    const service = new EvidenceService(request.db!);
    const { rows, total } = await service.listForFinding(
      request.tenantId,
      query,
    );

    return {
      evidence: rows,
      pagination: {
        limit: query.limit,
        offset: query.offset,
        total,
      },
    };
  });

  // POST /api/evidence — create evidence record + queue S3 upload (EVID-02)
  app.post("/api/evidence", { preHandler: [adminOrEngineer] }, async (request, reply) => {
    const body = createEvidenceSchema.parse(request.body);
    const service = new EvidenceService(app.db);

    // Create DB record first (pending state -- no S3 key yet)
    const created = await service.create(request.tenantId, body);

    // Queue the S3 upload job to evidence worker
    const jobData: EvidenceJobData = {
      evidenceId: created.id,
      tenantId: request.tenantId,
      findingId: body.findingId,
      framework: (request.body as any).framework ?? "",
      type: body.type,
      content: (request.body as any).content ?? "",
      collectedBy: body.collectedBy,
    };

    await app.evidenceQueue.add("evidence.upload", jobData);

    return reply.status(201).send({ evidence: created });
  });

  // GET /api/evidence/:id — single evidence item
  app.get<{ Params: { id: string } }>("/api/evidence/:id", {
    preHandler: [authenticated],
  }, async (request) => {
    requireUUID(request.params.id);
    const service = new EvidenceService(request.db!);
    const record = await service.getByIdForTenant(request.params.id, request.tenantId);
    return { evidence: record };
  });

  // GET /api/evidence/:id/verify — re-verify SHA-256 integrity (EVID-03)
  app.get<{ Params: { id: string } }>("/api/evidence/:id/verify", {
    preHandler: [authenticated],
  }, async (request) => {
    requireUUID(request.params.id);
    // SECURITY: RLS-bound handle + explicit tenant scoping (repo invariant — never
    // resolve tenant data through app.db).
    const service = new EvidenceService(request.db!);
    const result = await service.verifyIntegrity(request.params.id, request.tenantId, evidenceS3);

    return {
      evidenceId: request.params.id,
      integrity: result,
    };
  });

  // GET /api/evidence/:id/download — presigned S3 download URL (15-min expiry)
  app.get<{ Params: { id: string } }>("/api/evidence/:id/download", {
    preHandler: [authenticated],
  }, async (request) => {
    requireUUID(request.params.id);
    // SECURITY: was app.db + un-scoped getById — any authenticated user holding an
    // evidence UUID could mint a presigned URL to another tenant's evidence.
    const service = new EvidenceService(request.db!);
    const record = await service.getByIdForTenant(request.params.id, request.tenantId);

    if (!record.s3ObjectKey) {
      throw notFound("Evidence file not yet uploaded to S3");
    }

    const downloadUrl = await evidenceS3.generatePresignedDownloadUrl(record.s3ObjectKey);

    return {
      evidenceId: request.params.id,
      downloadUrl,
      expiresIn: 900, // 15 minutes
    };
  });

  // DELETE removed — WORM Object Lock prevents deletion.
  // Evidence records are immutable after upload (EVID-02).

  // Instantiate bundle service
  const bundleService = new EvidenceBundleService(
    app.config.EVIDENCE_BUCKET,
    app.config.AWS_REGION,
  );

  // POST /api/audit-bundles — trigger audit bundle generation (EVID-04)
  // Generates a zip with PDF cover + evidence artifacts, uploads to S3.
  app.post<{ Body: { framework: string } }>("/api/audit-bundles", {
    preHandler: [authenticated, auditorScopePreHandler("body")],
  }, async (request, reply) => {
    const framework = (request.body as any).framework;
    if (!framework) {
      return reply.status(400).send({ error: { code: "VALIDATION_ERROR", message: "framework is required" } });
    }

    const service = new EvidenceService(request.db!);

    // Fetch all evidence for this tenant+framework
    const { rows } = await service.listVault(request.tenantId, {
      framework,
      limit: 10000,  // fetch all for bundle
      offset: 0,
    });

    // Generate the bundle
    const result = await bundleService.generateAuditBundle(
      request.tenantId,
      framework,
      rows as any[],
    );

    // Record the bundle in reports table for tracking
    const [report] = await app.db
      .insert(reports)
      .values({
        tenantId: request.tenantId,
        type: "evidence_package" as any,
        framework,
        status: "ready" as any,
        storagePath: result.bundleS3Key,
      })
      .returning();

    return reply.status(201).send({
      bundle: {
        id: report.id,
        framework,
        evidenceCount: result.evidenceCount,
        downloadUrl: result.presignedUrl,
        expiresIn: 900,
      },
    });
  });

  // GET /api/audit-bundles/:id/download — get presigned download URL for existing bundle
  app.get<{ Params: { id: string } }>("/api/audit-bundles/:id/download", {
    preHandler: [authenticated],
  }, async (request) => {
    requireUUID(request.params.id);

    const [report] = await app.db
      .select()
      .from(reports)
      .where(
        and(
          eq(reports.id, request.params.id),
          eq(reports.tenantId, request.tenantId),
        ),
      )
      .limit(1);

    if (!report || !report.storagePath) {
      throw notFound("Audit bundle");
    }

    const downloadUrl = await evidenceS3.generatePresignedDownloadUrl(report.storagePath);

    return {
      bundleId: report.id,
      framework: report.framework,
      downloadUrl,
      expiresIn: 900,
    };
  });
};
