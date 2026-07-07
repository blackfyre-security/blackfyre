"use client";

import { outcomes } from "@/components/bootcamp/content";
import {
  Section,
  SectionHeading,
  Stagger,
  Item,
  GlassCard,
  Icon,
  ArrowRight,
} from "@/components/bootcamp/ui";

export default function Outcomes() {
  return (
    <Section id="outcomes">
      <SectionHeading
        eyebrow={outcomes.eyebrow}
        title={outcomes.title}
        sub={outcomes.sub}
      />

      <Stagger className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {outcomes.items.map((item, i) => (
          <Item key={item.title}>
            <GlassCard
              hover
              edge
              className="group relative h-full overflow-hidden p-6 sm:p-7"
            >
              {/* soft gradient wash that warms on hover — the "payoff" tint */}
              <div
                className="pointer-events-none absolute -right-12 -top-12 h-36 w-36 rounded-full bg-[radial-gradient(circle,var(--bp-iris),transparent_70%)] opacity-20 blur-2xl transition-opacity duration-500 group-hover:opacity-40"
                aria-hidden="true"
              />

              <div className="relative flex items-start justify-between gap-4">
                {/* gradient-tinted icon tile */}
                <span
                  className="bp-edge inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[linear-gradient(140deg,rgba(124,108,255,0.22),rgba(34,211,238,0.12))]"
                  aria-hidden="true"
                >
                  <Icon name={item.icon} className="h-5 w-5 bp-iris" />
                </span>

                {/* index chip 01–06 */}
                <span className="mt-1 font-mono text-[12px] tracking-[0.18em] tabular-nums bp-dim">
                  <span className="bp-muted">{String(i + 1).padStart(2, "0")}</span>
                  {" / "}
                  {String(outcomes.items.length).padStart(2, "0")}
                </span>
              </div>

              <h3 className="mt-6 font-display text-[19px] font-semibold tracking-[-0.01em] bp-fg">
                {item.title}
              </h3>
              <p className="mt-2.5 text-[14.5px] leading-relaxed bp-muted">
                {item.body}
              </p>

              {/* deliverable footer — quietly reveals on hover */}
              <div className="mt-6 flex items-center gap-2 text-[12.5px] font-medium bp-iris transition-opacity duration-300">
                You leave with this
                <ArrowRight
                  className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-0.5"
                  aria-hidden="true"
                />
              </div>
            </GlassCard>
          </Item>
        ))}
      </Stagger>
    </Section>
  );
}
