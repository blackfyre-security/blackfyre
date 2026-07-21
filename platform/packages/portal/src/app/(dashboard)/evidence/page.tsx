"use client";

import { useState, useEffect, useRef } from "react";
import { api } from "@/lib/api";
import type { EvidenceArtifact, EvidenceType } from "@/lib/api";
import { LoadingSpinner } from "@blackfyre/ui";

const FRAMEWORKS = [
  { value: "soc2", label: "SOC 2" },
  { value: "iso27001", label: "ISO 27001" },
  { value: "hipaa", label: "HIPAA" },
  { value: "gdpr", label: "GDPR" },
  { value: "pcidss", label: "PCI DSS" },
  { value: "dpdpa", label: "DPDPA" },
  { value: "nist80053", label: "NIST 800-53" },
  { value: "iso42001", label: "ISO 42001" },
];

const CONTROLS: Record<string, { id: string; name: string }[]> = {
  soc2: [
    { id: "CC1.1", name: "COSO Principle 1" },
    { id: "CC2.1", name: "Board Oversight" },
    { id: "CC6.1", name: "Logical Access" },
    { id: "CC6.2", name: "Prior to Issuing System Credentials" },
    { id: "CC7.1", name: "System Boundaries" },
    { id: "CC7.2", name: "Monitor System Components" },
    { id: "CC9.1", name: "Risk Mitigation" },
  ],
  iso27001: [
    { id: "A.5.1", name: "Information Security Policies" },
    { id: "A.6.1", name: "Internal Organisation" },
    { id: "A.8.1", name: "Asset Management" },
    { id: "A.9.1", name: "Access Control" },
    { id: "A.12.4", name: "Logging and Monitoring" },
    { id: "A.13.1", name: "Network Security" },
  ],
  hipaa: [
    { id: "164.308(a)(1)", name: "Security Management Process" },
    { id: "164.308(a)(3)", name: "Workforce Security" },
    { id: "164.308(a)(5)", name: "Security Awareness Training" },
    { id: "164.310(a)(1)", name: "Facility Access Controls" },
    { id: "164.312(a)(1)", name: "Access Control" },
    { id: "164.312(e)(1)", name: "Transmission Security" },
  ],
  gdpr: [
    { id: "Art.5", name: "Principles of Processing" },
    { id: "Art.6", name: "Lawfulness of Processing" },
    { id: "Art.25", name: "Data Protection by Design" },
    { id: "Art.32", name: "Security of Processing" },
    { id: "Art.33", name: "Breach Notification" },
  ],
  pcidss: [
    { id: "PCI-1", name: "Network Security Controls" },
    { id: "PCI-3", name: "Protect Stored Account Data" },
    { id: "PCI-6", name: "Develop Secure Systems" },
    { id: "PCI-8", name: "Identify Users and Authenticate" },
    { id: "PCI-10", name: "Log and Monitor All Access" },
    { id: "PCI-12", name: "Support Information Security" },
  ],
  dpdpa: [
    { id: "DPDPA-3", name: "Grounds for Processing" },
    { id: "DPDPA-6", name: "Notice Requirements" },
    { id: "DPDPA-8", name: "Obligations of Data Fiduciary" },
    { id: "DPDPA-9", name: "Processing of Children's Data" },
    { id: "DPDPA-11", name: "Right to Erasure" },
  ],
  nist80053: [
    { id: "AC-1", name: "Access Control Policy" },
    { id: "AU-2", name: "Event Logging" },
    { id: "CA-7", name: "Continuous Monitoring" },
    { id: "CM-2", name: "Baseline Configuration" },
    { id: "IA-2", name: "Identification and Authentication" },
    { id: "SI-3", name: "Malicious Code Protection" },
  ],
  iso42001: [
    { id: "A.2.2", name: "AI Policy" },
    { id: "A.3.2", name: "Roles and Responsibilities" },
    { id: "A.4.1", name: "Risk Assessment" },
    { id: "A.6.1", name: "AI System Impact Assessment" },
    { id: "A.9.1", name: "Transparency" },
  ],
};

