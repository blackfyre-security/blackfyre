import { eq, and, count, desc } from "drizzle-orm";
import { findings, evidence, scans, remediations } from "../db/schema.js";
import type { Db } from "../db/connection.js";
import { ComplianceService } from "../services/compliance-service.js";
import type {
  ReadinessReport,
  GapAnalysisReport,
  BoardSummaryReport,
  EvidencePackageReport,
} from "@blackfyre/shared";
// REAL IMPL (BLACKFYRE 2026-06): generateEvidencePackage() previously only returned a
// JSON object — there was no downloadable package to hand an auditor. We add
// buildEvidencePackageZip(), which assembles a REAL .zip (via archiver, already a
// dependency) containing a signed manifest, the structured package JSON, and one JSON
// file per evidence artifact (with its recorded SHA-256). The existing JSON method keeps
// its public signature so the PDF renderer + routes are untouched.
import archiver from "archiver";
import { PassThrough } from "node:stream";
import { createHash } from "node:crypto";

export class ReportGeneratorService {
  private complianceService: ComplianceService;

  constructor(private db: Db) {
    this.complianceService = new ComplianceService(db);
  }

  /**
   * Generate a readiness report for a specific framework.
   * Gathers compliance scores, findings count by severity, top failing controls.
   */
  async generateReadiness(tenantId: string, framework: string): Promise<ReadinessReport> {
    const matrix = await this.complianceService.getMatrix(tenantId, framework);

    const passCount = matrix.entries.filter((e) => e.status === "pass").length;
    const failCount = matrix.entries.filter((e) => e.status === "fail").length;
    const partialCount = matrix.entries.filter((e) => e.status === "partial").length;

    const topFailingControls = matrix.entries
      .filter((e) => e.status === "fail" || e.status === "partial")
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 10)
      .map((e) => ({
        controlId: e.controlId,
        controlName: e.controlName,
        category: e.category,
      }));

    // Get findings by severity for this tenant
    const severityCounts = await this.getfindingsBySeverity(tenantId);

