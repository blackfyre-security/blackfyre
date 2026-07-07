import type { CSSProperties } from "react";

export type HaloStatusDotSize = "sm" | "md" | "lg";

export interface HaloStatusDotProps {
  /** CSS color or CSS variable reference. Defaults to `var(--accent)`. */
  color?: string;
  size?: HaloStatusDotSize;
  /** Disable the pulse animation. */
  steady?: boolean;
  className?: string;
  style?: CSSProperties;
  "aria-label"?: string;
}

const SIZE_PX: Record<HaloStatusDotSize, number> = {
  sm: 5,
  md: 7,
  lg: 10,
};

/**
 * A small glowing status dot. Purely presentational — safe in server
 * components. Pulse is a pure-CSS keyframe (`halopulse` from globals.css).
 */
export default function HaloStatusDot({
  color = "var(--accent)",
  size = "md",
  steady = false,
  className,
  style,
  "aria-label": ariaLabel,
}: HaloStatusDotProps) {
  const px = SIZE_PX[size];
  const composed: CSSProperties = {
    width: px,
    height: px,
    background: color,
    boxShadow: `0 0 ${Math.round(px * 1.6)}px ${color}`,
    ...style,
  };
  return (
    <span
      aria-label={ariaLabel}
      role={ariaLabel ? "status" : undefined}
      className={[
        "inline-block rounded-full",
        steady ? "" : "animate-halo-pulse",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={composed}
    />
  );
}
