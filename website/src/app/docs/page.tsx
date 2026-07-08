import type { Metadata } from "next";
import type { ReactNode } from "react";
import HaloNav from "@/components/halo/HaloNav";
import HaloFooter from "@/components/halo/HaloFooter";
import HaloSectionHead from "@/components/halo/HaloSectionHead";
import HaloCTA from "@/components/halo/HaloCTA";
import HaloReveal from "@/components/halo/HaloReveal";
import { SITE, DOCS, QUICKSTART, type DocLink } from "@/data/site";

export const metadata: Metadata = {
  title: "Docs — Blackfyre",
  description:
    "Documentation hub for Blackfyre, the open-source multi-cloud compliance platform: local setup, self-hosting, architecture decisions, ADRs, and project policies.",
};

const LOCAL_DEV_URL =
  DOCS.find((d) => d.title.toLowerCase().includes("local development"))?.url ??
  SITE.repoUrl;
const REPO_DOCS_URL = `${SITE.repoUrl}/tree/main/docs`;

// Bucket the single source of truth (DOCS) into reading-order groups. The
// first three predicates carve out their sets; PROJECT is the catch-all, so
// every one of the 22 links lands in exactly one group and none are dropped.
const START = DOCS.filter((d) =>
  /local development|self-hosting|configuration/i.test(d.title),
);
const DEVELOPER = DOCS.filter((d) =>
  /monorepo|api overview|migration|testing|deployment|llm provider/i.test(
    d.title,
  ),
);
const ARCHITECTURE = DOCS.filter((d) => /^architecture|adr-/i.test(d.title));
const PLACED = new Set(
  [...START, ...DEVELOPER, ...ARCHITECTURE].map((d) => d.url),
);
const PROJECT = DOCS.filter((d) => !PLACED.has(d.url));

function DocCard({ doc, kicker }: { doc: DocLink; kicker: string }) {
  return (
    <a
      href={doc.url}
      target="_blank"
      rel="noreferrer"
      className="halo-card halo-card-hover group flex flex-col p-6"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-text-dim">
          {kicker}
        </span>
        <span
          aria-hidden="true"
          className="font-mono text-[13px] text-text-dim transition-colors group-hover:text-accent"
        >
          ↗
        </span>
      </div>
      <h3 className="mt-3 font-sans text-[16px] font-medium tracking-[-0.02em] text-text">
        {doc.title}
      </h3>
      {doc.blurb && (
        <p className="mt-2 flex-1 font-sans text-[13px] leading-[1.55] text-text-muted">
          {doc.blurb}
        </p>
      )}
    </a>
  );
}

function DocGroup({
  eyebrow,
  title,
  titleAccent,
  blurb,
  docs,
  grid,
  children,
}: {
  eyebrow: string;
  title: string;
  titleAccent?: string;
  blurb: string;
  docs: readonly DocLink[];
  grid: string;
  children?: ReactNode;
}) {
  return (
    <HaloReveal
      as="section"
      delay={0}
      className="border-b border-border px-6 py-24 sm:px-12"
    >
      <HaloSectionHead
        eyebrow={eyebrow}
        title={title}
        titleAccent={titleAccent}
        blurb={blurb}
      />
      <div className={`mx-auto mt-12 grid max-w-[1160px] grid-cols-1 gap-4 ${grid}`}>
        {docs.map((d, i) => (
          <DocCard
            key={d.url}
            doc={d}
            kicker={String(i + 1).padStart(2, "0")}
          />
        ))}
      </div>
      {children}
    </HaloReveal>
  );
}

