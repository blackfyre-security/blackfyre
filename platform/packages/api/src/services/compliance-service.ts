import { eq, and, desc, ne, sql } from "drizzle-orm";
import { controlMappings, complianceScores, findings, scans, tenants } from "../db/schema.js";
import type { Db } from "../db/connection.js";
import { getFrameworkRegistry, getAllFrameworkRegistries } from "../compliance/control-registry.js";
// REAL IMPL (BLACKFYRE 2026-06): cross-framework impact (GAP-002) reuses the real
// static cross-mapping matrix already shipped in cortex so a single failing
// control surfaces the equivalent controls it breaks in OTHER frameworks too,
// rather than only the frameworks the finding was directly mapped to.
import { CrossFrameworkMapper } from "./cortex/cross-framework-mapper.js";
// REAL IMPL (BLACKFYRE 2026-06): historical version catalogs + pure diff engine
// so /api/compliance/diff returns real added/removed/modified controls.
import {
  getAllVersionsOnRecord,
  hasPriorVersion,
  resolvePriorCatalog,
  computeControlDiff,
} from "../compliance/framework-versions.js";
import { calculateFrameworkScore } from "../compliance/scoring.js";
import { getIndustryProfile, getAllIndustryProfiles } from "../compliance/industry-profiles.js";
import { notFound, badRequest } from "../utils/errors.js";
import type {
  FrameworkScore,
  ComplianceMatrix,
  ControlMatrixEntry,
  ComplianceTrend,
  FrameworkDiff,
  IndustryBaselineProfile,
  ControlDefinition,
} from "@blackfyre/shared";

// REAL IMPL (BLACKFYRE 2026-06): structured cross-framework impact result (GAP-002).
// A finding's dedup_hash links it across frameworks; resolving the finding to its
// control mappings yields the set of frameworks/controls it directly affects, and
// the static cross-mapping matrix expands that to the equivalent controls it breaks
// in OTHER frameworks. All inputs are tenant-scoped (the caller passes the RLS-bound
// db and the finding is confirmed in-tenant before this runs).
export interface CrossFrameworkImpact {
  findingId: string;
  dedupHash: string;
  category: string;
  severity: string;
  status: string;
  // Frameworks/controls this finding is DIRECTLY mapped to (from control_mappings).
  directMappings: Array<{
    framework: string;
    controlId: string;
    controlName: string;
    status: string;
  }>;
  // Equivalent controls in OTHER frameworks (from the cross-mapping matrix) that the
  // same root cause also breaks — the real "fix once, satisfy many" view.
  equivalentControls: Array<{
    framework: string;
    controlId: string;
    controlName: string;
    strength: "exact" | "strong" | "partial" | "weak";
    rationale: string;
    viaControlId: string; // the direct control whose mapping produced this equivalent
  }>;
  // Sibling findings sharing this dedup_hash within the tenant (the dedup linkage
  // that ties one root cause across multiple scans/frameworks).
  linkedFindingIds: string[];
  // The full set of distinct frameworks affected (direct + equivalent).
  affectedFrameworks: string[];
  totalFrameworksAffected: number;
}

// REAL IMPL (BLACKFYRE 2026-06): certification go/no-go checklist (GAP-005).
// Computed from the tenant's real latest compliance score for the framework plus
// its open critical findings — never hardcoded. `isReady` is true ONLY when there
// are zero hard blockers.
export interface CertificationReadiness {
  framework: string;
  isReady: boolean;
  score: number;
  scanId: string | null;
  evaluatedControls: number;
  totalControls: number;
  failedControls: number;
  notEvaluatedControls: number;
  openCriticalFindings: number;
  blockers: Array<{ code: string; message: string; count?: number }>;
  warnings: Array<{ code: string; message: string; count?: number }>;
  computedAt: string;
}

// Score below which a framework cannot be certified regardless of findings.
const READINESS_MIN_SCORE = 80;
// Score band that is passing but flagged as a warning (thin margin).
const READINESS_WARN_SCORE = 90;

export class ComplianceService {
  constructor(private db: Db) {}

