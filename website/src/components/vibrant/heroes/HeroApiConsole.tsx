"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";

/**
 * DOCS hero — a live API console.
 *
 * A request panel (curl / TypeScript / Python tabs, POST /v1/scans) beside a
 * dark JSON response panel whose lines stream in top-to-bottom with a blinking
 * lime cursor and a "200 OK" chip.
 *
 * SSR renders the full response (every line visible). `if (reduce) return` runs
 * before the lines are hidden, so reduced-motion / no-JS visitors read the
 * complete JSON.
 */
const TABS = ["curl", "TypeScript", "Python"] as const;

// Mirrors the real self-hosted API (platform/packages/api): POST /api/scans on
// the local instance (:4000), API-key auth, body { frameworks, targets,
// scanTypes }, and a 202 { scan, message } envelope. No hosted SaaS endpoint.
const REQUESTS: Record<(typeof TABS)[number], string[]> = {
  curl: [
    "curl -X POST http://localhost:4000/api/scans \\",
    '  -H "Authorization: Bearer $BLACKFYRE_API_KEY" \\',
    '  -H "Content-Type: application/json" \\',
    "  -d '{ \"frameworks\": [\"soc2\"], \"targets\": [\"aws\"] }'",
  ],
  TypeScript: [
    'const res = await fetch("http://localhost:4000/api/scans", {',
    '  method: "POST",',
    "  headers: {",
    "    Authorization: `Bearer ${process.env.BLACKFYRE_API_KEY}`,",
    '    "Content-Type": "application/json",',
    "  },",
    '  body: JSON.stringify({ frameworks: ["soc2"], targets: ["aws"] }),',
    "});",
  ],
  Python: [
    "requests.post(",
    '    "http://localhost:4000/api/scans",',
    '    headers={"Authorization": f"Bearer {API_KEY}"},',
    '    json={"frameworks": ["soc2"], "targets": ["aws"]},',
    ")",
  ],
};

// Real 202 response envelope from POST /api/scans (redactCredentials(scan)).
const RESPONSE = [
  "{",
  '  "scan": {',
  '    "id": "8f3b21c4-5e9a-4c17-b0d2-3a1f6e7c9d84",',
  '    "status": "queued",',
  '    "frameworks": ["soc2"],',
  '    "targets": ["aws"],',
  '    "progress": 0,',
  '    "createdAt": "2026-07-12T09:24:00Z"',
  "  },",
  '  "message": "Scan queued for processing"',
  "}",
];

export default function HeroApiConsole() {
  const respRef = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState<(typeof TABS)[number]>("curl");

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const panel = respRef.current;
    if (!panel) return;
    const lines = Array.from(panel.querySelectorAll<HTMLElement>(".resp-line"));

    // SSR already renders the full response — enhance only for motion.
    if (reduce || !lines.length) return;

    const tl = gsap.timeline({ delay: 0.35 });
    tl.set(lines, { opacity: 0, y: 4 });
    tl.to(lines, {
      opacity: 1,
      y: 0,
      duration: 0.18,
      ease: "power1.out",
      stagger: 0.09,
    });

    return () => {
      tl.kill();
    };
  }, []);

  return (
    <div className="grid gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-[0_20px_50px_-24px_rgba(9,9,14,0.25)]">
      {/* Request */}
      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50">
        <div className="flex items-center gap-1 border-b border-zinc-200 px-3 pt-2">
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`rounded-t-md px-2.5 py-1.5 font-mono text-[11px] transition-colors ${
                tab === t
                  ? "bg-white text-zinc-900 shadow-[inset_0_-2px_0_0_#c6f24e]"
                  : "text-zinc-400 hover:text-zinc-600"
              }`}
            >
              {t}
            </button>
          ))}
          <span className="ml-auto py-1.5 font-mono text-[10px] font-semibold uppercase tracking-widest text-blue-600">
            POST /api/scans
          </span>
        </div>
        <pre className="overflow-x-auto p-3 font-mono text-[11.5px] leading-relaxed text-zinc-700">
          {REQUESTS[tab].join("\n")}
        </pre>
      </div>

      {/* Response */}
      <div className="overflow-hidden rounded-xl border border-zinc-800 bg-[#0c0c10]">
        <div className="flex items-center justify-between border-b border-white/5 px-3 py-2">
          <span className="font-mono text-[10.5px] uppercase tracking-widest text-zinc-500">
            Response
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-lime-400 motion-reduce:animate-none" />
            <span className="rounded border border-lime-500/30 bg-lime-500/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-lime-400">
              202 Accepted
            </span>
          </span>
        </div>
        <div
          ref={respRef}
          className="p-3 font-mono text-[11.5px] leading-relaxed text-zinc-300"
        >
          {RESPONSE.map((l, i) => (
            <div key={i} className="resp-line whitespace-pre">
              {l}
              {i === RESPONSE.length - 1 && (
                <span className="ml-1 inline-block h-3.5 w-1.5 -translate-y-[1px] animate-pulse bg-lime-400 align-middle motion-reduce:animate-none" />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
