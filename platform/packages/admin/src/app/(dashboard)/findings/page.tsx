"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { api, type Finding } from "@/lib/api";

/* ------------------------------------------------------------------ */
/*  TYPES                                                              */
/* ------------------------------------------------------------------ */

type Severity = "critical" | "high" | "medium" | "low" | "info";
type FindingStatus = "open" | "acknowledged" | "in_progress" | "resolved" | "dismissed";
type RemediationTier = "auto" | "approval" | "manual";

// REAL IMPL (BLACKFYRE 2026-06): view-model for findings rendered from the live
// API only. No fabricated/demo records are ever loaded into this page.
interface FindingRow {
  id: string;
  scanId: string;
  tenantId: string;
  client: string;
  title: string;
  description: string;
  severity: Severity;
  status: FindingStatus;
  category: string;
  resourceType: string;
  resourceId: string;
  resourceRegion: string;
  remediationTier: RemediationTier;
  autoFixAvailable: boolean;
  framework: string;
  detectedAt: string;
}

interface PatternInsight {
  id: string;
  label: string;
  percentage: number;
  detail: string;
  severity: Severity;
  affectedClients: number;
  totalClients: number;
}

const SEVERITY_OPTIONS: Severity[] = ["critical", "high", "medium", "low", "info"];
const STATUS_OPTIONS: FindingStatus[] = ["open", "acknowledged", "in_progress", "resolved", "dismissed"];

/* ------------------------------------------------------------------ */
/*  SEVERITY / STATUS CONFIG — light theme                             */
/* ------------------------------------------------------------------ */

const SEV_CFG: Record<Severity, { bg: string; color: string; barColor: string }> = {
  critical: { bg: "var(--critical-bg)",  color: "var(--critical-text)",  barColor: "var(--critical)"  },
  high:     { bg: "var(--high-bg)",      color: "var(--high-text)",      barColor: "var(--high)"      },
  medium:   { bg: "var(--medium-bg)",    color: "var(--medium-text)",    barColor: "var(--medium)"    },
  low:      { bg: "var(--low-bg)",       color: "var(--low-text)",       barColor: "var(--low-text)"  },
  info:     { bg: "var(--info-bg)",      color: "var(--info-text)",      barColor: "var(--info-color)"},
};

const STATUS_CFG: Record<FindingStatus, { bg: string; color: string }> = {
  open:         { bg: "var(--critical-bg)",  color: "var(--critical-text)" },
  acknowledged: { bg: "var(--medium-bg)",    color: "var(--medium-text)"   },
  in_progress:  { bg: "var(--low-bg)",       color: "var(--low-text)"      },
  resolved:     { bg: "var(--success-bg)",   color: "var(--success-text)"  },
  dismissed:    { bg: "var(--hover-bg)",     color: "var(--text-muted)"    },
};

const TIER_CFG: Record<RemediationTier, { label: string; bg: string; color: string }> = {
  auto:     { label: "Auto-fix",  bg: "var(--success-bg)", color: "var(--success-text)"  },
  approval: { label: "Approval",  bg: "var(--medium-bg)",  color: "var(--medium-text)"   },
  manual:   { label: "Manual",    bg: "var(--critical-bg)",color: "var(--critical-text)" },
};

/* ------------------------------------------------------------------ */
/*  HELPERS                                                            */
/* ------------------------------------------------------------------ */

function exportFindingsCSV(findings: FindingRow[]) {
  const headers = ["ID","Client","Title","Severity","Status","Category","Resource","Region","Tier","Framework","Detected At"];
  const rows = findings.map((f) => [f.id,f.client,`"${f.title}"`,f.severity,f.status,f.category,f.resourceId,f.resourceRegion,f.remediationTier,f.framework,f.detectedAt]);
  const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  a.download = `blackfyre-findings-${new Date().toISOString().split("T")[0]}.csv`;
  a.click();
}

/* ------------------------------------------------------------------ */
/*  MAIN PAGE                                                          */
/* ------------------------------------------------------------------ */