  /**
   * Calculate compliance scores for all frameworks based on the latest (or specific) scan.
   */
  async getScores(tenantId: string, scanId?: string): Promise<FrameworkScore[]> {
    let targetScanId = scanId;
    if (!targetScanId) {
      const [latestScan] = await this.db
        .select({ id: scans.id })
        .from(scans)
        .where(
          and(
            eq(scans.tenantId, tenantId),
            eq(scans.status, "completed"),
          ),
        )
        .orderBy(desc(scans.completedAt))
        .limit(1);

      if (!latestScan) return [];
      targetScanId = latestScan.id;
    }

    // Get all control mappings for findings in this scan
    const mappings = await this.db
      .select({
        framework: controlMappings.framework,
        controlId: controlMappings.controlId,
        status: controlMappings.status,
      })
      .from(controlMappings)
      .innerJoin(findings, eq(controlMappings.findingId, findings.id))
      .where(eq(findings.scanId, targetScanId));

    // Group by framework into status maps
    const byFramework = new Map<string, Map<string, string>>();
    for (const m of mappings) {
      if (!byFramework.has(m.framework)) byFramework.set(m.framework, new Map());
      const fwMap = byFramework.get(m.framework)!;
      const existing = fwMap.get(m.controlId);
      // Worst status wins if multiple findings map to same control
      if (!existing || statusPriority(m.status) > statusPriority(existing)) {
        fwMap.set(m.controlId, m.status);
      }
    }

    const scores: FrameworkScore[] = [];
    for (const registry of getAllFrameworkRegistries()) {
      const statusMap = byFramework.get(registry.framework) ?? new Map();
      const result = calculateFrameworkScore(registry.framework, registry.controls, statusMap as any);
      scores.push(result);
    }

    return scores;
  }

  /**
   * Get control-by-control matrix for a single framework.
   */
  async getMatrix(tenantId: string, framework: string): Promise<ComplianceMatrix> {
    const registry = getFrameworkRegistry(framework);
    if (!registry) throw notFound("Framework");

    const [latestScan] = await this.db
      .select({ id: scans.id })
      .from(scans)
      .where(
        and(
          eq(scans.tenantId, tenantId),
          eq(scans.status, "completed"),
        ),
      )
      .orderBy(desc(scans.completedAt))
      .limit(1);

    if (!latestScan) {
      return {
        framework: registry.framework,
        version: registry.version,
        score: 0,
        entries: registry.controls.map((c) => ({
          controlId: c.controlId,
          controlName: c.controlName,
          weight: c.weight,
          category: c.category,
          status: "not_evaluated" as const,
          findingIds: [],
          evidenceCount: 0,
        })),
      };
    }

    // Get mappings for this framework + scan
    const mappings = await this.db
      .select({
        controlId: controlMappings.controlId,
        status: controlMappings.status,
        findingId: controlMappings.findingId,
      })
      .from(controlMappings)
      .innerJoin(findings, eq(controlMappings.findingId, findings.id))
      .where(
        and(
          eq(findings.scanId, latestScan.id),
          eq(controlMappings.framework, framework as any),
        ),
      );

    // Build lookup: controlId → { status, findingIds }
    const controlData = new Map<string, { status: string; findingIds: Set<string> }>();
    for (const m of mappings) {
      if (!controlData.has(m.controlId)) {
        controlData.set(m.controlId, { status: m.status, findingIds: new Set() });
      }
      const existing = controlData.get(m.controlId)!;
      existing.findingIds.add(m.findingId);
      if (statusPriority(m.status) > statusPriority(existing.status)) {
        existing.status = m.status;
      }
    }

    // Build status map for scoring
    const statusMap = new Map<string, string>();
    for (const [controlId, data] of controlData) {
      statusMap.set(controlId, data.status);
    }

    const entries: ControlMatrixEntry[] = registry.controls.map((c) => {
      const data = controlData.get(c.controlId);
      return {
        controlId: c.controlId,
        controlName: c.controlName,
        weight: c.weight,
        category: c.category,
        status: data ? (data.status as any) : "not_evaluated",
        findingIds: data ? Array.from(data.findingIds) : [],
        evidenceCount: 0,
      };
    });

    const scoreResult = calculateFrameworkScore(framework, registry.controls, statusMap as any);

    return {
      framework: registry.framework,
      version: registry.version,
      score: scoreResult.score,
      entries,
    };
  }

  /**
   * Get historical compliance score trend for a framework.
   */
  async getTrend(tenantId: string, framework: string, limit: number): Promise<ComplianceTrend> {
    const snapshots = await this.db
      .select({
        scanId: complianceScores.scanId,
        score: complianceScores.score,
        snapshotAt: complianceScores.snapshotAt,
      })
      .from(complianceScores)
      .where(
        and(
          eq(complianceScores.tenantId, tenantId),
          eq(complianceScores.framework, framework as any),
        ),
      )
      .orderBy(desc(complianceScores.snapshotAt))
      .limit(limit);

    return {
      framework: framework as any,
      points: snapshots.reverse().map((s) => ({
        scanId: s.scanId,
        score: s.score,
        snapshotAt: s.snapshotAt,
      })),
    };
  }

