import type { Metadata } from "next";
import {
  Sparkles,
  Terminal,
  Boxes,
  Layers,
  Users,
  BookOpen,
  ArrowUpRight,
} from "lucide-react";

import HaloNav from "@/components/halo/HaloNav";
import HaloFooter from "@/components/halo/HaloFooter";

import Section from "@/components/vibrant/Section";
import SectionHead from "@/components/vibrant/SectionHead";
import StatRow from "@/components/vibrant/StatRow";
import { CaseStudyCardDark } from "@/components/vibrant/Cards";
import { DeviceCluster } from "@/components/vibrant/Mockups";
import { LimeButton, GhostButton, GitHubIcon } from "@/components/vibrant/buttons";
import { ACCENTS, type Accent } from "@/components/vibrant/accents";

import { SITE, DOCS, QUICKSTART, type DocLink } from "@/data/site";
import { FRAMEWORK_COUNT, TOTAL_CONTROLS } from "@/data/frameworks";

export const metadata: Metadata = {
  title: "Docs — Blackfyre",
  description:
    "Documentation hub for Blackfyre, the open-source multi-cloud compliance platform: local setup, self-hosting, architecture decisions, ADRs, and project policies — all linking straight into the public repository.",
};

const REPO_DOCS_URL = `${SITE.repoUrl}/tree/main/docs`;
const LOCAL_DEV_URL =
  DOCS.find((d) => d.title.toLowerCase().includes("local development"))?.url ??
  SITE.repoUrl;

/* ── Bucket the single source of truth (DOCS) into reading-order groups. ────
   The first three predicates carve out their sets; PROJECT is the catch-all,
   so every one of the 22 links lands in exactly one group and none are dropped. */
const START = DOCS.filter((d) =>
  /local development|self-hosting|configuration/i.test(d.title),
);
const DEVELOPER = DOCS.filter((d) =>
  /monorepo|api overview|migration|testing|deployment|llm provider/i.test(d.title),
);
const ARCHITECTURE = DOCS.filter((d) => /^architecture|adr-/i.test(d.title));
const PLACED = new Set([...START, ...DEVELOPER, ...ARCHITECTURE].map((d) => d.url));
const PROJECT = DOCS.filter((d) => !PLACED.has(d.url));

/* ── Light doc card — title + blurb + external ↗, accent-tinted number/arrow ── */
function DocCard({ doc, n, accent }: { doc: DocLink; n: number; accent: Accent }) {
  const a = ACCENTS[accent];
  return (
    <a
      href={doc.url}
      target="_blank"
      rel="noreferrer"
      className="group flex flex-col rounded-2xl border border-zinc-200/80 bg-white p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
    >
      <div className="flex items-start justify-between gap-3">
        <span className={`font-mono text-[10px] font-bold uppercase tracking-wider ${a.textLight}`}>
          {String(n).padStart(2, "0")}
        </span>
        <ArrowUpRight
          aria-hidden
          className={`h-4 w-4 flex-shrink-0 ${a.textLight} opacity-40 transition-opacity duration-300 group-hover:opacity-100`}
        />
      </div>
      <h3 className="mt-3 text-base font-bold leading-snug tracking-tight text-zinc-900">
        {doc.title}
      </h3>
      {doc.blurb && (
        <p className="mt-2 flex-1 text-xs leading-relaxed text-zinc-500">{doc.blurb}</p>
      )}
    </a>
  );
}

/* ── mono file-tree illustration for the closing dark repo callout ─────────── */
const TreeRow = ({ path, tag, c }: { path: string; tag: string; c: string }) => (
  <div className="flex items-center justify-between font-mono text-[9px]">
    <span className="text-zinc-500">{path}</span>
    <span className={c}>{tag}</span>
  </div>
);
const DocsTreeIll = () => (
  <div className="w-full space-y-1.5 px-4">
    <TreeRow path="docs/developer/*" tag="6 guides" c="text-lime-300" />
    <TreeRow path="docs/adr/000{1-4}" tag="4 ADRs" c="text-lime-300" />
    <TreeRow path="docs/ARCHITECTURE.md" tag="topology" c="text-zinc-400" />
    <TreeRow path="SECURITY · LICENSE" tag="policies" c="text-zinc-400" />
  </div>
);

