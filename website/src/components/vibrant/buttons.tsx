import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";

/** Inline GitHub glyph (lucide 1.16 has no Github export). */
export function GitHubIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden className={className}>
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

interface BtnProps {
  href: string;
  children: ReactNode;
  external?: boolean;
  icon?: ReactNode;
  className?: string;
}

/** Signature lime primary button (dark ink). */
export function LimeButton({ href, children, external, icon, className = "" }: BtnProps) {
  const rel = external ? "noreferrer" : undefined;
  const target = external ? "_blank" : undefined;
  return (
    <a
      href={href}
      target={target}
      rel={rel}
      className={`group inline-flex items-center gap-2 rounded-lg bg-[#c6f24e] px-5 py-2.5 text-sm font-semibold text-zinc-950 shadow-[0_8px_28px_-8px_#c6f24e] transition-all duration-200 hover:bg-[#b0d93f] hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c6f24e] focus-visible:ring-offset-2 focus-visible:ring-offset-white ${className}`}
    >
      {icon}
      {children}
      <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
    </a>
  );
}

/** Outline / ghost button — adapts to light or dark background. */
export function GhostButton({
  href,
  children,
  external,
  icon,
  on = "light",
  className = "",
}: BtnProps & { on?: "light" | "dark" }) {
  const rel = external ? "noreferrer" : undefined;
  const target = external ? "_blank" : undefined;
  const tone =
    on === "dark"
      ? "border-zinc-700 text-white hover:bg-zinc-800/60"
      : "border-zinc-300 text-zinc-900 hover:bg-zinc-100";
  return (
    <a
      href={href}
      target={target}
      rel={rel}
      className={`inline-flex items-center gap-2 rounded-lg border px-5 py-2.5 text-sm font-semibold transition-all duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 ${tone} ${className}`}
    >
      {icon}
      {children}
    </a>
  );
}
