"use client";

import { footer } from "@/components/bootcamp/content";
import { Reveal, Stagger, Item, Gradient, Sparkles } from "@/components/bootcamp/ui";

export default function Footer() {
  return (
    <footer
      aria-labelledby="bp-footer-heading"
      className="relative border-t border-[color:var(--bp-border)] px-5 py-16 sm:px-8 sm:py-20"
    >
      <h2 id="bp-footer-heading" className="sr-only">
        {footer.brand} site footer
      </h2>

      <div className="relative mx-auto w-full max-w-6xl">
        {/* Top row — brand + tagline on the left, link columns on the right */}
        <div className="grid gap-12 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:gap-16">
          {/* Brand block */}
          <Reveal>
            <a href="#top" className="inline-flex items-center gap-2.5">
              <span
                className="grid h-9 w-9 place-items-center rounded-xl bp-cta-glow"
                style={{ backgroundImage: "var(--bp-grad)" }}
                aria-hidden="true"
              >
                <Sparkles className="h-4 w-4 text-white" />
              </span>
              <span className="font-display text-[18px] font-semibold tracking-tight bp-fg">
                <Gradient>{footer.brand}</Gradient>
              </span>
            </a>
            <p className="mt-5 max-w-sm text-[15px] leading-relaxed bp-muted">
              {footer.tagline}
            </p>
          </Reveal>

          {/* Link columns */}
          <Stagger className="grid grid-cols-2 gap-8 sm:gap-10">
            {footer.columns.map((col) => (
              <Item key={col.title}>
                <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] bp-dim">
                  {col.title}
                </h3>
                <ul className="mt-4 space-y-3">
                  {col.links.map((link) => (
                    <li key={link.label}>
                      <a
                        href={link.href}
                        className="text-[14px] bp-muted transition-colors hover:text-[color:var(--bp-fg)]"
                      >
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </Item>
            ))}
          </Stagger>
        </div>

        {/* Bottom row — separated by a hairline */}
        <Reveal
          delay={0.1}
          className="mt-12 flex flex-col-reverse items-start gap-4 border-t border-[color:var(--bp-border)] pt-7 sm:flex-row sm:items-center sm:justify-between"
        >
          <p className="max-w-2xl text-[12.5px] leading-relaxed bp-dim">
            {footer.legal}
          </p>
          <p className="shrink-0 text-[12.5px] tracking-wide bp-dim">
            © 2026 {footer.brand}
          </p>
        </Reveal>
      </div>
    </footer>
  );
}
