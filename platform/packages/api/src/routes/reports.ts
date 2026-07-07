import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import { eq, and, sql } from "drizzle-orm";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Queue, Worker, type Job } from "bullmq";
import { reports } from "../db/schema.js";
import { createReportSchema } from "@blackfyre/shared";
import type {
  ReadinessReport,
  GapAnalysisReport,
  BoardSummaryReport,
  EvidencePackageReport,
} from "@blackfyre/shared";
import { notFound, badRequest } from "../utils/errors.js";
import { requireUUID } from "../utils/security-fixes.js";
import { ReportGeneratorService } from "../services/report-generator.js";
import { ComplianceService } from "../services/compliance-service.js";
import { PdfRenderer } from "../services/pdf-renderer.js";
import { getRedisConnection } from "../queue/connection.js";
import type { Db } from "../db/connection.js";

// REAL IMPL (BLACKFYRE 2026-06): the in-memory `pdfStore` Map is gone. Generated
// report PDFs were kept in a per-process Map keyed by report id, so they were
// lost on every restart / Lambda cold start and were invisible to any other
// instance — a download served by a peer node 404'd. PDFs are now uploaded to the
// evidence S3 bucket (the same bucket evidence artifacts use) and downloads are
// served via a short-lived presigned URL or, for legacy direct-stream callers, by
// streaming the object bytes back. See reportS3() / generateAndStoreReport()
// below.

// ---------------------------------------------------------------------------
// REAL IMPL (BLACKFYRE 2026-06): durable PDF storage on S3.
//
// Mirrors services/evidence-s3.ts + evidence-bundle.ts (the platform's existing
// S3 access pattern): one S3Client, PutObjectCommand for upload, GetObjectCommand
// + s3-request-presigner for a short-lived download URL. Object key is namespaced
// by tenant so RLS-style isolation is preserved at the storage layer too.
// ---------------------------------------------------------------------------

const PRESIGN_EXPIRY_SECONDS = 900; // 15 minutes — minimal exposure window.

interface ReportS3 {
  bucket: string;
  client: S3Client;
}

let reportS3Singleton: ReportS3 | null | undefined;

/**
 * Resolve the report S3 client (evidence bucket). Returns null when no bucket is
 * configured (local dev without S3) so callers can fall back to on-demand
 * re-generation rather than crashing. Memoized per process.
 */
function reportS3(app: FastifyInstance): ReportS3 | null {
  if (reportS3Singleton !== undefined) return reportS3Singleton;
  const bucket = app.config.EVIDENCE_BUCKET;
  if (!bucket) {
    app.log.warn(
      { event: "reports.s3.disabled" },
      "EVIDENCE_BUCKET not configured — report PDFs will be re-generated on download instead of stored in S3",
    );
    reportS3Singleton = null;
    return null;
  }
  reportS3Singleton = {
    bucket,
    client: new S3Client({ region: app.config.AWS_REGION }),
  };
  return reportS3Singleton;
}

/** S3 object key for a report PDF. Tenant-namespaced for storage-layer isolation. */
function reportPdfKey(tenantId: string, reportId: string): string {
  return `reports/${tenantId}/${reportId}.pdf`;
}

/**
 * Parse `reports.storage_path`. It holds EITHER the new envelope
 * `{ s3Key, content }` (PDF uploaded to S3) OR the legacy bare `content` JSON
 * (PDF only ever lived in the old in-memory Map). Returns both pieces so callers
 * can presign the stored object when available and otherwise re-render on demand.
 */
function parseStoredReport(storagePath: string): { s3Key: string | null; content: unknown } {
  const parsed = JSON.parse(storagePath);
  if (parsed && typeof parsed === "object" && typeof (parsed as { s3Key?: unknown }).s3Key === "string") {
    return { s3Key: (parsed as { s3Key: string }).s3Key, content: (parsed as { content: unknown }).content };
  }
  return { s3Key: null, content: parsed };
}

/** Render a report's PDF from its structured content (download/re-render fallback). */
async function renderReportPdf(type: string, content: unknown): Promise<Buffer> {
  const renderer = new PdfRenderer();
  switch (type) {
    case "readiness":
      return renderer.renderReadinessReport(content as ReadinessReport);
    case "gap_analysis":
      return renderer.renderGapAnalysis(content as GapAnalysisReport);
    case "board_summary":
      return renderer.renderBoardSummary(content as BoardSummaryReport);
    case "evidence_package":
      return renderer.renderEvidencePackage(content as EvidencePackageReport);
    default:
      throw badRequest("UNKNOWN_TYPE", `Unknown report type: ${type}`);
  }
}

