"use client";

/**
 * ExportReportModal — kicks off a tamper-evident PDF export.
 *
 * REAL IMPL (BLACKFYRE 2026-06): always calls the real server `api.exportReport()`
 * (POST /api/admin/reports/export). The PDF bytes AND the SHA-256 fingerprint are
 * produced and signed server-side — the client never synthesizes a PDF or a hash.
 * Decodes the returned base64 and triggers a browser download; on success surfaces
 * the server's SHA-256 fingerprint and (if encrypted) the AES-256 password so the
 * operator can share it out-of-band.
 */
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import type {
  ExportReportRequest,
  ExportReportResponse,
  ExportReportType,
} from "@/lib/api";
import type { HaloTenant } from "@/lib/halo-data";

export interface ExportReportModalProps {
  open: boolean;
  onClose: () => void;
  tenants: HaloTenant[];
}

const REPORT_TYPES: Array<{
  value: ExportReportType;
  label: string;
  description: string;
}> = [
  {
    value: "tenant-health",
    label: "Tenant Health",
    description: "Posture score, findings by severity, evidence coverage.",
  },
  {
    value: "compliance-overview",
    label: "Compliance Overview",
    description: "Per-framework status across SOC2, ISO, HIPAA, GDPR.",
  },
  {
    value: "findings-rollup",
    label: "Findings Roll-up",
    description: "Top 20 open findings ranked by severity.",
  },
];

function defaultDateRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to.getTime() - 30 * 24 * 3600 * 1000);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

