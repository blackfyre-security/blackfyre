"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";

/**
 * SECURITY hero — a live resource threat scan.
 *
 * A 10×8 grid of cloud resources. SSR paints every cell in its RESOLVED triage
 * colour (critical/high/medium/passed) so the finished assessment is in static
 * HTML. For motion users, JS resets the grid to neutral and a vertical scan
 * line sweeps L→R, resolving each column's cells as it passes; the findings
 * tally counts up in step.
 *
 * `if (reduce) return` runs before any reset, so reduced-motion / no-JS
 * visitors see the resolved grid and final tallies.
 */
const COLS = 10;
const ROWS = 8;
const CELLS = COLS * ROWS;

type Status = "critical" | "high" | "medium" | "passed";

const NEUTRAL = "#e4e4e7";
const COLOR: Record<Status, string> = {
  critical: "#ef4444",
  high: "#f59e0b",
  medium: "#facc15",
  passed: "#c6f24e",
};

// Deterministic triage layout (stable SSR/CSR markup — no Math.random in render).
function statusFor(i: number): Status {
  const r = (i * 2654435761) % 100;
  if (r < 4) return "critical";
  if (r < 14) return "high";
  if (r < 30) return "medium";
  return "passed";
}

const STATUSES = Array.from({ length: CELLS }, (_, i) => statusFor(i));
const TALLY = {
  critical: STATUSES.filter((s) => s === "critical").length,
  high: STATUSES.filter((s) => s === "high").length,
  medium: STATUSES.filter((s) => s === "medium").length,
  passed: STATUSES.filter((s) => s === "passed").length,
};

const LEGEND: Array<{ key: keyof typeof COLOR; label: string }> = [
  { key: "critical", label: "Critical" },
  { key: "high", label: "High" },
  { key: "medium", label: "Medium" },
  { key: "passed", label: "Passed" },
];

export default function HeroThreatScan() {
  const gridRef = useRef<HTMLDivElement>(null);
  const [counts, setCounts] = useState(TALLY);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const grid = gridRef.current;
    if (!grid) return;
    const cells = Array.from(grid.querySelectorAll<HTMLElement>(".scan-cell"));

    // SSR already shows the resolved grid + final tallies — enhance only for motion.
    if (reduce) return;

    gsap.set(cells, { backgroundColor: NEUTRAL });
    const line = grid.querySelector<HTMLElement>(".scan-line");
    const running = { critical: 0, high: 0, medium: 0, passed: 0 };
    setCounts({ ...running });

    const sweepDur = COLS * 0.16 + 0.25;
    const tl = gsap.timeline({ delay: 0.2 });
    if (line) {
      gsap.set(line, { left: "0%", opacity: 1 });
      tl.to(line, { left: "100%", duration: sweepDur, ease: "none" }, 0)
        .to(line, { opacity: 0, duration: 0.3 }, sweepDur - 0.1);
    }
    for (let col = 0; col < COLS; col++) {
      const colCells = cells.filter((_, i) => i % COLS === col);
      tl.to(
        colCells,
        {
          backgroundColor: (idx: number) =>
            COLOR[STATUSES[cells.indexOf(colCells[idx])]],
          duration: 0.25,
          ease: "power1.out",
          onStart: () => {
            colCells.forEach((c) => {
              const s = STATUSES[cells.indexOf(c)];
              running[s] += 1;
            });
            setCounts({ ...running });
          },
        },
        col * 0.16,
      );
    }

    return () => {
      tl.kill();
    };
  }, []);

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-[0_20px_50px_-24px_rgba(9,9,14,0.25)]">
      <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
        <div className="font-mono text-[11px] font-bold uppercase tracking-widest text-blue-600">
          Threat scan · live
        </div>
        <div className="flex items-center gap-1.5 font-mono text-[11px] text-blue-600">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-500 motion-reduce:animate-none" />
          {CELLS} resources
        </div>
      </div>

      {/* Resource grid + sweeping scan line */}
      <div
        ref={gridRef}
        aria-hidden="true"
        className="relative mt-5 grid gap-[3px] overflow-hidden rounded-lg"
        style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)` }}
      >
        {STATUSES.map((s, i) => (
          <span
            key={i}
            className="scan-cell rounded-[2px]"
            style={{ aspectRatio: "1 / 1", background: COLOR[s] }}
          />
        ))}
        <span className="scan-line pointer-events-none absolute inset-y-0 left-0 w-[2px] bg-blue-400/70 shadow-[0_0_12px_2px_rgba(96,165,250,0.6)] motion-reduce:hidden" />
      </div>

      {/* Findings tally */}
      <div className="mt-6 grid grid-cols-4 gap-2">
        {LEGEND.map(({ key, label }) => (
          <div
            key={key}
            className="rounded-lg border border-zinc-100 bg-zinc-50/60 px-2 py-2 text-center"
          >
            <div
              className="font-mono text-lg font-extrabold tabular-nums"
              style={{ color: COLOR[key] }}
            >
              {counts[key]}
            </div>
            <div className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-400">
              {label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
