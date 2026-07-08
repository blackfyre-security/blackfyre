import type { ReactNode } from "react";

export type SectionVariant = "light" | "dark" | "warm";

const BG: Record<SectionVariant, string> = {
  light: "bg-white text-zinc-900 border-b border-zinc-200",
  dark: "bg-[#09090e] text-white border-b border-zinc-900",
  warm: "bg-[#fafaf7] text-zinc-900 border-b border-zinc-200",
};

// Grid line colour + tile size per variant (the ambient texture).
const GRID: Record<SectionVariant, { color: string; size: string; opacity: string }> = {
  light: { color: "#f4f4f5", size: "4rem 4rem", opacity: "0.4" },
  dark: { color: "#11111a", size: "3.5rem 3.5rem", opacity: "0.6" },
  warm: { color: "#efeee7", size: "4rem 4rem", opacity: "0.5" },
};

// Default ambient blur orbs per variant (low-opacity colour washes off-corner).
function DefaultOrbs({ variant }: { variant: SectionVariant }) {
  if (variant === "dark") {
    return (
      <>
        <div aria-hidden className="pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full bg-purple-900/10 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-24 -right-24 h-80 w-80 rounded-full bg-blue-900/10 blur-3xl" />
      </>
    );
  }
  if (variant === "warm") {
    return (
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(circle at bottom left, rgba(198,242,78,0.05), transparent 45%)" }}
      />
    );
  }
  return (
    <>
      <div aria-hidden className="pointer-events-none absolute -right-20 -top-24 h-96 w-96 rounded-full bg-[#c6f24e]/10 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-24 -left-20 h-80 w-80 rounded-full bg-blue-100/60 blur-3xl" />
    </>
  );
}

interface SectionProps {
  variant?: SectionVariant;
  children: ReactNode;
  id?: string;
  grid?: boolean;
  orbs?: ReactNode | false;
  className?: string;
  innerClassName?: string;
}

/**
 * The light/dark rhythm engine. Wraps content in a full-bleed section with an
 * ambient grid texture + blur orbs, and a centred max-w container.
 */
export default function Section({
  variant = "light",
  children,
  id,
  grid = true,
  orbs,
  className = "",
  innerClassName = "",
}: SectionProps) {
  const g = GRID[variant];
  return (
    <section id={id} className={`relative overflow-hidden px-6 py-20 sm:px-12 lg:py-28 ${BG[variant]} ${className}`}>
      {grid && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: `linear-gradient(to right, ${g.color} 1px, transparent 1px), linear-gradient(to bottom, ${g.color} 1px, transparent 1px)`,
            backgroundSize: g.size,
            opacity: g.opacity,
          }}
        />
      )}
      {orbs === false ? null : orbs ?? <DefaultOrbs variant={variant} />}
      <div className={`v-reveal relative mx-auto max-w-[1280px] ${innerClassName}`}>{children}</div>
    </section>
  );
}
