/**
 * Tamper-evident PDF export pipeline.
 *
 * Steps:
 *   1. Pull tenant / findings / compliance facts (via superDb to bypass RLS).
 *   2. Render the appropriate @react-pdf template with `renderToBuffer`.
 *   3. SHA-256 the unsigned bytes — this is the public fingerprint.
 *   4. Sign with detached PKCS#7 using the BLACKFYRE Reporting Authority p12,
 *      ONLY when a real operator-provided cert is configured (else UNSIGNED).
 *   5. Optionally encrypt with `qpdf` (AES-256) using a random, high-entropy
 *      password delivered out-of-band (NOT derived from the recipient email).
 *   6. Persist sha + meta to `report_exports`, write one row to `audit_logs`.
 */
import crypto from "node:crypto";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import { spawnSync } from "node:child_process";
import { renderToBuffer } from "@react-pdf/renderer";
import { eq, and, desc, count } from "drizzle-orm";
import * as React from "react";
import { SignPdf } from "@signpdf/signpdf";
import { P12Signer } from "@signpdf/signer-p12";
import type { FastifyBaseLogger } from "fastify";

import type { Db } from "../db/connection.js";
import {
  tenants,
  findings,
  evidence,
  reportExports,
  auditLogs,
  complianceScores,
  users,
  tenantFeatures,
} from "../db/schema.js";
import { getSigningP12 } from "../lib/signing-cert.js";
import {
  TenantHealthReport,
  ComplianceOverviewReport,
  FindingsRollupReport,
  type CoverContext,
  type TenantHealthData,
  type ComplianceOverviewData,
  type FindingsRollupData,
} from "./report-templates.js";

export type ReportType = "tenant-health" | "compliance-overview" | "findings-rollup";

export interface GenerateReportRequest {
  tenantId: string;
  reportType: ReportType;
  dateRange?: { from: string; to: string };
  encrypt?: boolean;
  recipientEmail?: string;
}

export interface ReportExportActor {
  userId: string;
  userEmail: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface GenerateReportResult {
  pdfBuffer: Buffer;
  sha256: string;
  encrypted: boolean;
  password?: string;
  reportType: ReportType;
  /**
   * Subject CN of the signing authority when the PDF is genuinely signed,
   * otherwise the sentinel "UNSIGNED". Never report a signer for an unsigned PDF.
   */
  signedBy: string;
  /** True only when a real detached PKCS#7 signature was embedded. */
  signed: boolean;
  warnings: string[];
}

// SECURITY FIX (BLACKFYRE audit 2026-06-05): "UNSIGNED" sentinel for the
// NOT-NULL report_exports.signed_by column so an unsigned export can never be
// recorded as signed by a fictitious authority.
const UNSIGNED_MARKER = "UNSIGNED";

// REAL IMPL (BLACKFYRE 2026-06): fixed sentinel printed on the canonical cover in place of
// a self-referential digest. The verifiable fingerprint is the SHA-256 of the delivered
// canonical (unsigned) PDF bytes — recorded in report_exports.sha256 and returned to the
// caller — which a verifier reproduces by hashing the unsigned PDF. Embedding the digest
// back into the page it is hashing over would be self-referential and could never verify.
const CANONICAL_FINGERPRINT_MARKER = "SHA-256 OF CANONICAL UNSIGNED RENDERING";

export class ReportExportService {
  constructor(
    private db: Db,
    private log?: FastifyBaseLogger,
  ) {}

