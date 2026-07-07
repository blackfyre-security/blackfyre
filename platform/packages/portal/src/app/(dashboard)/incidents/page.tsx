"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

type Severity = "p1" | "p2" | "p3" | "p4";
type Incident = { id: string; title: string; severity: Severity; source: string; status: string; sla: number; response: number; created: string };

const SEV_COLORS: Record<Severity, string> = { p1: "#ef4444", p2: "#f97316", p3: "#fbbf24", p4: "#6b7280" };
const SEV_BG: Record<Severity, string> = { p1: "#7f1d1d", p2: "#7c2d12", p3: "#422006", p4: "#1f2937" };
const STATUS_COLORS: Record<string, string> = { detected: "#ef4444", triaged: "#f97316", investigating: "#818cf8", contained: "#60a5fa", remediating: "#c084fc", resolved: "#4ade80", closed: "#6b7280" };
const AGENT_COLORS: Record<string, string> = { scout: "#60a5fa", pulse: "#fbbf24", signal: "#ef4444" };

function timeAgo(iso: string): string {
  const t = new Date(iso).getTime();
  const diff = Date.now() - t;
  if (Number.isNaN(t)) return iso;
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${Math.max(mins, 1)}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function IncidentsPage() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getIncidents()
      .then((res) => setIncidents((res.incidents ?? []) as Incident[]))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load incidents"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-6 text-text-muted text-sm">Loading incidents…</div>;
  if (error) return <div className="p-6 text-red-400 text-sm">Error: {error}</div>;

  const filtered = filter === "all" ? incidents : incidents.filter((i) => i.status === filter);
  const open = incidents.filter((i) => !["resolved", "closed"].includes(i.status)).length;
  const resolved = incidents.filter((i) => i.status === "resolved" || i.status === "closed").length;
  const avgResponse = incidents.length ? Math.round(incidents.reduce((s, i) => s + i.response, 0) / incidents.length) : 0;
  const slaBreaches = incidents.filter((i) => i.response > i.sla).length;

  return (
    <div className="animate-halo-fade-up">
      <p className="halo-eyebrow">§ 21 · Incidents</p>
      <h1 className="mt-2 mb-6 text-xl font-semibold text-text-primary">Incidents</h1>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-6">
        {[
          { label: "Total", value: incidents.length, color: "white" },
          { label: "Open", value: open, color: "#f87171" },
          { label: "Resolved", value: resolved, color: "#4ade80" },
          { label: "Avg Response", value: `${avgResponse}min`, color: "#60a5fa" },
          { label: "SLA Breaches", value: slaBreaches, color: slaBreaches > 0 ? "#f87171" : "#4ade80" },
        ].map((m) => (
          <div key={m.label} className="rounded-xl border border-border bg-surface p-3">
            <div className="text-xs text-text-muted">{m.label}</div>
            <div className="text-lg font-bold" style={{ color: m.color }}>{m.value}</div>
          </div>
        ))}
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        {["all", "detected", "triaged", "investigating", "resolved", "closed"].map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${filter === f ? "border-indigo-600 bg-indigo-950/30 text-indigo-300" : "border-border bg-surface text-text-muted hover:border-border-strong"}`}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {filtered.map((inc) => (
          <div key={inc.id} className="rounded-xl border border-border bg-surface px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded${inc.severity === "p1" && !["resolved", "closed"].includes(inc.status) ? " halo-pulse-critical" : ""}`} style={{ color: SEV_COLORS[inc.severity], background: SEV_BG[inc.severity] }}>
                  {inc.severity.toUpperCase()}
                </span>
                <span className="text-xs text-text-muted font-mono">{inc.id}</span>
                <span className="text-sm">{inc.title}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-medium uppercase px-1.5 py-0.5 rounded" style={{ color: AGENT_COLORS[inc.source] ?? "#94a3b8", border: `1px solid ${(AGENT_COLORS[inc.source] ?? "#94a3b8")}33` }}>
                  {inc.source}
                </span>
                <span className="text-[10px] font-medium px-2 py-0.5 rounded" style={{ color: STATUS_COLORS[inc.status] ?? "#94a3b8", background: (STATUS_COLORS[inc.status] ?? "#94a3b8") + "22" }}>
                  {inc.status}
                </span>
                <span className="text-xs text-text-muted">{timeAgo(inc.created)}</span>
              </div>
            </div>
            <div className="flex gap-4 mt-2 text-xs text-text-muted">
              <span>SLA: {inc.sla}min</span>
              <span className={inc.response > inc.sla ? "text-red-400" : "text-green-400"}>Response: {inc.response}min</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
