"use client";

import { useMemo, useState } from "react";
import type { EffectiveFeature, FeatureTier } from "@/lib/api";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Props {
  features: EffectiveFeature[];
  onChange: (key: string, enabled: boolean) => void;
  readOnly?: boolean;
}

const TIER_ORDER: FeatureTier[] = ["Comply", "Protect", "Defend"];

const TIER_COLORS: Record<FeatureTier, { bg: string; text: string; border: string }> = {
  Comply: { bg: "var(--accent-subtle)", text: "var(--accent)", border: "rgba(99,102,241,0.3)" },
  Protect: { bg: "var(--info-bg)", text: "var(--info-text)", border: "rgba(139,92,246,0.3)" },
  Defend: { bg: "var(--success-bg)", text: "var(--success-text)", border: "rgba(34,197,94,0.3)" },
};

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function ToggleSwitch({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="relative shrink-0 rounded-full transition-all duration-200"
      style={{
        width: 34,
        height: 20,
        background: checked ? "var(--accent)" : "var(--border)",
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
        boxShadow: checked ? "0 0 8px rgba(99,102,241,0.45)" : "none",
      }}
    >
      <span
        className="absolute top-0.5 rounded-full transition-all duration-200"
        style={{
          width: 16,
          height: 16,
          left: checked ? 16 : 2,
          background: "#fff",
          boxShadow: "0 1px 3px rgba(0,0,0,0.35)",
        }}
      />
    </button>
  );
}

function IconChevron({ open }: { open: boolean }) {
  return (
    <svg
      width={14}
      height={14}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ transform: open ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 200ms ease" }}
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export default function FeatureToggleMatrix({ features, onChange, readOnly }: Props) {
  const grouped = useMemo(() => {
    const map: Record<FeatureTier, EffectiveFeature[]> = { Comply: [], Protect: [], Defend: [] };
    for (const f of features) {
      if (map[f.tier]) map[f.tier].push(f);
    }
    return map;
  }, [features]);

  const [openTiers, setOpenTiers] = useState<Record<FeatureTier, boolean>>({
    Comply: true,
    Protect: true,
    Defend: true,
  });

  return (
    <div className="space-y-3">
      {TIER_ORDER.map((tier) => {
        const tierFeatures = grouped[tier];
        if (tierFeatures.length === 0) return null;
        const colors = TIER_COLORS[tier];
        const enabledCount = tierFeatures.filter((f) => f.enabled).length;
        const isOpen = openTiers[tier];

        return (
          <div
            key={tier}
            className="rounded-md overflow-hidden transition-all duration-200"
            style={{ background: "var(--surface-raised)", border: "1px solid var(--border)" }}
          >
            {/* Tier Header */}
            <button
              type="button"
              onClick={() => setOpenTiers((prev) => ({ ...prev, [tier]: !prev[tier] }))}
              className="w-full flex items-center justify-between px-4 py-3 transition-colors hover:bg-[var(--hover-bg)]"
            >
              <div className="flex items-center gap-3">
                <span style={{ color: "var(--text-muted)" }}>
                  <IconChevron open={isOpen} />
                </span>
                <span
                  className="font-mono text-[11px] font-semibold uppercase tracking-wider px-2.5 py-0.5 rounded-md"
                  style={{ background: colors.bg, color: colors.text, border: `1px solid ${colors.border}` }}
                >
                  {tier}
                </span>
                <span className="text-[13px] font-medium" style={{ color: "var(--text-primary)" }}>
                  {tierFeatures.length} feature{tierFeatures.length !== 1 ? "s" : ""}
                </span>
              </div>
              <span
                className="font-mono text-[11px]"
                style={{ color: enabledCount === tierFeatures.length ? colors.text : "var(--text-muted)" }}
              >
                {enabledCount}/{tierFeatures.length} ON
              </span>
            </button>

            {/* Feature Rows */}
            {isOpen && (
              <div style={{ borderTop: "1px solid var(--border)" }}>
                {tierFeatures.map((feature, idx) => (
                  <div
                    key={feature.key}
                    className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-[var(--hover-bg)]"
                    style={{
                      borderBottom:
                        idx < tierFeatures.length - 1 ? "1px solid var(--border-subtle)" : "none",
                    }}
                  >
                    <div className="pt-0.5">
                      <ToggleSwitch
                        checked={feature.enabled}
                        onChange={(next) => onChange(feature.key, next)}
                        disabled={readOnly}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className="text-[13px] font-semibold"
                          style={{ color: "var(--text-primary)" }}
                        >
                          {feature.name}
                        </span>
                        {feature.source === "override" && (
                          <span
                            className="font-mono text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded"
                            style={{
                              background: "var(--medium-bg)",
                              color: "var(--medium-text)",
                              border: "1px solid var(--medium)",
                            }}
                          >
                            OVERRIDE
                          </span>
                        )}
                      </div>
                      <p
                        className="text-[12px] mt-0.5 leading-relaxed"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {feature.description}
                      </p>
                    </div>
                    <span
                      className="shrink-0 text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded"
                      style={{
                        background: "var(--surface)",
                        color: "var(--text-muted)",
                        border: "1px solid var(--border)",
                      }}
                    >
                      {feature.category}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
