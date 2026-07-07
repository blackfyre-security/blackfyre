"use client";

import { problem } from "@/components/bootcamp/content";
import {
  Section,
  SectionHeading,
  Stagger,
  Item,
  GlassCard,
  Icon,
  scaleIn,
} from "@/components/bootcamp/ui";

export default function Problem() {
  return (
    <Section id="problem">
      <SectionHeading
        eyebrow={problem.eyebrow}
        title={problem.title}
        sub={problem.sub}
        align="center"
      />

      <Stagger className="mt-12 grid grid-cols-1 gap-5 sm:mt-16 sm:grid-cols-2">
        {problem.cards.map((card) => (
          <Item key={card.title} variant={scaleIn}>
            <GlassCard hover edge className="group h-full p-7 sm:p-8">
              <div className="flex items-start gap-5">
                {/* Gradient-tinted glass icon tile */}
                <span
                  className="relative grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-[color:var(--bp-border-strong)] bg-[image:var(--bp-grad)]"
                  aria-hidden="true"
                >
                  <span className="absolute inset-px rounded-[11px] bg-[color:var(--bp-bg-3)]/85" />
                  <Icon name={card.icon} className="relative h-5 w-5 bp-iris" />
                </span>

                <div className="min-w-0">
                  <h3 className="font-display text-[19px] font-semibold leading-tight tracking-[-0.01em] bp-fg sm:text-[20px]">
                    {card.title}
                  </h3>
                  <p className="mt-2.5 text-[14.5px] leading-relaxed bp-muted sm:text-[15px]">
                    {card.body}
                  </p>
                </div>
              </div>
            </GlassCard>
          </Item>
        ))}
      </Stagger>
    </Section>
  );
}