/** Upload a generated report PDF to S3. */
async function uploadReportPdf(
  s3: ReportS3,
  tenantId: string,
  reportId: string,
  pdf: Buffer,
): Promise<string> {
  const key = reportPdfKey(tenantId, reportId);
  await s3.client.send(
    new PutObjectCommand({
      Bucket: s3.bucket,
      Key: key,
      Body: pdf,
      ContentType: "application/pdf",
    }),
  );
  return key;
}

/** Presigned GET URL for a stored report PDF (15-minute expiry). */
async function presignReportPdf(s3: ReportS3, key: string): Promise<string> {
  return getSignedUrl(
    s3.client,
    new GetObjectCommand({ Bucket: s3.bucket, Key: key }),
    { expiresIn: PRESIGN_EXPIRY_SECONDS },
  );
}

// ---------------------------------------------------------------------------
// REAL IMPL (BLACKFYRE 2026-06): shared report-generation pipeline.
//
// Used by BOTH the synchronous POST /api/reports/:id/generate handler and the
// scheduled BullMQ worker so there is exactly one place that knows how to turn a
// (type, framework) into content + a rendered PDF. Renders the PDF, uploads it to
// S3 (when configured), and returns the structured content for persistence and
// the raw PDF buffer for callers that want to stream it immediately.
// ---------------------------------------------------------------------------

type ReportType = "readiness" | "gap_analysis" | "board_summary" | "evidence_package";

interface GeneratedReport {
  content: unknown;
  pdf: Buffer;
}

/**
 * Generate the structured content + rendered PDF for a report. `db` must already
 * have the tenant's RLS context bound (request.db, or a worker connection that has
 * SET app.current_tenant). Throws ApiError for caller-fixable validation problems.
 */
async function generateReportArtifacts(
  db: Db,
  tenantId: string,
  type: ReportType,
  framework: string | null,
): Promise<GeneratedReport> {
  const generator = new ReportGeneratorService(db);
  const renderer = new PdfRenderer();

  switch (type) {
    case "readiness": {
      if (!framework) throw badRequest("MISSING_FRAMEWORK", "Readiness report requires a framework");
      const readiness = await generator.generateReadiness(tenantId, framework);
      return { content: readiness, pdf: await renderer.renderReadinessReport(readiness) };
    }
    case "gap_analysis": {
      if (!framework) throw badRequest("MISSING_FRAMEWORK", "Gap analysis report requires a framework");
      const gap = await generator.generateGapAnalysis(tenantId, framework);
      return { content: gap, pdf: await renderer.renderGapAnalysis(gap) };
    }
    case "board_summary": {
      const board = await generator.generateBoardSummary(tenantId);
      return { content: board, pdf: await renderer.renderBoardSummary(board) };
    }
    case "evidence_package": {
      if (!framework) throw badRequest("MISSING_FRAMEWORK", "Evidence package requires a framework");
      const pkg = await generator.generateEvidencePackage(tenantId, framework);
      return { content: pkg, pdf: await renderer.renderEvidencePackage(pkg) };
    }
    default:
      throw badRequest("UNKNOWN_TYPE", `Unknown report type: ${type as string}`);
  }
}

// ---------------------------------------------------------------------------
// REAL IMPL (BLACKFYRE 2026-06): recurring schedule cadence helpers.
// ---------------------------------------------------------------------------

const VALID_CADENCES = ["daily", "weekly", "monthly"] as const;
type Cadence = (typeof VALID_CADENCES)[number];

const VALID_REPORT_TYPES: readonly ReportType[] = [
  "readiness",
  "gap_analysis",
  "board_summary",
  "evidence_package",
];

const VALID_FORMATS = ["pdf"] as const;

// REAL IMPL (BLACKFYRE 2026-06): certification readiness (GAP-005) accepts a
// framework path param; validate it against the framework enum (same set the
// control registry + compliance schemas use) before doing any tenant work so a
// bogus framework is a clean 400, not a 500 from a missing registry.
const VALID_FRAMEWORKS = [
  "soc2", "iso27001", "hipaa", "gdpr", "pcidss", "dpdpa", "iso42001", "pdppl", "nist80053",
] as const;

/**
 * BullMQ repeat rule for a cadence. Uses `every` (ms) so we do not depend on a
 * cron parser; deterministic and timezone-safe for daily/weekly/monthly intervals.
 */
function repeatEveryMs(cadence: Cadence): number {
  switch (cadence) {
    case "daily":
      return 24 * 60 * 60 * 1000;
    case "weekly":
      return 7 * 24 * 60 * 60 * 1000;
    case "monthly":
      return 30 * 24 * 60 * 60 * 1000;
  }
}

