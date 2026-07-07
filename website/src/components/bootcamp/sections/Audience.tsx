"use client";

import { audience } from "@/components/bootcamp/content";
import {
  Section,
  SectionHeading,
  Stagger,
  Item,
  GlassCard,
  Icon,
  Gradient,
} from "@/components/bootcamp/ui";

export default function Audience() {
  return (
    <Section id="audience">
      <SectionHeading
        eyebrow={audience.eyebrow}
        title={audience.title}
        sub={audience.sub}
      />

      <Stagger className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {audience.groups.map((g) => {
          const isFeat = "featured" in g && g.featured;
          return (
            <Item
              key={g.title}
              className={isFeat ? "sm:col-span-2 lg:col-span-1" : ""}
            >
              <GlassCard
                hover
                edge
                strong={isFeat}
                className={`group relative flex h-full flex-col overflow-hidden p-6 sm:p-7 ${
                  isFeat ? "bp-cta-glow" : ""
                }`}
              >
                {isFeat && (
                  <>
                    <span
                      className="absolute right-5 top-5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white"
                      style={{ backgroundImage: "var(--bp-grad)" }}
                    >
                      Made for you
                    </span>
                    <div
                      className="pointer-events-none absolute -right-12 -top-12 h-36 w-36 rounded-full bg-[radial-gradient(circle,var(--bp-iris),transparent_70%)] opacity-30 blur-2xl"
                      aria-hidden="true"
                    />
                  </>
                )}

                <span
                  className="bp-edge inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[linear-gradient(140deg,rgba(124,108,255,0.22),rgba(34,211,238,0.12))]"
                  aria-hidden="true"
                >
                  <Icon name={g.icon} className="h-5 w-5 bp-iris" />
                </span>

                <h3 className="relative mt-5 font-display text-[19px] font-semibold tracking-[-0.01em] bp-fg">
                  {isFeat ? <Gradient>{g.title}</Gradient> : g.title}
                </h3>
                <p className="relative mt-2.5 text-[14.5px] leading-relaxed bp-muted">
                  {g.body}
                </p>
              </GlassCard>
            </Item>
          );
        })}
      </Stagger>
    </Section>
  );
}
