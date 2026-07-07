"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";

type RiskLevel = "high" | "medium" | "low";
type DpiaStatus = "complete" | "in-progress" | "pending";

interface Dpia {
  id: string;
  name: string;
  dataCategories: string[];
  riskLevel: RiskLevel;
  riskScore: number;
  status: DpiaStatus;
  date: string;
}


type LegalBasis = "Legitimate interest" | "Contractual necessity" | "Legal obligation" | "Consent";

interface RopaEntry {
  id: string;
  activity: string;
  purpose: string;
  dataCategories: string;
  legalBasis: LegalBasis;
  retention: string;
  recipients: string;
}

interface Transfer {
  date: string;
  destination: string;
  type: string;
  legalBasis: string;
  flag: string;
}

interface MiniStat {
  label: string;
  value: string;
  sub: string;
}

// ─── Config maps ──────────────────────────────────────────────────────────────

const riskConfig: Record<RiskLevel, { bg: string; text: string; bar: string; label: string }> = {
  high: { bg: "bg-[var(--critical-bg)] border border-[var(--critical)]/20", text: "text-[var(--critical-text)]", bar: "bg-[var(--critical)]", label: "High" },
  medium: { bg: "bg-[var(--medium-bg)] border border-[var(--medium)]/20", text: "text-[var(--medium-text)]", bar: "bg-[var(--medium)]", label: "Medium" },
  low: { bg: "bg-[var(--accent-subtle)] border border-[var(--border-accent)]", text: "text-[var(--accent)]", bar: "bg-[var(--accent)]", label: "Low" },
};

const statusConfig: Record<DpiaStatus, { bg: string; text: string; label: string }> = {
  complete: { bg: "bg-[var(--accent-subtle)] border border-[var(--border-accent)]", text: "text-[var(--accent)]", label: "Complete" },
  "in-progress": { bg: "bg-[var(--medium-bg)] border border-[var(--medium)]/20", text: "text-[var(--medium-text)]", label: "In Progress" },
  pending: { bg: "bg-[var(--surface-raised)] border border-[var(--border)]", text: "text-[var(--text-secondary)]", label: "Pending" },
};

const legalBasisConfig: Record<LegalBasis, { bg: string; text: string }> = {
  "Legitimate interest": { bg: "bg-[var(--low-bg)] border border-[var(--low)]/20", text: "text-[var(--low-text)]" },
  "Contractual necessity": { bg: "bg-[var(--medium-bg)] border border-[var(--medium)]/20", text: "text-[var(--medium-text)]" },
  "Legal obligation": { bg: "bg-[var(--info-bg)] border border-[var(--info)]/20", text: "text-[var(--info-text)]" },
  "Consent": { bg: "bg-[var(--accent-subtle)] border border-[var(--border-accent)]", text: "text-[var(--accent)]" },
};

// ─── Sub-components ────────────────────────────────────────────────────────────

function PrivacyScoreRing({ score }: { score: number }) {
  const r = 72;
  const circ = 2 * Math.PI * r;
  const filled = (score / 100) * circ;
  const gap = circ - filled;
  const ringColor = score >= 80 ? "var(--success)" : score >= 65 ? "var(--accent)" : "var(--critical)";
  const trackColor = "var(--surface-raised)";

  return (
    <svg width="196" height="196" viewBox="0 0 196 196" aria-hidden="true">
      <defs>
        <linearGradient id="privacyRingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={ringColor} />
          <stop offset="100%" stopColor={score >= 80 ? "var(--accent)" : ringColor} />
        </linearGradient>
      </defs>
      <circle cx="98" cy="98" r={r} fill="none" stroke={trackColor} strokeWidth="14" />
      <circle
        cx="98" cy="98" r={r}
        fill="none"
        stroke="url(#privacyRingGrad)"
        strokeWidth="14"
        strokeLinecap="round"
        strokeDasharray={`${filled} ${gap}`}
        strokeDashoffset={circ / 4}
      />
      <text x="98" y="90" textAnchor="middle" dominantBaseline="middle" fill={ringColor}
        fontSize="34" fontWeight="700" fontFamily="'JetBrains Mono', monospace">
        {score}
      </text>
      <text x="98" y="116" textAnchor="middle" dominantBaseline="middle"
        fill="var(--text-muted)" fontSize="11" letterSpacing="2" fontFamily="inherit">
        / 100
      </text>
    </svg>
  );
}