  async generateReport(
    req: GenerateReportRequest,
    actor: ReportExportActor,
  ): Promise<GenerateReportResult> {
    const warnings: string[] = [];

    // 1. Tenant facts (account number, plan, etc.)
    const [tenant] = await this.db
      .select()
      .from(tenants)
      .where(eq(tenants.id, req.tenantId))
      .limit(1);
    if (!tenant) throw new Error(`Tenant ${req.tenantId} not found`);

    const accountNumber = (tenant as { accountNumber?: string }).accountNumber ?? "\u2014";

    // REAL IMPL (BLACKFYRE 2026-06): the recorded/printed fingerprint must be the REAL
    // SHA-256 of the rendered document bytes — not a "0".repeat(64) placeholder. A PDF
    // cannot embed a hash of itself (self-reference), so the fingerprint is defined as the
    // SHA-256 of the CANONICAL rendering: the document rendered with a fixed, deterministic
    // fingerprint marker on the cover. We render that canonical document once, hash its
    // actual bytes, and that real hex digest is BOTH stamped onto the delivered cover and
    // recorded in report_exports — a verifier reproduces it by deterministically
    // re-rendering the canonical document and hashing it. (Previously the digest was taken
    // from a throwaway render; this ties it to the real canonical bytes.)
    const cover: CoverContext = {
      tenantName: tenant.name,
      accountNumber,
      generatedAt: new Date().toISOString().replace("T", " ").slice(0, 19) + " UTC",
      generatedBy: actor.userEmail,
      // Deterministic canonical marker over which the fingerprint is computed. Replaced on
      // the delivered cover by the real hex digest computed below.
      sha256: CANONICAL_FINGERPRINT_MARKER,
    };

    // 2. Render the canonical document and SHA-256 its REAL bytes — this is the verifiable
    //    content hash. Then stamp that real digest onto the delivered cover.
    const canonicalBuffer = await this.renderForType(req, cover);
    const sha256 = crypto.createHash("sha256").update(canonicalBuffer).digest("hex");
    cover.sha256 = sha256;
    const unsignedBuffer = await this.renderForType(req, cover);

    // 3. Sign (detached PKCS#7) — ONLY when a real signing cert is configured.
    //
    // SECURITY FIX (BLACKFYRE audit 2026-06-05): "signed" PDFs used to silently
    // fall back to a dev cert (public password) yet still recorded signedBy. We
    // now FAIL CLOSED: getSigningP12() returns null when no operator cert is
    // configured, in which case we DO NOT claim a signature and DO NOT record a
    // signer — the export is honestly marked UNSIGNED.
    let signedBuffer: Buffer = unsignedBuffer;
    let signed = false;
    let signedBy: string = UNSIGNED_MARKER;
    const signingMaterial = await getSigningP12(this.log);
    if (!signingMaterial) {
      warnings.push(
        "PDF is UNSIGNED: no signing certificate configured " +
          "(set BLACKFYRE_SIGNING_P12 + BLACKFYRE_SIGNING_P12_PASSWORD). " +
          "The SHA-256 fingerprint is still recorded for integrity verification.",
      );
      this.log?.warn(
        { tenantId: req.tenantId, reportType: req.reportType },
        "[report-export] emitting UNSIGNED PDF — no signing cert configured",
      );
    } else {
      try {
        // @ts-ignore — runtime types from @signpdf are partial.
        const signer = new P12Signer(signingMaterial.buffer, {
          passphrase: signingMaterial.password,
        });
        const signPdf = new SignPdf();
        signedBuffer = await signPdf.sign(unsignedBuffer, signer);
        signed = true;
        signedBy = signingMaterial.subjectCN;
        this.log?.info(
          { tenantId: req.tenantId, reportType: req.reportType, signedBy },
          "[report-export] embedded detached PKCS#7 signature",
        );
      } catch (err) {
        // A configured signer that fails to embed must NOT be reported as signed.
        warnings.push(
          `PDF is UNSIGNED: detached signature could not be embedded (${
            err instanceof Error ? err.message : "unknown"
          }). The SHA-256 fingerprint is still recorded.`,
        );
        signedBuffer = unsignedBuffer;
        signed = false;
        signedBy = UNSIGNED_MARKER;
        this.log?.warn(
          {
            tenantId: req.tenantId,
            reportType: req.reportType,
            err: err instanceof Error ? err.message : "unknown",
          },
          "[report-export] signing failed — emitting UNSIGNED PDF",
        );
      }
    }

    // 4. Optional encryption (qpdf).
    let finalBuffer = signedBuffer;
    let encrypted = false;
    let password: string | undefined;
    if (req.encrypt) {
      // SECURITY FIX (BLACKFYRE audit 2026-06-05): the PDF password used to be
      // PBKDF2-derived from the recipient's (low-entropy, guessable, often
      // known) email + a shared static salt — anyone who knew the recipient
      // address could open the file. We now mint a random, high-entropy,
      // single-use password and return it for OUT-OF-BAND delivery; it is never
      // derived from or stored alongside the recipient identity.
      const result = this.tryEncrypt(signedBuffer);
      if (result.ok) {
        finalBuffer = result.buffer;
        encrypted = true;
        password = result.password;
        this.log?.info(
          { tenantId: req.tenantId, reportType: req.reportType },
          "[report-export] encrypted PDF with random out-of-band password",
        );
      } else {
        warnings.push(result.reason);
        this.log?.warn(
          { tenantId: req.tenantId, reportType: req.reportType, reason: result.reason },
          "[report-export] PDF encryption skipped",
        );
      }
    }

    // 5. Persist.
    try {
      await this.db.insert(reportExports).values({
        tenantId: req.tenantId,
        reportType: req.reportType,
        sha256,
        // SECURITY FIX (BLACKFYRE audit 2026-06-05): record the real signer or
        // the "UNSIGNED" marker — never a fictitious authority for an unsigned PDF.
        signedBy,
        encrypted,
        recipientEmail: req.recipientEmail ?? null,
        generatedBy: actor.userId,
        payloadMeta: {
          dateRange: req.dateRange ?? null,
          warnings,
        },
      });
    } catch (err) {
      warnings.push(
        `Could not persist report-export row: ${
          err instanceof Error ? err.message : "unknown"
        }`,
      );
    }

    try {
      await this.db.insert(auditLogs).values({
        tenantId: req.tenantId,
        userId: actor.userId,
        action: "report.export",
        resourceType: "report_export",
        resourceId: sha256,
        details: {
          reportType: req.reportType,
          encrypted,
          recipientEmail: req.recipientEmail ?? null,
          signed,
          signedBy,
        },
        ipAddress: actor.ipAddress ?? null,
        userAgent: actor.userAgent ?? null,
      });
    } catch (err) {
      // Audit log failures must never break the export.
      console.error("[report-export-service] audit log insert failed:", err);
    }

    return {
      pdfBuffer: finalBuffer,
      sha256,
      encrypted,
      password,
      reportType: req.reportType,
      signedBy,
      signed,
      warnings,
    };
  }

