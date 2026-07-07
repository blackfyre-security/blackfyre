"use client";

import { curriculum } from "@/components/bootcamp/content";
import {
  Section,
  SectionHeading,
  Reveal,
  GlassCard,
  Gradient,
  motion,
  useReducedMotion,
  fadeUp,
  Lightbulb,
  Layers,
  Rocket,
  Globe,
  Presentation,
  ArrowRight,
} from "@/components/bootcamp/ui";

/* One curated icon per day — sequential idea → demo arc. */
const DAY_ICONS = [Lightbulb, Layers, Rocket, Globe, Presentation] as const;

export default function Curriculum() {
  const reduce = useReducedMotion();
  const days = curriculum.days;

  return (
    <Section id="curriculum">
      <SectionHeading
        eyebrow={curriculum.eyebrow}
        title={curriculum.title}
        sub={curriculum.sub}
      />

      <div className="relative mt-16 sm:mt-20">
        {/* ── Vertical rail ──────────────────────────────────────────────
            Mobile/tablet: pinned to the left gutter.
            lg: centered, with cards alternating either side. */}
        <div
          className="pointer-events-none absolute inset-y-0 left-[19px] w-px sm:left-[23px] lg:left-1/2 lg:-translate-x-1/2"
          aria-hidden="true"
        >
          {/* faint base line */}
          <div className="absolute inset-0 bg-[color:var(--bp-border)]" />
          {/* gradient glow line that draws down on scroll */}
          <motion.div
            className="absolute inset-x-0 top-0 origin-top"
            style={{ background: "linear-gradient(180deg, var(--bp-iris), var(--bp-violet), var(--bp-cyan))" }}
            initial={reduce ? false : { scaleY: 0 }}
            whileInView={reduce ? undefined : { scaleY: 1 }}
            viewport={{ once: true, margin: "-120px" }}
            transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1] }}
          />
          {/* soft bloom around the rail */}
          <div className="absolute inset-y-0 left-1/2 w-10 -translate-x-1/2 bg-[radial-gradient(closest-side,var(--bp-glow),transparent)] opacity-40 blur-md" />
        </div>

        <ol className="relative space-y-8 sm:space-y-10 lg:space-y-14">
          {days.map((d, i) => {
            const DIcon = DAY_ICONS[i] ?? Lightbulb;
            const flip = i % 2 === 1; // on lg, odd rows sit on the right
            const isLast = i === days.length - 1;

            return (
              <li key={d.day} className="relative">
                <div
                  className={`grid items-center gap-x-10 lg:grid-cols-[1fr_auto_1fr] ${
                    flip ? "lg:[&>*:first-child]:order-3" : ""
                  }`}
                >
                  {/* ── Card side ── */}
                  <Reveal
                    variant={fadeUp}
                    delay={reduce ? 0 : 0.05}
                    className={`pl-14 sm:pl-16 lg:pl-0 ${
                      flip ? "lg:col-start-3 lg:pr-0 lg:text-left" : "lg:col-start-1 lg:text-right"
                    }`}
                  >
                    <GlassCard
                      hover
                      edge
                      className="group relative overflow-hidden p-6 sm:p-7"
                    >
                      {/* hover wash — tints toward the rail */}
                      <div
                        className={`pointer-events-none absolute -top-14 h-40 w-40 rounded-full bg-[radial-gradient(circle,var(--bp-iris),transparent_70%)] opacity-15 blur-2xl transition-opacity duration-500 group-hover:opacity-35 ${
                          flip ? "-left-14" : "-right-14"
                        }`}
                        aria-hidden="true"
                      />

                      {/* top row: day pill + day icon */}
                      <div
                        className={`relative flex items-center gap-3 ${
                          flip ? "lg:flex-row" : "lg:flex-row-reverse"
                        }`}
                      >
                        <span
                          className="bp-cta-glow inline-flex items-center rounded-full px-3 py-1 text-[12px] font-semibold tracking-wide text-white"
                          style={{ backgroundImage: "var(--bp-grad)" }}
                        >
                          {d.day}
                        </span>
                        <span
                          className="bp-edge inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[linear-gradient(140deg,rgba(124,108,255,0.22),rgba(34,211,238,0.12))]"
                          aria-hidden="true"
                        >
                          <DIcon className="h-4 w-4 bp-iris" />
                        </span>
                      </div>

                      <h3 className="mt-5 font-display text-[20px] font-semibold tracking-[-0.01em] bp-fg sm:text-[22px]">
                        {d.title}
                      </h3>
                      <p className="mt-2.5 text-[14.5px] leading-relaxed bp-muted">
                        {d.body}
                      </p>

                      {/* tag chips */}
                      <ul
                        className={`mt-5 flex flex-wrap gap-2 ${
                          flip ? "lg:justify-start" : "lg:justify-end"
                        }`}
                      >
                        {d.tags.map((tag) => (
                          <li
                            key={tag}
                            className="bp-glass rounded-full px-2.5 py-1 text-[11.5px] font-medium tracking-wide bp-muted"
                          >
                            {tag}
                          </li>
                        ))}
                      </ul>
                    </GlassCard>
                  </Reveal>

                  {/* ── Center node (the rail dot) ── */}
                  <div
                    className="absolute left-[19px] top-7 -translate-x-1/2 sm:left-[23px] sm:top-8 lg:relative lg:left-auto lg:top-auto lg:col-start-2 lg:translate-x-0 lg:self-center"
                    aria-hidden="true"
                  >
                    <motion.div
                      className="relative grid h-10 w-10 place-items-center"
                      initial={reduce ? false : { scale: 0, opacity: 0 }}
                      whileInView={reduce ? undefined : { scale: 1, opacity: 1 }}
                      viewport={{ once: true, margin: "-120px" }}
                      transition={{
                        type: "spring",
                        stiffness: 260,
                        damping: 18,
                        delay: reduce ? 0 : 0.12,
                      }}
                    >
                      {/* pulse ring on the active leading node only — quiet, not noisy */}
                      {i === 0 && !reduce && (
                        <span
                          className="bp-pulse-ring absolute inset-0 rounded-full"
                          style={{ background: "var(--bp-glow)" }}
                        />
                      )}
                      {/* glass disc with iris ring */}
                      <span className="bp-glass-strong relative grid h-10 w-10 place-items-center rounded-full border border-[color:var(--bp-iris)] shadow-[0_0_0_4px_rgba(124,108,255,0.12)]">
                        <span
                          className="font-display text-[12px] font-semibold leading-none"
                          style={{
                            backgroundImage: "var(--bp-grad)",
                            WebkitBackgroundClip: "text",
                            backgroundClip: "text",
                            color: "transparent",
                          }}
                        >
                          {String(i + 1).padStart(2, "0")}
                        </span>
                      </span>
                    </motion.div>
                  </div>

                  {/* spacer cell so the alternating grid stays balanced on lg */}
                  <div className="hidden lg:block" aria-hidden="true" />
                </div>
              </li>
            );
          })}
        </ol>

        {/* ── Demo-day terminus ── */}
        <Reveal
          variant={fadeUp}
          className="relative mt-10 flex justify-center pl-14 sm:mt-12 sm:pl-16 lg:pl-0"
        >
          <span className="bp-glass-strong bp-edge bp-cta-glow inline-flex items-center gap-2.5 rounded-full px-5 py-2.5 text-[13.5px] font-semibold">
            <span className="font-display tracking-[-0.01em]">
              <Gradient>Demo Day</Gradient>
            </span>
            <ArrowRight className="h-4 w-4 bp-iris" aria-hidden="true" />
            <span className="bp-muted font-medium">you ship live</span>
          </span>
        </Reveal>
      </div>
    </Section>
  );
}
