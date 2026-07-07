"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import type { TeamMember, TeamRole } from "@/lib/api";

const roleConfig: Record<TeamRole, { style: React.CSSProperties; label: string }> = {
  owner:    { style: { background: "var(--medium-bg)", color: "var(--medium-text)" },  label: "Owner" },
  admin:    { style: { background: "var(--low-bg)", color: "var(--low-text)" },   label: "Admin" },
  engineer: { style: { background: "var(--accent-subtle)", color: "var(--accent)" },   label: "Engineer" },
  viewer:   { style: { background: "var(--surface-raised)", color: "var(--text-secondary)" },   label: "Viewer" },
};

const statusConfig: Record<string, { style: React.CSSProperties; label: string }> = {
  active:    { style: { background: "var(--success-bg)", color: "var(--success-text)" },  label: "Active" },
  invited:   { style: { background: "var(--medium-bg)", color: "var(--medium-text)" }, label: "Invited" },
  suspended: { style: { background: "var(--critical-bg)", color: "var(--critical-text)" },    label: "Suspended" },
};

function InviteModal({ onClose, onInvited }: { onClose: () => void; onInvited: () => void }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<TeamRole>("viewer");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) { setError("Email is required."); return; }
    setLoading(true);
    setError(null);
    try {
      await api.inviteTeamMember({ email: email.trim(), role });
      onInvited();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invite failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div className="relative z-10 w-full max-w-md mx-4 card rounded-md shadow-xl p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-semibold font-heading" style={{ color: "var(--text-primary)" }}>Invite Team Member</h3>
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
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="colleague@company.com"
              autoFocus
              className="input"
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as TeamRole)}
              className="input"
            >
              <option value="viewer">Viewer — read-only access</option>
              <option value="engineer">Engineer — manage findings &amp; remediations</option>
              <option value="admin">Admin — full access except billing</option>
            </select>
          </div>

          {error && <p className="text-xs text-[var(--critical-text)]">{error}</p>}

          <div className="flex justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-ghost btn-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary btn-sm"
            >
              {loading ? "Sending..." : "Send Invite"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// REAL IMPL (BLACKFYRE 2026-06): the DEMO_MEMBERS fixture (fabricated teammate
// PII) and DEMO_MODE bypass have been removed. The team roster is sourced only
// from the live API (api.getTeamMembers).

export default function TeamPage() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showInvite, setShowInvite] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

  async function fetchMembers() {
    // REAL IMPL (BLACKFYRE 2026-06): always load the roster from the live API.
    try {
      setLoading(true);
      setError(null);
      const res = await api.getTeamMembers();
      setMembers(res.members);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load team");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchMembers(); }, []);

  async function handleRoleChange(id: string, role: TeamRole) {
    setUpdatingId(id);
    try {
      await api.updateTeamMemberRole(id, role);
      setMembers((prev) => prev.map((m) => m.id === id ? { ...m, role } : m));
    } catch {
      // silently revert — UI will show current server state on next fetch
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleRemove(id: string) {
    setRemovingId(id);
    try {
      await api.removeTeamMember(id);
      setMembers((prev) => prev.filter((m) => m.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove member");
    } finally {
      setRemovingId(null);
      setConfirmRemove(null);
    }
  }

  return (
    <div className="space-y-6 animate-halo-fade-up">
      {showInvite && <InviteModal onClose={() => setShowInvite(false)} onInvited={fetchMembers} />}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="halo-eyebrow mb-2">§ 06 · Team</p>
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold font-heading" style={{ color: "var(--text-primary)" }}>Team</h2>
            {!loading && (
              <span
                className="px-2.5 py-0.5 rounded-md text-xs font-mono font-medium"
                style={{ background: "var(--accent-subtle)", color: "var(--accent)" }}
              >
                {members.length}
              </span>
            )}
          </div>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>Manage team members and roles within your organization</p>
        </div>
        <button
          onClick={() => setShowInvite(true)}
          className="btn btn-primary btn-sm"
        >
          Invite Member
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>Loading team...</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="card rounded-md p-6 text-center">
          <p className="text-[var(--critical-text)] text-sm">Error: {error}</p>
          <button
            onClick={fetchMembers}
            className="mt-3 text-xs transition-colors"
            style={{ color: "var(--accent)" }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Table */}
      {!loading && !error && (
        <div className="card rounded-md shadow-sm overflow-x-auto">
          <table className="w-full text-sm data-table" role="table">
            <thead>
              <tr>
                <th scope="col">Member</th>
                <th scope="col" className="w-36">Role</th>
                <th scope="col" className="w-28">Status</th>
                <th scope="col" className="w-36">Last Login</th>
                <th scope="col" className="w-24">Action</th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => {
                const rc = roleConfig[member.role] ?? roleConfig.viewer;
                const sc = statusConfig[member.status] ?? statusConfig.active;
                const isOwner = member.role === "owner";
                return (
                  <tr key={member.id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <div
                          className="avatar w-8 h-8 text-xs font-semibold shrink-0"
                        >
                          {member.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium" style={{ color: "var(--text-primary)" }}>{member.name}</p>
                          <p className="text-xs" style={{ color: "var(--text-muted)" }}>{member.email}</p>
                        </div>
                      </div>
                    </td>
                    <td>
                      {isOwner ? (
                        <span className="inline-block px-2.5 py-0.5 rounded-md text-xs font-medium" style={rc.style}>
                          {rc.label}
                        </span>
                      ) : (
                        <select
                          value={member.role}
                          onChange={(e) => handleRoleChange(member.id, e.target.value as TeamRole)}
                          disabled={updatingId === member.id}
                          aria-label={`Role for ${member.name}`}
                          className="input text-xs py-1 px-2 disabled:opacity-50"
                          style={{ width: "auto" }}
                        >
                          <option value="viewer">Viewer</option>
                          <option value="engineer">Engineer</option>
                          <option value="admin">Admin</option>
                        </select>
                      )}
                    </td>
                    <td>
                      <span className="inline-block px-2.5 py-0.5 rounded-md text-xs font-medium" style={sc.style}>
                        {sc.label}
                      </span>
                    </td>
                    <td className="text-xs" style={{ color: "var(--text-secondary)" }}>
                      {member.lastLoginAt ? new Date(member.lastLoginAt).toLocaleDateString() : "--"}
                    </td>
                    <td>
                      {!isOwner && (
                        confirmRemove === member.id ? (
                          <div className="flex gap-1">
                            <button
                              className="btn btn-sm"
                              style={{ background: "var(--critical)", color: "#fff", fontSize: 11 }}
                              onClick={() => handleRemove(member.id)}
                              disabled={removingId === member.id}
                            >
                              {removingId === member.id ? "Removing..." : "Confirm"}
                            </button>
                            <button
                              className="btn btn-sm"
                              style={{ fontSize: 11 }}
                              onClick={() => setConfirmRemove(null)}
                              disabled={removingId === member.id}
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmRemove(member.id)}
                            disabled={removingId === member.id}
                            className="text-xs font-medium text-[var(--critical-text)] hover:text-[var(--critical)] transition-colors disabled:opacity-50"
                          >
                            Remove
                          </button>
                        )
                      )}
                    </td>
                  </tr>
                );
              })}
              {members.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-16 text-center">
                    <div
                      className="mx-auto w-12 h-12 rounded-md flex items-center justify-center mb-3"
                      style={{ background: "var(--hover-bg)" }}
                    >
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--text-muted)" }} aria-hidden="true">
                        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                        <circle cx="9" cy="7" r="4" />
                        <path d="M23 21v-2a4 4 0 00-3-3.87" />
                        <path d="M16 3.13a4 4 0 010 7.75" />
                      </svg>
                    </div>
                    <p className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>No team members yet</p>
                    <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Invite colleagues to your security workspace</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