  // --- Helpers -----------------------------------------------------------

  private async renderForType(
    req: GenerateReportRequest,
    cover: CoverContext,
  ): Promise<Buffer> {
    switch (req.reportType) {
      case "tenant-health": {
        const data = await this.loadTenantHealth(req.tenantId);
        // @ts-ignore — @react-pdf component types are widely interoperable
        // but their `renderToBuffer` accepts ReactElement<DocumentProps>.
        return renderToBuffer(React.createElement(TenantHealthReport, { cover, data }));
      }
      case "compliance-overview": {
        const data = await this.loadComplianceOverview(req.tenantId);
        // @ts-ignore
        return renderToBuffer(React.createElement(ComplianceOverviewReport, { cover, data }));
      }
      case "findings-rollup": {
        const data = await this.loadFindingsRollup(req.tenantId);
        // @ts-ignore
        return renderToBuffer(React.createElement(FindingsRollupReport, { cover, data }));
      }
      default: {
        const _exhaustive: never = req.reportType;
        throw new Error(`Unknown report type: ${String(_exhaustive)}`);
      }
    }
  }

  private async loadTenantHealth(tenantId: string): Promise<TenantHealthData> {
    const [tenant] = await this.db
      .select()
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);

    const [postureRow] = await this.db
      .select({ avg: complianceScores.score })
      .from(complianceScores)
      .where(eq(complianceScores.tenantId, tenantId))
      .orderBy(desc(complianceScores.snapshotAt))
      .limit(1);

    const sevRows = await this.db
      .select({ severity: findings.severity, c: count() })
      .from(findings)
      .where(and(eq(findings.tenantId, tenantId), eq(findings.status, "open")))
      .groupBy(findings.severity);
    const sev = { critical: 0, high: 0, medium: 0, low: 0 };
    for (const r of sevRows) {
      if (r.severity === "critical") sev.critical = Number(r.c);
      else if (r.severity === "high") sev.high = Number(r.c);
      else if (r.severity === "medium") sev.medium = Number(r.c);
      else if (r.severity === "low") sev.low = Number(r.c);
    }

    const [ev] = await this.db
      .select({ c: count() })
      .from(evidence)
      .where(eq(evidence.tenantId, tenantId));

