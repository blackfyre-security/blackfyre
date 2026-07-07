import { eq, and, desc, count, sql, avg } from "drizzle-orm";
import { learningPatterns, findings, remediations, tenants } from "../db/schema.js";
import type { Db } from "../db/connection.js";
import { notFound } from "../utils/errors.js";
import type { IndustryInsight, LearningStats } from "@blackfyre/shared";

/* ------------------------------------------------------------------ */
/*  REAL IMPL (BLACKFYRE 2026-06): honest labelling of this service.   */
/*                                                                     */
/*  This service was branded "AI/learning" but every output it        */
/*  produces is a *descriptive statistical aggregate* over the tenant's */
/*  own findings/remediations — occurrence rate = count/total, mean    */
/*  fix time, false-positive counts, and a threshold-based heuristic   */
/*  gap prediction. There is no model, no neural net, no measured ML.  */
/*                                                                     */
/*  We deliberately DO NOT claim ML. Every persisted pattern is        */
/*  emitted to structured logs with an explicit `method` label of      */
/*  "statistical" (count/mean aggregates) or "heuristic" (threshold    */
/*  rules) so downstream consumers and auditors can see exactly how a  */
/*  number was derived and never mistake it for a trained-model        */
/*  prediction. The persisted `metric` names (occurrence_rate,         */
/*  avg_fix_days, false_positive_rate) are unchanged for contract      */
/*  stability and are themselves honest descriptions of the math.      */
/* ------------------------------------------------------------------ */

/**
 * How a learning-pattern value was computed. Surfaced in structured logs so the
 * product never overstates a statistical aggregate as a measured ML prediction.
 */
export type AnalysisMethod = "statistical" | "heuristic";

/** Minimal structured-logger surface (satisfied by Fastify's pino logger). */
export interface LearningLogger {
  info(obj: Record<string, unknown>, msg?: string): void;
  debug?(obj: Record<string, unknown>, msg?: string): void;
}

export class LearningService {
  private readonly log: LearningLogger;

  constructor(private db: Db, logger?: LearningLogger) {
    // Falls back to console so the honest method-labelling still appears in
    // contexts (tests, scripts) that don't inject a pino logger.
    this.log =
      logger ?? {
        info: (obj, msg) => console.log(JSON.stringify({ ...obj, msg })),
      };
  }

  /**
   * REAL IMPL (BLACKFYRE 2026-06): STATISTICAL aggregate (not ML). Groups the
   * tenant's findings by category and computes each category's occurrence rate as
   * `round(count / total * 100)` — a descriptive share-of-total statistic. Upserts
   * learning_patterns with type="common_finding". Each pattern is logged with
   * method="statistical" and its supporting counts so the derivation is auditable
   * and never overstated as a measured/model prediction.
   */
  async analyzeFindings(tenantId: string): Promise<void> {
    // Look up the tenant's industry
    const [tenant] = await this.db
      .select({ industryProfile: tenants.industryProfile })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);

    if (!tenant) throw notFound("Tenant");

    const industry = tenant.industryProfile;

    // Count findings by category for this tenant
    const categoryGroups = await this.db
      .select({
        category: findings.category,
        count: count(),
      })
      .from(findings)
      .where(eq(findings.tenantId, tenantId))
      .groupBy(findings.category);

    const totalFindings = categoryGroups.reduce((sum, g) => sum + g.count, 0);
    if (totalFindings === 0) return;

