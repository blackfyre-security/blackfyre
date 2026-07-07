"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api, type ContactSubmission } from "@/lib/api";

type StatusFilter = "all" | ContactSubmission["status"];

const STATUS_OPTIONS: { value: ContactSubmission["status"]; label: string }[] = [
  { value: "new",        label: "New" },
  { value: "contacted",  label: "Contacted" },
  { value: "qualified",  label: "Qualified" },
  { value: "archived",   label: "Archived" },
  { value: "spam",       label: "Spam" },
];

function statusColor(status: ContactSubmission["status"]): { bg: string; fg: string } {
  switch (status) {
    case "new":        return { bg: "var(--accent-subtle)", fg: "var(--accent)" };
    case "contacted":  return { bg: "rgba(80,140,255,0.12)", fg: "#6BA1FF" };
    case "qualified":  return { bg: "rgba(80,200,160,0.12)", fg: "#5FC9A0" };
    case "archived":   return { bg: "var(--hover-bg)",       fg: "var(--text-muted)" };
    case "spam":       return { bg: "var(--high-bg)",        fg: "var(--high-text)" };
  }
}

function timeAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60)      return `${seconds}s ago`;
  if (seconds < 3600)    return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400)   return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800)  return `${Math.floor(seconds / 86400)}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function ContactSubmissionsPage() {
  const [items, setItems] = useState<ContactSubmission[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [selected, setSelected] = useState<ContactSubmission | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = filter === "all" ? undefined : { status: filter };
      const res = await api.getContactSubmissions(params);
      setItems(res.data.items);
      setTotal(res.data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load submissions");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { void load(); }, [load]);

  const handleStatusChange = useCallback(async (id: string, status: ContactSubmission["status"]) => {
    try {
      const res = await api.updateContactSubmission(id, { status });
      setItems((prev) => prev.map((it) => (it.id === id ? res.data : it)));
      if (selected?.id === id) setSelected(res.data);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Update failed");
    }
  }, [selected]);

  const newCount = useMemo(() => items.filter((i) => i.status === "new").length, [items]);

  return (
    <div className="animate-fade-up">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: "var(--text-primary)" }}>Leads</h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
            Contact form submissions from the marketing website.
            {filter === "all" && total > 0 && <> · {total} total, {newCount} new in view</>}
          </p>
        </div>
        <Link
          href="/contact-submissions/recipients"
          className="text-sm px-3 py-2 rounded-md transition-colors"
          style={{ background: "var(--hover-bg)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}
        >
          Manage notification recipients →
        </Link>
      </div>

      {/* Filters */}
      <div className="flex gap-1.5 mb-4 flex-wrap">
        {(["all", ...STATUS_OPTIONS.map((s) => s.value)] as StatusFilter[]).map((value) => {
          const active = value === filter;
          const label = value === "all" ? "All" : STATUS_OPTIONS.find((s) => s.value === value)?.label ?? value;
          return (
            <button
              key={value}
              onClick={() => setFilter(value)}
              className="text-xs px-3 py-1.5 rounded-md transition-colors"
              style={{
                background: active ? "var(--accent-subtle)" : "transparent",
                color: active ? "var(--accent)" : "var(--text-secondary)",
                border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
                fontWeight: active ? 600 : 400,
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {error && (
        <div
          className="rounded-md p-3 mb-4 text-sm"
          style={{ background: "var(--high-bg)", color: "var(--high-text)", border: "1px solid var(--high-text)" }}
        >
          {error}
        </div>
      )}

      <div
        className="rounded-lg overflow-hidden"
        style={{ background: "var(--card-bg)", border: "1px solid var(--border)" }}
      >
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)", background: "var(--hover-bg)" }}>
              <th className="text-left px-4 py-2.5 font-medium" style={{ color: "var(--text-muted)" }}>Name</th>
              <th className="text-left px-4 py-2.5 font-medium" style={{ color: "var(--text-muted)" }}>Email</th>
              <th className="text-left px-4 py-2.5 font-medium" style={{ color: "var(--text-muted)" }}>Company</th>
              <th className="text-left px-4 py-2.5 font-medium" style={{ color: "var(--text-muted)" }}>Topic</th>
              <th className="text-left px-4 py-2.5 font-medium" style={{ color: "var(--text-muted)" }}>Status</th>
              <th className="text-right px-4 py-2.5 font-medium" style={{ color: "var(--text-muted)" }}>When</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={6} className="text-center py-12" style={{ color: "var(--text-muted)" }}>Loading…</td></tr>
            )}
            {!loading && items.length === 0 && (
              <tr><td colSpan={6} className="text-center py-12" style={{ color: "var(--text-muted)" }}>
                No submissions yet.
              </td></tr>
            )}
            {!loading && items.map((s) => {
              const color = statusColor(s.status);
              return (
                <tr
                  key={s.id}
                  onClick={() => setSelected(s)}
                  className="cursor-pointer transition-colors"
                  style={{ borderBottom: "1px solid var(--border)" }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--hover-bg)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                >
                  <td className="px-4 py-3" style={{ color: "var(--text-primary)" }}>{s.name}</td>
                  <td className="px-4 py-3" style={{ color: "var(--text-secondary)" }}>{s.email}</td>
                  <td className="px-4 py-3" style={{ color: "var(--text-secondary)" }}>{s.company ?? "—"}</td>
                  <td className="px-4 py-3" style={{ color: "var(--text-secondary)" }}>{s.topic ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span
                      className="mono text-[10.5px] px-2 py-0.5 rounded"
                      style={{ background: color.bg, color: color.fg, textTransform: "uppercase", letterSpacing: "0.06em" }}
                    >
                      {s.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right mono text-xs" style={{ color: "var(--text-muted)" }}>
                    {timeAgo(s.createdAt)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Detail drawer */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex justify-end"
          style={{ background: "rgba(0,0,0,0.4)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setSelected(null); }}
        >
          <div
            className="h-full w-full max-w-xl overflow-y-auto"
            style={{ background: "var(--card-bg)", borderLeft: "1px solid var(--border)" }}
          >
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>{selected.name}</h2>
                  <a href={`mailto:${selected.email}`} className="text-sm" style={{ color: "var(--accent)" }}>{selected.email}</a>
                </div>
                <button
                  onClick={() => setSelected(null)}
                  className="text-sm px-2 py-1 rounded transition-colors"
                  style={{ color: "var(--text-muted)" }}
                  aria-label="Close"
                >✕</button>
              </div>

              <dl className="space-y-3 text-sm">
                {selected.company && <Row label="Company" value={selected.company} />}
                {selected.topic && <Row label="Topic" value={selected.topic} />}
                {selected.preferredDate && <Row label="Preferred date" value={selected.preferredDate} />}
                {selected.preferredTime && <Row label="Preferred time" value={selected.preferredTime} />}
                <Row label="Source" value={selected.source} />
                <Row label="Submitted" value={new Date(selected.createdAt).toLocaleString()} />
                {selected.ipAddress && <Row label="IP" value={selected.ipAddress} mono />}
                {selected.message && (
                  <div>
                    <dt className="text-xs uppercase tracking-wide mb-1" style={{ color: "var(--text-muted)" }}>Message</dt>
                    <dd
                      className="text-sm whitespace-pre-wrap rounded p-3"
                      style={{ color: "var(--text-primary)", background: "var(--hover-bg)", border: "1px solid var(--border)" }}
                    >{selected.message}</dd>
                  </div>
                )}
              </dl>

              <div className="mt-6 pt-6" style={{ borderTop: "1px solid var(--border)" }}>
                <div className="text-xs uppercase tracking-wide mb-2" style={{ color: "var(--text-muted)" }}>Status</div>
                <div className="flex flex-wrap gap-1.5">
                  {STATUS_OPTIONS.map((opt) => {
                    const active = selected.status === opt.value;
                    return (
                      <button
                        key={opt.value}
                        onClick={() => void handleStatusChange(selected.id, opt.value)}
                        disabled={active}
                        className="text-xs px-3 py-1.5 rounded-md transition-colors"
                        style={{
                          background: active ? "var(--accent-subtle)" : "transparent",
                          color: active ? "var(--accent)" : "var(--text-secondary)",
                          border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
                          cursor: active ? "default" : "pointer",
                          fontWeight: active ? 600 : 400,
                        }}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline gap-3">
      <dt className="text-xs uppercase tracking-wide shrink-0 w-28" style={{ color: "var(--text-muted)" }}>{label}</dt>
      <dd className={mono ? "text-sm mono" : "text-sm"} style={{ color: "var(--text-primary)" }}>{value}</dd>
    </div>
  );
}
