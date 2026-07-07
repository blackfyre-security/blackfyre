/**
 * Halo dashboard view-model SHAPES.
 *
 * REAL IMPL (BLACKFYRE 2026-06): this module previously shipped fabricated
 * "demo" datasets (agent scan matrices with invented scan counts, compliance
 * bars with invented pass rates, tenant lists naming real banks, a synthetic
 * live-event pool, and a fake critical-findings list with invented CVEs). All
 * of that fabricated data has been deleted. Only the TypeScript shapes that the
 * command-center renders remain; every value is now sourced from the live
 * admin API.
 */

// REAL IMPL (BLACKFYRE 2026-06): the fabricated DEMO_TENANTS / LIVE_EVENT_POOL /
// DEMO_CRITICAL_FINDINGS datasets (which named real banks, invented CVEs and
// synthetic activity) have been removed. Only the view-model SHAPES remain;
// every value rendered in the dashboard now comes from the live admin API.
// `agents` / `findings` are optional because the admin client API does not
// expose per-tenant counts — the row renders an honest "—" when absent.
export interface HaloTenant {
  id: string;
  name: string;
  env: "prod" | "staging" | "trial";
  score: number;
  agents?: number;
  findings?: number;
  plan: "Enterprise" | "Growth" | "Trial";
}

export interface HaloLiveEvent {
  t: string;
  a: string;
  msg: string;
  sev: "ok" | "warn" | "crit";
}

export interface HaloCriticalFinding {
  id: string;
  sev: "crit" | "warn" | "info";
  agent: string;
  title: string;
  sla: string;
  action: string;
}
