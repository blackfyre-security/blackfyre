"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { api } from "@/lib/api";
import type { AuditLogEntry } from "@/lib/api";
import { LoadingSpinner } from "@blackfyre/ui";

/**
 * Audit trail.
 *
 * The only reader for audit_logs used to live in the operator console, which is
 * not part of the open-source release (ADR-0005) — so a self-hosted install wrote
 * an audit trail nobody could read. This is that reader.
 *
 * Paging sends back the last row's id as the cursor; the API resolves its exact
 * (created_at, id) position server-side. Serialising the timestamp would truncate
 * microseconds to milliseconds and silently drop rows.
 */

const outcomeConfig: Record<string, { style: React.CSSProperties; label: string }> = {
  success: { style: { background: "var(--success-bg)", color: "var(--success-text)" }, label: "Success" },
  failure: { style: { background: "var(--critical-bg)", color: "var(--critical-text)" }, label: "Failure" },
};

export default function AuditLogsPage() {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<"" | "success" | "failure">("");
  const [hasMore, setHasMore] = useState(false);

  // The cursor lives in a ref, not state. `load` is memoised on [outcome], so a
  // state cursor would be captured at the render where outcome last changed —
  // permanently null after mount — and "Load more" would silently re-fetch page 1
  // and append duplicates. A ref is read at call time, so it is always current.
  const cursorRef = useRef<string | null>(null);

  const load = useCallback(
    async (reset: boolean) => {
        if (reset) cursorRef.current = null;
      reset ? setLoading(true) : setLoadingMore(true);
      setError(null);
      try {
        const res = await api.getAuditLogs({
          limit: 50,
          ...(outcome ? { outcome } : {}),
          ...(!reset && cursorRef.current ? { beforeId: cursorRef.current } : {}),
        });
        setEntries((prev) => (reset ? res.entries : [...prev, ...res.entries]));
        setHasMore(res.hasMore);
        cursorRef.current = res.hasMore ? res.nextBeforeId : null;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load the audit trail");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [outcome],
  );

  useEffect(() => {
    void load(true);
  }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold font-heading" style={{ color: "var(--text-primary)" }}>
            Audit trail
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
            Every recorded action in this workspace, newest first.
          </p>
        </div>
        <select
          value={outcome}
          onChange={(e) => setOutcome(e.target.value as "" | "success" | "failure")}
          className="input"
          style={{ maxWidth: 180 }}
          aria-label="Filter by outcome"
        >
          <option value="">All outcomes</option>
          <option value="success">Success only</option>
          <option value="failure">Failure only</option>
        </select>
      </div>

      {error && (
        <div
          className="rounded-md px-4 py-3 text-sm"
          style={{ background: "var(--critical-bg)", color: "var(--critical-text)" }}
          role="alert"
        >
          {error}
        </div>
      )}

      {loading ? (
        <LoadingSpinner />
      ) : (
        <div className="card rounded-md overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th scope="col">Action</th>
                <th scope="col" className="w-56">Actor</th>
                <th scope="col" className="w-48">Resource</th>
                <th scope="col" className="w-28">Outcome</th>
                <th scope="col" className="w-36">IP</th>
                <th scope="col" className="w-44">When</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => {
                const oc = outcomeConfig[e.outcome] ?? {
                  style: { background: "var(--surface-raised)", color: "var(--text-secondary)" },
                  label: e.outcome,
                };
                return (
                  <tr key={e.id}>
                    <td className="font-mono text-xs" style={{ color: "var(--text-primary)" }}>{e.action}</td>
                    <td style={{ color: "var(--text-secondary)" }}>
                      {e.actorEmail ?? <span style={{ color: "var(--text-muted)" }}>{e.actorType}</span>}
                    </td>
                    <td className="text-xs" style={{ color: "var(--text-secondary)" }}>
                      {e.resourceType ?? "--"}
                    </td>
                    <td>
                      <span className="inline-block px-2.5 py-0.5 rounded-md text-xs font-medium" style={oc.style}>
                        {oc.label}
                      </span>
                    </td>
                    <td className="font-mono text-xs" style={{ color: "var(--text-muted)" }}>{e.ipAddress ?? "--"}</td>
                    <td style={{ color: "var(--text-secondary)" }}>
                      {new Date(e.createdAt).toLocaleString()}
                    </td>
                  </tr>
                );
              })}
              {entries.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-10" style={{ color: "var(--text-muted)" }}>
                    No audit entries recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {hasMore && (
        <div className="flex justify-center">
          <button
            onClick={() => void load(false)}
            disabled={loadingMore}
            className="btn btn-secondary"
          >
            {loadingMore ? "Loading…" : "Load more"}
          </button>
        </div>
      )}
    </div>
  );
}
