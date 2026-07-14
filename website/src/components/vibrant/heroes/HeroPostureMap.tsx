"use client";

import { useEffect, useRef } from "react";
import { animate, stagger } from "animejs";
import gsap from "gsap";

/**
 * HOME hero — a live compliance posture map.
 *
 * Three coordinated animations, all reduced-motion + SSR safe:
 *   1. anime.js grid-stagger opacity sweep across a 22×8 matrix (the "scan").
 *   2. On every sweep, a fresh random set of cells flips amber (a finding).
 *   3. Each cycle the posture score + the four framework bars GSAP-tween to new,
 *      correlated values — more findings → lower score, a bar < 96% turns amber.
 *
 * SSR renders the resting numbers + faint grid (real content in static HTML);
 * JS only enhances after mount.
 */
const COLS = 22;
const ROWS = 8;
const CELLS = COLS * ROWS;

const FRAMEWORKS = [
  { fw: "SOC 2 Type II", base: 97.9 },
  { fw: "ISO 27001:2022", base: 98.2 },
  { fw: "HIPAA", base: 97.1 },
  { fw: "PCI-DSS v4.0", base: 94.8 },
];

const LIME = "#c6f24e";
const AMBER = "#f59e0b";

export default function HeroPostureMap() {
  const gridRef = useRef<HTMLDivElement>(null);
  const scoreRef = useRef<HTMLSpanElement>(null);
  const barRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const pctRefs = useRef<Array<HTMLSpanElement | null>>([]);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const grid = gridRef.current;
    const cells = grid
      ? Array.from(grid.querySelectorAll<HTMLElement>(".scan-cell"))
      : [];

    const rand = (min: number, max: number) => min + Math.random() * (max - min);

    const scoreObj = { v: 97.4 };
    const barObjs = FRAMEWORKS.map((f) => ({ v: f.base }));

    const randomizeWarn = () => {
      const warnCount = 2 + Math.floor(Math.random() * 6); // 2..7
      const warn = new Set<number>();
      while (warn.size < warnCount) warn.add(Math.floor(Math.random() * CELLS));
      cells.forEach((c, i) => {
        c.style.background = warn.has(i) ? AMBER : LIME;
      });
      return warnCount;
    };

    const updateStats = (warnCount: number) => {
      const targetScore = Math.max(95.5, 99.6 - warnCount * 0.5 - rand(0, 0.4));
      const barTargets = FRAMEWORKS.map((f) =>
        Math.min(99.7, Math.max(92, f.base + rand(-2.4, 1.4))),
      );

      if (reduce) {
        if (scoreRef.current) scoreRef.current.textContent = targetScore.toFixed(1);
        barTargets.forEach((t, i) => {
          const bar = barRefs.current[i];
          if (bar) {
            bar.style.width = `${t}%`;
            bar.style.background = t > 96 ? LIME : AMBER;
          }
          if (pctRefs.current[i]) pctRefs.current[i]!.textContent = `${t.toFixed(1)}%`;
        });
        return;
      }

      gsap.to(scoreObj, {
        v: targetScore,
        duration: 1.2,
        ease: "power2.out",
        onUpdate: () => {
          if (scoreRef.current) scoreRef.current.textContent = scoreObj.v.toFixed(1);
        },
      });
      barTargets.forEach((t, i) => {
        const bar = barRefs.current[i];
        if (bar)
          gsap.to(bar, {
            width: `${t}%`,
            background: t > 96 ? LIME : AMBER,
            duration: 1.2,
            ease: "power2.out",
          });
        gsap.to(barObjs[i], {
          v: t,
          duration: 1.2,
          ease: "power2.out",
          onUpdate: () => {
            if (pctRefs.current[i])
              pctRefs.current[i]!.textContent = `${barObjs[i].v.toFixed(1)}%`;
          },
        });
      });
    };

    let cancelled = false;
    let current: ReturnType<typeof animate> | null = null;
    let cycle = 0;

    if (reduce || !cells.length) {
      updateStats(randomizeWarn());
    } else {
      const runCycle = () => {
        if (cancelled) return;
        const warnCount = randomizeWarn();
        if (cycle % 2 === 0) updateStats(warnCount);
        cycle += 1;
        current = animate(cells, {
          opacity: [0.12, 0.9, 0.12],
          duration: 1100,
          delay: stagger(40, { grid: [COLS, ROWS], from: "first", axis: "x" }),
          ease: "inOutSine",
          onComplete: () => {
            if (!cancelled) runCycle();
          },
        });
      };
      runCycle();
    }

    return () => {
      cancelled = true;
      current?.pause();
      current?.revert();
      gsap.killTweensOf(scoreObj);
      barObjs.forEach((o) => gsap.killTweensOf(o));
      barRefs.current.forEach((b) => b && gsap.killTweensOf(b));
    };
  }, []);

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-[0_20px_50px_-24px_rgba(9,9,14,0.25)]">
      <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
        <div className="font-mono text-[11px] font-bold uppercase tracking-widest text-blue-600">
          Posture map · multi-cloud
        </div>
        <div className="flex items-center gap-1.5 font-mono text-[11px] text-lime-600">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-lime-500 motion-reduce:animate-none" />
          Scanning
        </div>
      </div>

      <div className="mt-5 flex items-baseline justify-between">
        <div>
          <div className="font-mono text-[10.5px] font-bold uppercase tracking-widest text-zinc-400">
            Posture score
          </div>
          <div className="mt-1 text-4xl font-extrabold tracking-tight text-zinc-900">
            <span ref={scoreRef}>97.4</span>
            <span className="text-xl text-zinc-400">/100</span>
          </div>
        </div>
        <span className="rounded-md border border-lime-200 bg-lime-50 px-2 py-0.5 font-mono text-[11px] font-semibold text-lime-700">
          678 controls
        </span>
      </div>

      {/* Scan matrix */}
      <div
        ref={gridRef}
        aria-hidden="true"
        className="mt-6 grid gap-[3px]"
        style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)` }}
      >
        {Array.from({ length: CELLS }).map((_, i) => (
          <span
            key={i}
            className="scan-cell rounded-[2px]"
            style={{ aspectRatio: "1 / 1", background: LIME, opacity: 0.1 }}
          />
        ))}
      </div>

      {/* Framework bars */}
      <div className="mt-6 grid gap-3">
        {FRAMEWORKS.map((r, i) => (
          <div key={r.fw} className="grid grid-cols-[120px_1fr_44px] items-center gap-3">
            <span className="text-xs font-medium text-zinc-700">{r.fw}</span>
            <span className="h-1.5 overflow-hidden rounded-full bg-zinc-100">
              <span
                ref={(el) => {
                  barRefs.current[i] = el;
                }}
                className="block h-full rounded-full"
                style={{ width: `${r.base}%`, background: r.base > 96 ? LIME : AMBER }}
              />
            </span>
            <span
              ref={(el) => {
                pctRefs.current[i] = el;
              }}
              className="text-right font-mono text-[11px] text-zinc-500"
            >
              {r.base}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
