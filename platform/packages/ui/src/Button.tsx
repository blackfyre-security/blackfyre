import React from "react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function Button({
  children,
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: ButtonProps) {
  const sizeClass = size === "md" ? "" : `btn-${size}`;
  const classes = ["btn", `btn-${variant}`, sizeClass, className].filter(Boolean).join(" ");
  return (
    <button className={classes} {...props}>
      {children}
    </button>
  );
}
