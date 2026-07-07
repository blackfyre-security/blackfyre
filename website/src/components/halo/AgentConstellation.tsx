"use client";

import { useTicker } from "@/lib/halo-hooks";

export interface AgentConstellationProps {
  /** 3-char labels to display on each orbiting node. */
  labels: readonly string[];
  className?: string;
}

/**
 * Radial constellation of agent nodes with connecting lines. The active node
 * rotates through the roster on a 500ms tick. SVG is fluid-width.
 */
export default function AgentConstellation({
  labels,
  className,
}: AgentConstellationProps) {
  const tick = useTicker(1, 999, 500);
  const count = labels.length;

  return (
    <svg
      viewBox="0 0 360 280"
      width="100%"
      className={className}
      style={{ display: "block", marginTop: 10 }}
      aria-hidden="true"
    >
      {/* Connecting lines between every pair */}
      {labels.map((_, i) =>
        labels.slice(i + 1).map((__, j) => {
          const a = i;
          const b = i + j + 1;
          const ang1 = (a / count) * Math.PI * 2 - Math.PI / 2;
          const ang2 = (b / count) * Math.PI * 2 - Math.PI / 2;
          const x1 = 180 + Math.cos(ang1) * 100;
          const y1 = 140 + Math.sin(ang1) * 100;
          const x2 = 180 + Math.cos(ang2) * 100;
          const y2 = 140 + Math.sin(ang2) * 100;
          return (
            <line
              key={`${a}-${b}`}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="var(--border)"
              strokeWidth="1"
            />
          );
        })
      )}

      {/* Centre node */}
      <circle cx="180" cy="140" r="28" fill="var(--accent)" opacity="0.15" />
      <circle cx="180" cy="140" r="10" fill="var(--accent)" />

      {/* Orbiting nodes */}
      {labels.map((label, i) => {
        const ang = (i / count) * Math.PI * 2 - Math.PI / 2;
        const x = 180 + Math.cos(ang) * 100;
        const y = 140 + Math.sin(ang) * 100;
        const active = tick % count === i;
        return (
          <g key={label}>
            <circle
              cx={x}
              cy={y}
              r={active ? 18 : 14}
              fill={active ? "var(--accent)" : "var(--bg)"}
              stroke={active ? "var(--accent)" : "var(--border-strong)"}
              strokeWidth="1.5"
              style={{ transition: "all 300ms" }}
            />
            <text
              x={x}
              y={y + 4}
              textAnchor="middle"
              fontSize="10"
              fontFamily="var(--font-mono, monospace)"
              fill={active ? "var(--accent-ink)" : "var(--text)"}
              fontWeight="600"
            >
              {label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
