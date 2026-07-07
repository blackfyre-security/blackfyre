"use client";

import { transformation } from "@/components/bootcamp/content";
import {
  Section,
  SectionHeading,
  Gradient,
  Stagger,
  Item,
  Reveal,
  scaleIn,
  ArrowRight,
  Check,
  X,
  motion,
  useReducedMotion,
} from "@/components/bootcamp/ui";

export default function Transformation() {
  const reduce = useReducedMotion();

  return (
    <Section id="transformation">
      <SectionHeading
        eyebrow={transformation.eyebrow}
        title={transformation.title}
        sub={transformation.sub}
      />

      <div className="relative mt-14 sm:mt-16">
        {/* Connector rail behind both cards on desktop */}
        <div
          className="pointer-events-none absolute left-1/2 top-0 hidden h-full w-px -translate-x-1/2 bg-[linear-gradient(180deg,transparent,var(--bp-border-strong),transparent)] md:block"
          aria-hidden="true"
        />

        <div className="grid grid-cols-1 items-stretch gap-6 md:grid-cols-2 md:gap-12">
          {/* ── BEFORE: muted, dimmed glass ── */}
          <Reveal variant={scaleIn} className="h-full">
            <div className="bp-glass relative h-full overflow-hidden rounded-2xl p-6 opacity-90 saturate-[0.65] sm:p-8">
              <div className="flex items-center gap-3">
                <span
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[color:var(--bp-border)] bg-[color:var(--bp-bg-3)]"
                  aria-hidden="true"
                >
                  <X className="h-4 w-4 bp-dim" />
                </span>
                <span className="text-[12px] font-semibold uppercase tracking-[0.18em] bp-dim">
                  {transformation.before.label}
                </span>
              </div>

              <Stagger className="mt-7 space-y-3.5">
                {transformation.before.items.map((item) => (
                  <Item
                    key={item}
                    className="flex items-start gap-3 text-[15px] leading-snug bp-muted"
                  >
                    <span
                      className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border border-[color:var(--bp-border)] bg-white/[0.02]"
                      aria-hidden="true"
                    >
                      <X className="h-3 w-3 bp-dim" />
                    </span>
                    <span className="line-through decoration-[color:var(--bp-border-strong)] decoration-1">
                      {item}
                    </span>
                  </Item>
                ))}
              </Stagger>
            </div>
          </Reveal>

          {/* ── Arrow between stacked cards (mobile only) ── */}
          <div className="-my-1 flex justify-center md:hidden" aria-hidden="true">
            <div className="grid h-11 w-11 place-items-center rounded-full bp-glass-strong bp-edge">
              <ArrowRight className="h-5 w-5 rotate-90 bp-iris" />
            </div>
          </div>

          {/* ── AFTER: glowing, gradient-edge glass ── */}
          <Reveal variant={scaleIn} delay={0.12} className="h-full">
            <div className="bp-glass-strong bp-edge bp-cta-glow relative h-full overflow-hidden rounded-2xl p-6 sm:p-8">
              {/* soft inner gradient tint */}
              <div
                className="pointer-events-none absolute inset-0 rounded-2xl bg-[linear-gradient(150deg,rgba(124,108,255,0.14),transparent_45%,rgba(34,211,238,0.10))]"
                aria-hidden="true"
              />
              {/* glow orb top-right */}
              <div
                className="bp-orb pointer-events-none absolute -right-12 -top-12 h-40 w-40 opacity-40"
                aria-hidden="true"
              />

              <div className="relative flex items-center gap-3">
                <span
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full bp-cta-glow"
                  style={{ backgroundImage: "var(--bp-grad)" }}
                  aria-hidden="true"
                >
                  <Check className="h-4 w-4 text-white" />
                </span>
                <span className="text-[12px] font-semibold uppercase tracking-[0.18em]">
                  <Gradient>{transformation.after.label}</Gradient>
                </span>
              </div>

              <Stagger className="relative mt-7 space-y-3.5">
                {transformation.after.items.map((item) => (
                  <Item
                    key={item}
                    className="flex items-start gap-3 text-[15px] font-medium leading-snug bp-fg"
                  >
                    <span
                      className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border border-[color:var(--bp-border-strong)] bg-[color:var(--bp-iris)]/15"
                      aria-hidden="true"
                    >
                      <Check className="h-3 w-3 bp-iris" />
                    </span>
                    <span>{item}</span>
                  </Item>
                ))}
              </Stagger>
            </div>
          </Reveal>
        </div>

        {/* ── Center arrow in a glass circle (desktop) ── */}
        <motion.div
          className="pointer-events-none absolute left-1/2 top-1/2 z-10 hidden -translate-x-1/2 -translate-y-1/2 md:block"
          initial={reduce ? false : { opacity: 0, scale: 0.6 }}
          whileInView={reduce ? undefined : { opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: "-90px" }}
          transition={{ duration: 0.5, delay: 0.32, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="relative grid h-14 w-14 place-items-center rounded-full bp-glass-strong bp-edge">
            <span
              className="bp-pulse-ring absolute inset-0 rounded-full"
              style={{ boxShadow: "0 0 0 1px var(--bp-iris)" }}
              aria-hidden="true"
            />
            <ArrowRight className="h-5 w-5 bp-iris" aria-hidden="true" />
          </div>
        </motion.div>
      </div>
    </Section>
  );
}
