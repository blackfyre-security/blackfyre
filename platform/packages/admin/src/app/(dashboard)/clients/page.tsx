"use client";

import { useState, useEffect, useMemo } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import {
  api,
  type Client,
  type FeatureDef,
  type EffectiveFeature,
  type FeatureTier,
  type AdminTenantDetail,
} from "@/lib/api";
import FeatureToggleMatrix from "@/components/FeatureToggleMatrix";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type Plan = "comply" | "protect" | "defend";
type Status = "active" | "configuring" | "pending" | "suspended";

interface ClientExtended extends Client {
  slug: string;
  ownerName: string;
  ownerEmail: string;
  integrations: string[];
  teamMembers: { name: string; email: string; role: string }[];
  recentScans: { id: string; date: string; framework: string; status: string }[];
}

// REAL IMPL (BLACKFYRE 2026-06): account numbers come ONLY from the API
// (Client.accountNumber, the immutable BLACKFYRE Customer ID). The previous
// deterministic `formatAccountNumber(index)` fallback that synthesized
// "BFR-2026-NNNNNN" strings from the row index has been removed — a real client
// either has a real account number or we show nothing rather than invent one.

/* ------------------------------------------------------------------ */
/*  Mock Data                                                          */
/* ------------------------------------------------------------------ */

const INDUSTRIES = [
  "FinTech",
  "HealthTech",
  "E-Commerce",
  "SaaS",
  "Defense",
  "Logistics",
  "EdTech",
  "InsurTech",
] as const;

/* (All mock client data removed — loaded from API) */

/* ------------------------------------------------------------------ */
/*  Plan tier inclusion                                                */
/* ------------------------------------------------------------------ */

const PLAN_INCLUDES: Record<Plan, FeatureTier[]> = {
  comply: ["Comply"],
  protect: ["Comply", "Protect"],
  defend: ["Comply", "Protect", "Defend"],
};

function planDefaultEnabled(plan: Plan, tier: FeatureTier): boolean {
  return PLAN_INCLUDES[plan].includes(tier);
}

/* ------------------------------------------------------------------ */
/*  Style helpers                                                      */
/* ------------------------------------------------------------------ */

const PLAN_COLORS: Record<Plan, { bg: string; text: string; border: string }> = {
  comply:  { bg: "var(--accent-subtle)",  text: "var(--accent)",       border: "rgba(99,102,241,0.3)"  },
  protect: { bg: "var(--info-bg)",        text: "var(--info-text)",    border: "rgba(139,92,246,0.3)"  },
  defend:  { bg: "var(--success-bg)",     text: "var(--success-text)", border: "rgba(34,197,94,0.3)"   },
};

const STATUS_CONFIG: Record<Status, { color: string; bg: string; label: string }> = {
  active:      { color: "var(--success-text)",  bg: "var(--success-bg)",  label: "Active"       },
  configuring: { color: "var(--medium-text)",   bg: "var(--medium-bg)",   label: "Configuring"  },
  pending:     { color: "var(--info-text)",      bg: "var(--info-bg)",     label: "Pending"      },
  suspended:   { color: "var(--critical-text)", bg: "var(--critical-bg)", label: "Suspended"    },
};

