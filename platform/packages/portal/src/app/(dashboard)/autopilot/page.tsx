"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

type Framework = { name: string; enabled: boolean; scanFreq: string; autoFix: string; nextScan: string; cost: string };
type AgentActivity = { agent: string; color: string; action: string; time: string };
type Effectiveness = { manualHoursSaved?: number; autoFixesApplied?: number; evidenceCollected?: number; complianceScoreMaintained?: string; driftEventsHandled?: number };
type Cost = { monthlyBudget?: number; usedMtd?: number; usedPct?: number; perAgent?: Record<string, number> };

export default function AutopilotPage() {
  const [frameworks, setFrameworks] = useState<Framework[]>([]);
  const [activity, setActivity] = useState<AgentActivity[]>([]);
  const [effectiveness, setEffectiveness] = useState<Effectiveness>({});
  const [cost, setCost] = useState<Cost>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getAutopilot()
      .then((res) => {
        const a = res.autopilot ?? {};
        setFrameworks((a.frameworks ?? []) as Framework[]);
        setActivity((a.agentActivity ?? []) as AgentActivity[]);
        setEffectiveness((a.effectiveness ?? {}) as Effectiveness);
        setCost((a.cost ?? {}) as Cost);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load autopilot"))
      .finally(() => setLoading(false));
  }, []);

  const activeCount = frameworks.filter((f) => f.enabled).length;

  if (loading) return <div className="p-6 text-text-muted text-sm">Loading autopilot…</div>;
  if (error) return <div className="p-6 text-red-400 text-sm">Error: {error}</div>;

  return (
    <div className="animate-halo-fade-up">
      <p className="halo-eyebrow">§ 04 · Autopilot</p>
      <div className="flex items-center justify-between mb-6 mt-2">
        <h1 className="text-xl font-semibold text-text-primary">Compliance Autopilot</h1>
        <span className="text-xs font-medium px-3 py-1 rounded-full bg-green-900/30 text-green-400 border border-green-700/30">
          {activeCount} framework{activeCount !== 1 ? "s" : ""} active
        </span>
      </div>

      {/* Framework Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {frameworks.map((fw) => (
          <div key={fw.name} className={`rounded-xl border p-4 ${fw.enabled ? "border-indigo-700/50 bg-indigo-950/20" : "border-border bg-surface opacity-60"}`}>
            <div className="flex items-center justify-between mb-3">
              <span className="font-semibold text-sm">{fw.name}</span>
              <button
                onClick={() => setFrameworks((prev) => prev.map((f) => f.name === fw.name ? { ...f, enabled: !f.enabled } : f))}
                className={`w-9 h-5 rounded-full relative transition-colors ${fw.enabled ? "bg-indigo-600" : "bg-slate-600"}`}
              >
                <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all ${fw.enabled ? "right-0.5" : "left-0.5"}`} />
              </button>
            </div>
            {fw.enabled ? (
              <div className="text-xs text-text-muted space-y-1">
                <div>Scans: {fw.scanFreq}</div>
                <div>Auto-fix: {fw.autoFix}</div>
                <div>Next scan: {fw.nextScan}</div>
                <div>Cost: {fw.cost}</div>
              </div>
            ) : (
              <div className="text-xs text-text-muted">Not configured</div>
            )}
          </div>
        ))}
      </div>

      {/* Agent Activity Feed */}
      <div className="rounded-xl border border-border bg-surface p-4 mb-6">
        <h2 className="text-sm font-semibold mb-3">Recent Agent Activity</h2>
        <div className="space-y-2">
          {activity.map((a, i) => (
            <div key={i} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: a.color }} />
                <span className="text-text-secondary">
                  <span className="font-medium" style={{ color: a.color }}>{a.agent}</span> — {a.action}
                </span>
              </div>
              <span className="text-xs text-text-muted shrink-0 ml-4">{a.time}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Effectiveness + Cost */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-border bg-surface p-4">
          <h2 className="text-sm font-semibold mb-3">Effectiveness This Month</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-text-muted">Manual hours saved</span><span className="text-green-400 font-medium">{effectiveness.manualHoursSaved ?? 0} hrs</span></div>
            <div className="flex justify-between"><span className="text-text-muted">Auto-fixes applied</span><span className="text-green-400 font-medium">{effectiveness.autoFixesApplied ?? 0}</span></div>
            <div className="flex justify-between"><span className="text-text-muted">Evidence auto-collected</span><span className="text-green-400 font-medium">{effectiveness.evidenceCollected ?? 0}</span></div>
            <div className="flex justify-between"><span className="text-text-muted">Compliance score maintained</span><span className="text-green-400 font-medium">{effectiveness.complianceScoreMaintained ?? "—"}</span></div>
            <div className="flex justify-between"><span className="text-text-muted">Drift events handled</span><span className="text-green-400 font-medium">{effectiveness.driftEventsHandled ?? 0}</span></div>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <h2 className="text-sm font-semibold mb-3">AI Cost Tracking</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-text-muted">Monthly Budget</span><span>${(cost.monthlyBudget ?? 0).toFixed(2)}</span></div>
            <div className="flex justify-between"><span className="text-text-muted">Used (MTD)</span><span className="text-green-400">${(cost.usedMtd ?? 0).toFixed(2)} ({cost.usedPct ?? 0}%)</span></div>
            <div className="mt-3">
              <div className="w-full h-2 bg-border rounded-full overflow-hidden">
                <div className="h-full bg-green-500 rounded-full" style={{ width: `${cost.usedPct ?? 0}%` }} />
              </div>
            </div>
            <div className="flex justify-between text-xs text-text-muted mt-2 flex-wrap gap-2">
              {Object.entries(cost.perAgent ?? {}).map(([agent, amt]) => (
                <span key={agent}>{agent}: ${(amt as number).toFixed(2)}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
