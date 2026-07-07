"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

type Impact = "critical" | "high" | "medium" | "low";
type RegChange = { id: string; framework: string; type: string; title: string; summary: string; impact: Impact; date: string; controls: string[] };

const IMPACT_COLORS: Record<Impact, string> = { critical: "#ef4444", high: "#f97316", medium: "#fbbf24", low: "#4ade80" };
const IMPACT_BG: Record<Impact, string>     = { critical: "#7f1d1d", high: "#7c2d12", medium: "#422006", low: "#14532d" };
const TYPE_LABELS: Record<string, string> = { new_version: "New Version", amendment: "Amendment", guidance: "Guidance", enforcement: "Enforcement" };

export default function RegulatoryPage() {
  const [changes, setChanges] = useState<RegChange[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getRegulatoryChanges()
      .then((res) => setChanges((res.changes ?? []) as RegChange[]))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load regulatory changes"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-6 text-text-muted text-sm">Loading regulatory changes…</div>;
  if (error) return <div className="p-6 text-red-400 text-sm">Error: {error}</div>;

  return (
    <div className="animate-halo-fade-up">
      <p className="halo-eyebrow">§ 20 · Regulatory</p>
      <h1 className="mt-2 mb-6 text-xl font-semibold text-text-primary">Regulatory Changes</h1>

      <div className="space-y-4">
        {changes.map((c) => (
          <div key={c.id} className="rounded-xl border border-border bg-surface p-5">
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ color: IMPACT_COLORS[c.impact], background: IMPACT_BG[c.impact] }}>
                  {c.impact.toUpperCase()}
                </span>
                <span className="text-[10px] text-text-muted border border-border px-1.5 py-0.5 rounded">{TYPE_LABELS[c.type] ?? c.type}</span>
                <span className="text-[10px] text-indigo-400">{c.framework}</span>
              </div>
              <span className="text-xs text-text-muted">{c.date}</span>
            </div>
            <div className="text-sm font-medium mb-1">{c.title}</div>
            <div className="text-xs text-text-muted mb-3">{c.summary}</div>
            <div className="flex items-center justify-between">
              <div className="flex gap-1.5 flex-wrap">
                {c.controls.map((ctrl) => (
                  <span key={ctrl} className="text-[10px] text-text-muted border border-border px-1.5 py-0.5 rounded">{ctrl}</span>
                ))}
              </div>
              <button className="text-xs text-indigo-400 border border-indigo-700/50 px-3 py-1.5 rounded-lg hover:bg-indigo-950/30 transition-colors shrink-0">
                Assess Impact
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