function complianceColor(score: number): string {
  if (score >= 90) return "var(--success-text)";
  if (score >= 75) return "var(--success-text)";
  if (score >= 60) return "var(--medium-text)";
  if (score >= 40) return "var(--high-text)";
  return "var(--critical-text)";
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/* ------------------------------------------------------------------ */
/*  Icon components (inline SVG)                                       */
/* ------------------------------------------------------------------ */

function IconEye({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function IconEdit({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

function IconUser({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function IconX({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function IconSearch({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function IconPlus({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function IconShield({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function IconLink({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

function IconLoader({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
      <line x1="12" y1="2" x2="12" y2="6" />
      <line x1="12" y1="18" x2="12" y2="22" />
      <line x1="4.93" y1="4.93" x2="7.76" y2="7.76" />
      <line x1="16.24" y1="16.24" x2="19.07" y2="19.07" />
      <line x1="2" y1="12" x2="6" y2="12" />
      <line x1="18" y1="12" x2="22" y2="12" />
      <line x1="4.93" y1="19.07" x2="7.76" y2="16.24" />
      <line x1="16.24" y1="7.76" x2="19.07" y2="4.93" />
    </svg>
  );
}

function IconWarning({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */
// REAL IMPL (BLACKFYRE 2026-06): the client-side DEMO_FEATURES catalog and the
// demoEffectiveFeatures()/detail-synthesis helpers have been removed. The
// feature catalog and tenant detail are always loaded from the live API.

function PlanBadge({ plan }: { plan: string }) {
  const p = (plan as Plan) in PLAN_COLORS ? (plan as Plan) : "comply";
  const colors = PLAN_COLORS[p];
  return (
    <span
      className="font-mono text-[11px] font-semibold uppercase tracking-wider px-2.5 py-0.5 rounded-md"
      style={{ background: colors.bg, color: colors.text, border: `1px solid ${colors.border}` }}
    >
      {plan}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const s = (status as Status) in STATUS_CONFIG ? (status as Status) : "pending";
  const cfg = STATUS_CONFIG[s];
  return (
    <span
      className="inline-flex items-center gap-1.5 font-mono text-[11px] font-semibold uppercase tracking-wider px-2.5 py-0.5 rounded-md"
      style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}33` }}
    >
      <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: cfg.color, boxShadow: `0 0 6px ${cfg.color}` }} />
      {cfg.label}
    </span>
  );
}

function ComplianceBar({ score }: { score: number }) {
  const color = complianceColor(score);
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
        <div
          className="h-full rounded-md transition-all duration-700"
          style={{ width: `${score}%`, background: color }}
        />
      </div>
      <span className="text-[13px] font-semibold" style={{ color }}>
        {score}%
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Onboarding Modal                                                   */
/* ------------------------------------------------------------------ */

function OnboardingModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [clientName, setClientName] = useState("");
  const [slug, setSlug] = useState("");
  const [industry, setIndustry] = useState("");
  const [plan, setPlan] = useState<Plan | "">("");
  const [customPlanLabel, setCustomPlanLabel] = useState("");
  const [monthlyPrice, setMonthlyPrice] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [slugManual, setSlugManual] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ email: string; tempPassword: string } | null>(null);

  // Feature customization state
  const [catalog, setCatalog] = useState<FeatureDef[] | null>(null);
  const [featureState, setFeatureState] = useState<Record<string, boolean>>({});
  const [catalogError, setCatalogError] = useState<string | null>(null);

  useEffect(() => {
    if (!slugManual) {
      setSlug(slugify(clientName));
    }
  }, [clientName, slugManual]);

  // Load feature catalog when entering customization step.
  // REAL IMPL (BLACKFYRE 2026-06): always loads the live catalog from the API;
  // no DEMO_FEATURES fallback.
  useEffect(() => {
    if (step !== 3 || catalog !== null) return;
    api.getFeatureCatalog()
      .then((res) => setCatalog(res.features))
      .catch((err: unknown) => setCatalogError(err instanceof Error ? err.message : "Failed to load features"));
  }, [step, catalog]);

  // Seed featureState from plan defaults when catalog arrives or plan changes
  useEffect(() => {
    if (!catalog || !plan) return;
    const seed: Record<string, boolean> = {};
    for (const f of catalog) seed[f.key] = planDefaultEnabled(plan, f.tier);
    setFeatureState(seed);
  }, [catalog, plan]);

  const effectiveFeatures: EffectiveFeature[] = useMemo(() => {
    if (!catalog || !plan) return [];
    return catalog.map((f) => {
      const planDefault = planDefaultEnabled(plan, f.tier);
      const enabled = featureState[f.key] ?? planDefault;
      return {
        key: f.key,
        enabled,
        source: enabled === planDefault ? "tier" : "override",
        tier: f.tier,
        name: f.name,
        description: f.description,
        category: f.category,
      };
    });
  }, [catalog, plan, featureState]);

  const computeOverrides = (): Array<{ featureKey: string; enabled: boolean }> => {
    if (!catalog || !plan) return [];
    const out: Array<{ featureKey: string; enabled: boolean }> = [];
    for (const f of catalog) {
      const planDefault = planDefaultEnabled(plan, f.tier);
      const current = featureState[f.key] ?? planDefault;
      if (current !== planDefault) out.push({ featureKey: f.key, enabled: current });
    }
    return out;
  };

  const canNext =
    step === 1
      ? clientName.trim() && slug.trim() && industry
      : step === 2
      ? plan
      : step === 3
      ? true
      : ownerName.trim() && ownerEmail.trim();

  const handleInitialize = async (includeOverrides: boolean) => {
    if (!plan) return;
    setLoading(true);
    setError(null);
    try {
      const overrides = includeOverrides ? computeOverrides() : [];
      const priceNum = monthlyPrice.trim() ? Number(monthlyPrice) : undefined;
      const res = await api.provisionClient({
        companyName: clientName.trim(),
        ownerEmail: ownerEmail.trim(),
        ownerName: ownerName.trim(),
        plan,
        industry: industry || undefined,
        customPlanLabel: customPlanLabel.trim() || undefined,
        monthlyPriceInr: Number.isFinite(priceNum) ? priceNum : undefined,
        featureOverrides: overrides.length > 0 ? overrides : undefined,
      });
      setSuccess({ email: res.client.ownerEmail, tempPassword: res.tempPassword });
      onCreated();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Provisioning failed");
    } finally {
      setLoading(false);
    }
  };

  const overrideCount = useMemo(() => computeOverrides().length, [catalog, plan, featureState]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(4px)" }}>
      <div
        className="relative w-full max-w-2xl rounded-md overflow-hidden animate-scale-in flex flex-col"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          boxShadow: "var(--shadow-overlay)",
          maxHeight: "90vh",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
          <div>
            <h3 className="text-[15px] font-semibold" style={{ color: "var(--text-primary)" }}>
              Create Tenant
            </h3>
            <p className="text-[12px] mt-0.5" style={{ color: "var(--text-muted)" }}>
              Step {step} of 4
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg transition-colors hover:bg-[var(--hover-bg)]"
            style={{ color: "var(--text-muted)" }}
          >
            <IconX />
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex px-6 pt-4 gap-2 shrink-0">
          {[1, 2, 3, 4].map((s) => (
            <div
              key={s}
              className="flex-1 h-1 rounded-md transition-all duration-300"
              style={{
                background: s <= step ? "var(--accent)" : "var(--border)",
              }}
            />
          ))}
        </div>

        {/* Content */}
        <div className="px-6 py-5 overflow-y-auto flex-1" style={{ minHeight: 220 }}>
          {success && (
            <div className="space-y-4">
              <div
                className="rounded-lg p-3"
                style={{ background: "var(--success-bg)", border: "1px solid rgba(34,197,94,0.3)" }}
              >
                <p className="text-[13px] font-semibold" style={{ color: "var(--success-text)" }}>
                  Client provisioned successfully
                </p>
                <p className="text-[12px] mt-1" style={{ color: "var(--text-secondary)" }}>
                  Share the temporary password with the client owner.
                </p>
              </div>
              <div>
                <label className="font-mono text-[11px] text-[var(--text-muted)] block mb-1.5 tracking-wider">
                  OWNER EMAIL
                </label>
                <p className="font-mono text-[13px]" style={{ color: "var(--text-primary)" }}>{success.email}</p>
              </div>
              <div>
                <label className="font-mono text-[11px] text-[var(--text-muted)] block mb-1.5 tracking-wider">
                  TEMPORARY PASSWORD
                </label>
                <div
                  className="flex items-center gap-2 rounded-md px-3 py-2"
                  style={{ background: "var(--surface-raised)", border: "1px solid var(--border)" }}
                >
                  <span className="font-mono text-[13px] flex-1 select-all" style={{ color: "var(--accent)" }}>
                    {success.tempPassword}
                  </span>
                  <button
                    onClick={() => navigator.clipboard.writeText(success.tempPassword)}
                    className="font-mono text-[10px] px-2 py-1 rounded transition-colors hover:bg-[var(--hover-bg)]"
                    style={{ color: "var(--text-muted)" }}
                  >
                    COPY
                  </button>
                </div>
                <p className="font-mono text-[9px] text-[var(--text-muted)] mt-1">
                  Client must change this on first login.
                </p>
              </div>
              {error && (
                <p className="text-[12px]" style={{ color: "var(--critical-text)" }}>{error}</p>
              )}
            </div>
          )}
          {!success && step === 1 && (
            <div className="space-y-4">
              <p className="font-mono text-[10px] text-[var(--text-muted)] uppercase tracking-widest mb-3">
                Client Identity
              </p>
              <div>
                <label className="font-mono text-[11px] text-[var(--text-muted)] block mb-1.5 tracking-wider">
                  CLIENT NAME
                </label>
                <input
                  className="admin-input"
                  placeholder="Acme Corporation"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  autoFocus
                />
              </div>
              <div>
                <label className="font-mono text-[11px] text-[var(--text-muted)] block mb-1.5 tracking-wider">
                  SLUG
                </label>
                <input
                  className="admin-input"
                  placeholder="acme-corporation"
                  value={slug}
                  onChange={(e) => {
                    setSlugManual(true);
                    setSlug(e.target.value);
                  }}
                />
                <p className="font-mono text-[9px] text-[var(--text-muted)] mt-1">Auto-generated from name. Edit to override.</p>
              </div>
              <div>
                <label className="font-mono text-[11px] text-[var(--text-muted)] block mb-1.5 tracking-wider">
                  INDUSTRY
                </label>
                <select
                  className="admin-input"
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                >
                  <option value="">Select industry...</option>
                  {INDUSTRIES.map((ind) => (
                    <option key={ind} value={ind}>
                      {ind}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {!success && step === 2 && (
            <div>
              <p className="font-mono text-[10px] text-[var(--text-muted)] uppercase tracking-widest mb-4">
                Select Plan
              </p>
              <div className="grid grid-cols-1 gap-3">
                {(["comply", "protect", "defend"] as Plan[]).map((p) => {
                  const colors = PLAN_COLORS[p];
                  const selected = plan === p;
                  return (
                    <button
                      key={p}
                      onClick={() => setPlan(p)}
                      className="rounded-md p-4 text-left transition-all duration-200"
                      style={{
                        background: selected ? colors.bg : "var(--surface-raised)",
                        border: `1px solid ${selected ? colors.text : "var(--border)"}`,
                      }}
                    >
                      <p className="text-[13px] font-semibold capitalize" style={{ color: selected ? colors.text : "var(--text-primary)" }}>
                        {p}
                      </p>
                      <p className="text-[11px] mt-1" style={{ color: selected ? colors.text : "var(--text-muted)" }}>
                        {p === "comply" && "SOC2 + ISO 27001 · Up to 3 members · ₹49,999/mo"}
                        {p === "protect" && "All frameworks · Up to 10 members · ₹99,999/mo"}
                        {p === "defend" && "All frameworks · Unlimited members · ₹1,99,999/mo"}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {!success && step === 3 && (
            <div className="space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-mono text-[10px] text-[var(--text-muted)] uppercase tracking-widest">
                    Feature Customization
                  </p>
                  <p className="text-[12px] mt-1" style={{ color: "var(--text-secondary)" }}>
                    Toggle individual features. Defaults reflect the {plan} plan.
                  </p>
                </div>
                <span
                  className="font-mono text-[10px] px-2 py-1 rounded"
                  style={{
                    background: overrideCount > 0 ? "var(--medium-bg)" : "var(--surface-raised)",
                    color: overrideCount > 0 ? "var(--medium-text)" : "var(--text-muted)",
                    border: `1px solid ${overrideCount > 0 ? "var(--medium)" : "var(--border)"}`,
                  }}
                >
                  {overrideCount} OVERRIDE{overrideCount !== 1 ? "S" : ""}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-mono text-[11px] text-[var(--text-muted)] block mb-1.5 tracking-wider">
                    CUSTOM PLAN LABEL
                  </label>
                  <input
                    className="admin-input"
                    placeholder="e.g. Enterprise Plus"
                    maxLength={120}
                    value={customPlanLabel}
                    onChange={(e) => setCustomPlanLabel(e.target.value)}
                  />
                </div>
                <div>
                  <label className="font-mono text-[11px] text-[var(--text-muted)] block mb-1.5 tracking-wider">
                    MONTHLY PRICE ₹
                  </label>
                  <input
                    className="admin-input"
                    type="number"
                    placeholder="99999"
                    value={monthlyPrice}
                    onChange={(e) => setMonthlyPrice(e.target.value)}
                  />
                </div>
              </div>

              {catalogError ? (
                <div
                  className="rounded-lg p-3"
                  style={{ background: "var(--critical-bg)", border: "1px solid rgba(239,68,68,0.3)" }}
                >
                  <p className="text-[12px]" style={{ color: "var(--critical-text)" }}>{catalogError}</p>
                </div>
              ) : !catalog ? (
                <div className="flex items-center justify-center py-10">
                  <IconLoader />
                </div>
              ) : (
                <FeatureToggleMatrix
                  features={effectiveFeatures}
                  onChange={(key, enabled) => setFeatureState((prev) => ({ ...prev, [key]: enabled }))}
                />
              )}
            </div>
          )}

          {!success && step === 4 && (
            <div className="space-y-4">
              <p className="font-mono text-[10px] text-[var(--text-muted)] uppercase tracking-widest mb-3">
                Invite Owner
              </p>
              <div>
                <label className="font-mono text-[11px] text-[var(--text-muted)] block mb-1.5 tracking-wider">
                  OWNER NAME
                </label>
                <input
                  className="admin-input"
                  placeholder="Jane Doe"
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  autoFocus
                />
              </div>
              <div>
                <label className="font-mono text-[11px] text-[var(--text-muted)] block mb-1.5 tracking-wider">
                  OWNER EMAIL
                </label>
                <input
                  className="admin-input"
                  type="email"
                  placeholder="jane@acme.com"
                  value={ownerEmail}
                  onChange={(e) => setOwnerEmail(e.target.value)}
                />
              </div>
              {error && (
                <div
                  className="rounded-lg p-3"
                  style={{ background: "var(--critical-bg)", border: "1px solid rgba(239,68,68,0.3)" }}
                >
                  <p className="text-[12px]" style={{ color: "var(--critical-text)" }}>{error}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-between px-6 py-4 shrink-0 gap-2"
          style={{ borderTop: "1px solid var(--border)" }}
        >
          {success ? (
            <>
              <span />
              <button onClick={onClose} className="btn btn-primary btn-sm">
                Done
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => (step > 1 ? setStep(step - 1) : onClose())}
                className="btn btn-ghost btn-sm"
              >
                {step > 1 ? "Back" : "Cancel"}
              </button>

              {step < 3 && (
                <button
                  onClick={() => setStep(step + 1)}
                  disabled={!canNext}
                  className="btn btn-primary btn-sm"
                >
                  Next
                </button>
              )}

              {step === 3 && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setFeatureState({});
                      setStep(4);
                    }}
                    className="btn btn-ghost btn-sm"
                  >
                    Skip — use plan defaults
                  </button>
                  <button onClick={() => setStep(4)} className="btn btn-primary btn-sm">
                    Continue {overrideCount > 0 ? `with ${overrideCount} override${overrideCount !== 1 ? "s" : ""}` : ""}
                  </button>
                </div>
              )}

              {step === 4 && (
                <button
                  onClick={() => handleInitialize(true)}
                  disabled={!canNext || loading}
                  className="btn btn-primary btn-sm"
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <IconLoader size={14} />
                      Provisioning...
                    </span>
                  ) : (
                    "Provision Client"
                  )}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Client Detail Slide-Out (editable)                                 */
/* ------------------------------------------------------------------ */

function ClientSlideOut({
  client,
  onClose,
  onSaved,
}: {
  client: ClientExtended;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [detail, setDetail] = useState<AdminTenantDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(true);

  // Editable tenant fields
  const [editPlan, setEditPlan] = useState<Plan>((client.plan as Plan) || "comply");
  const [editStatus, setEditStatus] = useState<Status>((client.status as Status) || "pending");
  const [editLabel, setEditLabel] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [savingTenant, setSavingTenant] = useState(false);
  const [tenantSavedAt, setTenantSavedAt] = useState<number | null>(null);
  const [tenantError, setTenantError] = useState<string | null>(null);

  // Feature edits
  const [featureEdits, setFeatureEdits] = useState<Record<string, boolean>>({});
  const [savingFeatures, setSavingFeatures] = useState(false);
  const [featuresSavedAt, setFeaturesSavedAt] = useState<number | null>(null);
  const [featuresError, setFeaturesError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoadingDetail(true);
    setLoadError(null);

    const load = async () => {
      try {
        // REAL IMPL (BLACKFYRE 2026-06): tenant detail is always loaded from the
        // live API — no client-side synthesized detail payload.
        const res: AdminTenantDetail = await api.getAdminTenant(client.id);
        if (cancelled) return;
        setDetail(res);
        setEditPlan((res.tenant.plan as Plan) || "comply");
        setEditStatus((res.tenant.onboardingStatus as Status) || "pending");
        setEditLabel(res.tenant.customPlanLabel ?? "");
        setEditPrice(res.tenant.monthlyPriceInr != null ? String(res.tenant.monthlyPriceInr) : "");
      } catch (err: unknown) {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : "Failed to load tenant");
      } finally {
        if (!cancelled) setLoadingDetail(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [client]);

  const effectiveFeatures: EffectiveFeature[] = useMemo(() => {
    if (!detail) return [];
    return detail.features.features.map((f) => {
      if (Object.prototype.hasOwnProperty.call(featureEdits, f.key)) {
        const next = featureEdits[f.key];
        return { ...f, enabled: next, source: next !== f.enabled || f.source === "override" ? "override" : "tier" };
      }
      return f;
    });
  }, [detail, featureEdits]);

  const featureDirtyCount = useMemo(() => {
    if (!detail) return 0;
    let n = 0;
    for (const f of detail.features.features) {
      if (Object.prototype.hasOwnProperty.call(featureEdits, f.key) && featureEdits[f.key] !== f.enabled) n++;
    }
    return n;
  }, [detail, featureEdits]);

  const tenantDirty = useMemo(() => {
    if (!detail) return false;
    const t = detail.tenant;
    const priceNum = editPrice.trim() ? Number(editPrice) : null;
    return (
      editPlan !== t.plan ||
      editStatus !== t.onboardingStatus ||
      (editLabel || null) !== (t.customPlanLabel ?? null) ||
      priceNum !== (t.monthlyPriceInr ?? null)
    );
  }, [detail, editPlan, editStatus, editLabel, editPrice]);

  const handleSaveTenant = async () => {
    if (!detail) return;
    setSavingTenant(true);
    setTenantError(null);
    try {
      const priceNum = editPrice.trim() ? Number(editPrice) : null;
      // REAL IMPL (BLACKFYRE 2026-06): always persist via the live API. No
      // simulated/no-op save path.
      await api.updateAdminTenant(client.id, {
        plan: editPlan,
        onboardingStatus: editStatus,
        customPlanLabel: editLabel.trim() || null,
        monthlyPriceInr: Number.isFinite(priceNum) ? priceNum : null,
      });
      setTenantSavedAt(Date.now());
      onSaved();
    } catch (err: unknown) {
      setTenantError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSavingTenant(false);
    }
  };

  const handleSaveFeatures = async () => {
    if (!detail) return;
    setSavingFeatures(true);
    setFeaturesError(null);
    try {
      const overrides: Array<{ featureKey: string; enabled: boolean }> = [];
      for (const f of detail.features.features) {
        if (Object.prototype.hasOwnProperty.call(featureEdits, f.key) && featureEdits[f.key] !== f.enabled) {
          overrides.push({ featureKey: f.key, enabled: featureEdits[f.key] });
        }
      }
      // REAL IMPL (BLACKFYRE 2026-06): always persist feature overrides via the
      // live API. No simulated/no-op save path.
      await api.updateAdminTenantFeatures(client.id, overrides);
      // Apply locally
      setDetail((prev) => {
        if (!prev) return prev;
        const merged = prev.features.features.map((f) => {
          if (Object.prototype.hasOwnProperty.call(featureEdits, f.key)) {
            const next = featureEdits[f.key];
            return { ...f, enabled: next, source: next !== f.enabled ? ("override" as const) : f.source };
          }
          return f;
        });
        return { ...prev, features: { ...prev.features, features: merged } };
      });
      setFeatureEdits({});
      setFeaturesSavedAt(Date.now());
      onSaved();
    } catch (err: unknown) {
      setFeaturesError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSavingFeatures(false);
    }
  };

  const owner = detail?.owner;
  const stats = detail?.stats;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(2px)" }} onClick={onClose}>
      <div
        className="w-full max-w-xl h-full overflow-y-auto"
        style={{
          background: "var(--surface)",
          borderLeft: "1px solid var(--border)",
          boxShadow: "var(--shadow-overlay)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="sticky top-0 z-10 flex items-center justify-between px-6 py-4"
          style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)" }}
        >
          <div>
            <h3 className="text-[15px] font-semibold" style={{ color: "var(--text-primary)" }}>
              Client Profile
            </h3>
            <p className="text-[12px] mt-0.5" style={{ color: "var(--text-muted)" }}>{client.tenantId}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg transition-colors hover:bg-[var(--hover-bg)]"
            style={{ color: "var(--text-muted)" }}
          >
            <IconX />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {loadingDetail ? (
            <div className="flex items-center justify-center py-12">
              <IconLoader />
            </div>
          ) : loadError ? (
            <div
              className="rounded-lg p-3"
              style={{ background: "var(--critical-bg)", border: "1px solid rgba(239,68,68,0.3)" }}
            >
              <p className="text-[12px]" style={{ color: "var(--critical-text)" }}>{loadError}</p>
            </div>
          ) : detail ? (
            <>
              {/* Identity section */}
              <div>
                <h4 className="text-[18px] font-semibold" style={{ color: "var(--text-primary)" }}>{detail.tenant.name}</h4>
                <p className="text-[12px] mt-0.5 font-mono" style={{ color: "var(--text-muted)" }}>{detail.tenant.slug}</p>
                <div className="mt-2">
                  <span
                    className="inline-block font-mono text-[11px] px-2 py-1 rounded"
                    style={{
                      background: "var(--surface-raised)",
                      color: "var(--text-primary)",
                      border: "1px solid var(--border)",
                      letterSpacing: "0.05em",
                    }}
                    title="BLACKFYRE Customer ID (immutable)"
                  >
                    {detail.tenant.accountNumber}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <PlanBadge plan={editPlan} />
                  <StatusBadge status={editStatus} />
                  {detail.tenant.customPlanLabel && (
                    <span
                      className="font-mono text-[10px] px-2 py-0.5 rounded"
                      style={{ background: "var(--surface-raised)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}
                    >
                      {detail.tenant.customPlanLabel}
                    </span>
                  )}
                </div>
              </div>

              {/* Editable tenant config */}
              <div
                className="rounded-md p-4 space-y-3"
                style={{ background: "var(--surface-raised)", border: "1px solid var(--border)" }}
              >
                <div className="flex items-center justify-between">
                  <p className="font-mono text-[10px] uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
                    Tenant Configuration
                  </p>
                  {tenantSavedAt && Date.now() - tenantSavedAt < 3000 && (
                    <span className="text-[11px]" style={{ color: "var(--success-text)" }}>Saved</span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-mono text-[10px] text-[var(--text-muted)] block mb-1 tracking-wider">PLAN</label>
                    <select
                      className="admin-input"
                      value={editPlan}
                      onChange={(e) => setEditPlan(e.target.value as Plan)}
                    >
                      <option value="comply">Comply</option>
                      <option value="protect">Protect</option>
                      <option value="defend">Defend</option>
                    </select>
                  </div>
                  <div>
                    <label className="font-mono text-[10px] text-[var(--text-muted)] block mb-1 tracking-wider">STATUS</label>
                    <select
                      className="admin-input"
                      value={editStatus}
                      onChange={(e) => setEditStatus(e.target.value as Status)}
                    >
                      <option value="active">Active</option>
                      <option value="configuring">Configuring</option>
                      <option value="pending">Pending</option>
                      <option value="suspended">Suspended</option>
                    </select>
                  </div>
                  <div>
                    <label className="font-mono text-[10px] text-[var(--text-muted)] block mb-1 tracking-wider">CUSTOM PLAN LABEL</label>
                    <input
                      className="admin-input"
                      maxLength={120}
                      placeholder="e.g. Enterprise Plus"
                      value={editLabel}
                      onChange={(e) => setEditLabel(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="font-mono text-[10px] text-[var(--text-muted)] block mb-1 tracking-wider">MONTHLY PRICE ₹</label>
                    <input
                      className="admin-input"
                      type="number"
                      placeholder="99999"
                      value={editPrice}
                      onChange={(e) => setEditPrice(e.target.value)}
                    />
                  </div>
                </div>
                {tenantError && (
                  <p className="text-[12px]" style={{ color: "var(--critical-text)" }}>{tenantError}</p>
                )}
                <div className="flex justify-end">
                  <button
                    onClick={handleSaveTenant}
                    disabled={!tenantDirty || savingTenant}
                    className="btn btn-primary btn-sm"
                  >
                    {savingTenant ? (
                      <span className="flex items-center gap-2"><IconLoader size={14} /> Saving...</span>
                    ) : (
                      "Save"
                    )}
                  </button>
                </div>
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-md p-3" style={{ background: "var(--surface-raised)", border: "1px solid var(--border)" }}>
                  <p className="text-[11px] font-medium mb-1" style={{ color: "var(--text-muted)" }}>Industry</p>
                  <p className="text-[13px] font-medium" style={{ color: "var(--text-primary)" }}>{detail.tenant.industryProfile || client.industry}</p>
                </div>
                <div className="rounded-md p-3" style={{ background: "var(--surface-raised)", border: "1px solid var(--border)" }}>
                  <p className="text-[11px] font-medium mb-1" style={{ color: "var(--text-muted)" }}>Compliance</p>
                  <ComplianceBar score={stats?.complianceScore ?? client.complianceScore} />
                </div>
                <div className="rounded-md p-3" style={{ background: "var(--surface-raised)", border: "1px solid var(--border)" }}>
                  <p className="text-[11px] font-medium mb-1" style={{ color: "var(--text-muted)" }}>Owner</p>
                  <p className="text-[13px] font-medium" style={{ color: "var(--text-primary)" }}>{owner?.name || client.ownerName || "—"}</p>
                  <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>{owner?.email || client.ownerEmail || "—"}</p>
                </div>
                <div className="rounded-md p-3" style={{ background: "var(--surface-raised)", border: "1px solid var(--border)" }}>
                  <p className="text-[11px] font-medium mb-1" style={{ color: "var(--text-muted)" }}>Last Scan</p>
                  <p className="text-[13px] font-medium" style={{ color: "var(--text-primary)" }}>
                    {stats?.lastScanAt ? new Date(stats.lastScanAt).toLocaleDateString() : "Never"}
                  </p>
                </div>
              </div>

              {/* Feature matrix */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span style={{ color: "var(--text-muted)" }}><IconShield size={14} /></span>
                    <p className="text-[12px] font-semibold" style={{ color: "var(--text-secondary)" }}>Features</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {featuresSavedAt && Date.now() - featuresSavedAt < 3000 && (
                      <span className="text-[11px]" style={{ color: "var(--success-text)" }}>Saved</span>
                    )}
                    <button
                      onClick={handleSaveFeatures}
                      disabled={featureDirtyCount === 0 || savingFeatures}
                      className="btn btn-primary btn-sm"
                    >
                      {savingFeatures ? (
                        <span className="flex items-center gap-2"><IconLoader size={14} /> Saving...</span>
                      ) : (
                        `Save feature changes${featureDirtyCount > 0 ? ` (${featureDirtyCount})` : ""}`
                      )}
                    </button>
                  </div>
                </div>
                {featuresError && (
                  <p className="text-[12px] mb-2" style={{ color: "var(--critical-text)" }}>{featuresError}</p>
                )}
                <FeatureToggleMatrix
                  features={effectiveFeatures}
                  onChange={(key, enabled) => setFeatureEdits((prev) => ({ ...prev, [key]: enabled }))}
                />
              </div>

              {/* Integrations */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span style={{ color: "var(--text-muted)" }}><IconLink size={14} /></span>
                  <p className="text-[12px] font-semibold" style={{ color: "var(--text-secondary)" }}>Integrations</p>
                </div>
                {(stats?.integrations.length ?? 0) > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {stats!.integrations.map((intg) => (
                      <span
                        key={intg}
                        className="text-[12px] px-2.5 py-1 rounded-lg"
                        style={{ background: "var(--surface-raised)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
                      >
                        {intg}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>No integrations configured</p>
                )}
              </div>

              {/* Recent Scans */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span style={{ color: "var(--text-muted)" }}><IconShield size={14} /></span>
                  <p className="text-[12px] font-semibold" style={{ color: "var(--text-secondary)" }}>Recent Scans</p>
                </div>
                {(stats?.recentScans.length ?? 0) > 0 ? (
                  <div className="space-y-2">
                    {stats!.recentScans.map((scan) => (
                      <div
                        key={scan.id}
                        className="flex items-center justify-between rounded-lg px-3 py-2.5"
                        style={{ background: "var(--surface-raised)", border: "1px solid var(--border)" }}
                      >
                        <div>
                          <p className="text-[13px] font-medium" style={{ color: "var(--text-primary)" }}>{scan.framework}</p>
                          <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>{scan.date}</p>
                        </div>
                        <span
                          className="text-[11px] font-semibold badge"
                          style={{
                            background: scan.status === "completed" ? "var(--success-bg)" : scan.status === "running" ? "var(--accent-subtle)" : "var(--critical-bg)",
                            color: scan.status === "completed" ? "var(--success-text)" : scan.status === "running" ? "var(--accent)" : "var(--critical-text)",
                          }}
                        >
                          {scan.status}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>No scans performed</p>
                )}
              </div>

              {/* Team Members */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span style={{ color: "var(--text-muted)" }}><IconUser size={14} /></span>
                  <p className="text-[12px] font-semibold" style={{ color: "var(--text-secondary)" }}>Team Members</p>
                </div>
                <div className="space-y-2">
                  {(stats?.teamMembers ?? []).map((member) => (
                    <div
                      key={member.email}
                      className="flex items-center justify-between rounded-lg px-3 py-2.5"
                      style={{ background: "var(--surface-raised)", border: "1px solid var(--border)" }}
                    >
                      <div>
                        <p className="text-[13px] font-medium" style={{ color: "var(--text-primary)" }}>{member.name}</p>
                        <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>{member.email}</p>
                      </div>
                      <span
                        className="text-[11px] px-2 py-0.5 rounded-md font-medium"
                        style={{
                          background: member.role.toLowerCase() === "owner" ? "var(--info-bg)" : "var(--surface)",
                          color: member.role.toLowerCase() === "owner" ? "var(--info-text)" : "var(--text-muted)",
                          border: `1px solid ${member.role.toLowerCase() === "owner" ? "rgba(139,92,246,0.3)" : "var(--border)"}`,
                        }}
                      >
                        {member.role}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

            </>
          ) : null}
        </div>
      </div>

      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Page                                                          */
/* ------------------------------------------------------------------ */

// REAL IMPL (BLACKFYRE 2026-06): the 12-row DEMO_CLIENTS_DATA dataset (which
// named real companies — Reliance, Infosys, HDFC Bank, TCS, Wipro, Bajaj
// Finance, etc. — with invented owners, emails and compliance scores) and the
// DEMO_MODE bypass have been removed entirely. The clients table is now sourced
// only from the live API (api.getClients). Empty/error states are honest.

export default function ClientsPage() {
  const [clients, setClients] = useState<ClientExtended[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterPlan, setFilterPlan] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filterIndustry, setFilterIndustry] = useState<string>("");
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [selectedClient, setSelectedClient] = useState<ClientExtended | null>(null);

  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // Auto-open the onboarding modal when arriving via `/clients?onboard=1`
  // (deep-link from the dashboard "+ New tenant" CTA). Strips the param so
  // refresh doesn't keep re-opening the modal.
  useEffect(() => {
    if (searchParams?.get("onboard") === "1") {
      setShowOnboarding(true);
      router.replace(pathname);
    }
  }, [searchParams, router, pathname]);

  const refreshClients = () => {
    api.getClients()
      .then((res) => {
        // REAL IMPL (BLACKFYRE 2026-06): accountNumber is the real value from the
        // API (empty string if the record genuinely lacks one — never synthesized).
        const extended: ClientExtended[] = (res.clients ?? []).map((c) => ({
          ...c,
          accountNumber: c.accountNumber ?? "",
          slug: slugify(c.company),
          ownerName: "",
          ownerEmail: "",
          integrations: [],
          teamMembers: [],
          recentScans: [],
        }));
        setClients(extended);
      })
      .catch(() => {});
  };

  // REAL IMPL (BLACKFYRE 2026-06): always load clients from the live API. No
  // demo bypass, no fabricated client list.
  useEffect(() => {
    let cancelled = false;
    api.getClients()
      .then((res) => {
        if (cancelled) return;
        // REAL IMPL (BLACKFYRE 2026-06): accountNumber is the real value from the
        // API (empty string if the record genuinely lacks one — never synthesized).
        const extended: ClientExtended[] = (res.clients ?? []).map((c) => ({
          ...c,
          accountNumber: c.accountNumber ?? "",
          slug: slugify(c.company),
          ownerName: "",
          ownerEmail: "",
          integrations: [],
          teamMembers: [],
          recentScans: [],
        }));
        setClients(extended);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load clients");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const filteredClients = useMemo(() => {
    return clients.filter((c) => {
      const matchSearch =
        !search ||
        (c.company ?? "").toLowerCase().includes(search.toLowerCase()) ||
        (c.slug ?? "").toLowerCase().includes(search.toLowerCase()) ||
        (c.industry ?? "").toLowerCase().includes(search.toLowerCase());
      const matchPlan = !filterPlan || c.plan === filterPlan;
      const matchStatus = !filterStatus || c.status === filterStatus;
      const matchIndustry = !filterIndustry || c.industry === filterIndustry;
      return matchSearch && matchPlan && matchStatus && matchIndustry;
    });
  }, [clients, search, filterPlan, filterStatus, filterIndustry]);

  const uniqueIndustries = useMemo(() => {
    return Array.from(new Set(clients.map((c) => c.industry))).sort();
  }, [clients]);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-2 border-[var(--accent)] border-t-transparent rounded-full" /></div>;
  if (error) return <div className="p-6 text-[var(--critical-text)]">Failed to load data: {error}</div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div
            className="mono text-[11px] font-semibold"
            style={{ color: "var(--text-muted)", letterSpacing: "0.14em", textTransform: "uppercase" }}
          >
            Admin · Clients
          </div>
          <h1
            className="mt-2 text-[30px] font-semibold tracking-tight"
            style={{ color: "var(--text-primary)", letterSpacing: "-0.025em" }}
          >
            Client registry
          </h1>
          <p className="mt-1.5 text-[13px]" style={{ color: "var(--text-secondary)" }}>
            {filteredClients.length} client{filteredClients.length !== 1 ? "s" : ""} loaded
          </p>
        </div>
        <button
          onClick={() => setShowOnboarding(true)}
          className="admin-btn admin-btn-ghost text-xs gap-2 glow-border-hover"
          style={{ borderColor: "var(--accent)" }}
        >
          <IconPlus size={14} />
          CREATE TENANT
        </button>
      </div>

      {/* Filters */}
      <div
        className="rounded-md p-4 flex flex-col sm:flex-row gap-3"
        style={{ background: "var(--bg)", border: "1px solid var(--border)" }}
      >
        <div className="relative flex-1">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">
            <IconSearch size={14} />
          </div>
          <input
            className="admin-input pl-9"
            placeholder="Search clients..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="admin-input sm:w-40"
          value={filterPlan}
          onChange={(e) => setFilterPlan(e.target.value)}
        >
          <option value="">All Plans</option>
          <option value="comply">Comply</option>
          <option value="protect">Protect</option>
          <option value="defend">Defend</option>
        </select>
        <select
          className="admin-input sm:w-40"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
        >
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="configuring">Configuring</option>
          <option value="pending">Pending</option>
          <option value="suspended">Suspended</option>
        </select>
        <select
          className="admin-input sm:w-40"
          value={filterIndustry}
          onChange={(e) => setFilterIndustry(e.target.value)}
        >
          <option value="">All Industries</option>
          {uniqueIndustries.map((ind) => (
            <option key={ind} value={ind}>
              {ind}
            </option>
          ))}
        </select>
      </div>

      {/* Client Table */}
      <div
        className="rounded-md overflow-hidden relative scanline"
        style={{
          background: "var(--bg)",
          border: "1px solid var(--border)",
          boxShadow: "var(--glow-card)",
        }}
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                {["Client Name", "Slug", "Plan", "Industry", "Compliance", "Status", "Actions"].map(
                  (header) => (
                    <th
                      key={header}
                      className="text-left font-mono text-[10px] font-semibold uppercase tracking-widest px-4 py-3"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {header}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {filteredClients.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12">
                    <p className="font-mono text-sm text-[var(--text-muted)]">No clients match your filters</p>
                    <p className="font-mono text-[10px] text-[var(--text-secondary)] mt-1">Try adjusting search or filter criteria</p>
                  </td>
                </tr>
              ) : (
                filteredClients.map((client, idx) => (
                  <tr
                    key={client.id}
                    className="group transition-colors duration-150 hover:bg-[var(--hover-bg)]"
                    style={{
                      borderBottom: idx < filteredClients.length - 1 ? "1px solid var(--border-subtle)" : "none",
                    }}
                  >
                    {/* Client Name */}
                    <td className="px-4 py-3.5">
                      <p className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>{client.company}</p>
                      <p className="font-mono text-[11px] text-[var(--text-secondary)] mt-0.5">{client.accountNumber}</p>
                      <p className="font-mono text-[10px] text-[var(--text-muted)]">{client.tenantId}</p>
                    </td>

                    {/* Slug */}
                    <td className="px-4 py-3.5">
                      <span className="font-mono text-xs" style={{ color: "var(--text-muted)" }}>
                        {client.slug}
                      </span>
                    </td>

                    {/* Plan */}
                    <td className="px-4 py-3.5">
                      <PlanBadge plan={client.plan} />
                    </td>

                    {/* Industry */}
                    <td className="px-4 py-3.5">
                      <span className="text-sm text-[var(--text-secondary)]">{client.industry}</span>
                    </td>

                    {/* Compliance */}
                    <td className="px-4 py-3.5">
                      <ComplianceBar score={client.complianceScore} />
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3.5">
                      <StatusBadge status={client.status} />
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setSelectedClient(client)}
                          className="p-1.5 rounded transition-all duration-150 text-[var(--text-muted)] hover:text-accent hover:bg-accent-subtle"
                          title="View details"
                        >
                          <IconEye />
                        </button>
                        <button
                          onClick={() => setSelectedClient(client)}
                          className="p-1.5 rounded transition-all duration-150 text-[var(--text-muted)] hover:text-[var(--low-text)] hover:bg-[var(--low-bg)]"
                          title="Edit client"
                        >
                          <IconEdit />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Bottom bar */}
        <div
          className="flex items-center justify-between px-4 py-3"
          style={{ borderTop: "1px solid var(--border)", background: "var(--bg)" }}
        >
          <p className="font-mono text-[10px] text-[var(--text-muted)]">
            SHOWING {filteredClients.length} OF {clients.length} RECORDS
          </p>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--accent)" }} />
              <span className="font-mono text-[10px] text-[var(--text-muted)]">
                {clients.filter((c) => c.status === "active").length} ACTIVE
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--critical)" }} />
              <span className="font-mono text-[10px] text-[var(--text-muted)]">
                {clients.filter((c) => c.status === "suspended").length} SUSPENDED
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Onboarding Modal */}
      {showOnboarding && (
        <OnboardingModal
          onClose={() => setShowOnboarding(false)}
          onCreated={refreshClients}
        />
      )}

      {/* Client Detail Slide-Out */}
      {selectedClient && (
        <ClientSlideOut
          client={selectedClient}
          onClose={() => setSelectedClient(null)}
          onSaved={refreshClients}
        />
      )}
    </div>
  );
}
