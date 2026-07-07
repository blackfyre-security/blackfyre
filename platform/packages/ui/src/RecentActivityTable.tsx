import React from "react";

export interface Activity {
  date: string;
  type: string;
  status: string;
  findings: number;
}

export interface RecentActivityTableProps {
  activities: Activity[];
}

const statusStyleMap: Record<string, { bg: string; text: string }> = {
  Completed:    { bg: "var(--success-bg)",  text: "var(--success-text)" },
  "In Progress":{ bg: "var(--medium-bg)",   text: "var(--medium-text)" },
  Failed:       { bg: "var(--critical-bg)", text: "var(--critical-text)" },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = statusStyleMap[status] ?? {
    bg:   "var(--surface-raised)",
    text: "var(--text-muted)",
  };
  return (
    <span
      className="badge"
      style={{ background: cfg.bg, color: cfg.text }}
      aria-label={`Status: ${status}`}
    >
      {status}
    </span>
  );
}

export function RecentActivityTable({ activities }: RecentActivityTableProps) {
  if (activities.length === 0) {
    return (
      <div
        className="card p-8 text-center text-sm animate-fade-up"
        style={{ color: "var(--text-muted)" }}
      >
        No recent activity to display.
      </div>
    );
  }

  return (
    <div className="card overflow-x-auto animate-fade-up">
      <table className="data-table" role="table">
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Type</th>
            <th scope="col">Status</th>
            <th scope="col" style={{ textAlign: "right" }}>
              Findings
            </th>
          </tr>
        </thead>
        <tbody>
          {activities.map((a, i) => (
            <tr key={i}>
              <td
                className="mono text-xs"
                style={{ color: "var(--text-muted)" }}
              >
                {a.date}
              </td>
              <td
                className="font-medium"
                style={{ color: "var(--text-primary)" }}
              >
                {a.type}
              </td>
              <td>
                <StatusBadge status={a.status} />
              </td>
              <td
                className="mono text-right"
                style={{ color: "var(--text-secondary)" }}
              >
                {a.findings}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