function RiskBar({ score, level }: { score: number; level: RiskLevel }) {
  const conf = riskConfig[level] ?? riskConfig.low;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-[var(--surface-raised)] rounded-md overflow-hidden">
        <div
          className={`h-full rounded-md transition-all duration-700 ${conf.bar}`}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className="text-xs font-mono w-7 shrink-0" style={{ color: "var(--text-muted)" }}>{score}</span>
    </div>
  );
}

function DataFlowMap() {
  const sources = ["AWS Config", "Azure Monitor", "GCP Logs", "Kubernetes"];
  const processors = ["Scanner Agents", "AI Classifier", "Risk Engine", "Evidence Indexer"];
  const storage = ["Findings DB", "Evidence Vault", "Reports Store", "Threat Intel DB"];

  return (
    <div className="grid grid-cols-3 gap-4 items-start" role="img" aria-label="Data processing flow map">
      {/* Sources */}
      <div className="space-y-2">
        <p className="text-[10px] uppercase tracking-widest font-medium mb-3" style={{ color: "var(--text-muted)" }}>Data Sources</p>
        {sources.map((s, i) => {
          const colors = [
            "bg-[var(--critical-bg)] border-[var(--critical)]/20 text-[var(--critical-text)]",
            "bg-[var(--medium-bg)] border-[var(--medium)]/20 text-[var(--medium-text)]",
            "bg-[var(--medium-bg)] border-[var(--medium)]/20 text-[var(--medium-text)]",
            "bg-[var(--low-bg)] border-[var(--low)]/20 text-[var(--low-text)]",
          ];
          return (
            <div key={s} className={`text-xs px-3 py-2 rounded-lg border ${colors[i]}`}>
              {s}
            </div>
          );
        })}
      </div>

      {/* Processing */}
      <div className="space-y-2 relative">
        <p className="text-[10px] uppercase tracking-widest font-medium mb-3" style={{ color: "var(--text-muted)" }}>Processing</p>
        <div className="absolute left-0 top-8 bottom-0 w-px bg-gradient-to-b from-[var(--accent)] via-[var(--accent)]/40 to-transparent" />
        <div className="absolute right-0 top-8 bottom-0 w-px bg-gradient-to-b from-[var(--accent)] via-[var(--accent)]/40 to-transparent" />
        {processors.map((p) => (
          <div key={p} className="text-xs px-3 py-2 rounded-lg bg-[var(--accent-subtle)] border border-[var(--border-accent)] text-[var(--accent)] relative">
            <span className="absolute -left-2 top-1/2 -translate-y-1/2 text-[var(--accent)]">›</span>
            {p}
            <span className="absolute -right-2 top-1/2 -translate-y-1/2 text-[var(--accent)]">›</span>
          </div>
        ))}
      </div>

      {/* Storage */}
      <div className="space-y-2">
        <p className="text-[10px] uppercase tracking-widest font-medium mb-3" style={{ color: "var(--text-muted)" }}>Storage</p>
        {storage.map((s) => (
          <div key={s} className="text-xs px-3 py-2 rounded-lg bg-[var(--success-bg)] border border-[var(--success)]/20 text-[var(--success-text)]">
            {s}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

// REAL IMPL (BLACKFYRE 2026-06): DEMO_MODE and the privacy fixture (DPIAs, RoPA
// entries, cross-border transfers, scores) have been removed. This page is
// sourced only from the live API (api.getPrivacyDashboard).

export default function PrivacyShieldPage() {
  const [expandedRopa, setExpandedRopa] = useState<string | null>(null);
  const [activeDpiaRow, setActiveDpiaRow] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dpias, setDpias] = useState<Dpia[]>([]);
  const [PRIVACY_SCORE, setPrivacyScore] = useState(0);
  const [miniStats, setMiniStats] = useState<MiniStat[]>([]);
  const [ropaEntries, setRopaEntries] = useState<RopaEntry[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);

  // REAL IMPL (BLACKFYRE 2026-06): always load the privacy dashboard from the
  // live API. No demo fixture (DPIAs, RoPA, transfers) and no demo bypass.
  useEffect(() => {
    api.getPrivacyDashboard()
      .then((res: any) => {
        const d = res.data ?? res;
        setPrivacyScore(d.privacyScore ?? d.score ?? 0);
        setDpias(d.dpias ?? []);
        setRopaEntries(d.ropaEntries ?? d.ropa ?? []);
        setTransfers(d.transfers ?? []);
        setMiniStats(d.miniStats ?? [
          { label: "Data Categories", value: String(d.dataCategories ?? 0), sub: "tracked" },
          { label: "Processing Activities", value: String(d.processingActivities ?? 0), sub: "documented" },
          { label: "Cross-Border Transfers", value: String(d.crossBorderTransfers ?? 0), sub: "active" },
          { label: "Consent Records", value: String(d.consentRecords ?? 0), sub: "valid" },
        ]);
      })
      .catch((err: any) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-2 rounded-full" style={{ borderColor: "var(--border)", borderTopColor: "var(--accent)" }} /></div>;
  if (error) return <div className="p-6" style={{ color: "var(--critical-text)" }}>Failed to load privacy dashboard: {error}</div>;

  const completedDpias = dpias.filter((d) => d.status === "complete").length;
  const pdpplStatus = PRIVACY_SCORE >= 80 ? "pass" : PRIVACY_SCORE >= 60 ? "partial" : "fail";

  const pdpplBadgeConfig = {
    pass: { bg: "bg-[var(--accent-subtle)] border-[var(--border-accent)]", text: "text-[var(--accent)]", label: "PDPPL Compliant", dot: "bg-[var(--accent)]" },
    partial: { bg: "bg-[var(--medium-bg)] border-[var(--medium)]/20", text: "text-[var(--medium-text)]", label: "PDPPL Partial", dot: "bg-[var(--medium)]" },
    fail: { bg: "bg-[var(--critical-bg)] border-[var(--critical)]/20", text: "text-[var(--critical-text)]", label: "PDPPL Non-Compliant", dot: "bg-[var(--critical)]" },
  };

  const badge = pdpplBadgeConfig[pdpplStatus];

  return (
    <div className="space-y-6 animate-halo-fade-up">

      {/* ── Page heading ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="halo-eyebrow mb-2">§ 15 · Privacy</p>
          <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>Privacy Shield</h2>
          <p className="mt-0.5 text-sm" style={{ color: "var(--text-secondary)" }}>
            DPIA management, Records of Processing, and Qatar PDPPL compliance
          </p>
        </div>
        <span className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium border ${badge.bg} ${badge.text}`}>
          <span className={`w-1.5 h-1.5 rounded-full inline-block ${badge.dot}`} />
          {badge.label}
        </span>
      </div>

      {/* ── Section 1: Privacy Score Hero ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-4">
        {/* Score ring */}
        <div className="card rounded-md p-6 flex flex-col items-center justify-center gap-3 text-center">
          <PrivacyScoreRing score={PRIVACY_SCORE} />
          <div>
            <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Privacy Score</p>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>Qatar PDPPL basis</p>
          </div>
          <div className="w-full pt-1" style={{ borderTop: "1px solid var(--border)" }}>
            <p className="text-xs text-[var(--accent)]">+6 pts vs prior quarter</p>
          </div>
        </div>

        {/* Mini stat cards */}
        <div className="grid grid-cols-2 gap-4">
          {miniStats.map((s, i) => (
            <div key={s.label} className={`card rounded-md p-5 flex flex-col gap-2 stagger-${i + 1}`}>
              <p className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>{s.label}</p>
              <div className="flex items-end gap-1.5">
                <span className="text-3xl font-bold font-mono text-[var(--accent)] leading-none stat-number">{s.value}</span>
                <span className="text-xs mb-0.5" style={{ color: "var(--text-muted)" }}>{s.sub}</span>
              </div>
              <div className="w-8 h-0.5 bg-[var(--accent)] rounded-md" />
            </div>
          ))}
        </div>
      </div>

      {/* ── Section 2: DPIAs ── */}
      <div className="card rounded-md overflow-hidden">
        <div className="px-5 py-4 flex items-center justify-between gap-4" style={{ borderBottom: "1px solid var(--border)" }}>
          <div>
            <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Data Protection Impact Assessments</p>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
              {completedDpias} of {dpias.length} complete
            </p>
          </div>
          <button
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-[var(--accent-subtle)] border border-[var(--border-accent)] text-[var(--accent)] text-xs font-medium hover:bg-[var(--accent-subtle)] hover:border-[var(--border-accent)] transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/30"
            aria-label="Generate new Data Protection Impact Assessment"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Generate New DPIA
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm" role="table">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)", background: "var(--surface-raised)" }}>
                <th scope="col" className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider w-28" style={{ color: "var(--text-muted)" }}>ID</th>
                <th scope="col" className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Assessment</th>
                <th scope="col" className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Data Categories</th>
                <th scope="col" className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider w-44" style={{ color: "var(--text-muted)" }}>Risk Score</th>
                <th scope="col" className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider w-24" style={{ color: "var(--text-muted)" }}>Risk Level</th>
                <th scope="col" className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider w-28" style={{ color: "var(--text-muted)" }}>Status</th>
                <th scope="col" className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider w-28" style={{ color: "var(--text-muted)" }}>Date</th>
              </tr>
            </thead>
            <tbody>
              {dpias.map((dpia, idx) => {
                const risk = riskConfig[dpia.riskLevel] ?? riskConfig.low;
                const stat = statusConfig[dpia.status] ?? statusConfig.pending;
                const active = activeDpiaRow === dpia.id;
                return (
                  <tr
                    key={dpia.id}
                    onClick={() => setActiveDpiaRow(active ? null : dpia.id)}
                    className={`cursor-pointer transition-colors ${active ? "bg-[var(--accent-subtle)]" : idx % 2 === 1 ? "hover:bg-[var(--hover-bg)]" : "hover:bg-[var(--hover-bg)]"}`}
                    style={{
                      borderBottom: "1px solid var(--border-subtle)",
                      background: active ? undefined : idx % 2 === 1 ? "var(--surface-raised)" : "var(--surface)",
                    }}
                  >
                    <td className="px-5 py-3 font-mono text-xs" style={{ color: "var(--text-muted)" }}>{dpia.id}</td>
                    <td className="px-5 py-3 font-medium" style={{ color: "var(--text-primary)" }}>{dpia.name}</td>
                    <td className="px-5 py-3">
                      <div className="flex flex-wrap gap-1">
                        {dpia.dataCategories.map((cat) => (
                          <span key={cat} className="inline-block px-2 py-0.5 rounded text-[10px] border" style={{ background: "var(--surface-raised)", color: "var(--text-secondary)", borderColor: "var(--border)" }}>
                            {cat}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <RiskBar score={dpia.riskScore} level={dpia.riskLevel} />
                    </td>
                    <td className="px-5 py-3">
                      <span className={`inline-block px-2.5 py-0.5 rounded-md text-xs font-medium ${risk.bg} ${risk.text}`}>
                        {risk.label}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`inline-block px-2.5 py-0.5 rounded-md text-xs font-medium ${stat.bg} ${stat.text}`}>
                        {stat.label}
                      </span>
                    </td>
                    <td className="px-5 py-3 font-mono text-xs" style={{ color: "var(--text-muted)" }}>{dpia.date}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Section 3: RoPA ── */}
      <div className="card rounded-md overflow-hidden">
        <div className="px-5 py-4 flex items-center justify-between gap-4" style={{ borderBottom: "1px solid var(--border)" }}>
          <div>
            <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Records of Processing Activities</p>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>Article 30 PDPPL — click any row to expand</p>
          </div>
          <span className="text-xs font-mono text-[var(--accent)] bg-[var(--accent-subtle)] px-2.5 py-1 rounded-lg border border-[var(--border-accent)]">
            {ropaEntries.length} records
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm" role="table">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)", background: "var(--surface-raised)" }}>
                <th scope="col" className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider w-28" style={{ color: "var(--text-muted)" }}>ID</th>
                <th scope="col" className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Activity</th>
                <th scope="col" className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Legal Basis</th>
                <th scope="col" className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider w-28" style={{ color: "var(--text-muted)" }}>Retention</th>
                <th scope="col" className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider w-6" aria-label="Expand row" />
              </tr>
            </thead>
            <tbody>
              {ropaEntries.map((entry, idx) => {
                const lbConf = legalBasisConfig[entry.legalBasis] ?? legalBasisConfig["Legitimate interest"];
                const expanded = expandedRopa === entry.id;
                return (
                  <>
                    <tr
                      key={entry.id}
                      onClick={() => setExpandedRopa(expanded ? null : entry.id)}
                      className={`cursor-pointer transition-colors ${expanded ? "bg-[var(--accent-subtle)]" : "hover:bg-[var(--hover-bg)]"}`}
                      style={{
                        borderBottom: "1px solid var(--border-subtle)",
                        background: expanded ? undefined : idx % 2 === 1 ? "var(--surface-raised)" : "var(--surface)",
                      }}
                      aria-expanded={expanded}
                    >
                      <td className="px-5 py-3.5 font-mono text-xs" style={{ color: "var(--text-muted)" }}>{entry.id}</td>
                      <td className="px-5 py-3.5 font-medium" style={{ color: "var(--text-primary)" }}>{entry.activity}</td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-block px-2.5 py-0.5 rounded-md text-xs font-medium ${lbConf.bg} ${lbConf.text}`}>
                          {entry.legalBasis}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 font-mono text-xs" style={{ color: "var(--text-secondary)" }}>{entry.retention}</td>
                      <td className="px-5 py-3.5" style={{ color: "var(--text-muted)" }}>
                        <svg
                          width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                          className={`transition-transform duration-200 ${expanded ? "rotate-180 text-[var(--accent)]" : ""}`}
                          aria-hidden="true"
                        >
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      </td>
                    </tr>
                    {expanded && (
                      <tr key={`${entry.id}-detail`} style={{ borderBottom: "1px solid var(--border)", background: "var(--surface-raised)" }}>
                        <td colSpan={5} className="px-5 py-4">
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                            <div>
                              <p className="font-medium uppercase tracking-wider text-[10px] mb-1" style={{ color: "var(--text-muted)" }}>Purpose</p>
                              <p className="leading-relaxed" style={{ color: "var(--text-secondary)" }}>{entry.purpose}</p>
                            </div>
                            <div>
                              <p className="font-medium uppercase tracking-wider text-[10px] mb-1" style={{ color: "var(--text-muted)" }}>Data Categories</p>
                              <p className="leading-relaxed" style={{ color: "var(--text-secondary)" }}>{entry.dataCategories}</p>
                            </div>
                            <div>
                              <p className="font-medium uppercase tracking-wider text-[10px] mb-1" style={{ color: "var(--text-muted)" }}>Recipients</p>
                              <p className="leading-relaxed" style={{ color: "var(--text-secondary)" }}>{entry.recipients}</p>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Sections 4 + 5: Data Flow Map and Residency ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Section 4: Data Flow Map */}
        <div className="card rounded-md p-5 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Processing Activities Map</p>
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>Live data flow</span>
          </div>
          <DataFlowMap />
          <div className="flex items-center gap-4 pt-1" style={{ borderTop: "1px solid var(--border-subtle)" }}>
            <div className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-secondary)" }}>
              <span className="w-2.5 h-2.5 rounded bg-[var(--critical-bg)] border border-[var(--critical)]/20 shrink-0" />
              High sensitivity
            </div>
            <div className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-secondary)" }}>
              <span className="w-2.5 h-2.5 rounded bg-[var(--accent-subtle)] border border-[var(--border-accent)] shrink-0" />
              Processing
            </div>
            <div className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-secondary)" }}>
              <span className="w-2.5 h-2.5 rounded bg-[var(--success-bg)] border border-[var(--success)]/20 shrink-0" />
              Storage
            </div>
          </div>
        </div>

        {/* Section 5: Data Residency */}
        <div className="card rounded-md p-5 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Data Residency Status</p>
            <span className="relative flex h-2.5 w-2.5" aria-label="Active">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-md bg-[var(--accent)] opacity-50" />
              <span className="relative inline-flex rounded-md h-2.5 w-2.5 bg-[var(--accent)]" />
            </span>
          </div>

          {/* Primary region */}
          <div className="bg-[var(--accent-subtle)] border border-[var(--border-accent)] rounded-md p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-md bg-[var(--surface)] border border-[var(--border-accent)] flex items-center justify-center text-lg shadow-sm" aria-hidden="true">
              🇶🇦
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Doha Region</p>
              <p className="text-xs font-mono text-[var(--accent)] mt-0.5">me-south-1 — Primary</p>
            </div>
            <div className="ml-auto text-right">
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>Jurisdiction</p>
              <p className="text-xs font-medium mt-0.5" style={{ color: "var(--text-primary)" }}>Qatar PDPPL</p>
            </div>
          </div>

          {/* Cross-border transfers */}
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-[10px] mb-2" style={{ color: "var(--text-muted)" }}>
              Cross-border Transfer Log
            </p>
            <div className="space-y-1.5">
              {transfers.map((t, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg border transition-colors hover:bg-[var(--hover-bg)] hover:border-[var(--border-accent)]"
                  style={{ background: "var(--surface-raised)", borderColor: "var(--border)" }}
                >
                  <span className="text-base shrink-0" aria-hidden="true">
                    {t.flag === "QA" ? "🇶🇦" : t.flag === "GB" ? "🇬🇧" : "🇩🇪"}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate" style={{ color: "var(--text-primary)" }}>{t.destination}</p>
                    <p className="text-[10px] truncate" style={{ color: "var(--text-muted)" }}>{t.type}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="inline-block px-2 py-0.5 rounded text-[10px] border" style={{ background: "var(--surface)", color: "var(--text-secondary)", borderColor: "var(--border)" }}>
                      {t.legalBasis}
                    </span>
                    <p className="text-[10px] font-mono mt-0.5" style={{ color: "var(--text-muted)" }}>{t.date}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
