import React from "react";

export interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
  label?: string;
}

const sizeMap: Record<string, { widthHeight: number; borderWidth: number }> = {
  sm: { widthHeight: 20, borderWidth: 2 },
  md: { widthHeight: 32, borderWidth: 3 },
  lg: { widthHeight: 48, borderWidth: 4 },
};

export function LoadingSpinner({ size = "md", label }: LoadingSpinnerProps) {
  const { widthHeight, borderWidth } = sizeMap[size];
  return (
    <div
      className="flex flex-col items-center justify-center gap-3"
      role="status"
      aria-label={label ?? "Loading..."}
    >
      <div
        style={{
          width:            widthHeight,
          height:           widthHeight,
          borderWidth:      borderWidth,
          borderStyle:      "solid",
          borderColor:      "var(--border)",
          borderTopColor:   "var(--accent)",
          borderRadius:     4,
          animation:        "spin 0.75s linear infinite",
        }}
      />
      {label && (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          {label}
        </p>
      )}
      <span className="sr-only">{label ?? "Loading..."}</span>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
