"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { api } from "@/lib/api";
import type { AuditLog } from "@/lib/api";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface AuditEntry {
  id: string;
  timestamp: string;
  action: string;
  userEmail: string;
  userId: string;
  tenant: string;
  resourceType: string;
  resourceId: string;
  ipAddress: string;
  details: Record<string, unknown>;
}

type ActionCategory = "auth" | "scan" | "finding" | "admin" | "delete" | "remediation" | "client" | "report" | "system";

/* ------------------------------------------------------------------ */
/*  Category color map — light theme                                   */
/* ------------------------------------------------------------------ */

const ACTION_COLORS: Record<ActionCategory, { bg: string; color: string }> = {
  auth:        { bg: "var(--low-bg)", color: "var(--low-text)" },
  scan:        { bg: "var(--success-bg)", color: "var(--success-text)" },
  finding:     { bg: "var(--medium-bg)", color: "var(--medium-text)" },
  admin:       { bg: "var(--info-bg)", color: "var(--info-text)" },
  delete:      { bg: "var(--critical-bg)", color: "var(--critical-text)" },
  remediation: { bg: "var(--low-bg)", color: "var(--low-text)" },
  client:      { bg: "var(--success-bg)", color: "var(--success-text)" },
  report:      { bg: "var(--accent-subtle)", color: "var(--accent)" },
  system:      { bg: "var(--hover-bg)", color: "var(--text-secondary)" },
};

function categorize(action: string): ActionCategory {
  if (action.startsWith("auth."))        return "auth";
  if (action.startsWith("scan."))        return "scan";
  if (action.startsWith("finding."))     return "finding";
  if (action.startsWith("admin."))       return "admin";
  if (action.includes("delete") || action.includes("remove")) return "delete";
  if (action.startsWith("remediation.")) return "remediation";
  if (action.startsWith("client."))      return "client";
  if (action.startsWith("report."))      return "report";
  return "system";
}