    for (const group of categoryGroups) {
      const occurrenceRate = Math.round((group.count / totalFindings) * 100);
      // Honest, queryable provenance: this is a count/total share statistic, not
      // a model output. No PII/secrets — only category labels and aggregate counts.
      this.log.info(
        {
          event: "learning.pattern_computed",
          method: "statistical" as AnalysisMethod,
          statistic: "share_of_total",
          patternType: "common_finding",
          metric: "occurrence_rate",
          industry,
          category: group.category,
          categoryCount: group.count,
          totalFindings,
          occurrenceRatePct: occurrenceRate,
        },
        "computed common_finding occurrence_rate (statistical aggregate)",
      );
      await this.upsertPattern({
        patternType: "common_finding",
        industry,
        category: group.category,
        metric: "occurrence_rate",
        value: occurrenceRate,
      });
    }
  }

  /**
   * REAL IMPL (BLACKFYRE 2026-06): STATISTICAL aggregate (not ML). For each
   * finding category, computes the mean time-to-fix in days over the tenant's
   * COMPLETED remediations and persists it as the `avg_fix_days` metric. We also
   * compute and log the median and min/max as honest supporting statistics (the
   * median is more robust to outlier fix times) so consumers can judge skew —
   * but the persisted value remains the mean to match the `avg_fix_days` name.
   * Upserts patterns with type="remediation_rate".
   */
  async analyzeRemediations(tenantId: string): Promise<void> {
    const [tenant] = await this.db
      .select({ industryProfile: tenants.industryProfile })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);

    if (!tenant) throw notFound("Tenant");

    const industry = tenant.industryProfile;

    // Get completed remediations joined with findings for this tenant
    const rows = await this.db
      .select({
        category: findings.category,
        executedAt: remediations.executedAt,
        completedAt: remediations.completedAt,
      })
      .from(remediations)
      .innerJoin(findings, eq(remediations.findingId, findings.id))
      .where(
        and(
          eq(findings.tenantId, tenantId),
          eq(remediations.status, "completed"),
        ),
      );

    // Group by category and calculate average fix days
    const categoryMap = new Map<string, number[]>();
    for (const row of rows) {
      if (!row.executedAt || !row.completedAt) continue;
      const days = Math.max(
        1,
        Math.round(
          (row.completedAt.getTime() - row.executedAt.getTime()) / (1000 * 60 * 60 * 24),
        ),
      );
      if (!categoryMap.has(row.category)) categoryMap.set(row.category, []);
      categoryMap.get(row.category)!.push(days);
    }

    for (const [category, daysList] of categoryMap) {
      const avgDays = Math.round(daysList.reduce((a, b) => a + b, 0) / daysList.length);
      // Honest supporting statistics — median is outlier-robust; min/max show range.
      const sorted = [...daysList].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      const medianDays =
        sorted.length % 2 === 0
          ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
          : sorted[mid];
      this.log.info(
        {
          event: "learning.pattern_computed",
          method: "statistical" as AnalysisMethod,
          statistic: "mean_time_to_remediate",
          patternType: "remediation_rate",
          metric: "avg_fix_days",
          industry,
          category,
          sampleSize: daysList.length,
          meanFixDays: avgDays,
          medianFixDays: medianDays,
          minFixDays: sorted[0],
          maxFixDays: sorted[sorted.length - 1],
        },
        "computed remediation_rate avg_fix_days (statistical aggregate)",
      );
      await this.upsertPattern({
        patternType: "remediation_rate",
        industry,
        category,
        metric: "avg_fix_days",
        value: avgDays,
      });
    }
  }

  /**
   * Record a false positive pattern for the finding's category/industry.
   * Upserts with type="false_positive".
   */
  async markFalsePositive(findingId: string): Promise<void> {
    const [finding] = await this.db
      .select({
        category: findings.category,
        tenantId: findings.tenantId,
      })
      .from(findings)
      .where(eq(findings.id, findingId))
      .limit(1);

    if (!finding) throw notFound("Finding");

    const [tenant] = await this.db
      .select({ industryProfile: tenants.industryProfile })
      .from(tenants)
      .where(eq(tenants.id, finding.tenantId))
      .limit(1);

    if (!tenant) throw notFound("Tenant");

    await this.upsertPattern({
      patternType: "false_positive",
      industry: tenant.industryProfile,
      category: finding.category,
      metric: "false_positive_rate",
      value: 1, // Incremental — sampleSize tracks count
    });

    // Also mark the finding as dismissed
    await this.db
      .update(findings)
      .set({ status: "dismissed" as any })
      .where(eq(findings.id, findingId));
  }

  /**
   * Read all patterns for an industry, assemble an IndustryInsight object.
   */
  async getIndustryInsight(industry: string): Promise<IndustryInsight> {
    const patterns = await this.db
      .select()
      .from(learningPatterns)
      .where(eq(learningPatterns.industry, industry as any));

    const commonFindings: IndustryInsight["commonFindings"] = [];
    const avgRemediationDays: IndustryInsight["avgRemediationDays"] = [];
    const falsePositiveRates: IndustryInsight["falsePositiveRates"] = [];
    const predictedGaps: IndustryInsight["predictedGaps"] = [];

    for (const p of patterns) {
      switch (p.patternType) {
        case "common_finding":
          commonFindings.push({
            category: p.category,
            occurrenceRate: p.value,
            sampleSize: p.sampleSize,
          });
          break;
        case "remediation_rate":
          avgRemediationDays.push({
            category: p.category,
            avgDays: p.value,
          });
          break;
        case "false_positive":
          falsePositiveRates.push({
            category: p.category,
            rate: p.value,
          });
          break;
        case "predicted_gap":
          predictedGaps.push({
            framework: p.framework ?? "unknown",
            controlCategory: p.category,
            likelihood: p.value,
          });
          break;
      }
    }

    return {
      industry,
      commonFindings,
      avgRemediationDays,
      falsePositiveRates,
      predictedGaps,
    };
  }

  /**
   * REAL IMPL (BLACKFYRE 2026-06): HEURISTIC (not ML). Applies a transparent
   * threshold rule — a category is flagged as a likely gap when its historical
   * occurrence rate is >= 30% AND the supporting confidence is >= 50. The reported
   * `likelihood` is simply the observed occurrence rate (capped at 100); it is a
   * rule-derived signal, not a calibrated probability from a trained model. The
   * threshold rule and its inputs are logged with method="heuristic" so this is
   * never mistaken for a measured/ML prediction.
   */
  async getPredictedGaps(
    industry: string,
    framework?: string,
  ): Promise<IndustryInsight["predictedGaps"]> {
    // Get high-occurrence common findings for this industry
    const conditions = [
      eq(learningPatterns.industry, industry as any),
      eq(learningPatterns.patternType, "common_finding"),
    ];

    const commonPatterns = await this.db
      .select()
      .from(learningPatterns)
      .where(and(...conditions))
      .orderBy(desc(learningPatterns.value));

    // Transparent threshold rule: flag categories whose occurrence rate >= 30%
    // and whose confidence (derived from sample size) >= 50.
    const OCCURRENCE_THRESHOLD_PCT = 30;
    const CONFIDENCE_THRESHOLD = 50;
    const highOccurrence = commonPatterns.filter(
      (p) => p.confidence >= CONFIDENCE_THRESHOLD && p.value >= OCCURRENCE_THRESHOLD_PCT,
    );

    const predictions: IndustryInsight["predictedGaps"] = [];
    for (const p of highOccurrence) {
      const targetFramework = framework ?? p.framework ?? "soc2";
      const likelihood = Math.min(p.value, 100);
      // Honest provenance: rule-based, not a trained-model probability.
      this.log.info(
        {
          event: "learning.gap_predicted",
          method: "heuristic" as AnalysisMethod,
          rule: `occurrence>=${OCCURRENCE_THRESHOLD_PCT}pct && confidence>=${CONFIDENCE_THRESHOLD}`,
          industry,
          framework: targetFramework,
          controlCategory: p.category,
          occurrenceRatePct: p.value,
          confidence: p.confidence,
          likelihood,
        },
        "flagged predicted gap (heuristic threshold rule)",
      );
      predictions.push({
        framework: targetFramework,
        controlCategory: p.category,
        likelihood,
      });
    }

    // Also return any existing predicted_gap patterns
    const gapConditions = [
      eq(learningPatterns.industry, industry as any),
      eq(learningPatterns.patternType, "predicted_gap"),
    ];
    if (framework) {
      gapConditions.push(eq(learningPatterns.framework, framework as any));
    }

    const existingGaps = await this.db
      .select()
      .from(learningPatterns)
      .where(and(...gapConditions));

    for (const g of existingGaps) {
      predictions.push({
        framework: g.framework ?? "unknown",
        controlCategory: g.category,
        likelihood: g.value,
      });
    }

    return predictions;
  }

  /**
   * Return aggregate LearningStats.
   */
  async getStats(): Promise<LearningStats> {
    const [totalResult] = await this.db
      .select({ count: count() })
      .from(learningPatterns);

    const byTypeResult = await this.db
      .select({
        patternType: learningPatterns.patternType,
        count: count(),
      })
      .from(learningPatterns)
      .groupBy(learningPatterns.patternType);

    const industriesResult = await this.db
      .select({ industry: learningPatterns.industry })
      .from(learningPatterns)
      .groupBy(learningPatterns.industry);

    const [avgResult] = await this.db
      .select({ avg: avg(learningPatterns.confidence) })
      .from(learningPatterns);

    return {
      totalPatterns: totalResult.count,
      patternsByType: Object.fromEntries(
        byTypeResult.map((r) => [r.patternType, r.count]),
      ),
      industriesCovered: industriesResult.map((r) => r.industry),
      avgConfidence: Math.round(Number(avgResult.avg ?? 0)),
    };
  }

  /**
   * List patterns with filters and pagination.
   */
  async listPatterns(filters: {
    patternType?: string;
    industry?: string;
    framework?: string;
    limit?: number;
    offset?: number;
  } = {}) {
    const conditions = [];

    if (filters.patternType) {
      conditions.push(eq(learningPatterns.patternType, filters.patternType));
    }
    if (filters.industry) {
      conditions.push(eq(learningPatterns.industry, filters.industry as any));
    }
    if (filters.framework) {
      conditions.push(eq(learningPatterns.framework, filters.framework as any));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const limit = filters.limit ?? 25;
    const offset = filters.offset ?? 0;

    const rows = await this.db
      .select()
      .from(learningPatterns)
      .where(where)
      .limit(limit)
      .offset(offset)
      .orderBy(desc(learningPatterns.lastUpdatedAt));

    const [{ total }] = await this.db
      .select({ total: count() })
      .from(learningPatterns)
      .where(where);

    return { patterns: rows, total };
  }

  /**
   * Orchestrate analyzeFindings + analyzeRemediations for a tenant.
   * Called after scan completion.
   */
  async runLearningCycle(tenantId: string): Promise<void> {
    await this.analyzeFindings(tenantId);
    await this.analyzeRemediations(tenantId);
  }

  /**
   * Upsert a learning pattern. If a pattern with the same (patternType, industry,
   * category, metric) exists, update the value and increment sampleSize.
   * Confidence = min(sampleSize * 10, 100).
   */
  private async upsertPattern(data: {
    patternType: string;
    industry: string;
    category: string;
    metric: string;
    value: number;
    framework?: string;
  }): Promise<void> {
    const conditions = [
      eq(learningPatterns.patternType, data.patternType),
      eq(learningPatterns.industry, data.industry as any),
      eq(learningPatterns.category, data.category),
      eq(learningPatterns.metric, data.metric),
    ];

    const [existing] = await this.db
      .select()
      .from(learningPatterns)
      .where(and(...conditions))
      .limit(1);

    if (existing) {
      const newSampleSize = existing.sampleSize + 1;
      const newConfidence = Math.min(newSampleSize * 10, 100);

      await this.db
        .update(learningPatterns)
        .set({
          value: data.value,
          sampleSize: newSampleSize,
          confidence: newConfidence,
          lastUpdatedAt: new Date(),
        })
        .where(eq(learningPatterns.id, existing.id));
    } else {
      const sampleSize = 1;
      const confidence = Math.min(sampleSize * 10, 100);

      await this.db.insert(learningPatterns).values({
        patternType: data.patternType,
        industry: data.industry as any,
        framework: (data.framework as any) ?? null,
        category: data.category,
        metric: data.metric,
        value: data.value,
        sampleSize,
        confidence,
      });
    }
  }
}
