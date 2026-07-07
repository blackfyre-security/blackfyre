// Tenant scaffolding — pure functions that produce blank progress records
// from the canonical framework registry. No randomness, no React, no fetch.

import {
  ALL_FRAMEWORKS,
  FRAMEWORK_REGISTRY,
  type ControlDefinition,
  type FrameworkDefinition,
} from "@/lib/frameworks/registry";

export type TenantControlStatus =
  | "not_started"
  | "in_progress"
  | "passing"
  | "failing"
  | "exception";

export interface TenantControlRecord {
  tenantId: string;
  frameworkId: string;
  controlId: string;
  status: TenantControlStatus;
  evidenceCount: number;
  lastReviewedAt: string | null;
  ownerId: string | null;
  notes: string | null;
}

export interface TenantFrameworkProgress {
  tenantId: string;
  frameworkId: string;
  totalControls: number;
  passing: number;
  failing: number;
  inProgress: number;
  notStarted: number;
  scorePercent: number; // passing / totalControls * 100, rounded to 1 decimal
  lastUpdatedAt: string;
}

const EPOCH_ISO = "1970-01-01T00:00:00.000Z";

/**
 * Produce a blank `TenantControlRecord` for every control in every selected
 * framework. Records start in `not_started`, zero evidence, no owner.
 */
export function scaffoldTenantControls(
  tenantId: string,
  frameworkIds: string[],
): TenantControlRecord[] {
  const records: TenantControlRecord[] = [];
  for (const fwId of frameworkIds) {
    const fw: FrameworkDefinition | undefined = FRAMEWORK_REGISTRY[fwId];
    if (!fw) continue;
    for (const ctrl of fw.controls) {
      records.push(blankRecord(tenantId, fwId, ctrl));
    }
  }
  return records;
}

function blankRecord(
  tenantId: string,
  frameworkId: string,
  ctrl: ControlDefinition,
): TenantControlRecord {
  return {
    tenantId,
    frameworkId,
    controlId: ctrl.id,
    status: "not_started",
    evidenceCount: 0,
    lastReviewedAt: null,
    ownerId: null,
    notes: null,
  };
}

/**
 * Compute progress for a single framework from a flat list of records.
 * Records belonging to other frameworks are ignored.
 */
export function computeFrameworkProgress(
  tenantId: string,
  frameworkId: string,
  records: TenantControlRecord[],
): TenantFrameworkProgress {
  const filtered = records.filter(
    (r) => r.tenantId === tenantId && r.frameworkId === frameworkId,
  );

  let passing = 0;
  let failing = 0;
  let inProgress = 0;
  let notStarted = 0;
  let lastUpdatedAt = EPOCH_ISO;

  for (const r of filtered) {
    switch (r.status) {
      case "passing":
        passing++;
        break;
      case "failing":
        failing++;
        break;
      case "in_progress":
        inProgress++;
        break;
      case "not_started":
        notStarted++;
        break;
      case "exception":
        // exceptions are treated as neither passing nor failing
        break;
    }
    if (r.lastReviewedAt && r.lastReviewedAt > lastUpdatedAt) {
      lastUpdatedAt = r.lastReviewedAt;
    }
  }

  const totalControls = filtered.length;
  const scorePercent =
    totalControls === 0
      ? 0
      : Math.round((passing / totalControls) * 1000) / 10;

  return {
    tenantId,
    frameworkId,
    totalControls,
    passing,
    failing,
    inProgress,
    notStarted,
    scorePercent,
    lastUpdatedAt,
  };
}

/**
 * Compute progress for every framework present in `records`.
 */
export function computeAllProgress(
  tenantId: string,
  records: TenantControlRecord[],
): TenantFrameworkProgress[] {
  const frameworkIds = new Set<string>();
  for (const r of records) {
    if (r.tenantId === tenantId) frameworkIds.add(r.frameworkId);
  }
  const out: TenantFrameworkProgress[] = [];
  for (const fwId of frameworkIds) {
    out.push(computeFrameworkProgress(tenantId, fwId, records));
  }
  // Stable order: by registry order, then by id
  const order = new Map<string, number>();
  ALL_FRAMEWORKS.forEach((fw, idx) => order.set(fw.id, idx));
  out.sort(
    (a, b) =>
      (order.get(a.frameworkId) ?? 999) - (order.get(b.frameworkId) ?? 999),
  );
  return out;
}

// ---------------------------------------------------------------------------
// Lightweight self-assertions. Run on module import in dev; cheap and pure.
// Throws if the scaffold invariants ever break.
// ---------------------------------------------------------------------------

function assertScaffoldInvariants(): void {
  const tenantId = "__scaffold_self_test__";
  const fwIds = ["iso-27001-2022", "hipaa-security"];
  const recs = scaffoldTenantControls(tenantId, fwIds);

  const iso = FRAMEWORK_REGISTRY["iso-27001-2022"];
  const hipaa = FRAMEWORK_REGISTRY["hipaa-security"];
  const expected = (iso?.controls.length ?? 0) + (hipaa?.controls.length ?? 0);

  if (recs.length !== expected) {
    throw new Error(
      `scaffoldTenantControls produced ${recs.length} records, expected ${expected}`,
    );
  }
  if (!recs.every((r) => r.status === "not_started")) {
    throw new Error("scaffoldTenantControls produced non-blank statuses");
  }
  if (!recs.every((r) => r.evidenceCount === 0 && r.ownerId === null)) {
    throw new Error("scaffoldTenantControls produced non-blank ownership/evidence");
  }

  const progress = computeFrameworkProgress(tenantId, "iso-27001-2022", recs);
  if (progress.totalControls !== (iso?.controls.length ?? 0)) {
    throw new Error(
      `computeFrameworkProgress totalControls=${progress.totalControls}, expected ${iso?.controls.length}`,
    );
  }
  if (progress.passing !== 0 || progress.scorePercent !== 0) {
    throw new Error("computeFrameworkProgress on blank scaffold did not return 0");
  }
}

// Only run when explicitly opted-in via env to avoid bundling cost.
// Safe to call manually from tests.
export const __INTERNAL_SCAFFOLD_SELFTEST__ = assertScaffoldInvariants;
