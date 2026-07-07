"use client";

import { useEffect, useRef, useState } from "react";
import { useReveal } from "@/lib/halo-hooks";

interface CounterProps {
  to: number;
  suffix?: string;
  prefix?: string;
  durationMs?: number;
  className?: string;
}

/**
 * Count-up number that fires once it scrolls into view. Eases out so the
 * value decelerates into its final figure. Honours reduced-motion by
 * snapping straight to `to` (the rAF loop is skipped when visible flips).
 */
export default function Counter({
  to,
  suffix = "",
  prefix = "",
  durationMs = 1400,
  className = "",
}: CounterProps) {
  const { ref, visible } = useReveal<HTMLSpanElement>(0.4);
  const [value, setValue] = useState(0);
  const started = useRef(false);

  useEffect(() => {
    if (!visible || started.current) return;
    started.current = true;

    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setValue(to);
      return;
    }

    let raf = 0;
    let start: number | null = null;
    const tick = (t: number) => {
      if (start === null) start = t;
      const p = Math.min(1, (t - start) / durationMs);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(Math.round(eased * to));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [visible, to, durationMs]);

  return (
    <span ref={ref} className={className}>
      {prefix}
      {value}
      {suffix}
    </span>
  );
}
