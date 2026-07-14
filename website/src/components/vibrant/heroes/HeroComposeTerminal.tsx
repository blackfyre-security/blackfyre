"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";

/**
 * SELF-HOST hero — a docker-compose boot terminal.
 *
 * A dark macOS-style terminal running `docker compose up -d`. Six services flip
 * from amber "⏳ starting…" to lime "✓ healthy" in sequence, then a final
 * "✓ stack healthy → http://localhost:3000" line resolves.
 *
 * SSR renders the settled, all-healthy state (healthy labels visible, starting
 * labels hidden). `if (reduce) return` runs before any reset, so reduced-motion
 * / no-JS visitors see the finished, healthy stack.
 */
const SERVICES = [
  { name: "postgres", port: ":5432" },
  { name: "redis", port: ":6379" },
  { name: "api", port: ":8080" },
  { name: "web", port: ":3000" },
  { name: "worker", port: "queue" },
  { name: "minio", port: ":9000" },
];

export default function HeroComposeTerminal() {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const root = rootRef.current;
    if (!root) return;

    const starting = Array.from(root.querySelectorAll<HTMLElement>(".svc-starting"));
    const healthy = Array.from(root.querySelectorAll<HTMLElement>(".svc-healthy"));
    const footer = root.querySelector<HTMLElement>(".svc-footer");

    // SSR already renders the settled, healthy state.
    if (reduce) return;

    gsap.set(starting, { opacity: 1 });
    gsap.set(healthy, { opacity: 0 });
    if (footer) gsap.set(footer, { opacity: 0 });

    const tl = gsap.timeline({ delay: 0.3 });
    healthy.forEach((h, i) => {
      tl.to(starting[i], { opacity: 0, duration: 0.2 }, i * 0.45 + 0.35)
        .to(h, { opacity: 1, duration: 0.25 }, i * 0.45 + 0.4);
    });
    if (footer) tl.to(footer, { opacity: 1, duration: 0.3 }, "+=0.15");

    return () => {
      tl.kill();
    };
  }, []);

  return (
    <div
      ref={rootRef}
      className="overflow-hidden rounded-2xl border border-zinc-800 bg-[#0c0c10] font-mono text-[12.5px] leading-relaxed shadow-[0_28px_60px_-24px_rgba(0,0,0,0.7)]"
    >
      {/* Title bar */}
      <div className="flex items-center gap-2 border-b border-white/5 bg-white/[0.03] px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f56]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#ffbd2e]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#27c93f]" />
        <span className="ml-2 text-[11px] text-zinc-500">blackfyre — self-host</span>
      </div>

      <div className="space-y-1.5 p-5">
        <div className="text-zinc-300">
          <span className="text-lime-400">$</span> docker compose up -d
        </div>

        <div className="mt-2 space-y-1.5">
          {SERVICES.map((s) => (
            <div key={s.name} className="flex items-center justify-between">
              <span className="text-zinc-400">
                {s.name}
                <span className="ml-1 text-zinc-600">{s.port}</span>
              </span>
              <span className="relative inline-flex min-w-[104px] justify-end">
                {/* SSR/no-JS shows the settled "healthy" state; starting is hidden
                    by default and only revealed by JS to animate the flip. */}
                <span className="svc-starting absolute inset-0 text-right text-amber-400 opacity-0">
                  ⏳ starting…
                </span>
                <span className="svc-healthy text-lime-400">✓ healthy</span>
              </span>
            </div>
          ))}
        </div>

        <div className="svc-footer mt-3 border-t border-white/5 pt-3 text-lime-400">
          ✓ stack healthy → http://localhost:3000
        </div>
      </div>
    </div>
  );
}
