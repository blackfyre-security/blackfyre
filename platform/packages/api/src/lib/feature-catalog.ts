/**
 * Canonical feature catalog for BLACKFYRE plan gating.
 *
 * Each feature belongs to a tier (Comply, Protect, Defend). A tenant's
 * plan grants every feature at its tier and below. Rows in
 * `tenant_features` can override individual features (grant or revoke)
 * for one tenant — supporting custom-plan composition without minting
 * new tier enum values.
 */

export type PlanTier = "Comply" | "Protect" | "Defend";

export interface FeatureDef {
  key: string;
  name: string;
  description: string;
  tier: PlanTier;
  category: "core" | "ai" | "remediation" | "monitoring" | "compliance" | "experience";
}

export const FEATURES: FeatureDef[] = [
  // ── Comply (base tier — included in every plan) ─────────────────
  { key: "scans",            name: "Cloud Scans",            description: "AWS / Azure / GCP posture scans with severity-ranked findings.", tier: "Comply",  category: "core" },
  { key: "compliance-soc2",  name: "SOC 2 Framework",        description: "Control mapping, evidence collection, gap analysis for SOC 2.",  tier: "Comply",  category: "compliance" },
  { key: "compliance-iso",   name: "ISO 27001 Framework",    description: "Annex A controls + Statement of Applicability tooling.",         tier: "Comply",  category: "compliance" },
  { key: "reports",          name: "Reports & Exports",      description: "Readiness, gap analysis, evidence package PDFs.",                tier: "Comply",  category: "core" },
  { key: "audit-logs",       name: "Audit Logs",             description: "Tamper-evident activity log with 1-year retention.",             tier: "Comply",  category: "core" },

  // ── Protect ───────────────────────────────────────────────────
  { key: "ai-analysis",      name: "AI Gap Analysis",        description: "Claude-powered control-gap narratives and executive summaries.", tier: "Protect", category: "ai" },
  { key: "ai-ethics",        name: "AI Ethics & Governance", description: "ISO 42001 / NIST AI RMF reviews and decision logs.",             tier: "Protect", category: "ai" },
  { key: "remediation",      name: "Guided Remediation",     description: "Playbook-driven fixes with approval workflow and rollback.",     tier: "Protect", category: "remediation" },
  { key: "policy-designer",  name: "Policy Designer",        description: "AI-generated policy library tied to detected gaps.",             tier: "Protect", category: "compliance" },
  { key: "compliance-hipaa", name: "HIPAA Framework",        description: "PHI safeguards + breach-notification readiness scoring.",        tier: "Protect", category: "compliance" },
  { key: "compliance-gdpr",  name: "GDPR / DPDPA",           description: "Data residency, consent, and DPIA tooling.",                     tier: "Protect", category: "compliance" },

  // ── Defend ────────────────────────────────────────────────────
  { key: "threat-intel",     name: "Threat Intelligence",    description: "CVE / KEV correlation, MITRE ATT&CK mapping, signal feed.",       tier: "Defend",  category: "monitoring" },
  { key: "drift",            name: "Drift Detection",        description: "Continuous configuration drift monitoring + diff history.",       tier: "Defend",  category: "monitoring" },
  { key: "privacy-shield",   name: "Privacy Shield",         description: "PII scanning, sovereignty controls, BYOK encryption.",            tier: "Defend",  category: "monitoring" },
  { key: "monitoring",       name: "24/7 Monitoring",        description: "Real-time scoring, on-call alerting, SLA-backed response.",       tier: "Defend",  category: "monitoring" },
  { key: "ot-scada",         name: "OT / SCADA Scanning",    description: "ICS / industrial-control posture audits.",                        tier: "Defend",  category: "monitoring" },
  { key: "stakeholder",      name: "Stakeholder Portal",     description: "Branded read-only views for auditors and the board.",             tier: "Defend",  category: "experience" },
  { key: "autopilot",        name: "Compliance Autopilot",   description: "Agent-driven scan / collect / remediate loops with budget gate.", tier: "Defend",  category: "ai" },
  { key: "incidents",        name: "Incident Response",      description: "P1–P4 incident workflow with timeline and lessons-learned.",      tier: "Defend",  category: "monitoring" },
];

export const FEATURE_INDEX: Record<string, FeatureDef> = Object.fromEntries(
  FEATURES.map((f) => [f.key, f]),
);

const TIER_RANK: Record<PlanTier, number> = { Comply: 1, Protect: 2, Defend: 3 };

export const PLAN_TIER_FROM_DB: Record<string, PlanTier> = {
  comply: "Comply",
  protect: "Protect",
  defend: "Defend",
  // Legacy
  hourly: "Comply",
  project: "Protect",
  retainer: "Protect",
  annual: "Defend",
};

export function planTierFor(plan: string | null | undefined): PlanTier {
  return PLAN_TIER_FROM_DB[(plan ?? "").toLowerCase()] ?? "Comply";
}

/**
 * Compute the effective feature set for a tenant given:
 *   - their plan tier (provides DEFAULT enabled features)
 *   - per-tenant overrides (rows in `tenant_features`)
 *
 * Returns a map of featureKey → { enabled, source } where source is
 * "tier" (default from plan) or "override" (explicit row).
 */
export interface EffectiveFeature {
  key: string;
  enabled: boolean;
  source: "tier" | "override";
  tier: PlanTier;
  name: string;
  description: string;
  category: FeatureDef["category"];
}

export function computeEffectiveFeatures(
  plan: string | null | undefined,
  overrides: Array<{ feature_key: string; enabled: boolean }> = [],
): EffectiveFeature[] {
  const tier = planTierFor(plan);
  const overrideMap = new Map(overrides.map((o) => [o.feature_key, o.enabled]));

  return FEATURES.map((f) => {
    const tierDefault = TIER_RANK[f.tier] <= TIER_RANK[tier];
    const override = overrideMap.get(f.key);
    const effective = override === undefined ? tierDefault : override;
    return {
      key: f.key,
      enabled: effective,
      source: override === undefined ? "tier" : "override",
      tier: f.tier,
      name: f.name,
      description: f.description,
      category: f.category,
    };
  });
}

/**
 * Check if a single feature is enabled for a tenant given plan + overrides.
 * Used by plan-gate plugin and route preHandlers.
 */
export function isFeatureEnabled(
  featureKey: string,
  plan: string | null | undefined,
  overrides: Array<{ feature_key: string; enabled: boolean }> = [],
): boolean {
  const def = FEATURE_INDEX[featureKey];
  if (!def) return false;

  const overrideMap = new Map(overrides.map((o) => [o.feature_key, o.enabled]));
  const override = overrideMap.get(featureKey);
  if (override !== undefined) return override;

  const tier = planTierFor(plan);
  return TIER_RANK[def.tier] <= TIER_RANK[tier];
}
