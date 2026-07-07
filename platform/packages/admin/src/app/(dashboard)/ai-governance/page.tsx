"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";

// ---- Types ----

type AlertSeverity = "critical" | "high" | "medium" | "low";
type DecisionStatus = "approved" | "rejected" | "pending";
type TrendDir = "up" | "down" | "stable";

interface EthicsAlert {
  id: string;
  severity: AlertSeverity;
  title: string;
  model: string;
  timestamp: string;
  description: string;
}

interface AIDecision {
  id: string;
  type: string;
  model: string;
  version: string;
  confidence: number;
  humanApproved: DecisionStatus;
  timestamp: string;
  client: string;
}

interface ISOCategory {
  name: string;
  controls: number;
  passed: number;
  score: number;
}

interface BiasDimension {
  label: string;
  score: number;
  benchmark: number;
}

interface TrendPoint {
  month: string;
  score: number;
}

// REAL IMPL (BLACKFYRE 2026-06): the DEFAULT_* constants have been removed.
// State now initialises to genuinely-empty collections (`[]`) / `0` and is
// populated ONLY from the live API; nothing is pre-seeded with fabricated data.

// ---- Helpers ----

function scoreColor(score: number): string {
  if (score >= 80) return "var(--accent)";
  if (score >= 60) return "var(--medium)";
  return "var(--critical)";
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function severityConfig(severity: AlertSeverity | "info" | string | undefined) {
  switch (severity) {
    case "critical": return { color: "var(--critical)", bg: "var(--critical-bg)", label: "CRITICAL" };
    case "high":     return { color: "var(--high)", bg: "var(--high-bg)",  label: "HIGH" };
    case "medium":   return { color: "var(--medium)", bg: "var(--medium-bg)",  label: "MEDIUM" };
    case "low":      return { color: "var(--low)", bg: "var(--low-bg)",  label: "LOW" };
    case "info":     return { color: "var(--text-muted)", bg: "var(--surface-2)", label: "INFO" };
    default:         return { color: "var(--text-muted)", bg: "var(--surface-2)", label: String(severity ?? "UNKNOWN").toUpperCase() };
  }
}

function approvalConfig(status: DecisionStatus) {
  switch (status) {
    case "approved": return { color: "var(--success-text)", bg: "var(--success-bg)", label: "APPROVED" };
    case "rejected": return { color: "var(--critical-text)", bg: "var(--critical-bg)", label: "REJECTED" };
    case "pending":  return { color: "var(--medium-text)", bg: "var(--medium-bg)",  label: "PENDING" };
  }
}

// ---- Sub-components ----

function StatCard({
  label,
  value,
  sub,
  color,
  trend,
}: {
  label: string;
  value: string;
  sub: string;
  color: string;
  trend?: TrendDir;
}) {
  const trendSymbol = trend === "up" ? "▲" : trend === "down" ? "▼" : "◆";
  const trendColor = trend === "up" ? "var(--accent)" : trend === "down" ? "var(--critical)" : "var(--medium)";

  return (
    <div
      className="rounded-md p-5 relative overflow-hidden"
      style={{
        background: "var(--accent-subtle)",
        border: "1px solid var(--border-accent)",
        boxShadow: "var(--glow-card)",
      }}
    >
      <p
        className="font-mono text-[9px] uppercase tracking-[0.22em] mb-3"
        style={{ color: "var(--text-muted)" }}
      >
        {label}
      </p>
      <p
        className="font-mono text-3xl font-bold leading-none mb-2"
        style={{ color }}
      >
        {value}
      </p>
      <div className="flex items-center gap-2">
        <p className="font-mono text-[10px]" style={{ color: "var(--text-muted)" }}>
          {sub}
        </p>
        {trend && (
          <span className="font-mono text-[10px]" style={{ color: trendColor }}>
            {trendSymbol}
          </span>
        )}
      </div>
    </div>
  );
}

function ISOScoreRing({ score }: { score: number }) {
  const size = 120;
  const stroke = 8;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = scoreColor(score);

  return (
    <svg width={size} height={size}>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="var(--border-subtle)"
        strokeWidth={stroke}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{
          transition: "stroke-dashoffset 1s ease",
        }}
      />
      <text
        x="50%"
        y="44%"
        textAnchor="middle"
        dominantBaseline="central"
        fill={color}
        fontSize={26}
        fontFamily="'JetBrains Mono', 'Fira Code', monospace"
        fontWeight={700}
      >
        {score}
      </text>
      <text
        x="50%"
        y="66%"
        textAnchor="middle"
        dominantBaseline="central"
        fill="var(--text-muted)"
        fontSize={9}
        fontFamily="'JetBrains Mono', 'Fira Code', monospace"
      >
        / 100
      </text>
    </svg>
  );
}