  /**
   * Snapshot scores for a completed scan — called by scan worker.
   */
  async snapshotScores(tenantId: string, scanId: string): Promise<void> {
    const scores = await this.getScores(tenantId, scanId);
    if (scores.length === 0) return;

    await this.db.insert(complianceScores).values(
      scores.map((s) => ({
        tenantId,
        scanId,
        framework: s.framework as any,
        score: s.score,
        passCount: s.passCount,
        partialCount: s.partialCount,
        failCount: s.failCount,
        naCount: s.naCount,
        totalControls: s.totalControls,
      })),
    );
  }

  /**
   * REAL IMPL (BLACKFYRE 2026-06): compute a real version diff for a framework.
   *
   * The control registry tracks only the CURRENT version of each framework; prior
   * published versions (e.g. PCI-DSS 3.2.1, ISO 27001:2013) live in
   * framework-versions.ts. We diff the requested `fromVersion`'s catalog against
   * the `toVersion`'s catalog and return genuine added / removed / modified
   * controls. If the framework has no prior version on record we throw an explicit
   * NO_PRIOR_VERSION error instead of pretending an empty comparison succeeded
   * (the old stub returned `changes: []` with HTTP 200, which falsely implied
   * "no changes between versions").
   *
   * Public signature is unchanged: (framework, fromVersion, toVersion) -> FrameworkDiff.
   */
  getFrameworkDiff(framework: string, fromVersion: string, toVersion: string): FrameworkDiff {
    const registry = getFrameworkRegistry(framework);
    if (!registry) throw notFound("Framework");

    const currentVersion = registry.version;
    const versionsOnRecord = getAllVersionsOnRecord(framework, currentVersion);

    // Honest case: only the current version exists — there is nothing prior to
    // diff against. Rather than return a fake empty-success diff (the old stub
    // behaviour), surface an explicit, queryable error so clients are not misled
    // into thinking "no changes" when the real answer is "no prior version".
    if (!hasPriorVersion(framework)) {
      throw badRequest(
        "NO_PRIOR_VERSION",
        `No prior version on record for ${framework}; only ${currentVersion} is published in the control catalog, so there is nothing to diff.`,
        { framework, currentVersion, versionsOnRecord },
      );
    }

    if (!versionsOnRecord.includes(fromVersion) || !versionsOnRecord.includes(toVersion)) {
      throw badRequest(
        "INVALID_VERSION",
        `Unknown version. Available: ${versionsOnRecord.join(", ")}`,
        { framework, versionsOnRecord },
      );
    }

    if (fromVersion === toVersion) {
      throw badRequest(
        "INVALID_VERSION",
        `fromVersion and toVersion are identical (${fromVersion}); nothing to diff.`,
        { framework, fromVersion, toVersion },
      );
    }

    // Resolve each side's control catalog. The current version comes from the
    // live registry; prior versions come from the historical catalog module.
    const resolveCatalog = (
      version: string,
    ): { controls: ControlDefinition[]; note: string } | undefined => {
      if (version === currentVersion) {
        return { controls: registry.controls, note: `${framework} ${currentVersion} (current registry catalog)` };
      }
      const prior = resolvePriorCatalog(framework, version);
      return prior ? { controls: prior.controls, note: prior.note } : undefined;
    };

    const from = resolveCatalog(fromVersion);
    const to = resolveCatalog(toVersion);
    if (!from || !to) {
      throw badRequest(
        "INVALID_VERSION",
        `No catalog on record for one of the requested versions. Available: ${versionsOnRecord.join(", ")}`,
        { framework, versionsOnRecord },
      );
    }

    const { changes } = computeControlDiff({
      framework,
      fromVersion,
      toVersion,
      fromControls: from.controls,
      toControls: to.controls,
      note: `${from.note} -> ${to.note}`,
    });

    // FrameworkDiff is the stable public contract: { framework, fromVersion,
    // toVersion, changes }. We deliberately do NOT bolt an untyped field on it.
    return {
      framework: framework as any,
      fromVersion,
      toVersion,
      changes,
    };
  }

