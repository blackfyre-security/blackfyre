"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import type { Report } from "@/lib/api";
import { LoadingSpinner } from "@blackfyre/ui";

const reportTypes = [
  {
    title: "Readiness Report",
    description: "Generate a compliance readiness assessment",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
  },
  {
    title: "Evidence Package",
    description: "Export auditor-ready evidence bundle",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
      </svg>
    ),
  },
  {
    title: "Board Summary",
    description: "Executive compliance overview",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    ),
  },
  {
    title: "Gap Analysis",
    description: "Detailed gap identification",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
    ),
  },
];

type ReportStatus = "ready" | "generating" | "failed";

const statusConfig: Record<ReportStatus, { style: React.CSSProperties; label: string }> = {
  ready: { style: { background: "var(--success-bg)", color: "var(--success-text)" }, label: "Ready" },
  generating: { style: { background: "var(--medium-bg)", color: "var(--medium-text)" }, label: "Generating" },
  failed: { style: { background: "var(--critical-bg)", color: "var(--critical-text)" }, label: "Failed" },
};

const typeConfig: Record<string, { style: React.CSSProperties }> = {
  Readiness: { style: { background: "var(--low-bg)", color: "var(--low-text)" } },
  Evidence: { style: { background: "var(--info-bg)", color: "var(--info-text)" } },
  "Board Summary": { style: { background: "var(--info-bg)", color: "var(--info-text)" } },
  "Gap Analysis": { style: { background: "var(--accent-subtle)", color: "var(--accent)" } },
};

// REAL IMPL (BLACKFYRE 2026-06): the DEMO_REPORTS fixture and DEMO_MODE bypass
// have been removed. Reports are sourced only from the live API
// (api.getReports).

export default function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generatingType, setGeneratingType] = useState<string | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);

  async function fetchReports() {
    // REAL IMPL (BLACKFYRE 2026-06): always load reports from the live API.
    try {
      setLoading(true);
      setError(null);
      const res = await api.getReports();
      setReports(res.reports);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load reports");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchReports();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleGenerate(title: string) {
    setGeneratingType(title);
    setGenerateError(null);
    try {
      await api.generateReport(title);
      await fetchReports();
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : "Failed to generate report");
    } finally {
      setGeneratingType(null);
    }
  }

  async function handleRetry(r: Report) {
    try {
      await api.generateReport(r.type, r.framework ?? undefined);
      await fetchReports();
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : "Failed to retry report");
    }
  }

  return (
    <div className="space-y-6 animate-halo-fade-up">
      {/* Header */}
      <div>
        <p className="halo-eyebrow mb-2">§ 09 · Reports</p>
        <h2 className="text-lg font-semibold font-heading" style={{ color: "var(--text-primary)" }}>Reports &amp; Evidence</h2>
      </div>

      {/* Generate error banner */}
      {generateError && (
        <div className="rounded-md px-4 py-3 text-sm" style={{ background: "var(--critical-bg)", color: "var(--critical-text)" }}>
          {generateError}
        </div>
      )}

      {/* Report Type Cards - 2x2 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {reportTypes.map((rt) => (
          <div key={rt.title} className="card rounded-md shadow-sm p-5 flex items-start gap-4">
            <div
              className="shrink-0 w-10 h-10 rounded-md flex items-center justify-center"
              style={{ background: "var(--accent-subtle)", color: "var(--accent)" }}
            >
              {rt.icon}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium" style={{ color: "var(--text-primary)" }}>{rt.title}</p>
              <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>{rt.description}</p>
            </div>
            <button
              className="btn btn-primary btn-sm shrink-0"
              aria-label={`Generate ${rt.title}`}
              disabled={generatingType === rt.title}
              onClick={() => handleGenerate(rt.title)}
            >
              {generatingType === rt.title ? "Generating..." : "Generate"}
            </button>
          </div>
        ))}
      </div>

      {/* Recent Reports */}
      <div>
        <h3 className="text-lg font-semibold font-heading mb-3" style={{ color: "var(--text-primary)" }}>Recent Reports</h3>

        {loading && (
          <div className="flex items-center justify-center py-12">
            <LoadingSpinner label="Loading reports..." />
          </div>
        )}

        {error && (
          <div className="flex items-center justify-center py-12">
            <p className="text-[var(--critical-text)] text-sm">Error: {error}</p>
          </div>
        )}

        {!loading && !error && (
          <div className="card rounded-md shadow-sm overflow-x-auto">
            <table className="w-full text-sm data-table" role="table">
              <thead>
                <tr>
                  <th scope="col">Report</th>
                  <th scope="col" className="w-32">Type</th>
                  <th scope="col" className="w-28">Framework</th>
                  <th scope="col" className="w-28">Status</th>
                  <th scope="col" className="w-28">Date</th>
                  <th scope="col" className="w-28">Action</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((r) => {
                  const stat = statusConfig[r.status] ?? statusConfig.generating;
                  const tp = typeConfig[r.type] ?? { style: { background: "var(--surface-raised)", color: "var(--text-secondary)" } };
                  return (
                    <tr key={r.id}>
                      <td>
                        <p className="font-medium" style={{ color: "var(--text-primary)" }}>{r.type}{r.framework ? ` - ${r.framework}` : ""}</p>
                        <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{r.id}</p>
                      </td>
                      <td>
                        <span className="inline-block px-2.5 py-0.5 rounded-md text-xs font-medium" style={tp.style}>
                          {r.type}
                        </span>
                      </td>
                      <td style={{ color: "var(--text-secondary)" }}>{r.framework ?? "All"}</td>
                      <td>
                        <span className="inline-block px-2.5 py-0.5 rounded-md text-xs font-medium" style={stat.style}>
                          {stat.label}
                        </span>
                      </td>
                      <td style={{ color: "var(--text-secondary)" }}>{r.generatedAt ? r.generatedAt.split("T")[0] : "--"}</td>
                      <td>
                        {r.status === "ready" ? (
                          <a
                            href={api.downloadReport(r.id)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-medium transition-colors"
                            style={{ color: "var(--accent)" }}
                          >
                            Download
                          </a>
                        ) : r.status === "failed" ? (
                          <button
                            className="text-xs font-medium transition-colors"
                            style={{ color: "var(--accent)" }}
                            onClick={() => handleRetry(r)}
                          >
                            Retry
                          </button>
                        ) : (
                          <span className="text-xs" style={{ color: "var(--text-muted)" }}>--</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {reports.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-8 text-center" style={{ color: "var(--text-secondary)" }}>
                      No reports found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
