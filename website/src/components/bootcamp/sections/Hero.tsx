"use client";

import { motion, useReducedMotion } from "framer-motion";
import { hero } from "@/components/bootcamp/content";
import {
  ButtonLink,
  Eyebrow,
  Gradient,
  GlassCard,
  blurUp,
  container,
  Rocket,
  Presentation,
  Globe,
  Sparkles,
} from "@/components/bootcamp/ui";

const FLOATERS = [
  { icon: Rocket, label: "Prototype", cls: "left-[-6%] top-[18%]", delay: "0s" },
  { icon: Globe, label: "Landing page", cls: "right-[-7%] top-[30%]", delay: "1.2s" },
  { icon: Presentation, label: "Pitch deck", cls: "left-[2%] bottom-[8%]", delay: "0.6s" },
];

export default function Hero() {
  const reduce = useReducedMotion();
  const words = hero.titleLead.split(" ");

  return (
    <section id="top" className="relative overflow-hidden px-5 pb-20 pt-28 sm:px-8 sm:pb-28 sm:pt-36">
      {/* Backdrops */}
      <div className="bp-aurora" aria-hidden="true" />
      <div className="bp-grid" aria-hidden="true" />

      <div className="relative mx-auto w-full max-w-5xl text-center">
        {/* Eyebrow */}
        <motion.div
          className="flex justify-center"
          initial={reduce ? false : { opacity: 0, y: -8 }}
          animate={reduce ? undefined : { opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Eyebrow>{hero.eyebrow}</Eyebrow>
        </motion.div>

        {/* Headline — word-by-word blur rise */}
        <motion.h1
          className="mx-auto mt-7 max-w-4xl font-display text-[clamp(40px,8vw,84px)] font-semibold leading-[0.98] tracking-[-0.03em] bp-fg [text-wrap:balance]"
          variants={container}
          initial={reduce ? false : "hidden"}
          animate={reduce ? undefined : "show"}
        >
          {words.map((w, i) => (
            <motion.span key={i} className="inline-block" variants={blurUp}>
              {w}&nbsp;
            </motion.span>
          ))}
          <motion.span className="inline-block" variants={blurUp}>
            <Gradient>{hero.titleGradient}</Gradient>&nbsp;
          </motion.span>
          <motion.span className="inline-block" variants={blurUp}>
            {hero.titleTail}
          </motion.span>
        </motion.h1>

        {/* Subhead */}
        <motion.p
          className="mx-auto mt-6 max-w-2xl text-[17px] leading-relaxed bp-muted sm:text-[18px]"
          initial={reduce ? false : { opacity: 0, y: 12 }}
          animate={reduce ? undefined : { opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
        >
          {hero.sub}
        </motion.p>

        {/* CTAs */}
        <motion.div
          className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row"
          initial={reduce ? false : { opacity: 0, y: 12 }}
          animate={reduce ? undefined : { opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.62 }}
        >
          <ButtonLink href={hero.primaryCta.href} size="lg" icon>
            {hero.primaryCta.label}
          </ButtonLink>
          <ButtonLink href={hero.secondaryCta.href} variant="ghost" size="lg">
            {hero.secondaryCta.label}
          </ButtonLink>
        </motion.div>

        {/* Trust line */}
        <motion.p
          className="mt-5 text-[13px] font-medium tracking-wide bp-dim"
          initial={reduce ? false : { opacity: 0 }}
          animate={reduce ? undefined : { opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.72 }}
        >
          {hero.trust}
        </motion.p>

        {/* Social proof */}
        <motion.div
          className="mt-12"
          initial={reduce ? false : { opacity: 0 }}
          animate={reduce ? undefined : { opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.8 }}
        >
          <p className="text-[12px] uppercase tracking-[0.18em] bp-dim">{hero.socialProof}</p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5">
            {hero.logos.map((l) => (
              <span
                key={l}
                className="bp-glass rounded-lg px-3.5 py-1.5 font-display text-[13px] font-semibold tracking-wide bp-muted"
              >
                {l}
              </span>
            ))}
          </div>
        </motion.div>
      </div>

      {/* ── Hero visual: glass "AI builder" preview with floating deliverables ── */}
      <motion.div
        className="relative mx-auto mt-16 w-full max-w-3xl"
        initial={reduce ? false : { opacity: 0, y: 40, scale: 0.97 }}
        animate={reduce ? undefined : { opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.9, delay: 0.7, ease: [0.22, 1, 0.36, 1] }}
      >
        {/* glow orb behind */}
        <div className="bp-orb pointer-events-none absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2" aria-hidden="true" />

        <GlassCard strong edge className="relative overflow-hidden p-5 sm:p-7">
          {/* faux window chrome */}
          <div className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
            <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
            <span className="h-3 w-3 rounded-full bg-[#28c840]" />
            <span className="ml-3 inline-flex items-center gap-1.5 text-[12px] bp-dim">
              <Sparkles className="h-3.5 w-3.5 bp-iris" aria-hidden="true" />
              your-ai-product.app
            </span>
          </div>

          {/* prompt bar */}
          <div className="mt-5 flex items-center gap-3 rounded-xl border border-[color:var(--bp-border)] bg-[color:var(--bp-bg-3)] px-4 py-3">
            <span className="h-2 w-2 shrink-0 rounded-full bg-[color:var(--bp-iris)]" />
            <span className="truncate text-[13px] bp-muted">
              Build an AI app that turns lecture notes into flashcards…
            </span>
          </div>

          {/* generating skeleton bars */}
          <div className="mt-5 space-y-3" aria-hidden="true">
            {[88, 64, 76].map((w, i) => (
              <motion.div
                key={i}
                className="h-3 rounded-full bg-[color:var(--bp-border)]"
                style={{ width: `${w}%` }}
                initial={reduce ? false : { opacity: 0.35 }}
                animate={reduce ? undefined : { opacity: [0.35, 0.85, 0.35] }}
                transition={{ duration: 2, delay: i * 0.3, repeat: Infinity }}
              />
            ))}
            <div className="mt-4 h-24 rounded-xl bg-[linear-gradient(120deg,rgba(124,108,255,0.18),rgba(34,211,238,0.12))]" />
          </div>
        </GlassCard>

        {/* floating deliverable chips */}
        {FLOATERS.map((f) => {
          const FIcon = f.icon;
          return (
            <div
              key={f.label}
              className={`bp-glass-strong bp-float absolute ${f.cls} hidden items-center gap-2 rounded-xl px-3 py-2 text-[12.5px] font-medium bp-fg shadow-lg md:inline-flex`}
              style={{ animationDelay: f.delay }}
            >
              <FIcon className="h-4 w-4 bp-iris" aria-hidden="true" />
              {f.label}
            </div>
          );
        })}
      </motion.div>

      {/* Stat strip */}
      <motion.dl
        className="relative mx-auto mt-16 grid max-w-3xl grid-cols-2 gap-4 sm:grid-cols-4"
        initial={reduce ? false : { opacity: 0, y: 16 }}
        whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
      >
        {hero.stats.map((s) => (
          <div key={s.label} className="bp-glass rounded-2xl px-4 py-5 text-center">
            <dt className="font-display text-[34px] font-semibold leading-none bp-fg">{s.value}</dt>
            <dd className="mt-2 text-[12px] uppercase tracking-[0.12em] bp-dim">{s.label}</dd>
          </div>
        ))}
      </motion.dl>
    </section>
  );
}
