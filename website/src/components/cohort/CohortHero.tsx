"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import OrbitScene from "./OrbitScene";
import Counter from "./Counter";

const WORDS = ["Learn", "cloud", "security", "the", "way", "it's"];

const CHIPS: { label: string; cls: string }[] = [
  { label: "AWS", cls: "left-[6%] top-[18%] co-float" },
  { label: "Azure", cls: "right-[2%] top-[30%] co-float-slow" },
  { label: "GCP", cls: "left-[10%] bottom-[16%] co-float-slow" },
  { label: "SOC 2", cls: "right-[8%] bottom-[12%] co-float" },
];

/**
 * Animated cohort hero. Pointer parallax nudges the illustration and floating
 * provider chips; the headline words blur-rise in on a stagger; stat figures
 * count up. All motion degrades gracefully under reduced-motion.
 */
export default function CohortHero() {
  const sceneRef = useRef<HTMLDivElement | null>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    let raf = 0;
    const onMove = (e: PointerEvent) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const nx = (e.clientX / window.innerWidth - 0.5) * 2;
        const ny = (e.clientY / window.innerHeight - 0.5) * 2;
        setTilt({ x: nx, y: ny });
      });
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <section className="relative overflow-hidden border-b border-border px-6 pb-24 pt-28 sm:px-12 sm:pt-32">
      {/* Animated aurora + grid backdrop */}
      <div aria-hidden="true" className="co-aurora pointer-events-none absolute inset-0 opacity-70" />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.18]"
        style={{
          backgroundImage:
            "linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)",
          backgroundSize: "54px 54px",
          maskImage: "radial-gradient(ellipse 80% 70% at 50% 30%, #000 30%, transparent 75%)",
          WebkitMaskImage: "radial-gradient(ellipse 80% 70% at 50% 30%, #000 30%, transparent 75%)",
        }}
      />

      <div className="relative mx-auto grid max-w-[1280px] grid-cols-1 items-center gap-14 lg:grid-cols-[1.05fr_0.95fr] lg:gap-[64px]">
        {/* ── Copy ── */}
        <div>
          <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-border bg-surface/60 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.1em] text-text-muted backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-accent animate-halo-pulse" aria-hidden="true" />
            Enrolling · Cohort 03
          </span>

          <h1 className="font-display font-medium leading-[1] tracking-tightest text-text text-[clamp(44px,6.4vw,72px)]">
            {WORDS.map((w, i) => (
              <span
                key={i}
                className="mr-[0.28em] inline-block animate-halo-word-in"
                style={{ animationDelay: `${i * 90}ms`, animationFillMode: "backwards" }}
              >
                {w}
              </span>
            ))}
            <span
              className="block italic font-normal text-accent animate-halo-word-in"
              style={{ animationDelay: `${WORDS.length * 90}ms`, animationFillMode: "backwards" }}
            >
              actually defended.
            </span>
          </h1>

          <p className="mt-7 max-w-[520px] font-sans text-lg leading-[1.55] text-text-muted">
            An 8-week, live online cohort that takes you from cloud fundamentals
            to shipping audit-ready posture across AWS, Azure, and GCP. Small
            group, real labs, and coaches who have held the pager.
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Link href="/contact" className="halo-btn-accent">
              Reserve a seat <span className="halo-arrow" aria-hidden="true">&rarr;</span>
            </Link>
            <Link href="#curriculum" className="halo-btn-ghost">
              See the curriculum
            </Link>
          </div>

          {/* Animated stat row */}
          <dl className="mt-12 grid max-w-[460px] grid-cols-3 gap-6">
            {[
              { to: 8, suffix: "wk", label: "Live program" },
              { to: 18, suffix: "", label: "Seats only" },
              { to: 9, suffix: "+", label: "Frameworks" },
            ].map((s) => (
              <div key={s.label}>
                <Counter
                  to={s.to}
                  suffix={s.suffix}
                  className="font-display text-[40px] font-medium leading-none tracking-display text-text"
                />
                <dt className="mt-2 font-mono text-[10.5px] uppercase tracking-[0.1em] text-text-dim">
                  {s.label}
                </dt>
              </div>
            ))}
          </dl>
        </div>

        {/* ── Illustration ── */}
        <div className="relative mx-auto w-full max-w-[520px]" ref={sceneRef}>
          <div
            className="relative transition-transform duration-300 ease-out will-change-transform"
            style={{
              transform: `translate3d(${tilt.x * 14}px, ${tilt.y * 14}px, 0)`,
            }}
          >
            <OrbitScene className="co-shield-glow w-full" />

            {/* Floating provider chips, parallaxed against the scene */}
            {CHIPS.map((c) => (
              <span
                key={c.label}
                className={`absolute ${c.cls} rounded-lg border border-border bg-surface/80 px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.08em] text-text shadow-halo-lift backdrop-blur`}
                style={{
                  transform: `translate3d(${tilt.x * -22}px, ${tilt.y * -22}px, 0)`,
                }}
              >
                {c.label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
