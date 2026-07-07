import { FRAMEWORKS } from "@/lib/halo-data";

export interface HaloFrameworkGridProps {
  /** Override framework labels. Defaults to FRAMEWORKS from halo-data. */
  frameworks?: readonly string[];
  eyebrow?: string;
  heading?: string;
  className?: string;
}

/**
 * 3-column grid of frameworks. Each cell shows an index, the framework name,
 * and an accent-dot "Mapped" status. Pure server component.
 */
export default function HaloFrameworkGrid({
  frameworks = FRAMEWORKS,
  eyebrow = "04 · FRAMEWORKS",
  heading = "Every framework you're accountable to.",
  className,
}: HaloFrameworkGridProps) {
  return (
    <div className={className}>
      <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-accent">
        {eyebrow}
      </div>
      <h3 className="mt-5 mb-7 font-display text-[36px] font-medium leading-[1.05] tracking-display text-text">
        {heading}
      </h3>
      <div
        className="grid grid-cols-1 gap-px overflow-hidden rounded-[10px] border border-border bg-border sm:grid-cols-2 lg:grid-cols-3"
      >
        {frameworks.map((fw, i) => (
          <div
            key={fw}
            className="relative flex min-h-[110px] flex-col gap-2 bg-surface px-[18px] py-[22px] transition-[background-color,box-shadow] duration-200 hover:bg-surface-alt hover:shadow-[inset_0_0_0_1px_var(--border-strong)]"
          >
            <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-text-dim">
              {String(i + 1).padStart(2, "0")}
            </div>
            <div className="font-sans text-base font-medium tracking-[-0.01em] text-text">
              {fw}
            </div>
            <div className="mt-auto flex items-center gap-1.5 font-mono text-[11px] text-accent">
              <span
                className="inline-block h-[5px] w-[5px] rounded-full"
                style={{ background: "var(--accent)" }}
              />
              Mapped
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
