"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";

/**
 * PLATFORM hero — the control-mapping matrix.
 *
 * Nine framework rows, each a track of 20 control cells that fill left→right as
 * the platform "maps" controls; a mono counter climbs 0 → 678 controls mapped.
 * Blue/violet chrome, lime covered cells.
 *
 * SSR renders the fully-mapped resting state (all cells covered, counter 678);
 * JS resets to empty and re-fills only for motion users. `if (reduce) return`
 * precedes any reset so reduced-motion / no-JS visitors keep the settled state.
 */
const CELLS_PER_ROW = 20;
const TOTAL_CONTROLS = 678;

const FRAMEWORKS = [
  { fw: "SOC 2 Type II", pct: 0.98 },
  { fw: "ISO 27001:2022", pct: 0.98 },
  { fw: "HIPAA", pct: 0.97 },
  { fw: "GDPR", pct: 0.96 },
  { fw: "PCI-DSS v4.0", pct: 0.95 },
  { fw: "DPDPA", pct: 0.94 },
  { fw: "ISO 42001", pct: 0.93 },
  { fw: "PDPPL", pct: 0.92 },
  { fw: "NIST 800-53", pct: 0.9 },
];

const LIME = "#c6f24e";

export default function HeroControlMatrix() {
  const rootRef = useRef<HTMLDivElement>(null);
  const counterRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const root = rootRef.current;
    if (!root) return;

    const covered = Array.from(
      root.querySelectorAll<HTMLElement>(".ctl-cell[data-on='1']"),
    );

    // SSR already paints the fully-mapped state — bail before any reset.
    if (reduce) return;

    gsap.set(covered, { opacity: 0.12, backgroundColor: "#e4e4e7" });
    const countObj = { v: 0 };
    if (counterRef.current) counterRef.current.textContent = "0";

    const tl = gsap.timeline({ delay: 0.15 });
    tl.to(covered, {
      opacity: 1,
      backgroundColor: LIME,
      duration: 0.5,
      ease: "power1.out",
      stagger: { each: 0.012, from: "start" },
    });
    tl.to(
      countObj,
      {
        v: TOTAL_CONTROLS,
        duration: 1.4,
        ease: "power2.out",
        onUpdate: () => {
          if (counterRef.current)
            counterRef.current.textContent = Math.round(countObj.v).toString();
        },
      },
      0,
    );

    return () => {
      tl.kill();
      gsap.killTweensOf(countObj);
    };
  }, []);

  return (
    <div
      ref={rootRef}
      className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-[0_20px_50px_-24px_rgba(9,9,14,0.25)]"
    >
      <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
        <div className="font-mono text-[11px] font-bold uppercase tracking-widest text-violet-600">
          Control matrix · unified
        </div>
        <div className="flex items-center gap-1.5 font-mono text-[11px] text-blue-600">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-500 motion-reduce:animate-none" />
          Mapping
        </div>
      </div>

      <div className="mt-5 flex items-baseline gap-2">
        <span
          ref={counterRef}
          className="font-mono text-4xl font-extrabold tracking-tight text-zinc-900"
        >
          {TOTAL_CONTROLS}
        </span>
        <span className="font-mono text-sm text-zinc-400">controls mapped</span>
      </div>

      <div className="mt-6 grid gap-2.5" aria-hidden="true">
        {FRAMEWORKS.map((r) => {
          const on = Math.round(CELLS_PER_ROW * r.pct);
          return (
            <div
              key={r.fw}
              className="grid grid-cols-[112px_1fr] items-center gap-3"
            >
              <span className="truncate text-[11px] font-medium text-zinc-600">
                {r.fw}
              </span>
              <span className="flex gap-[3px]">
                {Array.from({ length: CELLS_PER_ROW }).map((_, i) => {
                  const isOn = i < on;
                  return (
                    <span
                      key={i}
                      data-on={isOn ? "1" : "0"}
                      className="ctl-cell h-2.5 flex-1 rounded-[2px]"
                      style={{
                        background: isOn ? LIME : "#eeeef1",
                        opacity: isOn ? 1 : 0.6,
                      }}
                    />
                  );
                })}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
