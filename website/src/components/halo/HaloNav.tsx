"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { SITE } from "@/data/site";
import ThemeToggle from "./ThemeToggle";

interface HaloNavLink {
  href: string;
  label: string;
}

// OSS-first primary nav. Every link points at a real route or an on-page
// section anchor (#) — no agency/services pages, no sales CTA.
const NAV_LINKS: HaloNavLink[] = [
  { href: "/platform", label: "Platform" },
  { href: "/agents", label: "Auditors" },
  { href: "/platform#frameworks", label: "Frameworks" },
  { href: "/docs", label: "Docs" },
  { href: "/self-host", label: "Self-host" },
  { href: "/pricing", label: "Pricing" },
  { href: "/contribute", label: "Contribute" },
  { href: "/blog", label: "Blog" },
];

function GitHubMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.605-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222 0 1.606-.014 2.898-.014 3.293 0 .322.216.694.825.576C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  );
}

function BrandMark() {
  return (
    <Link href="/" className="flex items-center gap-2.5 group" aria-label="Blackfyre — home">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/blackfyre-logomark.png"
        alt=""
        aria-hidden="true"
        width={221}
        height={48}
        className="mt-2 h-12 w-auto transition-transform group-hover:scale-[1.03]"
      />
    </Link>
  );
}

// Section-anchor links (containing "#") are never marked "active" — they jump
// within a page rather than owning a route.
function isRouteActive(href: string, pathname: string | null): boolean {
  if (href.includes("#")) return false;
  if (!pathname) return false;
  return pathname === href || (href !== "/" && pathname.startsWith(href + "/"));
}

export default function HaloNav() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  // Scroll-elevation state for backdrop-blur.
  // rAF-throttled so the listener stays cheap on long pages.
  useEffect(() => {
    let ticking = false;
    const handleScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        setScrolled(window.scrollY > 16);
        ticking = false;
      });
    };
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Body scroll lock + focus management while mobile sheet open
  useEffect(() => {
    if (menuOpen) {
      previouslyFocusedRef.current = document.activeElement as HTMLElement | null;
      document.body.style.overflow = "hidden";
      const t = window.setTimeout(() => closeButtonRef.current?.focus(), 0);
      return () => {
        document.body.style.overflow = "";
        window.clearTimeout(t);
      };
    }
    document.body.style.overflow = "";
    previouslyFocusedRef.current?.focus?.();
    return undefined;
  }, [menuOpen]);

  // Close on Escape
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  // Close sheet on route change
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  return (
    <>
      <header
        className={cn(
          "sticky top-0 z-40 border-b transition-all duration-300 ease-out",
          scrolled
            ? "border-border bg-bg/70 backdrop-blur-xl backdrop-saturate-150"
            : "border-transparent bg-transparent backdrop-blur-0",
        )}
      >
        <div className="mx-auto flex max-w-[1280px] items-center justify-between gap-6 px-6 py-4 md:px-12">
          <div className="flex items-center gap-8">
            <BrandMark />
            <nav
              className="hidden items-center gap-6 lg:flex"
              aria-label="Primary"
            >
              {NAV_LINKS.map((link) => {
                const isActive = isRouteActive(link.href, pathname);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={cn(
                      "relative font-sans text-[13.5px] transition-colors",
                      isActive
                        ? "text-text"
                        : "text-text-muted hover:text-text",
                    )}
                  >
                    {link.label}
                    {isActive && (
                      <span
                        aria-hidden="true"
                        className="absolute -bottom-1 left-0 right-0 h-[2px] bg-accent"
                      />
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="hidden items-center gap-3 lg:flex">
            <ThemeToggle />
            <span aria-hidden="true" className="mx-1 h-5 w-px bg-border" />
            <a
              href={SITE.repoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="halo-btn-ghost inline-flex items-center gap-2 !py-2.5 !text-[13px]"
            >
              <GitHubMark className="h-4 w-4" />
              GitHub
            </a>
            <a
              href={SITE.hostedUrl}
              className="halo-btn-accent !py-2.5 !text-[13px]"
            >
              Hosted option
            </a>
          </div>

          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
            aria-expanded={menuOpen}
            className="lg:hidden inline-flex h-9 w-9 items-center justify-center rounded-md border border-border text-text-muted transition-colors hover:text-text"
          >
            <Menu className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </header>

      {/* Mobile sheet */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Main menu"
        aria-hidden={!menuOpen}
        className={cn(
          "fixed inset-0 z-50 bg-bg transition-all duration-200 lg:hidden",
          menuOpen
            ? "pointer-events-auto translate-y-0 opacity-100"
            : "pointer-events-none -translate-y-1 opacity-0",
        )}
      >
        <div className="border-b border-border">
          <div className="flex items-center justify-between gap-4 px-6 py-4">
            <BrandMark />
            <button
              type="button"
              ref={closeButtonRef}
              onClick={() => setMenuOpen(false)}
              aria-label="Close menu"
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border text-text-muted transition-colors hover:text-text"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="flex h-[calc(100vh-65px)] flex-col justify-between overflow-y-auto px-6 py-10">
          <nav className="flex flex-col" aria-label="Mobile">
            <p className="halo-label mb-5">Menu</p>
            <ul className="flex flex-col">
              {NAV_LINKS.map((link, idx) => {
                const isActive = isRouteActive(link.href, pathname);
                return (
                  <li
                    key={link.href}
                    className={idx === 0 ? "" : "border-t border-border"}
                  >
                    <Link
                      href={link.href}
                      onClick={() => setMenuOpen(false)}
                      className={cn(
                        "block py-5 font-display text-[clamp(2rem,6vw,3rem)] font-medium leading-[1.02] tracking-display transition-colors",
                        isActive
                          ? "text-text"
                          : "text-text-muted hover:text-text",
                      )}
                    >
                      <span className="relative inline-block">
                        {link.label}
                        {isActive && (
                          <span
                            aria-hidden="true"
                            className="absolute -bottom-1 left-0 right-0 h-[2px] bg-accent"
                          />
                        )}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>

            <div className="mt-10 border-t border-border pt-8">
              <p className="halo-label mb-5">Preferences</p>
              <div className="flex items-center gap-4">
                <ThemeToggle />
              </div>
            </div>

            <div className="mt-10 border-t border-border pt-8">
              <p className="halo-label mb-5">Get started</p>
              <div className="flex flex-col items-stretch gap-3.5">
                <a
                  href={SITE.repoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setMenuOpen(false)}
                  className="halo-btn-ghost inline-flex items-center justify-center gap-2"
                >
                  <GitHubMark className="h-4 w-4" />
                  Star on GitHub
                </a>
                <a
                  href={SITE.hostedUrl}
                  onClick={() => setMenuOpen(false)}
                  className="halo-btn-accent text-center"
                >
                  Hosted option
                </a>
              </div>
            </div>
          </nav>

          <div className="mt-12">
            <div className="halo-hairline mb-5" />
            <p className="halo-label">
              Open source &middot; Apache-2.0
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