/** Next run time from now for a cadence — persisted as report_schedules.next_run_at. */
function nextRunAt(cadence: Cadence, from: Date = new Date()): Date {
  return new Date(from.getTime() + repeatEveryMs(cadence));
}

// ---------------------------------------------------------------------------
// REAL IMPL (BLACKFYRE 2026-06): scheduled-report BullMQ queue + worker.
//
// POST /api/reports/schedule used to return a hardcoded 201 and do nothing. It now
// persists a report_schedules row and registers a REPEATABLE BullMQ job. The
// worker below fires on cadence, sets the tenant's RLS context on its own DB
// connection, generates the report, uploads the PDF to S3, and emails every
// recipient a presigned download link. Mirrors queue/scan-queue.ts +
// queue/scan-worker.ts (one Queue, one Worker, shared Redis connection).
//
// Singletons: a single Queue + Worker per process. The plugin can be registered
// once per app, but guard anyway so we never leak duplicate workers/connections.
// ---------------------------------------------------------------------------

const REPORT_QUEUE_NAME = "report-schedules";

interface ScheduledReportJobData {
  scheduleId: string;
  tenantId: string;
}

let reportQueueSingleton: Queue<ScheduledReportJobData> | null = null;
let reportWorkerSingleton: Worker<ScheduledReportJobData> | null = null;

function getReportQueue(app: FastifyInstance): Queue<ScheduledReportJobData> {
  if (reportQueueSingleton) return reportQueueSingleton;
  const connection = getRedisConnection(app.config);
  reportQueueSingleton = new Queue<ScheduledReportJobData>(REPORT_QUEUE_NAME, {
    connection,
    defaultJobOptions: {
      // A failed generation/email is retried with backoff; completed/failed runs
      // are pruned so the recurring job does not accumulate history unbounded.
      attempts: 3,
      backoff: { type: "exponential", delay: 60_000 },
      removeOnComplete: { age: 7 * 24 * 60 * 60, count: 200 },
      removeOnFail: { age: 30 * 24 * 60 * 60, count: 200 },
    },
  });
  return reportQueueSingleton;
}

/**
 * Process one scheduled-report fire: load the schedule under its tenant's RLS
 * context, generate + upload the report, email recipients a presigned link, and
 * advance next_run_at / last_run_at. Idempotent-ish: a disabled or deleted
 * schedule is a no-op.
 */
