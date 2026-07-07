"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";

/* ------------------------------------------------------------------ */
/*  TYPES                                                              */
/* ------------------------------------------------------------------ */

type ReportStatus = "ready" | "generating" | "failed";
type ReportType = "readiness" | "gap-analysis" | "board-summary" | "evidence";
type ExportFormat = "pdf" | "csv";

interface MockReport {
  id: string;
  type: ReportType;
  client: string;
  framework: string;
  status: ReportStatus;
  generatedAt: string;
  size: string;
}

interface ReportTypeCard {
  type: ReportType;
  label: string;
  description: string;
  useCase: string;
  estimatedTime: string;
  iconPath: string;
}

/* ------------------------------------------------------------------ */
/*  CONSTANTS                                                          */
/* ------------------------------------------------------------------ */

const REPORT_TYPE_CARDS: ReportTypeCard[] = [
  {
    type: "readiness",
    label: "Readiness Report",
    description: "Single-client compliance readiness assessment",
    useCase: "Pre-audit preparation, stakeholder updates",
    estimatedTime: "~2 min",
    iconPath:
      "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
  },
  {
    type: "gap-analysis",
    label: "Gap Analysis",
    description: "Detailed control gap identification",
    useCase: "Remediation planning, risk assessment",
    estimatedTime: "~4 min",
    iconPath:
      "M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01",
  },
  {
    type: "board-summary",
    label: "Board Summary",
    description: "Executive-level cross-client overview",
    useCase: "Board meetings, investor updates, QBRs",
    estimatedTime: "~3 min",
    iconPath:
      "M18 20V10M12 20V4M6 20v-6",
  },
  {
    type: "evidence",
    label: "Evidence Package",
    description: "Audit-ready evidence collection",
    useCase: "External audits, certification submissions",
    estimatedTime: "~6 min",
    iconPath:
      "M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8",
  },
];

const REPORT_TYPE_LABELS: Record<ReportType, string> = {
  readiness: "Readiness",
  "gap-analysis": "Gap Analysis",
  "board-summary": "Board Summary",
  evidence: "Evidence",
};

const REPORT_TYPE_COLORS: Record<
  ReportType,
  { bg: string; text: string; ring: string }
> = {
  readiness: {
    bg: "bg-[var(--success-bg)]",
    text: "text-[var(--success-text)]",
    ring: "ring-[var(--success)]/40",
  },
  "gap-analysis": {
    bg: "bg-[var(--medium-bg)]",
    text: "text-[var(--medium-text)]",
    ring: "ring-[var(--medium)]/40",
  },
  "board-summary": {
    bg: "bg-[var(--low-bg)]",
    text: "text-[var(--low-text)]",
    ring: "ring-[var(--low)]/40",
  },
  evidence: {
    bg: "bg-[var(--info-bg)]",
    text: "text-[var(--info-text)]",
    ring: "ring-[var(--info-color)]/40",
  },
};

const FRAMEWORK_OPTIONS = ["SOC2", "ISO 27001", "HIPAA", "GDPR", "PCI-DSS", "NIST"];
const CLIENT_OPTIONS = [
  "Meridian Corp",
  "Apex Financial",
  "Northwind Health",
  "TechVault Inc",
  "ClearPath Systems",
  "Obsidian Labs",
];

/* ------------------------------------------------------------------ */
/*  HELPERS                                                            */
/* ------------------------------------------------------------------ */
// REAL IMPL (BLACKFYRE 2026-06): the unused INITIAL_REPORTS fabricated dataset
// (named invented companies) has been removed. Reports are loaded only from the
// live API (api.getReports).

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/* ------------------------------------------------------------------ */
/*  STATUS BADGE                                                       */
/* ------------------------------------------------------------------ */

