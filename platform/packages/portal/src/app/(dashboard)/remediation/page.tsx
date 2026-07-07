"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import type { Remediation } from "@/lib/api";
import { StatCard, LoadingSpinner } from "@blackfyre/ui";

type Tier = "auto" | "approval" | "manual";
type Status = "pending" | "approved" | "executing" | "completed" | "failed" | "rolled_back";

const tierConfig: Record<Tier, { style: React.CSSProperties; label: string }> = {
  auto: { style: { background: "var(--success-bg)", color: "var(--success-text)" }, label: "Auto" },
  approval: { style: { background: "var(--medium-bg)", color: "var(--medium-text)" }, label: "Approval" },
  manual: { style: { background: "var(--low-bg)", color: "var(--low-text)" }, label: "Manual" },
};

const statusConfig: Record<Status, { style: React.CSSProperties; label: string }> = {
  pending: { style: { background: "var(--surface-raised)", color: "var(--text-secondary)" }, label: "Pending" },
  approved: { style: { background: "var(--low-bg)", color: "var(--low-text)" }, label: "Approved" },
  executing: { style: { background: "var(--medium-bg)", color: "var(--medium-text)" }, label: "Executing" },
  completed: { style: { background: "var(--success-bg)", color: "var(--success-text)" }, label: "Completed" },
  failed: { style: { background: "var(--critical-bg)", color: "var(--critical-text)" }, label: "Failed" },
  rolled_back: { style: { background: "var(--high-bg)", color: "var(--high-text)" }, label: "Rolled Back" },
};

function getActionLabel(tier: Tier, status: Status): string {
  if (status === "completed" || status === "rolled_back") return "View";
  if (tier === "auto") return "Fix";
  if (tier === "approval" && status === "pending") return "Approve";
  if (tier === "manual") return "View Playbook";
  return "View";
}

const PAGE_SIZE = 20;

// REAL IMPL (BLACKFYRE 2026-06): the DEMO_REMEDIATIONS fixture and DEMO_MODE
// bypass have been removed. Remediations are sourced only from the live API
// (api.getRemediations).

export default function RemediationPage() {
  const [remediations, setRemediations] = useState<Remediation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [expandedPlaybook, setExpandedPlaybook] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  async function fetchRemediations() {
    // REAL IMPL (BLACKFYRE 2026-06): always load remediations from the live API.
    try {
      setLoading(true);
      setError(null);
      const res = await api.getRemediations();
      setRemediations(res.remediations);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load remediations");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchRemediations();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleAction(item: Remediation) {
    const label = getActionLabel(item.tier, item.status);

    // View Playbook — toggle expanded row, no API call
    if (label === "View Playbook") {
      setExpandedPlaybook((prev) => (prev === item.id ? null : item.id));
      return;
    }

    // View (completed / rolled_back) — no-op for now, could navigate in future
    if (label === "View") {
      return;
    }

    setActionLoading(item.id);
    setActionError(null);
    try {
      if (label === "Fix") {
        await api.executeRemediation(item.id);
      } else if (label === "Approve") {
        await api.approveRemediation(item.id);
      }
      await fetchRemediations();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : `Failed to ${label.toLowerCase()} remediation`);
    } finally {
      setActionLoading(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <LoadingSpinner label="Loading remediation data..." />
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

  const completedCount = remediations.filter((i) => i.status === "completed").length;
  const autoFixable = remediations.filter((i) => i.tier === "auto" && i.status !== "completed").length;
  const awaitingApproval = remediations.filter((i) => i.tier === "approval" && i.status === "pending").length;
  const inProgress = remediations.filter((i) => i.status === "executing").length;

  const totalPages = Math.ceil(remediations.length / PAGE_SIZE);
  const paginated = remediations.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-5 animate-halo-fade-up">
      {/* Header */}
      <div>
        <p className="halo-eyebrow mb-2">§ 08 · Remediation</p>
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold font-heading" style={{ color: "var(--text-primary)" }}>Remediation Center</h2>
          <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
            <span className="font-mono">{completedCount}</span> of <span className="font-mono">{remediations.length}</span> completed
          </span>
        </div>
      </div>

      {/* Action error banner */}
      {actionError && (
        <div className="rounded-md px-4 py-3 text-sm" style={{ background: "var(--critical-bg)", color: "var(--critical-text)" }}>
          {actionError}
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="Auto-fixable" value={autoFixable} subtitle="Can be resolved automatically" color="green" />
        <StatCard title="Awaiting Approval" value={awaitingApproval} subtitle="Needs human sign-off" color="yellow" />
        <StatCard title="In Progress" value={inProgress} subtitle="Currently executing" color="blue" />
      </div>

      {/* Remediation Table */}
      <div className="card rounded-md shadow-sm overflow-x-auto">
        <table className="w-full text-sm data-table" role="table">
          <thead>
            <tr>
              <th scope="col">Finding</th>
              <th scope="col" className="w-28">Tier</th>
              <th scope="col" className="w-32">Status</th>
              <th scope="col" className="w-36">Action</th>
            </tr>
          </thead>
          <tbody>
            {paginated.map((item) => {
              const tier = tierConfig[item.tier] ?? tierConfig.manual;
              const stat = statusConfig[item.status] ?? statusConfig.pending;
              const label = getActionLabel(item.tier, item.status);
              const isLoading = actionLoading === item.id;
              return (
                <>
                  <tr key={item.id}>
                    <td>
                      <p className="font-medium" style={{ color: "var(--text-primary)" }}>{item.findingId}</p>
                      <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{item.id}</p>
                    </td>
                    <td>
                      <span className="inline-block px-2.5 py-0.5 rounded-md text-xs font-medium" style={tier.style}>
                        {tier.label}
                      </span>
                    </td>
                    <td>
                      <span className="inline-block px-2.5 py-0.5 rounded-md text-xs font-medium" style={stat.style}>
                        {stat.label}
                      </span>
                    </td>
                    <td>
                      <button
                        className="btn btn-primary btn-sm"
                        disabled={isLoading}
                        onClick={() => handleAction(item)}
                      >
                        {isLoading ? "..." : label}
                      </button>
                    </td>
                  </tr>
                  {expandedPlaybook === item.id && item.playbookContent && (
                    <tr key={`${item.id}-playbook`}>
                      <td colSpan={4} className="px-5 py-4" style={{ background: "var(--surface-raised)" }}>
                        <p className="text-xs font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>Playbook</p>
                        <pre className="text-xs whitespace-pre-wrap" style={{ color: "var(--text-primary)" }}>{item.playbookContent}</pre>
                      </td>
                    </tr>
                  )}
                  {expandedPlaybook === item.id && !item.playbookContent && (
                    <tr key={`${item.id}-playbook-empty`}>
                      <td colSpan={4} className="px-5 py-4 text-xs" style={{ background: "var(--surface-raised)", color: "var(--text-secondary)" }}>
                        No playbook content available.
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3" style={{ color: "var(--text-secondary)", fontSize: 13 }}>
          <span>
            Showing {((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, remediations.length)} of {remediations.length}
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
    </div>
  );
}
