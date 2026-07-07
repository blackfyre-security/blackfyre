import type { Db } from "../../db/connection.js";
import { controlMappings, complianceScores } from "../../db/schema.js";
import { eq, and, desc } from "drizzle-orm";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface UnifiedControlEntry {
  category: string;
  controlsByFramework: Array<{
    framework: string;
    controlId: string;
    controlName: string;
    status: "pass" | "partial" | "fail" | "na";
    findingCount: number;
  }>;
}

export interface RemediationROI {
  findingId: string;
  category: string;
  frameworkImpacts: Array<{
    framework: string;
    controlId: string;
    estimatedScoreImprovement: number;
  }>;
  totalImpactScore: number;
  priorityRank: number;
}

/* ------------------------------------------------------------------ */
/*  Unified Control View Service                                       */
/* ------------------------------------------------------------------ */

export class UnifiedControlViewService {
  constructor(private db: Db) {}

  /**
   * Get a unified view of ONE control category across ALL frameworks.
   */
  async getUnifiedControlView(tenantId: string, category: string): Promise<UnifiedControlEntry> {
    const mappings = await this.db
      .select()
      .from(controlMappings)
      .where(eq(controlMappings.framework, category as any))
      .limit(100);

    // Group by framework
    const byFramework = new Map<string, Array<typeof mappings[0]>>();
    for (const m of mappings) {
      const existing = byFramework.get(m.framework) ?? [];
      existing.push(m);
      byFramework.set(m.framework, existing);
    }

    return {
      category,
      controlsByFramework: Array.from(byFramework.entries()).map(([framework, controls]) => ({
        framework,
        controlId: controls[0]?.controlId ?? "",
        controlName: controls[0]?.controlName ?? "",
        status: controls[0]?.status ?? "na",
        findingCount: controls.length,
      })),
    };
  }

  /**
   * Calculate remediation ROI across all frameworks.
   * "Fixing this IAM issue improves SOC 2 by 5% AND ISO 27001 by 3%"
   */
  async getRemediationROI(findingId: string, tenantId: string): Promise<RemediationROI> {
    const mappings = await this.db
      .select()
      .from(controlMappings)
      .where(eq(controlMappings.findingId, findingId));

    // Get current scores to calculate improvement
    const scores = await this.db
      .select()
      .from(complianceScores)
      .where(eq(complianceScores.tenantId, tenantId))
      .orderBy(desc(complianceScores.snapshotAt))
      .limit(20);

    const latestScores = new Map<string, number>();
    for (const s of scores) {
      if (!latestScores.has(s.framework)) {
        latestScores.set(s.framework, s.totalControls);
      }
    }

    const frameworkImpacts = mappings.map((m) => {
      const totalControls = latestScores.get(m.framework) ?? 100;
      const improvement = Math.round((1 / totalControls) * 100 * 10) / 10;
      return {
        framework: m.framework,
        controlId: m.controlId,
        estimatedScoreImprovement: improvement,
      };
    });

    const totalImpact = frameworkImpacts.reduce((sum, f) => sum + f.estimatedScoreImprovement, 0);

    return {
      findingId,
      category: mappings[0]?.controlName ?? "unknown",
      frameworkImpacts,
      totalImpactScore: Math.round(totalImpact * 10) / 10,
      priorityRank: totalImpact > 5 ? 1 : totalImpact > 2 ? 2 : 3,
    };
  }

  /**
   * Get compliance summary across all frameworks for a tenant.
   */
  async getComplianceSummary(tenantId: string): Promise<Array<{
    framework: string;
    score: number;
    passCount: number;
    failCount: number;
    lastScanned: Date;
  }>> {
    const scores = await this.db
      .select()
      .from(complianceScores)
      .where(eq(complianceScores.tenantId, tenantId))
      .orderBy(desc(complianceScores.snapshotAt))
      .limit(50);

    const latest = new Map<string, typeof scores[0]>();
    for (const s of scores) {
      if (!latest.has(s.framework)) {
        latest.set(s.framework, s);
      }
    }

    return Array.from(latest.values()).map((s) => ({
      framework: s.framework,
      score: s.score,
      passCount: s.passCount,
      failCount: s.failCount,
      lastScanned: s.snapshotAt,
    }));
  }
}
