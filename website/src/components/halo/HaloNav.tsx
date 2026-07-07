"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import ThemeToggle from "./ThemeToggle";

const PORTAL_URL = process.env.NEXT_PUBLIC_PORTAL_URL || "https://app.blackfyre.tech";

interface HaloNavChild {
  href: string;
  label: string;
  desc: string;
}

interface HaloNavLink {
  href: string;
  label: string;
  children?: HaloNavChild[];
}

// Real routes on the site. "Docs" doesn't have a dedicated route yet so it
// points at /blog as the closest live equivalent. "Services" is a dropdown so
// the software-delivery pages (/webapp, /mobile) have a top-level entry point.
const NAV_LINKS: HaloNavLink[] = [
  { href: "/platform", label: "Platform" },
  {
    href: "/services",
    label: "Services",
    children: [
      {
        href: "/services",
        label: "Security & advisory",
        desc: "vCISO, VAPT, compliance, AI security",
      },
      {
        href: "/webapp",
        label: "Web development",
        desc: "Marketing sites, SaaS, internal tools",
      },
      {
        href: "/mobile",
        label: "Mobile apps",
        desc: "Android & iOS, native or cross-platform",
      },
    ],
  },
  { href: "/agents", label: "Agents" },
  { href: "/pricing", label: "Pricing" },
  { href: "/blog", label: "Docs" },
];

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

export default function HaloNav() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  // Scroll-elevation state for backdrop-blur.
  // We sweep through `scrolled` levels for a smooth blur ramp once the user
  // is past the hero. rAF-throttled so the listener stays cheap on long pages.
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
              className="hidden items-center gap-6 md:flex"
              aria-label="Primary"
            >
              {NAV_LINKS.map((link) => {
                const isActive =
                  pathname === link.href ||
                  (link.href !== "/" && pathname?.startsWith(link.href + "/")) ||
                  !!link.children?.some(
                    (c) =>
                      c.href !== "/services" &&
                      (pathname === c.href ||
                        pathname?.startsWith(c.href + "/")),
                  );

                if (link.children) {
                  return (
                    <div key={link.href} className="group relative">
                      <Link
                        href={link.href}
                        aria-haspopup="true"
                        className={cn(
                          "relative inline-flex items-center gap-1 font-sans text-[13.5px] transition-colors",
                          isActive
                            ? "text-text"
                            : "text-text-muted hover:text-text",
                        )}
                      >
                        {link.label}
                        <ChevronDown
                          className="h-3.5 w-3.5 transition-transform duration-200 group-hover:rotate-180"
                          aria-hidden="true"
                        />
                        {isActive && (
                          <span
                            aria-hidden="true"
                            className="absolute -bottom-1 left-0 right-[18px] h-[2px] bg-accent"
                          />
                        )}
                      </Link>
                      {/* pt-3 bridges the gap so the panel survives the hover hand-off */}
                      <div className="invisible absolute left-1/2 top-full z-50 w-[18rem] -translate-x-1/2 pt-3 opacity-0 transition-all duration-150 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
                        <div className="overflow-hidden rounded-xl border border-border-strong bg-surface p-1.5 shadow-halo-glow">
                          {link.children.map((child) => (
                            <Link
                              key={child.href + child.label}
                              href={child.href}
                              className="block rounded-lg px-3.5 py-2.5 transition-colors hover:bg-surface-alt"
                            >
                              <span className="block font-sans text-[13.5px] text-text">
                                {child.label}
                              </span>
                              <span className="mt-0.5 block font-sans text-[12px] leading-snug text-text-muted">
                                {child.desc}
                              </span>
                            </Link>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                }

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

          <div className="hidden items-center gap-3 md:flex">
            <ThemeToggle />
            <span
              aria-hidden="true"
              className="mx-1 h-5 w-px bg-border"
            />
            <Link
              href={`${PORTAL_URL}/login`}
              className="font-sans text-[13.5px] text-text-muted transition-colors hover:text-text"
            >
              Log in
            </Link>
            <Link
              href="/contact"
              className="rounded-md bg-accent px-3.5 py-2 font-sans text-[13px] font-medium text-[color:var(--accent-ink)] shadow-halo-glow transition-transform active:scale-[0.98]"
            >
              Talk to us
            </Link>
          </div>

          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
            aria-expanded={menuOpen}
            className="md:hidden inline-flex h-9 w-9 items-center justify-center rounded-md border border-border text-text-muted transition-colors hover:text-text"
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
          "fixed inset-0 z-50 bg-bg transition-all duration-200 md:hidden",
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
                const isActive =
                  pathname === link.href ||
                  (link.href !== "/" && pathname?.startsWith(link.href + "/")) ||
                  !!link.children?.some(
                    (c) =>
                      c.href !== "/services" &&
                      (pathname === c.href ||
                        pathname?.startsWith(c.href + "/")),
                  );
                // On mobile, the parent link already covers /services, so drop
                // the duplicate "Security & advisory" child and surface the
                // software-delivery pages as sub-links.
                const subLinks = link.children?.filter(
                  (c) => c.href !== link.href,
                );
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
                    {subLinks && subLinks.length > 0 && (
                      <ul className="-mt-1 mb-5 ml-1 flex flex-col gap-3.5">
                        {subLinks.map((child) => (
                          <li key={child.href}>
                            <Link
                              href={child.href}
                              onClick={() => setMenuOpen(false)}
                              className="block font-sans text-[15px] text-text-muted transition-colors hover:text-text"
                            >
                              {child.label}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
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
              <p className="halo-label mb-5">Account</p>
              <div className="flex flex-col items-start gap-5">
                <a
                  href={`${PORTAL_URL}/login`}
                  onClick={() => setMenuOpen(false)}
                  className="font-sans text-[13.5px] text-text-muted transition-colors hover:text-text"
                >
                  Log in
                </a>
                <Link
                  href="/contact"
                  onClick={() => setMenuOpen(false)}
                  className="rounded-md bg-accent px-4 py-2.5 font-sans text-[13px] font-medium text-[color:var(--accent-ink)] shadow-halo-glow"
                >
                  Talk to us
                </Link>
              </div>
            </div>
          </nav>

          <div className="mt-12">
            <div className="halo-hairline mb-5" />
            <p className="halo-label">
              Security &middot; Chennai &middot; 2026
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
