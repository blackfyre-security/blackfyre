"use client";

import { motion, useReducedMotion } from "framer-motion";
import { framework } from "@/components/bootcamp/content";
import {
  Section,
  SectionHeading,
  Gradient,
  Reveal,
  fadeUp,
  ArrowRight,
} from "@/components/bootcamp/ui";

export default function Framework() {
  const reduce = useReducedMotion();
  const steps = framework.steps;

  return (
    <Section id="framework">
      <SectionHeading
        eyebrow={framework.eyebrow}
        title={
          <>
            The{" "}
            <Gradient>
              {framework.title.replace(/^The\s+/, "").replace(/\s+Framework$/, "")}
            </Gradient>{" "}
            Framework
          </>
        }
        sub={framework.sub}
      />

      <div className="relative mt-16 sm:mt-20">
        {/* Connecting gradient line — horizontal on lg, vertical rail on mobile */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-[2.25rem] top-0 hidden h-full w-px bg-[linear-gradient(180deg,transparent,var(--bp-iris),var(--bp-cyan),transparent)] opacity-50 sm:block lg:hidden"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-0 right-0 top-9 hidden h-px bg-[linear-gradient(90deg,transparent,var(--bp-iris)_18%,var(--bp-violet)_50%,var(--bp-cyan)_82%,transparent)] opacity-60 lg:block"
        />

        <ol className="relative grid grid-cols-1 gap-6 sm:gap-7 lg:grid-cols-5 lg:gap-5">
          {steps.map((step, i) => (
            <Reveal
              key={step.letter}
              as="li"
              variant={fadeUp}
              delay={i * 0.1}
              className="relative"
            >
              <div className="group relative flex h-full items-start gap-5 lg:flex-col lg:items-center lg:gap-0 lg:text-center">
                {/* Node: gradient letter tile */}
                <div className="relative shrink-0">
                  {/* step index chip */}
                  <span
                    aria-hidden="true"
                    className="bp-glass-strong absolute -right-1.5 -top-1.5 z-10 flex h-6 w-6 items-center justify-center rounded-full font-display text-[11px] font-semibold bp-muted lg:-right-2 lg:-top-2"
                  >
                    {i + 1}
                  </span>
                  <motion.div
                    whileHover={reduce ? undefined : { y: -4 }}
                    transition={{ type: "spring", stiffness: 280, damping: 20 }}
                    className="bp-glass-strong bp-edge relative flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-2xl"
                  >
                    {/* soft glow behind the letter */}
                    <span
                      aria-hidden="true"
                      className="absolute inset-3 rounded-full bg-[var(--bp-grad)] opacity-30 blur-xl"
                    />
                    <span className="relative font-display text-[2.5rem] font-semibold leading-none">
                      <Gradient>{step.letter}</Gradient>
                    </span>
                  </motion.div>
                </div>

                {/* Copy */}
                <div className="min-w-0 pt-0.5 lg:mt-6">
                  <h3 className="font-display text-[17px] font-semibold leading-snug tracking-[-0.01em] bp-fg">
                    {step.name}
                  </h3>
                  <p className="mt-2 text-[14px] leading-relaxed bp-muted lg:mx-auto lg:max-w-[15rem]">
                    {step.body}
                  </p>
                </div>
              </div>
            </Reveal>
          ))}
        </ol>

        {/* Loop indicator — reinforces "repeatable loop" */}
        <Reveal
          variant={fadeUp}
          delay={0.55}
          className="mt-12 flex justify-center sm:mt-14"
        >
          <span className="bp-glass inline-flex items-center gap-2.5 rounded-full px-4 py-2 text-[12.5px] font-medium tracking-wide bp-muted">
            <motion.span
              aria-hidden="true"
              className="inline-flex"
              animate={reduce ? undefined : { rotate: 360 }}
              transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
            >
              <ArrowRight className="h-3.5 w-3.5 bp-iris" aria-hidden="true" />
            </motion.span>
            One loop, one day each — repeat it for any idea, forever.
          </span>
        </Reveal>
      </div>
    </Section>
  );
}
