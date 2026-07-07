"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import type { Scan } from "@/lib/api";

/* ------------------------------------------------------------------ */
/*  TYPES                                                              */
/* ------------------------------------------------------------------ */

type ScanStatus = "running" | "queued" | "completed" | "failed" | "cancelled";

interface MockScan {
  // REAL IMPL (BLACKFYRE 2026-06): `id` is the short display id; `rawId` is the
  // full server id used for cancel/poll calls. Both come from the live API.
  id: string;
  rawId: string;
  client: string;
  frameworks: string[];
  targets: string[];
  status: ScanStatus;
  progress: number;
  duration: string;
  agentCount: number;
  startedAt: string;
}

// REAL IMPL (BLACKFYRE 2026-06): the old AgentHealth model asserted an
// "online" status and a fabricated "100% success" rate for every target it
// merely saw referenced in a scan config — there is no agent-health API to back
// that. This is replaced by an honest ScanTarget model that reports only what
// the real scan list actually tells us: which targets are in use and how many
// scans reference each.
interface ScanTarget {
  type: string;
  scanCount: number;
  activeCount: number;
}

/* ------------------------------------------------------------------ */
/*  HELPERS                                                            */
/* ------------------------------------------------------------------ */

function apiScanToMock(s: Scan): MockScan {
  const status = (s.status as ScanStatus) || "queued";
  let duration = "--";
  if (s.startedAt) {
    const end = s.completedAt ? new Date(s.completedAt) : new Date();
    const diffMs = end.getTime() - new Date(s.startedAt).getTime();
    const mins = Math.floor(diffMs / 60000);
    const secs = Math.floor((diffMs % 60000) / 1000);
    duration = `${mins}m ${secs}s`;
  }
  return {
    id: s.id.slice(0, 8).toUpperCase(),
    rawId: s.id,
    client: s.tenantId,
    frameworks: s.frameworks,
    targets: s.targets,
    status,
    progress: s.progress,
    duration,
    agentCount: 0,
    startedAt: s.startedAt || new Date().toISOString(),
  };
}

const FRAMEWORK_OPTIONS = ["SOC2", "ISO", "HIPAA", "GDPR", "PCI-DSS"];
const TARGET_OPTIONS = [
  "aws",
  "azure",
  "gcp",
  "okta",
  "endpoint",
  "network",
  "github",
  "jira",
];

/* ------------------------------------------------------------------ */
/*  STATUS HELPERS                                                     */
/* ------------------------------------------------------------------ */

function statusOrder(s: ScanStatus): number {
  const order: Record<ScanStatus, number> = {
    running: 0,
    queued: 1,
    completed: 2,
    failed: 3,
    cancelled: 4,
  };
  return order[s];
}

