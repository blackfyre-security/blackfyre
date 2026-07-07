import React from "react";

export interface ScanCompletionBannerProps {
  totalFindings: number;
  findingsBySeverity: Record<string, number>;
  scanId: string;
}

const severityOrder = ["critical", "high", "medium", "low", "info"] as const;

const severityColors: Record<string, { text: string; bg: string }> = {
  critical: { text: "var(--critical-text)", bg: "var(--critical-bg)" },
  high:     { text: "var(--high-text)",     bg: "var(--high-bg)" },
  medium:   { text: "var(--medium-text)",   bg: "var(--medium-bg)" },
  low:      { text: "var(--low-text)",      bg: "var(--low-bg)" },
  info:     { text: "var(--info-text)",     bg: "var(--info-bg)" },
};

export function ScanCompletionBanner({
  totalFindings,
  findingsBySeverity,
  scanId,
}: ScanCompletionBannerProps) {
  const stats = severityOrder
    .filter((s) => (findingsBySeverity[s] ?? 0) > 0)
    .map((s) => ({
      severity: s,
      count:    findingsBySeverity[s] ?? 0,
      colors:   severityColors[s],
    }));

  return (
    <div
      className="card border-l-4 px-5 py-4 animate-fade-up"
      style={{ borderLeftColor: "var(--success)" }}
    >
      <div className="flex items-start justify-between flex-wrap gap-4">
        {/* Left: icon + heading */}
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 flex items-center justify-center shrink-0"
            style={{ background: "var(--success-bg)", borderRadius: 6 }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--success-text)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <path d="M9 12l2 2 4-4" />
            </svg>
          </div>
          <span
            className="text-sm font-semibold"
            style={{ color: "var(--text-primary)" }}
          >
            Scan complete
          </span>
        </div>

        {/* Right: severity breakdown */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs mono" style={{ color: "var(--text-muted)" }}>
            {totalFindings} findings
          </span>
          {stats.map((s) => (
            <span
              key={s.severity}
              className="badge"
              style={{ background: s.colors.bg, color: s.colors.text }}
            >
              {s.count} {s.severity}
            </span>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 mt-4">
        <a
          href={`/api/reports/scan/${encodeURIComponent(scanId)}`}
          className="btn btn-primary btn-sm"
        >
          Download Report
        </a>
        <a
          href={`/findings?scanId=${encodeURIComponent(scanId)}`}
          className="btn btn-secondary btn-sm"
        >
          View All Findings
        </a>
      </div>
    </div>
  );
}
