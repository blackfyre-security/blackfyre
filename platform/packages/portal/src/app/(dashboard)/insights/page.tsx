"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import type { IndustryInsights } from "@/lib/api";

type Industry = "fintech" | "healthtech" | "saas" | "ecommerce";

const industries: Industry[] = ["fintech", "healthtech", "saas", "ecommerce"];

function barColor(pct: number): string {
  if (pct >= 75) return "bg-[var(--critical)]";
  if (pct >= 50) return "bg-[var(--medium)]";
  return "bg-[var(--low)]";
}

function likelihoodColor(pct: number): string {
  if (pct >= 80) return "bg-[var(--critical)]";
  if (pct >= 60) return "bg-[var(--medium)]";
  return "bg-[var(--low)]";
}

// REAL IMPL (BLACKFYRE 2026-06): the DEMO_INSIGHTS fixture (per-industry
// finding/remediation/gap analytics) and DEMO_MODE bypass have been removed.
// Insights are sourced only from the live API (api.getInsights).

export default function InsightsPage() {
  const [selectedIndustry, setSelectedIndustry] = useState<Industry>("fintech");
  const [insights, setInsights] = useState<IndustryInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // REAL IMPL (BLACKFYRE 2026-06): always load industry insights from the live
  // API. No DEMO_INSIGHTS fixture, no demo bypass.
  useEffect(() => {
    async function fetchInsights() {
      try {
        setLoading(true);
        setError(null);
        const res = await api.getInsights(selectedIndustry);
        setInsights(res.insight);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load insights");
      } finally {
        setLoading(false);
      }
    }
    fetchInsights();
  }, [selectedIndustry]);

  const findings = insights?.commonFindings ?? [];
  const remediationData = insights?.avgRemediationDays ?? [];
  const predictions = insights?.predictedGaps ?? [];
  const falsePositiveRates = insights?.falsePositiveRates ?? [];

  const stats = [
    { label: "Finding Categories", value: String(findings.length) },
    { label: "Industries Analyzed", value: String(industries.length) },
    { label: "Avg Remediation Categories", value: String(remediationData.length) },
    { label: "Predicted Gaps", value: String(predictions.length) },
  ];

  return (
    <div className="space-y-6 animate-halo-fade-up">
      {/* Header */}
      <div>
        <p className="halo-eyebrow mb-2">§ 11 · Insights</p>
        <h2 className="text-lg font-semibold font-heading" style={{ color: "var(--text-primary)" }}>Learning Insights</h2>
        <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>AI-powered patterns from scan data</p>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="card rounded-md shadow-sm p-4">
            <p className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>{s.label}</p>
            <p className="text-2xl font-bold font-mono mt-1" style={{ color: "var(--text-primary)" }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Common Findings by Industry */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Common Findings by Industry</h3>
          <select
            value={selectedIndustry}
            onChange={(e) => setSelectedIndustry(e.target.value as Industry)}
            className="input text-sm"
            style={{ width: "auto" }}
          >
            {industries.map((ind) => (
              <option key={ind} value={ind}>
                {ind.charAt(0).toUpperCase() + ind.slice(1)}
              </option>
            ))}
          </select>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-8">
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>Loading...</p>
          </div>
        )}

        {error && (
          <div className="flex items-center justify-center py-8">
            <p className="text-[var(--critical-text)] text-sm">Error: {error}</p>
          </div>
        )}

        {!loading && !error && (
          <div className="card rounded-md shadow-sm p-5 space-y-3">
            {findings.map((f) => (
              <div key={f.category} className="flex items-center gap-3">
                <span className="text-sm font-medium w-24 shrink-0" style={{ color: "var(--text-primary)" }}>{f.category}</span>
                <div className="flex-1 h-5 rounded-md overflow-hidden" style={{ background: "var(--hover-bg)" }}>
                  <div
                    className={`h-full rounded-md ${barColor(f.occurrenceRate * 100)}`}
                    style={{ width: `${f.occurrenceRate * 100}%` }}
                  />
                </div>
                <span className="text-sm font-semibold font-mono w-12 text-right" style={{ color: "var(--text-primary)" }}>
                  {Math.round(f.occurrenceRate * 100)}%
                </span>
              </div>
            ))}
            {findings.length === 0 && (
              <p className="text-sm text-center py-4" style={{ color: "var(--text-secondary)" }}>No findings data available.</p>
            )}
          </div>
        )}
      </div>

      {/* Remediation Timelines */}
      {!loading && !error && (
        <div>
          <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--text-primary)" }}>Remediation Timelines</h3>
          <div className="card rounded-md shadow-sm overflow-x-auto">
            <table className="w-full text-sm data-table" role="table">
              <thead>
                <tr>
                  <th scope="col">Category</th>
                  <th scope="col" className="w-32">Avg Fix Time</th>
                  <th scope="col" className="w-40">False Positive Rate</th>
                </tr>
              </thead>
              <tbody>
                {remediationData.map((r) => {
                  const fpRate = falsePositiveRates.find((fp) => fp.category === r.category);
                  return (
                    <tr key={r.category}>
                      <td className="font-medium" style={{ color: "var(--text-primary)" }}>{r.category}</td>
                      <td className="font-mono" style={{ color: "var(--text-secondary)" }}>{r.avgDays.toFixed(1)} days</td>
                      <td>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "var(--hover-bg)" }}>
                            <div className="h-full rounded-md bg-[var(--accent-subtle)]0" style={{ width: `${(fpRate ? fpRate.rate * 100 : 0)}%` }} />
                          </div>
                          <span className="text-xs font-medium font-mono w-10 text-right" style={{ color: "var(--text-secondary)" }}>
                            {fpRate ? Math.round(fpRate.rate * 100) : 0}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Predicted Gaps */}
      {!loading && !error && (
        <div>
          <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--text-primary)" }}>Predicted Gaps</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {predictions.map((p, i) => (
              <div key={i} className="card rounded-md shadow-sm p-4">
                <span
                  className="inline-block px-2 py-0.5 rounded text-xs font-medium mb-2"
                  style={{ background: "var(--hover-bg)", color: "var(--text-secondary)" }}
                >
                  {p.framework}
                </span>
                <p className="text-sm font-medium mb-3" style={{ color: "var(--text-primary)" }}>{p.controlCategory}</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "var(--hover-bg)" }}>
                    <div className={`h-full rounded-md ${likelihoodColor(p.likelihood * 100)}`} style={{ width: `${p.likelihood * 100}%` }} />
                  </div>
                  <span className="text-xs font-semibold w-10 text-right" style={{ color: "var(--text-primary)" }}>
                    {Math.round(p.likelihood * 100)}%
                  </span>
                </div>
              </div>
            ))}
            {predictions.length === 0 && (
              <p className="text-sm col-span-3 text-center py-4" style={{ color: "var(--text-secondary)" }}>No predictions available.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