function StatusBadge({ status }: { status: ScanStatus }) {
  const map: Record<
    ScanStatus,
    { bg: string; text: string; ring: string; pulse: boolean }
  > = {
    running: {
      bg: "bg-[var(--success-bg)]",
      text: "text-[var(--success-text)]",
      ring: "ring-[var(--success)]/40",
      pulse: true,
    },
    queued: {
      bg: "bg-[var(--low-bg)]",
      text: "text-[var(--low-text)]",
      ring: "ring-[var(--low)]/40",
      pulse: false,
    },
    completed: {
      bg: "bg-[var(--success-bg)]",
      text: "text-[var(--success-text)]",
      ring: "ring-[var(--success)]/30",
      pulse: false,
    },
    failed: {
      bg: "bg-[var(--critical-bg)]",
      text: "text-[var(--critical-text)]",
      ring: "ring-[var(--critical)]/40",
      pulse: false,
    },
    cancelled: {
      bg: "bg-[var(--hover-bg)]",
      text: "text-[var(--text-muted)]",
      ring: "ring-[var(--border-strong)]/30",
      pulse: false,
    },
  };
  const s = map[status];

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded font-mono text-[10px] uppercase tracking-wider ring-1 ${s.bg} ${s.text} ${s.ring}`}
    >
      {s.pulse && (
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-md opacity-75" style={{ background: "var(--success)" }} />
          <span className="relative inline-flex rounded-md h-2 w-2 " style={{ background: "var(--success)" }} />
        </span>
      )}
      {status}
    </span>
  );
}

function FrameworkBadge({ name }: { name: string }) {
  return (
    <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-mono tracking-wider bg-accent/10 text-accent border border-[var(--border)]/50">
      {name}
    </span>
  );
}

function TargetBadge({ name }: { name: string }) {
  return (
    <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-mono tracking-wider bg-[var(--low-bg)] text-[var(--low-text)] border border-[var(--low-text)]/20">
      {name}
    </span>
  );
}

// REAL IMPL (BLACKFYRE 2026-06): indicator for a scan target. "active" means a
// real scan referencing this target is currently running or queued (a fact we
// derive from the live scan list) — not an invented agent-liveness claim.
function ScanTargetDot({ active }: { active: boolean }) {
  const color = active ? "bg-[var(--success)]" : "bg-[var(--border-strong)]";
  return (
    <span className="relative flex h-2.5 w-2.5">
      {active && (
        <span
          className={`animate-ping absolute inline-flex h-full w-full rounded-md ${color} opacity-50`}
        />
      )}
      <span className={`relative inline-flex rounded-md h-2.5 w-2.5 ${color}`} />
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  PROGRESS BAR                                                       */
/* ------------------------------------------------------------------ */

function ProgressBar({
  value,
  status,
}: {
  value: number;
  status: ScanStatus;
}) {
  const isRunning = status === "running";
  const isFailed = status === "failed";

  return (
    <div className="w-full h-2 bg-[var(--surface-raised)] rounded-md overflow-hidden">
      <div
        className={`h-full rounded-md transition-all duration-700 ease-out ${
          isFailed
            ? "bg-[var(--critical)]"
            : isRunning
              ? "bg-gradient-to-r from-accent via-accent-hover to-accent-muted"
              : value === 100
                ? "bg-[var(--success)]"
                : "bg-[var(--border-strong)]"
        } ${isRunning ? "animate-pulse-neon" : ""}`}
        style={{ width: `${value}%` }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  LAUNCH SCAN MODAL                                                  */
/* ------------------------------------------------------------------ */

function LaunchScanModal({
  open,
  onClose,
  onLaunch,
  clientOptions,
}: {
  open: boolean;
  onClose: () => void;
  onLaunch: (scan: MockScan) => void;
  clientOptions: string[];
}) {
  const [client, setClient] = useState("");
  const [frameworks, setFrameworks] = useState<string[]>([]);
  const [targets, setTargets] = useState<string[]>([]);
  const [executing, setExecuting] = useState(false);

  const toggle = (arr: string[], val: string, set: (a: string[]) => void) => {
    set(arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val]);
  };

  const canLaunch = client && frameworks.length > 0 && targets.length > 0;

  const handleExecute = () => {
    if (!canLaunch) return;
    setExecuting(true);
    // REAL IMPL (BLACKFYRE 2026-06): this is a transient request payload only —
    // handleLaunch uses just `frameworks`/`targets` to call the real createScan
    // API and renders the server-returned scan (with its real id). The local id
    // here is never persisted or rendered. No fabricated scan is ever inserted.
    onLaunch({
      id: "",
      rawId: "",
      client,
      frameworks,
      targets,
      status: "queued",
      progress: 0,
      duration: "--",
      agentCount: 0,
      startedAt: new Date().toISOString(),
    });
    setExecuting(false);
    setClient("");
    setFrameworks([]);
    setTargets([]);
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* modal */}
      <div className="relative w-full max-w-lg mx-4 admin-card border-[var(--border)] glow-border p-0 overflow-hidden">
        {/* scanline decoration */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-accent/60 to-transparent" />

        <div className="p-6">
          <h3 className="font-heading text-sm font-bold text-accent tracking-widest mb-1">
            LAUNCH SCAN
          </h3>
          <p className="font-mono text-[10px] text-[var(--text-muted)] tracking-wider mb-6">
            CONFIGURE AND DEPLOY COMPLIANCE SCAN AGENTS
          </p>

          {/* Client select */}
          <label className="block mb-4">
            <span className="font-mono text-[10px] text-[var(--text-muted)] tracking-wider uppercase block mb-1.5">
              Client
            </span>
            <select
              value={client}
              onChange={(e) => setClient(e.target.value)}
              className="admin-input bg-[var(--surface)] appearance-none cursor-pointer"
            >
              <option value="">Select client...</option>
              {clientOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>

          {/* Frameworks */}
          <div className="mb-4">
            <span className="font-mono text-[10px] text-[var(--text-muted)] tracking-wider uppercase block mb-1.5">
              Frameworks
            </span>
            <div className="flex flex-wrap gap-2">
              {FRAMEWORK_OPTIONS.map((fw) => {
                const selected = frameworks.includes(fw);
                return (
                  <button
                    key={fw}
                    onClick={() => toggle(frameworks, fw, setFrameworks)}
                    className={`px-2.5 py-1 rounded font-mono text-[10px] tracking-wider border transition-all cursor-pointer ${
                      selected
                        ? "bg-accent/10 text-accent border-accent/30 shadow-sm"
                        : "bg-[var(--surface-raised)] text-[var(--text-muted)] border-[var(--border)] hover:border-[var(--border-strong)]"
                    }`}
                  >
                    {fw}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Targets */}
          <div className="mb-6">
            <span className="font-mono text-[10px] text-[var(--text-muted)] tracking-wider uppercase block mb-1.5">
              Targets
            </span>
            <div className="flex flex-wrap gap-2">
              {TARGET_OPTIONS.map((tgt) => {
                const selected = targets.includes(tgt);
                return (
                  <button
                    key={tgt}
                    onClick={() => toggle(targets, tgt, setTargets)}
                    className={`px-2.5 py-1 rounded font-mono text-[10px] tracking-wider border transition-all cursor-pointer ${
                      selected
                        ? "bg-[var(--low-bg)] text-[var(--low-text)] border-[var(--low-text)]"
                        : "bg-[var(--surface-raised)] text-[var(--text-muted)] border-[var(--border)] hover:border-[var(--border-strong)]"
                    }`}
                  >
                    {tgt}
                  </button>
                );
              })}
            </div>
          </div>

          {/* actions */}
          <div className="flex gap-3 justify-end">
            <button
              onClick={onClose}
              className="admin-btn admin-btn-ghost text-xs"
            >
              ABORT
            </button>
            <button
              onClick={handleExecute}
              disabled={!canLaunch || executing}
              className="admin-btn admin-btn-primary text-xs min-w-[120px]"
            >
              {executing ? (
                <span className="flex items-center gap-2">
                  <svg
                    className="animate-spin h-3.5 w-3.5"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  DEPLOYING...
                </span>
              ) : (
                "EXECUTE"
              )}
            </button>
          </div>
        </div>

        {/* bottom glow line */}
        <div className="h-px bg-gradient-to-r from-transparent via-accent/30 to-transparent" />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  CONFIRM DIALOG                                                     */
/* ------------------------------------------------------------------ */

function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onCancel}
      />
      <div className="relative w-full max-w-sm mx-4 admin-card border-[var(--critical)]/40 p-6">
        <h3 className="font-heading text-sm font-bold text-[var(--critical-text)] tracking-widest mb-2">
          {title}
        </h3>
        <p className="font-mono text-xs text-[var(--text-muted)] mb-6">{message}</p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="admin-btn admin-btn-ghost text-xs"
          >
            CANCEL
          </button>
          <button
            onClick={onConfirm}
            className="admin-btn text-xs bg-[var(--critical)] text-white hover:bg-[var(--critical)] cursor-pointer"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  MAIN PAGE                                                          */
/* ------------------------------------------------------------------ */

// REAL IMPL (BLACKFYRE 2026-06): DEMO_SCANS (named real companies + invented
// scan IDs/progress), DEMO_AGENT_HEALTH (invented success rates) and
// DEMO_CLIENT_OPTIONS have all been removed, along with the DEMO_MODE bypass.
// The scans page is sourced only from the live API (api.getScans / getClients).
// Agent health is derived from real scan targets; empty/error states are honest.

export default function ScansPage() {
  const [scans, setScans] = useState<MockScan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showLaunchModal, setShowLaunchModal] = useState(false);
  const [confirmFlush, setConfirmFlush] = useState(false);
  const [confirmCancelAll, setConfirmCancelAll] = useState(false);
  const [clientOptions, setClientOptions] = useState<string[]>([]);
  const [scanTargets, setScanTargets] = useState<ScanTarget[]>([]);

  /* REAL IMPL (BLACKFYRE 2026-06): fetch scans and clients from the live API.
     No demo bypass. */
  useEffect(() => {
    api.getScans()
      .then((res) => {
        const mapped = (res.scans ?? []).map(apiScanToMock);
        setScans(mapped);
        // REAL IMPL (BLACKFYRE 2026-06): derive scan-target usage purely from the
        // real scan list — count total + currently-active scans per target. No
        // invented "online" status or success rate.
        const counts = new Map<string, { scanCount: number; activeCount: number }>();
        (res.scans ?? []).forEach((s: Scan) => {
          const isActive = s.status === "running" || s.status === "queued";
          s.targets.forEach((t: string) => {
            const c = counts.get(t) ?? { scanCount: 0, activeCount: 0 };
            c.scanCount += 1;
            if (isActive) c.activeCount += 1;
            counts.set(t, c);
          });
        });
        const derivedTargets: ScanTarget[] = Array.from(counts.entries()).map(([t, c]) => ({
          type: t.charAt(0).toUpperCase() + t.slice(1),
          scanCount: c.scanCount,
          activeCount: c.activeCount,
        }));
        setScanTargets(derivedTargets);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));

    api.getClients()
      .then((res) => {
        setClientOptions((res.clients ?? []).map((c: any) => c.company ?? c.name ?? c.tenantId));
      })
      .catch(() => {/* clients list is non-critical for scans page */});
  }, []);

  /* REAL IMPL (BLACKFYRE 2026-06): poll the live scans API so running-scan
     progress reflects real server state. The previous implementation
     fabricated progress with Math.random(), which made the UI lie about how
     far a scan had actually run. */
  useEffect(() => {
    const interval = setInterval(() => {
      api.getScans()
        .then((res) => setScans((res.scans ?? []).map(apiScanToMock)))
        .catch(() => {/* transient poll failure — keep last known real state */});
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  /* derived counts */
  const runningCount = scans.filter((s) => s.status === "running").length;
  const queuedCount = scans.filter((s) => s.status === "queued").length;
  const completedCount = scans.filter(
    (s) => s.status === "completed",
  ).length;
  const failedCount = scans.filter((s) => s.status === "failed").length;

  /* sorted: running first, then queued, then rest */
  const sortedScans = [...scans].sort(
    (a, b) => statusOrder(a.status) - statusOrder(b.status),
  );

  // REAL IMPL (BLACKFYRE 2026-06): only add a scan to the list when the server
  // confirms it was created. The previous catch() optimistically inserted the
  // unsaved scan, fabricating a scan that never existed server-side.
  const handleLaunch = useCallback((scan: MockScan) => {
    api.createScan({ frameworks: scan.frameworks, targets: scan.targets })
      .then((res) => setScans((prev) => [apiScanToMock(res.scan), ...prev]))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed to launch scan"));
  }, []);

  // REAL IMPL (BLACKFYRE 2026-06): cancellation must hit the real server, not
  // just mutate local state (which would make the UI lie about scan state). We
  // cancel each affected scan via the live admin cancel endpoint, then re-fetch
  // the authoritative scan list so the table reflects real server status.
  const refetchScans = useCallback(() => {
    api.getScans()
      .then((res) => setScans((res.scans ?? []).map(apiScanToMock)))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed to refresh scans"));
  }, []);

  const handleFlushQueue = useCallback(async () => {
    const queued = scans.filter((s) => s.status === "queued");
    await Promise.allSettled(queued.map((s) => api.cancelAdminScan(s.rawId)));
    setConfirmFlush(false);
    refetchScans();
  }, [scans, refetchScans]);

  const handleCancelRunning = useCallback(async () => {
    const running = scans.filter((s) => s.status === "running");
    await Promise.allSettled(running.map((s) => api.cancelAdminScan(s.rawId)));
    setConfirmCancelAll(false);
    refetchScans();
  }, [scans, refetchScans]);

  /* live clock for the header timestamp */
  const [liveTime, setLiveTime] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setLiveTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="flex flex-col items-center gap-3">
        <svg className="animate-spin h-8 w-8 text-accent" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <span className="font-mono text-xs text-[var(--text-muted)] tracking-widest">LOADING SCAN OPERATIONS...</span>
      </div>
    </div>
  );

  if (error) return (
    <div className="flex items-center justify-center h-64">
      <div className="admin-card border-[var(--critical)]/40 p-6 text-center max-w-md">
        <p className="font-mono text-xs text-[var(--critical-text)] tracking-wider">FAILED TO LOAD SCANS</p>
        <p className="font-mono text-[11px] text-[var(--text-muted)] mt-2">{error}</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* ---- HEADER ---- */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div
            className="mono text-[11px] font-semibold"
            style={{ color: "var(--text-muted)", letterSpacing: "0.14em", textTransform: "uppercase" }}
          >
            Admin · Scans
          </div>
          <h1
            className="mt-2 text-[30px] font-semibold tracking-tight"
            style={{ color: "var(--text-primary)", letterSpacing: "-0.025em" }}
          >
            Scan operations
          </h1>
          <p className="mt-1.5 text-[13px]" style={{ color: "var(--text-secondary)" }}>
            Live feed &mdash;{" "}
            {liveTime.toLocaleTimeString("en-US", { hour12: false })} UTC
          </p>
        </div>
        <button
          onClick={() => setShowLaunchModal(true)}
          className="admin-btn admin-btn-primary text-xs gap-2"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
          LAUNCH SCAN
        </button>
      </div>

      {/* ---- STAT CARDS ---- */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Running */}
        <div className="admin-card px-4 py-3 relative overflow-hidden scanline">
          <div className="flex items-center gap-2 mb-1">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-md opacity-75" style={{ background: "var(--success)" }} />
              <span className="relative inline-flex rounded-md h-2.5 w-2.5 " style={{ background: "var(--success)" }} />
            </span>
            <span className="font-mono text-[10px] text-[var(--text-muted)] tracking-wider uppercase">
              Running
            </span>
          </div>
          <p className="font-mono text-2xl font-bold text-accent  tabular-nums">
            {runningCount}
          </p>
        </div>

        {/* Queued */}
        <div className="admin-card px-4 py-3">
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex h-2.5 w-2.5 rounded-md bg-[var(--low-text)]" />
            <span className="font-mono text-[10px] text-[var(--text-muted)] tracking-wider uppercase">
              Queued
            </span>
          </div>
          <p className="font-mono text-2xl font-bold text-[var(--low-text)] tabular-nums">
            {queuedCount}
          </p>
        </div>

        {/* Completed Today */}
        <div className="admin-card px-4 py-3">
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex h-2.5 w-2.5 rounded-md" style={{ background: "var(--success)" }} />
            <span className="font-mono text-[10px] text-[var(--text-muted)] tracking-wider uppercase">
              Completed Today
            </span>
          </div>
          <p className="font-mono text-2xl font-bold text-[var(--success-text)] tabular-nums">
            {completedCount}
          </p>
        </div>

        {/* Failed */}
        <div
          className={`admin-card px-4 py-3 ${failedCount > 0 ? "border-[var(--critical)]/40" : ""}`}
        >
          <div className="flex items-center gap-2 mb-1">
            <span
              className={`inline-flex h-2.5 w-2.5 rounded-md ${failedCount > 0 ? "bg-[var(--critical)]" : "bg-[var(--border-strong)]"}`}
            />
            <span className="font-mono text-[10px] text-[var(--text-muted)] tracking-wider uppercase">
              Failed
            </span>
          </div>
          <p
            className={`font-mono text-2xl font-bold tabular-nums ${failedCount > 0 ? "text-[var(--critical-text)]" : "text-[var(--text-secondary)]"}`}
          >
            {failedCount}
          </p>
        </div>
      </div>

      {/* ---- MAIN CONTENT GRID ---- */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-4">
        {/* ---- LIVE SCAN FEED TABLE ---- */}
        <div className="admin-card overflow-hidden relative scanline">
          <div className="px-4 py-3 border-b border-[var(--border)]/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-md opacity-75" style={{ background: "var(--success)" }} />
                <span className="relative inline-flex rounded-md h-2 w-2 " style={{ background: "var(--success)" }} />
              </span>
              <h2 className="font-heading text-xs font-semibold text-[var(--text-secondary)] tracking-widest uppercase">
                Live Scan Feed
              </h2>
            </div>
            <span className="font-mono text-[9px] text-[var(--text-secondary)] tracking-wider">
              {scans.length} OPERATIONS
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  {[
                    "Scan ID",
                    "Client",
                    "Frameworks",
                    "Targets",
                    "Status",
                    "Progress",
                    "Duration",
                    "Agents",
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-2.5 font-mono text-[9px] text-[var(--text-secondary)] tracking-wider uppercase font-medium whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* REAL IMPL (BLACKFYRE 2026-06): honest empty state — no
                    fabricated rows when the live API has no scans yet. */}
                {sortedScans.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center font-mono text-[11px] text-[var(--text-muted)] tracking-wider">
                      NO SCANS YET — LAUNCH ONE TO BEGIN
                    </td>
                  </tr>
                )}
                {sortedScans.map((scan) => (
                  <tr
                    key={scan.rawId || scan.id}
                    className={`border-b border-[var(--border)]/50 transition-colors hover:bg-accent/10/30 ${
                      scan.status === "running"
                        ? "bg-[var(--success-bg)]"
                        : ""
                    }`}
                  >
                    {/* Scan ID */}
                    <td className="px-4 py-2.5">
                      <span className="font-mono text-xs text-accent tracking-wider">
                        {scan.id}
                      </span>
                    </td>

                    {/* Client */}
                    <td className="px-4 py-2.5">
                      <span className="font-mono text-xs text-[var(--text-secondary)] whitespace-nowrap">
                        {scan.client}
                      </span>
                    </td>

                    {/* Frameworks */}
                    <td className="px-4 py-2.5">
                      <div className="flex flex-wrap gap-1">
                        {scan.frameworks.map((fw) => (
                          <FrameworkBadge key={fw} name={fw} />
                        ))}
                      </div>
                    </td>

                    {/* Targets */}
                    <td className="px-4 py-2.5">
                      <div className="flex flex-wrap gap-1">
                        {scan.targets.map((t) => (
                          <TargetBadge key={t} name={t} />
                        ))}
                      </div>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-2.5">
                      <StatusBadge status={scan.status} />
                    </td>

                    {/* Progress */}
                    <td className="px-4 py-2.5 min-w-[120px]">
                      <div className="flex items-center gap-2">
                        <div className="flex-1">
                          <ProgressBar
                            value={scan.progress}
                            status={scan.status}
                          />
                        </div>
                        <span className="font-mono text-[10px] text-[var(--text-muted)] w-8 text-right tabular-nums">
                          {Math.round(scan.progress)}%
                        </span>
                      </div>
                    </td>

                    {/* Duration */}
                    <td className="px-4 py-2.5">
                      <span className="font-mono text-[11px] text-[var(--text-muted)] tabular-nums whitespace-nowrap">
                        {scan.duration}
                      </span>
                    </td>

                    {/* Agents */}
                    <td className="px-4 py-2.5 text-center">
                      <span
                        className={`font-mono text-xs tabular-nums ${scan.agentCount > 0 ? "text-accent" : "text-[var(--text-secondary)]"}`}
                      >
                        {scan.agentCount || "--"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ---- RIGHT SIDEBAR ---- */}
        <div className="space-y-4">
          {/* ---- SCAN TARGETS PANEL ---- */}
          {/* REAL IMPL (BLACKFYRE 2026-06): replaces the old "Agent Health"
              panel which fabricated an online/100%-success status for every
              target. This lists the real targets referenced by live scans and
              honest counts (total scans + currently-active scans) derived from
              the scan list. The dot lights up only when a target has an active
              scan — a fact we actually know, not an invented liveness claim. */}
          <div className="admin-card overflow-hidden">
            <div className="px-4 py-3 border-b border-[var(--border)]/50">
              <h2 className="font-heading text-xs font-semibold text-[var(--text-secondary)] tracking-widest uppercase">
                Scan Targets
              </h2>
            </div>
            <div className="divide-y divide-void-400/50">
              {scanTargets.length === 0 && (
                <div className="px-4 py-3 font-mono text-[10px] text-[var(--text-secondary)] tracking-wider">
                  NO TARGETS IN USE
                </div>
              )}
              {scanTargets.map((target) => (
                <div
                  key={target.type}
                  className="px-4 py-2.5 flex items-center gap-3 hover:bg-accent/10/20 transition-colors"
                >
                  <ScanTargetDot active={target.activeCount > 0} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs text-[var(--text-secondary)]">
                        {target.type}
                      </span>
                      <span
                        className={`font-mono text-[10px] tracking-wider uppercase ${
                          target.activeCount > 0
                            ? "text-[var(--success-text)]"
                            : "text-[var(--text-muted)]"
                        }`}
                      >
                        {target.activeCount > 0 ? "Active" : "Idle"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <span className="font-mono text-[9px] text-[var(--text-secondary)]">
                        {target.activeCount} active
                      </span>
                      <span className="font-mono text-[9px] tabular-nums text-[var(--text-muted)]">
                        {target.scanCount} scan{target.scanCount === 1 ? "" : "s"}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ---- QUEUE MANAGEMENT ---- */}
          <div className="admin-card overflow-hidden">
            <div className="px-4 py-3 border-b border-[var(--border)]/50">
              <h2 className="font-heading text-xs font-semibold text-[var(--text-secondary)] tracking-widest uppercase">
                Queue Management
              </h2>
            </div>
            <div className="p-4 space-y-3">
              {/* Queue depth */}
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] text-[var(--text-muted)] tracking-wider uppercase">
                  Queue Depth
                </span>
                <span className="font-mono text-sm text-[var(--low-text)] tabular-nums">
                  {queuedCount}
                </span>
              </div>

              {/* Running scans */}
              {/* REAL IMPL (BLACKFYRE 2026-06): show the real count of running
                  scans. The previous "Active Workers = runningCount * 3" was a
                  fabricated multiplier with no backing metric. */}
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] text-[var(--text-muted)] tracking-wider uppercase">
                  Running Scans
                </span>
                <span className="font-mono text-sm text-accent tabular-nums">
                  {runningCount}
                </span>
              </div>

              {/* Completed */}
              {/* REAL IMPL (BLACKFYRE 2026-06): the previous "Throughput = 4.2
                  scans/hr" was a hardcoded synthetic number. The API exposes no
                  throughput metric, so we surface the real completed count
                  instead of inventing a rate. */}
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] text-[var(--text-muted)] tracking-wider uppercase">
                  Completed
                </span>
                <span className="font-mono text-sm text-[var(--text-muted)] tabular-nums">
                  {completedCount}
                </span>
              </div>

              <div className="h-px bg-[var(--bg)]-400 my-1" />

              {/* action buttons */}
              <div className="space-y-2">
                <button
                  onClick={() => setConfirmFlush(true)}
                  disabled={queuedCount === 0}
                  className="w-full admin-btn text-[10px] tracking-wider bg-[var(--critical-bg)] text-[var(--critical-text)] border border-[var(--critical)]/30 hover:bg-[var(--critical)]/20 hover:border-[var(--critical)]/50 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                >
                  FLUSH QUEUE
                </button>
                <button
                  onClick={() => setConfirmCancelAll(true)}
                  disabled={runningCount === 0}
                  className="w-full admin-btn text-[10px] tracking-wider bg-[var(--medium-bg)] text-[var(--medium-text)] border border-[var(--medium)]/30 hover:bg-[var(--medium)]/20 hover:border-[var(--medium)]/50 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                >
                  CANCEL ALL RUNNING
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ---- MODALS ---- */}
      <LaunchScanModal
        open={showLaunchModal}
        onClose={() => setShowLaunchModal(false)}
        onLaunch={handleLaunch}
        clientOptions={clientOptions}
      />
      <ConfirmDialog
        open={confirmFlush}
        title="FLUSH QUEUE"
        message="This will remove all queued scans. Running scans will not be affected."
        confirmLabel="FLUSH"
        onConfirm={handleFlushQueue}
        onCancel={() => setConfirmFlush(false)}
      />
      <ConfirmDialog
        open={confirmCancelAll}
        title="CANCEL ALL RUNNING"
        message="This will immediately cancel all currently running scan operations."
        confirmLabel="CANCEL ALL"
        onConfirm={handleCancelRunning}
        onCancel={() => setConfirmCancelAll(false)}
      />
    </div>
  );
}