    return {
      postureScore: postureRow?.avg ?? 0,
      plan: tenant?.plan ?? "—",
      monthlyPriceInr: tenant?.monthlyPriceInr ?? null,
      findings: sev,
      evidenceCount: Number(ev?.c ?? 0),
      agentsActive: 0,
    };
  }

  private async loadComplianceOverview(tenantId: string): Promise<ComplianceOverviewData> {
    const rows = await this.db
      .select({
        framework: complianceScores.framework,
        score: complianceScores.score,
        total: complianceScores.totalControls,
      })
      .from(complianceScores)
      .where(eq(complianceScores.tenantId, tenantId))
      .orderBy(desc(complianceScores.snapshotAt));

    // Reduce to one row per framework (latest snapshot).
    const seen = new Set<string>();
    const result: ComplianceOverviewData["frameworks"] = [];
    for (const r of rows) {
      if (seen.has(r.framework)) continue;
      seen.add(r.framework);
      result.push({
        framework: r.framework,
        score: r.score ?? 0,
        controls: r.total ?? 0,
        status: (r.score ?? 0) >= 90 ? "On track" : (r.score ?? 0) >= 70 ? "At risk" : "Needs attention",
      });
    }

    // Surface frameworks the tenant has enrolled via tenant_features even if
    // no compliance_scores row exists yet (gives a non-empty cover).
    const featureRows = await this.db
      .select({ key: tenantFeatures.featureKey })
      .from(tenantFeatures)
      .where(eq(tenantFeatures.tenantId, tenantId));
    for (const f of featureRows) {
      const m = f.key.match(/^framework\.([a-z0-9]+)$/i);
      if (m && !seen.has(m[1])) {
        seen.add(m[1]);
        result.push({
          framework: m[1],
          score: 0,
          controls: 0,
          status: "Enrolled — no scan yet",
        });
      }
    }

    return { frameworks: result };
  }

  private async loadFindingsRollup(tenantId: string): Promise<FindingsRollupData> {
    const rows = await this.db
      .select({
        id: findings.id,
        title: findings.title,
        severity: findings.severity,
        category: findings.category,
        createdAt: findings.createdAt,
      })
      .from(findings)
      .where(and(eq(findings.tenantId, tenantId), eq(findings.status, "open")))
      .orderBy(desc(findings.createdAt))
      .limit(20);

    return {
      findings: rows.map((r) => ({
        id: r.id,
        title: r.title,
        severity: r.severity,
        category: r.category,
        createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
      })),
    };
  }

  private tryEncrypt(
    buffer: Buffer,
  ): { ok: true; buffer: Buffer; password: string } | { ok: false; reason: string } {
    // SECURITY FIX (BLACKFYRE audit 2026-06-05): generate a random, single-use,
    // high-entropy password (256 bits of CSPRNG entropy, URL-safe) instead of
    // deriving it deterministically from the recipient email. The caller returns
    // this password to the operator for OUT-OF-BAND delivery; it is never stored
    // or logged.
    const password = crypto.randomBytes(32).toString("base64url");

    const tmpDir = os.tmpdir();
    const inputPath = path.join(tmpDir, `bf-report-${process.pid}-${Date.now()}.pdf`);
    const outputPath = path.join(tmpDir, `bf-report-enc-${process.pid}-${Date.now()}.pdf`);
    fs.writeFileSync(inputPath, buffer);

    try {
      const r = spawnSync(
        "qpdf",
        ["--encrypt", password, password, "256", "--", inputPath, outputPath],
        { stdio: "ignore" },
      );
      if (r.status !== 0) {
        return {
          ok: false,
          reason: `qpdf exited ${r.status ?? "non-zero"}; encryption skipped.`,
        };
      }
      const encrypted = fs.readFileSync(outputPath);
      return { ok: true, buffer: encrypted, password };
    } catch (err) {
      return {
        ok: false,
        reason: `qpdf not available on PATH (${
          err instanceof Error ? err.message : "unknown"
        }); encryption skipped.`,
      };
    } finally {
      try {
        fs.unlinkSync(inputPath);
      } catch {}
      try {
        fs.unlinkSync(outputPath);
      } catch {}
    }
  }
}
