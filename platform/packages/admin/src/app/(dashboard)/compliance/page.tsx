"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";

// ---- Types ----

type Framework = "SOC2" | "ISO27001" | "HIPAA" | "GDPR" | "PCI-DSS";

type Trend = "up" | "down" | "stable";

interface ClientCompliance {
  id: string;
  name: string;
  scores: Record<Framework, number>;
  pass: Record<Framework, number>;
  fail: Record<Framework, number>;
  partial: Record<Framework, number>;
  findings: Record<Framework, number>;
  lastScan: Record<Framework, string>;
  trend: Record<Framework, Trend>;
}

// ---- Constants ----

const FRAMEWORKS: Framework[] = ["SOC2", "ISO27001", "HIPAA", "GDPR", "PCI-DSS"];

const FRAMEWORK_LABELS: Record<Framework, string> = {
  SOC2: "SOC 2",
  ISO27001: "ISO 27001",
  HIPAA: "HIPAA",
  GDPR: "GDPR",
  "PCI-DSS": "PCI-DSS",
};


// ---- Helpers ----

function scoreColor(score: number): string {
  if (score >= 80) return "var(--accent)";
  if (score >= 60) return "var(--medium)";
  return "var(--critical)";
}

function scoreBand(score: number): "green" | "yellow" | "red" {
  if (score >= 80) return "green";
  if (score >= 60) return "yellow";
  return "red";
}

function scoreBgClass(score: number): string {
  if (score >= 80) return "var(--success-bg)";
  if (score >= 60) return "var(--medium-bg)";
  return "var(--critical-bg)";
}

function trendIcon(t: Trend): string {
  if (t === "up") return "\u25B2";
  if (t === "down") return "\u25BC";
  return "\u25C6";
}

function trendColor(t: Trend): string {
  if (t === "up") return "var(--accent)";
  if (t === "down") return "var(--critical)";
  return "var(--medium)";
}

function formatDate(d: string): string {
  const dt = new Date(d);
  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ---- Circular Progress Ring ----

function ProgressRing({ score, size = 52 }: { score: number; size?: number }) {
  const stroke = 4;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = scoreColor(score);

  return (
    <svg width={size} height={size} className="flex-shrink-0">
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
          transition: "stroke-dashoffset 0.8s ease",
        }}
      />
      <text
        x="50%"
        y="50%"
        textAnchor="middle"
        dominantBaseline="central"
        fill={color}
        fontSize={size > 44 ? 13 : 10}
        fontFamily="'JetBrains Mono', 'Fira Code', monospace"
        fontWeight={700}
      >
        {score}
      </text>
    </svg>
  );
}

// ---- Risk Band Visualization ----

