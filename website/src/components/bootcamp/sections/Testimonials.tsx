"use client";

import { testimonials } from "@/components/bootcamp/content";
import {
  Section,
  SectionHeading,
  GlassCard,
  Stagger,
  Item,
  Quote,
  Star,
  scaleIn,
} from "@/components/bootcamp/ui";

/* Refined vertical offset on lg for a staggered, masonry-ish rhythm.
   Pattern repeats per column-of-three so the cascade stays balanced. */
const LG_OFFSET = ["lg:mt-0", "lg:mt-8", "lg:mt-16"];

function Stars({ rating }: { rating: number }) {
  const total = 5;
  return (
    <div
      className="flex items-center gap-1"
      role="img"
      aria-label={`${rating} out of ${total} stars`}
    >
      {Array.from({ length: total }, (_, i) => (
        <Star
          key={i}
          className={`h-4 w-4 ${i < rating ? "bp-ember" : "bp-dim"}`}
          fill={i < rating ? "currentColor" : "none"}
          strokeWidth={i < rating ? 0 : 1.5}
          aria-hidden="true"
        />
      ))}
    </div>
  );
}

export default function Testimonials() {
  return (
    <Section id="testimonials">
      <SectionHeading
        eyebrow={testimonials.eyebrow}
        title={testimonials.title}
        sub={testimonials.sub}
      />

      <Stagger className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 lg:items-start">
        {testimonials.items.map((t, i) => (
          <Item
            key={t.name}
            variant={scaleIn}
            className={LG_OFFSET[i % 3]}
          >
            <GlassCard
              hover
              edge
              className="flex h-full flex-col p-6 sm:p-7"
            >
              <figure className="flex h-full flex-col">
                {/* Subtle iris quote mark */}
                <Quote
                  className="h-7 w-7 shrink-0 bp-iris opacity-70"
                  aria-hidden="true"
                />

                <blockquote className="mt-5 flex-1 text-[15.5px] leading-relaxed bp-fg [text-wrap:pretty]">
                  {t.quote}
                </blockquote>

                <div className="mt-6 pt-5 border-t border-[color:var(--bp-border)]">
                  <Stars rating={t.rating} />
                  <figcaption className="mt-3.5">
                    <div className="font-display text-[15px] font-semibold tracking-[-0.01em] bp-fg">
                      {t.name}
                    </div>
                    <div className="mt-0.5 text-[13px] bp-dim">{t.role}</div>
                  </figcaption>
                </div>
              </figure>
            </GlassCard>
          </Item>
        ))}
      </Stagger>
    </Section>
  );
}
