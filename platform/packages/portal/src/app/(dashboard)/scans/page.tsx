"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import type { Scan } from "@/lib/api";
import { LoadingSpinner } from "@blackfyre/ui";

// REAL IMPL (BLACKFYRE 2026-06): the DEMO_SCANS fixture and DEMO_MODE bypass
// have been removed. Scans are sourced only from the live API (api.getScans).

const statusConfig: Record<
  string,
  { bg: string; text: string; label: string }
> = {
  running: {
    bg: "var(--medium-bg)",
    text: "var(--medium-text)",
    label: "Running",
  },
  completed: {
    bg: "var(--success-bg)",
    text: "var(--success-text)",
    label: "Completed",
  },
  completed_partial: {
    bg: "var(--low-bg, #fef9c3)",
    text: "var(--low-text, #854d0e)",
    label: "Partial",
  },
  failed: {
    bg: "var(--critical-bg)",
    text: "var(--critical-text)",
    label: "Failed",
  },
  queued: {
    bg: "var(--surface-raised)",
    text: "var(--text-muted)",
    label: "Queued",
  },
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export default function ScansPage() {
  const [scans, setScans] = useState<Scan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [launching, setLaunching] = useState(false);

  // REAL IMPL (BLACKFYRE 2026-06): always load scans from the live API.
  useEffect(() => {
    async function fetchScans() {
      try {
        setLoading(true);
        setError(null);
        const res = await api.getScans();
        setScans(res.scans);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load scans");
      } finally {
        setLoading(false);
      }
    }
    fetchScans();
  }, []);

  const handleNewScan = async () => {
    if (launching) return;
    setLaunching(true);
    try {
      await api.createScan({ frameworks: [], targets: [] });
      const res = await api.getScans();
      setScans(res.scans);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create scan");
    } finally {
      setLaunching(false);
    }
  };

  return (
    <div className="space-y-6 animate-halo-fade-up">
      {/* Page header */}
      <div className="animate-fade-up">
        <p className="halo-eyebrow">§ 10 · Scans</p>
      </div>
      <div
        className="flex items-center justify-between animate-fade-up -mt-4"
      >
        <div className="flex items-center gap-3">
          <h1
            className="text-xl font-semibold"
            style={{ color: "var(--text-primary)" }}
          >
            Scans
          </h1>
          <span
            className="badge"
            style={{
              background: "var(--accent-subtle)",
              color: "var(--accent)",
            }}
          >
            {scans.length}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/scans/config"
            className="btn"
            style={{
              borderColor: "var(--border)",
              color: "var(--text-secondary)",
            }}
          >
            Configure Scan
          </Link>
          <button
            onClick={handleNewScan}
            disabled={launching}
            className="btn btn-primary"
            style={{ opacity: launching ? 0.6 : 1 }}
          >
            {launching ? "Starting..." : "New Scan"}
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div
          className="card p-4 text-sm animate-fade-in"
          style={{
            borderLeft: "4px solid var(--critical)",
            color: "var(--critical-text)",
          }}
        >
          Error: {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <LoadingSpinner size="md" label="Loading scans..." />
        </div>
      )}

      {/* Table */}
      {!loading && (
        <div
          className="card overflow-x-auto animate-fade-up"
          style={{ animationDelay: "80ms" }}
        >
          <table className="data-table" role="table">
            <thead>
              <tr>
                <th scope="col" style={{ width: 120 }}>
                  Status
                </th>
                <th scope="col">Frameworks</th>
                <th scope="col">Targets</th>
                <th scope="col" style={{ width: 160 }}>
                  Progress
                </th>
                <th scope="col" style={{ width: 160 }}>
                  Started
                </th>
                <th scope="col" style={{ width: 160 }}>
                  Completed
                </th>
                <th scope="col" style={{ width: 80 }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {scans.map((scan) => {
                const stat =
                  statusConfig[scan.status] ?? statusConfig.queued;
                return (
                  <tr key={scan.id}>
                    {/* Status */}
                    <td>
                      <span
                        className="badge"
                        style={{ background: stat.bg, color: stat.text }}
                      >
                        {stat.label}
                      </span>
                    </td>

                    {/* Frameworks */}
                    <td>
                      <div className="flex flex-wrap gap-1">
                        {scan.frameworks.length > 0 ? (
                          scan.frameworks.map((fw) => (
                            <span
                              key={fw}
                              className="badge"
                              style={{
                                background: "var(--surface-raised)",
                                color: "var(--text-secondary)",
                              }}
                            >
                              {fw}
                            </span>
                          ))
                        ) : (
                          <span
                            className="text-xs"
                            style={{ color: "var(--text-muted)" }}
                          >
                            —
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Targets */}
                    <td>
                      <div className="flex flex-wrap gap-1">
                        {scan.targets.length > 0 ? (
                          scan.targets.map((t) => (
                            <span
                              key={t}
                              className="badge mono"
                              style={{
                                background: "var(--accent-subtle)",
                                color: "var(--accent)",
                              }}
                            >
                              {t}
                            </span>
                          ))
                        ) : (
                          <span
                            className="text-xs"
                            style={{ color: "var(--text-muted)" }}
                          >
                            —
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Progress */}
                    <td>
                      <div className="flex items-center gap-2">
                        <div
                          className="flex-1 rounded-full overflow-hidden"
                          style={{
                            height: 4,
                            background: "var(--border)",
                            minWidth: 80,
                          }}
                          role="progressbar"
                          aria-valuenow={scan.progress}
                          aria-valuemin={0}
                          aria-valuemax={100}
                        >
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${scan.progress}%`,
                              background:
                                scan.status === "failed"
                                  ? "var(--critical)"
                                  : scan.status === "completed_partial"
                                  ? "var(--medium)"
                                  : "var(--accent)",
                            }}
                          />
                        </div>
                        <span
                          className="text-xs mono"
                          style={{ color: "var(--text-muted)", minWidth: 30 }}
                        >
                          {scan.progress}%
                        </span>
                      </div>
                    </td>

                    {/* Started */}
                    <td>
                      <span
                        className="text-xs"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        {formatDate(scan.startedAt)}
                      </span>
                    </td>

                    {/* Completed */}
                    <td>
                      <span
                        className="text-xs"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        {formatDate(scan.completedAt)}
                      </span>
                    </td>

                    {/* Actions */}
                    <td>
                      <Link
                        href={`/scans/${scan.id}`}
                        className="btn"
                        style={{
                          fontSize: 12,
                          padding: "4px 10px",
                          color: "var(--accent)",
                          borderColor: "var(--accent)",
                        }}
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                );
              })}

              {scans.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    style={{
                      padding: "48px 20px",
                      textAlign: "center",
                      color: "var(--text-muted)",
                      fontSize: 13,
                    }}
                  >
                    No scans found.{" "}
                    <Link
                      href="/scans/config"
                      style={{ color: "var(--accent)" }}
                    >
                      Configure and start your first scan.
                    </Link>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
