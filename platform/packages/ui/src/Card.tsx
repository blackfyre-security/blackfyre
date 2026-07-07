import React from "react";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  active?: boolean;
  style?: React.CSSProperties;
}

export function Card({ children, className = "", active = false, style, ...props }: CardProps) {
  const classes = ["card", active ? "card-active" : "", className].filter(Boolean).join(" ");
  return (
    <div className={classes} style={style} {...props}>
      {children}
    </div>
  );
}
