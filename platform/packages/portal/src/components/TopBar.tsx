"use client";

import { usePathname } from "next/navigation";
import { ThemeToggle } from "@blackfyre/ui";

// ── Page title map ────────────────────────────────────────────────

const pageTitles: Record<string, string> = {
  "/":             "Dashboard",
  "/onboarding":   "Get Started",
  "/findings":     "Findings",
  "/compliance":   "Compliance",
  "/ai-ethics":    "AI Ethics",
  "/trust":        "Trust Center",
  "/privacy":      "Privacy Shield",
  "/remediation":  "Remediation",
  "/reports":      "Reports",
  "/evidence":     "Evidence Vault",
  "/monitoring":   "Monitoring",
  "/team":         "Team",
  "/integrations": "Integrations",
  "/settings":     "Settings",
};

// ── Icons ─────────────────────────────────────────────────────────

function MenuIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 01-3.46 0" />
    </svg>
  );
}

// ── TopBar ────────────────────────────────────────────────────────

export default function TopBar({ onMenuToggle }: { onMenuToggle?: () => void }) {
  const pathname = usePathname();

  // Derive title: exact match first, then prefix match for nested routes
  const title =
    pageTitles[pathname] ??
    Object.entries(pageTitles)
      .sort(([a], [b]) => b.length - a.length)
      .find(([path]) => path !== "/" && pathname.startsWith(path))?.[1] ??
    "Dashboard";

  return (
    <header
      className="sticky top-0 z-30 flex items-center justify-between px-4 lg:px-6 border-b border-[var(--border)]"
      style={{ height: "56px", background: "var(--bg-elevated)", backdropFilter: "blur(12px)" }}
    >
      {/* ── Left: hamburger + page title ── */}
      <div className="flex items-center gap-3">
        {onMenuToggle && (
          <button
            onClick={onMenuToggle}
            className="lg:hidden p-2 -ml-1 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--hover-bg)] transition-colors duration-[var(--duration-fast)]"
            aria-label="Open navigation menu"
          >
            <MenuIcon />
          </button>
        )}
        <h1 className="text-base font-semibold text-[var(--text-primary)] tracking-tight">
          {title}
        </h1>
      </div>

      {/* ── Right: theme toggle, notifications, avatar ── */}
      <div className="flex items-center gap-1">
        {/* Theme toggle */}
        <ThemeToggle />

        {/* Notification bell */}
        <button
          className="relative p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--hover-bg)] transition-colors duration-[var(--duration-fast)]"
          aria-label="Notifications"
        >
          <BellIcon />
          {/* Unread dot */}
          <span
            className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full"
            style={{ background: "var(--accent)" }}
            aria-hidden="true"
          />
          <span className="sr-only">You have new notifications</span>
        </button>

        {/* Divider */}
        <div className="w-px h-5 bg-[var(--border)] mx-1" aria-hidden="true" />

        {/* User avatar */}
        <div className="flex items-center gap-2.5 pl-1">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ring-1 ring-[var(--border)]"
            style={{
              background: "var(--accent-subtle)",
              color: "var(--accent)",
            }}
            aria-hidden="true"
          >
            GK
          </div>
          <span className="hidden md:block text-sm font-medium text-[var(--text-secondary)]">
            Giridhar K.
          </span>
        </div>
      </div>
    </header>
  );
}