export default function FindingsPage() {
  const searchParams = useSearchParams();
  const [findings, setFindings] = useState<FindingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  // REAL IMPL (BLACKFYRE 2026-06): per-finding drill-down. We hold the id of the
  // expanded finding (or null). The detail panel renders ONLY real fields from
  // the live Finding record — it never fabricates remediation/CVE narrative.
  const [detailId, setDetailId] = useState<string | null>(null);

  const [filterSeverity,  setFilterSeverity]  = useState("");
  const [filterStatus,    setFilterStatus]    = useState("");
  const [filterClient,    setFilterClient]    = useState("");
  const [filterCategory,  setFilterCategory]  = useState("");
  const [filterFramework, setFilterFramework] = useState("");

  // REAL IMPL (BLACKFYRE 2026-06): always load from the live findings API. No
  // demo/fabricated-data fallback path. Empty/error/loading states are honest.
  useEffect(() => {
    let cancelled = false;
    api.getFindings()
      .then((res) => {
        if (cancelled) return;
        // REAL IMPL (BLACKFYRE 2026-06): map the API Finding 1:1. The API does
        // not return a framework label or detection timestamp on the finding
        // record, so we render those honestly as "Unknown"/empty rather than
        // fabricating a value (e.g. an invented "SOC2" label).
        const mapped: FindingRow[] = (res.findings ?? []).map((f: Finding) => ({
          id: f.id, scanId: f.scanId, tenantId: f.tenantId, client: f.tenantId,
          title: f.title, description: f.description,
          severity: f.severity, status: f.status, category: f.category,
          resourceType: f.resourceType || "Unknown", resourceId: f.resourceId || "N/A",
          resourceRegion: f.resourceRegion || "N/A",
          remediationTier: f.remediationTier, autoFixAvailable: f.autoFixAvailable,
          framework: (f as { framework?: string }).framework ?? "Unknown",
          detectedAt: (f as { detectedAt?: string }).detectedAt ?? "",
        }));
        setFindings(mapped);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load findings");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // REAL IMPL (BLACKFYRE 2026-06): honor the ?focus=<id> deep-link emitted by the
  // command-center "Critical findings" panel — auto-open that finding's detail
  // drawer once the real findings have loaded. No-op if the id isn't present.
  useEffect(() => {
    const focus = searchParams.get("focus");
    if (focus && findings.some((f) => f.id === focus)) setDetailId(focus);
  }, [searchParams, findings]);

  const filtered = useMemo(() => findings.filter((f) => {
    if (filterSeverity  && f.severity  !== filterSeverity)  return false;
    if (filterStatus    && f.status    !== filterStatus)    return false;
    if (filterClient    && f.client    !== filterClient)    return false;
    if (filterCategory  && f.category  !== filterCategory)  return false;
    if (filterFramework && f.framework !== filterFramework) return false;
    return true;
  }), [findings, filterSeverity, filterStatus, filterClient, filterCategory, filterFramework]);

  const counts = useMemo(() => {
    const c = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
    findings.forEach((f) => c[f.severity]++);
    return c;
  }, [findings]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelectedIds((prev) => prev.size === filtered.length ? new Set() : new Set(filtered.map((f) => f.id)));
  }, [filtered]);

  const handleBulkAcknowledge = useCallback(async () => {
    const ids = [...selectedIds].filter((id) => findings.find((f) => f.id === id)?.status === "open");
    await Promise.allSettled(ids.map((id) => api.acknowledgeFinding(id)));
    setFindings((prev) => prev.map((f) => ids.includes(f.id) ? { ...f, status: "acknowledged" as FindingStatus } : f));
    setSelectedIds(new Set());
  }, [selectedIds, findings]);

  const handleBulkDismiss = useCallback(async () => {
    const ids = [...selectedIds];
    await Promise.allSettled(ids.map((id) => api.dismissFinding(id)));
    setFindings((prev) => prev.map((f) => ids.includes(f.id) ? { ...f, status: "dismissed" as FindingStatus } : f));
    setSelectedIds(new Set());
  }, [selectedIds]);

  const handleAcknowledge = useCallback(async (id: string) => {
    try {
      await api.acknowledgeFinding(id);
      setFindings((prev) => prev.map((f) => f.id === id ? { ...f, status: "acknowledged" as FindingStatus } : f));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to acknowledge");
    }
  }, []);

  const handleDismiss = useCallback(async (id: string) => {
    try {
      await api.dismissFinding(id);
      setFindings((prev) => prev.map((f) => f.id === id ? { ...f, status: "dismissed" as FindingStatus } : f));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to dismiss");
    }
  }, []);

  const allSelected = filtered.length > 0 && selectedIds.size === filtered.length;
  const hasFilters  = filterSeverity || filterStatus || filterClient || filterCategory || filterFramework;
  const detailFinding = useMemo(
    () => (detailId ? findings.find((f) => f.id === detailId) ?? null : null),
    [detailId, findings],
  );

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 rounded-md animate-spin" style={{ borderColor: "var(--border)", borderTopColor: "var(--accent)" }} />
        <span className="text-[13px]" style={{ color: "var(--text-muted)" }}>Loading findings...</span>
      </div>
    </div>
  );
  if (error) return <div className="p-6" style={{ color: "var(--critical-text)" }}>Failed to load data: {error}</div>;

  return (
    <div className="space-y-5 pb-8">

      {/* HEADER */}
      <div className="flex items-center justify-between">
        <p className="text-[13px]" style={{ color: "var(--text-muted)" }}>
          {filtered.length} of {findings.length} findings
          {hasFilters && <span style={{ color: "var(--accent)" }}> &middot; filtered</span>}
        </p>
        <button onClick={() => exportFindingsCSV(filtered)} className="btn btn-ghost btn-sm">
          Export CSV
        </button>
      </div>

      {/* SEVERITY SUMMARY CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {SEVERITY_OPTIONS.map((sev) => {
          const cfg = SEV_CFG[sev] ?? SEV_CFG.info;
          const active = filterSeverity === sev;
          return (
            <button
              key={sev}
              onClick={() => setFilterSeverity(active ? "" : sev)}
              className="card p-4 text-left transition-all"
              style={{
                borderColor: active ? cfg.color : "var(--border)",
                outline: active ? `2px solid ${cfg.color}` : "none",
                outlineOffset: "1px",
              }}
            >
              <p className="text-[11px] font-medium capitalize mb-1" style={{ color: "var(--text-muted)" }}>
                {sev}
              </p>
              <p className="text-[26px] font-bold tabular-nums" style={{ color: cfg.color }}>
                {counts[sev]}
              </p>
              {active && <p className="text-[10px] mt-0.5" style={{ color: cfg.color }}>Active filter</p>}
            </button>
          );
        })}
      </div>

      {/* PATTERN DETECTION — derived from live findings */}
      {findings.length > 0 && (() => {
        const clientSet = new Set(findings.map((f) => f.tenantId));
        const total = clientSet.size;
        const patternsData: PatternInsight[] = [
          {
            id: "PTN-001", label: "Open critical findings",
            percentage: total > 0 ? Math.round((findings.filter((f) => f.severity === "critical" && f.status === "open").length / findings.length) * 100) : 0,
            detail: `${findings.filter((f) => f.severity === "critical" && f.status === "open").length} open critical issues`,
            severity: "critical",
            affectedClients: new Set(findings.filter((f) => f.severity === "critical").map((f) => f.tenantId)).size,
            totalClients: total,
          },
          {
            id: "PTN-002", label: "High severity findings",
            percentage: total > 0 ? Math.round((findings.filter((f) => f.severity === "high").length / findings.length) * 100) : 0,
            detail: `${findings.filter((f) => f.severity === "high").length} high severity issues`,
            severity: "high",
            affectedClients: new Set(findings.filter((f) => f.severity === "high").map((f) => f.tenantId)).size,
            totalClients: total,
          },
          {
            id: "PTN-003", label: "Auto-fixable issues",
            percentage: total > 0 ? Math.round((findings.filter((f) => f.autoFixAvailable).length / findings.length) * 100) : 0,
            detail: `${findings.filter((f) => f.autoFixAvailable).length} issues with auto-fix`,
            severity: "medium",
            affectedClients: new Set(findings.filter((f) => f.autoFixAvailable).map((f) => f.tenantId)).size,
            totalClients: total,
          },
          {
            id: "PTN-004", label: "Unresolved findings",
            percentage: total > 0 ? Math.round((findings.filter((f) => f.status === "open").length / findings.length) * 100) : 0,
            detail: `${findings.filter((f) => f.status === "open").length} open (unresolved)`,
            severity: "low",
            affectedClients: new Set(findings.filter((f) => f.status === "open").map((f) => f.tenantId)).size,
            totalClients: total,
          },
        ];
        return (
          <div className="card overflow-hidden">
            <div className="px-5 py-3.5 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border)" }}>
              <h3 className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>Pattern Detection</h3>
              <span className="text-[12px]" style={{ color: "var(--text-muted)" }}>Live analysis</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-x" style={{ borderColor: "var(--border)" }}>
              {patternsData.map((p) => {
                const cfg = SEV_CFG[p.severity] ?? SEV_CFG.info;
                return (
                  <div key={p.id} className="p-5">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[24px] font-bold tabular-nums" style={{ color: cfg.color }}>{p.percentage}%</span>
                      <span className="badge" style={{ background: cfg.bg, color: cfg.color }}>{p.severity}</span>
                    </div>
                    <p className="text-[13px] font-medium mb-2" style={{ color: "var(--text-primary)" }}>{p.label}</p>
                    <div className="h-1.5 rounded-full mb-2" style={{ background: "var(--border)" }}>
                      <div className="h-full rounded-md transition-all duration-1000" style={{ width: `${p.percentage}%`, background: cfg.barColor }} />
                    </div>
                    <p className="text-[12px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>{p.detail}</p>
                    <p className="text-[11px] mt-1.5 font-medium" style={{ color: "var(--text-muted)" }}>
                      {p.affectedClients}/{p.totalClients} clients affected
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* FILTERS */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[12px] font-medium" style={{ color: "var(--text-secondary)" }}>Filters</span>
          {hasFilters && (
            <button
              onClick={() => { setFilterSeverity(""); setFilterStatus(""); setFilterClient(""); setFilterCategory(""); setFilterFramework(""); }}
              className="text-[12px] font-medium transition-colors"
              style={{ color: "var(--critical-text)" }}
            >
              Clear all
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {[
            { label: "Severity",  value: filterSeverity,  onChange: setFilterSeverity,  options: SEVERITY_OPTIONS,  allLabel: "All severities"  },
            { label: "Status",    value: filterStatus,    onChange: setFilterStatus,    options: STATUS_OPTIONS,    allLabel: "All statuses"    },
            { label: "Client",    value: filterClient,    onChange: setFilterClient,    options: [...new Set(findings.map((f) => f.client))].sort(),    allLabel: "All clients"     },
            { label: "Category",  value: filterCategory,  onChange: setFilterCategory,  options: [...new Set(findings.map((f) => f.category))].sort(),  allLabel: "All categories"  },
            { label: "Framework", value: filterFramework, onChange: setFilterFramework, options: [...new Set(findings.map((f) => f.framework))].sort(), allLabel: "All frameworks"  },
          ].map((f) => (
            <div key={f.label}>
              <label className="block text-[11px] font-medium mb-1" style={{ color: "var(--text-muted)" }}>{f.label}</label>
              <select value={f.value} onChange={(e) => f.onChange(e.target.value)} className="admin-input">
                <option value="">{f.allLabel}</option>
                {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          ))}
        </div>
      </div>

      {/* BULK ACTIONS */}
      {selectedIds.size > 0 && (
        <div
          className="card p-3 flex items-center justify-between"
          style={{ borderColor: "var(--accent)", background: "var(--accent-subtle)" }}
        >
          <span className="text-[13px] font-semibold" style={{ color: "var(--accent)" }}>
            {selectedIds.size} selected
          </span>
          <div className="flex items-center gap-2">
            <button onClick={handleBulkAcknowledge} className="btn btn-ghost btn-sm">Acknowledge</button>
            <button onClick={handleBulkDismiss} className="btn btn-ghost btn-sm">Dismiss</button>
            <button onClick={() => exportFindingsCSV(findings.filter((f) => selectedIds.has(f.id)))} className="btn btn-ghost btn-sm">Export</button>
          </div>
        </div>
      )}

      {/* FINDINGS TABLE */}
      <div className="card overflow-hidden">
        <div className="px-5 py-3.5 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border)" }}>
          <h3 className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>Finding Registry</h3>
          <span className="text-[12px]" style={{ color: "var(--text-muted)" }}>{filtered.length} of {findings.length}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 32 }}>
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                    className="w-3.5 h-3.5 rounded cursor-pointer"
                    style={{ accentColor: "var(--accent)" }}
                  />
                </th>
                <th>ID</th>
                <th>Client</th>
                <th>Severity</th>
                <th>Status</th>
                <th>Category</th>
                <th>Title</th>
                <th>Tier</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-12" style={{ color: "var(--text-muted)" }}>
                    {/* REAL IMPL (BLACKFYRE 2026-06): honest empty state — distinguish
                        "no data yet" from "filtered out". Never invent rows. */}
                    {findings.length === 0
                      ? "No findings yet. Run a scan to populate the registry."
                      : "No findings match current filters"}
                  </td>
                </tr>
              ) : (
                filtered.map((f) => {
                  const isSelected = selectedIds.has(f.id);
                  const sevCfg = SEV_CFG[f.severity] ?? SEV_CFG.info;
                  const stsCfg = STATUS_CFG[f.status] ?? STATUS_CFG.open;
                  const tierCfg = TIER_CFG[f.remediationTier] ?? TIER_CFG.manual;
                  return (
                    <tr
                      key={f.id}
                      style={{ background: isSelected ? "var(--accent-subtle)" : f.severity === "critical" ? "rgba(239,68,68,0.02)" : "transparent" }}
                    >
                      <td>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(f.id)}
                          className="w-3.5 h-3.5 rounded cursor-pointer"
                          style={{ accentColor: "var(--accent)" }}
                        />
                      </td>
                      <td>
                        <span className="text-[12px] font-mono" style={{ color: "var(--text-muted)" }}>{f.id}</span>
                      </td>
                      <td>
                        <span className="text-[13px] font-medium" style={{ color: "var(--text-primary)" }}>{f.client}</span>
                      </td>
                      <td>
                        <span className="badge capitalize" style={{ background: sevCfg.bg, color: sevCfg.color }}>
                          {f.severity}
                        </span>
                      </td>
                      <td>
                        <span className="badge" style={{ background: stsCfg.bg, color: stsCfg.color }}>
                          {f.status.replace("_", " ")}
                        </span>
                      </td>
                      <td>
                        <span className="text-[12px]" style={{ color: "var(--text-secondary)" }}>{f.category}</span>
                      </td>
                      <td>
                        {/* REAL IMPL (BLACKFYRE 2026-06): per-finding drill-down —
                            clicking the title opens the detail drawer for this
                            real finding. */}
                        <button
                          type="button"
                          onClick={() => setDetailId(f.id)}
                          className="text-left group"
                          title="View finding detail"
                        >
                          <p className="text-[13px] font-medium group-hover:underline" style={{ color: "var(--text-primary)" }}>{f.title}</p>
                          <p className="text-[11px] font-mono" style={{ color: "var(--text-muted)" }}>{f.resourceId}</p>
                        </button>
                      </td>
                      <td>
                        <span className="badge" style={{ background: tierCfg.bg, color: tierCfg.color }}>
                          {tierCfg.label}
                        </span>
                      </td>
                      <td className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {/* REAL IMPL (BLACKFYRE 2026-06): drill-down entry point. */}
                          <button
                            onClick={() => setDetailId(f.id)}
                            className="btn btn-ghost btn-sm"
                          >
                            View
                          </button>
                          {f.status === "open" && (
                            <button
                              onClick={() => handleAcknowledge(f.id)}
                              className="btn btn-ghost btn-sm"
                            >
                              Ack
                            </button>
                          )}
                          {f.status !== "dismissed" && (
                            <button
                              onClick={() => handleDismiss(f.id)}
                              className="btn btn-sm"
                              style={{ background: "var(--critical-bg)", color: "var(--critical-text)", border: "1px solid rgba(239,68,68,0.2)" }}
                            >
                              Dismiss
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* FINDING DETAIL DRILL-DOWN DRAWER */}
      {/* REAL IMPL (BLACKFYRE 2026-06): slide-over detail panel for a single
          finding. Every field shown is read directly off the live Finding
          record loaded from api.getFindings — no fabricated narrative, no
          invented CVEs/SLAs. Acknowledge/Dismiss call the real admin endpoints. */}
      {detailFinding && (() => {
        const f = detailFinding;
        const sevCfg = SEV_CFG[f.severity] ?? SEV_CFG.info;
        const stsCfg = STATUS_CFG[f.status] ?? STATUS_CFG.open;
        const tierCfg = TIER_CFG[f.remediationTier] ?? TIER_CFG.manual;
        const rows: Array<[string, string]> = [
          ["Finding ID", f.id],
          ["Scan ID", f.scanId || "N/A"],
          ["Tenant", f.tenantId || "N/A"],
          ["Category", f.category || "N/A"],
          ["Resource type", f.resourceType],
          ["Resource ID", f.resourceId],
          ["Region", f.resourceRegion],
          ["Framework", f.framework],
          ["Auto-fix available", f.autoFixAvailable ? "Yes" : "No"],
          ["Detected at", f.detectedAt || "Unknown"],
        ];
        return (
          <div className="fixed inset-0 z-50 flex justify-end">
            <div
              className="absolute inset-0"
              style={{ background: "rgba(0,0,0,0.4)" }}
              onClick={() => setDetailId(null)}
            />
            <div
              className="relative h-full w-full max-w-md overflow-y-auto"
              style={{ background: "var(--surface, var(--bg-elevated))", borderLeft: "1px solid var(--border)" }}
            >
              <div
                className="px-5 py-4 flex items-start justify-between gap-3 sticky top-0"
                style={{ borderBottom: "1px solid var(--border)", background: "var(--surface, var(--bg-elevated))" }}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="badge capitalize" style={{ background: sevCfg.bg, color: sevCfg.color }}>{f.severity}</span>
                    <span className="badge" style={{ background: stsCfg.bg, color: stsCfg.color }}>{f.status.replace("_", " ")}</span>
                    <span className="badge" style={{ background: tierCfg.bg, color: tierCfg.color }}>{tierCfg.label}</span>
                  </div>
                  <h3 className="text-[15px] font-semibold leading-snug" style={{ color: "var(--text-primary)" }}>{f.title}</h3>
                </div>
                <button onClick={() => setDetailId(null)} className="btn btn-ghost btn-sm shrink-0" aria-label="Close detail">✕</button>
              </div>

              <div className="p-5 space-y-5">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wider mb-1.5" style={{ color: "var(--text-muted)" }}>Description</p>
                  <p className="text-[13px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                    {f.description || "No description provided by the scanner."}
                  </p>
                </div>

                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>Details</p>
                  <dl className="space-y-2">
                    {rows.map(([label, value]) => (
                      <div key={label} className="flex items-start justify-between gap-4">
                        <dt className="text-[12px] shrink-0" style={{ color: "var(--text-muted)" }}>{label}</dt>
                        <dd className="text-[12px] font-mono text-right break-all" style={{ color: "var(--text-primary)" }}>{value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  {f.status === "open" && (
                    <button onClick={() => handleAcknowledge(f.id)} className="btn btn-ghost btn-sm">Acknowledge</button>
                  )}
                  {f.status !== "dismissed" && (
                    <button
                      onClick={() => handleDismiss(f.id)}
                      className="btn btn-sm"
                      style={{ background: "var(--critical-bg)", color: "var(--critical-text)", border: "1px solid rgba(239,68,68,0.2)" }}
                    >
                      Dismiss
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