function CategoryBar({ cat }: { cat: ISOCategory }) {
  const color = scoreColor(cat.score);
  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-1">
        <span className="font-mono text-[10px] tracking-wide" style={{ color: "var(--text-secondary)" }}>
          {cat.name}
        </span>
        <div className="flex items-center gap-3">
          <span className="font-mono text-[9px]" style={{ color: "var(--text-muted)" }}>
            {cat.passed}/{cat.controls}
          </span>
          <span className="font-mono text-[11px] font-bold w-8 text-right" style={{ color }}>
            {cat.score}
          </span>
        </div>
      </div>
      <div
        className="rounded-md overflow-hidden"
        style={{ height: 4, background: "var(--border)" }}
      >
        <div
          className="h-full rounded-md"
          style={{
            width: `${cat.score}%`,
            background: color,
            transition: "width 0.8s ease",
          }}
        />
      </div>
    </div>
  );
}

function BiasDimensionRow({ dim }: { dim: BiasDimension }) {
  const pct = dim.score;
  const benchmarkPct = dim.benchmark;
  const color = scoreColor(dim.score);
  const aboveBenchmark = dim.score >= dim.benchmark;

  return (
    <div className="mb-5">
      <div className="flex items-center justify-between mb-2">
        <span className="font-mono text-[10px] tracking-wide" style={{ color: "var(--text-secondary)" }}>
          {dim.label}
        </span>
        <div className="flex items-center gap-2">
          <span
            className="font-mono text-[9px] px-1.5 py-0.5 rounded"
            style={{
              color: aboveBenchmark ? "var(--success-text)" : "var(--medium-text)",
              background: aboveBenchmark ? "var(--success-bg)" : "var(--medium-bg)",
            }}
          >
            {aboveBenchmark ? "PASS" : "WATCH"}
          </span>
          <span className="font-mono text-[11px] font-bold" style={{ color }}>
            {pct}
          </span>
        </div>
      </div>
      <div className="relative rounded-md overflow-visible" style={{ height: 6, background: "var(--border)" }}>
        <div
          className="h-full rounded-md"
          style={{
            width: `${pct}%`,
            background: color,
            transition: "width 0.9s ease",
          }}
        />
        {/* Benchmark tick */}
        <div
          className="absolute top-1/2 -translate-y-1/2"
          style={{
            left: `${benchmarkPct}%`,
            width: 2,
            height: 12,
            background: "var(--text-muted)",
            borderRadius: 1,
          }}
        />
      </div>
      <div className="flex justify-end mt-1">
        <span className="font-mono text-[9px]" style={{ color: "var(--text-muted)" }}>
          benchmark {dim.benchmark}
        </span>
      </div>
    </div>
  );
}

function TrendBarChart({ points }: { points: TrendPoint[] }) {
  const maxScore = Math.max(...points.map((p) => p.score));
  const chartHeight = 80;

  return (
    <div className="flex items-end gap-3 h-[80px]">
      {points.map((pt, i) => {
        const barH = Math.round((pt.score / maxScore) * chartHeight);
        const isLatest = i === points.length - 1;
        const barColor = isLatest ? "var(--accent)" : "var(--accent-muted)";

        return (
          <div key={pt.month} className="flex-1 flex flex-col items-center justify-end gap-1" style={{ height: chartHeight }}>
            <span className="font-mono text-[9px]" style={{ color: isLatest ? "var(--accent)" : "var(--text-muted)" }}>
              {pt.score}
            </span>
            <div
              className="w-full rounded-sm"
              style={{
                height: barH,
                background: barColor,
                transition: "height 0.7s ease",
              }}
            />
          </div>
        );
      })}
    </div>
  );
}

