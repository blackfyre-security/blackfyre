"use client";

import type { ElementType, ReactNode } from "react";
import { useReveal } from "@/lib/halo-hooks";

interface HaloRevealProps {
  children: ReactNode;
  /** Stagger delay in ms. Caller usually passes index * 120. */
  delay?: number;
  /** Render tag. Default `<div>`; use `"section"`, `"li"`, etc. where semantics matter. */
  as?: ElementType;
  className?: string;
  /** IntersectionObserver threshold (0-1). Defaults to 0.12. */
  threshold?: number;
}

/**
 * Lightweight scroll-reveal wrapper that composes `useReveal` with the
 * shared `.reveal` / `.is-visible` CSS classes in globals.css. Drop-in for
 * wrapping sections or lists. Respects `prefers-reduced-motion` via the
 * global media-query in globals.css.
 */
export default function HaloReveal({
  children,
  delay = 0,
  as: Tag = "div",
  className = "",
  threshold,
}: HaloRevealProps) {
  const { ref, visible } = useReveal<HTMLElement>(threshold ?? 0.12);

  return (
    <Tag
      ref={ref as never}
      className={`reveal ${visible ? "is-visible" : ""} ${className}`.trim()}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </Tag>
  );
}
