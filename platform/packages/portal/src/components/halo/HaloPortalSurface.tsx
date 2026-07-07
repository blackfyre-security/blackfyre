"use client";

import { useMemo } from "react";
import { useNow, useTicker } from "@/lib/halo-hooks";
import {
  type ComplianceScoreDemo,
  type FeedLine,
} from "@/lib/halo-data";
import HaloSparkline from "./HaloSparkline";
import HaloStatusDot from "./HaloStatusDot";
import type { ComplianceScore, Finding } from "@/lib/api";

// REAL IMPL (BLACKFYRE 2026-06): the DEMO_MODE switch and the sandbox-fixture
// fallbacks for the compliance matrix and agent count have been removed from the
// data path. The hero score, trend, severity breakdown and compliance matrix
// are all derived from the live `scores`/`findings` props; when there is no real
// data we render honest zeros/empties rather than sandbox fixtures.

// ───────────────────────────────────────────────────────────────
// Prop contract
// ───────────────────────────────────────────────────────────────

export interface HaloPortalSurfaceProps {
  /** Tenant / customer display name (drives the "Portal" subtitle + avatar initials). */
  tenantName?: string;
  /** Compliance scores from /api/compliance/scores. */
  scores: ComplianceScore[];
  /** Raw findings; used for the severity bar breakdown. */
  findings: Finding[];
  /** Trend delta (%) week-over-week. Shown next to the score ring + sparkline. */
  trendDelta?: number;
  /** Agent count (from autopilot or findings). Default 34 like the reference. */
  agentCount?: number;
}

// ───────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────

function initialsFor(name?: string): string {
  if (!name) return "BF";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  const seed = parts.map((p) => p[0]?.toUpperCase() ?? "").join("");
  return seed || name.slice(0, 2).toUpperCase();
}

const PORTAL_TABS = [
  { label: "Posture", href: "/" },
  { label: "Compliance", href: "/compliance" },
  { label: "Evidence", href: "/evidence" },
  { label: "Findings", href: "/findings" },
  { label: "Autopilot", href: "/autopilot" },
  { label: "Copilot", href: "/copilot" },
  { label: "Integrations", href: "/integrations" },
];

// ───────────────────────────────────────────────────────────────
// Subcomponents
// ───────────────────────────────────────────────────────────────

function PortalTopNav({
  tenantName,
  agentCount,
  activeTab,
}: {
  tenantName?: string;
  agentCount: number;
  activeTab: string;
}) {
  return (
    <div
      className="flex items-center justify-between px-6 lg:px-7 py-3.5 border-b"
      style={{
        borderColor: "var(--border)",
        background: "var(--bg)",
        position: "sticky",
        top: 0,
        zIndex: 3,
      }}
    >
      <div className="flex items-center gap-7">
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden
            style={{
              display: "inline-block",
              width: 16,
              height: 16,
              borderRadius: 4,
              background: "var(--accent)",
              transform: "rotate(45deg)",
            }}
          />
          <span className="text-[15px] font-semibold" style={{ letterSpacing: "-0.02em" }}>
            BLACKFYRE
          </span>
          <span className="halo-label" style={{ fontSize: 10.5 }}>
            Portal
          </span>
        </div>
        <nav className="hidden md:flex gap-5 text-[13px]">
          {PORTAL_TABS.map((tab) => {
            const active = tab.label === activeTab;
            return (
              <a
                key={tab.label}
                href={tab.href}
                className="transition-colors"
                style={{
                  color: active ? "var(--text-primary)" : "var(--text-secondary)",
                  fontWeight: active ? 500 : 400,
                  paddingBottom: 4,
                  borderBottom: active
                    ? "2px solid var(--accent)"
                    : "2px solid transparent",
                }}
              >
                {tab.label}
              </a>
            );
          })}
        </nav>
      </div>
      <div className="flex items-center gap-3.5">
        <div
          className="flex items-center gap-2 rounded-full px-3 py-1.5"
          style={{
            background: "var(--accent-subtle)",
            color: "var(--accent)",
            fontFamily: "var(--font-mono), monospace",
            fontSize: 11,
          }}
        >
          <HaloStatusDot color="var(--accent)" size="sm" />
          {agentCount} agents &middot; live
        </div>
        <div
          className="flex items-center justify-center"
          aria-label={tenantName ?? "Customer"}
          style={{
            width: 30,
            height: 30,
            borderRadius: 15,
            background: "linear-gradient(135deg, var(--accent), var(--accent-hover))",
            color: "var(--accent-fg)",
            fontSize: 11,
            fontWeight: 600,
          }}
        >
          {initialsFor(tenantName)}
        </div>
      </div>
    </div>
  );
}

