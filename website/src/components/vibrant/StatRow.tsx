interface Stat {
  value: string;
  label: string;
  /** optional accent colour for the number (else zinc-900) */
  color?: string;
}

interface StatRowProps {
  kicker?: string;
  stats: Stat[];
  /** render on a light surface panel (default) or bare */
  surface?: boolean;
  className?: string;
  cols?: string; // grid-cols override
}

/** Mono big-number stat grid — used in the hero panel and inside cards. */
export default function StatRow({
  kicker,
  stats,
  surface = true,
  className = "",
  cols = "grid-cols-2 sm:grid-cols-4",
}: StatRowProps) {
  return (
    <div className={`${surface ? "rounded-2xl border border-zinc-100 bg-zinc-50 p-6" : ""} ${className}`}>
      {kicker && (
        <p className="mb-4 font-mono text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
          {kicker}
        </p>
      )}
      <div className={`grid gap-x-6 gap-y-5 ${cols}`}>
        {stats.map((s) => (
          <div key={s.label}>
            <p className={`whitespace-nowrap font-mono text-[clamp(20px,4vw,30px)] font-extrabold leading-none tracking-tight ${s.color ?? "text-zinc-900"}`}>
              {s.value}
            </p>
            <p className="mt-1 font-mono text-[11px] uppercase tracking-wide text-zinc-500">{s.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
