"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import type { Finding as ApiFinding } from "@/lib/api";
import { LoadingSpinner } from "@blackfyre/ui";

const severityConfig: Record<string, { badgeClass: string }> = {
  critical: { badgeClass: "badge badge-critical" },
  high:     { badgeClass: "badge badge-high" },
  medium:   { badgeClass: "badge badge-medium" },
  low:      { badgeClass: "badge badge-low" },
  info:     { badgeClass: "badge badge-info" },
};

const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
  open:          { bg: "var(--critical-bg)",  text: "var(--critical-text)",  label: "Open" },
  acknowledged:  { bg: "var(--medium-bg)",    text: "var(--medium-text)",    label: "Acknowledged" },
  in_progress:   { bg: "var(--medium-bg)",    text: "var(--medium-text)",    label: "In Progress" },
  resolved:      { bg: "var(--success-bg)",   text: "var(--success-text)",   label: "Resolved" },
  dismissed:     { bg: "var(--surface-raised)", text: "var(--text-muted)",   label: "Dismissed" },
};

const SEVERITY_OPTS = ["all", "critical", "high", "medium", "low", "info"];
const STATUS_OPTS   = ["all", "open", "in_progress", "resolved", "dismissed"];

// REAL IMPL (BLACKFYRE 2026-06): the 25-row DEMO_FINDINGS fixture and the
// DEMO_MODE bypass have been removed. Findings are sourced only from the live
// API (api.getFindings). Empty/error/loading states are honest.

const PAGE_SIZE = 20;

export default function FindingsPage() {
  const [severityFilter, setSeverityFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [findings, setFindings] = useState<ApiFinding[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  // REAL IMPL (BLACKFYRE 2026-06): always load findings from the live API.
  useEffect(() => {
    async function fetchFindings() {
      try {
        setLoading(true);
        setError(null);
        const params: Record<string, string> = {};
        if (severityFilter !== "all") params.severity = severityFilter;
        if (statusFilter !== "all") params.status = statusFilter;
        if (search) params.search = search;
        const res = await api.getFindings(
          Object.keys(params).length > 0 ? params : undefined
        );
        setFindings(res.findings);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load findings");
      } finally {
        setLoading(false);
      }
    }
    fetchFindings();
  }, [severityFilter, statusFilter, search]);

  const filtered = findings.filter((f) => {
    if (search && !f.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="animate-fade-up">
        <p className="halo-eyebrow">§ 02 · Findings</p>
      </div>
      <div className="flex items-center gap-3 animate-fade-up -mt-4">
        <h1 className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>
          Findings
        </h1>
        <span
          className="badge"
          style={{ background: "var(--accent-subtle)", color: "var(--accent)" }}
        >
          {findings.length}
        </span>
      </div>

      {/* Filter bar */}
      <div
        className="card p-4 flex flex-wrap items-center gap-3 animate-fade-up"
        style={{ animationDelay: "60ms" }}
      >
        {/* Severity tab pills */}
        <div
          className="flex items-center gap-1 rounded-lg p-1"
          style={{ background: "var(--surface-raised)", border: "1px solid var(--border)" }}
          role="group"
          aria-label="Filter by severity"
        >
          {SEVERITY_OPTS.map((sev) => (
            <button
              key={sev}
              onClick={() => { setSeverityFilter(sev); setPage(1); }}
              className="text-xs font-medium px-3 py-1.5 rounded-md transition-all"
              style={
                severityFilter === sev
                  ? { background: "var(--surface)", color: "var(--text-primary)", boxShadow: "var(--shadow-card)" }
                  : { color: "var(--text-secondary)", background: "transparent" }
              }
            >
              {sev === "all" ? "All" : sev.charAt(0).toUpperCase() + sev.slice(1)}
            </button>
          ))}
        </div>

        {/* Status select */}
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          aria-label="Filter by status"
          className="input"
          style={{ width: "auto", minWidth: 140 }}
        >
          {STATUS_OPTS.map((s) => (
            <option key={s} value={s}>
              {s === "all" ? "All Statuses" : s === "in_progress" ? "In Progress" : s.charAt(0).toUpperCase() + s.slice(1)}
            </option>
          ))}
        </select>

        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--text-muted)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="text"
            placeholder="Search findings..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            aria-label="Search findings"
            className="input"
            style={{ paddingLeft: 34 }}
          />
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <LoadingSpinner size="md" label="Loading findings..." />
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div
          className="card p-4 text-sm animate-fade-in"
          style={{ borderLeft: "4px solid var(--critical)", color: "var(--critical-text)" }}
        >
          Error: {error}
        </div>
      )}

      {/* Table */}
      {!loading && !error && (
        <>
        <div className="card overflow-x-auto animate-fade-up" style={{ animationDelay: "80ms" }}>
          <table className="data-table" role="table">
            <thead>
              <tr>
                <th scope="col" style={{ width: 110 }}>Severity</th>
                <th scope="col">Title</th>
                <th scope="col">Category</th>
                <th scope="col" style={{ width: 130 }}>Status</th>
                <th scope="col" style={{ width: 90 }}>Tier</th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((f) => {
                const sev  = severityConfig[f.severity]  ?? severityConfig.info;
                const stat = statusConfig[f.status]      ?? statusConfig.open;
                const critActive = f.severity === "critical" && f.status === "open";
                return (
                  <tr key={f.id}>
                    <td>
                      <span className={`${sev.badgeClass}${critActive ? " halo-pulse-critical" : ""}`}>
                        {f.severity.charAt(0).toUpperCase() + f.severity.slice(1)}
                      </span>
                    </td>
                    <td>
                      <Link href={`/findings/${f.id}`} className="hover:underline">
                        <p className="font-medium text-sm" style={{ color: "var(--text-primary)" }}>{f.title}</p>
                      </Link>
                      <p className="text-xs mono mt-0.5" style={{ color: "var(--text-muted)" }}>{f.id}</p>
                    </td>
                    <td>
                      <span
                        className="badge"
                        style={{ background: "var(--surface-raised)", color: "var(--text-secondary)" }}
                      >
                        {f.category}
                      </span>
                    </td>
                    <td>
                      <span
                        className="badge"
                        style={{ background: stat.bg, color: stat.text }}
                      >
                        {stat.label}
                      </span>
                    </td>
                    <td className="mono text-xs" style={{ color: "var(--text-muted)" }}>{f.remediationTier}</td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ padding: "48px 20px", textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
                    {/* REAL IMPL (BLACKFYRE 2026-06): distinguish "no findings yet"
                        from "filtered out". Never invent rows. */}
                    {findings.length === 0
                      ? "No findings yet. Run a scan to populate this list."
                      : "No findings match the current filters."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3" style={{ color: "var(--text-secondary)", fontSize: 13 }}>
            <span>
              Showing {((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="btn btn-sm"
                style={{ opacity: page === 1 ? 0.4 : 1 }}
              >
                Previous
              </button>
              <span className="px-3 text-xs">{page} / {totalPages}</span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="btn btn-sm"
                style={{ opacity: page === totalPages ? 0.4 : 1 }}
              >
                Next
              </button>
            </div>
          </div>
        )}
        </>
      )}
    </div>
  );
}
