interface LogoRowProps {
  label: string;
  items: string[];
  /** on a light (default) or dark section */
  on?: "light" | "dark";
  className?: string;
}

/** Bordered, centred mono wordmark strip — "Built on …". */
export default function LogoRow({ label, items, on = "light", className = "" }: LogoRowProps) {
  const border = on === "dark" ? "border-zinc-900" : "border-zinc-200";
  const labelColor = on === "dark" ? "text-zinc-500" : "text-zinc-400";
  const itemColor = on === "dark" ? "text-zinc-400" : "text-zinc-600";
  return (
    <div className={`mt-20 border-t ${border} pt-8 ${className}`}>
      <p className={`mb-8 text-center text-xs font-semibold uppercase tracking-widest ${labelColor}`}>
        {label}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
        {items.map((it) => (
          <span key={it} className={`font-mono text-sm font-semibold tracking-tight ${itemColor}`}>
            {it}
          </span>
        ))}
      </div>
    </div>
  );
}
