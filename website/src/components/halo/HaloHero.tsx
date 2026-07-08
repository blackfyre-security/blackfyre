"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AUDITOR_COUNT } from "@/data/auditors";
import { FRAMEWORK_COUNT, TOTAL_CONTROLS } from "@/data/frameworks";
import { SITE } from "@/data/site";
import { useInterval } from "@/lib/halo-hooks";

const COLS = 22;
const ROWS = 8;
const PARTICLE_COUNT = 18;

interface MatrixCell {
  r: number;
  c: number;
  seed: number;
}

interface Particle {
  idx: number;
  left: number;
  top: number;
  seed: number;
}

const STATS: readonly { k: string; l: string }[] = [
  { k: String(AUDITOR_COUNT), l: "auditors" },
  { k: String(FRAMEWORK_COUNT), l: "frameworks" },
  { k: String(TOTAL_CONTROLS), l: "controls" },
  { k: "Apache-2.0", l: "license" },
];

const COVERAGE: readonly { l: string; v: string }[] = [
  { l: "Clouds", v: "AWS · Azure · GCP · on-prem" },
  { l: "Auditors", v: String(AUDITOR_COUNT) },
  { l: "Frameworks", v: String(FRAMEWORK_COUNT) },
  { l: "Controls", v: String(TOTAL_CONTROLS) },
  { l: "Also", v: "Prowler · Checkov · Semgrep · Bandit" },
  { l: "Access", v: "read-only cross-account IAM" },
];

/**
 * Hero surface: OSS-first headline + CTAs on the left, an animated
 * posture-scan matrix over a code-derived coverage panel on the right,
 * a cursor-tracking radial glow, and drifting accent particles. All motion
 * is client-side and decorative; every figure is code-of-record.
 */
