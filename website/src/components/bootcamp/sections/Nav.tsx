"use client";

import { useEffect, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { nav } from "@/components/bootcamp/content";
import {
  ButtonLink,
  motion,
  useReducedMotion,
  Menu,
  X,
  ArrowRight,
  Sparkles,
} from "@/components/bootcamp/ui";

export default function BootcampNav() {
  const reduce = useReducedMotion();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  /* Glass-in once the page is scrolled past the hero's first fold. */
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /* Lock body scroll + close on Escape while the mobile sheet is open. */
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <header className="fixed inset-x-0 top-0 z-50">
      <motion.div
        initial={reduce ? false : { y: -24, opacity: 0 }}
        animate={reduce ? undefined : { y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className={`transition-[background,border-color,box-shadow,backdrop-filter] duration-300 ${
          scrolled || open
            ? "bp-glass border-b border-[color:var(--bp-border)]"
            : "border-b border-transparent bg-transparent"
        }`}
        style={{ borderRadius: 0 }}
      >
        <nav
          aria-label="Primary"
          className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-5 sm:h-[68px] sm:px-8"
        >
          {/* Brand */}
          <a
            href="#top"
            className="group inline-flex items-center gap-2.5 rounded-full"
            aria-label={`${nav.brand} — home`}
          >
            <span
              className="bp-cta-glow relative grid h-8 w-8 shrink-0 place-items-center rounded-[10px] text-white"
              style={{ backgroundImage: "var(--bp-grad)" }}
              aria-hidden="true"
            >
              <Sparkles className="h-4 w-4" />
            </span>
            <span className="font-display text-[15px] font-semibold leading-none tracking-[-0.01em] bp-fg">
              {/* Full brand on sm+, graceful short form on the smallest screens */}
              <span className="hidden sm:inline">{nav.brand}</span>
              <span className="sm:hidden">
                {nav.brand.replace(/\bBootcamp\b/, "").trim()}
              </span>
            </span>
          </a>

          {/* Desktop links */}
          <ul className="hidden items-center gap-1 md:flex">
            {nav.links.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  className="relative inline-block rounded-full px-3.5 py-2 text-[14px] font-medium bp-muted transition-colors duration-200 hover:text-[color:var(--bp-fg)]"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>

          {/* Right: desktop CTA + mobile menu trigger */}
          <div className="flex items-center gap-2">
            <div className="hidden md:block">
              <ButtonLink href={nav.cta.href} icon>
                {nav.cta.label}
              </ButtonLink>
            </div>

            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-label="Open menu"
              aria-expanded={open}
              aria-controls="bp-mobile-menu"
              className="bp-glass inline-flex h-11 w-11 items-center justify-center rounded-full bp-fg transition-colors hover:border-[color:var(--bp-border-strong)] md:hidden"
            >
              <Menu className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </nav>
      </motion.div>

      {/* Mobile full-screen glass sheet */}
      <AnimatePresence>
        {open && (
          <motion.div
            id="bp-mobile-menu"
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
            className="bp-glass-strong fixed inset-0 z-50 flex flex-col px-5 pb-10 pt-4 md:hidden"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: -12 }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -12 }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
          >
            {/* Sheet header mirrors the bar for zero layout shift */}
            <div className="flex h-16 items-center justify-between">
              <span className="inline-flex items-center gap-2.5">
                <span
                  className="bp-cta-glow grid h-8 w-8 place-items-center rounded-[10px] text-white"
                  style={{ backgroundImage: "var(--bp-grad)" }}
                  aria-hidden="true"
                >
                  <Sparkles className="h-4 w-4" />
                </span>
                <span className="font-display text-[15px] font-semibold tracking-[-0.01em] bp-fg">
                  {nav.brand.replace(/\bBootcamp\b/, "").trim()}
                </span>
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="bp-glass inline-flex h-11 w-11 items-center justify-center rounded-full bp-fg transition-colors hover:border-[color:var(--bp-border-strong)]"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            {/* Big links */}
            <motion.ul
              className="mt-6 flex flex-1 flex-col justify-center gap-1"
              initial={reduce ? false : "hidden"}
              animate={reduce ? undefined : "show"}
              variants={{
                show: { transition: { staggerChildren: 0.06, delayChildren: 0.08 } },
              }}
            >
              {nav.links.map((link) => (
                <motion.li
                  key={link.href}
                  variants={{
                    hidden: { opacity: 0, y: 14 },
                    show: {
                      opacity: 1,
                      y: 0,
                      transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] },
                    },
                  }}
                >
                  <a
                    href={link.href}
                    onClick={() => setOpen(false)}
                    className="group flex items-center justify-between border-b border-[color:var(--bp-border)] py-4 font-display text-[30px] font-semibold tracking-[-0.02em] bp-fg"
                  >
                    {link.label}
                    <ArrowRight
                      className="h-5 w-5 bp-dim transition-all duration-200 group-hover:translate-x-1 group-hover:text-[color:var(--bp-iris)]"
                      aria-hidden="true"
                    />
                  </a>
                </motion.li>
              ))}
            </motion.ul>

            {/* CTA pinned to the bottom */}
            <motion.div
              className="mt-8"
              initial={reduce ? false : { opacity: 0, y: 16 }}
              animate={reduce ? undefined : { opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.32 }}
            >
              <ButtonLink
                href={nav.cta.href}
                size="lg"
                icon
                className="w-full"
              >
                {nav.cta.label}
              </ButtonLink>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
