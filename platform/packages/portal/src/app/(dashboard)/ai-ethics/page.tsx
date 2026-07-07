"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";

// ─── Status config ─────────────────────────────────────────────────────────────

const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
  pass: { bg: "bg-[var(--accent-subtle)] border border-[var(--border-accent)]", text: "text-[var(--accent)]", label: "Pass" },
  compliant: { bg: "bg-[var(--accent-subtle)] border border-[var(--border-accent)]", text: "text-[var(--accent)]", label: "Compliant" },
  fail: { bg: "bg-[var(--critical-bg)] border border-[var(--critical)]/20", text: "text-[var(--critical-text)]", label: "Fail" },
  non_compliant: { bg: "bg-[var(--critical-bg)] border border-[var(--critical)]/20", text: "text-[var(--critical-text)]", label: "Non-Compliant" },
  partial: { bg: "bg-[var(--medium-bg)] border border-[var(--medium)]/20", text: "text-[var(--medium-text)]", label: "Partial" },
};

const priorityConfig: Record<string, { bg: string; text: string; dot: string }> = {
  high: { bg: "bg-[var(--critical-bg)] border border-[var(--critical)]/20", text: "text-[var(--critical-text)]", dot: "bg-[var(--critical)]" },
  medium: { bg: "bg-[var(--medium-bg)] border border-[var(--medium)]/20", text: "text-[var(--medium-text)]", dot: "bg-[var(--medium)]" },
  low: { bg: "bg-[var(--surface-raised)] border border-[var(--border)]", text: "text-[var(--text-secondary)]", dot: "bg-[var(--text-muted)]" },
};

// ─── Sub-components ────────────────────────────────────────────────────────────

function ScoreRing({ score }: { score: number }) {
  const r = 72;
  const circ = 2 * Math.PI * r;
  const filled = (score / 100) * circ;
  const gap = circ - filled;

  const ringColor =
    score >= 80 ? "var(--success)" : score >= 65 ? "var(--accent)" : "var(--critical)";
  const trackColor = "var(--surface-raised)";

  return (
    <svg width="196" height="196" viewBox="0 0 196 196" aria-hidden="true">
      <defs>
        <linearGradient id="ethicsRingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={ringColor} />
          <stop offset="100%" stopColor={score >= 80 ? "var(--accent)" : ringColor} />
        </linearGradient>
      </defs>
      {/* Track */}
      <circle cx="98" cy="98" r={r} fill="none" stroke={trackColor} strokeWidth="14" />
      {/* Arc */}
      <circle
        cx="98"
        cy="98"
        r={r}
        fill="none"
        stroke="url(#ethicsRingGrad)"
        strokeWidth="14"
        strokeLinecap="round"
        strokeDasharray={`${filled} ${gap}`}
        strokeDashoffset={circ / 4}
      />
      {/* Score text */}
      <text
        x="98"
        y="90"
        textAnchor="middle"
        dominantBaseline="middle"
        fill={ringColor}
        fontSize="34"
        fontWeight="700"
        fontFamily="'JetBrains Mono', monospace"
      >
        {score}
      </text>
      <text
        x="98"
        y="116"
        textAnchor="middle"
        dominantBaseline="middle"
        fill="var(--text-muted)"
        fontSize="11"
        fontFamily="inherit"
        letterSpacing="2"
      >
        / 100
      </text>
    </svg>
  );
}

