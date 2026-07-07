"use client";

import { useEffect, useRef, useState } from "react";

interface Step {
  title: string;
  body: string;
  deliverable: string;
}

const STEPS: Step[] = [
  {
    title: "Discovery",
    body: "Scope, stack fit, hosting, timeline. We agree the shape before writing a line.",
    deliverable: "Brief + stack decision",
  },
  {
    title: "Design",
    body: "Wireframes, content model, component system. Figma plus a token set you can inherit.",
    deliverable: "Figma + token set",
  },
  {
    title: "Build",
    body: "Routes, auth, data, CI in the first week. You see the real thing on a staging URL, not slides.",
    deliverable: "Staging URL",
  },
  {
    title: "Content + QA",
    body: "Real copy, real data. Lighthouse, accessibility, and cross-browser pass before anyone signs off.",
    deliverable: "Audit report",
  },
  {
    title: "Deploy",
    body: "Custom domain, SSL, CDN, analytics wired. Ownership of the hosting account sits with you.",
    deliverable: "Production URL",
  },
  {
    title: "Observe + iterate",
    body: "Sentry, logs, weekly review cadence. Ship small, ship often, measure everything.",
    deliverable: "Runbook + dashboard",
  },
];

export default function WebProcessTimeline() {
  const ref = useRef<HTMLOListElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          obs.unobserve(el);
        }
      },
      { threshold: 0.1, rootMargin: "0px 0px -80px 0px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <ol
      ref={ref}
      className="relative mx-auto max-w-3xl pl-10 sm:pl-14"
      aria-label="Web development process"
    >
      {/* Rail */}
      <span
        aria-hidden
        className="absolute left-3 top-2 bottom-2 w-px bg-border sm:left-5"
      />

      {STEPS.map((step, i) => (
        <li
          key={step.title}
          className="relative mb-10 last:mb-0"
          style={{ transitionDelay: `${i * 60}ms` }}
        >
          {/* Node */}
          <span
            aria-hidden
            className="absolute -left-[34px] top-1 flex h-6 w-6 items-center justify-center rounded-full border border-border-strong bg-bg sm:-left-[46px]"
          >
            <span className="font-mono text-[10px] text-accent">
              {String(i + 1).padStart(2, "0")}
            </span>
          </span>

          <div
            className={`reveal ${visible ? "is-visible" : ""}`}
            style={{ transitionDelay: `${i * 70}ms` }}
          >
            <p className="halo-label mb-1">Step {i + 1}</p>
            <h3 className="font-display text-2xl leading-tight tracking-display text-text sm:text-[28px]">
              {step.title}
            </h3>
            <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-text-muted">
              {step.body}
            </p>
            <p className="mt-3 flex items-center gap-2 text-xs text-text-dim">
              <span className="h-px w-6 bg-border-strong" />
              <span className="font-mono uppercase tracking-wider">
                Deliverable
              </span>
              <span className="text-text-muted">{step.deliverable}</span>
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