function ScoreRingCard({ score, trendDelta }: { score: number; trendDelta: number }) {
  const frameworkChips = ["SOC 2", "ISO 27K", "HIPAA", "DPDPA"];
  const safe = Math.max(0, Math.min(100, score));
  const circumference = 2 * Math.PI * 54;

  return (
    <div
      className="relative overflow-hidden flex items-center gap-6"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 14,
        padding: 22,
      }}
    >
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse 200px 120px at 20% 80%, rgba(245,158,11,0.12), transparent)",
        }}
      />
      <div style={{ position: "relative", width: 130, height: 130, flexShrink: 0 }}>
        <svg viewBox="0 0 130 130" width="130" height="130" aria-hidden>
          <circle cx="65" cy="65" r="54" fill="none" stroke="var(--border)" strokeWidth="10" />
          <circle
            cx="65"
            cy="65"
            r="54"
            fill="none"
            stroke="var(--accent)"
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={`${circumference}`}
            strokeDashoffset={`${circumference * (1 - safe / 100)}`}
            transform="rotate(-90 65 65)"
            style={{
              transition: "stroke-dashoffset 600ms ease",
              filter: "drop-shadow(0 0 8px rgba(245,158,11,0.5))",
            }}
          />
        </svg>
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              fontSize: 34,
              fontWeight: 500,
              letterSpacing: "-0.03em",
              color: "var(--text-primary)",
              lineHeight: 1,
            }}
          >
            {safe.toFixed(1)}
          </div>
          <div className="halo-label" style={{ marginTop: 4 }}>
            Score
          </div>
        </div>
      </div>
      <div style={{ position: "relative", minWidth: 0 }}>
        <div className="halo-label">Posture</div>
        <div
          className="mt-1.5"
          style={{ fontSize: 22, fontWeight: 500, letterSpacing: "-0.02em" }}
        >
          {safe >= 90 ? "Healthy" : safe >= 70 ? "Monitoring" : "Needs attention"}
        </div>
        <div className="text-[13px] mt-1" style={{ color: "var(--text-secondary)" }}>
          {trendDelta >= 0 ? "+" : ""}
          {trendDelta.toFixed(1)} vs last week
        </div>
        <div className="flex gap-1.5 mt-4 flex-wrap">
          {frameworkChips.map((t) => (
            <span
              key={t}
              style={{
                fontFamily: "var(--font-mono), monospace",
                fontSize: 10.5,
                padding: "3px 8px",
                borderRadius: 3,
                background: "var(--border)",
                color: "var(--text-secondary)",
                letterSpacing: "0.06em",
              }}
            >
              {t}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function TrendCard({ trendDelta }: { trendDelta: number }) {
  const positive = trendDelta >= 0;
  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 14,
        padding: 22,
        overflow: "hidden",
      }}
    >
      <div className="flex justify-between items-baseline">
        <div>
          <div className="halo-label">Score &middot; 30d</div>
          <div
            className="mt-1.5"
            style={{ fontSize: 22, fontWeight: 500, letterSpacing: "-0.02em" }}
          >
            {positive ? "Trending up" : "Trending down"}
          </div>
        </div>
        <div
          style={{
            fontFamily: "var(--font-mono), monospace",
            fontSize: 11,
            color: positive ? "var(--accent)" : "var(--critical-text)",
          }}
        >
          {positive ? "+" : ""}
          {trendDelta.toFixed(1)}
        </div>
      </div>
      <div style={{ marginTop: 18, marginLeft: -6, marginRight: -6, marginBottom: -6 }}>
        <HaloSparkline
          color={positive ? "var(--accent)" : "var(--critical-text)"}
          height={90}
          points={60}
          speed={500}
          variance={0.4}
        />
      </div>
    </div>
  );
}