const typeConfig: Record<EvidenceType, { style: React.CSSProperties; label: string }> = {
  document: { style: { background: "var(--low-bg)", color: "var(--low-text)" }, label: "Document" },
  screenshot: { style: { background: "var(--info-bg)", color: "var(--info-text)" }, label: "Screenshot" },
  log: { style: { background: "var(--accent-subtle)", color: "var(--accent)" }, label: "Log" },
  config: { style: { background: "var(--high-bg)", color: "var(--high-text)" }, label: "Config" },
};

// Reads a File as base64 so binary evidence survives the JSON transport intact.
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read the selected file"));
    reader.onload = () => {
      const result = String(reader.result ?? "");
      // strip the "data:<mime>;base64," prefix
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.readAsDataURL(file);
  });
}

function UploadModal({ onClose, onUploaded }: { onClose: () => void; onUploaded: () => void }) {
  const [name, setName] = useState("");
  const [type, setType] = useState<EvidenceType>("document");
  const [framework, setFramework] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Evidence hangs off a finding in the data model (evidence.finding_id is NOT
  // NULL), so one has to be chosen. The modal previously collected only a file and
  // posted multipart, which the API cannot parse and which carried no findingId —
  // upload could never have succeeded.
  const [findings, setFindings] = useState<{ id: string; title: string }[]>([]);
  const [findingId, setFindingId] = useState("");

  useEffect(() => {
    api
      .getFindings({ limit: "100" })
      .then((res) => setFindings(res.findings.map((f) => ({ id: f.id, title: f.title }))))
      .catch(() => setFindings([]));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!findingId) { setError("Choose the finding this evidence supports."); return; }
    if (!file) { setError("Please select a file."); return; }
    setUploading(true);
    setError(null);
    try {
      await api.uploadEvidence({
        findingId,
        type,
        ...(framework ? { framework } : {}),
        content: await fileToBase64(file),
        contentEncoding: "base64",
      });
      onUploaded();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div className="relative z-10 w-full max-w-lg mx-4 card rounded-md shadow-xl p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-semibold font-heading" style={{ color: "var(--text-primary)" }}>Upload Evidence</h3>
          <button
            onClick={onClose}
            className="p-1 rounded transition-colors"
            style={{ color: "var(--text-muted)" }}
            aria-label="Close"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Finding</label>
            <select value={findingId} onChange={(e) => setFindingId(e.target.value)} className="input" required>
              <option value="">Select the finding this supports...</option>
              {findings.map((f) => (
                <option key={f.id} value={f.id}>{f.title}</option>
              ))}
            </select>
            {findings.length === 0 && (
              <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                No findings yet — run a scan first.
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Display Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. AWS IAM Policy Screenshot"
              className="input"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as EvidenceType)}
                className="input"
              >
                <option value="document">Document</option>
                <option value="screenshot">Screenshot</option>
                <option value="log">Log</option>
                <option value="config">Config</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Framework</label>
              <select
                value={framework}
                onChange={(e) => setFramework(e.target.value)}
                className="input"
              >
                <option value="">Select framework...</option>
                {FRAMEWORKS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
            </div>
          </div>

          {/*
            The Control ID picker was removed with the multipart rewrite: the
            evidence table has no control_id column and POST /api/evidence never
            persisted it, so the field asked the user to make a choice that was
            silently discarded. Control mapping happens through the finding.
          */}

          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>File</label>
            <div
              className="border border-dashed rounded-md p-4 text-center cursor-pointer transition-colors"
              style={{ borderColor: "var(--border-strong)" }}
              onClick={() => fileRef.current?.click()}
            >
              {file ? (
                <p className="text-sm" style={{ color: "var(--text-primary)" }}>
                  {file.name} <span style={{ color: "var(--text-muted)" }}>({(file.size / 1024).toFixed(1)} KB)</span>
                </p>
              ) : (
                <>
                  <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Click to select file</p>
                  <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>PDF, PNG, JPEG, TXT, JSON, ZIP up to 50MB</p>
                </>
              )}
              <input ref={fileRef} type="file" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </div>
          </div>

          {error && <p className="text-xs text-[var(--critical-text)]">{error}</p>}

          <div className="flex justify-end gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn btn-ghost btn-sm">
              Cancel
            </button>
            <button type="submit" disabled={uploading} className="btn btn-primary btn-sm">
              {uploading ? "Uploading..." : "Upload"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const PAGE_SIZE = 20;

// REAL IMPL (BLACKFYRE 2026-06): the DEMO_EVIDENCE fixture — which presented
// FABRICATED SHA-256 hashes as if they were real tamper-evidence integrity
// proofs — and the DEMO_MODE bypass have been removed. Evidence artifacts and
// their hashes are sourced only from the live API (api.getEvidence).

export default function EvidencePage() {
  const [evidence, setEvidence] = useState<EvidenceArtifact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [frameworkFilter, setFrameworkFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showUpload, setShowUpload] = useState(false);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [verifyResults, setVerifyResults] = useState<Record<string, { ok: boolean; msg: string }>>({});
  const [page, setPage] = useState(1);

  async function fetchEvidence() {
    // REAL IMPL (BLACKFYRE 2026-06): always load evidence from the live API.
    try {
      setLoading(true);
      setError(null);
      const params: Record<string, string> = {};
      if (frameworkFilter !== "all") params.framework = frameworkFilter;
      if (typeFilter !== "all") params.type = typeFilter;
      if (dateFrom) params.dateFrom = dateFrom;
      if (dateTo) params.dateTo = dateTo;
      const res = await api.getEvidence(Object.keys(params).length > 0 ? params : undefined);
      setEvidence(res.evidence);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load evidence");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchEvidence(); }, [frameworkFilter, typeFilter, dateFrom, dateTo]); // eslint-disable-line react-hooks/exhaustive-deps

  // The API returns a short-lived presigned URL as JSON; resolve it, then navigate.
  async function handleDownload(id: string) {
    try {
      const url = await api.downloadEvidence(id);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      setVerifyResults((prev) => ({
        ...prev,
        [id]: { ok: false, msg: err instanceof Error ? err.message : "Download failed" },
      }));
    }
  }

  async function handleVerify(id: string) {
    setVerifyingId(id);
    try {
      const { integrity } = await api.verifyEvidence(id);
      setVerifyResults((prev) => ({
        ...prev,
        [id]: {
          ok: integrity.valid,
          // The API explains *why* a record is not verifiable (metadata-only hash,
          // not yet uploaded). Surface that rather than a bare "mismatch".
          msg: integrity.valid
            ? "Hash verified against stored content"
            : integrity.reason ?? `Mismatch (expected ${integrity.expected.slice(0, 8)}…)`,
        },
      }));
    } catch (err) {
      setVerifyResults((prev) => ({
        ...prev,
        [id]: { ok: false, msg: err instanceof Error ? err.message : "Verification failed" },
      }));
    } finally {
      setVerifyingId(null);
    }
  }

  const frameworks = Array.from(new Set(evidence.map((e) => e.framework).filter(Boolean))) as string[];

  const totalPages = Math.ceil(evidence.length / PAGE_SIZE);
  const paginated = evidence.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-5 animate-halo-fade-up">
      {showUpload && <UploadModal onClose={() => setShowUpload(false)} onUploaded={fetchEvidence} />}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="halo-eyebrow mb-2">§ 03 · Evidence</p>
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold font-heading" style={{ color: "var(--text-primary)" }}>Evidence Vault</h2>
            <span
              className="px-2.5 py-0.5 rounded-md text-xs font-mono font-medium"
              style={{ background: "var(--accent-subtle)", color: "var(--accent)" }}
            >
              {evidence.length}
            </span>
          </div>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>Audit-ready evidence artifacts with integrity verification</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              const ids = evidence.map((e) => e.id).join(",");
              if (ids) window.open(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"}/api/evidence/export?ids=${ids}`, "_blank");
            }}
            className="btn btn-secondary btn-sm"
          >
            Export Bundle
          </button>
          <button
            onClick={() => setShowUpload(true)}
            className="btn btn-primary btn-sm"
          >
            Upload Evidence
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={frameworkFilter}
          onChange={(e) => { setFrameworkFilter(e.target.value); setPage(1); }}
          aria-label="Filter by framework"
          className="input text-sm"
          style={{ width: "auto" }}
        >
          <option value="all">All Frameworks</option>
          {frameworks.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>

        <select
          value={typeFilter}
          onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
          aria-label="Filter by type"
          className="input text-sm"
          style={{ width: "auto" }}
        >
          <option value="all">All Types</option>
          <option value="document">Document</option>
          <option value="screenshot">Screenshot</option>
          <option value="log">Log</option>
          <option value="config">Config</option>
        </select>

        <div className="flex items-center gap-2">
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
            aria-label="From date"
            className="input text-sm"
            style={{ width: "auto" }}
          />
          <span className="text-sm" style={{ color: "var(--text-muted)" }}>to</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
            aria-label="To date"
            className="input text-sm"
            style={{ width: "auto" }}
          />
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <LoadingSpinner label="Loading evidence..." />
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="card rounded-md p-6 text-center">
          <p className="text-[var(--critical-text)] text-sm">Error: {error}</p>
          <button
            onClick={fetchEvidence}
            className="mt-3 text-xs transition-colors"
            style={{ color: "var(--accent)" }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Table */}
      {!loading && !error && (
        <>
        <div className="card rounded-md shadow-sm overflow-x-auto">
          <table className="w-full text-sm data-table" role="table">
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col" className="w-28">Type</th>
                <th scope="col" className="w-28">Framework</th>
                <th scope="col" className="w-32">Integrity</th>
                <th scope="col" className="w-28">Collected</th>
                <th scope="col" className="w-44">SHA-256</th>
                <th scope="col" className="w-44">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((item) => {
                const tc = typeConfig[item.type] ?? { style: { background: "var(--surface-raised)", color: "var(--text-secondary)" }, label: item.type };
                const vr = verifyResults[item.id];
                return (
                  <tr key={item.id}>
                    <td>
                      <p className="font-medium" style={{ color: "var(--text-primary)" }}>
                        {item.storagePath?.split("/").pop() || tc.label}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{item.collectedBy}</p>
                    </td>
                    <td>
                      <span className="inline-block px-2.5 py-0.5 rounded-md text-xs font-medium" style={tc.style}>
                        {tc.label}
                      </span>
                    </td>
                    <td style={{ color: "var(--text-secondary)" }}>{item.framework ?? "--"}</td>
                    <td className="font-mono text-xs" style={{ color: "var(--text-secondary)" }}>
                      {/* What the hash actually covers — see EvidenceArtifact.hashSource. */}
                      {item.integrityVerified ? "content-hashed" : item.hashSource}
                    </td>
                    <td style={{ color: "var(--text-secondary)" }}>
                      {item.collectedAt ? String(item.collectedAt).split("T")[0] : "--"}
                    </td>
                    <td>
                      <span className="font-mono text-xs" style={{ color: "var(--text-muted)" }} title={item.sha256Hash}>
                        {item.sha256Hash.slice(0, 16)}...
                      </span>
                      {vr && (
                        <p className="text-xs mt-0.5" style={{ color: vr.ok ? "var(--success-text)" : "var(--critical-text)" }}>{vr.msg}</p>
                      )}
                    </td>
                    <td>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => handleVerify(item.id)}
                          disabled={verifyingId === item.id}
                          className="text-xs font-medium transition-colors disabled:opacity-50"
                          style={{ color: "var(--accent)" }}
                        >
                          {verifyingId === item.id ? "Checking..." : "Verify"}
                        </button>
                        <button
                          onClick={() => void handleDownload(item.id)}
                          className="text-xs font-medium transition-colors"
                          style={{ color: "var(--accent)" }}
                        >
                          Download
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {evidence.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-16 text-center">
                    <div
                      className="mx-auto w-12 h-12 rounded-md flex items-center justify-center mb-3"
                      style={{ background: "var(--accent-subtle)" }}
                    >
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--accent)" }} aria-hidden="true">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                      </svg>
                    </div>
                    <p className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>No evidence artifacts found</p>
                    <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Upload your first artifact to get started</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3" style={{ color: "var(--text-secondary)", fontSize: 13 }}>
            <span>
              Showing {((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, evidence.length)} of {evidence.length}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="btn btn-sm"
                style={{ opacity: page === 1 ? 0.4 : 1 }}
              >
                Previous
              </button>
              <span className="px-3 text-xs">{page} / {totalPages}</span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="btn btn-sm"
                style={{ opacity: page === totalPages ? 0.4 : 1 }}
              >
                Next
              </button>
            </div>
          </div>
        )}
        </>
      )}
    </div>
  );
}
