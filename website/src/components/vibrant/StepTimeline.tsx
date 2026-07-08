import { ACCENTS, type Accent } from "./accents";

export interface Step {
  n: string; // "01"
  title: string;
  desc: string;
}

interface StepTimelineProps {
  steps: Step[];
  accent?: Accent;
  className?: string;
}

const DOT_HOVER: Record<Accent, string> = {
  blue: "group-hover:bg-blue-600",
  purple: "group-hover:bg-purple-600",
  pink: "group-hover:bg-pink-600",
  emerald: "group-hover:bg-emerald-600",
  amber: "group-hover:bg-amber-600",
  lime: "group-hover:bg-lime-500",
};

/** Left-ruled vertical timeline with mono numbered heads and hover-fill dots. */
export default function StepTimeline({ steps, accent = "amber", className = "" }: StepTimelineProps) {
  const a = ACCENTS[accent];
  return (
    <ol className={`space-y-8 border-l border-zinc-200 pl-6 ${className}`}>
      {steps.map((s) => (
        <li key={s.n} className="group relative">
          <span
            className={`absolute -left-[31px] top-1 h-2.5 w-2.5 rounded-full border-2 border-[#fafaf7] bg-zinc-300 transition-transform duration-300 group-hover:scale-125 ${DOT_HOVER[accent]}`}
          />
          <p className="font-mono text-[13px] font-semibold uppercase tracking-wide">
            <span className={a.textLight}>{s.n}</span>
            <span className="text-zinc-400"> · </span>
            <span className="text-zinc-900">{s.title}</span>
          </p>
          <p className="mt-1.5 max-w-[440px] text-sm leading-relaxed text-zinc-600">{s.desc}</p>
        </li>
      ))}
    </ol>
  );
}
