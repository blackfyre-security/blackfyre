"use client";

import { useRef, useState, type KeyboardEvent } from "react";

interface QA {
  q: string;
  a: string;
}

const ITEMS: QA[] = [
  {
    q: "How long does App Store review take?",
    a: "Typical first review is one to three business days. We pre-flight the binary against the latest App Review Guidelines, write the review notes, and set up a TestFlight build so Apple reviewers see a working account. If they push back, we handle the response.",
  },
  {
    q: "Do you handle Apple Developer and Google Play enrollment?",
    a: "Yes. We walk you through business verification for Google Play and the Apple Developer Program (individual or organization with DUNS). Accounts stay in your name — you keep ownership and continuity.",
  },
  {
    q: "Who owns the code?",
    a: "You do. Source lives in your GitHub, GitLab, or Bitbucket. You own the repos, the CI pipelines, the signing keys, and the store listings. We hand over full credentials at launch — or earlier, on request.",
  },
  {
    q: "Native, Flutter, or React Native — how do you decide?",
    a: "Three questions: how deep are the platform integrations, how fast do you need to ship, and how large is the team that will maintain this. Deep HealthKit or MDM work needs native. Product MVPs with parity across platforms do well on Flutter or React Native. We write a one-page decision brief after discovery.",
  },
  {
    q: "Can you ship to one platform first?",
    a: "Yes, and we often recommend it. For consumer apps in India, Android-first is usually right. For premium B2B SaaS with an iPad audience, iOS-first can make sense. We build in a way that keeps the second platform a fast follow, not a rewrite.",
  },
];

export default function MobileFAQ() {
  const [openIdx, setOpenIdx] = useState<number | null>(0);
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const focusButton = (index: number) => {
    const normalized = (index + ITEMS.length) % ITEMS.length;
    buttonRefs.current[normalized]?.focus();
  };

  const handleKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        focusButton(i + 1);
        break;
      case "ArrowUp":
        e.preventDefault();
        focusButton(i - 1);
        break;
      case "Home":
        e.preventDefault();
        focusButton(0);
        break;
      case "End":
        e.preventDefault();
        focusButton(ITEMS.length - 1);
        break;
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <ul className="divide-y divide-border border-y border-border">
        {ITEMS.map((item, i) => {
          const isOpen = openIdx === i;
          const panelId = `faq-panel-${i}`;
          const buttonId = `faq-button-${i}`;
          return (
            <li key={item.q}>
              <h3>
                <button
                  ref={(el) => {
                    buttonRefs.current[i] = el;
                  }}
                  id={buttonId}
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  onClick={() => setOpenIdx(isOpen ? null : i)}
                  onKeyDown={(e) => handleKey(e, i)}
                  className="flex w-full items-center justify-between gap-6 py-5 text-left transition-colors hover:text-accent"
                >
                  <span className="font-display text-lg tracking-display text-text sm:text-xl">
                    {item.q}
                  </span>
                  <span
                    aria-hidden
                    className="relative flex h-6 w-6 shrink-0 items-center justify-center transition-transform duration-200"
                    style={{
                      transform: isOpen ? "rotate(45deg)" : "rotate(0deg)",
                    }}
                  >
                    <span className="absolute h-px w-4 bg-text-muted" />
                    <span className="absolute h-4 w-px bg-text-muted" />
                  </span>
                </button>
              </h3>
              <div
                id={panelId}
                role="region"
                aria-labelledby={buttonId}
                hidden={!isOpen}
                className="pb-6 pr-10 text-[15px] leading-relaxed text-text-muted"
              >
                {item.a}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