// ---- Main Page ----

// REAL IMPL (BLACKFYRE 2026-06): the fabricated AI-governance datasets
// (DEMO_ALERTS — invented prompt-injection/PII security alerts naming HDFC Bank;
// DEMO_DECISIONS — AI decisions naming real companies with invented confidence
// scores; DEMO_ISO_CATEGORIES / DEMO_BIAS_DIMENSIONS / DEMO_TREND_POINTS) and
// the DEMO_MODE bypass have been removed. This dashboard is sourced only from
// the live API (api.getAIGovernance). Empty/error states are honest.

export default function AIGovernancePage() {
  const [alertFilter, setAlertFilter] = useState<AlertSeverity | "all">("all");
  const [decisionPage, setDecisionPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [alerts, setAlerts] = useState<EthicsAlert[]>([]);
  const [decisions, setDecisions] = useState<AIDecision[]>([]);
  const [isoCategories, setIsoCategories] = useState<ISOCategory[]>([]);
  const [biasDimensions, setBiasDimensions] = useState<BiasDimension[]>([]);
  const [trendPoints, setTrendPoints] = useState<TrendPoint[]>([]);
  const [overallEthicsScore, setOverallEthicsScore] = useState(0);
  const [fairnessScore, setFairnessScore] = useState(0);
  // REAL IMPL (BLACKFYRE 2026-06): the header previously showed a hardcoded
  // "Updated 09:14 UTC". We now stamp the real client-side fetch time so the
  // label reflects when this data was actually loaded.
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  // REAL IMPL (BLACKFYRE 2026-06): always load AI-governance data from the live
  // API. No demo bypass, no fabricated alerts/decisions/scores.
  useEffect(() => {
    Promise.all([api.getAIGovernance()])
      .then(([res]) => {
        const d = res.data ?? res;
        setAlerts(d.alerts ?? []);
        setDecisions(d.decisions ?? []);
        setIsoCategories(d.isoCategories ?? d.iso_categories ?? []);
        setBiasDimensions(d.biasDimensions ?? d.bias_dimensions ?? []);
        setTrendPoints(d.trendPoints ?? d.trend_points ?? []);
        setOverallEthicsScore(d.overallEthicsScore ?? d.overall_ethics_score ?? 0);
        setFairnessScore(d.fairnessScore ?? d.fairness_score ?? 0);
        setUpdatedAt(new Date());
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-2 border-[var(--accent)] border-t-transparent rounded-full" /></div>;
  if (error) return <div className="p-6 text-[var(--critical-text)]">Failed to load: {error}</div>;

  const isoOverallScore = isoCategories.length > 0
    ? Math.round(isoCategories.reduce((sum, c) => sum + c.score, 0) / isoCategories.length)
    : 0;

  const filteredAlerts =
    alertFilter === "all"
      ? alerts
      : alerts.filter((a) => a.severity === alertFilter);

  const PAGE_SIZE = 5;
  const pagedDecisions = decisions.slice(
    decisionPage * PAGE_SIZE,
    decisionPage * PAGE_SIZE + PAGE_SIZE
  );
  const totalPages = Math.ceil(decisions.length / PAGE_SIZE);

  const biasScore = biasDimensions.length > 0
    ? Math.round(biasDimensions.reduce((sum, d) => sum + d.score, 0) / biasDimensions.length)
    : 0;
  const humanOversightRate = decisions.length > 0
    ? Math.round(
        (decisions.filter((d) => d.humanApproved !== "pending").length / decisions.length) * 100
      )
    : 0;

  return (
    <div
      className="min-h-screen p-6 space-y-6"
      style={{ fontFamily: "'JetBrains Mono', 'Fira Code', monospace" }}
    >
      {/* Page Header */}
      <div className="flex items-start justify-between">
        <div>
          <div
            className="mono text-[11px] font-semibold"
            style={{ color: "var(--text-muted)", letterSpacing: "0.14em", textTransform: "uppercase" }}
          >
            Admin · AI Governance
          </div>
          <div className="flex items-center gap-3 mt-2">
            <AIBrainIcon />
            <h1
              className="text-[30px] font-semibold tracking-tight"
              style={{ color: "var(--text-primary)", letterSpacing: "-0.025em" }}
            >
              AI governance
            </h1>
          </div>
          <p className="mt-1.5 text-[13px]" style={{ color: "var(--text-secondary)" }}>
            ISO 42001 compliance · ethics monitoring · model oversight · bias assessment
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg"
            style={{
              background: "var(--accent-subtle)",
              border: "1px solid var(--border-accent)",
            }}
          >
            <span
              className="inline-block w-1.5 h-1.5 rounded-full"
              style={{ background: "var(--accent)" }}
            />
            <span className="font-mono text-[10px] text-accent tracking-widest">LIVE</span>
          </div>
          <div
            className="px-3 py-1.5 rounded-lg font-mono text-[10px]"
            style={{
              color: "var(--text-muted)",
              border: "1px solid var(--border)",
            }}
          >
            {updatedAt
              ? `Updated ${updatedAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" })} UTC`
              : "Updated —"}
          </div>
        </div>
      </div>

      {/* Section 1: Ethics Overview Stat Cards */}
      <section>
        <SectionLabel>Ethics Overview</SectionLabel>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard
            label="Overall Ethics Score"
            value={`${overallEthicsScore}`}
            sub="composite across all models"
            color={scoreColor(overallEthicsScore)}
            trend="up"
          />
          <StatCard
            label="Bias Score"
            value={`${biasScore}`}
            sub="avg across 5 dimensions"
            color={scoreColor(biasScore)}
            trend="stable"
          />
          <StatCard
            label="Fairness Score"
            value={`${fairnessScore}`}
            sub="demographic parity target"
            color={scoreColor(fairnessScore)}
            trend="up"
          />
          <StatCard
            label="Human Oversight Rate"
            value={`${humanOversightRate}%`}
            sub="decisions reviewed by humans"
            color={humanOversightRate >= 80 ? "var(--accent)" : "var(--medium)"}
            trend={humanOversightRate >= 80 ? "up" : "down"}
          />
        </div>
      </section>

      {/* Section 2: ISO 42001 + Trend Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ISO 42001 Compliance */}
        <div
          className="lg:col-span-2 rounded-md p-5"
          style={{
            background: "var(--accent-subtle)",
            border: "1px solid var(--border)",
            boxShadow: "var(--glow-card)",
          }}
        >
          <SectionLabel>ISO 42001 Compliance</SectionLabel>
          <div className="flex items-start gap-8">
            {/* Score ring + label */}
            <div className="flex flex-col items-center gap-2 shrink-0">
              <ISOScoreRing score={isoOverallScore} />
              <p className="font-mono text-[9px] uppercase tracking-[0.2em]" style={{ color: "var(--text-muted)" }}>
                Overall
              </p>
              <div
                className="px-2 py-0.5 rounded font-mono text-[9px] uppercase tracking-wider"
                style={{
                  color: scoreColor(isoOverallScore),
                  background: `${scoreColor(isoOverallScore)}15`,
                  border: `1px solid ${scoreColor(isoOverallScore)}30`,
                }}
              >
                {isoOverallScore >= 80 ? "Compliant" : isoOverallScore >= 60 ? "Partial" : "Non-compliant"}
              </div>
            </div>
            {/* Category bars */}
            <div className="flex-1 pt-1">
              {isoCategories.map((cat) => (
                <CategoryBar key={cat.name} cat={cat} />
              ))}
            </div>
          </div>
        </div>

        {/* Ethics Trend Chart */}
        <div
          className="rounded-md p-5"
          style={{
            background: "var(--accent-subtle)",
            border: "1px solid var(--border)",
            boxShadow: "var(--glow-card)",
          }}
        >
          <SectionLabel>Ethics Score Trend</SectionLabel>
          <TrendBarChart points={trendPoints} />
          <div className="flex justify-between mt-3">
            {trendPoints.map((pt, i) => (
              <span
                key={pt.month}
                className="font-mono text-[9px] text-center flex-1"
                style={{ color: i === trendPoints.length - 1 ? "var(--accent)" : "var(--text-muted)" }}
              >
                {pt.month}
              </span>
            ))}
          </div>
          <div
            className="mt-4 pt-4 space-y-2"
            style={{ borderTop: "1px solid var(--border-subtle)" }}
          >
            <div className="flex justify-between">
              <span className="font-mono text-[9px]" style={{ color: "var(--text-muted)" }}>6-month delta</span>
              <span className="font-mono text-[10px]" style={{ color: "var(--accent)" }}>
                {trendPoints.length >= 2 ? `+${trendPoints[trendPoints.length - 1].score - trendPoints[0].score} pts ▲` : "—"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="font-mono text-[9px]" style={{ color: "var(--text-muted)" }}>Current score</span>
              <span className="font-mono text-[10px]" style={{ color: "var(--accent)" }}>
                {trendPoints.length > 0 ? trendPoints[trendPoints.length - 1].score : "—"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Section 3: AI Decision Log + Bias Assessment */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* AI Decision Log */}
        <div
          className="xl:col-span-2 rounded-md overflow-hidden"
          style={{
            background: "var(--accent-subtle)",
            border: "1px solid var(--border)",
            boxShadow: "var(--glow-card)",
          }}
        >
          <div className="px-5 pt-5 pb-3">
            <SectionLabel>AI Decision Log</SectionLabel>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                  {["Decision Type", "Model", "Version", "Confidence", "Status", "Client", "Time"].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-2.5 text-left font-mono text-[9px] uppercase tracking-[0.18em]"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pagedDecisions.map((dec, idx) => {
                  const approval = approvalConfig(dec.humanApproved);
                  const confColor = scoreColor(dec.confidence);
                  const isEven = idx % 2 === 0;
                  return (
                    <tr
                      key={dec.id}
                      className="transition-colors duration-150 group"
                      style={{
                        background: isEven ? "transparent" : "var(--hover-bg)",
                        borderBottom: "1px solid var(--border-subtle)",
                      }}
                    >
                      <td className="px-4 py-3 font-mono text-[11px]" style={{ color: "var(--text-primary)" }}>
                        {dec.type}
                      </td>
                      <td className="px-4 py-3 font-mono text-[11px]" style={{ color: "var(--accent)" }}>
                        {dec.model}
                      </td>
                      <td className="px-4 py-3 font-mono text-[10px]" style={{ color: "var(--text-muted)" }}>
                        {dec.version}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div
                            className="rounded-md overflow-hidden"
                            style={{ height: 3, width: 48, background: "var(--border)" }}
                          >
                            <div
                              style={{
                                width: `${dec.confidence}%`,
                                height: "100%",
                                background: confColor,
                              }}
                            />
                          </div>
                          <span className="font-mono text-[10px]" style={{ color: confColor }}>
                            {dec.confidence}%
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="font-mono text-[9px] px-2 py-0.5 rounded uppercase tracking-wider"
                          style={{ color: approval.color, background: approval.bg }}
                        >
                          {approval.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-[10px]" style={{ color: "var(--text-muted)" }}>
                        {dec.client}
                      </td>
                      <td className="px-4 py-3 font-mono text-[10px]" style={{ color: "var(--text-muted)" }}>
                        {formatTimestamp(dec.timestamp)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div
            className="flex items-center justify-between px-5 py-3"
            style={{ borderTop: "1px solid var(--border-subtle)" }}
          >
            <span className="font-mono text-[10px]" style={{ color: "var(--text-muted)" }}>
              {decisions.length} decisions · page {decisionPage + 1}/{totalPages}
            </span>
            <div className="flex gap-2">
              <PaginationButton
                disabled={decisionPage === 0}
                onClick={() => setDecisionPage((p) => p - 1)}
              >
                ← Prev
              </PaginationButton>
              <PaginationButton
                disabled={decisionPage >= totalPages - 1}
                onClick={() => setDecisionPage((p) => p + 1)}
              >
                Next →
              </PaginationButton>
            </div>
          </div>
        </div>

        {/* Bias Assessment */}
        <div
          className="rounded-md p-5"
          style={{
            background: "var(--accent-subtle)",
            border: "1px solid var(--border)",
            boxShadow: "var(--glow-card)",
          }}
        >
          <SectionLabel>Bias Assessment</SectionLabel>
          <p className="font-mono text-[9px] mb-5" style={{ color: "var(--text-muted)" }}>
            5-dimension fairness · white tick = benchmark
          </p>
          {biasDimensions.map((dim) => (
            <BiasDimensionRow key={dim.label} dim={dim} />
          ))}
          <div
            className="mt-4 pt-4 flex items-center justify-between"
            style={{ borderTop: "1px solid var(--border-subtle)" }}
          >
            <span className="font-mono text-[9px]" style={{ color: "var(--text-muted)" }}>
              Dimensions passing benchmark
            </span>
            <span className="font-mono text-[11px] font-bold" style={{ color: "var(--accent)" }}>
              {biasDimensions.filter((d) => d.score >= d.benchmark).length}/{biasDimensions.length}
            </span>
          </div>
        </div>
      </div>

      {/* Section 4: Ethics Alerts */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <SectionLabel>Ethics Alerts</SectionLabel>
          <div className="flex gap-1.5">
            {(["all", "critical", "high", "medium", "low"] as const).map((f) => {
              const isActive = alertFilter === f;
              const cfg = f !== "all" ? severityConfig(f) : null;
              return (
                <button
                  key={f}
                  onClick={() => setAlertFilter(f)}
                  className="font-mono text-[9px] uppercase tracking-wider px-2.5 py-1 rounded transition-all duration-150"
                  style={{
                    color: isActive ? (cfg?.color ?? "var(--accent)") : "var(--text-muted)",
                    background: isActive ? (cfg?.bg ?? "var(--accent-subtle)") : "transparent",
                    border: `1px solid ${isActive ? "var(--border-strong)" : "var(--border)"}`,
                  }}
                >
                  {f}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-3">
          {filteredAlerts.map((alert) => {
            const cfg = severityConfig(alert.severity);
            return (
              <div
                key={alert.id}
                className="relative rounded-md p-4 flex items-start gap-4 transition-all duration-200"
                style={{
                  background: `${cfg.color}08`,
                  border: `1px solid ${cfg.color}20`,
                  backdropFilter: "blur(12px)",
                }}
              >
                {/* Severity badge */}
                <div className="shrink-0 mt-0.5">
                  <span
                    className="font-mono text-[8px] uppercase tracking-widest px-2 py-1 rounded"
                    style={{ color: cfg.color, background: cfg.bg }}
                  >
                    {cfg.label}
                  </span>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className="font-mono text-[11px] font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
                    {alert.title}
                  </p>
                  <p className="font-mono text-[10px] leading-relaxed mb-2" style={{ color: "var(--text-muted)" }}>
                    {alert.description}
                  </p>
                  <div className="flex items-center gap-4">
                    <span className="font-mono text-[9px]" style={{ color: cfg.color }}>
                      {alert.model}
                    </span>
                    <span className="font-mono text-[9px]" style={{ color: "var(--text-muted)" }}>
                      {formatTimestamp(alert.timestamp)}
                    </span>
                  </div>
                </div>

                {/* Left accent bar */}
                <div
                  className="absolute left-0 top-3 bottom-3 w-[2px] rounded-r"
                  style={{ background: cfg.color, boxShadow: `0 0 8px ${cfg.color}` }}
                />
              </div>
            );
          })}
          {filteredAlerts.length === 0 && (
            <div
              className="rounded-md p-6 text-center"
              style={{
                background: "var(--accent-subtle)",
                border: "1px solid var(--border)",
              }}
            >
              <p className="font-mono text-[11px]" style={{ color: "var(--text-muted)" }}>
                No alerts for selected severity level
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

// ---- Tiny helper components ----

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2
      className="font-mono text-[10px] uppercase tracking-[0.22em] mb-4"
      style={{ color: "var(--accent)" }}
    >
      {children}
    </h2>
  );
}

function PaginationButton({
  children,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="font-mono text-[9px] uppercase tracking-wider px-3 py-1.5 rounded transition-all duration-150"
      style={{
        color: disabled ? "var(--text-muted)" : "var(--accent)",
        background: disabled ? "transparent" : "var(--accent-subtle)",
        border: `1px solid ${disabled ? "var(--border-subtle)" : "var(--border-accent)"}`,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      {children}
    </button>
  );
}

function AIBrainIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 4.44-1.66Z" />
      <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-4.44-1.66Z" />
    </svg>
  );
}
