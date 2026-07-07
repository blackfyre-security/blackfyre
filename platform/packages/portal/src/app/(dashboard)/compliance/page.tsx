"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import type { ControlMatrixEntry, Framework, ComplianceScore } from "@/lib/api";
import { LoadingSpinner, FrameworkScoreCard } from "@blackfyre/ui";

const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
  pass:          { bg: "var(--success-bg)",   text: "var(--success-text)",  label: "Pass" },
  fail:          { bg: "var(--critical-bg)",  text: "var(--critical-text)", label: "Fail" },
  partial:       { bg: "var(--medium-bg)",    text: "var(--medium-text)",   label: "Partial" },
  na:            { bg: "var(--surface-raised)", text: "var(--text-muted)",  label: "N/A" },
  not_evaluated: { bg: "var(--surface-raised)", text: "var(--text-muted)",  label: "Not Evaluated" },
};

// REAL IMPL (BLACKFYRE 2026-06): DEMO_MODE and the compliance fixtures
// (DEMO_FRAMEWORKS / DEMO_SCORES / DEMO_CONTROLS) have been removed. This page
// is sourced only from the live API (api.getFrameworks / getScores / getMatrix).

export default function CompliancePage() {
  const [frameworks, setFrameworks] = useState<Framework[]>([]);
  const [scores, setScores] = useState<ComplianceScore[]>([]);
  const [activeTab, setActiveTab] = useState<string>("");
  const [controls, setControls] = useState<ControlMatrixEntry[]>([]);
  const [matrixScore, setMatrixScore] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [matrixLoading, setMatrixLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // REAL IMPL (BLACKFYRE 2026-06): always load frameworks/scores/matrix from the
  // live API. No demo fixtures, no demo bypass.
  useEffect(() => {
    async function fetchFrameworks() {
      try {
        setLoading(true);
        setError(null);
        const [fwRes, scoresRes] = await Promise.all([
          api.getFrameworks(),
          api.getScores(),
        ]);
        setFrameworks(fwRes.frameworks);
        setScores(scoresRes.scores);
        if (fwRes.frameworks.length > 0) {
          setActiveTab(fwRes.frameworks[0].framework);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load frameworks");
      } finally {
        setLoading(false);
      }
    }
    fetchFrameworks();
  }, []);

  useEffect(() => {
    if (!activeTab) return;
    async function fetchMatrix() {
      try {
        setMatrixLoading(true);
        setError(null);
        const res = await api.getMatrix(activeTab);
        setControls(res.matrix.entries);
        setMatrixScore(res.matrix.score);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load compliance matrix");
      } finally {
        setMatrixLoading(false);
      }
    }
    fetchMatrix();
  }, [activeTab]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <LoadingSpinner size="md" label="Loading compliance data..." />
      </div>
    );
  }

  if (error && frameworks.length === 0) {
    return (
      <div
        className="card p-4 text-sm animate-fade-in"
        style={{ borderLeft: "4px solid var(--critical)", color: "var(--critical-text)" }}
      >
        Error: {error}
      </div>
    );
  }

  const passCount  = controls.filter((c) => c.status === "pass").length;
  const totalCount = controls.length;
  const scoresMap  = Object.fromEntries(scores.map((s) => [s.framework, Math.round(s.score)]));

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="animate-fade-up">
        <p className="halo-eyebrow">§ 01 · Compliance</p>
        <h1 className="mt-2 text-xl font-semibold" style={{ color: "var(--text-primary)" }}>
          Compliance
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
          Framework compliance status and control matrix.
        </p>
      </div>

      {/* Framework score ring row */}
      {frameworks.length > 0 && (
        <div
          className="grid gap-4 animate-fade-up"
          style={{
            gridTemplateColumns: `repeat(${Math.min(frameworks.length, 5)}, minmax(0, 1fr))`,
            animationDelay: "40ms",
          }}
        >
          {frameworks.map((fw) => (
            <FrameworkScoreCard key={fw.framework} name={fw.framework} score={scoresMap[fw.framework] ?? 0} />
          ))}
        </div>
      )}

      {/* Tab bar */}
      <div
        className="animate-fade-up"
        style={{ borderBottom: "1px solid var(--border)", animationDelay: "80ms" }}
      >
        <div className="flex gap-0" role="tablist" aria-label="Select framework">
          {frameworks.map((fw) => {
            const active = activeTab === fw.framework;
            return (
              <button
                key={fw.framework}
                role="tab"
                aria-selected={active}
                onClick={() => setActiveTab(fw.framework)}
                className="text-sm font-medium px-4 py-3 relative transition-colors"
                style={{
                  color: active ? "var(--accent)" : "var(--text-secondary)",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                {fw.framework}
                {active && (
                  <span
                    aria-hidden="true"
                    style={{
                      position: "absolute",
                      bottom: -1,
                      left: 0,
                      right: 0,
                      height: 2,
                      background: "var(--accent)",
                      borderRadius: "1px 1px 0 0",
                      transition: "opacity 160ms var(--ease), transform 160ms var(--ease)",
                    }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Summary strip */}
      {!matrixLoading && (
        <div
          className="card p-4 flex items-center gap-6 text-sm animate-fade-up"
          style={{ animationDelay: "100ms" }}
        >
          <div className="flex items-center gap-2">
            <span style={{ color: "var(--text-secondary)" }}>Controls passing</span>
            <span className="mono font-bold text-base" style={{ color: "var(--text-primary)" }}>{passCount}</span>
            <span style={{ color: "var(--text-muted)" }}>/ {totalCount}</span>
          </div>
          <div
            style={{ width: 1, height: 20, background: "var(--border)" }}
            aria-hidden="true"
          />
          <div className="flex items-center gap-2">
            <span style={{ color: "var(--text-secondary)" }}>Score</span>
            <span
              className="mono font-bold text-base"
              style={{ color: matrixScore > 80 ? "var(--success-text)" : matrixScore >= 60 ? "var(--medium-text)" : "var(--critical-text)" }}
            >
              {Math.round(matrixScore)}%
            </span>
          </div>
          {/* Progress bar */}
          <div
            className="flex-1 rounded-md h-2"
            style={{ background: "var(--border)", maxWidth: 200 }}
          >
            <div
              className="h-2 rounded-md"
              style={{
                width: `${matrixScore}%`,
                background: matrixScore > 80 ? "var(--accent)" : matrixScore >= 60 ? "var(--medium)" : "var(--critical)",
                transition: "width 0.6s var(--ease-spring)",
              }}
            />
          </div>
        </div>
      )}

      {/* Matrix loading */}
      {matrixLoading && (
        <div className="flex items-center justify-center py-12">
          <LoadingSpinner size="sm" label="Loading matrix..." />
        </div>
      )}

      {/* Error */}
      {error && !matrixLoading && (
        <div
          className="card p-4 text-sm animate-fade-in"
          style={{ borderLeft: "4px solid var(--critical)", color: "var(--critical-text)" }}
        >
          Error: {error}
        </div>
      )}

      {/* Control matrix table */}
      {!matrixLoading && !error && (
        <div className="card overflow-x-auto animate-fade-up" style={{ animationDelay: "120ms" }}>
          <table className="data-table" role="table" aria-label={`${activeTab} control matrix`}>
            <thead>
              <tr>
                <th scope="col" style={{ width: 120 }}>Control ID</th>
                <th scope="col">Control Name</th>
                <th scope="col" style={{ width: 160 }}>Category</th>
                <th scope="col" style={{ width: 120 }}>Status</th>
                <th scope="col" style={{ width: 80, textAlign: "right" }}>Weight</th>
              </tr>
            </thead>
            <tbody>
              {controls.map((c) => {
                const stat = statusConfig[c.status] ?? statusConfig.not_evaluated;
                return (
                  <tr key={c.controlId}>
                    <td className="mono text-xs" style={{ color: "var(--accent)", fontWeight: 600 }}>{c.controlId}</td>
                    <td className="font-medium text-sm" style={{ color: "var(--text-primary)" }}>{c.controlName}</td>
                    <td className="text-sm" style={{ color: "var(--text-secondary)" }}>{c.category}</td>
                    <td>
                      <span
                        className="badge"
                        style={{ background: stat.bg, color: stat.text }}
                      >
                        {stat.label}
                      </span>
                    </td>
                    <td className="mono text-xs text-right" style={{ color: "var(--text-muted)" }}>{c.weight}%</td>
                  </tr>
                );
              })}
              {controls.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    style={{ padding: "48px 20px", textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}
                  >
                    No controls found for {activeTab}.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
