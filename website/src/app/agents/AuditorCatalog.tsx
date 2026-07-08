"use client";

import { useMemo, useState } from "react";
import {
  Sparkles,
  Search,
  Layers,
  Workflow,
  CheckCircle2,
  FileCheck2,
  ShieldCheck,
} from "lucide-react";

import HaloNav from "@/components/halo/HaloNav";
import HaloFooter from "@/components/halo/HaloFooter";

import Section from "@/components/vibrant/Section";
import SectionHead from "@/components/vibrant/SectionHead";
import StatRow from "@/components/vibrant/StatRow";
import { LimeButton, GhostButton, GitHubIcon } from "@/components/vibrant/buttons";

import {
  AUDITORS,
  AUDITOR_CLOUDS,
  AUDITOR_CATEGORIES,
  AUDITOR_COUNT,
  SCANNER_TYPES,
  type AuditorCloud,
  type AuditorCategory,
} from "@/data/auditors";
import { FRAMEWORK_COUNT, TOTAL_CONTROLS } from "@/data/frameworks";
import { SITE } from "@/data/site";

type CloudFilter = "all" | AuditorCloud;
type CategoryFilter = "all" | AuditorCategory;

const CLOUD_TABS: readonly CloudFilter[] = ["all", ...AUDITOR_CLOUDS];
const CATEGORY_TABS: readonly CategoryFilter[] = ["all", ...AUDITOR_CATEGORIES];

// Short human labels for the cloud codes — the on-prem/other bucket spans
// Active Directory, SNMP, IdP, EDR, network and SaaS auditors.
const CLOUD_LABEL: Record<AuditorCloud, string> = {
  aws: "AWS",
  azure: "Azure",
  gcp: "GCP",
  container: "Containers",
  iac: "IaC / SAST",
  multi: "Multi-cloud",
  other: "On-prem / Other",
};

// A distinct dot colour per cloud bucket — literal classes so Tailwind keeps them.
const CLOUD_DOT: Record<AuditorCloud, string> = {
  aws: "bg-amber-500",
  azure: "bg-blue-500",
  gcp: "bg-emerald-500",
  container: "bg-purple-500",
  iac: "bg-pink-500",
  multi: "bg-lime-500",
  other: "bg-zinc-400",
};

// Live per-cloud counts (static — AUDITORS is a constant).
const CLOUD_COUNTS = AUDITOR_CLOUDS.map((c) => ({
  cloud: c,
  n: AUDITORS.filter((a) => a.cloud === c).length,
}));

function tabClass(active: boolean) {
  return `rounded-md border px-3 py-1.5 font-mono text-[10.5px] uppercase tracking-[0.08em] transition-all ${
    active
      ? "border-zinc-900 bg-zinc-900 text-white"
      : "border-zinc-200 bg-white text-zinc-500 hover:border-zinc-400 hover:text-zinc-800"
  }`;
}

