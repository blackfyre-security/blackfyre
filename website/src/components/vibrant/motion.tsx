"use client";

import { useRef, type ReactNode } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP, ScrollTrigger);

/**
 * Count-up number. Server-renders the final value (so no-JS / reduced-motion
 * users always see the real number); when motion is allowed it counts 0→value
 * once, as it scrolls into view. No FOUC — the final value is the SSR content.
 */
export function Counter({ value, className }: { value: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const counter = { n: 0 };
        el.textContent = "0";
        gsap.to(counter, {
          n: value,
          duration: 1.3,
          ease: "power2.out",
          scrollTrigger: { trigger: el, start: "top 88%", once: true },
          onUpdate: () => {
            el.textContent = Math.round(counter.n).toLocaleString("en-US");
          },
        });
      });
      return () => mm.revert();
    },
    { scope: ref },
  );
  return (
    <span ref={ref} className={className}>
      {value.toLocaleString("en-US")}
    </span>
  );
}

/**
 * Subtle scroll parallax — the wrapped element drifts as it passes through the
 * viewport, adding depth. Static under reduced-motion. Wrap decorative visuals
 * only (e.g. the hero device cluster).
 */
export function Parallax({
  children,
  className = "",
  shift = -7,
}: {
  children: ReactNode;
  className?: string;
  /** yPercent drift across the scroll range (negative = drifts up) */
  shift?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.fromTo(
          el,
          { yPercent: 0 },
          {
            yPercent: shift,
            ease: "none",
            scrollTrigger: {
              trigger: el,
              start: "top bottom",
              end: "bottom top",
              scrub: 1,
            },
          },
        );
      });
      return () => mm.revert();
    },
    { scope: ref },
  );
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
