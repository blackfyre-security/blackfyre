"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

// ── Icons: 20×20, 1.5px stroke, round caps/joins ─────────────────

function GridIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

function AlertTriangleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function ShieldCheckIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

function BrainIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9.5 2a2.5 2.5 0 015 0c0 .74-.33 1.4-.85 1.85A4 4 0 0116 8c0 .5-.09.98-.25 1.42A3.5 3.5 0 0118 13a3.5 3.5 0 01-3.5 3.5H9.5A3.5 3.5 0 016 13a3.5 3.5 0 012.25-3.28A4 4 0 018 8a4 4 0 012.35-3.65A2.5 2.5 0 019.5 2z" />
      <path d="M9 13a3 3 0 006 0" />
      <line x1="12" y1="16.5" x2="12" y2="21" />
      <line x1="9" y1="21" x2="15" y2="21" />
    </svg>
  );
}

function TrustCenterIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <circle cx="12" cy="11" r="2.5" />
      <path d="M12 13.5v3" />
    </svg>
  );
}

function PrivacyShieldIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="M9 10h6" />
      <path d="M12 7v6" />
    </svg>
  );
}

function WrenchIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" />
    </svg>
  );
}

function FileTextIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  );
}

function VaultIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <circle cx="12" cy="12" r="3" />
      <path d="M12 9V7" />
      <path d="M15 12h2" />
      <path d="M12 15v2" />
      <path d="M9 12H7" />
    </svg>
  );
}

function ActivityIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87" />
      <path d="M16 3.13a4 4 0 010 7.75" />
    </svg>
  );
}

function SlidersIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="4" y1="21" x2="4" y2="14" />
      <line x1="4" y1="10" x2="4" y2="3" />
      <line x1="12" y1="21" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12" y2="3" />
      <line x1="20" y1="21" x2="20" y2="16" />
      <line x1="20" y1="12" x2="20" y2="3" />
      <line x1="1" y1="14" x2="7" y2="14" />
      <line x1="9" y1="8" x2="15" y2="8" />
      <line x1="17" y1="16" x2="23" y2="16" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
  );
}

function RocketIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 00-2.91-.09z" />
      <path d="M12 15l-3-3a22 22 0 012-3.95A12.88 12.88 0 0122 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 01-4 2z" />
      <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
      <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
    </svg>
  );
}

// ── Nav Structure (Grouped + Tier-Gated) ─────────────────────────

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  requiredTier?: "protect" | "defend";
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    title: "Overview",
    items: [
      { label: "Dashboard",   href: "/",           icon: <GridIcon /> },
      { label: "Compliance",   href: "/compliance", icon: <ShieldCheckIcon /> },
      { label: "Insights",     href: "/insights",   icon: <RocketIcon /> },
    ],
  },
  {
    title: "Security",
    items: [
      { label: "Scans",       href: "/scans",      icon: <ActivityIcon /> },
      { label: "Findings",    href: "/findings",   icon: <AlertTriangleIcon /> },
      { label: "Monitoring",  href: "/monitoring",  icon: <ActivityIcon /> },
      { label: "Threats",     href: "/threats",     icon: <AlertTriangleIcon />, requiredTier: "protect" },
    ],
  },
  {
    title: "Action",
    items: [
      { label: "Remediation", href: "/remediation", icon: <WrenchIcon /> },
      { label: "Autopilot",   href: "/autopilot",   icon: <RocketIcon />, requiredTier: "defend" },
      { label: "Incidents",   href: "/incidents",    icon: <AlertTriangleIcon />, requiredTier: "defend" },
    ],
  },
  {
    title: "Evidence",
    items: [
      { label: "Evidence Vault", href: "/evidence", icon: <VaultIcon /> },
      { label: "Reports",       href: "/reports",   icon: <FileTextIcon /> },
    ],
  },
  {
    title: "Intelligence",
    items: [
      { label: "AI Copilot",     href: "/copilot",       icon: <BrainIcon />, requiredTier: "protect" },
      { label: "Calendar",       href: "/calendar",      icon: <FileTextIcon />, requiredTier: "protect" },
      { label: "Regulatory",     href: "/regulatory",    icon: <ShieldCheckIcon />, requiredTier: "protect" },
      { label: "AI Governance",  href: "/ai-governance", icon: <BrainIcon />, requiredTier: "protect" },
    ],
  },
  {
    title: "Manage",
    items: [
      { label: "Integrations", href: "/integrations", icon: <SlidersIcon /> },
      { label: "Team",         href: "/team",          icon: <UsersIcon /> },
      { label: "Settings",     href: "/settings",      icon: <SettingsIcon /> },
    ],
  },
];

