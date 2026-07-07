"use client";

import { useState } from "react";
import { FAQ as DEFAULT_FAQ } from "@/lib/halo-data";
import type { FaqItem } from "@/lib/halo-data";

export type { FaqItem };

export interface HaloFaqProps {
  items?: readonly FaqItem[];
  eyebrow?: string;
  heading?: string;
  /** Which item is open on mount. -1 = all collapsed. */
  defaultOpen?: number;
  className?: string;
}

/**
 * Simple single-open accordion. Click a question to toggle; clicking the
 * open question collapses it. Small `+` glyph rotates to become `×`.
 */
export default function HaloFaq({
  items = DEFAULT_FAQ,
  eyebrow = "05 · FAQ",
  heading = "Things people ask.",
  defaultOpen = 0,
  className,
}: HaloFaqProps) {
  const [openIdx, setOpenIdx] = useState<number>(defaultOpen);

  return (
    <div className={className}>
      <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-accent">
        {eyebrow}
      </div>
      <h3 className="mt-5 mb-7 font-display text-[36px] font-medium leading-[1.05] tracking-display text-text">
        {heading}
      </h3>
      <div className="border-t border-border">
        {items.map((f, i) => {
          const isOpen = openIdx === i;
          const panelId = `halo-faq-panel-${i}`;
          const buttonId = `halo-faq-button-${i}`;
          return (
            <div key={f.q} className="border-b border-border">
              <button
                type="button"
                id={buttonId}
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => setOpenIdx(isOpen ? -1 : i)}
                className="flex w-full cursor-pointer items-center justify-between border-0 bg-transparent px-0 py-[18px] text-left font-sans text-[15.5px] font-medium tracking-[-0.01em] text-text"
              >
                <span>{f.q}</span>
                <span
                  aria-hidden="true"
                  className="text-xl leading-none text-accent transition-transform duration-200"
                  style={{ transform: isOpen ? "rotate(45deg)" : "none" }}
                >
                  +
                </span>
              </button>
              {isOpen && (
                <p
                  id={panelId}
                  role="region"
                  aria-labelledby={buttonId}
                  className="m-0 max-w-[520px] animate-halo-slide-in pb-5 font-sans text-[14.5px] leading-[1.6] text-text-muted"
                >
                  {f.a}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
