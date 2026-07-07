"use client";

import { useRef, useState, type KeyboardEvent } from "react";

interface QA {
  q: string;
  a: string;
}

const ITEMS: QA[] = [
  {
    q: "Do you design or just develop?",
    a: "We design and develop. Our team runs from Figma through production. If you bring a designer, we work with them; if not, we cover it end-to-end.",
  },
  {
    q: "Can you migrate our existing site?",
    a: "Yes. We prefer strangler-fig migrations — incremental, route-by-route — over big-bang rewrites. Content and SEO stay intact, redirects are planned up front, and the team keeps shipping to the live site while we move routes across.",
  },
  {
    q: "What stack do you default to?",
    a: "For marketing, Next.js static export or Astro. For SaaS, Next.js with tRPC and Postgres. For internal tools, the same plus OAuth and RBAC. We pick what fits the problem, not what looks best on the resume.",
  },
  {
    q: "How fast is 'fast'?",
    a: "Core Web Vitals all green, sub-2s LCP on mid-tier mobile, edge-cached where possible. We measure with real device labs and Lighthouse CI — not guess. Performance budgets are written into the brief.",
  },
  {
    q: "Do you handle hosting and domains?",
    a: "Yes. Vercel, Cloudflare, or AWS depending on the constraints. You own the account and the keys from day one — we operate it with you, we don't hold it hostage.",
  },
  {
    q: "What about accessibility?",
    a: "WCAG 2.1 AA is the floor. Keyboard navigation, focus states, semantic HTML, alt text, colour contrast — all audited with axe and manual screen-reader passes before ship.",
  },
];

export default function WebFAQ() {
  const [openIdx, setOpenIdx] = useState<number | null>(0);
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const focusButton = (index: number) => {
    const normalized = (index + ITEMS.length) % ITEMS.length;
    buttonRefs.current[normalized]?.focus();
  };

  const handleKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        focusButton(i + 1);
        break;
      case "ArrowUp":
        e.preventDefault();
        focusButton(i - 1);
        break;
      case "Home":
        e.preventDefault();
        focusButton(0);
        break;
      case "End":
        e.preventDefault();
        focusButton(ITEMS.length - 1);
        break;
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <ul className="divide-y divide-border border-y border-border">
        {ITEMS.map((item, i) => {
          const isOpen = openIdx === i;
          const panelId = `web-faq-panel-${i}`;
          const buttonId = `web-faq-button-${i}`;
          return (
            <li key={item.q}>
              <h3>
                <button
                  ref={(el) => {
                    buttonRefs.current[i] = el;
                  }}
                  id={buttonId}
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  onClick={() => setOpenIdx(isOpen ? null : i)}
                  onKeyDown={(e) => handleKey(e, i)}
                  className="flex w-full items-center justify-between gap-6 py-5 text-left transition-colors hover:text-accent"
                >
                  <span className="font-display text-lg tracking-display text-text sm:text-xl">
                    {item.q}
                  </span>
                  <span
                    aria-hidden
                    className="relative flex h-6 w-6 shrink-0 items-center justify-center transition-transform duration-200"
                    style={{
                      transform: isOpen ? "rotate(45deg)" : "rotate(0deg)",
                    }}
                  >
                    <span className="absolute h-px w-4 bg-text-muted" />
                    <span className="absolute h-4 w-px bg-text-muted" />
                  </span>
                </button>
              </h3>
              <div
                id={panelId}
                role="region"
                aria-labelledby={buttonId}
                hidden={!isOpen}
                className="pb-6 pr-10 text-[15px] leading-relaxed text-text-muted"
              >
                {item.a}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