const ALL_ACTIONS = [
  "auth.login", "auth.login.failed", "auth.logout",
  "scan.create", "scan.complete", "scan.cancel",
  "finding.update", "finding.delete",
  "remediation.approve", "remediation.execute",
  "client.create", "client.update", "client.delete",
  "admin.settings.update", "admin.user.create", "admin.role.update",
  "report.generate", "report.download",
  "system.maintenance.on",
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function fmtFull(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-US", { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
}

function timeSince(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60)   return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function computeStats(logs: AuditEntry[]) {
  const now = Date.now();
  const lastHour = logs.filter((l) => now - new Date(l.timestamp).getTime() < 3_600_000).length;
  const lastDay  = logs.filter((l) => now - new Date(l.timestamp).getTime() < 86_400_000).length;
  const userCounts: Record<string, number> = {};
  const actionCounts: Record<string, number> = {};
  let failedLogins = 0, unusualHours = 0, flaggedEntries = 0;
  for (const l of logs) {
    userCounts[l.userEmail]  = (userCounts[l.userEmail] || 0) + 1;
    actionCounts[l.action]   = (actionCounts[l.action] || 0) + 1;
    if (l.action === "auth.login.failed") failedLogins++;
    const h = new Date(l.timestamp).getHours();
    if (h < 6 || h > 22) unusualHours++;
    if (l.details.flagged) flaggedEntries++;
  }
  const topUsers   = Object.entries(userCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const topActions = Object.entries(actionCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
  return { lastHour, lastDay, topUsers, topActions, failedLogins, unusualHours, flaggedEntries };
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

// REAL IMPL (BLACKFYRE 2026-06): the audit-log demo dataset (50 fabricated
// entries naming real companies + invented employee emails/IPs) has been
// removed entirely. This page now ONLY renders the tamper-evident audit trail
// returned by the real API (GET /api/admin/audit-logs). There is no
// fabricated/synthesized fallback path — empty/error states are honest.

export default function AuditLogsPage() {
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState<string | null>(null);
  const [logs, setLogs]                 = useState<AuditEntry[]>([]);
  const [search, setSearch]             = useState("");
  const [dateFrom, setDateFrom]         = useState("");
  const [dateTo, setDateTo]             = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [tenantFilter, setTenantFilter] = useState("");
  const [userFilter, setUserFilter]     = useState("");
  const [expandedId, setExpandedId]     = useState<string | null>(null);
  const [live, setLive]                 = useState(true);
  const [visibleCount, setVisibleCount] = useState(20);
  const [sidebarOpen, setSidebarOpen]   = useState(true);
  // REAL IMPL (BLACKFYRE 2026-06): retention is the real platform setting, not a
  // hardcoded "180 days" label. null until loaded / when unavailable.
  const [retentionDays, setRetentionDays] = useState<number | null>(null);

  const streamRef = useRef<HTMLDivElement>(null);

  // REAL IMPL (BLACKFYRE 2026-06): always fetch the live audit trail. No demo
  // fallback path exists. Retention is read from the real platform settings
  // (best-effort — a settings failure must not block the audit trail).
  useEffect(() => {
    Promise.all([api.getAuditLogs()])
      .then(([res]) => {
        const entries: AuditEntry[] = (res.logs ?? []).map((l: AuditLog) => ({
          id: l.id, timestamp: l.timestamp, action: l.action,
          userEmail: l.userEmail, userId: l.userId,
          tenant: l.resourceId || l.userId,
          resourceType: l.resource, resourceId: l.resourceId,
          ipAddress: l.ipAddress, details: l.details,
        }));
        setLogs(entries);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
    api.getSystemSettings()
      .then((res) => setRetentionDays(res.settings.retentionDays))
      .catch(() => {/* retention stays unknown — shown as "—" */});
  }, []);

  const allTenants = useMemo(() => [...new Set(logs.map((l) => l.tenant))].sort(), [logs]);
  const allUsers   = useMemo(() => [...new Set(logs.map((l) => l.userEmail))].sort(), [logs]);

  const filtered = logs.filter((l) => {
    if (search) {
      const q = search.toLowerCase();
      if (!`${l.action} ${l.userEmail} ${l.resourceType}:${l.resourceId} ${l.tenant} ${l.ipAddress}`.toLowerCase().includes(q)) return false;
    }
    if (actionFilter && l.action !== actionFilter) return false;
    if (tenantFilter && l.tenant !== tenantFilter) return false;
    if (userFilter   && l.userEmail !== userFilter) return false;
    if (dateFrom && new Date(l.timestamp) < new Date(dateFrom)) return false;
    if (dateTo) {
      const to = new Date(dateTo);
      to.setHours(23, 59, 59, 999);
      if (new Date(l.timestamp) > to) return false;
    }
    return true;
  });

  const visible = filtered.slice(0, visibleCount);
  const stats   = computeStats(logs);

  const handleScroll = useCallback(() => {
    const el = streamRef.current;
    if (!el) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 40) {
      setVisibleCount((c) => Math.min(c + 10, filtered.length));
    }
  }, [filtered.length]);

  const handleExport = () => {
    const csv = ["timestamp,action,user,tenant,resource,ip", ...filtered.map((l) =>
      `${l.timestamp},${l.action},${l.userEmail},${l.tenant},${l.resourceType}:${l.resourceId},${l.ipAddress}`)].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `audit-export-${Date.now()}.csv`;
    a.click();
  };

  const clearFilters = () => {
    setSearch(""); setDateFrom(""); setDateTo("");
    setActionFilter(""); setTenantFilter(""); setUserFilter("");
  };

  const hasFilters = search || dateFrom || dateTo || actionFilter || tenantFilter || userFilter;

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 rounded-md animate-spin" style={{ borderColor: "var(--border)", borderTopColor: "var(--accent)" }} />
        <span className="text-[13px]" style={{ color: "var(--text-muted)" }}>Loading audit trail...</span>
      </div>
    </div>
  );

  if (error) return (
    <div className="flex items-center justify-center h-64">
      <div className="card p-6 text-center max-w-sm">
        <p className="text-[13px] font-medium" style={{ color: "var(--critical-text)" }}>Failed to load audit logs</p>
        <p className="text-[12px] mt-1" style={{ color: "var(--text-muted)" }}>{error}</p>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-4 h-[calc(100vh-7rem)]">

      {/* ---- HEADER ---- */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <p className="text-[13px]" style={{ color: "var(--text-muted)" }}>
            {filtered.length} records &middot; showing {visible.length}
            {hasFilters && <span style={{ color: "var(--accent)" }}> &middot; filtered</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            className="btn btn-ghost btn-sm"
          >
            {sidebarOpen ? "Hide stats" : "Show stats"}
          </button>
          <button onClick={handleExport} className="btn btn-ghost btn-sm">
            Export CSV
          </button>
          <button
            onClick={() => setLive((v) => !v)}
            className="btn btn-sm"
            style={{
              background: live ? "var(--success-bg)" : "var(--hover-bg)",
              color: live ? "var(--success-text)" : "var(--text-secondary)",
              border: `1px solid ${live ? "var(--success)" : "var(--border)"}`,
            }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full inline-block mr-1.5"
              style={{ background: live ? "var(--success)" : "var(--text-muted)", animation: live ? "pulse-soft 2s infinite" : "none" }}
            />
            {live ? "Live" : "Paused"}
          </button>
        </div>
      </div>

      {/* ---- FILTER BAR ---- */}
      <div className="card p-4 shrink-0">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: "var(--text-muted)" }}>
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search action, user, resource, IP..."
              className="admin-input"
              style={{ paddingLeft: "36px" }}
            />
          </div>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="admin-input"
            style={{ width: 140 }}
            title="From date"
          />
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="admin-input"
            style={{ width: 140 }}
            title="To date"
          />
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="admin-input"
            style={{ width: 180 }}
          >
            <option value="">All actions</option>
            {ALL_ACTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          <select
            value={tenantFilter}
            onChange={(e) => setTenantFilter(e.target.value)}
            className="admin-input"
            style={{ width: 150 }}
          >
            <option value="">All tenants</option>
            {allTenants.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <select
            value={userFilter}
            onChange={(e) => setUserFilter(e.target.value)}
            className="admin-input"
            style={{ width: 200 }}
          >
            <option value="">All users</option>
            {allUsers.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="text-[12px] font-medium px-2 transition-colors"
              style={{ color: "var(--critical-text)" }}
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* ---- MAIN ---- */}
      <div className="flex gap-4 flex-1 min-h-0">

        {/* LOG TABLE */}
        <div className="card flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Column headers */}
          <div
            className="px-4 py-2.5 flex items-center text-[11px] font-semibold uppercase tracking-wider shrink-0"
            style={{
              background: "var(--surface-raised)",
              borderBottom: "1px solid var(--border)",
              color: "var(--text-muted)",
            }}
          >
            <span style={{ width: 150, flexShrink: 0 }}>Timestamp</span>
            <span style={{ width: 200, flexShrink: 0 }}>Action</span>
            <span style={{ width: 200, flexShrink: 0 }}>User</span>
            <span style={{ width: 120, flexShrink: 0 }}>Tenant</span>
            <span style={{ width: 150, flexShrink: 0 }}>Resource</span>
            <span className="flex-1">IP Address</span>
          </div>

          {/* Scrollable rows */}
          <div
            ref={streamRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto"
          >
            {visible.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-[13px]" style={{ color: "var(--text-muted)" }}>
                No matching records
              </div>
            ) : (
              visible.map((entry) => {
                const cat = categorize(entry.action);
                const col = ACTION_COLORS[cat] ?? ACTION_COLORS.system;
                const isExpanded = expandedId === entry.id;
                const isFlagged  = !!entry.details.flagged;

                return (
                  <div key={entry.id}>
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                      className="w-full text-left px-4 py-2.5 flex items-center text-[13px] transition-colors group"
                      style={{
                        borderBottom: "1px solid var(--border-subtle)",
                        background: isFlagged
                          ? "var(--critical-bg)"
                          : isExpanded
                          ? "var(--accent-subtle)"
                          : "transparent",
                      }}
                      onMouseEnter={(e) => {
                        if (!isFlagged && !isExpanded)
                          (e.currentTarget as HTMLElement).style.background = "var(--hover-bg-subtle)";
                      }}
                      onMouseLeave={(e) => {
                        if (!isFlagged && !isExpanded)
                          (e.currentTarget as HTMLElement).style.background = "transparent";
                      }}
                    >
                      <span
                        className="tabular-nums text-[12px]"
                        style={{ width: 150, flexShrink: 0, color: "var(--text-muted)" }}
                      >
                        {fmtFull(entry.timestamp)}
                      </span>
                      <span style={{ width: 200, flexShrink: 0 }}>
                        <span
                          className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold"
                          style={{ background: col.bg, color: col.color }}
                        >
                          {entry.action}
                        </span>
                      </span>
                      <span
                        className="truncate pr-2 text-[12px]"
                        style={{ width: 200, flexShrink: 0, color: "var(--text-primary)" }}
                        title={entry.userEmail}
                      >
                        {entry.userEmail}
                      </span>
                      <span
                        className="truncate text-[12px]"
                        style={{ width: 120, flexShrink: 0, color: "var(--text-muted)" }}
                        title={entry.tenant}
                      >
                        {entry.tenant}
                      </span>
                      <span
                        className="truncate text-[12px]"
                        style={{ width: 150, flexShrink: 0, color: "var(--text-muted)" }}
                        title={`${entry.resourceType}:${entry.resourceId}`}
                      >
                        {entry.resourceType}:{entry.resourceId}
                      </span>
                      <span className="flex-1 flex items-center gap-2 text-[12px]" style={{ color: "var(--text-muted)" }}>
                        {entry.ipAddress}
                        {isFlagged && (
                          <span
                            className="text-[10px] font-bold px-1.5 py-0 rounded"
                            style={{ background: "var(--critical-bg)", color: "var(--critical-text)" }}
                          >
                            FLAGGED
                          </span>
                        )}
                        <span className="ml-auto text-[11px] opacity-0 group-hover:opacity-100 transition-opacity">
                          {timeSince(entry.timestamp)}
                        </span>
                      </span>
                    </button>

                    {isExpanded && (
                      <div
                        className="px-5 py-4"
                        style={{
                          background: "var(--surface-raised)",
                          borderBottom: "1px solid var(--border)",
                        }}
                      >
                        <p className="text-[11px] font-semibold mb-2" style={{ color: "var(--text-muted)" }}>
                          Event payload &mdash; {entry.id}
                        </p>
                        <pre
                          className="text-[12px] leading-relaxed rounded-lg p-4 overflow-x-auto"
                          style={{
                            background: "var(--surface)",
                            border: "1px solid var(--border)",
                            color: "var(--text-primary)",
                            fontFamily: "var(--font-mono, monospace)",
                          }}
                        >
                          <code>{JSON.stringify({
                            id: entry.id, timestamp: entry.timestamp, action: entry.action,
                            actor: { userId: entry.userId, email: entry.userEmail, ip: entry.ipAddress },
                            target: { type: entry.resourceType, id: entry.resourceId, tenant: entry.tenant },
                            details: entry.details,
                          }, null, 2)}</code>
                        </pre>
                      </div>
                    )}
                  </div>
                );
              })
            )}

            {live && visible.length > 0 && (
              <div className="px-4 py-2.5 flex items-center gap-2 text-[12px]" style={{ color: "var(--text-muted)" }}>
                <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: "var(--success)", animation: "pulse-soft 2s infinite" }} />
                Waiting for next event...
              </div>
            )}
            {visibleCount < filtered.length && (
              <div className="px-4 py-2.5 text-[12px] text-center" style={{ color: "var(--text-muted)" }}>
                Scroll to load more ({filtered.length - visibleCount} remaining)
              </div>
            )}
          </div>
        </div>

        {/* STATS SIDEBAR */}
        {sidebarOpen && (
          <div className="w-64 shrink-0 flex flex-col gap-3 overflow-y-auto">

            <div className="card p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--text-muted)" }}>Activity</p>
              <div className="grid grid-cols-2 gap-2">
                <StatBox label="Last hour" value={stats.lastHour} />
                <StatBox label="Last 24h"  value={stats.lastDay}  />
              </div>
            </div>

            <div className="card p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--text-muted)" }}>Top Users</p>
              <div className="space-y-2">
                {stats.topUsers.map(([email, count]) => (
                  <div key={email} className="flex items-center justify-between text-[12px]">
                    <span className="truncate mr-2" style={{ color: "var(--text-secondary)" }} title={email}>
                      {email.split("@")[0]}
                    </span>
                    <span className="font-semibold tabular-nums" style={{ color: "var(--accent)" }}>{count}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="card p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--text-muted)" }}>Top Actions</p>
              <div className="space-y-2">
                {stats.topActions.map(([action, count]) => {
                  const col = ACTION_COLORS[categorize(action)] ?? ACTION_COLORS.system;
                  return (
                    <div key={action} className="flex items-center justify-between text-[12px]">
                      <span className="truncate mr-2" style={{ color: col.color }}>{action}</span>
                      <span className="tabular-nums" style={{ color: "var(--text-muted)" }}>{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="card p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--critical-text)" }}>Threat Indicators</p>
              <div className="space-y-2">
                <ThreatRow label="Failed logins"  value={stats.failedLogins}   severity={stats.failedLogins > 2 ? "high" : stats.failedLogins > 0 ? "medium" : "none"} />
                <ThreatRow label="Unusual hours"  value={stats.unusualHours}   severity={stats.unusualHours > 3 ? "high" : stats.unusualHours > 0 ? "medium" : "none"} />
                <ThreatRow label="Flagged events" value={stats.flaggedEntries} severity={stats.flaggedEntries > 2 ? "high" : stats.flaggedEntries > 0 ? "medium" : "none"} />
              </div>
            </div>

            <div className="card p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>Session</p>
              <div className="space-y-1.5 text-[12px]">
                <div className="flex justify-between">
                  <span style={{ color: "var(--text-secondary)" }}>Retention</span>
                  <span style={{ color: "var(--text-primary)" }}>
                    {retentionDays != null ? `${retentionDays} days` : "—"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: "var(--text-secondary)" }}>Stream</span>
                  <span style={{ color: live ? "var(--success-text)" : "var(--text-muted)" }}>
                    {live ? "Active" : "Paused"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: "var(--text-secondary)" }}>Total events</span>
                  <span style={{ color: "var(--text-primary)" }}>{logs.length}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function StatBox({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg p-3 text-center" style={{ background: "var(--surface-raised)", border: "1px solid var(--border)" }}>
      <div className="text-[22px] font-bold tabular-nums" style={{ color: "var(--accent)" }}>{value}</div>
      <div className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>{label}</div>
    </div>
  );
}

function ThreatRow({ label, value, severity }: { label: string; value: number; severity: "high" | "medium" | "none" }) {
  const colorMap = {
    high:   { text: "var(--critical-text)", dot: "var(--critical)" },
    medium: { text: "var(--medium-text)",   dot: "var(--medium)"   },
    none:   { text: "var(--text-muted)",    dot: "var(--border-strong)" },
  };
  const c = colorMap[severity] ?? colorMap.none;
  return (
    <div className="flex items-center justify-between text-[12px]">
      <div className="flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: c.dot }} />
        <span style={{ color: "var(--text-secondary)" }}>{label}</span>
      </div>
      <span className="font-semibold tabular-nums" style={{ color: c.text }}>{value}</span>
    </div>
  );
}