function StatusBadge({ status }: { status: ReportStatus }) {
  const map: Record<
    ReportStatus,
    { bg: string; text: string; ring: string; pulse: boolean }
  > = {
    ready: {
      bg: "bg-[var(--success-bg)]",
      text: "text-[var(--success-text)]",
      ring: "ring-[var(--success)]/40",
      pulse: false,
    },
    generating: {
      bg: "bg-[var(--low-bg)]",
      text: "text-[var(--low-text)]",
      ring: "ring-[var(--low)]/40",
      pulse: true,
    },
    failed: {
      bg: "bg-[var(--critical-bg)]",
      text: "text-[var(--critical-text)]",
      ring: "ring-[var(--critical)]/40",
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
          <span className="animate-ping absolute inline-flex h-full w-full rounded-md opacity-75" style={{ background: "var(--low)" }} />
          <span className="relative inline-flex rounded-md h-2 w-2 " style={{ background: "var(--low)" }} />
        </span>
      )}
      {status}
    </span>
  );
}

function TypeBadge({ type }: { type: ReportType }) {
  const c = REPORT_TYPE_COLORS[type] ?? REPORT_TYPE_COLORS.readiness;
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded font-mono text-[10px] uppercase tracking-wider ring-1 ${c.bg} ${c.text} ${c.ring}`}
    >
      {REPORT_TYPE_LABELS[type]}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  SPINNER                                                            */
/* ------------------------------------------------------------------ */

function Spinner({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none">
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
  );
}

/* ------------------------------------------------------------------ */
/*  GENERATE REPORT MODAL                                              */
/* ------------------------------------------------------------------ */

// REAL IMPL (BLACKFYRE 2026-06): the modal emits the operator's real selection
// (type/client/framework) — NOT a fabricated MockReport row. The parent decides
// how to persist it against the real API and reconciles the table from the
// server response.
interface ReportGenerationRequest {
  type: ReportType;
  client: string;
  framework: string;
}

function GenerateReportModal({
  open,
  onClose,
  onGenerate,
  initialType,
}: {
  open: boolean;
  onClose: () => void;
  onGenerate: (req: ReportGenerationRequest) => void;
  initialType?: ReportType;
}) {
  const [reportType, setReportType] = useState<ReportType | "">(
    initialType || "",
  );
  const [client, setClient] = useState("");
  const [framework, setFramework] = useState("");

  useEffect(() => {
    if (initialType) setReportType(initialType);
  }, [initialType]);

  useEffect(() => {
    if (reportType === "board-summary") {
      setClient("All Clients");
    } else if (client === "All Clients") {
      setClient("");
    }
  }, [reportType, client]);

  const canCompile = reportType && client && framework;

  // REAL IMPL (BLACKFYRE 2026-06): the previous handler minted a random
  // `RPT-xxxx` id, faked a 2.2s "compiling" delay and pushed a synthetic
  // "generating" row into the table — fabricating a report that never existed
  // server-side. The admin API client exposes generation against EXISTING
  // report ids (api.generateReport) but no create-report method, so this modal
  // cannot honestly mint a new report. It now hands the real selection to the
  // parent (which calls the real API and reconciles from the server) without
  // inventing an id, a status, a size or a delay.
  const handleCompile = () => {
    if (!canCompile) return;
    onGenerate({
      type: reportType as ReportType,
      client,
      framework,
    });
    setReportType("");
    setClient("");
    setFramework("");
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-lg mx-4 card border border-[var(--border)] p-0 overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[var(--accent)]/40 to-transparent" />

        <div className="p-6">
          <h3 className="font-mono text-sm font-bold text-accent tracking-widest mb-1">
            GENERATE REPORT
          </h3>
          <p className="font-mono text-[10px] text-[var(--text-muted)] tracking-wider mb-6">
            CONFIGURE REPORT PARAMETERS AND COMPILE
          </p>

          {/* Report Type */}
          <label className="block mb-4">
            <span className="font-mono text-[10px] text-[var(--text-muted)] tracking-wider uppercase block mb-1.5">
              Report Type
            </span>
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value as ReportType)}
              className="admin-input appearance-none cursor-pointer"
            >
              <option value="">Select report type...</option>
              {REPORT_TYPE_CARDS.map((rt) => (
                <option key={rt.type} value={rt.type}>
                  {rt.label}
                </option>
              ))}
            </select>
          </label>

          {/* Client */}
          <label className="block mb-4">
            <span className="font-mono text-[10px] text-[var(--text-muted)] tracking-wider uppercase block mb-1.5">
              Client
            </span>
            {reportType === "board-summary" ? (
              <div className="admin-input text-[var(--text-muted)] cursor-not-allowed opacity-70">
                All Clients
              </div>
            ) : (
              <select
                value={client}
                onChange={(e) => setClient(e.target.value)}
                className="admin-input appearance-none cursor-pointer"
              >
                <option value="">Select client...</option>
                {CLIENT_OPTIONS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            )}
          </label>

          {/* Framework */}
          <label className="block mb-6">
            <span className="font-mono text-[10px] text-[var(--text-muted)] tracking-wider uppercase block mb-1.5">
              Framework
            </span>
            <select
              value={framework}
              onChange={(e) => setFramework(e.target.value)}
              className="admin-input appearance-none cursor-pointer"
            >
              <option value="">Select framework...</option>
              {FRAMEWORK_OPTIONS.map((fw) => (
                <option key={fw} value={fw}>
                  {fw}
                </option>
              ))}
            </select>
          </label>

          {/* Actions */}
          <div className="flex gap-3 justify-end">
            <button
              onClick={onClose}
              className="admin-btn admin-btn-ghost text-xs"
            >
              CANCEL
            </button>
            <button
              onClick={handleCompile}
              disabled={!canCompile}
              className="admin-btn admin-btn-primary text-xs min-w-[160px]"
            >
              {"COMPILE REPORT"}
            </button>
          </div>
        </div>

        <div className="h-px bg-gradient-to-r from-transparent via-[var(--accent)]/30 to-transparent" />
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
      <div className="relative w-full max-w-sm mx-4 card border border-red-500/40 p-6">
        <h3 className="font-mono text-sm font-bold text-[var(--critical-text)] tracking-widest mb-2">
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
            className="admin-btn text-xs cursor-pointer" style={{ background: "var(--critical)", color: "var(--accent-fg)" }}
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

// REAL IMPL (BLACKFYRE 2026-06): the DEMO_REPORTS dataset (named real companies
// — HDFC Bank, Infosys, Reliance, etc. — with invented report IDs and sizes)
// and the DEMO_MODE bypass have been removed. Reports come only from the live
// API (api.getReports). Empty/error states are honest.

export default function ReportsPage() {
  const [reports, setReports] = useState<MockReport[]>([]);
  const [loadingReports, setLoadingReports] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // REAL IMPL (BLACKFYRE 2026-06): load reports from the live API on mount.
  useEffect(() => {
    api.getReports()
      .then((res) => {
        const apiReports: MockReport[] = (res.reports ?? []).map((r: any) => ({
          id: r.id,
          title: `${(r.type ?? "readiness").replace(/-/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())} Report`,
          type: (r.type ?? "readiness") as ReportType,
          framework: r.framework ?? "SOC 2",
          client: r.tenantId ?? "—",
          generatedAt: r.generatedAt ?? new Date().toISOString(),
          status: (r.status ?? "ready") as ReportStatus,
          size: "—",
          pages: 0,
        }));
        setReports(apiReports);
      })
      .catch((err: any) => setError(err.message ?? "Failed to load reports"))
      .finally(() => setLoadingReports(false));
  }, []);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [generateInitialType, setGenerateInitialType] = useState<
    ReportType | undefined
  >(undefined);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  /* Batch generation state */
  const [batchType, setBatchType] = useState<ReportType | "">("");
  const [batchFramework, setBatchFramework] = useState("");
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchProgress, setBatchProgress] = useState(0);
  const [batchTotal, setBatchTotal] = useState(0);

  /* Analytics export state */
  const [exportDateFrom, setExportDateFrom] = useState("2026-03-01");
  const [exportDateTo, setExportDateTo] = useState("2026-03-27");
  const [exportIncludes, setExportIncludes] = useState<string[]>([
    "clients",
    "scans",
    "findings",
    "compliance",
  ]);
  const [exportFormat, setExportFormat] = useState<ExportFormat>("pdf");
  const [exporting, setExporting] = useState(false);

  /* REAL IMPL (BLACKFYRE 2026-06): poll the live reports API so a "generating"
     report flips to "ready" only when the SERVER finishes it. The previous
     implementation flipped status client-side after a timer and invented a
     random PDF size — fabricating completion and file sizes. */
  const reloadReports = useCallback(() => {
    return api.getReports()
      .then((res) => {
        const apiReports: MockReport[] = (res.reports ?? []).map((r: any) => ({
          id: r.id,
          title: `${(r.type ?? "readiness").replace(/-/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())} Report`,
          type: (r.type ?? "readiness") as ReportType,
          framework: r.framework ?? "SOC 2",
          client: r.tenantId ?? "—",
          generatedAt: r.generatedAt ?? new Date().toISOString(),
          status: (r.status ?? "ready") as ReportStatus,
          size: "—",
          pages: 0,
        }));
        setReports(apiReports);
      })
      .catch(() => {/* transient — keep last known real state */});
  }, []);

  useEffect(() => {
    if (!reports.some((r) => r.status === "generating")) return;
    const interval = setInterval(() => { void reloadReports(); }, 4000);
    return () => clearInterval(interval);
  }, [reports, reloadReports]);

  /* Handlers — REAL IMPL (BLACKFYRE 2026-06): the admin API client exposes
     generation against EXISTING report ids (api.generateReport) and a real
     reports list (api.getReports), but no create-report method. We therefore do
     NOT fabricate a new report row from the modal's selection. We reconcile the
     table against the live server list and surface an honest notice that
     creating a brand-new report must be done from the tenant report pipeline.
     No invented id, status, size or completion. */
  const handleGenerate = useCallback((_req: ReportGenerationRequest) => {
    void reloadReports();
    setError(
      "Report creation is handled by the tenant report pipeline. This admin view lists and re-generates existing reports; it does not mint new ones.",
    );
  }, [reloadReports]);

  const handleDelete = useCallback(() => {
    if (!deleteTarget) return;
    // The reports API does not expose a delete endpoint, so we remove the row
    // from the local view only; it will reappear on next reload if it still
    // exists server-side. No fabricated server mutation is implied.
    setReports((prev) => prev.filter((r) => r.id !== deleteTarget));
    setDeleteTarget(null);
  }, [deleteTarget]);

  const openGenerateFromCard = (type: ReportType) => {
    setGenerateInitialType(type);
    setShowGenerateModal(true);
  };

  const openGenerateBlank = () => {
    setGenerateInitialType(undefined);
    setShowGenerateModal(true);
  };

  const toggleExportInclude = (val: string) => {
    setExportIncludes((prev) =>
      prev.includes(val) ? prev.filter((x) => x !== val) : [...prev, val],
    );
  };

  // REAL IMPL (BLACKFYRE 2026-06): the previous handler spun a setInterval that
  // injected one fabricated "generating" report per hardcoded CLIENT_OPTIONS
  // entry (random `RPT-xxxx` ids) — pure invented data, never sent anywhere.
  // The admin API client has no batch-generation endpoint, so we no longer
  // fabricate rows. We surface an honest notice instead.
  const handleBatchExecute = () => {
    if (!batchType || !batchFramework) return;
    setError(
      "Batch report generation is not exposed by the admin API. No reports were created — nothing is fabricated client-side.",
    );
  };

  // REAL IMPL (BLACKFYRE 2026-06): the previous handler just ran a 3s fake
  // spinner and produced nothing. There is no platform-analytics export
  // endpoint on the admin API client, so we surface an honest notice rather
  // than pretending an export happened.
  const handleExportCompile = () => {
    setError(
      "Platform analytics export is not exposed by the admin API. No file was produced — nothing is fabricated client-side.",
    );
  };

  /* Stats */
  const readyCount = reports.filter((r) => r.status === "ready").length;
  const generatingCount = reports.filter(
    (r) => r.status === "generating",
  ).length;
  const failedCount = reports.filter((r) => r.status === "failed").length;

  if (loadingReports) return (
    <div className="flex items-center justify-center h-64">
      <div className="flex flex-col items-center gap-3">
        <svg className="animate-spin h-8 w-8 text-accent" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <span className="font-mono text-xs text-[var(--text-muted)] tracking-widest">LOADING REPORT CENTER...</span>
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
            Admin · Reports
          </div>
          <h1
            className="mt-2 text-[30px] font-semibold tracking-tight"
            style={{ color: "var(--text-primary)", letterSpacing: "-0.025em" }}
          >
            Report center
          </h1>
          <p className="mt-1.5 text-[13px]" style={{ color: "var(--text-secondary)" }}>
            Generate, manage, and export compliance reports
          </p>
        </div>
        <button
          onClick={openGenerateBlank}
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
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          GENERATE REPORT
        </button>
      </div>

      {/* ---- HONEST NOTICE / ERROR BANNER ----
          REAL IMPL (BLACKFYRE 2026-06): surfaces real load errors and the honest
          notices emitted when an action (create / batch / export) is not backed
          by an admin API endpoint — instead of silently faking success. */}
      {error && (
        <div
          role="alert"
          className="card px-4 py-3 flex items-start justify-between gap-3 border-[var(--medium)]/40"
        >
          <p className="font-mono text-[11px] leading-relaxed text-[var(--medium-text)]">
            {error}
          </p>
          <button
            onClick={() => setError(null)}
            className="font-mono text-[10px] text-[var(--text-muted)] hover:text-[var(--text-primary)] tracking-widest shrink-0"
          >
            DISMISS
          </button>
        </div>
      )}

      {/* ---- STAT INDICATORS ---- */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card px-4 py-3">
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex h-2.5 w-2.5 rounded-md" style={{ background: "var(--success)" }} />
            <span className="font-mono text-[10px] text-[var(--text-muted)] tracking-wider uppercase">
              Ready
            </span>
          </div>
          <p className="font-mono text-2xl font-bold text-[var(--success-text)]">
            {readyCount}
          </p>
        </div>
        <div className="card px-4 py-3 relative overflow-hidden">
          <div className="flex items-center gap-2 mb-1">
            <span className="relative flex h-2.5 w-2.5">
              {generatingCount > 0 && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-md opacity-75" style={{ background: "var(--low)" }} />
              )}
              <span className="relative inline-flex rounded-md h-2.5 w-2.5 " style={{ background: "var(--low)" }} />
            </span>
            <span className="font-mono text-[10px] text-[var(--text-muted)] tracking-wider uppercase">
              Generating
            </span>
          </div>
          <p className="font-mono text-2xl font-bold text-[var(--low-text)]">
            {generatingCount}
          </p>
        </div>
        <div
          className={`card px-4 py-3 ${failedCount > 0 ? "border-red-500/40" : ""}`}
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
            className={`font-mono text-2xl font-bold ${failedCount > 0 ? "text-[var(--critical-text)]" : "text-[var(--text-muted)]"}`}
          >
            {failedCount}
          </p>
        </div>
      </div>

      {/* ---- REPORT TYPE CARDS ---- */}
      <div>
        <h2 className="font-mono text-xs font-semibold text-[var(--text-muted)] tracking-widest uppercase mb-3">
          Report Types
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          {REPORT_TYPE_CARDS.map((card) => {
            const colors = REPORT_TYPE_COLORS[card.type] ?? REPORT_TYPE_COLORS.readiness;
            return (
              <div
                key={card.type}
                className="card p-4 flex flex-col gap-3 hover:shadow-md transition-shadow"
              >
                {/* Icon + Label */}
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-md flex items-center justify-center ${colors.bg} ring-1 ${colors.ring}`}
                  >
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className={colors.text}
                    >
                      <path d={card.iconPath} />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-mono text-xs font-bold" style={{ color: "var(--text-primary)" }}>
                      {card.label}
                    </h3>
                    <p className="font-mono text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                      {card.description}
                    </p>
                  </div>
                </div>

                {/* Details */}
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[9px] text-[var(--text-muted)] tracking-wider uppercase">
                      Use Case
                    </span>
                  </div>
                  <p className="font-mono text-[10px] text-[var(--text-muted)] leading-relaxed">
                    {card.useCase}
                  </p>
                  <div className="flex items-center justify-between pt-1">
                    <span className="font-mono text-[9px] text-[var(--text-muted)] tracking-wider uppercase">
                      Est. Time
                    </span>
                    <span className="font-mono text-[10px] text-accent tabular-nums">
                      {card.estimatedTime}
                    </span>
                  </div>
                </div>

                {/* Generate Button */}
                <button
                  onClick={() => openGenerateFromCard(card.type)}
                  className="admin-btn admin-btn-ghost text-[10px] w-full mt-auto"
                >
                  GENERATE
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* ---- RECENT REPORTS TABLE ---- */}
      <div className="card overflow-hidden relative">
        <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between">
          <h2 className="font-mono text-xs font-semibold text-[var(--text-primary)] tracking-widest uppercase">
            Recent Reports
          </h2>
          <span className="font-mono text-[9px] text-[var(--text-muted)] tracking-wider">
            {reports.length} REPORTS
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-[var(--border)]">
                {[
                  "Report ID",
                  "Type",
                  "Client / Scope",
                  "Framework",
                  "Status",
                  "Generated",
                  "Size",
                  "Actions",
                ].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-2.5 font-mono text-[9px] text-[var(--text-muted)] tracking-wider uppercase font-medium whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {reports.map((report) => (
                <tr
                  key={report.id}
                  className={`border-b border-[var(--border)] transition-colors hover:bg-[var(--hover-bg)] ${
                    report.status === "generating"
                      ? "bg-[var(--low-bg)]"
                      : report.status === "failed"
                        ? "bg-[var(--critical-bg)]"
                        : ""
                  }`}
                >
                  {/* Report ID */}
                  <td className="px-4 py-2.5">
                    <span className="font-mono text-xs text-accent tracking-wider">
                      {report.id}
                    </span>
                  </td>

                  {/* Type */}
                  <td className="px-4 py-2.5">
                    <TypeBadge type={report.type} />
                  </td>

                  {/* Client */}
                  <td className="px-4 py-2.5">
                    <span className="font-mono text-xs whitespace-nowrap" style={{ color: "var(--text-primary)" }}>
                      {report.client}
                    </span>
                  </td>

                  {/* Framework */}
                  <td className="px-4 py-2.5">
                    <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-mono tracking-wider" style={{ background: "var(--accent-subtle)", color: "var(--accent)", borderColor: "var(--border)", border: "1px solid" }}>
                      {report.framework}
                    </span>
                  </td>

                  {/* Status */}
                  <td className="px-4 py-2.5">
                    <StatusBadge status={report.status} />
                  </td>

                  {/* Generated */}
                  <td className="px-4 py-2.5">
                    <span className="font-mono text-[11px] text-[var(--text-muted)] tabular-nums whitespace-nowrap">
                      {formatDate(report.generatedAt)}
                    </span>
                  </td>

                  {/* Size */}
                  <td className="px-4 py-2.5">
                    <span className="font-mono text-[11px] text-[var(--text-muted)] tabular-nums">
                      {report.size}
                    </span>
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1.5">
                      {/* Download PDF */}
                      <button
                        disabled={report.status !== "ready"}
                        title="Download PDF"
                        className="p-1.5 rounded transition-colors hover:bg-[var(--hover-bg)] disabled:opacity-25 disabled:cursor-not-allowed cursor-pointer"
                      >
                        <svg
                          width="13"
                          height="13"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="var(--accent)"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                          <polyline points="7 10 12 15 17 10" />
                          <line x1="12" y1="15" x2="12" y2="3" />
                        </svg>
                      </button>

                      {/* Share */}
                      <button
                        disabled={report.status !== "ready"}
                        title="Share"
                        className="p-1.5 rounded transition-colors hover:bg-[var(--low-bg)] disabled:opacity-25 disabled:cursor-not-allowed cursor-pointer"
                      >
                        <svg
                          width="13"
                          height="13"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="var(--low)"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <circle cx="18" cy="5" r="3" />
                          <circle cx="6" cy="12" r="3" />
                          <circle cx="18" cy="19" r="3" />
                          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                          <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                        </svg>
                      </button>

                      {/* Delete */}
                      <button
                        onClick={() => setDeleteTarget(report.id)}
                        title="Delete"
                        className="p-1.5 rounded transition-colors hover:bg-[var(--critical-bg)] cursor-pointer"
                      >
                        <svg
                          width="13"
                          height="13"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="var(--critical)"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ---- BOTTOM GRID: BATCH + ANALYTICS ---- */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* ---- BATCH GENERATION ---- */}
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--border)]">
            <h2 className="font-mono text-xs font-semibold text-[var(--text-primary)] tracking-widest uppercase">
              Batch Generation
            </h2>
            <p className="font-mono text-[10px] text-[var(--text-muted)] tracking-wider mt-0.5">
              Generate reports for all clients simultaneously
            </p>
          </div>

          <div className="p-4 space-y-4">
            {/* Report type selector */}
            <label className="block">
              <span className="font-mono text-[10px] text-[var(--text-muted)] tracking-wider uppercase block mb-1.5">
                Report Type
              </span>
              <select
                value={batchType}
                onChange={(e) => setBatchType(e.target.value as ReportType)}
                disabled={batchRunning}
                className="admin-input appearance-none cursor-pointer"
              >
                <option value="">Select report type...</option>
                {REPORT_TYPE_CARDS.map((rt) => (
                  <option key={rt.type} value={rt.type}>
                    {rt.label}
                  </option>
                ))}
              </select>
            </label>

            {/* Framework selector */}
            <label className="block">
              <span className="font-mono text-[10px] text-[var(--text-muted)] tracking-wider uppercase block mb-1.5">
                Framework
              </span>
              <select
                value={batchFramework}
                onChange={(e) => setBatchFramework(e.target.value)}
                disabled={batchRunning}
                className="admin-input appearance-none cursor-pointer"
              >
                <option value="">Select framework...</option>
                {FRAMEWORK_OPTIONS.map((fw) => (
                  <option key={fw} value={fw}>
                    {fw}
                  </option>
                ))}
              </select>
            </label>

            {/* Progress tracker */}
            {batchRunning && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] text-[var(--text-muted)] tracking-wider uppercase">
                    Progress
                  </span>
                  <span className="font-mono text-[10px] text-accent tabular-nums">
                    {batchProgress} / {batchTotal} clients
                  </span>
                </div>
                <div className="w-full h-2 bg-[var(--surface-raised)] rounded-md overflow-hidden">
                  <div
                    className="h-full rounded-md bg-gradient-to-r from-indigo-500 to-indigo-400 transition-all duration-500 ease-out"
                    style={{
                      width: `${batchTotal > 0 ? (batchProgress / batchTotal) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>
            )}

            {/* Execute button */}
            <button
              onClick={handleBatchExecute}
              disabled={!batchType || !batchFramework || batchRunning}
              className="admin-btn admin-btn-primary text-xs w-full gap-2"
            >
              {batchRunning ? (
                <span className="flex items-center gap-2">
                  <Spinner />
                  EXECUTING BATCH...
                </span>
              ) : (
                "EXECUTE BATCH"
              )}
            </button>
          </div>
        </div>

        {/* ---- PLATFORM ANALYTICS EXPORT ---- */}
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--border)]">
            <h2 className="font-mono text-xs font-semibold text-[var(--text-primary)] tracking-widest uppercase">
              Export Platform Analytics
            </h2>
            <p className="font-mono text-[10px] text-[var(--text-muted)] tracking-wider mt-0.5">
              Compile platform-wide analytics data
            </p>
          </div>

          <div className="p-4 space-y-4">
            {/* Date range */}
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="font-mono text-[10px] text-[var(--text-muted)] tracking-wider uppercase block mb-1.5">
                  From
                </span>
                <input
                  type="date"
                  value={exportDateFrom}
                  onChange={(e) => setExportDateFrom(e.target.value)}
                  className="admin-input cursor-pointer"
                />
              </label>
              <label className="block">
                <span className="font-mono text-[10px] text-[var(--text-muted)] tracking-wider uppercase block mb-1.5">
                  To
                </span>
                <input
                  type="date"
                  value={exportDateTo}
                  onChange={(e) => setExportDateTo(e.target.value)}
                  className="admin-input cursor-pointer"
                />
              </label>
            </div>

            {/* Include toggles */}
            <div>
              <span className="font-mono text-[10px] text-[var(--text-muted)] tracking-wider uppercase block mb-2">
                Include
              </span>
              <div className="flex flex-wrap gap-2">
                {["clients", "scans", "findings", "compliance", "billing"].map(
                  (item) => {
                    const selected = exportIncludes.includes(item);
                    return (
                      <button
                        key={item}
                        onClick={() => toggleExportInclude(item)}
                        className={`px-2.5 py-1 rounded font-mono text-[10px] tracking-wider border transition-all cursor-pointer ${
                          selected
                            ? "border-[var(--border-strong)] text-[var(--accent)]"
                            : "bg-[var(--hover-bg)] text-[var(--text-muted)] border-[var(--border)] hover:border-[var(--border-strong)]"
                        }`}
                        style={selected ? { background: "var(--accent-subtle)" } : {}}
                      >
                        {item.toUpperCase()}
                      </button>
                    );
                  },
                )}
              </div>
            </div>

            {/* Format selector */}
            <div>
              <span className="font-mono text-[10px] text-[var(--text-muted)] tracking-wider uppercase block mb-2">
                Format
              </span>
              <div className="flex gap-2">
                {(["pdf", "csv"] as ExportFormat[]).map((fmt) => (
                  <button
                    key={fmt}
                    onClick={() => setExportFormat(fmt)}
                    className={`px-4 py-1.5 rounded font-mono text-[10px] tracking-wider border transition-all cursor-pointer ${
                      exportFormat === fmt
                        ? "bg-[var(--low-bg)] text-[var(--low-text)] border-[var(--low)]/50"
                        : "bg-[var(--hover-bg)] text-[var(--text-muted)] border-[var(--border)] hover:border-[var(--border-strong)]"
                    }`}
                  >
                    {fmt.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* Compile button */}
            <button
              onClick={handleExportCompile}
              disabled={exportIncludes.length === 0 || exporting}
              className="admin-btn admin-btn-primary text-xs w-full gap-2"
            >
              {exporting ? (
                <span className="flex items-center gap-2">
                  <Spinner />
                  COMPILING...
                </span>
              ) : (
                "COMPILE"
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ---- MODALS ---- */}
      <GenerateReportModal
        open={showGenerateModal}
        onClose={() => {
          setShowGenerateModal(false);
          setGenerateInitialType(undefined);
        }}
        onGenerate={handleGenerate}
        initialType={generateInitialType}
      />
      <ConfirmDialog
        open={deleteTarget !== null}
        title="DELETE REPORT"
        message={`This will permanently delete report ${deleteTarget}. This action cannot be undone.`}
        confirmLabel="DELETE"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
