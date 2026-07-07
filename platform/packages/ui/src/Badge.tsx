import React from "react";

export interface BadgeProps {
  children: React.ReactNode;
  variant?: "critical" | "high" | "medium" | "low" | "info" | "success";
  className?: string;
}

export function Badge({ children, variant = "info", className = "" }: BadgeProps) {
  return (
    <span className={`badge badge-${variant}${className ? " " + className : ""}`}>
      {children}
    </span>
  );
}