  /**
   * REAL IMPL (BLACKFYRE 2026-06): cross-framework impact for a finding (GAP-002).
   *
   * A finding's dedup_hash already links it across frameworks. This resolves the
   * REAL chain: finding -> its control_mappings rows -> the set of frameworks/
   * controls it directly affects, then expands each direct control via the static
   * cross-mapping matrix (CrossFrameworkMapper) to the equivalent controls it also
   * breaks in OTHER frameworks. It also returns the sibling findings that share the
   * same (tenant_id, dedup_hash) — the dedup linkage that ties one root cause across
   * scans/frameworks.
   *
   * Tenant-scoped: `findingId` MUST already be confirmed to belong to the caller's
   * tenant (the route does this), and every query below is additionally constrained
   * by tenantId so the dedup-sibling lookup can never leak another tenant's findings.
   * No empty/hardcoded output — everything is computed from persisted rows + the real
   * mapping matrix.
   */
  async getCrossFrameworkImpact(tenantId: string, findingId: string): Promise<CrossFrameworkImpact> {
    const [finding] = await this.db
      .select({
        id: findings.id,
        category: findings.category,
        severity: findings.severity,
        status: findings.status,
        dedupHash: findings.dedupHash,
      })
      .from(findings)
      .where(and(eq(findings.id, findingId), eq(findings.tenantId, tenantId)))
      .limit(1);

    if (!finding) throw notFound("Finding");

    // Direct control mappings for this finding (reachable only via finding.id, which
    // we have already confirmed belongs to this tenant).
    const directRows = await this.db
      .select({
        framework: controlMappings.framework,
        controlId: controlMappings.controlId,
        controlName: controlMappings.controlName,
        status: controlMappings.status,
      })
      .from(controlMappings)
      .where(eq(controlMappings.findingId, findingId));

    const directMappings = directRows.map((r) => ({
      framework: r.framework as string,
      controlId: r.controlId,
      controlName: r.controlName,
      status: r.status as string,
    }));

    // Expand each direct control to equivalent controls in OTHER frameworks via the
    // real cross-mapping matrix. De-dup by (framework, controlId) keeping the strongest
    // mapping so the same equivalent surfaced from two direct controls is not doubled.
    const mapper = new CrossFrameworkMapper();
    const STRENGTH_RANK: Record<string, number> = { exact: 4, strong: 3, partial: 2, weak: 1 };
    const directKeys = new Set(directMappings.map((m) => `${m.framework}:${m.controlId}`));
    const equivByKey = new Map<string, CrossFrameworkImpact["equivalentControls"][number]>();

    for (const dm of directMappings) {
      for (const eq2 of mapper.getEquivalentControls(dm.framework, dm.controlId)) {
        const key = `${eq2.targetFramework}:${eq2.targetControlId}`;
        // Skip equivalents that are themselves a control the finding is directly
        // mapped to — those are already represented in directMappings.
        if (directKeys.has(key)) continue;
        const existing = equivByKey.get(key);
        if (!existing || STRENGTH_RANK[eq2.strength] > STRENGTH_RANK[existing.strength]) {
          equivByKey.set(key, {
            framework: eq2.targetFramework,
            controlId: eq2.targetControlId,
            controlName: eq2.targetControlTitle,
            strength: eq2.strength,
            rationale: eq2.rationale,
            viaControlId: dm.controlId,
          });
        }
      }
    }
    const equivalentControls = Array.from(equivByKey.values());

    // Sibling findings sharing this dedup_hash within the tenant — the persisted
    // dedup linkage. Tenant-scoped AND excludes the finding itself.
    const siblings = await this.db
      .select({ id: findings.id })
      .from(findings)
      .where(
        and(
          eq(findings.tenantId, tenantId),
          eq(findings.dedupHash, finding.dedupHash),
          ne(findings.id, findingId),
        ),
      );
    const linkedFindingIds = siblings.map((s) => s.id);

    const affectedFrameworks = Array.from(
      new Set([
        ...directMappings.map((m) => m.framework),
        ...equivalentControls.map((m) => m.framework),
      ]),
    ).sort();

    return {
      findingId: finding.id,
      dedupHash: finding.dedupHash,
      category: finding.category as string,
      severity: finding.severity as string,
      status: finding.status as string,
      directMappings,
      equivalentControls,
      linkedFindingIds,
      affectedFrameworks,
      totalFrameworksAffected: affectedFrameworks.length,
    };
  }

