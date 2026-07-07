"use client";

import { useEffect, useRef, useState } from "react";

export interface TimelineItem {
  week: string;
  title: string;
  blurb: string;
  tags: readonly string[];
}

/**
 * Scroll-driven curriculum timeline. A central rail fills as the section
 * passes through the viewport; each week alternates side and rises into view
 * with its own IntersectionObserver. The connector dots pulse when active.
 */
export default function CohortTimeline({ items }: { items: readonly TimelineItem[] }) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    let ticking = false;
    const compute = () => {
      ticking = false;
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight;
      // 0 when the top hits mid-viewport, 1 when the bottom passes mid.
      const total = rect.height + vh * 0.5;
      const seen = Math.min(total, Math.max(0, vh * 0.6 - rect.top));
      setProgress(Math.min(1, Math.max(0, seen / total)));
    };
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(compute);
    };
    compute();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <div ref={wrapRef} className="relative mx-auto mt-14 max-w-[980px]">
      {/* Rail */}
      <div
        aria-hidden="true"
        className="absolute left-[22px] top-0 h-full w-px bg-border md:left-1/2 md:-translate-x-1/2"
      >
        <div
          className="co-rail-fill absolute inset-x-0 top-0 h-full w-px bg-gradient-to-b from-accent to-accent-2"
          style={{ ["--co-progress" as string]: progress }}
        />
      </div>

      <ol className="space-y-6 md:space-y-2">
        {items.map((item, i) => (
          <TimelineRow key={item.week} item={item} index={i} />
        ))}
      </ol>
    </div>
  );
}

function TimelineRow({ item, index }: { item: TimelineItem; index: number }) {
  const rowRef = useRef<HTMLLIElement | null>(null);
  const [shown, setShown] = useState(false);
  const left = index % 2 === 0;

  useEffect(() => {
    const el = rowRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setShown(true);
          io.unobserve(el);
        }
      },
      { threshold: 0.35 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <li
      ref={rowRef}
      className="relative grid grid-cols-1 md:grid-cols-2 md:items-center"
    >
      {/* Node dot on the rail */}
      <span
        aria-hidden="true"
        className="absolute left-[22px] top-7 z-10 -translate-x-1/2 md:left-1/2"
      >
        <span className="relative flex h-3.5 w-3.5 items-center justify-center">
          {shown && (
            <span className="absolute h-3.5 w-3.5 rounded-full bg-accent/40 co-pulse-ring" />
          )}
          <span className="h-3.5 w-3.5 rounded-full border-2 border-accent bg-bg" />
        </span>
      </span>

      {/* Card — alternates sides on desktop */}
      <div
        className={[
          "pl-12 md:pl-0",
          left ? "md:col-start-1 md:pr-12 md:text-right" : "md:col-start-2 md:pl-12",
        ].join(" ")}
      >
        <article
          className="halo-card co-tilt p-6 transition-all duration-700"
          style={{
            opacity: shown ? 1 : 0,
            transform: shown
              ? "translateY(0)"
              : `translateY(28px) translateX(${left ? "-18px" : "18px"})`,
            transitionDelay: "60ms",
          }}
        >
          <div
            className={[
              "flex items-baseline gap-3",
              left ? "md:justify-end" : "",
            ].join(" ")}
          >
            <span className="font-display text-[26px] font-medium leading-none tracking-display text-accent">
              {item.week}
            </span>
            <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-text-dim">
              Week · Lab
            </span>
          </div>
          <h3 className="mt-2.5 font-sans text-[19px] font-medium tracking-[-0.02em] text-text">
            {item.title}
          </h3>
          <p className="mt-2 font-sans text-[13.5px] leading-[1.55] text-text-muted">
            {item.blurb}
          </p>
          <div
            className={[
              "mt-4 flex flex-wrap gap-1.5",
              left ? "md:justify-end" : "",
            ].join(" ")}
          >
            {item.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-md border border-border bg-surface-alt px-2 py-0.5 font-mono text-[10.5px] text-text-muted"
              >
                {tag}
              </span>
            ))}
          </div>
        </article>
      </div>
    </li>
  );
}