function base64ToBlob(base64: string, mime = "application/pdf"): Blob {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export default function ExportReportModal({
  open,
  onClose,
  tenants,
}: ExportReportModalProps): JSX.Element | null {
  const [tenantId, setTenantId] = useState<string>(tenants[0]?.id ?? "ALL");
  const [reportType, setReportType] = useState<ExportReportType>("tenant-health");
  const [range, setRange] = useState(defaultDateRange());
  const [encrypt, setEncrypt] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ExportReportResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setResult(null);
      setError(null);
      setSubmitting(false);
    }
  }, [open]);

  useEffect(() => {
    if (tenants[0]?.id && !tenantId) setTenantId(tenants[0].id);
  }, [tenants, tenantId]);

  const validEmail = useMemo(
    () => !encrypt || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail.trim()),
    [encrypt, recipientEmail],
  );

  if (!open) return null;

  const handleGenerate = async () => {
    setError(null);
    setSubmitting(true);

    try {
      // REAL IMPL (BLACKFYRE 2026-06): always POST to the real server
      // /api/admin/reports/export. The PDF bytes and the SHA-256 fingerprint are
      // produced and signed server-side — the client never synthesizes a PDF or a
      // fake hash. No DEMO_MODE branch exists; there is no client-side fabrication.
      const body: ExportReportRequest = {
        tenantId: tenantId === "ALL" ? tenants[0]?.id ?? "" : tenantId,
        reportType,
        dateRange: range,
        encrypt,
        recipientEmail: encrypt ? recipientEmail.trim() : undefined,
      };
      const exportFn = (api as unknown as {
        exportReport: (b: ExportReportRequest) => Promise<ExportReportResponse>;
      }).exportReport;
      const response: ExportReportResponse = await exportFn(body);

      const blob = base64ToBlob(response.pdfBase64);
      const sha8 = response.sha256.slice(0, 8);
      triggerDownload(blob, `blackfyre-${response.reportType}-${sha8}.pdf`);
      setResult(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate report");
    } finally {
      setSubmitting(false);
    }
  };

  const submitDisabled = submitting || !validEmail || !tenantId;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0, 0, 0, 0.65)",
        backdropFilter: "blur(6px)",
        zIndex: 60,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        animation: "exrm-fade 180ms ease",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="card"
        style={{
          width: "min(560px, 92vw)",
          maxHeight: "90vh",
          overflowY: "auto",
          padding: 0,
          background: "var(--bg-elevated)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          boxShadow: "0 24px 64px rgba(0,0,0,0.55)",
          animation: "exrm-rise 240ms var(--ease-spring, cubic-bezier(.2,.9,.3,1.1))",
        }}
      >
        <div
          style={{
            padding: "18px 22px 14px",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
          }}
        >
          <div>
            <div
              className="mono text-[10.5px] font-semibold"
              style={{
                color: "var(--text-muted)",
                letterSpacing: "0.14em",
                textTransform: "uppercase",
              }}
            >
              Export · Tamper-evident PDF
            </div>
            <h2
              className="text-[18px] font-semibold mt-1"
              style={{ color: "var(--text-primary)", letterSpacing: "-0.01em" }}
            >
              Generate report
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              background: "transparent",
              border: 0,
              color: "var(--text-muted)",
              cursor: "pointer",
              fontSize: 18,
              padding: 4,
            }}
          >
            ×
          </button>
        </div>

        {result ? (
          <div style={{ padding: 22, display: "flex", flexDirection: "column", gap: 14 }}>
            <div
              style={{
                padding: 14,
                border: "1px solid var(--accent)",
                background: "var(--accent-subtle)",
                borderRadius: 8,
                color: "var(--text-primary)",
              }}
            >
              <div
                className="mono text-[10px] font-semibold"
                style={{ color: "var(--accent)", letterSpacing: "0.16em" }}
              >
                DOWNLOAD STARTED
              </div>
              <div className="mt-1 text-[13px]">
                Tamper-evident PDF saved to your downloads folder.
              </div>
            </div>

            <div>
              <div
                className="mono text-[10.5px] font-semibold mb-1"
                style={{
                  color: "var(--text-muted)",
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                }}
              >
                SHA-256 fingerprint
              </div>
              <div
                className="mono text-[11px]"
                style={{
                  padding: 10,
                  background: "var(--bg)",
                  border: "1px solid var(--border)",
                  borderRadius: 6,
                  wordBreak: "break-all",
                  color: "var(--text-primary)",
                }}
              >
                {result.sha256}
              </div>
              <div
                className="mono text-[10px] mt-1"
                style={{ color: "var(--text-muted)" }}
              >
                Verifiable at /verify/{result.sha256.slice(0, 12)}…
              </div>
            </div>

            {result.encrypted && result.password && (
              <div>
                <div
                  className="mono text-[10.5px] font-semibold mb-1"
                  style={{
                    color: "var(--high-text)",
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                  }}
                >
                  AES-256 password — share out-of-band
                </div>
                <div
                  className="mono text-[12px]"
                  style={{
                    padding: 10,
                    background: "var(--bg)",
                    border: "1px solid var(--high)",
                    borderRadius: 6,
                    wordBreak: "break-all",
                    color: "var(--text-primary)",
                  }}
                >
                  {result.password}
                </div>
              </div>
            )}

            {result.warnings && result.warnings.length > 0 && (
              <div>
                <div
                  className="mono text-[10.5px] font-semibold mb-1"
                  style={{ color: "var(--text-muted)", letterSpacing: "0.12em" }}
                >
                  NOTES
                </div>
                <ul
                  className="text-[12px]"
                  style={{ color: "var(--text-secondary)", paddingLeft: 18 }}
                >
                  {result.warnings.map((w, i) => (
                    <li key={i} style={{ marginTop: 2 }}>
                      {w}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button className="btn btn-secondary" onClick={() => setResult(null)}>
                Generate another
              </button>
              <button className="btn btn-primary" onClick={onClose}>
                Done
              </button>
            </div>
          </div>
        ) : (
          <div style={{ padding: 22, display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Tenant */}
            <div>
              <label
                className="mono text-[10.5px] font-semibold block mb-1.5"
                style={{
                  color: "var(--text-muted)",
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                }}
              >
                Tenant
              </label>
              <select
                value={tenantId}
                onChange={(e) => setTenantId(e.target.value)}
                className="w-full"
                style={{
                  background: "var(--bg)",
                  border: "1px solid var(--border)",
                  borderRadius: 6,
                  padding: "10px 12px",
                  color: "var(--text-primary)",
                  fontSize: 13,
                }}
              >
                <option value="ALL">All tenants (aggregate)</option>
                {tenants.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Report type */}
            <div>
              <div
                className="mono text-[10.5px] font-semibold mb-1.5"
                style={{
                  color: "var(--text-muted)",
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                }}
              >
                Report type
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {REPORT_TYPES.map((r) => {
                  const selected = reportType === r.value;
                  return (
                    <button
                      key={r.value}
                      onClick={() => setReportType(r.value)}
                      type="button"
                      style={{
                        textAlign: "left",
                        padding: "10px 14px",
                        borderRadius: 6,
                        border: `1px solid ${
                          selected ? "var(--accent)" : "var(--border)"
                        }`,
                        background: selected
                          ? "var(--accent-subtle)"
                          : "var(--bg)",
                        cursor: "pointer",
                        transition: "all 120ms ease",
                      }}
                    >
                      <div
                        className="text-[13px] font-semibold"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {r.label}
                      </div>
                      <div
                        className="text-[11.5px] mt-0.5"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {r.description}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Date range */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label
                  className="mono text-[10.5px] font-semibold block mb-1.5"
                  style={{
                    color: "var(--text-muted)",
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                  }}
                >
                  From
                </label>
                <input
                  type="date"
                  value={range.from}
                  onChange={(e) => setRange((p) => ({ ...p, from: e.target.value }))}
                  style={{
                    width: "100%",
                    background: "var(--bg)",
                    border: "1px solid var(--border)",
                    borderRadius: 6,
                    padding: "10px 12px",
                    color: "var(--text-primary)",
                    fontSize: 12.5,
                  }}
                />
              </div>
              <div>
                <label
                  className="mono text-[10.5px] font-semibold block mb-1.5"
                  style={{
                    color: "var(--text-muted)",
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                  }}
                >
                  To
                </label>
                <input
                  type="date"
                  value={range.to}
                  onChange={(e) => setRange((p) => ({ ...p, to: e.target.value }))}
                  style={{
                    width: "100%",
                    background: "var(--bg)",
                    border: "1px solid var(--border)",
                    borderRadius: 6,
                    padding: "10px 12px",
                    color: "var(--text-primary)",
                    fontSize: 12.5,
                  }}
                />
              </div>
            </div>

            {/* Encrypt */}
            <div
              style={{
                padding: 12,
                border: "1px solid var(--border)",
                borderRadius: 6,
                background: "var(--bg)",
              }}
            >
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  cursor: "pointer",
                  color: "var(--text-primary)",
                  fontSize: 13,
                }}
              >
                <input
                  type="checkbox"
                  checked={encrypt}
                  onChange={(e) => setEncrypt(e.target.checked)}
                  style={{ width: 16, height: 16, accentColor: "var(--accent)" }}
                />
                <span>Encrypt for a specific recipient</span>
              </label>
              {encrypt && (
                <div style={{ marginTop: 10 }}>
                  <input
                    type="email"
                    placeholder="auditor@yourcompany.com"
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                    style={{
                      width: "100%",
                      background: "var(--bg-elevated)",
                      border: `1px solid ${
                        validEmail ? "var(--border)" : "var(--critical)"
                      }`,
                      borderRadius: 6,
                      padding: "10px 12px",
                      color: "var(--text-primary)",
                      fontSize: 12.5,
                    }}
                  />
                  <div
                    className="mono text-[10px] mt-1"
                    style={{ color: "var(--text-muted)" }}
                  >
                    AES-256. Password derived from recipient email + server salt.
                  </div>
                </div>
              )}
            </div>

            {error && (
              <div
                style={{
                  padding: 10,
                  border: "1px solid var(--critical)",
                  background: "var(--critical-bg)",
                  borderRadius: 6,
                  color: "var(--critical-text)",
                  fontSize: 12.5,
                }}
              >
                {error}
              </div>
            )}

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 8,
                paddingTop: 4,
              }}
            >
              <button
                className="btn btn-secondary"
                onClick={onClose}
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleGenerate}
                disabled={submitDisabled}
              >
                {submitting ? "Generating…" : "Generate & download"}
              </button>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes exrm-fade {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes exrm-rise {
          from { opacity: 0; transform: translateY(8px) scale(0.98); }
          to   { opacity: 1; transform: none; }
        }
      `}</style>
    </div>
  );
}
