import React from "react";

export interface StatCardProps {
  title: string;
  value: string | number;
  subtitle: React.ReactNode;
  color?: "green" | "yellow" | "red" | "blue" | "brand";
  index?: number;
}

const borderColorMap: Record<string, string> = {
  green:  "var(--success)",
  yellow: "var(--medium)",
  red:    "var(--critical)",
  blue:   "var(--low)",
  brand:  "var(--accent)",
};

const textColorMap: Record<string, string> = {
  green:  "var(--success-text)",
  yellow: "var(--medium-text)",
  red:    "var(--critical-text)",
  blue:   "var(--low-text)",
  brand:  "var(--accent)",
};

export function StatCard({ title, value, subtitle, color = "brand", index = 0 }: StatCardProps) {
  return (
    <div
      className="card border-l-4 p-5 animate-fade-up"
      style={{
        borderLeftColor: borderColorMap[color],
        animationDelay: `${index * 80}ms`,
      }}
    >
      <p className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
        {title}
      </p>
      <p
        className="text-3xl font-bold font-mono mt-1 stat-number"
        style={{ color: textColorMap[color] }}
      >
        {value}
      </p>
      <div className="mt-2 text-sm" style={{ color: "var(--text-muted)" }}>
        {subtitle}
      </div>
    </div>
  );
}
