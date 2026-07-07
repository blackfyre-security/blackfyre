"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { api, type EvidenceItem } from "@/lib/api";

/* ------------------------------------------------------------------ */
/*  HELPERS                                                            */
/* ------------------------------------------------------------------ */

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: false,
  });
}

/* ------------------------------------------------------------------ */
/*  ACCESS MODAL — requires 20-char minimum reason (SOC2 CC8.1)        */
/* ------------------------------------------------------------------ */

function AccessModal({
  item,
  onClose,
}: {
  item: EvidenceItem;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [url, setUrl] = useState<string | null>(null);

  const canSubmit = reason.trim().length >= 20 && !submitting && !url;

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const res = await api.accessEvidence(item.id, reason.trim());
      setUrl(res.url);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to get access URL");
      setSubmitting(false);
    }
  }, [item.id, reason, canSubmit]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => { if (!submitting) onClose(); }} />
      <div className="relative w-full max-w-md mx-4 card border border-[var(--border)] rounded-md overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-indigo-400/40 to-transparent" />
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-mono text-sm font-bold text-accent tracking-widest">{"// ACCESS EVIDENCE"}</h3>
            <button onClick={() => { if (!submitting) onClose(); }} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          <div className="space-y-1">
            <p className="font-mono text-[11px] text-[var(--text-muted)] uppercase tracking-widest">Evidence ID</p>
            <p className="font-mono text-xs text-accent">{item.id}</p>
          </div>
          <div className="space-y-1">
            <p className="font-mono text-[11px] text-[var(--text-muted)] uppercase tracking-widest">Tenant</p>
            <p className="font-mono text-xs text-[var(--text-primary)]">{item.tenantName ?? item.tenantId}</p>
          </div>
          <div className="space-y-1">
            <p className="font-mono text-[11px] text-[var(--text-muted)] uppercase tracking-widest">Type</p>
            <p className="font-mono text-xs text-[var(--text-primary)]">{item.type}</p>
          </div>

          {!url ? (
            <>
              <div className="space-y-1.5">
                <label className="block font-mono text-[10px] text-[var(--text-muted)] uppercase tracking-widest">
                  Access Justification <span className="text-[var(--critical-text)]">*</span>
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Explain why you need to access this evidence (min. 20 characters)..."
                  rows={4}
                  className="admin-input resize-none"
                  disabled={submitting}
                />
                <p className={`font-mono text-[10px] ${reason.trim().length >= 20 ? "text-[var(--success-text)]" : "text-[var(--text-muted)]"}`}>
                  {reason.trim().length}/20 minimum characters
                </p>
              </div>
              <p className="font-mono text-[10px] text-[var(--text-muted)] bg-[var(--hover-bg)] border border-[var(--border)] rounded px-3 py-2">
                SOC2 CC8.1: All admin access to customer evidence is logged with justification.
                A pre-signed URL valid for 5 minutes will be generated.
              </p>
              <button
                onClick={handleSubmit}
                disabled={!canSubmit}
                className="admin-btn admin-btn-primary w-full py-3 text-sm tracking-widest"
              >
                {submitting ? (
                  <span className="inline-flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    GENERATING URL...
                  </span>
                ) : "REQUEST ACCESS"}
              </button>
            </>
          ) : (
            <div className="space-y-3">
              <div className="bg-[var(--success-bg)] border border-[var(--success)]/30 rounded px-4 py-3 space-y-2">
                <p className="font-mono text-[11px] text-[var(--success-text)] tracking-widest uppercase">Access Granted</p>
                <p className="font-mono text-[10px] text-[var(--text-muted)]">Pre-signed URL valid for 5 minutes. Opens in new tab.</p>
              </div>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="admin-btn admin-btn-primary w-full py-3 text-sm tracking-widest text-center block"
              >
                OPEN EVIDENCE
              </a>
              <button onClick={onClose} className="admin-btn admin-btn-ghost w-full py-2 text-sm">
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  MAIN PAGE                                                          */
/* ------------------------------------------------------------------ */

export default function EvidencePage() {
  const [items, setItems] = useState<EvidenceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<EvidenceItem | null>(null);

  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const PAGE_SIZE = 25;

  const [filterTenant, setFilterTenant] = useState("");
  const [filterFramework, setFilterFramework] = useState("");

  const fetchEvidence = useCallback(async (p: number, tenant: string, framework: string) => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = { page: String(p), limit: String(PAGE_SIZE) };
      if (tenant) params.tenantId = tenant;
      if (framework) params.framework = framework;
      const res = await api.getAdminEvidence(params);
      setItems(res.evidence);
      setTotal(res.pagination.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load evidence");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvidence(page, filterTenant, filterFramework);
  }, [fetchEvidence, page, filterTenant, filterFramework]);

  const tenants = useMemo(() => [...new Set(items.map((i) => i.tenantId))].sort(), [items]);
  const frameworks = useMemo(() => [...new Set(items.map((i) => i.framework).filter(Boolean))].sort() as string[], [items]);
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div>
        <div className="font-mono text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-widest">
          Admin · Evidence
        </div>
        <h1 className="mt-2 text-[30px] font-semibold tracking-tight text-[var(--text-primary)]" style={{ letterSpacing: "-0.025em" }}>
          Evidence Vault
        </h1>
        <p className="mt-1.5 text-[13px] text-[var(--text-secondary)]">
          SOC2 CC8.1 — all access is logged with justification · {total} records
        </p>
      </div>

      {/* FILTERS */}
      <div className="admin-card p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div>
            <label className="block font-mono text-[10px] text-[var(--text-muted)] uppercase tracking-widest mb-1.5">Tenant ID</label>
            <select
              value={filterTenant}
              onChange={(e) => { setFilterTenant(e.target.value); setPage(1); }}
              className="admin-input"
            >
              <option value="">All Tenants</option>
              {tenants.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="block font-mono text-[10px] text-[var(--text-muted)] uppercase tracking-widest mb-1.5">Framework</label>
            <select
              value={filterFramework}
              onChange={(e) => { setFilterFramework(e.target.value); setPage(1); }}
              className="admin-input"
            >
              <option value="">All Frameworks</option>
              {frameworks.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <div className="flex items-end">
            {(filterTenant || filterFramework) && (
              <button
                onClick={() => { setFilterTenant(""); setFilterFramework(""); setPage(1); }}
                className="admin-btn admin-btn-ghost text-[11px] h-9 px-4"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>
      </div>

      {/* TABLE */}
      <div className="admin-card overflow-hidden relative">
        <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-indigo-300/40 to-transparent" />

        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="flex flex-col items-center gap-3">
              <svg className="animate-spin h-7 w-7 text-accent" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="font-mono text-[11px] text-[var(--text-muted)] tracking-widest">LOADING EVIDENCE...</span>
            </div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-48">
            <p className="font-mono text-xs text-[var(--critical-text)]">{error}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  {["ID", "Tenant", "Type", "Framework", "Collected At", "Collected By", ""].map((h) => (
                    <th key={h} className="px-4 py-3 text-left font-mono text-[10px] text-[var(--text-muted)] uppercase tracking-widest font-semibold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-16 text-center font-mono text-[11px] text-[var(--text-muted)] tracking-widest">
                      NO EVIDENCE RECORDS FOUND
                    </td>
                  </tr>
                ) : (
                  items.map((item) => (
                    <tr key={item.id} className="border-b border-[var(--border)] hover:bg-[var(--hover-bg)] transition-colors">
                      <td className="px-4 py-3">
                        <span className="font-mono text-[11px] text-[var(--text-muted)]">{item.id.slice(0, 8)}…</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-[12px] text-[var(--text-primary)]">{item.tenantName ?? item.tenantId.slice(0, 8)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-[11px] text-accent">{item.type}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-[11px] text-[var(--text-muted)]">{item.framework ?? "—"}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-[11px] text-[var(--text-muted)]">{formatDate(item.collectedAt)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-[11px] text-[var(--text-muted)]">{item.collectedBy}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => setSelectedItem(item)}
                          className="admin-btn admin-btn-ghost text-[11px] px-3 py-1.5"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* PAGINATION */}
        {!loading && totalPages > 1 && (
          <div className="px-4 py-3 border-t border-[var(--border)]/50 flex items-center justify-between">
            <span className="font-mono text-[10px] text-[var(--text-muted)] tracking-widest">
              PAGE {page} OF {totalPages} · {total} RECORDS
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="admin-btn admin-btn-ghost text-[11px] px-3 py-1.5 disabled:opacity-40"
              >
                Prev
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="admin-btn admin-btn-ghost text-[11px] px-3 py-1.5 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ACCESS MODAL */}
      {selectedItem && (
        <AccessModal item={selectedItem} onClose={() => setSelectedItem(null)} />
      )}
    </div>
  );
}
