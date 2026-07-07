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
    body: "Understand the product, users, and platform trade-offs. We map the stack before committing to one.",
    deliverable: "One-page decision brief",
  },
  {
    title: "Design",
    body: "Product design in Figma with prototypes. Native patterns on each platform — not one reskinned UI.",
    deliverable: "Prototype + design system",
  },
  {
    title: "Build",
    body: "Weekly demos. You play with the real app in TestFlight and Play Console internal tracks from week two.",
    deliverable: "Working build every week",
  },
  {
    title: "QA",
    body: "Manual regression on real devices. Automated end-to-end on CI. Crash reporting wired in before launch.",
    deliverable: "Test report + device matrix",
  },
  {
    title: "Store submission",
    body: "Metadata, screenshots, review prep, rejection handling. We write the review response if Apple pushes back.",
    deliverable: "Published listings",
  },
  {
    title: "Post-launch",
    body: "Release management, crash triage, analytics review, SDK updates, and OS-upgrade readiness as they land.",
    deliverable: "Retainer or handoff package",
  },
];

export default function ProcessTimeline() {
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
      aria-label="Mobile app development process"
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
