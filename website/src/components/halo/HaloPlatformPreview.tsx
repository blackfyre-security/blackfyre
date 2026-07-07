"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { COMPLIANCE_SCORES } from "@/lib/halo-data";
import { useTicker } from "@/lib/halo-hooks";

type PlatformTab = "posture" | "compliance" | "evidence" | "agents";

const TABS: readonly PlatformTab[] = ["posture", "compliance", "evidence", "agents"];

interface Feature {
  t: string;
  d: string;
}

const FEATURES: readonly Feature[] = [
  { t: "Multi-cloud scanning", d: "AWS, Azure, GCP + on-prem" },
  { t: "Evidence vault", d: "SHA-256, WORM, tamper-evident" },
  { t: "AI remediation", d: "Drafts playbooks; humans approve" },
  { t: "Drift detection", d: "Real-time config-change alerts" },
];

export interface HaloPlatformPreviewProps {
  className?: string;
}

/**
 * Product shot preview: copy column on the left, a styled "app window"
 * on the right with tabs, a big score, an inline sparkline path, and
 * live-animating compliance bars driven by a shared ticker.
 */
export default function HaloPlatformPreview({ className }: HaloPlatformPreviewProps) {
  const [activeTab, setActiveTab] = useState<PlatformTab>("posture");
  const tick = useTicker(1, 999, 800);

  return (
    <section
      className={[
        "border-b border-border px-6 py-24 sm:px-12",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="mx-auto max-w-[1280px]">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2 lg:gap-[72px]">
          {/* Copy column */}
          <div>
            <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-accent">
              02 · PLATFORM
            </div>
            <h2 className="my-5 font-display text-[44px] font-medium leading-[1.02] tracking-display text-text sm:text-[56px]">
              One dashboard. <br />
              <span className="text-text-muted">Every </span>
              <span className="italic font-normal">signal.</span>
            </h2>
            <p className="max-w-[480px] font-sans text-[17px] leading-[1.6] text-text-muted">
              Live posture, compliance scores, and agent activity — rendered
              from a single source of evidence. Export an auditor bundle in one
              click.
            </p>

            <div className="mt-8 grid gap-2.5">
              {FEATURES.map((f) => (
                <div key={f.t} className="flex items-start gap-3">
                  <span className="mt-0.5 text-accent" aria-hidden="true">
                    <Check size={16} strokeWidth={1.6} />
                  </span>
                  <div>
                    <div className="font-sans text-[15px] font-medium text-text">
                      {f.t}
                    </div>
                    <div className="font-sans text-[13.5px] text-text-muted">
                      {f.d}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Product shot */}
          <div
            className="relative overflow-hidden rounded-[14px] border border-border-strong bg-surface shadow-halo-lift"
          >
            {/* Window chrome */}
            <div className="flex items-center gap-1.5 border-b border-border bg-surface-alt px-3.5 py-3">
              <span className="h-2.5 w-2.5 rounded-full bg-border" />
              <span className="h-2.5 w-2.5 rounded-full bg-border" />
              <span className="h-2.5 w-2.5 rounded-full bg-border" />
              <span className="ml-2.5 font-mono text-[10.5px] text-text-dim">
                app.blackfyre.tech/posture
              </span>
            </div>
            {/* Tabs */}
            <div
              className="flex border-b border-border px-3.5"
              role="tablist"
              aria-label="Platform sections"
            >
              {TABS.map((t) => {
                const active = activeTab === t;
                return (
                  <button
                    key={t}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setActiveTab(t)}
                    className="cursor-pointer border-0 bg-transparent px-3.5 pt-[14px] pb-3 font-sans text-xs font-medium capitalize"
                    style={{
                      color: active ? "var(--text)" : "var(--muted)",
                      borderBottom: `2px solid ${active ? "var(--accent)" : "transparent"}`,
                    }}
                  >
                    {t}
                  </button>
                );
              })}
            </div>

            {/* Body */}
            <div className="p-[18px]">
              <div className="mb-3.5 flex items-baseline justify-between">
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-text-dim">
                    Posture score
                  </div>
                  <div className="font-sans text-[42px] font-medium leading-none tracking-[-0.02em] text-text">
                    97.4
                    <span className="text-[22px] text-text-muted">/100</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 font-mono text-[11px] text-accent">
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ background: "var(--accent)" }}
                  />
                  +2.4 this week
                </div>
              </div>

              {/* Static sparkline — trend illustration only */}
              <div className="relative mb-5 h-[60px]">
                <svg
                  viewBox="0 0 300 60"
                  width="100%"
                  height="60"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  <path
                    d="M 0 50 L 20 42 L 40 45 L 60 36 L 80 30 L 100 32 L 120 22 L 140 28 L 160 18 L 180 14 L 200 22 L 220 15 L 240 8 L 260 12 L 280 6 L 300 10"
                    fill="none"
                    stroke="var(--accent)"
                    strokeWidth="1.5"
                  />
                  <path
                    d="M 0 50 L 20 42 L 40 45 L 60 36 L 80 30 L 100 32 L 120 22 L 140 28 L 160 18 L 180 14 L 200 22 L 220 15 L 240 8 L 260 12 L 280 6 L 300 10 L 300 60 L 0 60 Z"
                    fill="var(--accent)"
                    fillOpacity="0.13"
                  />
                </svg>
              </div>

              {/* Compliance bars */}
              <div className="grid gap-2.5">
                {COMPLIANCE_SCORES.slice(0, 4).map((r, i) => {
                  // Gentle pulse on the bar width so the dashboard feels live.
                  const pulsed = Math.min(
                    r.pct,
                    r.pct * (0.5 + ((tick + i * 3) % 10) / 20)
                  );
                  return (
                    <div
                      key={r.fw}
                      className="grid grid-cols-[110px_1fr_44px] items-center gap-3"
                    >
                      <div className="font-sans text-xs font-medium text-text">
                        {r.fw}
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-[3px] bg-border">
                        <div
                          className="h-full"
                          style={{
                            width: `${pulsed}%`,
                            background:
                              r.pct > 96 ? "var(--accent)" : "var(--warn)",
                            transition: "width 800ms cubic-bezier(.2,.7,.3,1)",
                          }}
                        />
                      </div>
                      <div className="text-right font-mono text-[11px] text-text-muted">
                        {r.pct}%
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
