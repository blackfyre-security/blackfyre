"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

type Severity = "critical" | "high" | "medium" | "low";
type CVE = {
  id: string;
  title: string;
  severity: Severity;
  cvssScore?: number;
  publishedAt?: string;
  summary?: string;
  affects?: string[];
  exploitInWild?: boolean;
  kev?: boolean;
  patched?: boolean;
};
type Dashboard = {
  activeCVEs?: number;
  patchedCVEs?: number;
  correlatedToFindings?: number;
  severityBreakdown?: Record<Severity, number>;
  recentCVEs?: CVE[];
  trendData?: { week: string; newCVEs: number; patchedCVEs: number }[];
  lastUpdatedAt?: string;
};

const SEV_COLORS: Record<Severity, string> = { critical: "#ef4444", high: "#f97316", medium: "#fbbf24", low: "#6b7280" };
const SEV_BG: Record<Severity, string> = { critical: "#7f1d1d", high: "#7c2d12", medium: "#422006", low: "#1f2937" };

export default function ThreatsPage() {
  const [dashboard, setDashboard] = useState<Dashboard>({});
  const [allCVEs, setAllCVEs] = useState<CVE[]>([]);
  const [sevFilter, setSevFilter] = useState<"all" | Severity>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "exploited" | "kev" | "patched" | "unpatched">("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api.getThreatDashboard() as Promise<{ dashboard: Dashboard }>,
      api.getCorrelations() as Promise<{ correlations: any[]; count: number }>,
    ])
      .then(([dash, corr]) => {
        setDashboard(dash.dashboard ?? {});
        const recent = (dash.dashboard?.recentCVEs ?? []) as CVE[];
        const correlated = (corr.correlations ?? []).map((c: any): CVE => ({
          id: c.cveId,
          title: c.cveTitle,
          severity: c.severity,
          cvssScore: c.cvss,
          affects: c.correlatedFindingIds,
          exploitInWild: false,
          kev: false,
          patched: false,
        }));
        // De-dupe by id, prefer the recent (richer) entry
        const map = new Map<string, CVE>();
        [...correlated, ...recent].forEach((c) => map.set(c.id, c));
        setAllCVEs([...map.values()]);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load threat intelligence"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-6 text-text-muted text-sm">Loading threat intelligence…</div>;
  if (error) return <div className="p-6 text-red-400 text-sm">Error: {error}</div>;

  const filtered = allCVEs.filter((c) => {
    if (sevFilter !== "all" && c.severity !== sevFilter) return false;
    if (statusFilter === "exploited" && !c.exploitInWild) return false;
    if (statusFilter === "kev" && !c.kev) return false;
    if (statusFilter === "patched" && !c.patched) return false;
    if (statusFilter === "unpatched" && c.patched) return false;
    return true;
  });
  const matched = allCVEs.filter((c) => (c.affects ?? []).length > 0);
  const sev = dashboard.severityBreakdown ?? { critical: 0, high: 0, medium: 0, low: 0 };

  return (
    <div className="animate-halo-fade-up">
      <p className="halo-eyebrow">§ 19 · Threat Intelligence</p>
      <h1 className="mt-2 mb-6 text-xl font-semibold text-text-primary">Threat Intelligence</h1>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="rounded-xl border border-border bg-surface p-3"><div className="text-xs text-text-muted">Active CVEs</div><div className="text-lg font-bold text-red-400">{dashboard.activeCVEs ?? 0}</div></div>
        <div className="rounded-xl border border-border bg-surface p-3"><div className="text-xs text-text-muted">Patched</div><div className="text-lg font-bold text-green-400">{dashboard.patchedCVEs ?? 0}</div></div>
        <div className="rounded-xl border border-border bg-surface p-3"><div className="text-xs text-text-muted">Matched to findings</div><div className="text-lg font-bold text-amber-400">{dashboard.correlatedToFindings ?? matched.length}</div></div>
        <div className="rounded-xl border border-border bg-surface p-3"><div className="text-xs text-text-muted">Critical / High</div><div className="text-lg font-bold text-orange-400">{(sev.critical ?? 0) + (sev.high ?? 0)}</div></div>
      </div>

      {matched.length > 0 && (
        <div className="rounded-xl border border-red-800/50 bg-red-950/20 p-4 mb-6">
          <div className="text-sm font-semibold text-red-400 mb-2">{matched.length} threat{matched.length !== 1 ? "s" : ""} matched to your infrastructure</div>
          <div className="space-y-2">
            {matched.slice(0, 5).map((t) => (
              <div key={t.id} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ color: SEV_COLORS[t.severity], background: SEV_BG[t.severity] }}>{t.severity.toUpperCase()}</span>
                  <span className="font-mono text-[10px] text-text-muted">{t.id}</span>
                  <span>{t.title}</span>
                </div>
                <button className="text-xs text-indigo-400 border border-indigo-700/50 px-2 py-1 rounded hover:bg-indigo-950/30 transition-colors">Trigger Scan</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-4 mb-4 flex-wrap">
        <div className="flex gap-1.5">
          {(["all", "critical", "high", "medium", "low"] as const).map((s) => (
            <button key={s} onClick={() => setSevFilter(s)} className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${sevFilter === s ? "border-indigo-600 bg-indigo-950/30 text-indigo-300" : "border-border text-text-muted"}`}>
              {s === "all" ? "All Severity" : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5">
          {(["all", "exploited", "kev", "unpatched", "patched"] as const).map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)} className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${statusFilter === s ? "border-indigo-600 bg-indigo-950/30 text-indigo-300" : "border-border text-text-muted"}`}>
              {s === "all" ? "All Status" : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Threat Feed */}
      <div className="space-y-3">
        {filtered.map((t) => {
          const isMatched = (t.affects ?? []).length > 0;
          return (
            <div key={t.id} className={`rounded-xl border p-4 ${isMatched ? "border-red-800/30 bg-red-950/10" : "border-border bg-surface"}`}>
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded${t.severity === "critical" && isMatched ? " halo-pulse-critical" : ""}`} style={{ color: SEV_COLORS[t.severity], background: SEV_BG[t.severity] }}>{t.severity.toUpperCase()}</span>
                    <span className="text-[10px] text-text-muted font-mono">{t.id}</span>
                    {t.cvssScore !== undefined && <span className="text-[10px] text-text-muted">CVSS {t.cvssScore}</span>}
                    {t.kev && <span className="text-[10px] text-red-400 border border-red-700/50 px-1.5 py-0.5 rounded">KEV</span>}
                    {t.exploitInWild && <span className="text-[10px] text-orange-400 border border-orange-700/50 px-1.5 py-0.5 rounded">Exploited</span>}
                    {t.patched && <span className="text-[10px] text-green-400 border border-green-700/50 px-1.5 py-0.5 rounded">Patched</span>}
                  </div>
                  <div className="text-sm font-medium">{t.title}</div>
                  {t.summary && <div className="text-xs text-text-muted mt-1 line-clamp-2">{t.summary}</div>}
                  <div className="flex gap-3 mt-2 text-xs text-text-muted flex-wrap">
                    {t.publishedAt && <span>{t.publishedAt}</span>}
                    {(t.affects ?? []).length > 0 && <span>Affects {t.affects!.length} finding{t.affects!.length !== 1 ? "s" : ""}</span>}
                  </div>
                </div>
                {isMatched && (
                  <button className="text-xs text-indigo-400 border border-indigo-700/50 px-3 py-1.5 rounded-lg hover:bg-indigo-950/30 transition-colors shrink-0 ml-3">
                    Trigger Scan
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
