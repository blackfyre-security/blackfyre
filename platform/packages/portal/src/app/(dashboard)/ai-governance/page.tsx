"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

type ClauseStatus = "pass" | "partial" | "fail";
type Risk = "high" | "medium" | "low";
type Clause = { id: string; title: string; status: ClauseStatus; score: number };
type AISystem = { name: string; model: string; risk: Risk; status: string; lastReview: string };
type EthicsDim = { name: string; score: number; trend: "up" | "down" | "stable" };
type Decision = { type: string; confidence: number; model: string; tokens: number; time: string };

const STATUS_COLORS: Record<ClauseStatus, string> = { pass: "#4ade80", partial: "#fbbf24", fail: "#f87171" };
const RISK_COLORS: Record<Risk, string> = { high: "#f87171", medium: "#fbbf24", low: "#4ade80" };

export default function AIGovernancePage() {
  const [tab, setTab] = useState<"overview" | "systems" | "decisions">("overview");
  const [clauses, setClauses] = useState<Clause[]>([]);
  const [systems, setSystems] = useState<AISystem[]>([]);
  const [ethics, setEthics] = useState<EthicsDim[]>([]);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getAiGovernance()
      .then((res) => {
        setClauses((res.iso42001Clauses ?? []) as Clause[]);
        setSystems((res.systems ?? []) as AISystem[]);
        setEthics((res.ethicsDimensions ?? []) as EthicsDim[]);
        setDecisions((res.decisions ?? []) as Decision[]);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load AI governance"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-6 text-text-muted text-sm">Loading AI governance…</div>;
  if (error) return <div className="p-6 text-red-400 text-sm">Error: {error}</div>;

  const overallScore = clauses.length ? Math.round(clauses.reduce((s, c) => s + c.score, 0) / clauses.length) : 0;

  return (
    <div className="animate-halo-fade-up">
      <p className="halo-eyebrow">§ 17 · AI Governance</p>
      <h1 className="mt-2 mb-6 text-xl font-semibold text-text-primary">AI Governance (ISO 42001)</h1>

      <div className="flex gap-2 mb-6">
        {(["overview", "systems", "decisions"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${tab === t ? "border-indigo-600 bg-indigo-950/30 text-indigo-300" : "border-border text-text-muted"}`}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="rounded-xl border border-border bg-surface p-5 flex flex-col items-center justify-center">
              <div className="text-xs text-text-muted mb-2">Overall ISO 42001 Score</div>
              <div className="text-4xl font-bold" style={{ color: overallScore >= 70 ? "#4ade80" : overallScore >= 50 ? "#fbbf24" : "#f87171" }}>{overallScore}%</div>
              <div className="text-xs text-text-muted mt-1">{clauses.length} clauses assessed</div>
            </div>
            <div className="col-span-2 rounded-xl border border-border bg-surface p-4">
              <h3 className="text-sm font-semibold mb-3">Ethics Dimensions</h3>
              <div className="grid grid-cols-2 gap-3">
                {ethics.map((d) => (
                  <div key={d.name} className="flex items-center justify-between text-sm">
                    <span className="text-text-muted">{d.name}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-border rounded-full overflow-hidden">
                        <div className="h-full rounded-full halo-progress-fill" style={{ width: `${d.score}%`, background: d.score >= 80 ? "#4ade80" : d.score >= 60 ? "#fbbf24" : "#f87171" }} />
                      </div>
                      <span className="text-xs font-medium w-8" style={{ color: d.score >= 80 ? "#4ade80" : d.score >= 60 ? "#fbbf24" : "#f87171" }}>{d.score}%</span>
                      <span className="text-[10px]">{d.trend === "up" ? "↑" : d.trend === "down" ? "↓" : "→"}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-surface p-4">
            <h3 className="text-sm font-semibold mb-3">ISO 42001 Clause-by-Clause Status</h3>
            <div className="space-y-2">
              {clauses.map((c) => (
                <div key={c.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono text-text-muted w-8">C.{c.id}</span>
                    <span className="text-sm">{c.title}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-20 h-1.5 bg-border rounded-full overflow-hidden">
                      <div className="h-full rounded-full halo-progress-fill" style={{ width: `${c.score}%`, background: STATUS_COLORS[c.status] }} />
                    </div>
                    <span className="text-xs font-medium w-8" style={{ color: STATUS_COLORS[c.status] }}>{c.score}%</span>
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded" style={{ color: STATUS_COLORS[c.status], background: STATUS_COLORS[c.status] + "22" }}>
                      {c.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {tab === "systems" && (
        <div className="rounded-xl border border-border bg-surface p-4">
          <h3 className="text-sm font-semibold mb-3">AI System Register</h3>
          <div className="space-y-2">
            {systems.map((sys) => (
              <div key={sys.name} className="flex items-center justify-between py-3 border-b border-border last:border-0">
                <div>
                  <div className="text-sm font-medium">{sys.name}</div>
                  <div className="text-xs text-text-muted">{sys.model}</div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded" style={{ color: RISK_COLORS[sys.risk], background: RISK_COLORS[sys.risk] + "22" }}>
                    {sys.risk} risk
                  </span>
                  <span className="text-xs text-text-muted">Reviewed: {sys.lastReview}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "decisions" && (
        <div className="rounded-xl border border-border bg-surface p-4">
          <h3 className="text-sm font-semibold mb-3">AI Decision Audit Trail</h3>
          <div className="text-sm text-text-secondary space-y-3">
            {decisions.map((d, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <div className="flex items-center gap-3">
                  <span className="text-sm">{d.type}</span>
                  <span className="text-[10px] text-text-muted">{d.model}</span>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span style={{ color: d.confidence >= 0.9 ? "#4ade80" : d.confidence >= 0.8 ? "#fbbf24" : "#f87171" }}>
                    {(d.confidence * 100).toFixed(0)}% confidence
                  </span>
                  <span className="text-text-muted">{d.tokens.toLocaleString()} tokens</span>
                  <span className="text-text-muted">{d.time}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
