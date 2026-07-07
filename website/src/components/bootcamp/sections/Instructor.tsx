"use client";

import { motion, useReducedMotion } from "framer-motion";
import { instructor } from "@/components/bootcamp/content";
import {
  Section,
  Reveal,
  Stagger,
  Item,
  Eyebrow,
  Gradient,
  GlassCard,
  blurUp,
  fadeUp,
  scaleIn,
  Check,
  ShieldCheck,
  Sparkles,
} from "@/components/bootcamp/ui";

/* Derive clean initials from the placeholder name, ignoring brackets. */
const initials =
  instructor.name
    .replace(/[\[\]]/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("")
    .slice(0, 2) || "AI";

/* Stat chips float at curated anchor points around the portrait. */
const CHIP_POS = [
  "right-[-6%] top-[14%]",
  "left-[-7%] top-[46%]",
  "right-[-4%] bottom-[10%]",
] as const;

export default function Instructor() {
  const reduce = useReducedMotion();

  return (
    <Section id="instructor">
      <div className="grid items-center gap-12 md:grid-cols-2 md:gap-14 lg:gap-20">
        {/* ── VISUAL: glass portrait placeholder ─────────────────────── */}
        <Reveal variant={scaleIn} className="order-1 md:order-none">
          <div className="relative mx-auto w-full max-w-sm md:max-w-none">
            {/* glow orb behind the panel */}
            <div
              className="bp-orb pointer-events-none absolute left-1/2 top-1/2 h-56 w-56 -translate-x-1/2 -translate-y-1/2 sm:h-72 sm:w-72"
              aria-hidden="true"
            />

            <GlassCard
              strong
              edge
              className="relative aspect-[4/5] overflow-hidden"
            >
              {/* soft gradient wash inside the frame */}
              <div
                className="absolute inset-0 bg-[linear-gradient(150deg,rgba(124,108,255,0.22),rgba(34,211,238,0.10)_45%,transparent_75%)]"
                aria-hidden="true"
              />

              {/* big monogram + silhouette mark */}
              <div className="relative flex h-full flex-col items-center justify-center px-6 text-center">
                <motion.div
                  className="relative grid h-28 w-28 place-items-center rounded-full bp-glass-strong sm:h-32 sm:w-32"
                  initial={reduce ? false : { scale: 0.9, opacity: 0 }}
                  whileInView={reduce ? undefined : { scale: 1, opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
                >
                  {/* pulsing accent ring */}
                  <span
                    className="bp-pulse-ring pointer-events-none absolute inset-0 rounded-full border border-[color:var(--bp-iris)]"
                    aria-hidden="true"
                  />
                  <span className="font-display text-[40px] font-semibold leading-none sm:text-[46px]">
                    <Gradient>{initials}</Gradient>
                  </span>
                </motion.div>

                <p className="mt-6 text-[12px] uppercase tracking-[0.18em] bp-dim">
                  Your instructor
                </p>
              </div>

              {/* verified strip pinned to the bottom of the frame */}
              <div className="absolute inset-x-4 bottom-4 flex items-center gap-2.5 rounded-xl border border-[color:var(--bp-border)] bg-[color:var(--bp-bg-3)]/80 px-4 py-3 backdrop-blur">
                <ShieldCheck className="h-4 w-4 shrink-0 bp-iris" aria-hidden="true" />
                <span className="truncate text-[12.5px] font-medium bp-muted">
                  Verified industry practitioner
                </span>
              </div>
            </GlassCard>

            {/* floating stat chips */}
            {instructor.stats.map((s, i) => (
              <motion.div
                key={s.label}
                className={`bp-glass-strong bp-float absolute ${CHIP_POS[i % CHIP_POS.length]} hidden min-w-[124px] rounded-2xl px-4 py-3 shadow-lg sm:block`}
                style={{ animationDelay: `${i * 0.8}s` }}
                initial={reduce ? false : { opacity: 0 }}
                whileInView={reduce ? undefined : { opacity: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.4 + i * 0.12, ease: [0.22, 1, 0.36, 1] }}
              >
                <div className="font-display text-[24px] font-semibold leading-none bp-fg">
                  {s.value}
                </div>
                <div className="mt-1.5 text-[11px] leading-tight tracking-wide bp-dim">
                  {s.label}
                </div>
              </motion.div>
            ))}
          </div>
        </Reveal>

        {/* ── TEXT: credentials + bio + highlights ───────────────────── */}
        <div>
          <Reveal variant={blurUp}>
            <Eyebrow>{instructor.eyebrow}</Eyebrow>

            <h2 className="mt-5 font-display text-[clamp(30px,5vw,48px)] font-semibold leading-[1.05] tracking-[-0.02em] bp-fg [text-wrap:balance]">
              {instructor.title}
            </h2>

            <p className="mt-4 flex items-center gap-2 font-display text-[19px] font-semibold tracking-tight bp-fg">
              <Sparkles className="h-4 w-4 bp-iris" aria-hidden="true" />
              {instructor.name}
            </p>
          </Reveal>

          {/* role pills */}
          <Stagger className="mt-5 flex flex-wrap gap-2">
            {instructor.roles.map((role) => (
              <Item
                key={role}
                variant={fadeUp}
                className="bp-glass inline-flex items-center rounded-full px-3.5 py-1.5 text-[12.5px] font-medium bp-muted"
              >
                {role}
              </Item>
            ))}
          </Stagger>

          {/* bio */}
          <Reveal variant={fadeUp} delay={0.1}>
            <p className="mt-6 max-w-xl text-[15.5px] leading-relaxed bp-muted">
              {instructor.bio}
            </p>
          </Reveal>

          {/* highlights */}
          <Stagger className="mt-8 space-y-3">
            {instructor.highlights.map((h) => (
              <Item key={h} variant={fadeUp} className="flex items-start gap-3">
                <span
                  className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bp-glass"
                  aria-hidden="true"
                >
                  <Check className="h-3.5 w-3.5 bp-iris" />
                </span>
                <span className="text-[15px] leading-relaxed bp-fg">{h}</span>
              </Item>
            ))}
          </Stagger>

          {/* mobile stat strip — chips are hidden on small screens above */}
          <div className="mt-9 grid grid-cols-3 gap-3 sm:hidden">
            {instructor.stats.map((s) => (
              <div key={s.label} className="bp-glass rounded-xl px-2 py-3.5 text-center">
                <div className="font-display text-[20px] font-semibold leading-none bp-fg">
                  {s.value}
                </div>
                <div className="mt-1.5 text-[10.5px] leading-tight tracking-wide bp-dim">
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Section>
  );
}
