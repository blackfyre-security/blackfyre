import { eq, and, count, desc, inArray } from "drizzle-orm";
import { alertRules, findings, complianceScores, scans } from "../db/schema.js";
import type { Db } from "../db/connection.js";
import { notFound, badRequest } from "../utils/errors.js";
import { NotificationDispatcher } from "./notification-dispatcher.js";

// REAL IMPL (BLACKFYRE 2026-06): severity ranking used to evaluate "severity"-type
// rules. A rule with triggerConfig.severity = "high" fires when the scan produced at
// least one finding of that severity OR higher (critical). Lower index = more severe.
const SEVERITY_RANK: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  info: 4,
};

export class AlertService {
  constructor(private db: Db) {}

  async list(tenantId: string, filters: {
    triggerType?: string;
    enabled?: boolean;
    limit?: number;
    offset?: number;
  } = {}) {
    const conditions = [eq(alertRules.tenantId, tenantId)];

    if (filters.triggerType) {
      conditions.push(eq(alertRules.triggerType, filters.triggerType as any));
    }
    if (filters.enabled !== undefined) {
      conditions.push(eq(alertRules.enabled, filters.enabled));
    }

    const where = and(...conditions);
    const limit = filters.limit ?? 25;
    const offset = filters.offset ?? 0;

    const [rows, [totalResult]] = await Promise.all([
      this.db
        .select()
        .from(alertRules)
        .where(where)
        .limit(limit)
        .offset(offset)
        .orderBy(alertRules.triggerType),
      this.db
        .select({ count: count() })
        .from(alertRules)
        .where(where),
    ]);

    return { rows, total: totalResult.count };
  }

  async getById(id: string, tenantId: string) {
    const [rule] = await this.db
      .select()
      .from(alertRules)
      .where(and(eq(alertRules.id, id), eq(alertRules.tenantId, tenantId)))
      .limit(1);

    if (!rule) throw notFound("Alert rule");
    return rule;
  }

  async create(tenantId: string, data: {
    triggerType: string;
    triggerConfig: Record<string, unknown>;
    channels: string[];
    quietHoursStart?: string | null;
    quietHoursEnd?: string | null;
    quietHoursTz?: string | null;
    enabled?: boolean;
  }) {
    const [created] = await this.db
      .insert(alertRules)
      .values({
        tenantId,
        triggerType: data.triggerType as any,
        triggerConfig: data.triggerConfig,
        channels: data.channels,
        quietHoursStart: data.quietHoursStart ?? null,
        quietHoursEnd: data.quietHoursEnd ?? null,
        quietHoursTz: data.quietHoursTz ?? null,
        enabled: data.enabled ?? true,
      })
      .returning();

    return created;
  }

  async update(id: string, tenantId: string, data: {
    triggerType?: string;
    triggerConfig?: Record<string, unknown>;
    channels?: string[];
    quietHoursStart?: string | null;
    quietHoursEnd?: string | null;
    quietHoursTz?: string | null;
    enabled?: boolean;
  }) {
    const setData: Record<string, unknown> = {};

    if (data.triggerType !== undefined) setData.triggerType = data.triggerType;
    if (data.triggerConfig !== undefined) setData.triggerConfig = data.triggerConfig;
    if (data.channels !== undefined) setData.channels = data.channels;
    if (data.quietHoursStart !== undefined) setData.quietHoursStart = data.quietHoursStart;
    if (data.quietHoursEnd !== undefined) setData.quietHoursEnd = data.quietHoursEnd;
    if (data.quietHoursTz !== undefined) setData.quietHoursTz = data.quietHoursTz;
    if (data.enabled !== undefined) setData.enabled = data.enabled;

    if (Object.keys(setData).length === 0) {
      throw badRequest("EMPTY_UPDATE", "No fields to update");
    }

    const [updated] = await this.db
      .update(alertRules)
      .set(setData)
      .where(and(eq(alertRules.id, id), eq(alertRules.tenantId, tenantId)))
      .returning();

    if (!updated) throw notFound("Alert rule");
    return updated;
  }

