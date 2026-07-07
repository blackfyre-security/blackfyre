"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import type { ComplianceScore, Finding, Scan } from "@/lib/api";
import { LoadingSpinner, useToast } from "@blackfyre/ui";
import HaloPortalSurface from "@/components/halo/HaloPortalSurface";

export default function DashboardPage() {
  const { user } = useAuth();
  const [scores, setScores] = useState<ComplianceScore[]>([]);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [scans, setScans] = useState<Scan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { addToast } = useToast();

  // REAL IMPL (BLACKFYRE 2026-06): the dashboard always loads live data from the
  // API. No DEMO_MODE bypass and no fabricated scores/findings/scans.

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [scoresRes, findingsRes, scansRes] = await Promise.all([
        api.getScores(),
        api.getFindings(),
        api.getScans(),
      ]);
      setScores(scoresRes.scores);
      setFindings(findingsRes.findings);
      setScans(scansRes.scans);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  }, []);

  // REAL IMPL (BLACKFYRE 2026-06): always fetch from the live API on mount. The
  // demo effect that injected fabricated scores/findings/scans was removed.
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const hasRunning = scans.some(
      (s) => s.status === "running" || s.status === "queued"
    );
    if (!hasRunning) return;

    const interval = setInterval(async () => {
      try {
        const res = await api.getScans();
        const wasRunning = scans.find((s) => s.status === "running");
        const nowComplete = res.scans.find(
          (s) =>
            s.id === wasRunning?.id &&
            (s.status === "completed" || s.status === "failed")
        );

        if (nowComplete) {
          const findingCount =
            nowComplete.status === "completed"
              ? `${res.scans.length} scans tracked`
              : "scan failed";
          addToast(
            `Scan complete \u2014 ${findingCount}`,
            nowComplete.status === "completed" ? "success" : "warning"
          );
          fetchData();
          clearInterval(interval);
        }

        setScans(res.scans);
      } catch {
        /* ignore polling errors */
      }
    }, 10_000);

    return () => clearInterval(interval);
  }, [scans, fetchData, addToast]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <LoadingSpinner size="md" label="Loading dashboard..." />
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="card p-6 flex items-start gap-4 animate-fade-in"
        style={{ borderLeft: "4px solid var(--critical)", maxWidth: 480 }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--critical-text)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }}>
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <div>
          <p className="text-sm font-semibold" style={{ color: "var(--critical-text)" }}>Failed to load dashboard</p>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>{error}</p>
          <button className="btn btn-ghost btn-sm mt-3" onClick={fetchData}>Retry</button>
        </div>
      </div>
    );
  }

  // REAL IMPL (BLACKFYRE 2026-06): trend delta is the average of the real
  // per-framework trend the API supplies, or an honest 0 when there is no trend
  // data. The previous code defaulted to a fabricated +2.1 swing so the
  // sparkline would always read "healthy" — that has been removed.
  const trendDelta = scores.length > 0
    ? scores.reduce((s, c) => {
        const trend = (c as unknown as { trend?: number }).trend;
        return s + (trend ?? 0);
      }, 0) / scores.length
    : 0;

  return (
    <div className="-mx-4 md:-mx-6 -my-4 md:-my-6 animate-halo-fade-up">
      <HaloPortalSurface
        tenantName={user?.name}
        scores={scores}
        findings={findings}
        trendDelta={Number.isFinite(trendDelta) ? trendDelta : 0}
      />
    </div>
  );
}
