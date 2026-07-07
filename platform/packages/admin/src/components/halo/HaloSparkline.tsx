"use client";

import { useId, useMemo } from "react";

export interface HaloSparklineProps {
  /**
   * REAL metric time-series to plot, oldest→newest. Each number is one real
   * sample (e.g. a daily posture score, scan count, MRR reading). When omitted
   * or empty, the sparkline renders a flat baseline — it never fabricates data.
   */
  data?: number[];
  /** CSS color or CSS variable reference for stroke/fill. Defaults to `var(--accent)`. */
  color?: string;
  /** Rendered height in px. SVG is 100%-wide. */
  height?: number;
  className?: string;
  /**
   * @deprecated No-ops. These drove the old self-generating random-walk and are
   * intentionally ignored now that the sparkline only plots real `data`. They
   * remain on the type purely so existing call-sites keep type-checking; they
   * have ZERO effect on what is rendered. Remove from callers when convenient.
   */
  points?: number;
  /** @deprecated No-op — see `points`. */
  speed?: number;
  /** @deprecated No-op — see `points`. */
  variance?: number;
}

// REAL IMPL (BLACKFYRE 2026-06): this component previously fabricated its own
// series — seeding with `Math.sin(i/3)*12 + Math.random()*8` and then mutating
// it on a `useInterval` random walk, inventing a brand-new "metric" reading
// every ~900ms with nothing behind it. That synthetic trig+PRNG generator (and
// the live-ticking `points`/`speed`/`variance` props that drove it) has been
// removed. The sparkline now plots ONLY the real `data` array passed in by the
// caller. With no data it draws a flat baseline so the card reads honestly as
// "no history yet" instead of a moving fake chart.
export default function HaloSparkline({
  data,
  color = "var(--accent)",
  height = 70,
  className,
}: HaloSparklineProps) {
  const gradientId = useId();

  const { linePath, fillPath, hasData } = useMemo(() => {
    const w = 300;
    const series = (data ?? []).filter((v) => Number.isFinite(v));

    // Honest empty/flat state: no real samples → flat baseline, no fill.
    if (series.length < 2) {
      const yMid = series.length === 1 ? 50 : 100;
      return {
        linePath: `M 0 ${yMid} L ${w} ${yMid}`,
        fillPath: "",
        hasData: false,
      };
    }

    const max = Math.max(...series);
    const min = Math.min(...series);
    const span = Math.max(1, max - min);
    // Map values into the 0..100 viewBox, newest on the right. Leave a small
    // top/bottom margin so the stroke isn't clipped.
    const norm = (v: number) => 95 - ((v - min) / span) * 90;
    const step = w / (series.length - 1);
    const line = series
      .map((v, i) => `${i === 0 ? "M" : "L"} ${i * step} ${norm(v)}`)
      .join(" ");
    const fill = `${line} L ${w} 100 L 0 100 Z`;
    return { linePath: line, fillPath: fill, hasData: true };
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
      {hasData && <path d={fillPath} fill={`url(#${gradientId})`} />}
      <path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeOpacity={hasData ? 1 : 0.35}
        strokeDasharray={hasData ? undefined : "3 4"}
      />
    </svg>
  );
}