export default function HaloHero() {
  const heroRef = useRef<HTMLElement | null>(null);
  const [frame, setFrame] = useState<number>(0);
  const [mouse, setMouse] = useState<{ x: number; y: number }>({ x: 0.5, y: 0.3 });

  useInterval(() => setFrame((f) => f + 1), 90);

  // Cursor glow follows the mouse within the section bounds.
  useEffect(() => {
    const el = heroRef.current;
    if (!el) return;
    const onMove = (e: MouseEvent) => {
      const r = el.getBoundingClientRect();
      setMouse({
        x: (e.clientX - r.left) / r.width,
        y: (e.clientY - r.top) / r.height,
      });
    };
    el.addEventListener("mousemove", onMove);
    return () => el.removeEventListener("mousemove", onMove);
  }, []);

  // Stable cells; seed gives the sweep an organic offset per cell.
  const cells = useMemo<MatrixCell[]>(() => {
    const arr: MatrixCell[] = [];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const seed = ((r * 7 + c * 13) % 100) / 100;
        arr.push({ r, c, seed });
      }
    }
    return arr;
  }, []);

  // Stable particle positions. Drift is computed per render from `frame`.
  const particles = useMemo<Particle[]>(
    () =>
      Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
        idx: i,
        left: (i * 61) % 100,
        top: (i * 47) % 100,
        seed: ((i * 37) % 100) / 100,
      })),
    []
  );

  return (
    <section
      ref={heroRef}
      className="relative overflow-hidden border-b border-border px-6 pb-20 pt-28 sm:px-12 sm:pt-32"
    >
      {/* Soft static glow backdrop */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 900px 400px at 80% 10%, rgba(var(--accent-rgb, 198 242 78), 0.08), transparent 60%)",
        }}
      />
      {/* Cursor-tracking glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(circle 400px at ${mouse.x * 100}% ${mouse.y * 100}%, rgba(var(--accent-rgb, 198 242 78), 0.09), transparent 60%)`,
          transition: "background 200ms ease-out",
        }}
      />
      {/* Floating accent particles */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        {particles.map((p) => {
          const drift = Math.sin((frame + p.idx * 10) / 30) * 18;
          const size = 2 + p.seed * 2;
          return (
            <span
              key={p.idx}
              className="absolute rounded-full"
              style={{
                left: `${p.left}%`,
                top: `${p.top}%`,
                width: size,
                height: size,
                background: "var(--accent)",
                opacity: 0.12 + p.seed * 0.2,
                transform: `translate(${drift}px, ${-drift * 0.6}px)`,
                boxShadow: `0 0 ${4 + p.seed * 8}px var(--accent)`,
                transition: "transform 800ms ease-out",
              }}
            />
          );
        })}
      </div>

      <div className="relative mx-auto grid max-w-[1280px] grid-cols-1 gap-12 lg:grid-cols-[1.15fr_0.85fr] lg:gap-[72px]">
        {/* Left column */}
        <div>
          <div className="flex items-center gap-2.5 font-mono text-[11px] uppercase tracking-[0.18em] text-text-muted">
            <span className="halo-live-dot animate-halo-pulse" />
            Open source · Apache-2.0
          </div>

          <h1 className="mt-7 font-display font-medium leading-[0.96] tracking-tightest text-text text-[clamp(48px,6.4vw,88px)] [text-wrap:balance]">
            Compliance posture,
            <br />
            <span className="text-text-muted">continuously </span>
            <span className="italic font-normal text-accent">proven.</span>
          </h1>

          <p className="mb-0 mt-7 max-w-[540px] font-sans text-lg leading-[1.55] text-text-muted">
            Blackfyre is an open-source, multi-cloud compliance and security
            platform — {AUDITOR_COUNT} auditors across AWS, Azure, GCP and
            on-prem, mapping findings to {FRAMEWORK_COUNT} frameworks and{" "}
            {TOTAL_CONTROLS} controls. Self-host it free, forever.
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-3">
            <a
              href={SITE.repoUrl}
              target="_blank"
              rel="noreferrer"
              className="halo-btn-accent halo-arrow-parent"
            >
              Star on GitHub{" "}
              <span className="halo-arrow" aria-hidden="true">
                &rarr;
              </span>
            </a>
            <Link href="/self-host" className="halo-btn-ghost">
              Quickstart
            </Link>
            <span className="ml-1 font-mono text-xs text-text-dim">
              Self-host free · no vendor lock-in
            </span>
          </div>

          {/* Stat strip */}
          <div className="mt-14 grid max-w-[560px] grid-cols-2 gap-6 sm:grid-cols-4">
            {STATS.map((s) => (
              <div key={s.l}>
                <div className="font-sans text-[28px] font-medium tracking-[-0.02em] text-text">
                  {s.k}
                </div>
                <div className="mt-1 font-mono text-[10.5px] uppercase tracking-[0.14em] text-text-dim">
                  {s.l}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right column — scanning matrix over coverage panel */}
        <div className="relative overflow-hidden rounded-[14px] border border-border bg-surface p-[22px]">
          <div className="mb-[18px] flex items-center justify-between">
            <div
              className="font-mono text-[11px] uppercase tracking-[0.12em]"
              style={{ color: "var(--brand-cool)" }}
            >
              SCANNER COVERAGE
            </div>
            <div className="font-mono text-[11px] text-accent">● READ-ONLY</div>
          </div>

          {/* Decorative scan sweep */}
          <div
            className="mb-[18px] grid gap-[3px]"
            style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)` }}
            aria-hidden="true"
          >
            {cells.map(({ r, c, seed }) => {
              const sweep = (frame * 0.015 + seed) % 1;
              const colPhase = (c / COLS + frame * 0.008) % 1;
              const intensity = Math.max(0, 1 - Math.abs(sweep - colPhase) * 5);
              const hot = intensity > 0.7;
              const background = hot
                ? "var(--accent)"
                : `rgba(var(--cell-rgb, 255 255 255), ${0.04 + intensity * 0.2})`;
              return (
                <div
                  key={`${r}-${c}`}
                  className="rounded-[2px]"
                  style={{
                    aspectRatio: "1 / 1",
                    background,
                    opacity: 0.3 + intensity * 0.7,
                    transition: "background 200ms",
                  }}
                />
              );
            })}
          </div>

          {/* Code-of-record coverage rows */}
          <div className="grid gap-y-2 border-t border-border pt-3.5">
            {COVERAGE.map((row) => (
              <div
                key={row.l}
                className="flex items-baseline justify-between gap-4 font-mono text-[11px]"
              >
                <span className="text-text-dim">{row.l}</span>
                <span className="text-right text-text-muted">{row.v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