// ── Sidebar ───────────────────────────────────────────────────────

export default function Sidebar({ open, onClose, tier = "comply" }: { open?: boolean; onClose?: () => void; tier?: "comply" | "protect" | "defend" }) {
  const [expanded, setExpanded] = useState(true);
  const pathname = usePathname();

  const TIER_RANK = { comply: 0, protect: 1, defend: 2 };
  const canAccess = (requiredTier?: "protect" | "defend") => !requiredTier || TIER_RANK[tier] >= TIER_RANK[requiredTier];

  // Close on route change (mobile)
  useEffect(() => {
    if (onClose) onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  const navContent = (
    <>
      {/* ── Logo ── */}
      <div className="h-16 flex items-center gap-2.5 px-3.5 border-b border-[var(--border)] shrink-0">
        {expanded ? (
          <Link href="/" aria-label="Blackfyre — home" className="flex items-center shrink-0">
            <img
              src="/logo-blackfyre.png"
              alt="Blackfyre"
              height={56}
              width={168}
              className="h-14 w-auto select-none"
              draggable={false}
            />
          </Link>
        ) : (
          <Link
            href="/"
            aria-label="Blackfyre — home"
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mx-auto"
            style={{ background: "var(--accent-gradient)" }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </Link>
        )}
        {onClose && expanded && (
          <button
            onClick={onClose}
            className="ml-auto p-1.5 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--hover-bg)] transition-colors lg:hidden"
            aria-label="Close navigation"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>

      {/* ── Navigation ── */}
      <nav className="flex-1 overflow-y-auto py-2 px-3" aria-label="Main navigation">
        {navGroups.map((group) => (
          <div key={group.title} className="mb-2">
            {expanded && (
              <div className="px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)] select-none">
                {group.title}
              </div>
            )}
            <ul className="space-y-px" role="list">
              {group.items.map((item) => {
                const active = isActive(item.href);
                const locked = !canAccess(item.requiredTier);
                return (
                  <li key={item.href}>
                    <Link
                      href={locked ? "#" : item.href}
                      title={!expanded ? item.label : undefined}
                      aria-current={active ? "page" : undefined}
                      className={`sidebar-item ${active ? "active" : ""} ${locked ? "opacity-50" : ""}`}
                      style={!expanded ? { justifyContent: "center", padding: "8px" } : undefined}
                      onClick={locked ? (e) => e.preventDefault() : undefined}
                    >
                      <span className="shrink-0">{item.icon}</span>
                      {expanded && <span className="flex-1">{item.label}</span>}
                      {locked && expanded && (
                        <span className="text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-900/30 text-amber-400 border border-amber-700/30 ml-auto">
                          {item.requiredTier === "defend" ? "Defend" : "Protect"}
                        </span>
                      )}
                      {active && expanded && !locked && (
                        <span className="ml-auto w-1.5 h-1.5 rounded-full" style={{ background: "var(--accent)", boxShadow: "0 0 6px var(--accent)" }} />
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* ── Collapse toggle ── */}
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          padding: "8px",
          border: "none",
          background: "transparent",
          cursor: "pointer",
          color: "var(--text-muted)",
          transition: "color 150ms ease",
        }}
        aria-label={expanded ? "Collapse sidebar" : "Expand sidebar"}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: expanded ? "rotate(0deg)" : "rotate(180deg)", transition: "transform 200ms ease" }}>
          <polyline points="11 17 6 12 11 7" />
          <polyline points="18 17 13 12 18 7" />
        </svg>
      </button>

      {/* ── User ── */}
      <div className="p-4 border-t border-[var(--border)] shrink-0">
        <div className="flex items-center gap-3" style={!expanded ? { justifyContent: "center" } : undefined}>
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
            style={{
              background: "var(--accent-subtle)",
              color: "var(--accent)",
            }}
            aria-hidden="true"
          >
            GK
          </div>
          {expanded && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[var(--text-primary)] truncate leading-tight">
                Giridhar K.
              </p>
              <p className="text-xs text-[var(--text-muted)] leading-tight">Owner</p>
            </div>
          )}
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* ── Mobile overlay ── */}
      {open && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* ── Sidebar panel ── */}
      <aside
        className={[
          "fixed top-0 left-0 h-screen z-50 flex flex-col",
          "bg-[var(--sidebar-bg)] border-r border-[var(--border)]",
          "transition-all duration-200 ease-[var(--ease-smooth)]",
          open ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        ].join(" ")}
        style={{ width: expanded ? 240 : 64 }}
        aria-label="Sidebar"
      >
        {navContent}
      </aside>
    </>
  );
}