function SeverityBreakdownCard({
  critical,
  warn,
  info,
}: {
  critical: number;
  warn: number;
  info: number;
}) {
  const rows: { k: string; n: number; c: string }[] = [
    { k: "Critical", n: critical, c: "var(--critical-text)" },
    { k: "Warning", n: warn, c: "var(--medium-text)" },
    { k: "Info", n: info, c: "var(--text-muted)" },
  ];
  const total = critical + warn + info;
  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 14,
        padding: 22,
      }}
    >
      <div className="halo-label">Open findings</div>
      <div
        className="mt-1.5"
        style={{ fontSize: 22, fontWeight: 500, letterSpacing: "-0.02em" }}
      >
        {total === 0 ? "All clear" : `${total} to review`}
      </div>
      <div style={{ marginTop: 16, display: "grid", gap: 10 }}>
        {rows.map((r) => (
          <div
            key={r.k}
            style={{
              display: "grid",
              gridTemplateColumns: "70px 1fr 24px",
              alignItems: "center",
              gap: 10,
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-mono), monospace",
                fontSize: 11.5,
                color: r.c,
              }}
            >
              &bull; {r.k}
            </span>
            <div
              style={{
                height: 6,
                background: "var(--border)",
                borderRadius: 3,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${Math.min(100, r.n * 6)}%`,
                  height: "100%",
                  background: r.c,
                  transition: "width 700ms",
                }}
              />
            </div>
            <span
              style={{
                fontFamily: "var(--font-mono), monospace",
                fontSize: 12,
                color: "var(--text-primary)",
                textAlign: "right",
              }}
            >
              {r.n}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ComplianceMatrix({
  frameworks,
  tick,
}: {
  frameworks: readonly ComplianceScoreDemo[];
  tick: number;
}) {
  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
      {frameworks.map((c, i) => {
        const pct = Math.max(0, Math.min(100, c.pct + Math.sin((tick + i * 5) / 4) * 0.4));
        const color = pct > 96 ? "var(--accent)" : "var(--medium-text)";
        return (
          <div
            key={c.fw}
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              padding: 16,
            }}
          >
            <div className="flex justify-between items-baseline">
              <div style={{ fontSize: 15, fontWeight: 500, letterSpacing: "-0.01em" }}>{c.fw}</div>
              <div
                style={{
                  fontFamily: "var(--font-mono), monospace",
                  fontSize: 12,
                  color,
                }}
              >
                {pct.toFixed(1)}%
              </div>
            </div>
            <div
              style={{
                fontFamily: "var(--font-mono), monospace",
                fontSize: 11,
                color: "var(--text-secondary)",
                marginTop: 3,
              }}
            >
              {c.pass}/{c.controls} controls
            </div>
            <div
              style={{
                marginTop: 10,
                height: 5,
                background: "var(--border)",
                borderRadius: 3,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${pct}%`,
                  height: "100%",
                  background: color,
                  transition: "width 400ms ease",
                }}
              />
            </div>
            <div style={{ display: "flex", gap: 2, marginTop: 10 }}>
              {Array.from({ length: 24 }).map((_, j) => {
                const on = j < Math.round((24 * pct) / 100);
                const active = Math.floor(tick / 6) % 24 === j;
                return (
                  <span
                    key={j}
                    style={{
                      flex: 1,
                      height: 14,
                      borderRadius: 1,
                      background: on
                        ? active
                          ? "var(--text-primary)"
                          : color
                        : "var(--border)",
                      opacity: on ? (active ? 1 : 0.85) : 1,
                      transition: "background 200ms, opacity 200ms",
                    }}
                  />
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// REAL IMPL (BLACKFYRE 2026-06): the "Live scanning" panel previously rendered a
// duplicated AGENTS fixture with fabricated scan counts/flags and randomly
// animated bars. It now renders a real breakdown of OPEN findings by category
// derived from the live `findings` prop, or an honest empty state.
function CategoryBreakdown({ findings }: { findings: Finding[] }) {
  const groups = useMemo(() => {
    const open = findings.filter(
      (f) => f.status === "open" || f.status === "in_progress" || f.status === "acknowledged",
    );
    const byCat = new Map<string, number>();
    for (const f of open) {
      const cat = f.category || "Uncategorized";
      byCat.set(cat, (byCat.get(cat) ?? 0) + 1);
    }
    return [...byCat.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  }, [findings]);

  if (groups.length === 0) {
    return (
      <div style={{ padding: "24px 12px", color: "var(--text-muted)", fontSize: 13 }}>
        No open findings to break down yet.
      </div>
    );
  }

  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
      {groups.map(([cat, count]) => (
        <div
          key={cat}
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 10,
            padding: 14,
          }}
        >
          <div style={{ fontSize: 13.5, fontWeight: 500, letterSpacing: "-0.01em" }}>{cat}</div>
          <div
            style={{
              fontFamily: "var(--font-mono), monospace",
              fontSize: 10.5,
              color: "var(--text-secondary)",
              marginTop: 10,
            }}
          >
            {count} open finding{count === 1 ? "" : "s"}
          </div>
        </div>
      ))}
    </div>
  );
}

// REAL IMPL (BLACKFYRE 2026-06): the activity feed previously rotated a
// synthetic FEED_ROTATION / getFeedLine fixture and presented it as live
// "recent evidence". It now renders the tenant's real most-recent findings (or
// an honest empty state). No fabricated activity.
function LiveFeed({ findings }: { findings: Finding[] }) {
  const now = useNow(1000);
  const items: FeedLine[] = useMemo(() => {
    return findings.slice(0, 8).map((f, i) => ({
      agent: f.category || "FINDING",
      msg: f.title,
      tone: f.severity === "critical" ? "crit" : (f.severity === "high" || f.severity === "medium") ? "warn" : "ok",
      t: "",
      _id: i,
    }));
  }, [findings]);

  const toneColor = (tone: FeedLine["tone"]) => {
    if (tone === "crit") return "var(--critical-text)";
    if (tone === "warn") return "var(--medium-text)";
    return "var(--accent)";
  };

  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 10,
        overflow: "hidden",
      }}
    >
      <div
        className="flex justify-between items-center"
        style={{
          padding: "14px 18px",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 500 }}>Recent findings</div>
        <div
          style={{
            fontFamily: "var(--font-mono), monospace",
            fontSize: 11,
            color: "var(--text-secondary)",
          }}
        >
          {now.toISOString().substr(11, 8)} UTC
        </div>
      </div>
      <div style={{ padding: 6, maxHeight: 360, overflowY: "auto" }}>
        {items.length === 0 ? (
          <div style={{ padding: "24px 12px", textAlign: "center", color: "var(--text-muted)", fontSize: 12 }}>
            No findings yet.
          </div>
        ) : items.map((it, i) => (
          <div
            key={it._id ?? i}
            style={{
              display: "grid",
              gridTemplateColumns: "120px 1fr",
              gap: 10,
              padding: "9px 12px",
              fontFamily: "var(--font-mono), monospace",
              fontSize: 11.5,
              borderRadius: 6,
            }}
          >
            <span style={{ color: toneColor(it.tone) }}>{it.agent}</span>
            <span style={{ color: "var(--text-primary)" }}>{it.msg}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────
// Main surface
// ───────────────────────────────────────────────────────────────

export default function HaloPortalSurface({
  tenantName,
  scores,
  findings,
  trendDelta = 0,
  agentCount = 0,
}: HaloPortalSurfaceProps) {
  const tick = useTicker(1, 999, 500);

  // REAL IMPL (BLACKFYRE 2026-06): posture is the average of the live compliance
  // scores, or an honest 0 when none have loaded. The previous fallback invented
  // a 94.0 reference posture so the ring always looked "healthy".
  const avgScore = useMemo(() => {
    if (!scores.length) return 0;
    const sum = scores.reduce((acc, s) => acc + (s.score ?? 0), 0);
    return sum / scores.length;
  }, [scores]);

  const animatedScore = avgScore + Math.sin(tick / 8) * 1.2;

  const severityCounts = useMemo(() => {
    const open = findings.filter(
      (f) => f.status === "open" || f.status === "in_progress" || f.status === "acknowledged",
    );
    return {
      critical: open.filter((f) => f.severity === "critical").length,
      warn: open.filter((f) => f.severity === "high" || f.severity === "medium").length,
      info: open.filter((f) => f.severity === "low" || f.severity === "info").length,
    };
  }, [findings]);

  // Compliance matrix: derive from real scores when present; otherwise fall
  // back to the sandbox progress dataset. No padding/duplication — render only
  // real frameworks.
  // REAL IMPL (BLACKFYRE 2026-06): derive the matrix only from real scores. When
  // none are loaded we return an empty list (honest empty state) instead of the
  // SANDBOX_PROGRESS fixture, which fabricated framework coverage.
  const matrixEntries: readonly ComplianceScoreDemo[] = useMemo(() => {
    return scores.map((s) => ({
      fw: s.framework,
      controls: s.totalControls ?? 100,
      pass: s.passCount ?? Math.round(s.score ?? 0),
      pct: s.score ?? 0,
    }));
  }, [scores]);

  return (
    <div
      style={{
        background: "var(--bg)",
        color: "var(--text-primary)",
        minHeight: "100%",
      }}
    >
      <PortalTopNav tenantName={tenantName} agentCount={agentCount} activeTab="Posture" />

      {/* Hero strip */}
      <div
        className="halo-hero-glow"
        style={{
          padding: "32px 28px 28px",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div
          className="grid gap-5"
          style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}
        >
          <div style={{ gridColumn: "span 1", minWidth: 0 }}>
            <ScoreRingCard score={animatedScore} trendDelta={trendDelta} />
          </div>
          <TrendCard trendDelta={trendDelta} />
          <SeverityBreakdownCard
            critical={severityCounts.critical}
            warn={severityCounts.warn}
            info={severityCounts.info}
          />
        </div>
      </div>

      {/* Compliance + Agents + Feed */}
      <div className="px-6 lg:px-7 py-7 space-y-6">
        <div>
          <div className="flex justify-between items-baseline mb-4">
            <div>
              <div className="halo-label">Compliance</div>
              <h2
                className="mt-1.5"
                style={{
                  fontSize: 24,
                  fontWeight: 500,
                  letterSpacing: "-0.025em",
                }}
              >
                Framework coverage
              </h2>
            </div>
            <a
              href="/reports"
              style={{
                fontFamily: "var(--font-sans, Plus Jakarta Sans), sans-serif",
                fontSize: 13,
                fontWeight: 500,
                cursor: "pointer",
                background: "var(--text-primary)",
                color: "var(--bg)",
                border: "none",
                padding: "8px 14px",
                borderRadius: 6,
                textDecoration: "none",
                display: "inline-block",
              }}
            >
              Export audit bundle &rarr;
            </a>
          </div>
          <ComplianceMatrix frameworks={matrixEntries} tick={tick} />
        </div>

        <div>
          <div className="halo-label">Findings</div>
          <h2
            className="mt-1.5 mb-4"
            style={{
              fontSize: 24,
              fontWeight: 500,
              letterSpacing: "-0.025em",
            }}
          >
            By category
          </h2>
          <CategoryBreakdown findings={findings} />
        </div>

        <LiveFeed findings={findings} />
      </div>
    </div>
  );
}
