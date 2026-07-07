import React from "react";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  className?: string;
}

export function Input({ className = "", ...props }: InputProps) {
  const classes = ["input", className].filter(Boolean).join(" ");
  return <input className={classes} {...props} />;
}
