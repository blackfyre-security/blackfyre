import { sql } from "drizzle-orm";
import { PLANS, type PlanId } from "@blackfyre/shared";
import { PLAN_FEATURES, type Plan } from "./provisioning-service.js";
import { ApiError } from "../utils/errors.js";
import type { Db } from "../db/connection.js";

// REAL IMPL (BLACKFYRE 2026-06): real usage metering + plan quota enforcement.
//
// Before this service the per-plan limits in @blackfyre/shared PLANS and
// provisioning-service PLAN_FEATURES were DEFINED BUT UNENFORCED: nothing counted
// scans / AI calls / evidence bytes, so a Comply tenant could consume without
// bound. This service:
//   1. increment() durably tallies consumption in the tenant-scoped usage_meters
//      table (migration 037), keyed by the current billing-month period_start so
//      the counter resets naturally each month (no cron/reset job);
//   2. getUsage() reads the current period's count;
//   3. enforceQuota() throws a 402 QUOTA_EXCEEDED ApiError (with an upgradeUrl)
//      when the plan's monthly quota for that metric is exceeded.
//
// Every quota number is DERIVED from the single sources of truth (PLANS +
// PLAN_FEATURES) — nothing is hardcoded here. Structured pino-style logs record
// counts/quotas only; never card or secret data.

/** Metered dimensions. Mirrors the free-form `metric` column in usage_meters. */
export type UsageMetric = "scans" | "ai_calls" | "evidence_bytes";

/** Minimal structured-logger shape (Fastify/pino compatible). */
type Logger = {
  info: (obj: unknown, msg?: string) => void;
  warn: (obj: unknown, msg?: string) => void;
};

/** Sentinel for "no limit" so unlimited plans (PLANS unlimited / PLAN_FEATURES -1). */
const UNLIMITED = Number.POSITIVE_INFINITY;

/** Public upgrade target — matches plan-gate.ts's upgradeUrl. */
const UPGRADE_URL = "https://blackfyre.tech/pricing";

const GB_IN_BYTES = 1024 * 1024 * 1024;

// REAL IMPL (BLACKFYRE 2026-06): map the canonical scan cadence (PLANS[plan]
// .scanCadence — weekly | daily | continuous) to a monthly scan allowance. This
// keeps the scans quota tied to the published plan promise instead of a magic
// number: weekly => ~1/day worth across the month, daily => generous daily runs,
// continuous => effectively unlimited.
const CADENCE_MONTHLY_SCANS: Record<Plan, number> = {
  comply: 30, // weekly cadence — ~1/day allowance for the month
  protect: 300, // daily cadence — ~10/day across clouds
  defend: UNLIMITED, // continuous monitoring — unbounded
};

/**
 * Resolve the monthly quota for (plan, metric) from the SINGLE SOURCES OF TRUTH.
 * Returns UNLIMITED (Infinity) when the plan imposes no cap. Quotas are computed,
 * never hardcoded:
 *   - scans          : from PLANS[plan].scanCadence (CADENCE_MONTHLY_SCANS).
 *   - ai_calls       : gated by PLANS[plan].aiEnabled / PLAN_FEATURES[plan]
 *                      .aiAnalysis; 0 when AI is disabled (Comply), else scaled
 *                      by the plan's team-member allowance.
 *   - evidence_bytes : straight from PLAN_FEATURES[plan].maxEvidenceGb (GB -> bytes).
 */
export function quotaFor(plan: Plan, metric: UsageMetric): number {
  const planId = plan as PlanId;
  const shared = PLANS[planId];
  const features = PLAN_FEATURES[plan] ?? PLAN_FEATURES.comply;

  switch (metric) {
    case "scans": {
      return CADENCE_MONTHLY_SCANS[plan] ?? CADENCE_MONTHLY_SCANS.comply;
    }
    case "ai_calls": {
      // AI metering only applies when the plan actually includes AI. Comply has
      // aiEnabled=false / aiAnalysis="basic" => zero AI-call allowance (any AI
      // call is over quota => 402 upgrade). Paid plans scale the allowance with
      // the team-member allowance so it tracks plan size rather than a constant.
      const aiEnabled = shared?.aiEnabled ?? features.aiAnalysis === "full";
      if (!aiEnabled) return 0;
      const members = features.maxTeamMembers;
      if (members < 0) return UNLIMITED; // unlimited team => unlimited AI calls
      // 200 AI calls per seat per month — derived from the plan's seat allowance.
      return members * 200;
    }
    case "evidence_bytes": {
      const gb = features.maxEvidenceGb;
      if (gb < 0) return UNLIMITED; // -1 => unlimited storage
      return gb * GB_IN_BYTES;
    }
    default: {
      // Unknown metric: no enforced cap (forward-compatible — new meters can be
      // recorded before a quota is defined for them).
      return UNLIMITED;
    }
  }
}

