import type { ControlDefinition, FrameworkScore } from "@blackfyre/shared";
import type { ControlStatus } from "@blackfyre/shared";

type StatusInput = ControlStatus | "na";

const PARTIAL_CREDIT = 0.5;

// REAL IMPL (BLACKFYRE 2026-06): finding priority formula (GAP-003).
// The spec ranks findings by priority = severity x exploitability x
// compliance_impact, but only `severity` was ever stored. The two functions
// below make the formula real and deterministic so it can be computed at write
// time (services/finding-service.ts) AND re-derived for legacy rows on read.

// Severity -> numeric weight. Monotonic with the severity enum order so that,
// holding the other two factors equal, a more severe finding always ranks
// higher. `info` is intentionally a small positive (not 0) so an info finding
// with high exploitability/impact is not silently zeroed out of ranking.
const SEVERITY_WEIGHT: Record<string, number> = {
  critical: 5,
  high: 4,
  medium: 3,
  low: 2,
  info: 1,
};

// Sensible neutral defaults for rows persisted before migration 042 added the
// exploitability / compliance_impact columns (NULL in the DB). Using the mid
// point of the 1..5 scale keeps legacy rows ranking by severity alone without
// over- or under-stating the two unknown factors.
export const EXPLOITABILITY_DEFAULT = 3;
export const COMPLIANCE_IMPACT_DEFAULT = 3;

const FACTOR_MIN = 1;
const FACTOR_MAX = 5;

/** Clamp an arbitrary number into the 1..5 factor scale (integer). */
export function clampFactor(value: number): number {
  if (!Number.isFinite(value)) return FACTOR_MIN;
  return Math.max(FACTOR_MIN, Math.min(FACTOR_MAX, Math.round(value)));
}

export interface FindingPriorityFactors {
  severity: string;
  /** 1..5; null/undefined => EXPLOITABILITY_DEFAULT (legacy rows). */
  exploitability?: number | null;
  /** 1..5; null/undefined => COMPLIANCE_IMPACT_DEFAULT (legacy rows). */
  complianceImpact?: number | null;
}

/**
 * REAL IMPL (BLACKFYRE 2026-06): compute a finding's priority score from the
 * three spec factors: priority = severityWeight x exploitability x
 * complianceImpact.
 *
 * - severity maps through SEVERITY_WEIGHT (unknown severity => lowest weight 1).
 * - exploitability / complianceImpact are clamped to 1..5; a null/undefined
 *   factor (a pre-042 row that never had the column derived) falls back to its
 *   neutral default so legacy rows still produce a stable, sensible score.
 *
 * Range: 1 (info x 1 x 1) .. 125 (critical x 5 x 5). Returned to two decimals so
 * it slots straight into the numeric(8,2) priority_score column.
 */
export function calculateFindingPriority(factors: FindingPriorityFactors): number {
  const severityWeight = SEVERITY_WEIGHT[factors.severity] ?? FACTOR_MIN;
  const exploitability = clampFactor(
    factors.exploitability ?? EXPLOITABILITY_DEFAULT,
  );
  const complianceImpact = clampFactor(
    factors.complianceImpact ?? COMPLIANCE_IMPACT_DEFAULT,
  );

  const score = severityWeight * exploitability * complianceImpact;
  // Round to 2dp to match numeric(8,2). All inputs are integers today, so this
  // is exact, but keeping the round guards future fractional factors.
  return Math.round(score * 100) / 100;
}

/**
 * Calculate a weighted compliance score for a framework.
 *
 * Each control has weight 1-3 (standard, important, critical).
 * - pass    => full weight credit
 * - partial => 50% weight credit
 * - fail    => 0 credit (a real, evaluated failure)
 * - na      => excluded from scoring entirely
 * - missing from statusMap => treated as NOT EVALUATED (0 credit, still counts
 *   toward total weight so an unscanned framework reads as low, but is NOT a failure)
 *
 * The returned object is a {@link FrameworkScore} plus an additive
 * `notEvaluatedCount` so callers can distinguish "we checked it and it failed"
 * from "we never looked at it". This is a superset of FrameworkScore, so all
 * existing consumers keep working unchanged.
 */
export function calculateFrameworkScore(
  framework: string,
  controls: ControlDefinition[],
  statusMap: Map<string, StatusInput>,
): FrameworkScore & { notEvaluatedCount: number } {
  let totalWeight = 0;
  let earnedWeight = 0;
  let passCount = 0;
  let partialCount = 0;
  let failCount = 0;
  let naCount = 0;
  let notEvaluatedCount = 0;
  let evaluatedControls = 0;

  for (const control of controls) {
    const status = statusMap.get(control.controlId);

    if (status === "na") {
      naCount++;
      continue;
    }

    totalWeight += control.weight;

    if (status === "pass") {
      earnedWeight += control.weight;
      passCount++;
      evaluatedControls++;
    } else if (status === "partial") {
      earnedWeight += control.weight * PARTIAL_CREDIT;
      partialCount++;
      evaluatedControls++;
    } else if (status === "fail") {
      // Real, evaluated failure — 0 credit and counts as a failure.
      failCount++;
      evaluatedControls++;
    } else {
      // SECURITY FIX (BLACKFYRE audit 2026-06-05): inflated failCount —
      // controls missing from statusMap were previously bucketed into failCount,
      // so an un-scanned control was reported to the user as a compliance FAILURE.
      // That over-states risk/non-compliance (and could drive bad remediation
      // spend or false audit signals). Not-evaluated controls now have their own
      // counter and are excluded from pass/fail; they still consume totalWeight so
      // the % score stays conservative for unscanned coverage.
      notEvaluatedCount++;
    }
  }

  const score = totalWeight > 0 ? Math.round((earnedWeight / totalWeight) * 100) : 0;

  return {
    framework: framework as any,
    score,
    passCount,
    partialCount,
    failCount,
    naCount,
    notEvaluatedCount,
    totalControls: controls.length,
    evaluatedControls,
  };
}
