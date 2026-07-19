"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  badge?: string;
  hot?: boolean;
}

interface NavGroup {
  heading: string;
  items: NavItem[];
}

/* ---- SVG Icons (inline, 18x18) ---- */

function DashboardIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
    </svg>
  );
}

function ClientsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function ScansIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><line x1="22" y1="12" x2="18" y2="12" /><line x1="6" y1="12" x2="2" y2="12" /><line x1="12" y1="6" x2="12" y2="2" /><line x1="12" y1="22" x2="12" y2="18" />
    </svg>
  );
}

function FindingsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function ComplianceIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function BillingIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  );
}

function AuditIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  );
}

function LeadsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function ReportsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  );
}

function AIGovernanceIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 4.44-1.66Z" />
      <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-4.44-1.66Z" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

/* ---- Nav structure (matches HaloAdmin sections) ---- */

const navGroups: NavGroup[] = [
  {
    heading: "Operations",
    items: [
      { label: "Overview",      href: "/",              icon: <DashboardIcon />    },
      { label: "Clients",       href: "/clients",       icon: <ClientsIcon />,      badge: "6"            },
      { label: "Scans",         href: "/scans",         icon: <ScansIcon />,        badge: "34"           },
      { label: "Findings",      href: "/findings",      icon: <FindingsIcon />,     badge: "23", hot: true },
      { label: "Compliance",    href: "/compliance",    icon: <ComplianceIcon />    },
      { label: "AI Governance", href: "/ai-governance", icon: <AIGovernanceIcon /> },
      { label: "Reports",       href: "/reports",       icon: <ReportsIcon />      },
      { label: "Audit Logs",    href: "/audit-logs",    icon: <AuditIcon />        },
      { label: "Leads",         href: "/contact-submissions", icon: <LeadsIcon /> },
    ],
  },
  {
    heading: "Org",
    items: [
      { label: "Billing",  href: "/billing",  icon: <BillingIcon />  },
      { label: "Users",    href: "/users",    icon: <UsersIcon />    },
      { label: "Settings", href: "/settings", icon: <SettingsIcon /> },
    ],
  },
];

