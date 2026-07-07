"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api, type LeadNotificationRecipient } from "@/lib/api";

export default function LeadRecipientsPage() {
  const [items, setItems] = useState<LeadNotificationRecipient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getLeadRecipients();
      setItems(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load recipients");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError(null);
    if (!newEmail.trim()) {
      setAddError("Email is required");
      return;
    }
    setAdding(true);
    try {
      const res = await api.createLeadRecipient({
        email: newEmail.trim(),
        name: newName.trim() || undefined,
      });
      setItems((prev) => [res.data, ...prev]);
      setNewEmail("");
      setNewName("");
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Failed to add recipient");
    } finally {
      setAdding(false);
    }
  };

  const handleToggle = async (r: LeadNotificationRecipient) => {
    try {
      const res = await api.updateLeadRecipient(r.id, { isActive: !r.isActive });
      setItems((prev) => prev.map((it) => (it.id === r.id ? res.data : it)));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Update failed");
    }
  };

  const handleDelete = async (r: LeadNotificationRecipient) => {
    if (!confirm(`Remove ${r.email} from lead notifications?`)) return;
    try {
      await api.deleteLeadRecipient(r.id);
      setItems((prev) => prev.filter((it) => it.id !== r.id));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Delete failed");
    }
  };

  return (
    <div className="animate-fade-up max-w-3xl">
      <div className="mb-6">
        <Link href="/contact-submissions" className="text-xs" style={{ color: "var(--text-muted)" }}>
          ← Back to leads
        </Link>
        <h1 className="text-2xl font-semibold mt-2" style={{ color: "var(--text-primary)" }}>
          Lead notification recipients
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
          People who get an email when a new contact form submission arrives. Inactive
          recipients are kept for history but skipped when sending.
        </p>
      </div>

      {/* Add form */}
      <form
        onSubmit={handleAdd}
        className="rounded-lg p-4 mb-6"
        style={{ background: "var(--card-bg)", border: "1px solid var(--border)" }}
      >
        <div className="text-xs uppercase tracking-wide mb-3" style={{ color: "var(--text-muted)" }}>
          Add recipient
        </div>
        <div className="flex gap-2 flex-wrap">
          <input
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="email@blackfyre.tech"
            className="flex-1 min-w-[240px] px-3 py-2 rounded-md text-sm"
            style={{ background: "var(--hover-bg)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
            required
          />
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Name (optional)"
            className="flex-1 min-w-[180px] px-3 py-2 rounded-md text-sm"
            style={{ background: "var(--hover-bg)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
          />
          <button
            type="submit"
            disabled={adding}
            className="text-sm px-4 py-2 rounded-md transition-colors"
            style={{
              background: adding ? "var(--hover-bg)" : "var(--accent)",
              color: adding ? "var(--text-muted)" : "#0A0A0B",
              fontWeight: 600,
              cursor: adding ? "not-allowed" : "pointer",
            }}
          >
            {adding ? "Adding…" : "Add"}
          </button>
        </div>
        {addError && (
          <div className="mt-2 text-xs" style={{ color: "var(--high-text)" }}>{addError}</div>
        )}
      </form>

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
        {loading && (
          <div className="text-center py-8 text-sm" style={{ color: "var(--text-muted)" }}>Loading…</div>
        )}
        {!loading && items.length === 0 && (
          <div className="text-center py-8 text-sm" style={{ color: "var(--text-muted)" }}>
            No recipients yet. Add one above.
          </div>
        )}
        {!loading && items.length > 0 && (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)", background: "var(--hover-bg)" }}>
                <th className="text-left px-4 py-2.5 font-medium" style={{ color: "var(--text-muted)" }}>Email</th>
                <th className="text-left px-4 py-2.5 font-medium" style={{ color: "var(--text-muted)" }}>Name</th>
                <th className="text-left px-4 py-2.5 font-medium" style={{ color: "var(--text-muted)" }}>Active</th>
                <th className="text-right px-4 py-2.5 font-medium" style={{ color: "var(--text-muted)" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((r) => (
                <tr key={r.id} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td className="px-4 py-3" style={{ color: "var(--text-primary)" }}>{r.email}</td>
                  <td className="px-4 py-3" style={{ color: "var(--text-secondary)" }}>{r.name ?? "—"}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => void handleToggle(r)}
                      className="text-xs px-2 py-1 rounded transition-colors"
                      style={{
                        background: r.isActive ? "var(--accent-subtle)" : "var(--hover-bg)",
                        color: r.isActive ? "var(--accent)" : "var(--text-muted)",
                        border: `1px solid ${r.isActive ? "var(--accent)" : "var(--border)"}`,
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                        fontWeight: 600,
                      }}
                    >
                      {r.isActive ? "Active" : "Paused"}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => void handleDelete(r)}
                      className="text-xs px-2 py-1 rounded transition-colors"
                      style={{ color: "var(--text-muted)" }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--critical)"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--text-muted)"; }}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="text-xs mt-4" style={{ color: "var(--text-muted)" }}>
        Sending requires SMTP env vars (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM) set on the API.
        With SMTP unset, leads are still captured but no emails go out.
      </p>
    </div>
  );
}