export default function DocsPage() {
  return (
    <>
      <HaloNav />

      {/* ── HERO · light · blue ─────────────────────────────────────────── */}
      <Section variant="light">
        <div className="grid gap-16 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <SectionHead
              size="hero"
              accent="blue"
              on="light"
              eyebrow="Docs · Apache-2.0"
              eyebrowIcon={<Sparkles className="h-3.5 w-3.5" />}
              title={<>Everything you need to</>}
              accentWord="run Blackfyre."
              sub={
                <>
                  Blackfyre is open source and free to self-host forever. Every guide here links
                  straight into the repository — from a{" "}
                  <strong className="font-semibold text-zinc-900">~15-minute local stack</strong>{" "}
                  to production on your own AWS, plus the architecture decisions and policies behind
                  it. Nothing is behind a login.
                </>
              }
            />
            <div className="mt-8 flex flex-wrap gap-3">
              <LimeButton href={SITE.repoUrl} external icon={<GitHubIcon />}>
                Star on GitHub
              </LimeButton>
              <GhostButton href={REPO_DOCS_URL} external icon={<ArrowUpRight className="h-4 w-4" />}>
                Browse /docs
              </GhostButton>
            </div>

            <StatRow
              className="mt-10"
              kicker="What's documented"
              stats={[
                { value: String(DOCS.length), label: "Guides" },
                { value: "4", label: "ADRs" },
                { value: "2", label: "Deploy tiers", color: "text-blue-600" },
                { value: "Free", label: "Apache-2.0" },
              ]}
            />

            <div className="mt-8 flex flex-wrap gap-1.5">
              {[
                `${DOCS.length} guides`,
                "Local + production",
                `${FRAMEWORK_COUNT} frameworks · ${TOTAL_CONTROLS} controls`,
                "Self-host free",
              ].map((chip) => (
                <span
                  key={chip}
                  className="rounded-md border border-zinc-200 bg-zinc-50 px-2.5 py-1 font-mono text-[10.5px] uppercase tracking-[0.1em] text-zinc-500"
                >
                  {chip}
                </span>
              ))}
            </div>
          </div>

          <div className="hidden lg:block">
            <DeviceCluster />
          </div>
        </div>
      </Section>

      {/* ── GET STARTED · warm · amber ──────────────────────────────────── */}
      <Section variant="warm">
        <SectionHead
          accent="amber"
          on="light"
          eyebrow="Get started"
          eyebrowIcon={<Terminal className="h-3.5 w-3.5" />}
          title="Clone it and have it"
          accentWord="running."
          accentStyle="solid"
          sub="Stand up the full stack locally with no cloud account or API keys, then graduate to production on your own AWS when you're ready."
        />
        <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {START.map((d, i) => (
            <DocCard key={d.url} doc={d} n={i + 1} accent="amber" />
          ))}
        </div>

        {/* dark terminal quickstart card — a touch of contrast on the warm band */}
        <div className="mt-10 overflow-hidden rounded-2xl border border-zinc-800 bg-[#09090e]">
          <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-3">
            <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-lime-300">
              Quickstart · local stack
            </span>
            <span className="font-mono text-[10.5px] text-zinc-500">
              no cloud account · no API keys
            </span>
          </div>
          <pre className="overflow-x-auto px-5 py-5 font-mono text-[12px] leading-[1.65] text-zinc-400">
            <code>{QUICKSTART}</code>
          </pre>
        </div>
        <p className="mt-3 font-mono text-[11px] text-zinc-500">
          Full walkthrough, troubleshooting, and reset flow →{" "}
          <a href={LOCAL_DEV_URL} target="_blank" rel="noreferrer" className="text-amber-700">
            Local development guide ↗
          </a>
        </p>
      </Section>

      {/* ── DEVELOPER · light · purple ──────────────────────────────────── */}
      <Section variant="light">
        <SectionHead
          accent="purple"
          on="light"
          eyebrow="Developer"
          eyebrowIcon={<Boxes className="h-3.5 w-3.5" />}
          title="Work inside the"
          accentWord="monorepo."
          sub="How the packages fit together, how the Fastify API is composed, how migrations and tests run, how code ships, and where the AI provider routing lives."
        />
        <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {DEVELOPER.map((d, i) => (
            <DocCard key={d.url} doc={d} n={i + 1} accent="purple" />
          ))}
        </div>
      </Section>

      {/* ── ARCHITECTURE & DECISIONS · warm · amber ─────────────────────── */}
      <Section variant="warm">
        <SectionHead
          accent="amber"
          on="light"
          eyebrow="Architecture & decisions"
          eyebrowIcon={<Layers className="h-3.5 w-3.5" />}
          title="The shape, and"
          accentWord="why it's shaped that way."
          accentStyle="solid"
          sub="The deployment topology plus the four architecture decision records — tenant isolation, the queue design, scanner orchestration, and AI model routing — written down and defensible."
        />
        <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ARCHITECTURE.map((d, i) => (
            <DocCard key={d.url} doc={d} n={i + 1} accent="amber" />
          ))}
        </div>
      </Section>

      {/* ── PROJECT & POLICIES · light · pink ───────────────────────────── */}
      <Section variant="light">
        <SectionHead
          accent="pink"
          on="light"
          eyebrow="Project & policies"
          eyebrowIcon={<Users className="h-3.5 w-3.5" />}
          title="How the project is"
          accentWord="run."
          sub="Roadmap, how to contribute, governance, the security and data-collection policies, the code of conduct, trademark terms, and the license — the social contract of the repo."
        />
        <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PROJECT.map((d, i) => (
            <DocCard key={d.url} doc={d} n={i + 1} accent="pink" />
          ))}
        </div>
      </Section>

      {/* ── CLOSING CALLOUT + CTA · dark · lime ─────────────────────────── */}
      <Section variant="dark" orbs={false}>
        <div className="grid gap-16 lg:grid-cols-[1fr_0.85fr] lg:items-center">
          <div>
            <SectionHead
              accent="lime"
              on="dark"
              eyebrow="Start"
              eyebrowIcon={<BookOpen className="h-3.5 w-3.5" />}
              title="Read the code,"
              accentWord="not the marketing."
              sub="Every card on this page opens a file in the source tree. The complete, always-current docs live in the repository — versioned alongside the code they describe, never stale. Clone it, audit it, self-host it for free."
            />
            <div className="mt-8 flex flex-wrap gap-3">
              <LimeButton href={SITE.repoUrl} external icon={<GitHubIcon />}>
                Star on GitHub
              </LimeButton>
              <GhostButton
                href={REPO_DOCS_URL}
                external
                on="dark"
                icon={<ArrowUpRight className="h-4 w-4" />}
              >
                Browse /docs
              </GhostButton>
            </div>
          </div>

          <CaseStudyCardDark
            badge="REPOSITORY"
            icon={BookOpen}
            title="It all lives in /docs"
            desc="Guides, ADRs, and policies sit next to the code in a public, Apache-2.0 tree — the source of truth this page mirrors."
            accent="lime"
            illustration={<DocsTreeIll />}
            linkLabel="Browse /docs"
            linkHref={REPO_DOCS_URL}
          />
        </div>
      </Section>

      <HaloFooter />
    </>
  );
}