export default function DocsPage() {
  return (
    <>
      <HaloNav />

      {/* ── Hero ────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-border bg-surface">
        <div className="halo-hero-glow" aria-hidden="true" />
        <div className="relative mx-auto max-w-[1280px] px-6 py-24 sm:px-12 sm:py-28">
          <p className="halo-eyebrow">
            <span className="halo-live-dot" aria-hidden="true" />
            § 01 · Docs
          </p>
          <h1 className="mt-5 max-w-[880px] font-display font-medium leading-[1.05] tracking-tightest text-text text-[clamp(44px,5.6vw,68px)] [text-wrap:balance]">
            Everything you need to{" "}
            <span className="text-accent italic font-normal">run</span> Blackfyre.
          </h1>
          <p className="mt-6 max-w-[660px] font-sans text-[17px] leading-[1.55] text-text-muted">
            Blackfyre is open source, Apache-2.0, and free to self-host forever.
            These guides link straight into the repository — from a ~15-minute
            local stack to running production on your own AWS account, plus the
            architecture decisions and policies behind it. Nothing here is
            behind a login.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a
              href={SITE.repoUrl}
              target="_blank"
              rel="noreferrer"
              className="halo-btn-accent"
            >
              View source{" "}
              <span className="halo-arrow" aria-hidden="true">
                &rarr;
              </span>
            </a>
            <a href="#quickstart" className="halo-btn-ghost">
              Quickstart
            </a>
          </div>
          <div className="mt-9 flex flex-wrap gap-1.5">
            {[
              `${DOCS.length} guides`,
              "4 ADRs",
              "Local + production",
              "Apache-2.0",
              "Self-host free",
            ].map((chip) => (
              <span
                key={chip}
                className="rounded-md border border-border bg-surface-alt px-2.5 py-1 font-mono text-[10.5px] uppercase tracking-[0.1em] text-text-muted"
              >
                {chip}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Repo callout strip ──────────────────────────────────── */}
      <HaloReveal
        as="section"
        delay={0}
        className="border-b border-border bg-surface-alt px-6 py-8 sm:px-12"
      >
        <div className="mx-auto flex max-w-[1160px] flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <p className="max-w-[720px] font-sans text-[14px] leading-[1.55] text-text-muted">
            <span className="font-mono text-accent">›</span> Every card below
            opens a file in the source tree. The complete, always-current docs
            live in the <span className="text-text">repository</span> —
            versioned alongside the code they describe, never stale.
          </p>
          <a
            href={REPO_DOCS_URL}
            target="_blank"
            rel="noreferrer"
            className="shrink-0 inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-[0.06em] text-accent"
          >
            Browse /docs <span aria-hidden="true">↗</span>
          </a>
        </div>
      </HaloReveal>

      {/* ── § 02 · Get started ──────────────────────────────────── */}
      <DocGroup
        eyebrow="§ 02 · Get started"
        title="Clone it and have it running."
        titleAccent="running"
        blurb="Stand up the full stack locally with no cloud account or API keys, then graduate to production on your own AWS when you're ready."
        docs={START}
        grid="sm:grid-cols-2 lg:grid-cols-3"
      >
        <div id="quickstart" className="mx-auto mt-10 max-w-[1160px] scroll-mt-24">
          <div className="halo-card-strong overflow-hidden">
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-accent">
                Quickstart · local stack
              </span>
              <span className="font-mono text-[10.5px] text-text-dim">
                no cloud account · no API keys
              </span>
            </div>
            <pre className="overflow-x-auto px-5 py-5 font-mono text-[12.5px] leading-[1.65] text-text-muted">
              <code>{QUICKSTART}</code>
            </pre>
          </div>
          <p className="mt-3 font-mono text-[11px] text-text-dim">
            Full walkthrough, troubleshooting, and reset flow →{" "}
            <a
              href={LOCAL_DEV_URL}
              target="_blank"
              rel="noreferrer"
              className="text-accent"
            >
              Local development guide ↗
            </a>
          </p>
        </div>
      </DocGroup>

      {/* ── § 03 · Developer ────────────────────────────────────── */}
      <DocGroup
        eyebrow="§ 03 · Developer"
        title="Work inside the monorepo."
        titleAccent="monorepo"
        blurb="How the packages fit together, how the API is composed, how migrations and tests run, how code ships, and where the AI provider routing lives."
        docs={DEVELOPER}
        grid="sm:grid-cols-2 lg:grid-cols-3"
      />

      {/* ── § 04 · Architecture & decisions ─────────────────────── */}
      <DocGroup
        eyebrow="§ 04 · Architecture & decisions"
        title="The shape, and why it's shaped that way."
        titleAccent="why"
        blurb="The deployment topology plus the four architecture decision records — tenant isolation, the queue design, scanner orchestration, and AI model routing — written down and defensible."
        docs={ARCHITECTURE}
        grid="sm:grid-cols-2 lg:grid-cols-3"
      />

      {/* ── § 05 · Project & policies ───────────────────────────── */}
      <DocGroup
        eyebrow="§ 05 · Project & policies"
        title="How the project is run."
        titleAccent="run"
        blurb="Roadmap, how to contribute, governance, the security and data-collection policies, the code of conduct, trademark terms, and the license — the social contract of the repo."
        docs={PROJECT}
        grid="sm:grid-cols-2 lg:grid-cols-4"
      />

      <HaloCTA
        title="Read the code, not the marketing."
        titleAccent="code"
        sub="Every guide on this page points into a public, Apache-2.0 repository. Clone it, audit it, and self-host it for free."
        eyebrow="§ Start"
        primaryLabel="Star on GitHub"
        primaryHref={SITE.repoUrl}
        secondaryLabel="Browse /docs"
        secondaryHref={REPO_DOCS_URL}
      />

      <HaloFooter />
    </>
  );
}