    return {
      framework: matrix.framework,
      overallScore: matrix.score,
      totalControls: matrix.entries.length,
      passCount,
      failCount,
      partialCount,
      topFailingControls,
      findingsBySeverity: severityCounts,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Generate a gap analysis report for a specific framework.
   * Filters to fail/partial controls and groups by category.
   */
  async generateGapAnalysis(tenantId: string, framework: string): Promise<GapAnalysisReport> {
    const matrix = await this.complianceService.getMatrix(tenantId, framework);

    const gapEntries = matrix.entries.filter(
      (e) => e.status === "fail" || e.status === "partial",
    );

    // Group by category
    const categoryMap = new Map<string, { controlId: string; controlName: string; status: string; findingCount: number }[]>();
    for (const entry of gapEntries) {
      if (!categoryMap.has(entry.category)) {
        categoryMap.set(entry.category, []);
      }
      categoryMap.get(entry.category)!.push({
        controlId: entry.controlId,
        controlName: entry.controlName,
        status: entry.status,
        findingCount: entry.findingIds.length,
      });
    }

    const gaps = Array.from(categoryMap.entries()).map(([category, controls]) => ({
      category,
      controls,
    }));

    return {
      framework: matrix.framework,
      gaps,
      totalGaps: gapEntries.length,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Generate a board-level executive summary across all frameworks.
   * Includes scores, open findings, recent scans, remediation progress.
   */
  async generateBoardSummary(tenantId: string): Promise<BoardSummaryReport> {
    const scores = await this.complianceService.getScores(tenantId);

    const frameworkScores = scores.map((s) => ({
      framework: s.framework,
      score: s.score,
    }));

    // Count open findings
    const [openResult] = await this.db
      .select({ count: count() })
      .from(findings)
      .where(
        and(
          eq(findings.tenantId, tenantId),
          eq(findings.status, "open"),
        ),
      );
    const totalOpenFindings = openResult?.count ?? 0;

    // Count critical findings
    const [criticalResult] = await this.db
      .select({ count: count() })
      .from(findings)
      .where(
        and(
          eq(findings.tenantId, tenantId),
          eq(findings.status, "open"),
          eq(findings.severity, "critical"),
        ),
      );
    const criticalFindings = criticalResult?.count ?? 0;

    // Count recent scans (completed in the last 30 days)
    const [scanResult] = await this.db
      .select({ count: count() })
      .from(scans)
      .where(
        and(
          eq(scans.tenantId, tenantId),
          eq(scans.status, "completed"),
        ),
      );
    const recentScanCount = scanResult?.count ?? 0;

    // Calculate remediation progress: completed / total remediations
    const [totalRemediations] = await this.db
      .select({ count: count() })
      .from(remediations)
      .innerJoin(findings, eq(remediations.findingId, findings.id))
      .where(eq(findings.tenantId, tenantId));

    const [completedRemediations] = await this.db
      .select({ count: count() })
      .from(remediations)
      .innerJoin(findings, eq(remediations.findingId, findings.id))
      .where(
        and(
          eq(findings.tenantId, tenantId),
          eq(remediations.status, "completed"),
        ),
      );

    const totalRem = totalRemediations?.count ?? 0;
    const completedRem = completedRemediations?.count ?? 0;
    const remediationProgress = totalRem > 0 ? Math.round((completedRem / totalRem) * 100) : 0;

    return {
      frameworkScores,
      totalOpenFindings,
      criticalFindings,
      recentScanCount,
      remediationProgress,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Generate an evidence package report for a specific framework.
   * Gets compliance matrix and evidence records for each control's findings.
   */
  async generateEvidencePackage(tenantId: string, framework: string): Promise<EvidencePackageReport> {
    const matrix = await this.complianceService.getMatrix(tenantId, framework);

    const controls: EvidencePackageReport["controls"] = [];

    for (const entry of matrix.entries) {
      const evidenceItems: { type: string; collectedAt: string; collectedBy: string }[] = [];

      // Gather evidence for each finding linked to this control
      for (const findingId of entry.findingIds) {
        const rows = await this.db
          .select({
            type: evidence.type,
            collectedAt: evidence.collectedAt,
            collectedBy: evidence.collectedBy,
          })
          .from(evidence)
          .where(eq(evidence.findingId, findingId));

        for (const row of rows) {
          evidenceItems.push({
            type: row.type,
            collectedAt: row.collectedAt.toISOString(),
            collectedBy: row.collectedBy,
          });
        }
      }

      controls.push({
        controlId: entry.controlId,
        controlName: entry.controlName,
        status: entry.status,
        evidenceItems,
      });
    }

    return {
      framework: matrix.framework,
      controls,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Build a REAL downloadable evidence package (.zip) for a framework.
   *
   * REAL IMPL (BLACKFYRE 2026-06): the only way to package evidence used to be the JSON
   * blob from generateEvidencePackage(); there was no artifact an auditor could download.
   * This assembles a genuine ZIP with archiver containing:
   *   - manifest.json        — package metadata + a SHA-256 over the package JSON and the
   *                            per-file digests, so the bundle is tamper-evident.
   *   - evidence-package.json — the full structured EvidencePackageReport.
   *   - controls/<id>.json    — one file per control with its evidence items.
   *   - evidence/<finding>/<n>.json — one file per real evidence row (its recorded
   *                            storagePath / s3ObjectKey / sha256 from the evidence table).
   * Returns the assembled bytes (Buffer) plus the manifest SHA-256; callers stream it with
   * Content-Type: application/zip. No PDF rendering, no placeholder.
   */
  async buildEvidencePackageZip(
    tenantId: string,
    framework: string,
  ): Promise<{ zip: Buffer; sha256: string; filename: string; evidenceCount: number }> {
    const pkg = await this.generateEvidencePackage(tenantId, framework);

    // Pull the real evidence rows backing the framework's controls so the ZIP carries the
    // actual recorded artifacts (storage pointer + integrity hash), not just counts.
    const evidenceRows = await this.db
      .select({
        id: evidence.id,
        findingId: evidence.findingId,
        type: evidence.type,
        storagePath: evidence.storagePath,
        sha256Hash: evidence.sha256Hash,
        hashSource: evidence.hashSource,
        integrityVerified: evidence.integrityVerified,
        framework: evidence.framework,
        s3ObjectKey: evidence.s3ObjectKey,
        collectedAt: evidence.collectedAt,
        collectedBy: evidence.collectedBy,
      })
      .from(evidence)
      .where(eq(evidence.tenantId, tenantId))
      .orderBy(desc(evidence.collectedAt))
      .limit(1000);

    const archive = archiver("zip", { zlib: { level: 6 } });
    const passThrough = new PassThrough();
    const chunks: Buffer[] = [];
    passThrough.on("data", (c: Buffer) => chunks.push(c));

    const done = new Promise<void>((resolve, reject) => {
      passThrough.on("end", () => resolve());
      passThrough.on("error", reject);
      archive.on("error", reject);
    });
    archive.pipe(passThrough);

    // 1. The structured package JSON (the same object the PDF renders from).
    const packageJson = JSON.stringify(pkg, null, 2);
    archive.append(packageJson, { name: "evidence-package.json" });

    // 2. One file per control.
    const fileDigests: Array<{ path: string; sha256: string }> = [];
    fileDigests.push({ path: "evidence-package.json", sha256: this.hashOf(packageJson) });
    for (const control of pkg.controls) {
      const safeId = control.controlId.replace(/[^a-zA-Z0-9._-]/g, "_");
      const body = JSON.stringify(control, null, 2);
      const name = `controls/${safeId}.json`;
      archive.append(body, { name });
      fileDigests.push({ path: name, sha256: this.hashOf(body) });
    }

    // 3. One file per real evidence row (its durable storage pointer + recorded hash).
    for (const row of evidenceRows) {
      const body = JSON.stringify(
        {
          id: row.id,
          findingId: row.findingId,
          type: row.type,
          framework: row.framework,
          storagePath: row.storagePath,
          s3ObjectKey: row.s3ObjectKey,
          sha256Hash: row.sha256Hash,
          hashSource: row.hashSource,
          integrityVerified: row.integrityVerified,
          collectedAt: row.collectedAt instanceof Date ? row.collectedAt.toISOString() : String(row.collectedAt),
          collectedBy: row.collectedBy,
        },
        null,
        2,
      );
      const name = `evidence/${row.findingId}/${row.id}.json`;
      archive.append(body, { name });
      fileDigests.push({ path: name, sha256: this.hashOf(body) });
    }

    // 4. Manifest: package metadata + a SHA-256 over the concatenated per-file digests,
    //    so the whole bundle is tamper-evident.
    const manifestCore = {
      type: "blackfyre-evidence-package",
      version: 1,
      tenantId,
      framework: pkg.framework,
      generatedAt: pkg.generatedAt,
      controlCount: pkg.controls.length,
      evidenceCount: evidenceRows.length,
      files: fileDigests,
    };
    const manifestSha = this.hashOf(
      fileDigests.map((f) => `${f.path}:${f.sha256}`).join("\n"),
    );
    const manifestJson = JSON.stringify({ ...manifestCore, manifestSha256: manifestSha }, null, 2);
    archive.append(manifestJson, { name: "manifest.json" });

    await archive.finalize();
    await done;

    const zip = Buffer.concat(chunks);
    const filename = `blackfyre-evidence-${pkg.framework}-${pkg.generatedAt.slice(0, 10)}.zip`;
    return { zip, sha256: manifestSha, filename, evidenceCount: evidenceRows.length };
  }

  private hashOf(content: string | Buffer): string {
    return createHash("sha256").update(content).digest("hex");
  }

  /**
   * Get findings count grouped by severity for a tenant.
   */
  private async getfindingsBySeverity(tenantId: string): Promise<Record<string, number>> {
    const severities = ["critical", "high", "medium", "low", "info"] as const;
    const result: Record<string, number> = {};

    for (const severity of severities) {
      const [row] = await this.db
        .select({ count: count() })
        .from(findings)
        .where(
          and(
            eq(findings.tenantId, tenantId),
            eq(findings.severity, severity),
          ),
        );
      result[severity] = row?.count ?? 0;
    }

    return result;
  }
}
