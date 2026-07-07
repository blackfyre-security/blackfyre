"use client";

import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import type { Finding } from "@/lib/api";
import { LoadingSpinner } from "@blackfyre/ui";
import Breadcrumb from "@/components/Breadcrumb";

// ---- Config tables (mirrors findings list page) --------------------------------

const severityConfig: Record<string, { badgeClass: string }> = {
  critical: { badgeClass: "badge badge-critical" },
  high:     { badgeClass: "badge badge-high" },
  medium:   { badgeClass: "badge badge-medium" },
  low:      { badgeClass: "badge badge-low" },
  info:     { badgeClass: "badge badge-info" },
};

const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
  open:         { bg: "var(--critical-bg)",   text: "var(--critical-text)",  label: "Open" },
  acknowledged: { bg: "var(--medium-bg)",     text: "var(--medium-text)",    label: "Acknowledged" },
  in_progress:  { bg: "var(--medium-bg)",     text: "var(--medium-text)",    label: "In Progress" },
  resolved:     { bg: "var(--success-bg)",    text: "var(--success-text)",   label: "Resolved" },
  dismissed:    { bg: "var(--surface-raised)", text: "var(--text-muted)",    label: "Dismissed" },
};

const STATUS_OPTIONS = ["open", "acknowledged", "in_progress", "resolved", "dismissed"] as const;

const remediationInfo: Record<string, { label: string; tooltip: string; bg: string; text: string }> = {
  auto:     { label: "Auto",     tooltip: "Can be automatically remediated",             bg: "var(--success-bg)",   text: "var(--success-text)" },
  approval: { label: "Approval", tooltip: "Requires manual approval before execution",   bg: "var(--medium-bg)",    text: "var(--medium-text)" },
  manual:   { label: "Manual",   tooltip: "Requires manual remediation steps",           bg: "var(--surface-raised)", text: "var(--text-muted)" },
};

// REAL IMPL (BLACKFYRE 2026-06): the 25-row DEMO_FINDINGS fixture and DEMO_MODE
// bypass have been removed. The finding detail is sourced only from the live
// API (api.getFinding).

// ---- Tooltip component --------------------------------------------------------

function Tooltip({ text, children }: { text: string; children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);
  return (
    <span
      className="relative inline-flex items-center"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      {visible && (
        <span
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 whitespace-nowrap rounded-md px-2.5 py-1.5 text-xs shadow-lg pointer-events-none"
          style={{
            background: "var(--surface-raised)",
            color: "var(--text-secondary)",
            border: "1px solid var(--border)",
            maxWidth: 260,
            whiteSpace: "normal",
          }}
        >
          {text}
        </span>
      )}
    </span>
  );
}

// ---- Detail section shell -----------------------------------------------------

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card p-5 space-y-3">
      <h2 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
        {title}
      </h2>
      {children}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-sm min-w-[120px]" style={{ color: "var(--text-muted)" }}>{label}</span>
      <span className="text-sm flex-1" style={{ color: "var(--text-primary)" }}>{children}</span>
    </div>
  );
}

// ---- Main page ----------------------------------------------------------------

