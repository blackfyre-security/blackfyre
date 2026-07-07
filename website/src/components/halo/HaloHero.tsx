"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AGENTS } from "@/lib/halo-data";
import { useInterval } from "@/lib/halo-hooks";

const ROTATING_WORDS = ["mapped", "scored", "attested", "evidenced"] as const;

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

interface Stat {
  k: string;
  l: string;
}

const STATS: readonly Stat[] = [
  { k: "34", l: "agents" },
  { k: "9", l: "frameworks" },
  { k: "10m", l: "first scan" },
  { k: "99.87%", l: "uptime" },
];

/**
 * Hero surface: headline + CTAs on the left, animated 22x8 posture-scan
 * matrix on the right, cursor-tracking radial glow across the section,
 * and 18 drifting particles. All motion is client-side; SSR output is
 * the initial frame (frame=0).
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

  const wordIdx = Math.floor(frame / 45) % ROTATING_WORDS.length;
  const currentWord = ROTATING_WORDS[wordIdx];

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
            <span
              className="inline-block h-1.5 w-1.5 rounded-full animate-halo-pulse"
              style={{
                background: "var(--accent)",
                boxShadow: "0 0 10px var(--accent)",
              }}
            />
            Live · 34 agents online
          </div>

          <h1 className="mt-7 font-display font-medium leading-[0.96] tracking-tightest text-text text-[clamp(48px,6.4vw,88px)] [text-wrap:balance]">
            Security posture,
            <br />
            <span className="text-text-muted">continuously </span>
            <span className="relative inline-block italic font-normal text-accent">
              <span
                key={wordIdx}
                className="inline-block animate-halo-word-in"
              >
                {currentWord}.
              </span>
            </span>
          </h1>

          <p className="mb-0 mt-7 max-w-[520px] font-sans text-lg leading-[1.55] text-text-muted">
            Thirty-four autonomous agents scan your infrastructure every minute,
            map findings to nine frameworks, and hand your team an auditable
            trail — without a compliance ops function sitting behind them.
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Link href="/contact" className="halo-btn-accent">
              Talk to us &rarr;
            </Link>
            <span className="ml-1 font-mono text-xs text-text-dim">
              Reply within 24 hours
            </span>
          </div>

          {/* Stat strip */}
          <div className="mt-14 grid max-w-[540px] grid-cols-2 gap-6 sm:grid-cols-4">
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

        {/* Right column — scanning matrix */}
        <div className="relative overflow-hidden rounded-[14px] border border-border bg-surface p-[22px]">
          <div className="mb-[18px] flex items-center justify-between">
            <div
              className="font-mono text-[11px] uppercase tracking-[0.12em]"
              style={{ color: "var(--brand-cool)" }}
            >
              POSTURE MAP · eu-west-2
            </div>
            <div className="font-mono text-[11px] text-accent">● SCANNING</div>
          </div>

          {/* Matrix */}
          <div
            className="mb-[18px] grid gap-[3px]"
            style={{
              gridTemplateColumns: `repeat(${COLS}, 1fr)`,
            }}
            aria-hidden="true"
          >
            {cells.map(({ r, c, seed }) => {
              // Sweep pulse from left to right; trailing gradient.
              const sweep = (frame * 0.015 + seed) % 1;
              const colPhase = (c / COLS + frame * 0.008) % 1;
              const intensity = Math.max(0, 1 - Math.abs(sweep - colPhase) * 5);
              const hot = intensity > 0.7;
              const warn = seed > 0.96 && Math.floor(frame / 40) % 3 === 0;
              const background = warn
                ? "var(--warn)"
                : hot
                ? "var(--accent)"
                : `rgba(var(--cell-rgb, 255 255 255), ${0.04 + intensity * 0.2})`;
              return (
                <div
                  key={`${r}-${c}`}
                  className="rounded-[2px]"
                  style={{
                    aspectRatio: "1 / 1",
                    background,
                    opacity: warn ? 0.9 : 0.3 + intensity * 0.7,
                    transition: "background 200ms",
                  }}
                />
              );
            })}
          </div>

          {/* Agent ticker */}
          <div
            className="grid grid-cols-1 gap-x-[18px] gap-y-1.5 border-t border-border pt-3.5 sm:grid-cols-2"
          >
            {AGENTS.map((a, i) => {
              const active = Math.floor(frame / 20) % AGENTS.length === i;
              return (
                <div
                  key={a.id}
                  className="flex items-center justify-between font-mono text-[11px]"
                  style={{
                    color: active ? "var(--text)" : "var(--muted)",
                    transition: "color 200ms",
                  }}
                >
                  <span className="flex items-center gap-2">
                    <span
                      className="h-[5px] w-[5px] rounded-full"
                      style={{
                        background: active ? "var(--accent)" : "var(--dim)",
                        boxShadow: active ? "0 0 8px var(--accent)" : "none",
                      }}
                    />
                    {a.id} · {a.name}
                  </span>
                  <span>{a.findings === 0 ? "✓" : `${a.findings}`}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
