import type { ReactNode } from "react";
import { ACCENTS, type Accent } from "./accents";

interface SectionHeadProps {
  eyebrow: string;
  eyebrowIcon?: ReactNode;
  /** accent driving the eyebrow pill + heading word */
  accent: Accent;
  /** section background the head sits on (picks the right pill tint) */
  on?: "light" | "dark";
  /** leading title text (kept in the base colour) */
  title: ReactNode;
  /** the emphasised word/phrase, rendered gradient (default) or solid */
  accentWord?: string;
  accentStyle?: "gradient" | "solid";
  size?: "hero" | "section";
  align?: "left" | "center";
  /** optional supporting paragraph under the heading */
  sub?: ReactNode;
  className?: string;
}

export default function SectionHead({
  eyebrow,
  eyebrowIcon,
  accent,
  on = "light",
  title,
  accentWord,
  accentStyle = "gradient",
  size = "section",
  align = "left",
  sub,
  className = "",
}: SectionHeadProps) {
  const a = ACCENTS[accent];
  const pill = on === "dark" ? a.pillDark : a.pillLight;
  const headSize =
    size === "hero"
      ? "text-[clamp(40px,5vw,60px)] leading-[1.05]"
      : "text-4xl leading-[1.1] sm:text-5xl";
  const accentCls =
    accentStyle === "gradient"
      ? `bg-gradient-to-r ${a.headingGrad} bg-clip-text text-transparent`
      : a.headingSolid;
  const alignCls = align === "center" ? "items-center text-center" : "items-start text-left";
  const subColor = on === "dark" ? "text-zinc-400" : "text-zinc-600";

  return (
    <div className={`flex flex-col ${alignCls} ${className}`}>
      <span
        className={`inline-flex items-center gap-2 rounded-full px-3 py-1 font-mono text-xs font-semibold uppercase tracking-wider ${pill}`}
      >
        {eyebrowIcon}
        {eyebrow}
      </span>
      <h2 className={`mt-5 font-display font-bold tracking-tight ${headSize} ${size === "hero" ? "font-sans" : ""}`}>
        {title}
        {accentWord ? (
          <>
            {" "}
            <span className={accentCls}>{accentWord}</span>
          </>
        ) : null}
      </h2>
      {sub ? <p className={`mt-5 max-w-[560px] text-lg leading-relaxed ${subColor}`}>{sub}</p> : null}
    </div>
  );
}