export default function FindingDetailPage() {
  const params = useParams();
  const id = typeof params?.id === "string" ? params.id : Array.isArray(params?.id) ? params.id[0] : "";

  const [finding, setFinding] = useState<Finding | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setStatusDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    if (!id) return;

    // REAL IMPL (BLACKFYRE 2026-06): always load the finding from the live API.
    async function fetchFinding() {
      try {
        setLoading(true);
        setError(null);
        const res = await api.getFinding(id);
        setFinding(res.finding);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load finding");
      } finally {
        setLoading(false);
      }
    }
    fetchFinding();
  }, [id]);

  async function handleStatusChange(newStatus: string) {
    if (!finding) return;
    setStatusDropdownOpen(false);
    setStatusUpdating(true);
    try {
      // REAL IMPL (BLACKFYRE 2026-06): persist the status change via the live
      // API and reflect the server's response. No client-only fake update.
      const res = await api.updateFinding(finding.id, { status: newStatus });
      setFinding(res.finding);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update status");
    } finally {
      setStatusUpdating(false);
    }
  }

  // ---- Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <LoadingSpinner size="md" label="Loading finding..." />
      </div>
    );
  }

  // ---- Error state
  if (error) {
    return (
      <div className="space-y-4 animate-fade-up">
        <BackLink />
        <div
          className="card p-4 text-sm"
          style={{ borderLeft: "4px solid var(--critical)", color: "var(--critical-text)" }}
        >
          Error: {error}
        </div>
      </div>
    );
  }

  // ---- Not found
  if (!finding) {
    return (
      <div className="space-y-4 animate-fade-up">
        <BackLink />
        <div
          className="card p-4 text-sm"
          style={{ color: "var(--text-muted)" }}
        >
          Finding <span className="mono">{id}</span> was not found.
        </div>
      </div>
    );
  }

  const sev  = severityConfig[finding.severity]  ?? severityConfig.info;
  const stat = statusConfig[finding.status]      ?? statusConfig.open;
  const rem  = remediationInfo[finding.remediationTier] ?? remediationInfo.manual;

  return (
    <div className="space-y-5 max-w-3xl animate-fade-up">
      {/* Breadcrumb */}
      <Breadcrumb items={[{ label: "Dashboard", href: "/" }, { label: "Findings", href: "/findings" }, { label: finding?.id ?? id }]} />

      {/* Back link */}
      <BackLink />

      {/* Header card */}
      <div className="card p-5 space-y-3">
        {/* Title row */}
        <div className="flex flex-wrap items-start gap-2">
          <span className={sev.badgeClass}>
            {(finding.severity ?? "").charAt(0).toUpperCase() + (finding.severity ?? "").slice(1)}
          </span>
          <h1 className="text-base font-semibold leading-snug flex-1" style={{ color: "var(--text-primary)" }}>
            {finding.title}
          </h1>
        </div>

        {/* ID */}
        <p className="mono text-xs" style={{ color: "var(--text-muted)" }}>{finding.id}</p>

        {/* Status row */}
        <div className="flex items-center gap-2">
          <span className="text-sm" style={{ color: "var(--text-muted)" }}>Status</span>

          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setStatusDropdownOpen((o) => !o)}
              disabled={statusUpdating}
              className="badge flex items-center gap-1.5 cursor-pointer select-none transition-opacity"
              style={{
                background: stat.bg,
                color: stat.text,
                opacity: statusUpdating ? 0.6 : 1,
                border: "none",
                fontFamily: "inherit",
              }}
              aria-haspopup="listbox"
              aria-expanded={statusDropdownOpen}
            >
              {statusUpdating ? "Updating..." : stat.label}
              <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" aria-hidden="true">
                <path d="M5 6.5L1.5 3h7L5 6.5z" />
              </svg>
            </button>

            {statusDropdownOpen && (
              <div
                className="absolute top-full left-0 mt-1 z-50 rounded-lg py-1 shadow-lg min-w-[160px]"
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                }}
                role="listbox"
                aria-label="Change status"
              >
                {STATUS_OPTIONS.map((s) => {
                  const cfg = statusConfig[s] ?? statusConfig.open;
                  return (
                    <button
                      key={s}
                      onClick={() => handleStatusChange(s)}
                      className="w-full text-left px-3 py-2 text-sm transition-colors hover:opacity-80"
                      style={{
                        color: finding.status === s ? "var(--accent)" : "var(--text-secondary)",
                        background: "transparent",
                        border: "none",
                        fontFamily: "inherit",
                        fontWeight: finding.status === s ? 600 : 400,
                        cursor: "pointer",
                      }}
                      role="option"
                      aria-selected={finding.status === s}
                    >
                      {cfg.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Description */}
      <Section title="Description">
        <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
          {finding.description || "No description available."}
        </p>
      </Section>

      {/* Resource details */}
      <Section title="Resource Details">
        <Row label="Resource Type">
          {finding.resourceType
            ? <span className="mono text-xs">{finding.resourceType}</span>
            : <span style={{ color: "var(--text-muted)" }}>—</span>}
        </Row>
        <Row label="Resource ID">
          {finding.resourceId
            ? <span className="mono text-xs break-all">{finding.resourceId}</span>
            : <span style={{ color: "var(--text-muted)" }}>—</span>}
        </Row>
        <Row label="Region">
          {finding.resourceRegion
            ? <span className="mono text-xs">{finding.resourceRegion}</span>
            : <span style={{ color: "var(--text-muted)" }}>—</span>}
        </Row>
      </Section>

      {/* Classification */}
      <Section title="Classification">
        <Row label="Category">
          <span
            className="badge"
            style={{ background: "var(--surface-raised)", color: "var(--text-secondary)" }}
          >
            {finding.category}
          </span>
        </Row>
        <Row label="Remediation">
          <Tooltip text={rem.tooltip}>
            <span
              className="badge cursor-default"
              style={{ background: rem.bg, color: rem.text }}
            >
              {rem.label}
            </span>
          </Tooltip>
        </Row>
        <Row label="Scan">
          <Link
            href={`/scans/${finding.scanId}`}
            className="mono text-xs transition-colors hover:underline"
            style={{ color: "var(--accent)" }}
          >
            {finding.scanId}
          </Link>
        </Row>
      </Section>
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/findings"
      className="inline-flex items-center gap-1.5 text-sm transition-colors hover:underline"
      style={{ color: "var(--text-secondary)" }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M19 12H5M12 19l-7-7 7-7" />
      </svg>
      Back to Findings
    </Link>
  );
}
