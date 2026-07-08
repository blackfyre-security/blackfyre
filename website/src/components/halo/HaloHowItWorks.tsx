import { HOW_STEPS } from "@/lib/halo-data";
import type { HowStep } from "@/lib/halo-data";

export interface HaloHowItWorksProps {
  steps?: readonly HowStep[];
  eyebrow?: string;
  heading?: React.ReactNode;
  lede?: string;
  /** How many steps (from the top) render in accent state. */
  activeCount?: number;
  className?: string;
}

/**
 * Vertical timeline with a sticky left intro and a gradient-fading rail
 * on the right. Server-renderable; all visual state is derived from props.
 */
export default function HaloHowItWorks({
  steps = HOW_STEPS,
  eyebrow = "§ 03 · HOW IT WORKS",
  heading = (
    <>
      Read-only in. Auditor-ready{" "}
      <span className="italic font-normal">evidence out.</span>
    </>
  ),
  lede = "No write access to your cloud, no vendor-managed black box. Connect a read-only role and Blackfyre does the rest — open source, on your own infrastructure.",
  activeCount = 5,
  className,
}: HaloHowItWorksProps) {
  return (
    <section
      className={[
        "border-b border-border px-6 py-24 sm:px-12",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="mx-auto max-w-[1280px]">
        <div className="grid grid-cols-1 items-start gap-12 lg:grid-cols-[1fr_2fr] lg:gap-[72px]">
          <div className="lg:sticky lg:top-10">
            <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-accent">
              {eyebrow}
            </div>
            <h2 className="my-5 font-display text-[40px] font-medium leading-[1.02] tracking-display text-text sm:text-[48px]">
              {heading}
            </h2>
            <p className="max-w-[360px] font-sans text-[15px] leading-[1.6] text-text-muted">
              {lede}
            </p>
          </div>

          <div className="relative pl-8">
            {/* Base rail */}
            <div
              className="absolute left-[10px] top-2 bottom-2 w-px"
              style={{ background: "var(--border)" }}
              aria-hidden="true"
            />
            {/* Accent gradient fill (~70% height) */}
            <div
              className="absolute left-[10px] top-2 h-[70%] w-px"
              style={{
                background: "linear-gradient(to bottom, var(--accent), transparent)",
              }}
              aria-hidden="true"
            />

            <ol className="list-none">
              {steps.map((s, i) => {
                const isLast = i === steps.length - 1;
                const active = i < activeCount;
                return (
                  <li
                    key={s.n}
                    className={`relative ${isLast ? "" : "pb-10"}`}
                  >
                    <div
                      className="absolute -left-7 top-1 flex h-[22px] w-[22px] items-center justify-center rounded-full"
                      style={{
                        background: "var(--bg)",
                        border: `1.5px solid ${
                          active ? "var(--accent)" : "var(--border-strong)"
                        }`,
                      }}
                      aria-hidden="true"
                    >
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{
                          background: active ? "var(--accent)" : "var(--border)",
                        }}
                      />
                    </div>
                    <div className="flex items-baseline justify-between gap-4">
                      <div className="font-sans text-[22px] font-medium tracking-[-0.01em] text-text">
                        <span className="mr-3 font-mono text-xs text-text-muted">
                          {s.n}
                        </span>
                        {s.t}
                      </div>
                      <div className="font-mono text-[11px] text-text-dim">
                        {s.min}
                      </div>
                    </div>
                    <p className="mt-2 max-w-[520px] font-sans text-[14.5px] leading-[1.55] text-text-muted">
                      {s.d}
                    </p>
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
      </div>
    </section>
  );
}
