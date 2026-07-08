"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Copy } from "lucide-react";
import { QUICKSTART } from "@/data/site";

const LINES = QUICKSTART.split("\n");

const BULLETS: readonly string[] = [
  "No cloud account or API keys needed",
  "Postgres, Redis and LocalStack via Docker Compose",
  "Seeded dev login: admin@acme.com / password123",
];

/**
 * Terminal-style quickstart card with a copy-to-clipboard button. Renders the
 * canonical local-eval command block from `@/data/site` — comments dimmed,
 * commands prefixed with an accent `$`.
 */
export default function QuickstartInstall() {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(QUICKSTART);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard unavailable (e.g. insecure context) — no-op.
    }
  };

  return (
    <section className="border-b border-border px-6 py-24 sm:px-12">
      <div className="mx-auto grid max-w-[1280px] grid-cols-1 items-center gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-[72px]">
        {/* Copy column */}
        <div>
          <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-accent">
            § 01 · QUICKSTART
          </div>
          <h2 className="my-5 font-display text-[40px] font-medium leading-[1.02] tracking-display text-text sm:text-[48px]">
            Clone. Compose.{" "}
            <span className="italic font-normal text-accent">Done.</span>
          </h2>
          <p className="max-w-[440px] font-sans text-[16px] leading-[1.6] text-text-muted">
            Spin up the full stack — API, portal and admin — locally in one
            clone. Free, offline, and evaluation-ready in about fifteen minutes.
          </p>

          <ul className="mt-7 grid gap-2.5">
            {BULLETS.map((b) => (
              <li key={b} className="flex items-start gap-3">
                <span className="mt-0.5 text-accent" aria-hidden="true">
                  <Check size={16} strokeWidth={1.8} />
                </span>
                <span className="font-sans text-[14.5px] leading-[1.5] text-text-muted">
                  {b}
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-7">
            <Link href="/self-host" className="halo-btn-ghost halo-arrow-parent">
              Self-hosting guide{" "}
              <span className="halo-arrow" aria-hidden="true">
                &rarr;
              </span>
            </Link>
          </div>
        </div>

        {/* Terminal card */}
        <div className="overflow-hidden rounded-[14px] border border-border-strong bg-surface shadow-halo-lift">
          {/* Window chrome */}
          <div className="flex items-center gap-1.5 border-b border-border bg-surface-alt px-3.5 py-3">
            <span className="h-2.5 w-2.5 rounded-full bg-border" />
            <span className="h-2.5 w-2.5 rounded-full bg-border" />
            <span className="h-2.5 w-2.5 rounded-full bg-border" />
            <span className="ml-2.5 font-mono text-[10.5px] text-text-dim">
              bash — local eval
            </span>
            <button
              type="button"
              onClick={copy}
              aria-label={copied ? "Copied" : "Copy quickstart commands"}
              className="ml-auto flex cursor-pointer items-center gap-1.5 rounded-md border border-border bg-transparent px-2.5 py-1 font-mono text-[10.5px] uppercase tracking-[0.12em] text-text-muted transition-colors hover:border-border-strong hover:text-text"
            >
              {copied ? (
                <>
                  <Check size={12} strokeWidth={2} className="text-accent" />
                  Copied
                </>
              ) : (
                <>
                  <Copy size={12} strokeWidth={2} />
                  Copy
                </>
              )}
            </button>
          </div>

          {/* Command body */}
          <div className="overflow-x-auto px-4 py-4">
            <pre className="m-0 font-mono text-[12.5px] leading-[1.7]">
              <code>
                {LINES.map((line, i) => {
                  const trimmed = line.trimStart();
                  const isComment = trimmed.startsWith("#");
                  const isBlank = trimmed.length === 0;
                  if (isBlank) {
                    return <span key={i}>{"\n"}</span>;
                  }
                  if (isComment) {
                    return (
                      <span key={i} className="text-text-dim">
                        {line}
                        {"\n"}
                      </span>
                    );
                  }
                  return (
                    <span key={i} className="whitespace-pre text-text">
                      <span className="select-none text-accent">$ </span>
                      {line}
                      {"\n"}
                    </span>
                  );
                })}
              </code>
            </pre>
          </div>
        </div>
      </div>
    </section>
  );
}