async function processScheduledReport(
  app: FastifyInstance,
  data: ScheduledReportJobData,
): Promise<void> {
  const { scheduleId, tenantId } = data;
  const log = app.log;

  // The worker runs on the owner pool (app.db). FORCE RLS applies to the owner
  // too, so bind app.current_tenant for THIS unit of work (is_local=true keeps it
  // scoped to the transaction) before touching tenant-scoped tables.
  await app.db.transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('app.current_tenant', ${tenantId}, true)`);

    const rows = await tx.execute(sql`
      SELECT id, report_type, framework, cadence, recipients, format, active
        FROM report_schedules
       WHERE id = ${scheduleId}::uuid AND tenant_id = ${tenantId}::uuid
       LIMIT 1
    `);

    const schedule = (rows as unknown as Array<{
      id: string;
      report_type: ReportType;
      framework: string | null;
      cadence: Cadence;
      recipients: string[];
      format: string;
      active: boolean;
    }>)[0];

    if (!schedule || !schedule.active) {
      log.info(
        { event: "reports.schedule.skipped", scheduleId, tenantId, reason: schedule ? "inactive" : "not_found" },
        "Scheduled report skipped",
      );
      return;
    }

    // Pre-create the report row (RLS-scoped) so the generated PDF + content are
    // durably linked to a downloadable record, exactly like an interactive report.
    const insertedRows = await tx.execute(sql`
      INSERT INTO reports (tenant_id, type, framework, status)
      VALUES (${tenantId}::uuid, ${schedule.report_type}, ${schedule.framework}, 'generating')
      RETURNING id
    `);
    const reportId = (insertedRows as unknown as Array<{ id: string }>)[0].id;

    try {
      // `tx` is a drizzle transaction handle; it exposes the same query surface
      // ReportGeneratorService uses (select/where/count) and inherits the RLS
      // tenant context bound above, so cast it to the Db shape the service expects.
      const { content, pdf } = await generateReportArtifacts(
        tx as unknown as Db,
        tenantId,
        schedule.report_type,
        schedule.framework,
      );

      const s3 = reportS3(app);
      let storagePath = JSON.stringify(content);
      let downloadUrl: string | null = null;
      if (s3) {
        const key = await uploadReportPdf(s3, tenantId, reportId, pdf);
        // Persist the S3 key alongside content so the download route can presign it.
        storagePath = JSON.stringify({ s3Key: key, content });
        downloadUrl = await presignReportPdf(s3, key);
      }

      await tx.execute(sql`
        UPDATE reports
           SET status = 'ready', storage_path = ${storagePath}
         WHERE id = ${reportId}::uuid AND tenant_id = ${tenantId}::uuid
      `);

      await tx.execute(sql`
        UPDATE report_schedules
           SET last_run_at = now(),
               next_run_at = ${nextRunAt(schedule.cadence).toISOString()}::timestamptz,
               updated_at = now()
         WHERE id = ${scheduleId}::uuid AND tenant_id = ${tenantId}::uuid
      `);

      await emailScheduledReport(app, schedule.recipients, schedule.report_type, schedule.framework, downloadUrl);

      log.info(
        {
          event: "reports.schedule.delivered",
          scheduleId,
          tenantId,
          reportId,
          reportType: schedule.report_type,
          cadence: schedule.cadence,
          // PII-safe: recipient COUNT only — never the addresses.
          recipientCount: schedule.recipients.length,
          stored: Boolean(s3),
        },
        "Scheduled report generated and dispatched",
      );
    } catch (err) {
      await tx.execute(sql`
        UPDATE reports SET status = 'failed'
         WHERE id = ${reportId}::uuid AND tenant_id = ${tenantId}::uuid
      `);
      log.error(
        {
          event: "reports.schedule.failed",
          scheduleId,
          tenantId,
          reportId,
          err: err instanceof Error ? err.message : String(err),
        },
        "Scheduled report generation failed",
      );
      throw err;
    }
  });
}

/** Email each recipient a presigned link (or a not-stored notice). Never throws. */
async function emailScheduledReport(
  app: FastifyInstance,
  recipients: string[],
  type: ReportType,
  framework: string | null,
  downloadUrl: string | null,
): Promise<void> {
  if (recipients.length === 0) return;
  const { EmailChannel } = await import("../services/channels/email-channel.js");
  const emailChannel = new EmailChannel({
    host: app.config.SMTP_HOST,
    port: app.config.SMTP_PORT,
    user: app.config.SMTP_USER,
    pass: app.config.SMTP_PASS,
    from: app.config.SMTP_FROM,
  });

  const label = framework ? `${type.replace(/_/g, " ")} (${framework.toUpperCase()})` : type.replace(/_/g, " ");
  const subject = `Blackfyre scheduled report: ${label}`;
  const body = downloadUrl
    ? `<p>Your scheduled <strong>${label}</strong> report is ready.</p>
<p><a href="${downloadUrl}">Download the report (link valid for 15 minutes)</a></p>
<p>This is an automated message from Blackfyre.</p>`
    : `<p>Your scheduled <strong>${label}</strong> report has been generated.</p>
<p>Sign in to Blackfyre to download it.</p>`;

  for (const to of recipients) {
    // EmailChannel.sendEmail fails closed (logs, never throws), so one bad address
    // cannot abort the rest of the recipient fan-out.
    await emailChannel.sendEmail(to, subject, body);
  }
}

/**
 * Start the scheduled-report worker once per process. Idempotent. The worker is
 * lazily started on first plugin registration so a process that never registers
 * the reports plugin (e.g. a pure migration runner) does not open a Redis worker.
 */
function ensureReportWorker(app: FastifyInstance): void {
  if (reportWorkerSingleton) return;
  const connection = getRedisConnection(app.config);
  reportWorkerSingleton = new Worker<ScheduledReportJobData>(
    REPORT_QUEUE_NAME,
    async (job: Job<ScheduledReportJobData>) => {
      await processScheduledReport(app, job.data);
    },
    { connection, concurrency: 3 },
  );

  reportWorkerSingleton.on("failed", (job, error) => {
    app.log.error(
      { event: "reports.worker.failed", jobId: job?.id, scheduleId: job?.data?.scheduleId, err: error.message },
      "Scheduled report job failed",
    );
  });
  reportWorkerSingleton.on("error", (error) => {
    app.log.error({ event: "reports.worker.error", err: error.message }, "Report worker error");
  });
}

export const reportRoutes: FastifyPluginAsync = async (app) => {
  const authenticated = (app as any).requireRole("owner", "admin", "engineer", "viewer");
  const canCreate = (app as any).requireRole("owner", "admin", "engineer");
  const canGenerate = (app as any).requireRole("owner", "admin", "engineer");

  // GET /api/reports
  app.get("/api/reports", { preHandler: [authenticated] }, async (request) => {
    const rows = await app.db
      .select()
      .from(reports)
      .where(eq(reports.tenantId, request.tenantId))
      .orderBy(reports.generatedAt)
      .limit(1000);

    return { reports: rows };
  });

  // POST /api/reports
  app.post("/api/reports", { preHandler: [canCreate] }, async (request, reply) => {
    const body = createReportSchema.parse(request.body);
    const tenantId = request.tenantId;

    const [created] = await app.db
      .insert(reports)
      .values({
        tenantId,
        type: body.type,
        framework: body.framework ?? null,
        status: "generating",
      })
      .returning();

    return reply.status(201).send({ report: created });
  });

  // GET /api/reports/readiness/:framework — certification go/no-go checklist (GAP-005).
  // REAL IMPL (BLACKFYRE 2026-06): returns a structured { isReady, blockers, warnings }
  // verdict computed from the tenant's REAL latest compliance score for the framework
  // plus its open critical findings (see ComplianceService.getCertificationReadiness) —
  // nothing hardcoded. Runs on the RLS-bound request.db (tenant-scoped) and persists the
  // verdict into certification_readiness_assessments (migration 042) via parameterized
  // SQL so go/no-go history is durable and queryable. Distinct deeper path than
  // /api/reports/:id, so there is no route collision.
  app.get<{ Params: { framework: string } }>("/api/reports/readiness/:framework", {
    preHandler: [authenticated],
  }, async (request) => {
    const framework = request.params.framework;
    if (!(VALID_FRAMEWORKS as readonly string[]).includes(framework)) {
      throw badRequest("INVALID_FRAMEWORK", `Unsupported framework: ${framework}`);
    }

    const db = request.db ?? app.db;
    const service = new ComplianceService(db);
    const readiness = await service.getCertificationReadiness(request.tenantId, framework);

    // Persist the computed verdict for an auditable go/no-go history. Parameterized
    // SQL on the RLS-bound handle (no db/schema.ts edit); the `details` snapshot is
    // bound as a single jsonb parameter (no string concatenation). A persistence
    // failure must not fail the read, so it is logged and swallowed — the response
    // shape is unchanged either way.
    try {
      await db.execute(sql`
        INSERT INTO certification_readiness_assessments (
          tenant_id, framework, is_ready, score, blocker_count, warning_count,
          open_critical, details, computed_by
        )
        VALUES (
          ${request.tenantId}::uuid,
          ${framework},
          ${readiness.isReady},
          ${readiness.score},
          ${readiness.blockers.length},
          ${readiness.warnings.length},
          ${readiness.openCriticalFindings},
          ${JSON.stringify({ blockers: readiness.blockers, warnings: readiness.warnings })}::jsonb,
          ${request.userId ?? null}
        )
      `);
    } catch (err) {
      request.log.warn(
        {
          event: "reports.readiness.persist_failed",
          tenantId: request.tenantId,
          framework,
          err: err instanceof Error ? err.message : String(err),
        },
        "Failed to persist certification readiness assessment (verdict still returned)",
      );
    }

    request.log.info(
      {
        event: "reports.readiness.computed",
        tenantId: request.tenantId,
        framework,
        isReady: readiness.isReady,
        score: readiness.score,
        blockerCount: readiness.blockers.length,
        warningCount: readiness.warnings.length,
        openCritical: readiness.openCriticalFindings,
      },
      "Computed certification readiness verdict",
    );

    return { readiness };
  });

  // GET /api/reports/:id
  app.get<{ Params: { id: string } }>("/api/reports/:id", {
    preHandler: [authenticated],
  }, async (request) => {
    requireUUID(request.params.id);
    // SECURITY FIX (BLACKFYRE audit 2026-06-05): Reports IDOR — prefer the
    // tenant-bound `request.db` (RLS-enforced) and keep the explicit tenantId
    // predicate as defense-in-depth so a cross-tenant id resolves to nothing.
    const [report] = await (request.db ?? app.db)
      .select()
      .from(reports)
      .where(and(eq(reports.id, request.params.id), eq(reports.tenantId, request.tenantId)))
      .limit(1);

    if (!report) throw notFound("Report");
    return { report };
  });

  // GET /api/reports/:id/download
  app.get<{ Params: { id: string } }>("/api/reports/:id/download", {
    preHandler: [authenticated],
  }, async (request, reply) => {
    requireUUID(request.params.id);
    // SECURITY FIX (BLACKFYRE audit 2026-06-05): Reports IDOR — fetch on the
    // tenant-bound `request.db` (RLS) plus an explicit tenantId predicate so a
    // PDF for another tenant can never be downloaded.
    const [report] = await (request.db ?? app.db)
      .select()
      .from(reports)
      .where(and(eq(reports.id, request.params.id), eq(reports.tenantId, request.tenantId)))
      .limit(1);

    if (!report) throw notFound("Report");

    if (report.status !== "ready" || !report.storagePath) {
      throw badRequest("NOT_READY", "Report is not ready for download yet");
    }

    const filename = `blackfyre-${report.type}-report-${report.id.slice(0, 8)}.pdf`;
    // REAL IMPL (BLACKFYRE 2026-06): serve from durable S3 storage instead of the
    // (deleted) in-memory pdfStore Map. If the PDF is in S3, stream its bytes back
    // (the access is already RLS-authorized above). If S3 is unconfigured or the
    // object predates S3 storage, re-render deterministically from the persisted
    // structured content — no PDF is ever lost.
    const { s3Key, content } = parseStoredReport(report.storagePath);
    const s3 = reportS3(app);

    if (s3 && s3Key) {
      const obj = await s3.client.send(
        new GetObjectCommand({ Bucket: s3.bucket, Key: s3Key }),
      );
      const bytes = await (obj.Body as { transformToByteArray(): Promise<Uint8Array> }).transformToByteArray();
      return reply
        .header("Content-Type", "application/pdf")
        .header("Content-Disposition", `attachment; filename="${filename}"`)
        .send(Buffer.from(bytes));
    }

    // Fallback: re-render from stored content (legacy rows / no S3 configured).
    const regenerated = await renderReportPdf(report.type, content);
    return reply
      .header("Content-Type", "application/pdf")
      .header("Content-Disposition", `attachment; filename="${filename}"`)
      .send(regenerated);
  });

  // GET /api/reports/:id/download-url — presigned S3 URL for the report PDF.
  // REAL IMPL (BLACKFYRE 2026-06): lets multi-instance / browser clients fetch the
  // PDF directly from S3 (offloads bytes from the API) when storage is configured.
  app.get<{ Params: { id: string } }>("/api/reports/:id/download-url", {
    preHandler: [authenticated],
  }, async (request) => {
    requireUUID(request.params.id);
    const [report] = await (request.db ?? app.db)
      .select()
      .from(reports)
      .where(and(eq(reports.id, request.params.id), eq(reports.tenantId, request.tenantId)))
      .limit(1);

    if (!report) throw notFound("Report");
    if (report.status !== "ready" || !report.storagePath) {
      throw badRequest("NOT_READY", "Report is not ready for download yet");
    }

    const { s3Key } = parseStoredReport(report.storagePath);
    const s3 = reportS3(app);
    if (!s3 || !s3Key) {
      throw badRequest("NO_PRESIGN", "Report is not available via a presigned URL; use the streaming download endpoint");
    }

    const url = await presignReportPdf(s3, s3Key);
    return { url, expiresIn: PRESIGN_EXPIRY_SECONDS };
  });

  // POST /api/reports/:id/generate — trigger report generation
  app.post<{ Params: { id: string } }>("/api/reports/:id/generate", {
    preHandler: [canGenerate],
  }, async (request) => {
    requireUUID(request.params.id);
    // SECURITY FIX (BLACKFYRE audit 2026-06-05): Reports IDOR (tamper) — this
    // by-id lookup previously had NO tenant predicate, letting any authenticated
    // tenant trigger (re)generation of another tenant's report. Scope the read to
    // the caller's tenant via RLS (`request.db`) AND an explicit tenantId
    // predicate; a cross-tenant id now returns 404 (not 403) to avoid an
    // existence oracle. Denial is logged below.
    const db = request.db ?? app.db;
    const [report] = await db
      .select()
      .from(reports)
      .where(and(eq(reports.id, request.params.id), eq(reports.tenantId, request.tenantId)))
      .limit(1);

    if (!report) {
      request.log.warn(
        {
          event: "reports.generate.denied",
          reason: "not_found_or_cross_tenant",
          reportId: request.params.id,
          tenantId: request.tenantId,
          userId: request.userId,
        },
        "Report generate denied: report not found in caller's tenant (returning 404)",
      );
      throw notFound("Report");
    }

    try {
      // REAL IMPL (BLACKFYRE 2026-06): shared generation pipeline (also used by the
      // scheduled worker). Renders the PDF, then uploads it to durable S3 storage
      // instead of stashing it in the old in-memory pdfStore Map. The S3 key is
      // persisted alongside the structured content so /download and /download-url
      // can serve it from any instance after a restart.
      const { content, pdf } = await generateReportArtifacts(
        db,
        report.tenantId,
        report.type as ReportType,
        report.framework,
      );

      const s3 = reportS3(app);
      let storagePath = JSON.stringify(content);
      if (s3) {
        const key = await uploadReportPdf(s3, report.tenantId, report.id, pdf);
        storagePath = JSON.stringify({ s3Key: key, content });
        request.log.info(
          { event: "reports.pdf.stored", reportId: report.id, tenantId: report.tenantId, s3Key: key },
          "Report PDF uploaded to S3",
        );
      }

      // SECURITY FIX (BLACKFYRE audit 2026-06-05): write back through the
      // tenant-bound handle with an explicit tenantId predicate so the update
      // can only ever touch the caller's own report.
      const [updated] = await db
        .update(reports)
        .set({
          status: "ready",
          storagePath,
        })
        .where(and(eq(reports.id, report.id), eq(reports.tenantId, request.tenantId)))
        .returning();

      return { report: updated };
    } catch (error) {
      // If the error is an ApiError, re-throw it (validation errors)
      if ((error as any).statusCode) throw error;

      // SECURITY FIX (BLACKFYRE audit 2026-06-05): failure write also scoped to
      // the caller's tenant (RLS handle + explicit tenantId predicate).
      await db
        .update(reports)
        .set({ status: "failed" })
        .where(and(eq(reports.id, report.id), eq(reports.tenantId, request.tenantId)));

      throw error;
    }
  });

  // GET /api/reports/:id/content — return generated report content
  app.get<{ Params: { id: string } }>("/api/reports/:id/content", {
    preHandler: [authenticated],
  }, async (request) => {
    requireUUID(request.params.id);
    // SECURITY FIX (BLACKFYRE audit 2026-06-05): Reports IDOR (disclosure) —
    // this by-id lookup previously had NO tenant predicate, leaking another
    // tenant's report content (which may embed findings/evidence/PII). Scope the
    // read to the caller's tenant via RLS (`request.db`) AND an explicit tenantId
    // predicate; a cross-tenant id now returns 404 (not 403) to avoid an
    // existence oracle. Denial is logged below.
    const [report] = await (request.db ?? app.db)
      .select()
      .from(reports)
      .where(and(eq(reports.id, request.params.id), eq(reports.tenantId, request.tenantId)))
      .limit(1);

    if (!report) {
      request.log.warn(
        {
          event: "reports.content.denied",
          reason: "not_found_or_cross_tenant",
          reportId: request.params.id,
          tenantId: request.tenantId,
          userId: request.userId,
        },
        "Report content access denied: report not found in caller's tenant (returning 404)",
      );
      throw notFound("Report");
    }

    if (!report.storagePath) {
      throw badRequest("NOT_READY", "Report content has not been generated yet");
    }

    // REAL IMPL (BLACKFYRE 2026-06): storage_path may now be an { s3Key, content }
    // envelope — unwrap to the structured content so the response shape is stable.
    const { content } = parseStoredReport(report.storagePath);
    return { report: { id: report.id, type: report.type, status: report.status }, content };
  });

  // GET /api/reports/share/:token — public access via share token (no auth)
  app.get<{ Params: { token: string } }>("/api/reports/share/:token", async (request) => {
    const [report] = await app.db
      .select()
      .from(reports)
      .where(eq(reports.shareToken, request.params.token))
      .limit(1);

    if (!report) throw notFound("Report");

    // Check expiration
    if (report.expiresAt && new Date() > report.expiresAt) {
      throw badRequest("EXPIRED", "This shared report link has expired");
    }

    if (!report.storagePath) {
      throw badRequest("NOT_READY", "Report content has not been generated yet");
    }

    const { content } = parseStoredReport(report.storagePath);
    return { report: { id: report.id, type: report.type, status: report.status }, content };
  });

  // POST /api/reports/schedule — create scheduled report (GAP-018)
  // REAL IMPL (BLACKFYRE 2026-06): no longer a hardcoded 201. Persists a
  // tenant-scoped, RLS-enforced report_schedules row (migration
  // 035_report_schedules.sql) via parameterized SQL and registers a REPEATABLE
  // BullMQ job (queue/worker defined above) that generates the report, uploads the
  // PDF to S3, and emails recipients a presigned link on the requested cadence.
  app.post("/api/reports/schedule", { preHandler: [canCreate] }, async (request, reply) => {
    const body = request.body as {
      type?: string;
      framework?: string;
      // Accept either `cadence` (preferred) or the legacy `schedule` alias.
      cadence?: string;
      schedule?: string;
      format?: string;
      // Accept a single `email`, an `email` list, or `recipients[]`.
      email?: string;
      recipients?: string[];
    };

    const type = body.type as ReportType | undefined;
    const cadence = (body.cadence ?? body.schedule) as Cadence | undefined;

    if (!type || !cadence) {
      throw badRequest("SCHEDULE_PARAMS_MISSING", "Scheduled report requires type and cadence");
    }
    if (!VALID_REPORT_TYPES.includes(type)) {
      throw badRequest("INVALID_TYPE", `Unsupported report type: ${type}`);
    }
    if (!VALID_CADENCES.includes(cadence)) {
      throw badRequest("INVALID_CADENCE", `Cadence must be one of: ${VALID_CADENCES.join(", ")}`);
    }

    const framework = body.framework ?? null;
    if ((type === "readiness" || type === "gap_analysis" || type === "evidence_package") && !framework) {
      throw badRequest("MISSING_FRAMEWORK", `${type} reports require a framework`);
    }

    const format = (body.format ?? "pdf") as (typeof VALID_FORMATS)[number];
    if (!VALID_FORMATS.includes(format)) {
      throw badRequest("INVALID_FORMAT", `Unsupported format: ${format}`);
    }

    // Normalize + validate recipient emails. recipients[] | email (single).
    const rawRecipients = Array.isArray(body.recipients)
      ? body.recipients
      : body.email
        ? [body.email]
        : [];
    const recipients = Array.from(
      new Set(rawRecipients.map((e) => String(e).trim().toLowerCase()).filter((e) => e.length > 0)),
    );
    const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    for (const r of recipients) {
      if (!EMAIL_RE.test(r)) {
        throw badRequest("INVALID_RECIPIENT", "One or more recipient email addresses are invalid");
      }
    }

    const tenantId = request.tenantId;
    const db = request.db ?? app.db;
    const next = nextRunAt(cadence);

    // REAL IMPL (BLACKFYRE 2026-06): persist via parameterized SQL on the
    // RLS-bound handle (no db/schema.ts edit). The recipients JS string array is
    // bound as a SINGLE parameter and cast to text[]; postgres-js serializes the
    // array safely (no string concatenation / injection). Recipient addresses are
    // PII and are NEVER logged below.
    const inserted = await db.execute(sql`
      INSERT INTO report_schedules (
        tenant_id, report_type, framework, cadence, recipients, format, next_run_at, created_by
      )
      VALUES (
        ${tenantId}::uuid,
        ${type},
        ${framework},
        ${cadence},
        ${recipients}::text[],
        ${format},
        ${next.toISOString()}::timestamptz,
        ${request.userId ?? null}
      )
      RETURNING id
    `);

    const scheduleId = (inserted as unknown as Array<{ id: string }>)[0]?.id;

    // Register the REPEATABLE BullMQ job that fires on cadence. The repeat `key`
    // is the stable BullMQ dedup mechanism: it is derived per schedule id, so
    // re-adding the same schedule (e.g. after a restart) is idempotent — BullMQ
    // collapses identical repeat keys instead of stacking duplicate recurrences.
    // It is also the handle used to remove the recurrence later (removeRepeatableByKey).
    const queue = getReportQueue(app);
    const repeatKey = `report-schedule:${scheduleId}`;
    await queue.add(
      "scheduled-report",
      { scheduleId, tenantId },
      {
        repeat: { every: repeatEveryMs(cadence), key: repeatKey },
      },
    );

    // Persist the BullMQ repeat key so the schedule can later be paused/removed.
    await db.execute(sql`
      UPDATE report_schedules SET bull_job_id = ${repeatKey}, updated_at = now()
       WHERE id = ${scheduleId}::uuid AND tenant_id = ${tenantId}::uuid
    `);

    // Ensure the worker is running in this process to service the recurrence.
    ensureReportWorker(app);

    request.log.info(
      {
        event: "reports.schedule.created",
        scheduleId,
        tenantId,
        reportType: type,
        framework,
        cadence,
        format,
        // PII-safe: recipient COUNT only — never the addresses.
        recipientCount: recipients.length,
        nextRunAt: next.toISOString(),
      },
      "Report schedule created and repeatable job registered",
    );

    // Response shape preserved (scheduled/type/framework/schedule/email/message)
    // with the durable schedule id added.
    return reply.status(201).send({
      scheduled: true,
      id: scheduleId,
      type,
      framework,
      schedule: cadence,
      cadence,
      format,
      recipients,
      email: recipients[0] ?? null,
      nextRunAt: next.toISOString(),
      message: "Report schedule created. Reports will be generated and emailed according to the schedule.",
    });
  });
};