function RiskBand({ clients, framework }: { clients: ClientCompliance[]; framework: Framework }) {
  const bandHeight = 56;

  return (
    <div className="admin-card p-4 mt-6 relative overflow-hidden scanline">
      <h3
        className="font-mono text-[11px] uppercase tracking-[0.2em] mb-4"
        style={{ color: "var(--accent)" }}
      >
        Risk Band Distribution
      </h3>
      <div className="relative" style={{ height: bandHeight + 28 }}>
        {/* Zone labels */}
        <div className="absolute top-0 left-0 right-0 flex font-mono text-[9px] tracking-wider" style={{ height: 14 }}>
          <div className="flex-1 text-center" style={{ color: "var(--critical)" }}>
            CRITICAL &lt;60%
          </div>
          <div className="flex-1 text-center" style={{ color: "var(--medium)" }}>
            WARNING 60-80%
          </div>
          <div className="flex-1 text-center" style={{ color: "var(--accent)" }}>
            COMPLIANT &gt;80%
          </div>
        </div>
        {/* Band */}
        <div
          className="absolute left-0 right-0 rounded"
          style={{
            top: 18,
            height: bandHeight,
            background:
              "linear-gradient(90deg, var(--critical-bg) 0%, var(--critical-bg) 33.3%, var(--medium-bg) 33.3%, var(--medium-bg) 66.6%, var(--success-bg) 66.6%, var(--success-bg) 100%)",
            border: "1px solid var(--border-subtle)",
          }}
        >
          {/* Separator lines */}
          <div
            className="absolute top-0 bottom-0"
            style={{
              left: "33.33%",
              width: 1,
              background: "var(--border)",
            }}
          />
          <div
            className="absolute top-0 bottom-0"
            style={{
              left: "66.66%",
              width: 1,
              background: "var(--border)",
            }}
          />
          {/* Client dots */}
          {clients.map((client, idx) => {
            const score = client.scores[framework];
            const leftPct = Math.min(Math.max(score, 2), 98);
            const color = scoreColor(score);
            // REAL IMPL (BLACKFYRE 2026-06): real tenant ids are UUIDs, so the
            // old parseInt(id.slice(-2)) produced NaN. Derive a deterministic
            // vertical offset from the row index instead so dots stay readable.
            const verticalOffset = 12 + ((idx * 17) % (bandHeight - 28));
            return (
              <div
                key={client.id}
                className="absolute group"
                style={{
                  left: `${leftPct}%`,
                  top: verticalOffset,
                  transform: "translate(-50%, -50%)",
                }}
              >
                <div
                  className="rounded-md"
                  style={{
                    width: 10,
                    height: 10,
                    background: color,
                    border: "1px solid var(--border)",
                    transition: "transform 0.2s ease, box-shadow 0.2s ease",
                  }}
                />
                {/* Tooltip */}
                <div
                  className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-10"
                  style={{
                    background: "var(--surface)",
                    border: "1px solid var(--border-strong)",
                    fontSize: 10,
                    fontFamily: "'JetBrains Mono', monospace",
                    color: color,
                    boxShadow: "var(--glow-card)",
                  }}
                >
                  {client.name}: {score}%
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ---- Stats Cards ----

function StatsPanel({ clients, framework }: { clients: ClientCompliance[]; framework: Framework }) {
  const scores = clients.map((c) => c.scores[framework]);
  const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);

  const sorted = [...clients].sort(
    (a, b) => b.scores[framework] - a.scores[framework]
  );
  const best = sorted[0];
  const worst = sorted[sorted.length - 1];

  const mostImproved = clients.filter((c) => c.trend[framework] === "up");
  const improvedName =
    mostImproved.length > 0
      ? mostImproved.sort(
          (a, b) => b.scores[framework] - a.scores[framework]
        )[0].name
      : "N/A";

  const stats = [
    {
      label: "AVG SCORE",
      value: `${avg}%`,
      color: scoreColor(avg),
      sub: `${FRAMEWORK_LABELS[framework]} Fleet Average`,
    },
    {
      label: "BEST PERFORMER",
      value: best.name,
      color: "var(--success-text)",
      sub: `${best.scores[framework]}% compliance`,
    },
    {
      label: "WORST PERFORMER",
      value: worst.name,
      color: "var(--critical-text)",
      sub: `${worst.scores[framework]}% compliance`,
    },
    {
      label: "MOST IMPROVED",
      value: improvedName,
      color: "var(--low-text)",
      sub: "Positive trend",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
      {stats.map((s) => (
        <div
          key={s.label}
          className="admin-card p-4 glow-border-hover"
          style={{
            borderColor: `${s.color}25`,
          }}
        >
          <div
            className="font-mono text-[9px] uppercase tracking-[0.2em] mb-2"
            style={{ color: "var(--text-muted)" }}
          >
            {s.label}
          </div>
          <div
            className="font-mono text-lg font-bold truncate"
            style={{ color: s.color }}
          >
            {s.value}
          </div>
          <div className="font-mono text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>
            {s.sub}
          </div>
        </div>
      ))}
    </div>
  );
}

// ---- Main Page ----

// REAL IMPL (BLACKFYRE 2026-06): the 12-row DEMO_COMPLIANCE_CLIENTS dataset
// (named real companies — HDFC, Reliance, Infosys, TCS, etc. — with invented
// per-framework scores, pass/fail counts, scan dates and trends) and the
// DEMO_MODE bypass have been removed. The compliance leaderboard is sourced
// only from the live API (api.getClients). Empty/error states are honest.

export default function CompliancePage() {
  const [framework, setFramework] = useState<Framework>("SOC2");
  const [clients, setClients] = useState<ClientCompliance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exportingQBR, setExportingQBR] = useState(false);

  // REAL IMPL (BLACKFYRE 2026-06): always load compliance posture from the live
  // API. No demo bypass, no fabricated leaderboard.
  useEffect(() => {
    api.getClients()
      .then((res) => {
        const apiClients = (res.clients ?? []).map((c: any) => ({
          id: c.id ?? c.tenantId,
          name: c.company ?? c.name ?? "Unknown",
          scores: c.complianceScores ?? { SOC2: c.complianceScore ?? 0, ISO27001: 0, HIPAA: 0, GDPR: 0, "PCI-DSS": 0 },
          pass: c.passCounts ?? { SOC2: 0, ISO27001: 0, HIPAA: 0, GDPR: 0, "PCI-DSS": 0 },
          fail: c.failCounts ?? { SOC2: 0, ISO27001: 0, HIPAA: 0, GDPR: 0, "PCI-DSS": 0 },
          partial: c.partialCounts ?? { SOC2: 0, ISO27001: 0, HIPAA: 0, GDPR: 0, "PCI-DSS": 0 },
          findings: c.findingCounts ?? { SOC2: 0, ISO27001: 0, HIPAA: 0, GDPR: 0, "PCI-DSS": 0 },
          lastScan: c.lastScanDates ?? { SOC2: c.lastScan ?? "--", ISO27001: "--", HIPAA: "--", GDPR: "--", "PCI-DSS": "--" },
          trend: c.trends ?? { SOC2: "stable" as const, ISO27001: "stable" as const, HIPAA: "stable" as const, GDPR: "stable" as const, "PCI-DSS": "stable" as const },
        }));
        setClients(apiClients);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const sorted = [...clients].sort(
    (a, b) => b.scores[framework] - a.scores[framework]
  );

  const handleExportQBR = useCallback(() => {
    setExportingQBR(true);
    setTimeout(() => {
      // Build CSV content
      const headers = [
        "Rank",
        "Client",
        "Framework",
        "Score",
        "Pass",
        "Fail",
        "Partial",
        "Findings",
        "Last Scan",
        "Trend",
      ];
      const rows = sorted.map((c, i) => [
        i + 1,
        c.name,
        FRAMEWORK_LABELS[framework],
        c.scores[framework],
        c.pass[framework],
        c.fail[framework],
        c.partial[framework],
        c.findings[framework],
        c.lastScan[framework],
        c.trend[framework],
      ]);
      const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `QBR_${framework}_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      setExportingQBR(false);
    }, 800);
  }, [sorted, framework]);

  // ---- Loading State ----
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="relative w-16 h-16">
          <div
            className="absolute inset-0 rounded-md border-2 border-transparent"
            style={{
              borderTopColor: "var(--accent)",
              animation: "spin 1s linear infinite",
            }}
          />
          <div
            className="absolute inset-2 rounded-md border-2 border-transparent"
            style={{
              borderTopColor: "var(--accent-muted)",
              animation: "spin 1.5s linear infinite reverse",
            }}
          />
        </div>
        <p
          className="font-mono text-xs tracking-[0.3em] uppercase"
          style={{ color: "var(--accent)" }}
        >
          Initializing Compliance Matrix...
        </p>
        <style jsx>{`
          @keyframes spin {
            to {
              transform: rotate(360deg);
            }
          }
        `}</style>
      </div>
    );
  }

  if (error) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="admin-card p-6 text-center max-w-md" style={{ borderColor: "var(--critical)" }}>
        <p className="font-mono text-xs tracking-wider" style={{ color: "var(--critical)" }}>FAILED TO LOAD COMPLIANCE DATA</p>
        <p className="font-mono text-[11px] mt-2" style={{ color: "var(--text-muted)" }}>{error}</p>
      </div>
    </div>
  );

  if (clients.length === 0) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="admin-card p-6 text-center max-w-md">
        <p className="font-mono text-xs tracking-wider" style={{ color: "var(--text-muted)" }}>NO CLIENT DATA AVAILABLE</p>
        <p className="font-mono text-[11px] mt-2" style={{ color: "var(--text-muted)" }}>Compliance data will appear once clients are onboarded.</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-0 pb-12">
      {/* ---- HEADER ---- */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <div
            className="mono text-[11px] font-semibold"
            style={{ color: "var(--text-muted)", letterSpacing: "0.14em", textTransform: "uppercase" }}
          >
            Admin · Compliance
          </div>
          <div className="flex items-center gap-3 mt-2">
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--accent)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            <h1
              className="text-[30px] font-semibold tracking-tight"
              style={{ color: "var(--text-primary)", letterSpacing: "-0.025em" }}
            >
              Compliance matrix
            </h1>
          </div>
          <p
            className="mt-1.5 text-[13px] ml-[35px]"
            style={{ color: "var(--text-secondary)" }}
          >
            Real-time framework compliance across all clients
          </p>
        </div>

        {/* QBR Export */}
        <button
          onClick={handleExportQBR}
          disabled={exportingQBR}
          className="admin-btn admin-btn-ghost flex items-center gap-2"
          style={{ fontSize: 11 }}
        >
          {exportingQBR ? (
            <>
              <span
                className="inline-block w-3 h-3 rounded-md border-2 border-transparent"
                style={{
                  borderTopColor: "var(--accent)",
                  animation: "spin 1s linear infinite",
                }}
              />
              EXPORTING...
            </>
          ) : (
            <>
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              QBR EXPORT
            </>
          )}
        </button>
      </div>

      {/* ---- FRAMEWORK SELECTOR TABS ---- */}
      <div className="flex flex-wrap gap-2 mb-6">
        {FRAMEWORKS.map((fw) => {
          const isActive = framework === fw;
          return (
            <button
              key={fw}
              onClick={() => setFramework(fw)}
              className="font-mono text-xs font-bold tracking-[0.15em] uppercase px-4 py-2 rounded transition-all duration-200 border"
              style={{
                background: isActive
                  ? "var(--accent-subtle)"
                  : "transparent",
                borderColor: isActive ? "var(--accent)" : "var(--border)",
                color: isActive ? "var(--accent)" : "var(--text-muted)",
                boxShadow: isActive
                  ? "var(--glow-accent)"
                  : "none",
              }}
            >
              {FRAMEWORK_LABELS[fw]}
            </button>
          );
        })}
      </div>

      {/* ---- OVERALL STATS ---- */}
      <StatsPanel clients={clients} framework={framework} />

      {/* ---- RISK BAND ---- */}
      <RiskBand clients={clients} framework={framework} />

      {/* ---- LEADERBOARD TABLE ---- */}
      <div className="admin-card mt-6 overflow-hidden relative scanline">
        {/* Table header decoration */}
        <div
          className="h-[2px] w-full"
          style={{
            background:
              "linear-gradient(90deg, transparent, var(--border-accent), var(--accent), var(--border-accent), transparent)",
          }}
        />

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr
                style={{
                  background: "var(--accent-subtle)",
                  borderBottom: "1px solid var(--border)",
                }}
              >
                <th className="font-mono text-[10px] tracking-[0.2em] uppercase text-left py-3 px-4" style={{ color: "var(--text-muted)" }}>
                  Rank
                </th>
                <th className="font-mono text-[10px] tracking-[0.2em] uppercase text-left py-3 px-4" style={{ color: "var(--text-muted)" }}>
                  Client
                </th>
                <th className="font-mono text-[10px] tracking-[0.2em] uppercase text-center py-3 px-4" style={{ color: "var(--text-muted)" }}>
                  Score
                </th>
                <th className="font-mono text-[10px] tracking-[0.2em] uppercase text-center py-3 px-4" style={{ color: "var(--text-muted)" }}>
                  Pass / Fail / Partial
                </th>
                <th className="font-mono text-[10px] tracking-[0.2em] uppercase text-center py-3 px-4" style={{ color: "var(--text-muted)" }}>
                  Findings
                </th>
                <th className="font-mono text-[10px] tracking-[0.2em] uppercase text-center py-3 px-4" style={{ color: "var(--text-muted)" }}>
                  Last Scan
                </th>
                <th className="font-mono text-[10px] tracking-[0.2em] uppercase text-center py-3 px-4" style={{ color: "var(--text-muted)" }}>
                  Trend
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((client, idx) => {
                const score = client.scores[framework];
                const trend = client.trend[framework];
                const band = scoreBand(score);

                return (
                  <tr
                    key={client.id}
                    className="transition-colors duration-150"
                    style={{
                      background:
                        idx % 2 === 0
                          ? "transparent"
                          : "var(--hover-bg)",
                      borderBottom: "1px solid var(--border-subtle)",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.background =
                        scoreBgClass(score);
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.background =
                        idx % 2 === 0
                          ? "transparent"
                          : "var(--hover-bg)";
                    }}
                  >
                    {/* Rank */}
                    <td className="py-3 px-4">
                      <span
                        className="font-mono text-xl font-black"
                        style={{
                          color:
                            idx === 0
                              ? "var(--accent)"
                              : idx === 1
                              ? "var(--accent-hover)"
                              : idx === 2
                              ? "var(--accent-muted)"
                              : "var(--text-muted)",
                        }}
                      >
                        {String(idx + 1).padStart(2, "0")}
                      </span>
                    </td>

                    {/* Client Name */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        {/* Rank indicator dot */}
                        <div
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{
                            background: scoreColor(score),
                          }}
                        />
                        <div>
                          <span
                            className="font-mono text-sm font-semibold tracking-wider"
                            style={{ color: "var(--text-primary)" }}
                          >
                            {client.name}
                          </span>
                          <div
                            className="font-mono text-[9px] tracking-wider mt-0.5"
                            style={{ color: "var(--text-muted)" }}
                          >
                            {client.id.toUpperCase()}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Score with Ring */}
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-center gap-3">
                        <ProgressRing score={score} size={48} />
                        <div className="text-left">
                          <span
                            className="font-mono text-lg font-black"
                            style={{ color: scoreColor(score) }}
                          >
                            {score}%
                          </span>
                          <div
                            className="font-mono text-[9px] uppercase tracking-wider"
                            style={{
                              color:
                                band === "green"
                                  ? "var(--accent)"
                                  : band === "yellow"
                                  ? "var(--medium)"
                                  : "var(--critical)",
                            }}
                          >
                            {band === "green"
                              ? "COMPLIANT"
                              : band === "yellow"
                              ? "AT RISK"
                              : "CRITICAL"}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Pass / Fail / Partial */}
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-center gap-3 font-mono text-xs">
                        <span style={{ color: "var(--accent)" }}>
                          {client.pass[framework]}
                          <span className="text-[9px] ml-0.5" style={{ color: "var(--text-muted)" }}>P</span>
                        </span>
                        <span style={{ color: "var(--critical)" }}>
                          {client.fail[framework]}
                          <span className="text-[9px] ml-0.5" style={{ color: "var(--text-muted)" }}>F</span>
                        </span>
                        <span style={{ color: "var(--medium)" }}>
                          {client.partial[framework]}
                          <span className="text-[9px] ml-0.5" style={{ color: "var(--text-muted)" }}>~</span>
                        </span>
                      </div>
                      {/* Mini progress bar */}
                      <div
                        className="mt-1.5 mx-auto rounded-md overflow-hidden flex"
                        style={{
                          height: 3,
                          width: "80%",
                          background: "var(--border-subtle)",
                        }}
                      >
                        <div
                          style={{
                            width: `${
                              (client.pass[framework] /
                                (client.pass[framework] +
                                  client.fail[framework] +
                                  client.partial[framework])) *
                              100
                            }%`,
                            background: "var(--success)",
                          }}
                        />
                        <div
                          style={{
                            width: `${
                              (client.partial[framework] /
                                (client.pass[framework] +
                                  client.fail[framework] +
                                  client.partial[framework])) *
                              100
                            }%`,
                            background: "var(--medium)",
                          }}
                        />
                        <div
                          style={{
                            width: `${
                              (client.fail[framework] /
                                (client.pass[framework] +
                                  client.fail[framework] +
                                  client.partial[framework])) *
                              100
                            }%`,
                            background: "var(--critical)",
                          }}
                        />
                      </div>
                    </td>

                    {/* Findings */}
                    <td className="py-3 px-4 text-center">
                      <span
                        className="font-mono text-sm font-bold"
                        style={{
                          color:
                            client.findings[framework] > 40
                              ? "var(--critical)"
                              : client.findings[framework] > 20
                              ? "var(--medium)"
                              : "var(--accent)",
                        }}
                      >
                        {client.findings[framework]}
                      </span>
                      <div
                        className="font-mono text-[9px] mt-0.5"
                        style={{ color: "var(--text-muted)" }}
                      >
                        OPEN
                      </div>
                    </td>

                    {/* Last Scan */}
                    <td className="py-3 px-4 text-center">
                      <span
                        className="font-mono text-xs"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        {formatDate(client.lastScan[framework])}
                      </span>
                    </td>

                    {/* Trend */}
                    <td className="py-3 px-4 text-center">
                      <span
                        className="font-mono text-base font-bold"
                        style={{
                          color: trendColor(trend),
                        }}
                      >
                        {trendIcon(trend)}
                      </span>
                      <div
                        className="font-mono text-[9px] uppercase tracking-wider mt-0.5"
                        style={{ color: trendColor(trend) }}
                      >
                        {trend}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Table footer decoration */}
        <div
          className="h-[1px] w-full"
          style={{
            background:
              "linear-gradient(90deg, transparent, var(--border-accent), var(--border-accent), var(--border-accent), transparent)",
          }}
        />
        <div
          className="flex items-center justify-between px-4 py-2"
          style={{ background: "var(--accent-subtle)" }}
        >
          <span
            className="font-mono text-[9px] tracking-[0.2em]"
            style={{ color: "var(--text-muted)" }}
          >
            {sorted.length} CLIENTS ENROLLED IN {FRAMEWORK_LABELS[framework]}
          </span>
          <span
            className="font-mono text-[9px] tracking-[0.2em]"
            style={{ color: "var(--text-muted)" }}
          >
            LAST REFRESH: {new Date().toLocaleTimeString()}
          </span>
        </div>
      </div>

      {/* ---- FRAMEWORK CROSS-COMPARISON MINI GRID ---- */}
      <div className="admin-card mt-6 p-4 glow-border-hover">
        <h3
          className="font-mono text-[11px] uppercase tracking-[0.2em] mb-4"
          style={{ color: "var(--accent)" }}
        >
          Cross-Framework Heatmap
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th
                  className="font-mono text-[9px] tracking-[0.15em] uppercase text-left py-2 px-3"
                  style={{ color: "var(--text-muted)" }}
                >
                  Client
                </th>
                {FRAMEWORKS.map((fw) => (
                  <th
                    key={fw}
                    className="font-mono text-[9px] tracking-[0.15em] uppercase text-center py-2 px-3"
                    style={{
                      color: fw === framework ? "var(--accent)" : "var(--text-muted)",
                    }}
                  >
                    {FRAMEWORK_LABELS[fw]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((client) => (
                <tr
                  key={client.id}
                  style={{
                    borderBottom: "1px solid var(--border-subtle)",
                  }}
                >
                  <td className="py-2 px-3">
                    <span
                      className="font-mono text-[11px] tracking-wider"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {client.name}
                    </span>
                  </td>
                  {FRAMEWORKS.map((fw) => {
                    const s = client.scores[fw];
                    const color = scoreColor(s);
                    const isCurrentFw = fw === framework;
                    return (
                      <td key={fw} className="py-2 px-3 text-center">
                        <span
                          className="inline-block font-mono text-[11px] font-bold rounded px-2 py-0.5"
                          style={{
                            color: color,
                            background: scoreBgClass(s),
                            border: isCurrentFw
                              ? "1px solid var(--border-strong)"
                              : "1px solid transparent",
                          }}
                        >
                          {s}%
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ---- FOOTER BRANDING ---- */}
      <div className="mt-8 text-center">
        <p
          className="font-mono text-[9px] tracking-[0.3em] uppercase"
          style={{ color: "var(--text-muted)" }}
        >
          BLACKFYRE COMPLIANCE ENGINE v3.1 // WITCH DEATH SPELL PROTOCOL
        </p>
      </div>

      {/* Global keyframes */}
      <style jsx>{`
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}
