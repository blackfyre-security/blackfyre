"use client";

import { useId, useMemo, useState } from "react";
import { useInterval } from "@/lib/halo-hooks";

const FLAT_BASELINE = [50, 50];

export interface HaloSparklineProps {
  /** CSS color or CSS variable reference for stroke/fill. Defaults to `var(--accent)`. */
  color?: string;
  /** Rendered height in px. SVG is 100%-wide. */
  height?: number;
  /** Number of sample points along the sparkline. */
  points?: number;
  /** Tick delay in ms (lower = busier). */
  speed?: number;
  /** Amplitude of the random walk per tick. 0..1. Decorative mode only. */
  variance?: number;
  /**
   * Real series to plot. When supplied the sparkline is static and truthful.
   */
  data?: number[];
  /**
   * Opt in to the animated random walk. This draws INVENTED data and must never
   * sit next to real metrics unlabelled — it previously did, on the compliance
   * dashboard, where a `Math.random()` walk read as the tenant's score trend.
   * Use only for genuinely ornamental surfaces (marketing, empty states).
   */
  decorative?: boolean;
  className?: string;
}

/**
 * Self-contained live sparkline. Generates a new sample every `speed` ms
 * via a bounded random walk. SVG is fluid-width; caller controls height.
 */
export default function HaloSparkline({
  color = "var(--accent)",
  height = 70,
  points = 48,
  speed = 900,
  variance = 0.6,
  data: series,
  decorative = false,
  className,
}: HaloSparklineProps) {
  const gradientId = useId();
  const hasSeries = Array.isArray(series) && series.length > 1;

  const [walk, setWalk] = useState<number[]>(() =>
    decorative && !hasSeries
      ? Array.from({ length: points }, (_, i) => 40 + Math.sin(i / 3) * 12)
      : [],
  );

  // Only the explicitly decorative variant animates. Everything else renders the
  // series it was given, or a flat baseline when there is nothing to show.
  useInterval(() => {
    if (!decorative || hasSeries) return;
    setWalk((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1] ?? 50;
      const next = Math.max(8, Math.min(92, last + (Math.random() - 0.5) * variance * 30));
      return [...prev.slice(1), next];
    });
  }, speed);

  // Memoised so the flat-baseline fallback is not a fresh array identity on every
  // render, which would invalidate the path useMemo below on each paint.
  const data = useMemo<number[]>(
    () => (hasSeries ? series! : walk.length > 0 ? walk : FLAT_BASELINE),
    [hasSeries, series, walk],
  );

  const { linePath, fillPath } = useMemo(() => {
    const max = Math.max(...data);
    const min = Math.min(...data);
    const span = Math.max(1, max - min);
    const norm = (v: number) => 100 - ((v - min) / span) * 100;
    const w = 300;
    const step = w / Math.max(1, data.length - 1);
    const line = data.map((v, i) => `${i === 0 ? "M" : "L"} ${i * step} ${norm(v)}`).join(" ");
    const fill = `${line} L ${w} 100 L 0 100 Z`;
    return { linePath: line, fillPath: fill };
  }, [data]);

  return (
    <svg
      viewBox="0 0 300 100"
      width="100%"
      height={height}
      preserveAspectRatio="none"
      className={className}
      style={{ display: "block" }}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={fillPath} fill={`url(#${gradientId})`} />
      <path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        style={{ transition: "d 700ms ease" }}
      />
    </svg>
  );
}
