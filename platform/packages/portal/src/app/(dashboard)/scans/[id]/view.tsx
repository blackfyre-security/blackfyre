"use client";

import { useEffect, useRef, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useScanStream } from "@/hooks/useScanStream";
import { ScanProgressBar, FindingCard, ScanLiveStatus, ScanCompletionBanner, EmptyState, LoadingSpinner } from "@blackfyre/ui";
import Breadcrumb from "@/components/Breadcrumb";

function getStoredToken(): string {
  if (typeof document === "undefined") return "";
  const match = document.cookie.match(/(?:^|;\s*)bf_portal_token=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : "";
}

export default function ScanDetailPage() {
  const params = useParams<{ id: string }>();
  const scanId = params.id;
  const token = getStoredToken();

  const {
    progress,
    currentCategory,
    status,
    findings,
    error,
    connectionState,
    totalFindings,
  } = useScanStream(scanId, token);

  // Auto-scroll sentinel
  const sentinelRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [userScrolledUp, setUserScrolledUp] = useState(false);

  // Detect user scroll position
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    function handleScroll() {
      if (!container) return;
      const { scrollTop, clientHeight, scrollHeight } = container;
      const atBottom = scrollTop + clientHeight >= scrollHeight - 50;
      setUserScrolledUp(!atBottom);
    }

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, []);

  // Auto-scroll to bottom when new findings arrive, unless user scrolled up
  useEffect(() => {
    if (!userScrolledUp && sentinelRef.current) {
      sentinelRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [findings.length, userScrolledUp]);

  // Compute findings by severity for the completion banner
  const findingsBySeverity = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const f of findings) {
      counts[f.severity] = (counts[f.severity] ?? 0) + 1;
    }
    return counts;
  }, [findings]);

  const isCompleted = status === "completed" || status === "completed_partial";
  const isFailed = status === "failed";
  const isRunning = status === "running" || status === null;

  // Connecting state — show spinner before SSE connects
  if (connectionState === "connecting" && findings.length === 0) {
    return (
      <div className="space-y-6">
        <Breadcrumb items={[{ label: "Dashboard", href: "/" }, { label: "Scans", href: "/scans/config" }, { label: scanId }]} />
        <PageHeader />
        <div className="flex items-center justify-center py-20">
          <LoadingSpinner size="lg" label="Connecting to scan stream..." />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: "Dashboard", href: "/" }, { label: "Scans", href: "/scans/config" }, { label: scanId }]} />
      <PageHeader />

      {/* Progress bar — hidden when completion banner shows */}
      {!isCompleted && (
        <ScanProgressBar
          progress={progress}
          currentCategory={currentCategory}
          status={status}
        />
      )}

      {/* Completion banner */}
      {isCompleted && (
        <ScanCompletionBanner
          totalFindings={totalFindings}
          findingsBySeverity={findingsBySeverity}
          scanId={scanId}
        />
      )}

      {/* Live status */}
      <ScanLiveStatus
        connectionState={connectionState}
        status={status}
        findingCount={findings.length}
      />

      {/* Error state */}
      {isFailed && error && (
        <div className="glass-card-sm p-4 border-l-4 border-l-red-500">
          <p className="text-sm text-[var(--critical-text)]">
            Scan stopped &mdash; an error occurred during {currentCategory || "security"} checks.{" "}
            {findings.length} {findings.length === 1 ? "finding was" : "findings were"} collected
            before the scan stopped.
          </p>
          <p className="text-xs text-[var(--text-muted)] mt-2">{error}</p>
          <button
            className="mt-3 px-4 py-2 text-sm font-semibold rounded-md border border-[var(--accent)] text-[var(--accent)] hover:bg-[var(--accent-subtle)] transition-colors"
            onClick={() => window.location.reload()}
          >
            Retry Scan
          </button>
        </div>
      )}

      {/* Findings section */}
      <div>
        <h2 className="text-lg font-heading font-semibold mb-3">
          {isRunning ? "Live Findings" : "Findings"}
        </h2>

        <div ref={containerRef} aria-live="polite">
          {findings.length === 0 && isRunning && (
            <EmptyState
              icon={<LoadingSpinner size="lg" />}
              title="Scan in progress"
              description="Checks are running. Findings will appear here as they are detected."
            />
          )}

          {findings.length > 0 && (
            <div className="space-y-3">
              {findings.map((finding, index) => (
                <FindingCard
                  key={finding.id}
                  finding={finding}
                  index={index}
                />
              ))}
            </div>
          )}

          {/* Auto-scroll sentinel */}
          <div ref={sentinelRef} />
        </div>
      </div>
    </div>
  );
}

/** Page header with title and back link */
function PageHeader() {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-lg font-heading font-semibold">AWS Security Scan</h1>
        <p className="text-xs font-mono uppercase tracking-wider text-[var(--text-muted)] mt-0.5">Real-time security analysis</p>
      </div>
      <Link
        href="/scans/config"
        className="text-sm text-[var(--accent)] hover:text-[var(--accent-hover)] hover:underline transition-colors"
      >
        Back to Scans
      </Link>
    </div>
  );
}
