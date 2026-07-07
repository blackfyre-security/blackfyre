"use client";

import { motion, useReducedMotion } from "framer-motion";
import { finalCta } from "@/components/bootcamp/content";
import {
  ButtonLink,
  Eyebrow,
  Gradient,
  GlassCard,
  Reveal,
  scaleIn,
  blurUp,
  Sparkles,
} from "@/components/bootcamp/ui";

export default function FinalCta() {
  const reduce = useReducedMotion();

  return (
    <section
      id="enrol"
      aria-labelledby="final-cta-heading"
      className="relative scroll-mt-24 overflow-hidden px-5 py-24 sm:px-8 sm:py-32"
    >
      {/* Aurora + grid backdrop */}
      <div className="bp-aurora" aria-hidden="true" />
      <div className="bp-grid" aria-hidden="true" />

      <div className="relative mx-auto w-full max-w-4xl">
        <Reveal variant={scaleIn}>
          <GlassCard strong edge className="relative overflow-hidden px-6 py-14 text-center sm:px-12 sm:py-20">
            {/* Soft glow orb behind the headline */}
            <div
              className="bp-orb pointer-events-none absolute left-1/2 top-[-12%] h-56 w-56 -translate-x-1/2 opacity-60"
              aria-hidden="true"
            />

            <div className="relative">
              {/* Eyebrow */}
              <div className="flex justify-center">
                <Eyebrow>{finalCta.eyebrow}</Eyebrow>
              </div>

              {/* Headline */}
              <motion.h2
                id="final-cta-heading"
                className="mx-auto mt-6 max-w-2xl font-display text-[clamp(34px,6vw,62px)] font-semibold leading-[1.02] tracking-[-0.03em] bp-fg [text-wrap:balance]"
                variants={blurUp}
                initial={reduce ? false : "hidden"}
                whileInView={reduce ? undefined : "show"}
                viewport={{ once: true, margin: "-90px" }}
              >
                Your <Gradient>AI product</Gradient> is five days away.
              </motion.h2>

              {/* Sub */}
              <Reveal delay={0.12}>
                <p className="mx-auto mt-5 max-w-xl text-[16px] leading-relaxed bp-muted sm:text-[17px]">
                  {finalCta.sub}
                </p>
              </Reveal>

              {/* CTAs */}
              <Reveal delay={0.22}>
                <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
                  <ButtonLink href={finalCta.primaryCta.href} size="lg" icon>
                    {finalCta.primaryCta.label}
                  </ButtonLink>
                  <ButtonLink href={finalCta.secondaryCta.href} variant="ghost" size="lg">
                    {finalCta.secondaryCta.label}
                  </ButtonLink>
                </div>
              </Reveal>

              {/* Note */}
              <Reveal delay={0.32}>
                <p className="mt-7 inline-flex items-center justify-center gap-2 text-[13px] tracking-wide bp-dim">
                  <Sparkles className="h-3.5 w-3.5 bp-iris" aria-hidden="true" />
                  {finalCta.note}
                </p>
              </Reveal>
            </div>
          </GlassCard>
        </Reveal>
      </div>
    </section>
  );
}