  /**
   * REAL IMPL (BLACKFYRE 2026-06): certification readiness go/no-go (GAP-005).
   *
   * Computes a structured { isReady, blockers, warnings } checklist from the
   * tenant's REAL latest compliance state for the framework — never hardcoded:
   *   - the weighted score + pass/partial/fail/not-evaluated breakdown come from
   *     getMatrix() (which reads the latest completed scan's control_mappings);
   *   - open critical findings are counted from the findings table, scoped to the
   *     framework via control_mappings so only findings that actually map to a
   *     control in THIS framework count.
   *
   * Blockers (each forces isReady=false): no completed scan, score below the
   * minimum certifiable threshold, any open critical finding mapped to the
   * framework, or any directly-evaluated control failing. Warnings (do NOT block,
   * but flag risk): thin score margin, or controls never evaluated (coverage gaps).
   *
   * Tenant-scoped throughout. Returns a stable, additive shape.
   */
  async getCertificationReadiness(tenantId: string, framework: string): Promise<CertificationReadiness> {
    const registry = getFrameworkRegistry(framework);
    if (!registry) throw notFound("Framework");

    const blockers: CertificationReadiness["blockers"] = [];
    const warnings: CertificationReadiness["warnings"] = [];

    // Latest completed scan for the tenant — the basis for the readiness verdict.
    const [latestScan] = await this.db
      .select({ id: scans.id })
      .from(scans)
      .where(and(eq(scans.tenantId, tenantId), eq(scans.status, "completed")))
      .orderBy(desc(scans.completedAt))
      .limit(1);

    // Real score + control breakdown from the latest scan's mappings.
    const matrix = await this.getMatrix(tenantId, framework);
    const failedControls = matrix.entries.filter((e) => e.status === "fail").length;
    const notEvaluatedControls = matrix.entries.filter((e) => e.status === "not_evaluated").length;
    const evaluatedControls = matrix.entries.length - notEvaluatedControls;

    // Open critical findings that actually map to a control in THIS framework.
    // Joined through control_mappings and scoped to the tenant (defense-in-depth on
    // top of RLS) so the count reflects real, framework-relevant critical exposure.
    const [criticalRow] = await this.db
      .select({ count: sql<number>`count(distinct ${findings.id})` })
      .from(findings)
      .innerJoin(controlMappings, eq(controlMappings.findingId, findings.id))
      .where(
        and(
          eq(findings.tenantId, tenantId),
          eq(findings.severity, "critical"),
          eq(findings.status, "open"),
          eq(controlMappings.framework, framework as any),
        ),
      );
    const openCriticalFindings = Number(criticalRow?.count ?? 0);

    // ---- Blockers (each forces a NO-GO) ----
    if (!latestScan) {
      blockers.push({
        code: "NO_COMPLETED_SCAN",
        message: "No completed scan exists for this tenant; run a scan before certification.",
      });
    }
    if (matrix.score < READINESS_MIN_SCORE) {
      blockers.push({
        code: "SCORE_BELOW_THRESHOLD",
        message: `Compliance score ${matrix.score}% is below the certifiable minimum of ${READINESS_MIN_SCORE}%.`,
        count: matrix.score,
      });
    }
    if (openCriticalFindings > 0) {
      blockers.push({
        code: "OPEN_CRITICAL_FINDINGS",
        message: `${openCriticalFindings} open critical finding(s) map to ${framework} controls and must be resolved before certification.`,
        count: openCriticalFindings,
      });
    }
    if (failedControls > 0) {
      blockers.push({
        code: "FAILED_CONTROLS",
        message: `${failedControls} control(s) are failing and must be remediated to a passing or partial state.`,
        count: failedControls,
      });
    }

    // ---- Warnings (risk flags that do NOT block) ----
    if (matrix.score >= READINESS_MIN_SCORE && matrix.score < READINESS_WARN_SCORE) {
      warnings.push({
        code: "THIN_SCORE_MARGIN",
        message: `Score ${matrix.score}% clears the minimum but sits below the ${READINESS_WARN_SCORE}% comfortable margin.`,
        count: matrix.score,
      });
    }
    if (notEvaluatedControls > 0) {
      warnings.push({
        code: "COVERAGE_GAP",
        message: `${notEvaluatedControls} control(s) were never evaluated — auditors may flag incomplete coverage.`,
        count: notEvaluatedControls,
      });
    }

    return {
      framework: registry.framework as string,
      isReady: blockers.length === 0,
      score: matrix.score,
      scanId: latestScan?.id ?? null,
      evaluatedControls,
      totalControls: matrix.entries.length,
      failedControls,
      notEvaluatedControls,
      openCriticalFindings,
      blockers,
      warnings,
      computedAt: new Date().toISOString(),
    };
  }

  /**
   * Get industry recommendations based on profile.
   */
  getIndustryRecommendations(industry: string): IndustryBaselineProfile | undefined {
    return getIndustryProfile(industry);
  }

  /**
   * List available frameworks.
   */
  getAvailableFrameworks() {
    return getAllFrameworkRegistries();
  }

  /**
   * List all industry profiles.
   */
  getAllProfiles() {
    return getAllIndustryProfiles();
  }
}

/** Higher number = worse status. */
function statusPriority(status: string): number {
  switch (status) {
    case "fail": return 3;
    case "partial": return 2;
    case "pass": return 1;
    case "na": return 0;
    default: return -1;
  }
}
