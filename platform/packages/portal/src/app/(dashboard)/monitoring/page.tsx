"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import type { DriftEvent as ApiDriftEvent, DriftStats } from "@/lib/api";
import { LoadingSpinner } from "@blackfyre/ui";

type ChangeType = "created" | "modified" | "deleted";
type Severity = "critical" | "high" | "medium" | "low" | "info";

const changeTypeConfig: Record<ChangeType, { style: React.CSSProperties; label: string }> = {
  created: { style: { background: "var(--success-bg)", color: "var(--success-text)" }, label: "Created" },
  modified: { style: { background: "var(--medium-bg)", color: "var(--medium-text)" }, label: "Modified" },
  deleted: { style: { background: "var(--critical-bg)", color: "var(--critical-text)" }, label: "Deleted" },
};

const severityConfig: Record<Severity, { style: React.CSSProperties }> = {
  critical: { style: { background: "var(--critical-bg)", color: "var(--critical-text)" } },
  high: { style: { background: "var(--high-bg)", color: "var(--high-text)" } },
  medium: { style: { background: "var(--medium-bg)", color: "var(--medium-text)" } },
  low: { style: { background: "var(--low-bg)", color: "var(--low-text)" } },
  info: { style: { background: "var(--surface-raised)", color: "var(--text-secondary)" } },
};

// REAL IMPL (BLACKFYRE 2026-06): the DEMO_DRIFT_EVENTS fixture (fabricated AWS
// ARNs presented as real drift detections) and DEMO_DRIFT_STATS, plus the
// DEMO_MODE bypass, have been removed. Drift events/stats are sourced only from
// the live API (api.getDriftEvents / getDriftStats).

export default function MonitoringPage() {
  const [severityFilter, setSeverityFilter] = useState("all");
  const [changeTypeFilter, setChangeTypeFilter] = useState("all");
  const [showAcknowledged, setShowAcknowledged] = useState(true);
  const [driftEvents, setDriftEvents] = useState<ApiDriftEvent[]>([]);
  const [driftStats, setDriftStats] = useState<DriftStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // REAL IMPL (BLACKFYRE 2026-06): always load drift data from the live API.
  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        setError(null);
        const [eventsRes, statsRes] = await Promise.all([
          api.getDriftEvents(),
          api.getDriftStats(),
        ]);
        setDriftEvents(eventsRes.driftEvents);
        setDriftStats(statsRes.stats);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load monitoring data");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const filtered = driftEvents.filter((e) => {
    if (severityFilter !== "all" && e.severity !== severityFilter) return false;
    if (changeTypeFilter !== "all" && e.changeType !== changeTypeFilter) return false;
    if (!showAcknowledged && e.acknowledged) return false;
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <LoadingSpinner label="Loading monitoring data..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-[var(--critical-text)] text-sm">Error: {error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-halo-fade-up">
      {/* Header */}
      <div>
        <p className="halo-eyebrow mb-2">§ 07 · Monitoring</p>
        <h2 className="text-lg font-semibold font-heading" style={{ color: "var(--text-primary)" }}>Continuous Monitoring</h2>
      </div>

      {/* Stats summary */}
      {driftStats && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="card rounded-md shadow-sm p-5 flex items-center gap-4">
            <div
              className="shrink-0 w-10 h-10 rounded-md flex items-center justify-center text-sm font-bold"
              style={{ background: "var(--hover-bg)", color: "var(--text-secondary)" }}
            >
              Tot
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium" style={{ color: "var(--text-primary)" }}>Total Events</p>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
                <span className="font-mono">{driftStats.total}</span> detected
              </p>
            </div>
          </div>
          <div className="card rounded-md shadow-sm p-5 flex items-center gap-4">
            <div
              className="shrink-0 w-10 h-10 rounded-md flex items-center justify-center text-sm font-bold"
              style={{ background: "var(--hover-bg)", color: "var(--text-secondary)" }}
            >
              Unr
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium" style={{ color: "var(--text-primary)" }}>Unacknowledged</p>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
                <span className="font-mono">{driftStats.unacknowledged}</span> pending review
              </p>
            </div>
          </div>
          <div className="card rounded-md shadow-sm p-5 flex items-center gap-4">
            <div
              className="shrink-0 w-10 h-10 rounded-md flex items-center justify-center text-sm font-bold"
              style={{ background: "var(--hover-bg)", color: "var(--text-secondary)" }}
            >
              Sev
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium" style={{ color: "var(--text-primary)" }}>By Severity</p>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
                {Object.entries(driftStats.bySeverity).map(([k, v]) => `${k}: ${v}`).join(", ")}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Drift Events Section */}
      <div>
        <h3 className="text-lg font-semibold font-heading mb-3" style={{ color: "var(--text-primary)" }}>Drift Events</h3>

        {/* Filter Bar */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="input text-sm"
            style={{ width: "auto" }}
          >
            <option value="all">All Severities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>

          <select
            value={changeTypeFilter}
            onChange={(e) => setChangeTypeFilter(e.target.value)}
            className="input text-sm"
            style={{ width: "auto" }}
          >
            <option value="all">All Changes</option>
            <option value="created">Created</option>
            <option value="modified">Modified</option>
            <option value="deleted">Deleted</option>
          </select>

          <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: "var(--text-secondary)" }}>
            <input
              type="checkbox"
              checked={showAcknowledged}
              onChange={(e) => setShowAcknowledged(e.target.checked)}
              className="w-4 h-4 rounded accent-emerald-500"
            />
            Show acknowledged
          </label>
        </div>

        {/* Drift Table */}
        <div className="card rounded-md shadow-sm overflow-x-auto">
          <table className="w-full text-sm data-table" role="table">
            <thead>
              <tr>
                <th scope="col" className="w-40">Detected At</th>
                <th scope="col">Resource</th>
                <th scope="col" className="w-28">Change Type</th>
                <th scope="col" className="w-28">Severity</th>
                <th scope="col" className="text-center w-28">Acknowledged</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((evt) => {
                const ct = changeTypeConfig[evt.changeType] ?? changeTypeConfig.modified;
                const sev = severityConfig[evt.severity] ?? severityConfig.medium;
                return (
                  <tr key={evt.id}>
                    <td className="font-mono text-xs" style={{ color: "var(--text-secondary)" }}>{evt.detectedAt}</td>
                    <td>
                      <p className="font-medium font-mono text-xs" style={{ color: "var(--text-primary)" }}>{evt.resourceId}</p>
                      <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>{evt.id}</p>
                    </td>
                    <td>
                      <span className="inline-block px-2.5 py-0.5 rounded-md text-xs font-medium" style={ct.style}>
                        {ct.label}
                      </span>
                    </td>
                    <td>
                      <span className="inline-block px-2.5 py-0.5 rounded-md text-xs font-medium" style={sev.style}>
                        {(evt.severity ?? "").charAt(0).toUpperCase() + (evt.severity ?? "").slice(1)}
                      </span>
                    </td>
                    <td className="text-center">
                      <input
                        type="checkbox"
                        checked={evt.acknowledged}
                        readOnly
                        className="w-4 h-4 rounded accent-emerald-500"
                      />
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center" style={{ color: "var(--text-secondary)" }}>
                    No drift events match the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
