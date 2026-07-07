import React from "react";

export interface ScoreRingProps {
  score: number;
  size?: number;
  label?: string;
}

function getScoreColor(score: number): { stroke: string; textColor: string } {
  if (score >= 80) return { stroke: "var(--success)", textColor: "var(--success-text)" };
  if (score >= 60) return { stroke: "var(--medium)", textColor: "var(--medium-text)" };
  return { stroke: "var(--critical)", textColor: "var(--critical-text)" };
}

export function ScoreRing({ score, size = 80, label }: ScoreRingProps) {
  const { stroke, textColor } = getScoreColor(score);
  const radius = (size / 2) * 0.9;
  const circumference = 2 * Math.PI * radius;
  const clampedScore = Math.min(100, Math.max(0, score));
  const offset = circumference - (clampedScore / 100) * circumference;
  const cx = size / 2;
  const cy = size / 2;

  return (
    <div
      style={{
        position: "relative",
        width: size,
        height: size,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      aria-label={label ? `${label}: ${score}%` : `Score: ${score}%`}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{ position: "absolute", top: 0, left: 0, transform: "rotate(-90deg)" }}
        aria-hidden="true"
      >
        {/* Track */}
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke="var(--border)"
          strokeWidth={size * 0.075}
        />
        {/* Progress */}
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke={stroke}
          strokeWidth={size * 0.075}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.6s var(--ease-spring)" }}
        />
      </svg>
      <div
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          lineHeight: 1,
        }}
      >
        <span
          className="font-bold mono"
          style={{
            color: textColor,
            fontSize: size * 0.22,
          }}
        >
          {clampedScore}%
        </span>
        {label && (
          <span
            className="mono"
            style={{
              color: "var(--text-muted)",
              fontSize: size * 0.12,
              marginTop: 2,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
            }}
          >
            {label}
          </span>
        )}
      </div>
    </div>
  );
}
