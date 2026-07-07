"use client";

import { motion, useReducedMotion } from "framer-motion";
import { pricing } from "@/components/bootcamp/content";
import {
  Section,
  SectionHeading,
  GlassCard,
  ButtonLink,
  Gradient,
  Reveal,
  Stagger,
  Item,
  scaleIn,
  Check,
  Users,
  Sparkles,
  ShieldCheck,
} from "@/components/bootcamp/ui";

export default function Pricing() {
  const reduce = useReducedMotion();

  return (
    <Section id="pricing">
      {/* Anchor target so CTAs linking to #apply land on the card */}
      <span id="apply" aria-hidden="true" className="absolute -top-24" />

      {/* Soft accent glow behind the card */}
      <div
        className="bp-orb pointer-events-none absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 opacity-40"
        aria-hidden="true"
      />

      <SectionHeading eyebrow={pricing.eyebrow} title={pricing.title} sub={pricing.sub} />

      <Reveal className="mx-auto mt-12 w-full max-w-xl" variant={scaleIn}>
        <GlassCard strong edge className="bp-cta-glow relative overflow-hidden p-6 sm:p-9">
          {/* Top: scarcity badge + seats bar */}
          <div className="flex flex-col items-center text-center">
            <span className="bp-glass inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[12.5px] font-medium tracking-wide bp-muted">
              <Users className="h-3.5 w-3.5 bp-iris" aria-hidden="true" />
              {pricing.seatsLabel}
            </span>

            {/* Thin seats-remaining bar */}
            <div className="mt-5 w-full max-w-xs" aria-hidden="true">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-[color:var(--bp-bg-3)] border border-[color:var(--bp-border)]">
                <motion.div
                  className="h-full rounded-full"
                  style={{ backgroundImage: "var(--bp-grad)" }}
                  initial={reduce ? false : { width: 0 }}
                  whileInView={reduce ? undefined : { width: "72%" }}
                  viewport={{ once: true, margin: "-90px" }}
                  transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1], delay: 0.25 }}
                />
              </div>
              <p className="mt-2.5 text-[12px] font-medium tracking-wide bp-muted">
                Only {pricing.seatsRemaining} of 25 seats left for this cohort
              </p>
            </div>
          </div>

          {/* Price block */}
          <div className="mt-8 text-center">
            <div className="flex items-end justify-center gap-1.5 leading-none">
              <span className="font-display text-[clamp(52px,11vw,84px)] font-semibold leading-none tracking-[-0.03em]">
                <Gradient>{pricing.price}</Gradient>
              </span>
            </div>
            <p className="mt-3 text-[13px] uppercase tracking-[0.16em] bp-dim">
              {pricing.priceNote}
            </p>
            <p className="mt-3 text-[13.5px] font-semibold bp-fg">
              {pricing.priceAnchor}
            </p>
            <p className="mx-auto mt-2 max-w-sm text-[13px] leading-relaxed bp-muted">
              {pricing.priceContext}
            </p>
          </div>

          {/* Includes list */}
          <Stagger className="mt-8 grid grid-cols-1 gap-x-6 gap-y-3.5 sm:grid-cols-2">
            {pricing.includes.map((inc) => (
              <Item
                key={inc}
                className="flex items-start gap-3 text-left"
                variant={scaleIn}
              >
                <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[color:var(--bp-bg-3)] border border-[color:var(--bp-border)]">
                  <Check className="h-3 w-3 bp-iris" aria-hidden="true" />
                </span>
                <span className="text-[14.5px] leading-snug bp-fg">{inc}</span>
              </Item>
            ))}
          </Stagger>

          {/* Primary CTA */}
          <div className="mt-9">
            <ButtonLink
              href={pricing.cta.href}
              size="lg"
              icon
              className="w-full"
            >
              {pricing.cta.label}
            </ButtonLink>
          </div>

          {/* Risk reversal + urgency */}
          <p className="mt-5 flex items-center justify-center gap-2 text-center text-[13px] font-medium bp-fg">
            <ShieldCheck className="h-4 w-4 shrink-0 bp-iris" aria-hidden="true" />
            {pricing.guarantee}
          </p>
          <p className="mt-2.5 flex items-center justify-center gap-1.5 text-center text-[12.5px] font-medium bp-muted">
            <Sparkles className="h-3.5 w-3.5 bp-ember" aria-hidden="true" />
            {pricing.urgency}
          </p>
        </GlassCard>
      </Reveal>
    </Section>
  );
}