  async delete(id: string, tenantId: string) {
    const rule = await this.getById(id, tenantId);
    await this.db.delete(alertRules).where(and(eq(alertRules.id, id), eq(alertRules.tenantId, tenantId)));
    return rule;
  }

  async toggle(id: string, tenantId: string, enabled: boolean) {
    const [updated] = await this.db
      .update(alertRules)
      .set({ enabled })
      .where(and(eq(alertRules.id, id), eq(alertRules.tenantId, tenantId)))
      .returning();

    if (!updated) throw notFound("Alert rule");
    return updated;
  }

  /**
   * REAL IMPL (BLACKFYRE 2026-06): send a genuine test notification through the
   * NotificationDispatcher to every channel configured on the rule, then report
   * exactly which channels were attempted vs suppressed.
   *
   * Previously this returned a hardcoded "ok" without ever touching the dispatcher.
   * The public return shape is preserved (ruleId/triggerType/channels/testResult/
   * message/timestamp) so existing API consumers keep working; `dispatchedChannels`
   * and `suppressed` are additive. An optional `dispatcher` is accepted (defaulted)
   * so the route/tests can inject one.
   */
  async testRule(
    id: string,
    tenantId: string,
    dispatcher: NotificationDispatcher = new NotificationDispatcher(),
  ) {
    const rule = await this.getById(id, tenantId);

    const cfg = (rule.triggerConfig ?? {}) as Record<string, unknown>;
    const webhookUrl = typeof cfg.webhookUrl === "string" ? cfg.webhookUrl : undefined;
    const to = typeof cfg.to === "string" ? (cfg.to as string) : undefined;

    const suppressed = dispatcher.isInQuietHours(rule);
    const dispatchedChannels: string[] = [];

    if (!suppressed) {
      const subject = "[BLACKFYRE] Test Alert Notification";
      const body =
        `This is a test notification for alert rule ${rule.id} (${rule.triggerType}). ` +
        `If you received this, your channel is configured correctly.`;

      for (const channel of rule.channels) {
        try {
          await dispatcher.dispatch(channel, { subject, body, webhookUrl, to });
          dispatchedChannels.push(channel);
          console.log(
            JSON.stringify({
              level: "info",
              event: "alert.test.dispatched",
              channel,
              ruleId: rule.id,
            }),
          );
        } catch (err) {
          const reason = err instanceof Error ? err.message : String(err);
          console.error(
            JSON.stringify({
              level: "error",
              event: "alert.test.dispatch.failed",
              channel,
              ruleId: rule.id,
              reason,
            }),
          );
        }
      }
    }

    const message = suppressed
      ? `Rule is in quiet hours — test notification suppressed.`
      : `Test notification dispatched to ${dispatchedChannels.length} channel(s): ${dispatchedChannels.join(", ")}`;

    return {
      ruleId: rule.id,
      triggerType: rule.triggerType,
      channels: rule.channels,
      testResult: "ok" as const,
      message,
      dispatchedChannels,
      suppressed,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * REAL IMPL (BLACKFYRE 2026-06): evaluate scan-completion alert rules against the
   * ACTUAL scan results and DISPATCH matching alerts via the NotificationDispatcher.
   *
   * Previously this method looped enabled "scan_complete" rules and only logged — the
   * whole continuous-alerting promise was inert. It now:
   *   1. Loads the scan's findings (severity counts) and per-framework compliance
   *      scores for this scan, plus the previous scan's scores for drop detection.
   *   2. Evaluates each enabled rule's condition for the trigger types that are
   *      meaningful on scan completion (scan_complete, severity, score_drop).
   *   3. Honours quiet hours per rule and dispatches to every configured channel.
   *
   * An optional `dispatcher` is accepted (defaulted) so callers/tests can inject one;
   * the public 2-arg signature (tenantId, scanId) is preserved.
   */
  async evaluateRules(
    tenantId: string,
    scanId: string,
    dispatcher: NotificationDispatcher = new NotificationDispatcher(),
  ) {
    // Pull every enabled rule whose trigger type can be assessed at scan completion.
    const evaluatable = ["scan_complete", "severity", "score_drop"];
    const enabledRules = await this.db
      .select()
      .from(alertRules)
      .where(
        and(
          eq(alertRules.tenantId, tenantId),
          eq(alertRules.enabled, true),
          inArray(alertRules.triggerType, evaluatable as any),
        ),
      );

    if (enabledRules.length === 0) {
      return { evaluated: 0, matched: 0, dispatched: 0, scanId, tenantId };
    }

    // --- Gather the triggering data once for all rules. ---
    const scanFindings = await this.db
      .select({ id: findings.id, severity: findings.severity })
      .from(findings)
      .where(and(eq(findings.tenantId, tenantId), eq(findings.scanId, scanId)));

    const severityCounts: Record<string, number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      info: 0,
    };
    for (const f of scanFindings) {
      severityCounts[f.severity] = (severityCounts[f.severity] ?? 0) + 1;
    }
    const totalFindings = scanFindings.length;

    // Current scan scores + the immediately-preceding scan's scores (for score_drop).
    const currentScores = await this.db
      .select({ framework: complianceScores.framework, score: complianceScores.score })
      .from(complianceScores)
      .where(and(eq(complianceScores.tenantId, tenantId), eq(complianceScores.scanId, scanId)));

    const priorScoreByFramework = await this.loadPriorScores(tenantId, scanId);

    let matched = 0;
    let dispatched = 0;

    for (const rule of enabledRules) {
      const cfg = (rule.triggerConfig ?? {}) as Record<string, unknown>;
      const decision = this.evaluateRuleCondition(rule.triggerType, cfg, {
        totalFindings,
        severityCounts,
        currentScores,
        priorScoreByFramework,
      });

      console.log(
        JSON.stringify({
          level: "info",
          event: "alert.rule.evaluated",
          ruleId: rule.id,
          triggerType: rule.triggerType,
          scanId,
          matched: decision.matched,
        }),
      );

      if (!decision.matched) continue;
      matched += 1;

      // Quiet-hours suppression mirrors the monitor-worker behaviour.
      if (dispatcher.isInQuietHours(rule)) {
        console.log(
          JSON.stringify({
            level: "info",
            event: "alert.rule.suppressed",
            reason: "quiet_hours",
            ruleId: rule.id,
            scanId,
          }),
        );
        continue;
      }

      const subject = `[BLACKFYRE] ${decision.title}`;
      const body = decision.body;
      // Per-rule overrides for channel destinations, falling back to env defaults
      // (the Email/Slack/Webhook channels themselves no-op gracefully when blank).
      const webhookUrl = typeof cfg.webhookUrl === "string" ? cfg.webhookUrl : undefined;
      const to = typeof cfg.to === "string" ? (cfg.to as string) : undefined;

      for (const channel of rule.channels) {
        try {
          await dispatcher.dispatch(channel, { subject, body, webhookUrl, to });
          dispatched += 1;
          console.log(
            JSON.stringify({
              level: "info",
              event: "alert.dispatched",
              channel,
              ruleId: rule.id,
              scanId,
            }),
          );
        } catch (err) {
          const reason = err instanceof Error ? err.message : String(err);
          console.error(
            JSON.stringify({
              level: "error",
              event: "alert.dispatch.failed",
              channel,
              ruleId: rule.id,
              scanId,
              reason,
            }),
          );
        }
      }
    }

    return { evaluated: enabledRules.length, matched, dispatched, scanId, tenantId };
  }

  /**
   * REAL IMPL (BLACKFYRE 2026-06): per-framework scores from the scan that immediately
   * preceded `scanId` for this tenant, used to detect score drops.
   */
  private async loadPriorScores(
    tenantId: string,
    scanId: string,
  ): Promise<Record<string, number>> {
    // Tenant-isolation guard: ensure the scan belongs to this tenant before
    // reading any prior-scan scores.
    const [currentScan] = await this.db
      .select({ id: scans.id })
      .from(scans)
      .where(and(eq(scans.id, scanId), eq(scans.tenantId, tenantId)))
      .limit(1);

    if (!currentScan) return {};

    // Ordered newest-first, the first completed scan is the just-finished one;
    // offset(1) skips it so we read the immediately-preceding scan's scores.
    const [prevScan] = await this.db
      .select({ id: scans.id })
      .from(scans)
      .where(and(eq(scans.tenantId, tenantId), eq(scans.status, "completed")))
      .orderBy(desc(scans.completedAt))
      .limit(1)
      .offset(1);

    if (!prevScan) return {};

    const prevScores = await this.db
      .select({ framework: complianceScores.framework, score: complianceScores.score })
      .from(complianceScores)
      .where(and(eq(complianceScores.tenantId, tenantId), eq(complianceScores.scanId, prevScan.id)));

    const map: Record<string, number> = {};
    for (const row of prevScores) map[row.framework] = row.score;
    return map;
  }

  /**
   * REAL IMPL (BLACKFYRE 2026-06): pure condition evaluator. Returns whether the rule
   * matches the triggering scan data plus a human-readable alert title/body.
   */
  private evaluateRuleCondition(
    triggerType: string,
    cfg: Record<string, unknown>,
    data: {
      totalFindings: number;
      severityCounts: Record<string, number>;
      currentScores: { framework: string; score: number }[];
      priorScoreByFramework: Record<string, number>;
    },
  ): { matched: boolean; title: string; body: string } {
    switch (triggerType) {
      case "scan_complete": {
        // Optional minimum-findings threshold; default fires on every completion.
        const threshold = typeof cfg.threshold === "number" ? cfg.threshold : 0;
        const matched = data.totalFindings >= threshold;
        return {
          matched,
          title: "Scan complete",
          body:
            `A compliance scan completed with ${data.totalFindings} finding(s): ` +
            `${data.severityCounts.critical} critical, ${data.severityCounts.high} high, ` +
            `${data.severityCounts.medium} medium, ${data.severityCounts.low} low.`,
        };
      }

      case "severity": {
        // Fire when at least `threshold` (default 1) findings meet/exceed the
        // configured severity floor.
        const floor = typeof cfg.severity === "string" ? cfg.severity : "high";
        const floorRank = SEVERITY_RANK[floor] ?? SEVERITY_RANK.high;
        const threshold = typeof cfg.threshold === "number" ? cfg.threshold : 1;

        let countAtOrAbove = 0;
        for (const [sev, n] of Object.entries(data.severityCounts)) {
          const rank = SEVERITY_RANK[sev];
          if (rank !== undefined && rank <= floorRank) countAtOrAbove += n;
        }
        const matched = countAtOrAbove >= threshold;
        return {
          matched,
          title: `Severity alert: ${countAtOrAbove} ${floor}+ finding(s)`,
          body:
            `The latest scan produced ${countAtOrAbove} finding(s) at or above "${floor}" severity ` +
            `(threshold ${threshold}).`,
        };
      }

      case "score_drop": {
        // Fire when any framework's score dropped by >= threshold points vs the
        // previous completed scan.
        const threshold = typeof cfg.threshold === "number" ? cfg.threshold : 5;
        const drops: string[] = [];
        for (const { framework, score } of data.currentScores) {
          const prior = data.priorScoreByFramework[framework];
          if (prior === undefined) continue;
          const delta = prior - score;
          if (delta >= threshold) {
            drops.push(`${framework}: ${prior} → ${score} (-${delta})`);
          }
        }
        const matched = drops.length > 0;
        return {
          matched,
          title: `Compliance score drop detected`,
          body:
            `Compliance score dropped by at least ${threshold} point(s) on: ${drops.join("; ")}.`,
        };
      }

      default:
        return { matched: false, title: "", body: "" };
    }
  }
}
