"use client";

import { useId, useMemo, useState } from "react";
import { useInterval } from "@/lib/halo-hooks";

export interface HaloSparklineProps {
  /** CSS color or CSS variable reference for stroke/fill. Defaults to `var(--accent)`. */
  color?: string;
  /** Rendered height in px. SVG is 100%-wide. */
  height?: number;
  /** Number of sample points along the sparkline. */
  points?: number;
  /** Tick delay in ms (lower = busier). */
  speed?: number;
  /** Amplitude of the random walk per tick. 0..1. */
  variance?: number;
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
  className,
}: HaloSparklineProps) {
  const gradientId = useId();

  const [data, setData] = useState<number[]>(() =>
    Array.from({ length: points }, (_, i) => 40 + Math.sin(i / 3) * 12 + Math.random() * 8)
  );

  useInterval(() => {
    setData((prev) => {
      const last = prev[prev.length - 1] ?? 50;
      const next = Math.max(8, Math.min(92, last + (Math.random() - 0.5) * variance * 30));
      return [...prev.slice(1), next];
    });
  }, speed);

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
