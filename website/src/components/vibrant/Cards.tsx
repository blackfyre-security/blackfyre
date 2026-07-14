import type { ComponentType, ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";
import { ACCENTS, type Accent } from "./accents";

interface DarkCardProps {
  badge: string;
  icon: ComponentType<{ className?: string }>;
  title: string;
  desc: string;
  accent: Accent;
  /** mini-illustration filling the card's visual slot */
  illustration?: ReactNode;
  linkLabel?: string;
  linkHref?: string;
}

/** Dark case-study / feature card (h-360) with a mini illustration + hover glow. */
export function CaseStudyCardDark({
  badge,
  icon: Icon,
  title,
  desc,
  accent,
  illustration,
  linkLabel,
  linkHref,
}: DarkCardProps) {
  const a = ACCENTS[accent];
  return (
    <article
      className={`group relative flex h-[360px] flex-col justify-between overflow-hidden rounded-2xl border border-zinc-900 bg-zinc-950 p-6 transition-all duration-300 hover:-translate-y-1 ${a.cardBorder}`}
    >
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent ${a.cardGlow} opacity-0 transition-opacity duration-300 group-hover:opacity-100`}
      />
      <div className="relative">
        <div className="flex items-center justify-between">
          <span className="rounded border border-zinc-800 bg-zinc-900 px-2 py-0.5 font-mono text-[10px] font-semibold text-zinc-400">
            {badge}
          </span>
          <Icon className={`h-4 w-4 ${a.textDark}`} />
        </div>
        <div className="mt-6 flex h-28 items-center justify-center overflow-hidden rounded-lg border border-zinc-800 bg-[#09090e]">
          {illustration}
        </div>
      </div>
      <div className="relative">
        <h3 className="text-lg font-bold text-white">{title}</h3>
        <p className="mt-2 text-xs leading-relaxed text-zinc-400">{desc}</p>
        {linkLabel && linkHref && (
          <a
            href={linkHref}
            target={linkHref.startsWith("http") ? "_blank" : undefined}
            rel={linkHref.startsWith("http") ? "noreferrer" : undefined}
            className={`mt-4 inline-flex items-center gap-1 text-xs font-semibold ${a.textDark}`}
          >
            {linkLabel}
            <ArrowUpRight className="h-3.5 w-3.5" />
          </a>
        )}
      </div>
    </article>
  );
}

interface LightCardProps {
  kicker: string;
  title: string;
  desc: string;
  thumb: ReactNode;
  stats?: { label: string; value: string }[];
  linkLabel?: string;
  linkHref?: string;
}

/** Light horizontal card — gradient thumbnail + amber kicker + stat footer. */
export function FeatureCardLight({ kicker, title, desc, thumb, stats, linkLabel, linkHref }: LightCardProps) {
  return (
    <article className="group flex flex-col gap-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-[0_1px_2px_rgba(9,9,14,0.04),0_12px_28px_-18px_rgba(9,9,14,0.18)] ring-1 ring-zinc-950/[0.03] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-18px_rgba(9,9,14,0.25)] sm:flex-row">
      <div className="flex h-[130px] w-full items-center justify-center overflow-hidden rounded-xl border border-zinc-200/60 bg-gradient-to-tr from-zinc-100 to-zinc-50 p-3 sm:w-[160px] sm:flex-shrink-0">
        {thumb}
      </div>
      <div className="flex flex-1 flex-col">
        <p className="font-mono text-[9px] font-bold uppercase tracking-wider text-amber-700">{kicker}</p>
        <h3 className="mt-1.5 text-lg font-bold text-zinc-900">{title}</h3>
        <p className="mt-1.5 text-xs leading-relaxed text-zinc-500">{desc}</p>
        {stats && (
          <div className="mt-4 grid grid-cols-3 gap-2 border-t border-zinc-100 pt-4">
            {stats.map((s) => (
              <div key={s.label}>
                <p className="font-mono text-[10px] font-semibold uppercase tracking-wide text-zinc-400">{s.label}</p>
                <p className="mt-0.5 text-xs font-bold text-zinc-800">{s.value}</p>
              </div>
            ))}
          </div>
        )}
        {linkLabel && linkHref && (
          <a
            href={linkHref}
            target={linkHref.startsWith("http") ? "_blank" : undefined}
            rel={linkHref.startsWith("http") ? "noreferrer" : undefined}
            className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-zinc-500 transition-colors group-hover:text-amber-700"
          >
            {linkLabel}
            <ArrowUpRight className="h-3.5 w-3.5" />
          </a>
        )}
      </div>
    </article>
  );
}