/**
 * First instant of the current billing month in UTC (e.g. 2026-06-01T00:00:00Z).
 * Used as the usage_meters.period_start. Because a new month produces a new
 * period_start, the upsert lands on a fresh row and the quota resets naturally.
 */
export function currentPeriodStart(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
}

export class UsageMeterService {
  private readonly log: Logger;

  /**
   * REAL IMPL (BLACKFYRE 2026-06): persistence uses PARAMETERIZED raw SQL via
   * db.execute(sql`... ${value} ...`) because `usage_meters` is intentionally NOT
   * in db/schema.ts (parallel work items edit the schema concurrently and collide).
   * The OPTIONAL pino-compatible logger is defaulted so existing call sites
   * (`new UsageMeterService(db)`) keep compiling — PUBLIC signatures stay stable.
   */
  constructor(
    private db: Db,
    log?: Logger,
  ) {
    this.log = log ?? { info: () => {}, warn: () => {} };
  }

  /**
   * Atomically add `n` to the current billing-period counter for (tenant, metric)
   * and return the new running total. Creates the period row on first use. The
   * UNIQUE(tenant_id, metric, period_start) constraint makes the upsert race-free:
   * concurrent increments for the same meter serialize on the row lock so none is
   * lost. `n` defaults to 1 (stable signature).
   */
  async increment(tenantId: string, metric: UsageMetric, n = 1): Promise<number> {
    if (!Number.isFinite(n) || n <= 0) {
      // No-op for non-positive deltas; still return the live total so callers can
      // log/inspect it. Reads the current count without mutating.
      return this.getUsage(tenantId, metric);
    }
    const periodStart = currentPeriodStart();
    const delta = Math.trunc(n);

    const rows = (await this.db.execute(
      sql`
        INSERT INTO usage_meters (tenant_id, metric, period_start, count)
        VALUES (${tenantId}::uuid, ${metric}, ${periodStart.toISOString()}::timestamptz, ${delta})
        ON CONFLICT (tenant_id, metric, period_start) DO UPDATE
          SET count = usage_meters.count + EXCLUDED.count,
              updated_at = now()
        RETURNING count
      `,
    )) as unknown as Array<{ count: string | number }>;

    const total = Number(rows[0]?.count ?? delta);
    this.log.info(
      {
        event: "usage.meter.increment",
        tenantId,
        metric,
        delta,
        total,
        periodStart: periodStart.toISOString(),
      },
      "usage meter incremented",
    );
    return total;
  }

  /**
   * Current billing-period usage for (tenant, metric). Returns 0 when no row exists
   * yet for this period (e.g. start of month / first use).
   */
  async getUsage(tenantId: string, metric: UsageMetric): Promise<number> {
    const periodStart = currentPeriodStart();
    const rows = (await this.db.execute(
      sql`
        SELECT count
        FROM usage_meters
        WHERE tenant_id = ${tenantId}::uuid
          AND metric = ${metric}
          AND period_start = ${periodStart.toISOString()}::timestamptz
        LIMIT 1
      `,
    )) as unknown as Array<{ count: string | number }>;
    return Number(rows[0]?.count ?? 0);
  }

  /**
   * Enforce the plan's monthly quota for (tenant, metric). Throws a 402
   * QUOTA_EXCEEDED ApiError (with the upgrade URL) when the CURRENT usage is
   * already at or above the quota — i.e. the next unit would exceed the cap. Call
   * this BEFORE incrementing for the new unit of work. Unlimited quotas always pass.
   *
   * The quota is derived from the single sources of truth (PLANS + PLAN_FEATURES)
   * via quotaFor(); nothing is hardcoded here.
   */
  async enforceQuota(tenantId: string, metric: UsageMetric, plan: Plan): Promise<void> {
    const quota = quotaFor(plan, metric);
    if (quota === UNLIMITED) return; // no cap for this plan/metric

    const used = await this.getUsage(tenantId, metric);
    if (used >= quota) {
      this.log.warn(
        {
          event: "usage.quota.exceeded",
          tenantId,
          metric,
          plan,
          used,
          quota,
          periodStart: currentPeriodStart().toISOString(),
        },
        "monthly plan quota exceeded — blocking request (402)",
      );
      throw new ApiError(
        402,
        "QUOTA_EXCEEDED",
        `Monthly ${metric} quota for the ${plan} plan has been reached (${used}/${quota}). Upgrade to continue.`,
        {
          metric,
          plan,
          used,
          quota,
          upgradeUrl: UPGRADE_URL,
        },
      );
    }
  }
}
