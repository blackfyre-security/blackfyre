"use client";

import { Fragment, useState, useEffect, useCallback, useMemo } from "react";
import { api } from "@/lib/api";
import type { AdminUser } from "@/lib/api";

/* ------------------------------------------------------------------ */
/*  TYPES                                                              */
/* ------------------------------------------------------------------ */

interface LoginEntry {
  ip: string;
  timestamp: string;
  userAgent: string;
}

interface ManagedUser {
  id: string;
  email: string;
  name: string;
  role: "owner" | "admin" | "engineer" | "viewer";
  tenantId: string;
  tenantName: string;
  mfaEnabled: boolean;
  lastLogin: string | null;
  status: "active" | "suspended";
  createdAt: string;
  loginHistory: LoginEntry[];
}


const ROLES: ManagedUser["role"][] = ["owner", "admin", "engineer", "viewer"];

/* ------------------------------------------------------------------ */
/*  HELPERS                                                            */
/* ------------------------------------------------------------------ */

function relativeTime(iso: string | null): string {
  if (!iso) return "Never";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function generatePassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%&*";
  let pwd = "";
  for (let i = 0; i < 20; i++) {
    pwd += chars[Math.floor(Math.random() * chars.length)];
  }
  return pwd;
}

/* ------------------------------------------------------------------ */
/*  ROLE BADGE                                                         */
/* ------------------------------------------------------------------ */

const ROLE_COLORS: Record<ManagedUser["role"], { bg: string; text: string; ring: string }> = {
  owner: { bg: "bg-[var(--accent-subtle)]", text: "text-[var(--accent)]", ring: "ring-[var(--accent)]/30" },
  admin: { bg: "bg-[var(--low-bg)]", text: "text-[var(--low-text)]", ring: "ring-[var(--low)]/30" },
  engineer: { bg: "bg-[var(--medium-bg)]", text: "text-[var(--medium-text)]", ring: "ring-[var(--medium)]/30" },
  viewer: { bg: "bg-[var(--hover-bg)]", text: "text-[var(--text-muted)]", ring: "ring-[var(--border-strong)]/30" },
};