function MiniBar({ score }: { score: number }) {
  const color =
    score >= 80 ? "bg-[var(--accent)]" : score >= 65 ? "bg-[var(--medium)]" : "bg-[var(--critical)]";
  return (
    <div className="w-full h-1.5 rounded-full bg-[var(--surface-raised)] overflow-hidden">
      <div
        className={`h-full rounded-md ${color} transition-all duration-700`}
        style={{ width: `${score}%` }}
      />
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

// REAL IMPL (BLACKFYRE 2026-06): the DEMO_AI_ETHICS_DATA fixture (model
// inventory, bias scores, explainability/compliance statuses) and the
// DEMO_MODE bypass have been removed. This page is sourced only from the live
// API (api.getAIEthicsDashboard).

export default function AiEthicsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeControl, setActiveControl] = useState<string | null>(null);

  // REAL IMPL (BLACKFYRE 2026-06): always load AI-ethics data from the live API.
  useEffect(() => {
    api.getAIEthicsDashboard()
      .then(res => setData(res.dashboard ?? res))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-2 rounded-full" style={{ borderColor: "var(--border)", borderTopColor: "var(--accent)" }} /></div>;
  if (error) return <div className="p-6" style={{ color: "var(--critical-text)" }}>Failed to load: {error}</div>;

  // ── Derive display data from API response ──────────────────────────────────

  const modelInventory: Array<{ id: string; name: string; purpose: string; riskLevel: string; lastReviewDate: string | null }> =
    data?.modelInventory ?? [];

  const biasAssessments: Array<{ modelId: string; score: number; reviewedAt: string }> =
    data?.biasAssessments ?? [];

  const explainabilityScore: number = data?.explainabilityScore ?? 0;

  const complianceStatus: { euAiAct: string; nistAiRmf: string } =
    data?.complianceStatus ?? { euAiAct: "non_compliant", nistAiRmf: "non_compliant" };

  // Overall score: average of bias scores + explainability, or just explainability if no assessments
  const avgBiasScore =
    biasAssessments.length > 0
      ? Math.round(biasAssessments.reduce((sum, a) => sum + a.score, 0) / biasAssessments.length)
      : 0;
  const overallScore =
    biasAssessments.length > 0
      ? Math.round((avgBiasScore + explainabilityScore) / 2)
      : explainabilityScore;

  // Dimensions derived from API data
  const dimensions = [
    {
      label: "Bias Score",
      score: avgBiasScore,
      delta: 0,
      description: "Model outputs evaluated for demographic and contextual bias",
    },
    {
      label: "Explainability Score",
      score: explainabilityScore,
      delta: 0,
      description: "Explainability and auditability of AI decisions",
    },
    {
      label: "EU AI Act",
      score: complianceStatus.euAiAct === "compliant" ? 100 : complianceStatus.euAiAct === "partial" ? 60 : 20,
      delta: 0,
      description: "Compliance with EU Artificial Intelligence Act requirements",
    },
    {
      label: "NIST AI RMF",
      score: complianceStatus.nistAiRmf === "compliant" ? 100 : complianceStatus.nistAiRmf === "partial" ? 60 : 20,
      delta: 0,
      description: "Alignment with NIST AI Risk Management Framework",
    },
  ];

  // Model inventory as controls table (maps to iso42001Controls shape)
  const modelControls = modelInventory.map((m) => ({
    id: m.id,
    name: m.name,
    category: m.purpose,
    status: m.riskLevel === "low" ? "pass" : m.riskLevel === "medium" ? "partial" : "fail",
  }));

  const passCount = modelControls.filter((c) => c.status === "pass").length;
  const controlsScore = modelControls.length > 0 ? Math.round((passCount / modelControls.length) * 100) : 0;

  // Bias assessments as recent reviews
  const recentReviews = biasAssessments.map((a, idx) => {
    const model = modelInventory.find((m) => m.id === a.modelId);
    const reviewStatus = a.score >= 80 ? "pass" : a.score >= 65 ? "partial" : "fail";
    return {
      id: `ER-${String(idx + 1).padStart(3, "0")}`,
      type: "Bias Assessment",
      model: model?.name ?? a.modelId,
      score: a.score,
      date: a.reviewedAt ? new Date(a.reviewedAt).toISOString().split("T")[0] : "—",
      reviewer: "Auto",
      status: reviewStatus,
    };
  });

  // Compliance status entries as recommendations
  const recommendations: Array<{ priority: string; id: string; title: string; detail: string; effort: string }> = [];
  if (complianceStatus.euAiAct !== "compliant") {
    recommendations.push({
      priority: complianceStatus.euAiAct === "partial" ? "medium" : "high",
      id: "REC-001",
      title: "Improve EU AI Act compliance",
      detail: `Current status: ${complianceStatus.euAiAct.replace("_", " ")}. Review high-risk AI system requirements.`,
      effort: "2–4 weeks",
    });
  }
  if (complianceStatus.nistAiRmf !== "compliant") {
    recommendations.push({
      priority: complianceStatus.nistAiRmf === "partial" ? "medium" : "high",
      id: "REC-002",
      title: "Align with NIST AI RMF",
      detail: `Current status: ${complianceStatus.nistAiRmf.replace("_", " ")}. Complete GOVERN, MAP, MEASURE, and MANAGE functions.`,
      effort: "3–5 weeks",
    });
  }
  modelInventory
    .filter((m) => m.riskLevel === "high")
    .forEach((m, idx) => {
      recommendations.push({
        priority: "high",
        id: `REC-${String(idx + 3).padStart(3, "0")}`,
        title: `Review high-risk model: ${m.name}`,
        detail: `${m.purpose} — classified as high risk. Requires ethics board review and documented risk treatment.`,
        effort: "1–2 weeks",
      });
    });

  return (
    <div className="space-y-6 animate-halo-fade-up">
      {/* Page heading */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="halo-eyebrow mb-2">§ 16 · AI Ethics</p>
          <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>AI Ethics</h2>
          <p className="mt-0.5 text-sm" style={{ color: "var(--text-secondary)" }}>
            AI governance, bias monitoring, and responsible AI compliance
          </p>
        </div>
        <span className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium bg-[var(--accent-subtle)] text-[var(--accent)] border border-[var(--border-accent)]">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] inline-block" />
          Live
        </span>
      </div>

      {/* ── Section 1: Hero + Dimension Cards ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-4">
        {/* Score ring hero */}
        <div className="card rounded-md p-6 flex flex-col items-center justify-center gap-3 text-center">
          <ScoreRing score={overallScore} />
          <div>
            <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Overall Ethics Score</p>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>Live from API</p>
          </div>
          <div className="w-full pt-1" style={{ borderTop: "1px solid var(--border)" }}>
            <p className="text-xs text-[var(--accent)]">{modelInventory.length} models tracked</p>
          </div>
        </div>

        {/* Dimension cards */}
        <div className="grid grid-cols-2 gap-4">
          {dimensions.map((dim) => {
            const deltaPositive = dim.delta >= 0;
            const scoreColor =
              dim.score >= 80 ? "text-[var(--accent)]" : dim.score >= 65 ? "text-[var(--medium-text)]" : "text-[var(--critical-text)]";
            return (
              <div key={dim.label} className="card rounded-md p-5 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{dim.label}</p>
                  {dim.delta !== 0 && (
                    <span
                      className={`text-xs font-mono font-semibold ${
                        deltaPositive ? "text-[var(--accent)]" : "text-[var(--critical-text)]"
                      }`}
                    >
                      {deltaPositive ? "+" : ""}
                      {dim.delta}
                    </span>
                  )}
                </div>
                <div className="flex items-end gap-2">
                  <span className={`text-3xl font-bold font-mono leading-none ${scoreColor}`}>
                    {dim.score}
                  </span>
                  <span className="text-xs mb-0.5" style={{ color: "var(--text-muted)" }}>/ 100</span>
                </div>
                <MiniBar score={dim.score} />
                <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>{dim.description}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Section 2: Model Inventory ── */}
      {modelControls.length > 0 && (
        <div className="card rounded-md overflow-hidden">
          <div className="px-5 py-4 flex items-center justify-between gap-4" style={{ borderBottom: "1px solid var(--border)" }}>
            <div>
              <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>AI Model Inventory</p>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
                {passCount} of {modelControls.length} models low-risk &mdash; {controlsScore}% healthy
              </p>
            </div>
            <span className="text-xs font-mono text-[var(--accent)] bg-[var(--accent-subtle)] px-2.5 py-1 rounded-lg border border-[var(--border-accent)]">
              {controlsScore}%
            </span>
          </div>

          <table className="w-full text-sm" role="table">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)", background: "var(--surface-raised)" }}>
                <th scope="col" className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider w-36" style={{ color: "var(--text-muted)" }}>Model ID</th>
                <th scope="col" className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Name</th>
                <th scope="col" className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Purpose</th>
                <th scope="col" className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider w-28" style={{ color: "var(--text-muted)" }}>Risk Level</th>
              </tr>
            </thead>
            <tbody>
              {modelControls.map((c, idx) => {
                const stat = statusConfig[c.status] ?? statusConfig.pass;
                const rowActive = activeControl === c.id;
                return (
                  <tr
                    key={c.id}
                    onClick={() => setActiveControl(rowActive ? null : c.id)}
                    className={`transition-colors cursor-pointer ${rowActive ? "bg-[var(--accent-subtle)]" : "hover:bg-[var(--hover-bg)]"}`}
                    style={{
                      borderBottom: "1px solid var(--border-subtle)",
                      background: rowActive ? undefined : idx % 2 === 1 ? "var(--surface-raised)" : "var(--surface)",
                    }}
                  >
                    <td className="px-5 py-3 font-mono text-xs" style={{ color: "var(--text-secondary)" }}>{c.id}</td>
                    <td className="px-5 py-3 font-medium" style={{ color: "var(--text-primary)" }}>{c.name}</td>
                    <td className="px-5 py-3" style={{ color: "var(--text-secondary)" }}>{c.category}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-block px-2.5 py-0.5 rounded-md text-xs font-medium ${stat.bg} ${stat.text}`}>
                        {stat.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Section 3: Compliance Status ── */}
      <div className="card rounded-md p-5">
        <p className="text-sm font-semibold mb-4" style={{ color: "var(--text-primary)" }}>Regulatory Compliance Status</p>
        <div className="grid grid-cols-2 gap-4">
          {[
            { label: "EU AI Act", status: complianceStatus.euAiAct },
            { label: "NIST AI RMF", status: complianceStatus.nistAiRmf },
          ].map(({ label, status }) => {
            const stat = statusConfig[status] ?? statusConfig.partial;
            return (
              <div key={label} className="flex items-center justify-between gap-4 px-4 py-3 rounded-md" style={{ background: "var(--surface-raised)", border: "1px solid var(--border)" }}>
                <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{label}</span>
                <span className={`inline-block px-2.5 py-0.5 rounded-md text-xs font-medium ${stat.bg} ${stat.text}`}>
                  {stat.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Section 4: Recent Bias Assessments ── */}
      {recentReviews.length > 0 && (
        <div className="card rounded-md overflow-hidden">
          <div className="px-5 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
            <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Recent Bias Assessments</p>
          </div>
          <table className="w-full text-sm" role="table">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)", background: "var(--surface-raised)" }}>
                <th scope="col" className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider w-32" style={{ color: "var(--text-muted)" }}>Review ID</th>
                <th scope="col" className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider w-36" style={{ color: "var(--text-muted)" }}>Type</th>
                <th scope="col" className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Model</th>
                <th scope="col" className="text-right px-5 py-3 text-xs font-semibold uppercase tracking-wider w-24" style={{ color: "var(--text-muted)" }}>Score</th>
                <th scope="col" className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider w-28" style={{ color: "var(--text-muted)" }}>Reviewer</th>
                <th scope="col" className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider w-28" style={{ color: "var(--text-muted)" }}>Date</th>
                <th scope="col" className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider w-24" style={{ color: "var(--text-muted)" }}>Result</th>
              </tr>
            </thead>
            <tbody>
              {recentReviews.map((r, idx) => {
                const stat = statusConfig[r.status] ?? statusConfig.pass;
                const scoreColor =
                  r.score >= 80 ? "text-[var(--accent)]" : r.score >= 65 ? "text-[var(--medium-text)]" : "text-[var(--critical-text)]";
                return (
                  <tr
                    key={r.id}
                    className="hover:bg-[var(--hover-bg)] transition-colors"
                    style={{
                      borderBottom: "1px solid var(--border-subtle)",
                      background: idx % 2 === 1 ? "var(--surface-raised)" : "var(--surface)",
                    }}
                  >
                    <td className="px-5 py-3 font-mono text-xs" style={{ color: "var(--text-muted)" }}>{r.id}</td>
                    <td className="px-5 py-3 text-sm" style={{ color: "var(--text-secondary)" }}>{r.type}</td>
                    <td className="px-5 py-3 font-medium" style={{ color: "var(--text-primary)" }}>{r.model}</td>
                    <td className={`px-5 py-3 text-right font-mono font-semibold ${scoreColor}`}>{r.score}</td>
                    <td className="px-5 py-3 text-xs" style={{ color: "var(--text-secondary)" }}>{r.reviewer}</td>
                    <td className="px-5 py-3 font-mono text-xs" style={{ color: "var(--text-secondary)" }}>{r.date}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-block px-2.5 py-0.5 rounded-md text-xs font-medium ${stat.bg} ${stat.text}`}>
                        {stat.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Section 5: Recommendations ── */}
      {recommendations.length > 0 && (
        <div className="card rounded-md overflow-hidden">
          <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border)" }}>
            <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Recommendations</p>
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>{recommendations.length} action items</span>
          </div>
          <ul className="divide-y" style={{ "--tw-divide-opacity": 1 } as React.CSSProperties} role="list">
            {recommendations.map((rec) => {
              const pConf = priorityConfig[rec.priority] ?? priorityConfig.low;
              return (
                <li key={rec.id} className="px-5 py-4 hover:bg-[var(--hover-bg)] transition-colors" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                  <div className="flex items-start gap-3">
                    <span
                      className={`mt-1 shrink-0 w-2 h-2 rounded-full ${pConf.dot}`}
                      aria-label={`${rec.priority} priority`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs" style={{ color: "var(--text-muted)" }}>{rec.id}</span>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider ${pConf.bg} ${pConf.text}`}
                        >
                          {rec.priority}
                        </span>
                      </div>
                      <p className="mt-1 text-sm font-medium" style={{ color: "var(--text-primary)" }}>{rec.title}</p>
                      <p className="mt-0.5 text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>{rec.detail}</p>
                      <p className="mt-1.5 text-xs" style={{ color: "var(--text-muted)" }}>
                        Effort:&nbsp;<span className="text-[var(--accent)]">{rec.effort}</span>
                      </p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Empty state */}
      {modelInventory.length === 0 && biasAssessments.length === 0 && (
        <div className="card rounded-md p-10 text-center">
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>No AI ethics data available yet. Data will appear here once models are registered.</p>
        </div>
      )}
    </div>
  );
}