export default function AuditorCatalog() {
  const [query, setQuery] = useState("");
  const [cloud, setCloud] = useState<CloudFilter>("all");
  const [category, setCategory] = useState<CategoryFilter>("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return AUDITORS.filter((a) => {
      if (cloud !== "all" && a.cloud !== cloud) return false;
      if (category !== "all" && a.category !== category) return false;
      if (q !== "") {
        const hay = `${a.name} ${a.description ?? ""} ${a.cloud} ${a.category}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [query, cloud, category]);

  const filtersActive = query.trim() !== "" || cloud !== "all" || category !== "all";

  const clearFilters = () => {
    setQuery("");
    setCloud("all");
    setCategory("all");
  };

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
              eyebrow="Auditor index"
              eyebrowIcon={<Sparkles className="h-3.5 w-3.5" />}
              title={<>{AUDITOR_COUNT} auditors.</>}
              accentWord="Every layer."
              sub={
                <>
                  Real SDK-backed checks across AWS, Azure, GCP and on-prem —
                  Active Directory, SNMP network devices, your IdP, EDR/MDM,
                  Kubernetes, container registries, VCS and SaaS — plus Prowler
                  and the Checkov / Semgrep / Bandit IaC-and-SAST scanners. Every
                  finding maps to{" "}
                  <strong className="font-semibold text-zinc-900">
                    {TOTAL_CONTROLS} controls
                  </strong>{" "}
                  across {FRAMEWORK_COUNT} frameworks.
                </>
              }
            />

            <div className="mt-8 flex flex-wrap gap-3">
              <LimeButton href={SITE.repoUrl} external icon={<GitHubIcon />}>
                View source
              </LimeButton>
              <GhostButton href="#catalog">Browse the catalog</GhostButton>
            </div>

            <StatRow
              className="mt-10"
              kicker="Coverage in the box"
              stats={[
                { value: String(AUDITOR_COUNT), label: "Auditors", color: "text-blue-600" },
                { value: String(FRAMEWORK_COUNT), label: "Frameworks" },
                { value: String(TOTAL_CONTROLS), label: "Controls" },
                { value: "3", label: "Clouds + on-prem" },
              ]}
            />
          </div>

          {/* Right — mono coverage panel (hidden below lg) */}
          <div className="hidden lg:block">
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-7 shadow-sm">
              <p className="font-mono text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                Auditors by cloud
              </p>
              <ul className="mt-5 space-y-3">
                {CLOUD_COUNTS.map(({ cloud: c, n }) => (
                  <li key={c} className="flex items-center justify-between font-mono text-xs">
                    <span className="flex items-center gap-2.5 text-zinc-600">
                      <span className={`h-2 w-2 rounded-full ${CLOUD_DOT[c]}`} aria-hidden />
                      {CLOUD_LABEL[c]}
                    </span>
                    <span className="tabular-nums font-semibold text-zinc-900">{n}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-6 flex items-center justify-between border-t border-zinc-200 pt-5 font-mono text-xs">
                <span className="text-zinc-500">Total</span>
                <span className="text-lg font-extrabold text-blue-600">{AUDITOR_COUNT}</span>
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* ── CATALOG · warm · amber ──────────────────────────────────────── */}
      <Section variant="warm" id="catalog">
        <SectionHead
          accent="amber"
          on="light"
          eyebrow="Catalog"
          eyebrowIcon={<Layers className="h-3.5 w-3.5" />}
          title="Search every"
          accentWord="auditor."
          accentStyle="solid"
          sub={
            <>
              Filter by cloud, narrow by resource category, or search a keyword
              like &ldquo;encryption&rdquo;, &ldquo;RLS&rdquo; or
              &ldquo;Kubernetes&rdquo;. Every card&rsquo;s tags are clickable.
            </>
          }
        />

        {/* Controls */}
        <div className="mt-10 flex flex-col gap-6 border-b border-zinc-200 pb-8">
          {/* Keyword search */}
          <div className="relative flex max-w-sm items-center rounded-lg border border-zinc-300 bg-white px-3 py-2 font-mono text-xs transition-colors focus-within:border-zinc-900">
            <Search className="mr-2 h-3.5 w-3.5 text-zinc-400" aria-hidden />
            <input
              type="text"
              aria-label="Search auditors"
              placeholder="Search auditors..."
              className="w-full border-none bg-transparent text-zinc-900 outline-none placeholder:text-zinc-400"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          {/* Cloud filter tabs */}
          <div>
            <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400">
              Cloud
            </p>
            <div className="flex flex-wrap gap-1.5">
              {CLOUD_TABS.map((c) => (
                <button key={c} onClick={() => setCloud(c)} className={tabClass(cloud === c)}>
                  {c === "all" ? "All" : CLOUD_LABEL[c]}
                </button>
              ))}
            </div>
          </div>

          {/* Category filter tabs */}
          <div>
            <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400">
              Category
            </p>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORY_TABS.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={tabClass(category === cat)}
                >
                  {cat === "all" ? "All" : cat}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Count readout */}
        <div className="mt-8 flex items-center justify-between">
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-zinc-500">
            Showing <span className="font-semibold text-zinc-900">{filtered.length}</span> of{" "}
            {AUDITOR_COUNT}
          </p>
          {filtersActive && (
            <button
              onClick={clearFilters}
              className="font-mono text-[11px] uppercase tracking-[0.12em] text-amber-700 transition-colors hover:text-zinc-900"
            >
              Clear filters ✕
            </button>
          )}
        </div>

        {/* Grid / empty state */}
        {filtered.length === 0 ? (
          <div className="mx-auto mt-10 max-w-[600px] rounded-2xl border-2 border-dashed border-zinc-300 bg-white p-12 text-center">
            <span className="mb-4 block font-mono text-3xl text-amber-600" aria-hidden>
              ⚠
            </span>
            <h3 className="font-display text-lg font-semibold text-zinc-900">
              No matching auditors
            </h3>
            <p className="mt-2 text-sm text-zinc-600">
              Nothing matches these filters
              {query.trim() !== "" ? (
                <>
                  {" "}
                  for &ldquo;<span className="text-zinc-900">{query.trim()}</span>&rdquo;
                </>
              ) : null}
              . Try a broader cloud or category.
            </p>
            <button
              onClick={clearFilters}
              className="mt-6 rounded-md border border-zinc-300 bg-white px-4 py-2 font-mono text-xs uppercase tracking-wider text-zinc-700 transition-all hover:border-zinc-900 hover:text-zinc-900"
            >
              Reset
            </button>
          </div>
        ) : (
          <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((a) => (
              <article
                key={a.name}
                className="group flex flex-col rounded-2xl border border-zinc-200 bg-white p-6 transition-all duration-300 hover:-translate-y-1 hover:border-zinc-300 hover:shadow-lg"
              >
                <div className="mb-4 flex flex-wrap items-center gap-1.5">
                  <button
                    onClick={() => setCloud(a.cloud)}
                    className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] transition-colors ${
                      cloud === a.cloud
                        ? "border-zinc-900 bg-zinc-900 text-white"
                        : "border-zinc-200 bg-zinc-50 text-zinc-600 hover:border-zinc-400 hover:text-zinc-900"
                    }`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${CLOUD_DOT[a.cloud]}`} aria-hidden />
                    {CLOUD_LABEL[a.cloud]}
                  </button>
                  <button
                    onClick={() => setCategory(a.category)}
                    className={`rounded-md border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] transition-colors ${
                      category === a.category
                        ? "border-amber-600 bg-amber-50 text-amber-800"
                        : "border-zinc-200 bg-zinc-50 text-zinc-600 hover:border-amber-500 hover:text-amber-700"
                    }`}
                  >
                    {a.category}
                  </button>
                </div>

                <h3 className="font-sans text-lg font-semibold tracking-tight text-zinc-900 transition-colors group-hover:text-blue-600">
                  {a.name}
                </h3>
                {a.description && (
                  <p className="mt-3 font-sans text-[13.5px] leading-[1.55] text-zinc-600">
                    {a.description}
                  </p>
                )}
              </article>
            ))}
          </div>
        )}
      </Section>

      {/* ── UNDER THE HOOD · dark · purple ──────────────────────────────── */}
      <Section variant="dark">
        <div className="grid gap-16 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div className="lg:sticky lg:top-12">
            <SectionHead
              accent="purple"
              on="dark"
              eyebrow="Under the hood"
              eyebrowIcon={<Workflow className="h-3.5 w-3.5" />}
              title="Two execution paths,"
              accentWord="one findings pipeline."
              sub="Lightweight SDK auditors run in-process inside the scan worker. Heavy OSS tools — Prowler and the Checkov / Semgrep / Bandit IaC and SAST scanners — run as container-image Lambdas. Both normalize through a single ingest path (ADR-0003)."
            />
            <div className="mt-8 flex items-start gap-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
              <ShieldCheck className="mt-0.5 h-5 w-5 flex-shrink-0 text-purple-400" aria-hidden />
              <p className="text-xs leading-relaxed text-zinc-400">
                Scanning uses a read-only, least-privilege cross-account IAM role —
                no write keys. Scanners collect the minimum posture data needed and
                never touch PII, customer records or business content.
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-7 sm:p-9">
            <p className="font-mono text-[11px] font-semibold uppercase tracking-wider text-purple-400">
              {SCANNER_TYPES.length} scanner families
            </p>
            <ul className="mt-6 grid grid-cols-1 gap-x-8 gap-y-3.5 sm:grid-cols-2">
              {SCANNER_TYPES.map((s) => (
                <li key={s} className="flex items-start font-mono text-[12.5px] leading-[1.5] text-zinc-300">
                  <CheckCircle2 className="mr-2.5 mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-purple-400" aria-hidden />
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      {/* ── GET STARTED · dark · lime ───────────────────────────────────── */}
      <Section variant="dark" orbs={false}>
        <div className="flex flex-col items-start gap-10 lg:flex-row lg:items-center lg:justify-between">
          <SectionHead
            accent="lime"
            on="dark"
            eyebrow="Get started"
            eyebrowIcon={<FileCheck2 className="h-3.5 w-3.5" />}
            title="Read the source."
            accentWord="Run it yourself."
            sub="Every auditor above is real code in the open-source repo. Clone the full stack locally — no cloud account or API keys required."
          />
          <div className="flex flex-shrink-0 flex-wrap gap-3">
            <LimeButton href={SITE.repoUrl} external icon={<GitHubIcon />}>
              Star on GitHub
            </LimeButton>
            <GhostButton href={SITE.hostedUrl} external on="dark">
              See it hosted
            </GhostButton>
          </div>
        </div>
      </Section>

      <HaloFooter />
    </>
  );
}
