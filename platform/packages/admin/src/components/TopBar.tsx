"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { ThemeToggle } from "@blackfyre/ui";
import { useNow } from "@/lib/halo-hooks";
import HaloStatusDot from "@/components/halo/HaloStatusDot";

const COMMAND_PHRASES = [
  "scan --all-clouds",
  "rotate secrets --critical",
  "evidence export --soc2",
  "agents list --active",
] as const;

const routeTitles: Record<string, string> = {
  "/": "Command Center",
  "/clients": "Clients",
  "/users": "Users",
  "/scans": "Scans",
  "/findings": "Findings",
  "/compliance": "Compliance",
  "/billing": "Billing",
  "/audit-logs": "Audit Logs",
  "/settings": "Settings",
  "/reports": "Reports",
  "/ai-governance": "AI Governance",
};

function BellIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

function ChevronDown() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

interface TopBarProps {
  onMobileMenuToggle?: () => void;
}

/**
 * Halo command-palette top bar: typewriter-animated slash-command hint
 * that rotates through `COMMAND_PHRASES`, live UTC clock, "all systems
 * nominal" accent pulse, theme toggle, notifications, and the user
 * dropdown wired to real auth context.
 */
export default function TopBar({ onMobileMenuToggle }: TopBarProps) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // Typewriter: type out the current phrase char-by-char, pause, advance
  const [phraseIdx, setPhraseIdx] = useState(0);
  const [cmd, setCmd] = useState("");
  useEffect(() => {
    const target = COMMAND_PHRASES[phraseIdx];
    let i = 0;
    setCmd("");
    const typer = setInterval(() => {
      i += 1;
      setCmd(target.slice(0, i));
      if (i >= target.length) {
        clearInterval(typer);
      }
    }, 55);
    const advance = setTimeout(
      () => setPhraseIdx((p) => (p + 1) % COMMAND_PHRASES.length),
      target.length * 55 + 1600,
    );
    return () => {
      clearInterval(typer);
      clearTimeout(advance);
    };
  }, [phraseIdx]);

  const now = useNow(1000);
  const utc = now.toISOString().substring(11, 19); // HH:MM:SS

  const title =
    routeTitles[pathname] ||
    pathname
      .replace("/", "")
      .replace(/-/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <header
      className="h-14 flex items-center justify-between px-6 gap-4 shrink-0"
      style={{
        background: "var(--bg)",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <div className="flex items-center gap-3 min-w-0">
        {/* Hamburger menu — mobile only */}
        <button
          onClick={onMobileMenuToggle}
          className="lg:hidden p-2 rounded-lg transition-colors hover:bg-[var(--hover-bg)] hover:text-[var(--text-primary)]"
          style={{ color: "var(--text-secondary)" }}
          aria-label="Open sidebar"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>

        {/* Halo command palette — typewriter phrase + blinking cursor */}
        <div
          className="hidden sm:flex items-center gap-2 px-3.5 py-2 rounded-lg min-w-0"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            fontFamily: "var(--font-mono), 'JetBrains Mono', monospace",
            fontSize: 13,
            maxWidth: 480,
            flex: 1,
          }}
        >
          <span style={{ color: "var(--accent)" }}>▸</span>
          <span
            className="truncate"
            style={{ color: "var(--text-primary)" }}
          >
            {cmd}
          </span>
          <span
            className="inline-block shrink-0"
            style={{
              width: 7,
              height: 13,
              background: "var(--accent)",
              animation: "halocursor 0.8s steps(1) infinite",
              marginLeft: 2,
            }}
            aria-hidden="true"
          />
          <kbd
            className="ml-auto hidden md:inline-block shrink-0"
            style={{
              background: "var(--border-subtle)",
              color: "var(--text-muted)",
              border: "1px solid var(--border)",
              fontFamily: "inherit",
              fontSize: 10,
              padding: "1px 5px",
              borderRadius: 3,
            }}
          >
            ⌘K
          </kbd>
        </div>

        {/* Page title — mobile-visible fallback when command palette is hidden */}
        <h1
          className="sm:hidden text-[15px] font-semibold tracking-tight truncate"
          style={{ color: "var(--text-primary)" }}
        >
          {title}
        </h1>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-3 shrink-0">
        {/* UTC clock */}
        <span
          className="hidden lg:inline mono text-[11px] tabular-nums"
          style={{ color: "var(--text-secondary)" }}
        >
          {utc} UTC
        </span>

        {/* All systems nominal — accent pulse */}
        <span
          className="hidden xl:flex items-center gap-1.5 mono text-[11px]"
          style={{ color: "var(--accent)" }}
        >
          <HaloStatusDot color="var(--accent)" size="sm" />
          All systems nominal
        </span>

        {/* Notifications */}
        <button
          className="relative p-2 rounded-lg transition-colors hover:bg-[var(--hover-bg)] hover:text-[var(--text-primary)]"
          style={{ color: "var(--text-secondary)" }}
          aria-label="Notifications"
        >
          <BellIcon />
          <span
            className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full border-2"
            style={{ background: "var(--critical)", borderColor: "var(--bg)" }}
          />
        </button>

        {/* Theme toggle */}
        <ThemeToggle />

        {/* User dropdown */}
        <div className="relative">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg transition-colors hover:bg-[var(--hover-bg)]"
            style={{ color: "var(--text-secondary)" }}
          >
            <div
              className="w-6 h-6 rounded-md flex items-center justify-center text-[11px] font-bold mono"
              style={{
                background: "linear-gradient(135deg, var(--accent), #33FFA0)",
                color: "#0A0A0B",
              }}
            >
              {(user?.name?.charAt(0) || user?.email?.charAt(0) || "A").toUpperCase()}
            </div>
            <span
              className="hidden sm:block text-[13px] font-medium"
              style={{ color: "var(--text-primary)" }}
            >
              {user?.name || user?.email?.split("@")[0] || "Admin"}
            </span>
            <span style={{ color: "var(--text-muted)" }}>
              <ChevronDown />
            </span>
          </button>

          {dropdownOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setDropdownOpen(false)} />
              <div className="absolute right-0 top-full mt-1.5 w-56 z-50 dropdown">
                <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
                  <p className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>
                    {user?.name}
                  </p>
                  <p className="text-[11px] mt-0.5 font-mono" style={{ color: "var(--text-muted)" }}>
                    {user?.email}
                  </p>
                </div>
                <div className="py-1">
                  <button
                    onClick={() => { setDropdownOpen(false); logout(); }}
                    className="dropdown-item dropdown-item-danger w-full"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
                    Sign out
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Local keyframe for the blinking command-palette cursor */}
      <style jsx>{`
        @keyframes halocursor {
          0%, 49% { opacity: 1; }
          50%, 100% { opacity: 0; }
        }
      `}</style>
    </header>
  );
}
