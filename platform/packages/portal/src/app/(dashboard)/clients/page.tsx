"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import type { Client as ApiClient } from "@/lib/api";
import { useCountUp } from "@/lib/halo-hooks";

type Industry = "fintech" | "healthtech" | "saas" | "ecommerce";
type Plan = "retainer" | "project" | "hourly" | "annual";
type OnboardingStatus = "pending" | "configuring" | "scanning" | "active" | "suspended";

const industryConfig: Record<Industry, { style: React.CSSProperties }> = {
  fintech: { style: { background: "var(--info-bg)", color: "var(--info-text)" } },
  healthtech: { style: { background: "var(--low-bg)", color: "var(--low-text)" } },
  saas: { style: { background: "var(--success-bg)", color: "var(--success-text)" } },
  ecommerce: { style: { background: "var(--high-bg)", color: "var(--high-text)" } },
};

const planConfig: Record<Plan, { style: React.CSSProperties }> = {
  retainer: { style: { background: "var(--success-bg)", color: "var(--success-text)" } },
  project: { style: { background: "var(--low-bg)", color: "var(--low-text)" } },
  hourly: { style: { background: "var(--medium-bg)", color: "var(--medium-text)" } },
  annual: { style: { background: "var(--info-bg)", color: "var(--info-text)" } },
};

const statusConfig: Record<OnboardingStatus, { style: React.CSSProperties; label: string }> = {
  pending: { style: { background: "var(--hover-bg)", color: "var(--text-muted)" }, label: "Pending" },
  configuring: { style: { background: "var(--medium-bg)", color: "var(--medium-text)" }, label: "Configuring" },
  scanning: { style: { background: "var(--low-bg)", color: "var(--low-text)" }, label: "Scanning" },
  active: { style: { background: "var(--success-bg)", color: "var(--success-text)" }, label: "Active" },
  suspended: { style: { background: "var(--critical-bg)", color: "var(--critical-text)" }, label: "Suspended" },
};

function scoreColorStyle(score: number): React.CSSProperties {
  if (score >= 80) return { color: "var(--success-text)" };
  if (score >= 60) return { color: "var(--medium-text)" };
  return { color: "var(--critical-text)" };
}

function ClientStatCard({ label, value, style }: { label: string; value: number; style: React.CSSProperties }) {
  // Freeze the target on first paint so re-renders don't re-trigger countup.
  const [initial] = useState(value);
  const n = useCountUp(initial, 1400);
  return (
    <div className="card rounded-md shadow-sm p-4">
      <p className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>{label}</p>
      <p className="text-2xl font-bold font-mono mt-1" style={style}>{Math.round(n)}</p>
    </div>
  );
}

// REAL IMPL (BLACKFYRE 2026-06): the DEMO_CLIENTS fixture and DEMO_MODE bypass
// have been removed. Clients are sourced only from the live API
// (api.getClients).

export default function ClientsPage() {
  const [clients, setClients] = useState<ApiClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // REAL IMPL (BLACKFYRE 2026-06): always load clients from the live API.
  useEffect(() => {
    async function fetchClients() {
      try {
        setLoading(true);
        setError(null);
        const res = await api.getClients();
        setClients(res.clients);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load clients");
      } finally {
        setLoading(false);
      }
    }
    fetchClients();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-[var(--text-muted)] text-sm">Loading...</p>
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

  const total = clients.length;
  const active = clients.filter((c) => c.status === "active").length;
  const configuring = clients.filter((c) => c.status === "configuring").length;
  const pending = clients.filter((c) => c.status === "pending").length;

  const stats = [
    { label: "Total Clients", value: total, style: { color: "var(--text-primary)" } },
    { label: "Active", value: active, style: { color: "var(--success-text)" } },
    { label: "Configuring", value: configuring, style: { color: "var(--medium-text)" } },
    { label: "Pending", value: pending, style: { color: "var(--text-muted)" } },
  ];

  return (
    <div className="space-y-5 animate-halo-fade-up">
      {/* Header */}
      <div>
        <p className="halo-eyebrow mb-2">§ 22 · Clients</p>
      </div>
      <div className="flex items-center justify-between -mt-4">
        <h2 className="text-lg font-semibold font-heading" style={{ color: "var(--text-primary)" }}>Client Management</h2>
        <button className="px-4 py-2 text-sm rounded-md bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--accent-fg)] font-semibold transition-all duration-200 hover:shadow-glow-sm">
          Add Client
        </button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {stats.map((s) => (
          <ClientStatCard key={s.label} label={s.label} value={s.value} style={s.style} />
        ))}
      </div>

      {/* Client Table */}
      <div className="card rounded-md shadow-sm overflow-x-auto">
        <table className="w-full text-sm glass-table" role="table">
          <thead>
            <tr className="border-b border-[var(--border)]">
              <th scope="col" className="text-left px-5 py-3 font-medium text-[var(--text-muted)]">Company Name</th>
              <th scope="col" className="text-left px-5 py-3 font-medium text-[var(--text-muted)] w-28">Industry</th>
              <th scope="col" className="text-left px-5 py-3 font-medium text-[var(--text-muted)] w-24">Plan</th>
              <th scope="col" className="text-left px-5 py-3 font-medium text-[var(--text-muted)] w-28">Compliance</th>
              <th scope="col" className="text-left px-5 py-3 font-medium text-[var(--text-muted)] w-28">Status</th>
              <th scope="col" className="text-left px-5 py-3 font-medium text-[var(--text-muted)] w-28">Last Scan</th>
              <th scope="col" className="text-left px-5 py-3 font-medium text-[var(--text-muted)] w-24">Actions</th>
            </tr>
          </thead>
          <tbody>
            {clients.map((c) => {
              const ind = industryConfig[c.industry as Industry] ?? { style: { background: "var(--hover-bg)", color: "var(--text-muted)" } };
              const pl = planConfig[c.plan as Plan] ?? { style: { background: "var(--hover-bg)", color: "var(--text-muted)" } };
              const stat = statusConfig[c.status as OnboardingStatus] ?? statusConfig.pending;
              return (
                <tr key={c.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--hover-bg)] transition-colors">
                  <td className="px-5 py-3">
                    <p className="font-medium" style={{ color: "var(--text-primary)" }}>{c.company}</p>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">{c.id}</p>
                  </td>
                  <td className="px-5 py-3">
                    <span className="inline-block px-2.5 py-0.5 rounded-md text-xs font-medium" style={ind.style}>
                      {c.industry}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <span className="inline-block px-2.5 py-0.5 rounded-md text-xs font-medium" style={pl.style}>
                      {c.plan}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <span className="font-semibold" style={scoreColorStyle(c.complianceScore)}>
                      {c.complianceScore}%
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <span className="inline-block px-2.5 py-0.5 rounded-md text-xs font-medium" style={stat.style}>
                      {stat.label}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-[var(--text-muted)]">{c.lastScan ? c.lastScan.split("T")[0] : "--"}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <button className="text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors" aria-label={`View ${c.company}`} title="View">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      </button>
                      <button className="text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors" aria-label={`Edit ${c.company}`} title="Edit">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {clients.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-8 text-center text-[var(--text-muted)]">
                  No clients found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