function RoleBadge({ role }: { role: ManagedUser["role"] }) {
  const c = ROLE_COLORS[role];
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded font-mono text-[11px] font-semibold uppercase tracking-wider ring-1 ${c.bg} ${c.text} ${c.ring}`}
    >
      {role}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  STATUS INDICATOR                                                   */
/* ------------------------------------------------------------------ */

function StatusIndicator({ status }: { status: "active" | "suspended" }) {
  if (status === "active") {
    return (
      <span className="inline-flex items-center gap-1.5 font-mono text-[11px]" style={{ color: "var(--success-text)" }}>
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-md opacity-75" style={{ background: "var(--success)" }} />
          <span className="relative inline-flex h-2 w-2 rounded-md" style={{ background: "var(--success)", boxShadow: "0 0 6px var(--success)" }} />
        </span>
        ACTIVE
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-[11px]" style={{ color: "var(--critical-text)" }}>
      <span className="inline-flex h-2 w-2 rounded-md" style={{ background: "var(--critical)" }} />
      SUSPENDED
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  MFA ICON                                                           */
/* ------------------------------------------------------------------ */

function MfaIcon({ enabled }: { enabled: boolean }) {
  if (enabled) {
    return (
      <span className="inline-flex items-center gap-1 font-mono text-[11px]" style={{ color: "var(--success-text)" }} title="MFA Enabled">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
        ON
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 font-mono text-[11px] text-[var(--text-muted)]" title="MFA Disabled">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 9.9-1" />
      </svg>
      OFF
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  CREATE USER MODAL                                                  */
/* ------------------------------------------------------------------ */

interface TenantOption { id: string; name: string; }

function CreateUserModal({
  open,
  onClose,
  onCreated,
  tenants,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (user: ManagedUser) => void;
  tenants: TenantOption[];
}) {
  const [tenantId, setTenantId] = useState("");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<ManagedUser["role"]>("viewer");
  const [deploying, setDeploying] = useState(false);

  const reset = useCallback(() => {
    setTenantId("");
    setEmail("");
    setName("");
    setPassword("");
    setRole("viewer");
    setDeploying(false);
  }, []);

  const handleDeploy = useCallback(async () => {
    if (!tenantId || !email || !name || !password) return;
    setDeploying(true);
    try {
      const res = await api.createAdminUser({ tenantId, email, name, password, role });
      const created = res.user;
      const newUser: ManagedUser = {
        id: created.id,
        email: created.email,
        name: created.name,
        role: (created.role as ManagedUser["role"]) || "viewer",
        tenantId: created.tenantId || tenantId,
        tenantName: tenants.find((t) => t.id === tenantId)?.name || tenantId,
        mfaEnabled: false,
        lastLogin: created.lastLogin,
        status: "active",
        createdAt: created.createdAt,
        loginHistory: [],
      };
      onCreated(newUser);
      reset();
      onClose();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to create user");
      setDeploying(false);
    }
  }, [tenantId, tenants, email, name, password, role, onCreated, onClose, reset]);

  if (!open) return null;

  const canDeploy = tenantId && email && name && password;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={() => { if (!deploying) { reset(); onClose(); } }}
      />

      {/* modal */}
      <div className="relative w-full max-w-lg mx-4 card border border-[var(--border)] rounded-md overflow-hidden">
        {/* top accent line */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-indigo-400/40 to-transparent" />
        </div>

        <div className="p-6 space-y-5">
          {/* header */}
          <div className="flex items-center justify-between">
            <h3 className="font-mono text-sm font-bold text-accent tracking-widest">
              {'// DEPLOY NEW OPERATIVE'}
            </h3>
            <button
              onClick={() => { if (!deploying) { reset(); onClose(); } }}
              className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* tenant */}
          <div>
            <label className="block font-mono text-[10px] text-[var(--text-muted)] uppercase tracking-widest mb-1.5">
              Assigned Cell (Tenant)
            </label>
            <select
              value={tenantId}
              onChange={(e) => setTenantId(e.target.value)}
              className="admin-input"
              disabled={deploying}
            >
              <option value="">Select tenant...</option>
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          {/* email */}
          <div>
            <label className="block font-mono text-[10px] text-[var(--text-muted)] uppercase tracking-widest mb-1.5">
              Operative Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="agent@domain.com"
              className="admin-input"
              disabled={deploying}
            />
          </div>

          {/* name */}
          <div>
            <label className="block font-mono text-[10px] text-[var(--text-muted)] uppercase tracking-widest mb-1.5">
              Operative Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name"
              className="admin-input"
              disabled={deploying}
            />
          </div>

          {/* password */}
          <div>
            <label className="block font-mono text-[10px] text-[var(--text-muted)] uppercase tracking-widest mb-1.5">
              Access Key (Password)
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Secure passphrase"
                className="admin-input flex-1"
                disabled={deploying}
              />
              <button
                type="button"
                onClick={() => setPassword(generatePassword())}
                className="admin-btn admin-btn-ghost whitespace-nowrap text-[10px] px-3"
                disabled={deploying}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mr-1.5">
                  <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
                </svg>
                GEN
              </button>
            </div>
          </div>

          {/* role */}
          <div>
            <label className="block font-mono text-[10px] text-[var(--text-muted)] uppercase tracking-widest mb-1.5">
              Clearance Level (Role)
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as ManagedUser["role"])}
              className="admin-input"
              disabled={deploying}
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r.toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          {/* deploy button */}
          <button
            onClick={handleDeploy}
            disabled={!canDeploy || deploying}
            className="admin-btn admin-btn-primary w-full py-3 text-sm tracking-widest"
          >
            {deploying ? (
              <span className="inline-flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                DEPLOYING OPERATIVE...
              </span>
            ) : (
              "DEPLOY USER"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  USER DETAIL EXPAND                                                 */
/* ------------------------------------------------------------------ */

function UserDetailPanel({
  user,
  onAction,
}: {
  user: ManagedUser;
  onAction: (action: string, userId: string) => void;
}) {
  return (
    <tr>
      <td colSpan={8} className="p-0">
        <div className="border-t border-[var(--border)] bg-[var(--hover-bg)]/80 backdrop-blur-sm">
          <div className="p-5 grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* profile */}
            <div className="space-y-3">
              <h4 className="font-mono text-[10px] text-accent uppercase tracking-widest">
                {'// Operative Profile'}
              </h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="font-mono text-[11px] text-[var(--text-muted)]">ID</span>
                  <span className="font-mono text-[11px] text-[var(--text-primary)]">{user.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-mono text-[11px] text-[var(--text-muted)]">EMAIL</span>
                  <span className="font-mono text-[11px] text-accent">{user.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-mono text-[11px] text-[var(--text-muted)]">CELL</span>
                  <span className="font-mono text-[11px] text-[var(--text-primary)]">{user.tenantName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-mono text-[11px] text-[var(--text-muted)]">CLEARANCE</span>
                  <RoleBadge role={user.role} />
                </div>
                <div className="flex justify-between">
                  <span className="font-mono text-[11px] text-[var(--text-muted)]">MFA</span>
                  <MfaIcon enabled={user.mfaEnabled} />
                </div>
                <div className="flex justify-between">
                  <span className="font-mono text-[11px] text-[var(--text-muted)]">DEPLOYED</span>
                  <span className="font-mono text-[11px] text-[var(--text-primary)]">{formatTimestamp(user.createdAt)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-mono text-[11px] text-[var(--text-muted)]">STATUS</span>
                  <StatusIndicator status={user.status} />
                </div>
              </div>
            </div>

            {/* login activity */}
            <div className="space-y-3">
              <h4 className="font-mono text-[10px] text-accent uppercase tracking-widest">
                {'// Access Log (Last 5)'}
              </h4>
              {user.loginHistory.length === 0 ? (
                <p className="font-mono text-[11px] text-[var(--text-muted)]">No login records found.</p>
              ) : (
                <div className="space-y-2">
                  {user.loginHistory.slice(0, 5).map((entry, i) => (
                    <div
                      key={i}
                      className="p-2 rounded border border-[var(--border)] bg-[var(--surface)] space-y-0.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[10px]" style={{ color: "var(--medium-text)" }}>{entry.ip}</span>
                        <span className="font-mono text-[10px] text-[var(--text-muted)]">
                          {relativeTime(entry.timestamp)}
                        </span>
                      </div>
                      <div className="font-mono text-[9px] text-[var(--text-muted)] truncate">
                        {entry.userAgent}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* actions */}
            <div className="space-y-3">
              <h4 className="font-mono text-[10px] text-accent uppercase tracking-widest">
                {'// Operative Controls'}
              </h4>
              <div className="space-y-2">
                <button
                  onClick={() => onAction("reset-password", user.id)}
                  className="admin-btn admin-btn-ghost w-full text-[11px] justify-start gap-2 py-2.5"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
                  </svg>
                  RESET ACCESS KEY
                </button>
                <button
                  onClick={() => onAction("toggle-mfa", user.id)}
                  className="admin-btn admin-btn-ghost w-full text-[11px] justify-start gap-2 py-2.5"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  {user.mfaEnabled ? "DISABLE MFA" : "ENABLE MFA"}
                </button>
                <button
                  onClick={() => onAction("change-role", user.id)}
                  className="admin-btn admin-btn-ghost w-full text-[11px] justify-start gap-2 py-2.5"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="8.5" cy="7" r="4" />
                    <line x1="20" y1="8" x2="20" y2="14" />
                    <line x1="23" y1="11" x2="17" y2="11" />
                  </svg>
                  CHANGE CLEARANCE
                </button>
                <button
                  onClick={() => onAction("toggle-status", user.id)}
                  className={`admin-btn w-full text-[11px] justify-start gap-2 py-2.5 border ${
                    user.status === "active"
                      ? "border-[var(--critical)]/30 text-[var(--critical-text)] hover:bg-[var(--critical-bg)]"
                      : "border-[var(--success)]/30 text-[var(--success-text)] hover:bg-[var(--accent-subtle)]"
                  } bg-transparent`}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    {user.status === "active" ? (
                      <>
                        <circle cx="12" cy="12" r="10" />
                        <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                      </>
                    ) : (
                      <>
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                        <polyline points="22 4 12 14.01 9 11.01" />
                      </>
                    )}
                  </svg>
                  {user.status === "active" ? "SUSPEND OPERATIVE" : "REACTIVATE OPERATIVE"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </td>
    </tr>
  );
}

/* ------------------------------------------------------------------ */
/*  MAIN PAGE                                                          */
/* ------------------------------------------------------------------ */

// REAL IMPL (BLACKFYRE 2026-06): the 25-row DEMO_USERS dataset (fabricated PII —
// names, emails at real companies, login history and IP addresses) and the
// DEMO_MODE bypass have been removed. The user directory is sourced only from
// the live API (api.getAdminUsers). Empty/error states are honest.

export default function UsersPage() {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  /* filters */
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [tenantFilter, setTenantFilter] = useState<string>("all");
  const [mfaFilter, setMfaFilter] = useState<string>("all");

  /* REAL IMPL (BLACKFYRE 2026-06): always fetch users from the live API. No
     demo bypass, no fabricated user PII. */
  useEffect(() => {
    api.getAdminUsers()
      .then((res) => {
        const apiUsers: ManagedUser[] = (res.users ?? []).map((u: AdminUser) => ({
          id: u.id,
          email: u.email,
          name: u.name,
          role: (u.role as ManagedUser["role"]) || "viewer",
          tenantId: u.tenantId || "",
          // REAL IMPL (BLACKFYRE 2026-06): show the real tenant id, or "—" when a
          // user has no tenant. The previous fallback inferred an org name from the
          // email domain — a synthetic guess, so it has been removed.
          tenantName: u.tenantId || "—",
          mfaEnabled: false,
          lastLogin: u.lastLogin,
          status: u.status === "disabled" || u.status === "locked" ? "suspended" : "active",
          createdAt: u.createdAt,
          loginHistory: [],
        }));
        setUsers(apiUsers);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  /* filtered users */
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const q = search.toLowerCase();
      if (q && !u.name.toLowerCase().includes(q) && !u.email.toLowerCase().includes(q)) {
        return false;
      }
      if (roleFilter !== "all" && u.role !== roleFilter) return false;
      if (tenantFilter !== "all" && u.tenantName !== tenantFilter) return false;
      if (mfaFilter === "enabled" && !u.mfaEnabled) return false;
      if (mfaFilter === "disabled" && u.mfaEnabled) return false;
      return true;
    });
  }, [users, search, roleFilter, tenantFilter, mfaFilter]);

  /* derive tenants from loaded users */
  const tenants = useMemo<{ id: string; name: string }[]>(() => {
    const seen = new Map<string, string>();
    for (const u of users) { if (!seen.has(u.tenantId)) seen.set(u.tenantId, u.tenantName); }
    return [...seen.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [users]);

  /* stats */
  const stats = useMemo(() => {
    const active = users.filter((u) => u.status === "active").length;
    const mfaOn = users.filter((u) => u.mfaEnabled).length;
    return { total: users.length, active, suspended: users.length - active, mfaOn };
  }, [users]);

  /* handlers */
  const handleUserCreated = useCallback((user: ManagedUser) => {
    setUsers((prev) => [user, ...prev]);
  }, []);

  const handleAction = useCallback(async (action: string, userId: string) => {
    const user = users.find((u) => u.id === userId);
    if (!user) return;
    switch (action) {
      case "toggle-mfa":
        setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, mfaEnabled: !u.mfaEnabled } : u));
        break;
      case "toggle-status":
        setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, status: u.status === "active" ? "suspended" as const : "active" as const } : u));
        break;
      case "change-role": {
        const idx = ROLES.indexOf(user.role);
        const nextRole = ROLES[(idx + 1) % ROLES.length];
        try {
          await api.updateAdminUser(userId, { role: nextRole });
          setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, role: nextRole } : u));
        } catch (err) {
          alert(err instanceof Error ? err.message : "Failed to update role");
        }
        break;
      }
      case "reset-password":
        break;
      default:
        break;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---- RENDER ---- */

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="flex flex-col items-center gap-3">
        <svg className="animate-spin h-8 w-8 text-accent" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <span className="font-mono text-xs text-[var(--text-muted)] tracking-widest">LOADING USER DIRECTORY...</span>
      </div>
    </div>
  );

  if (error) return (
    <div className="flex items-center justify-center h-64">
      <div className="admin-card border-red-500/40 p-6 text-center max-w-md">
        <p className="font-mono text-xs tracking-wider" style={{ color: "var(--critical-text)" }}>FAILED TO LOAD USERS</p>
        <p className="font-mono text-[11px] text-[var(--text-muted)] mt-2">{error}</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* ---- HEADER ---- */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div
            className="mono text-[11px] font-semibold"
            style={{ color: "var(--text-muted)", letterSpacing: "0.14em", textTransform: "uppercase" }}
          >
            Admin · Users
          </div>
          <h1
            className="mt-2 text-[30px] font-semibold tracking-tight"
            style={{ color: "var(--text-primary)", letterSpacing: "-0.025em" }}
          >
            User directory
          </h1>
          <p className="mt-1.5 text-[13px]" style={{ color: "var(--text-secondary)" }}>
            Operative management console · {stats.total} registered
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="admin-btn admin-btn-primary gap-2"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          CREATE USER
        </button>
      </div>

      {/* ---- STAT CARDS ---- */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "TOTAL OPERATIVES", value: stats.total, color: "text-accent" },
          { label: "ACTIVE", value: stats.active, color: "text-[var(--success-text)]" },
          { label: "SUSPENDED", value: stats.suspended, color: "text-[var(--critical-text)]" },
          { label: "MFA ENABLED", value: stats.mfaOn, color: "text-[var(--low-text)]" },
        ].map((s) => (
          <div
            key={s.label}
            className="admin-card p-4 relative overflow-hidden"
          >
            <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-indigo-300/30 to-transparent" />
            <p className="font-mono text-[10px] text-[var(--text-muted)] tracking-widest">{s.label}</p>
            <p className={`font-mono text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* ---- FILTERS ---- */}
      <div className="admin-card p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* search */}
          <div className="relative">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#555"
              strokeWidth="2"
              className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name / email..."
              className="admin-input pl-9"
            />
          </div>

          {/* role filter */}
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="admin-input"
          >
            <option value="all">All Roles</option>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r.charAt(0).toUpperCase() + r.slice(1)}
              </option>
            ))}
          </select>

          {/* tenant filter */}
          <select
            value={tenantFilter}
            onChange={(e) => setTenantFilter(e.target.value)}
            className="admin-input"
          >
            <option value="all">All Tenants</option>
            {tenants.map((t) => (
              <option key={t.id} value={t.name}>
                {t.name}
              </option>
            ))}
          </select>

          {/* mfa filter */}
          <select
            value={mfaFilter}
            onChange={(e) => setMfaFilter(e.target.value)}
            className="admin-input"
          >
            <option value="all">MFA: All</option>
            <option value="enabled">MFA: Enabled</option>
            <option value="disabled">MFA: Disabled</option>
          </select>
        </div>
      </div>

      {/* ---- TABLE ---- */}
      <div className="admin-card overflow-hidden relative">
        {/* top accent line */}
        <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-indigo-300/40 to-transparent" />

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--border)]">
                {["Name", "Email", "Tenant", "Role", "MFA", "Last Login", "Status", ""].map(
                  (h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left font-mono text-[10px] text-[var(--text-muted)] uppercase tracking-widest font-semibold"
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-16 text-center">
                    <div className="inline-flex flex-col items-center gap-3">
                      <svg className="animate-spin h-6 w-6 text-accent" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      <span className="font-mono text-[11px] text-[var(--text-muted)] tracking-widest">
                        LOADING OPERATIVE ROSTER...
                      </span>
                    </div>
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-16 text-center">
                    <div className="inline-flex flex-col items-center gap-2">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                      </svg>
                      <span className="font-mono text-[11px] text-[var(--text-muted)] tracking-widest">
                        NO OPERATIVES MATCH CURRENT FILTERS
                      </span>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <Fragment key={user.id}>
                    <tr
                      onClick={() =>
                        setExpandedUserId((prev) => (prev === user.id ? null : user.id))
                      }
                      className={`border-b border-[var(--border)] cursor-pointer transition-all duration-200 group
                        ${expandedUserId === user.id ? "bg-[var(--hover-bg)]" : "hover:bg-[var(--hover-bg)]"}`}
                    >
                      {/* name */}
                      <td className="px-4 py-3">
                        <span className="font-mono text-sm group-hover:text-accent transition-colors" style={{ color: "var(--text-primary)" }}>
                          {user.name}
                        </span>
                      </td>

                      {/* email */}
                      <td className="px-4 py-3">
                        <span className="font-mono text-[12px] text-accent">
                          {user.email}
                        </span>
                      </td>

                      {/* tenant */}
                      <td className="px-4 py-3">
                        <span className="font-mono text-[12px] text-[var(--text-muted)]">
                          {user.tenantName}
                        </span>
                      </td>

                      {/* role */}
                      <td className="px-4 py-3">
                        <RoleBadge role={user.role} />
                      </td>

                      {/* mfa */}
                      <td className="px-4 py-3">
                        <MfaIcon enabled={user.mfaEnabled} />
                      </td>

                      {/* last login */}
                      <td className="px-4 py-3">
                        <span className="font-mono text-[12px] text-[var(--text-muted)]">
                          {relativeTime(user.lastLogin)}
                        </span>
                      </td>

                      {/* status */}
                      <td className="px-4 py-3">
                        <StatusIndicator status={user.status} />
                      </td>

                      {/* expand indicator */}
                      <td className="px-4 py-3 text-right">
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="#555"
                          strokeWidth="2"
                          className={`inline-block transition-transform duration-200 ${
                            expandedUserId === user.id ? "rotate-180" : ""
                          }`}
                        >
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      </td>
                    </tr>

                    {expandedUserId === user.id && (
                      <UserDetailPanel
                        key={`${user.id}-detail`}
                        user={user}
                        onAction={handleAction}
                      />
                    )}
                  </Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* bottom count */}
        {!loading && (
          <div className="px-4 py-2.5 border-t border-[var(--border)]/50 flex items-center justify-between">
            <span className="font-mono text-[10px] text-[var(--text-muted)] tracking-widest">
              SHOWING {filteredUsers.length} OF {users.length} OPERATIVES
            </span>
            <span className="font-mono text-[10px] text-[var(--text-muted)] tracking-widest">
              SYS.CLOCK {new Date().toLocaleTimeString("en-US", { hour12: false })}
            </span>
          </div>
        )}
      </div>

      {/* ---- CREATE MODAL ---- */}
      <CreateUserModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={handleUserCreated}
        tenants={tenants}
      />
    </div>
  );
}