interface SidebarProps {
  mobileOpen?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ mobileOpen = false, onClose }: SidebarProps) {
  const [expanded, setExpanded] = useState(true);
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  return (
    <aside
      className={[
        "fixed left-0 top-0 h-screen flex flex-col transition-all duration-300 ease-in-out z-50 overflow-hidden",
        "max-lg:translate-x-[-100%] max-lg:w-[240px]",
        mobileOpen ? "max-lg:translate-x-0" : "",
      ].join(" ")}
      style={{
        width: expanded ? 240 : 64,
        background: "var(--sidebar-bg)",
        borderRight: "1px solid var(--sidebar-border)",
      }}
    >
      {/* Logo — Blackfyre wordmark + mono admin tag */}
      <div
        className="h-16 flex items-center px-3.5 shrink-0"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        {expanded ? (
          <div className="flex items-center gap-2.5 whitespace-nowrap flex-1 min-w-0">
            <Link href="/" aria-label="Blackfyre — home" className="flex items-center shrink-0">
              <img
                src="/logo-blackfyre.png"
                alt="Blackfyre"
                height={40}
                width={172}
                className="h-10 w-auto select-none"
                draggable={false}
              />
            </Link>
            <div className="flex-1 min-w-0 leading-tight">
              <div
                className="mono text-[9px]"
                style={{
                  color: "var(--text-muted)",
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  lineHeight: 1.2,
                }}
              >
                Admin · V2.14
              </div>
            </div>
            {/* Close button — mobile only */}
            <button
              onClick={onClose}
              className="lg:hidden shrink-0 p-1 rounded transition-colors"
              style={{ color: "var(--text-muted)" }}
              aria-label="Close sidebar"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        ) : (
          <Link
            href="/"
            aria-label="Blackfyre — home"
            className="inline-block mx-auto"
            style={{
              width: 16,
              height: 16,
              borderRadius: 3,
              background: "var(--accent)",
              transform: "rotate(45deg)",
              boxShadow: "0 0 12px rgba(91,131,247,0.35)",
            }}
          />
        )}
      </div>

      {/* Navigation — grouped with mono section headings */}
      <nav className="flex-1 py-3 overflow-y-auto overflow-x-hidden">
        {navGroups.map((group, gi) => (
          <div key={group.heading} className={gi > 0 ? "mt-5" : ""}>
            {expanded && (
              <div
                className="px-3 mb-1.5 text-[10px] font-semibold"
                style={{
                  fontFamily: "var(--font-mono), 'JetBrains Mono', monospace",
                  color: "var(--text-muted)",
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                }}
              >
                {group.heading}
              </div>
            )}
            <ul className="space-y-0.5 px-1.5">
              {group.items.map((item) => {
                const active = isActive(item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      title={!expanded ? item.label : undefined}
                      className="flex items-center h-9 px-2.5 gap-2.5 rounded-lg text-[13px] font-medium transition-all duration-150 relative"
                      style={{
                        background: active ? "var(--accent-subtle)" : "transparent",
                        color: active ? "var(--accent)" : "var(--text-secondary)",
                        fontWeight: active ? 600 : 500,
                      }}
                      onMouseEnter={(e) => {
                        if (!active) {
                          (e.currentTarget as HTMLElement).style.background = "var(--hover-bg)";
                          (e.currentTarget as HTMLElement).style.color = "var(--text-primary)";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!active) {
                          (e.currentTarget as HTMLElement).style.background = "transparent";
                          (e.currentTarget as HTMLElement).style.color = "var(--text-secondary)";
                        }
                      }}
                    >
                      {active && (
                        <span
                          className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-r-full"
                          style={{ background: "var(--accent)" }}
                        />
                      )}
                      <span className="shrink-0 flex items-center justify-center w-[18px]">
                        {item.icon}
                      </span>
                      <span
                        className="whitespace-nowrap transition-opacity duration-200 flex-1"
                        style={{ opacity: expanded ? 1 : 0 }}
                      >
                        {item.label}
                      </span>
                      {expanded && item.badge && (
                        <span
                          className="mono shrink-0 text-[10px] font-semibold tabular-nums"
                          style={{
                            padding: "1px 6px",
                            borderRadius: 3,
                            background: item.hot ? "var(--high-bg)" : "var(--border)",
                            color: item.hot ? "var(--high-text)" : "var(--text-muted)",
                            letterSpacing: "0.02em",
                          }}
                        >
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Collapse toggle */}
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

      {/* User / Logout — real auth context */}
      <div className="p-2 shrink-0" style={{ borderTop: "1px solid var(--border)" }}>
        {expanded ? (
          <div className="flex items-center gap-2.5 px-2 py-1.5">
            <div
              className="w-8 h-8 rounded-md flex items-center justify-center text-[12px] font-bold shrink-0 mono"
              style={{
                background: "var(--accent-gradient)",
                color: "var(--accent-fg)",
              }}
            >
              {(user?.name?.charAt(0) || user?.email?.charAt(0) || "A").toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-medium truncate" style={{ color: "var(--text-primary)" }}>
                {user?.name || user?.email?.split("@")[0] || "Admin"}
              </p>
              <p className="text-[10.5px] truncate" style={{ color: "var(--text-muted)" }}>
                {user?.role ? `${user.role} · Blackfyre` : "Admin · Blackfyre"}
              </p>
            </div>
            <button
              onClick={logout}
              className="shrink-0 transition-colors"
              style={{ color: "var(--text-muted)" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--critical)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--text-muted)"; }}
              aria-label="Logout"
            >
              <LogoutIcon />
            </button>
          </div>
        ) : (
          <button
            onClick={logout}
            className="w-full flex items-center justify-center h-9 rounded-lg transition-colors"
            style={{ color: "var(--text-muted)" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--critical)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--text-muted)"; }}
            aria-label="Logout"
          >
            <LogoutIcon />
          </button>
        )}
      </div>
    </aside>
  );
}
