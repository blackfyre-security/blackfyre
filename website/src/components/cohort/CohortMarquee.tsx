/**
 * Infinite marquee band. The track holds two identical copies of the items
 * so the -50% translate loops seamlessly. Pauses on hover (see globals.css).
 * Server component — no interactivity needed.
 */
export default function CohortMarquee({ items }: { items: readonly string[] }) {
  const row = [...items, ...items];
  return (
    <div className="co-marquee-wrap relative overflow-hidden border-y border-border bg-surface/30 py-5">
      {/* edge fades */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24"
        style={{ background: "linear-gradient(90deg, var(--bg), transparent)" }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24"
        style={{ background: "linear-gradient(270deg, var(--bg), transparent)" }}
      />
      <div className="co-marquee-track gap-10 px-5">
        {row.map((label, i) => (
          <span
            key={`${label}-${i}`}
            className="flex shrink-0 items-center gap-2.5 font-mono text-[12px] uppercase tracking-[0.12em] text-text-muted"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-accent/70" aria-hidden="true" />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
