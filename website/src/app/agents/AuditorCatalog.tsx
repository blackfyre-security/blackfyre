"use client";

import { useMemo, useState } from "react";
import HaloNav from "@/components/halo/HaloNav";
import HaloFooter from "@/components/halo/HaloFooter";
import HaloCTA from "@/components/halo/HaloCTA";
import HaloReveal from "@/components/halo/HaloReveal";
import HaloSectionHead from "@/components/halo/HaloSectionHead";
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

      {/* ── Hero ────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-border px-6 pb-20 pt-28 sm:px-12 sm:pt-32">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 1000px 460px at 78% 12%, rgba(var(--accent-rgb, 198 242 78), 0.06), transparent 60%)",
          }}
        />
        <div className="relative mx-auto max-w-[1280px]">
          <p className="halo-eyebrow">§ 01 · Auditor Index</p>
          <h1 className="mt-6 max-w-[820px] font-display font-medium leading-[0.98] tracking-tightest text-text text-[clamp(44px,6.4vw,78px)]">
            {AUDITOR_COUNT} auditors.{" "}
            <span className="text-accent italic font-normal">Every layer.</span>
          </h1>
          <p className="mt-7 max-w-[620px] font-sans text-lg leading-[1.55] text-text-muted">
            Real SDK-backed checks across AWS, Azure, GCP and on-prem — Active
            Directory, SNMP network devices, your IdP, EDR/MDM, Kubernetes,
            container registries, VCS and SaaS. Plus Prowler and the Checkov /
            Semgrep / Bandit IaC-and-SAST scanners. Every finding maps to{" "}
            {FRAMEWORK_COUNT} frameworks and {TOTAL_CONTROLS} controls.
          </p>

          {/* Stat strip */}
          <div className="mt-9 flex flex-wrap gap-x-8 gap-y-3 font-mono text-[11px] uppercase tracking-[0.14em] text-text-dim">
            <span>
              <span className="text-accent">{AUDITOR_COUNT}</span> auditors
            </span>
            <span className="halo-hairline hidden sm:inline" aria-hidden="true" />
            <span>
              <span className="text-accent">{FRAMEWORK_COUNT}</span> frameworks
            </span>
            <span className="halo-hairline hidden sm:inline" aria-hidden="true" />
            <span>
              <span className="text-accent">{TOTAL_CONTROLS}</span> controls
            </span>
            <span className="halo-hairline hidden sm:inline" aria-hidden="true" />
            <span>
              <span className="text-accent">3</span> clouds + on-prem
            </span>
          </div>

          <div className="mt-9 flex flex-wrap items-center gap-3">
            <a
              href={SITE.repoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="halo-btn-accent"
            >
              View source{" "}
              <span className="halo-arrow" aria-hidden="true">
                &rarr;
              </span>
            </a>
            <a
              href="#catalog"
              className="halo-btn-ghost inline-flex items-center gap-2"
            >
              Browse the catalog{" "}
              <span className="text-accent" aria-hidden="true">
                &darr;
              </span>
            </a>
          </div>
        </div>
      </section>

      {/* ── Searchable catalog ──────────────────────────────────── */}
      <section id="catalog" className="px-6 py-24 sm:px-12">
        <div className="mx-auto max-w-[1280px]">
          <div className="flex flex-col gap-6 border-b border-border pb-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="halo-eyebrow">§ 02 · Catalog</p>
                <h2 className="mt-4 font-display text-3xl font-medium tracking-tight text-text">
                  Search every auditor.
                </h2>
                <p className="mt-2 max-w-[520px] text-sm text-text-muted">
                  Filter by cloud, narrow by resource category, or search a
                  keyword like &ldquo;encryption&rdquo;, &ldquo;RLS&rdquo; or
                  &ldquo;Kubernetes&rdquo;. Every card&rsquo;s tags are
                  clickable.
                </p>
              </div>

              {/* Keyword search */}
              <div className="relative flex max-w-xs items-center rounded-lg border border-border bg-surface px-3 py-1.5 font-mono text-xs transition-colors focus-within:border-accent">
                <span className="mr-2 text-text-muted" aria-hidden="true">
                  🔎
                </span>
                <input
                  type="text"
                  aria-label="Search auditors"
                  placeholder="Search auditors..."
                  className="w-full border-none bg-transparent text-text outline-none placeholder:text-text-dim"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
            </div>

            {/* Cloud filter tabs */}
            <div>
              <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-text-dim">
                Cloud
              </p>
              <div className="flex flex-wrap gap-1.5">
                {CLOUD_TABS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setCloud(c)}
                    className={`rounded-md border px-3 py-1.5 font-mono text-[10.5px] uppercase tracking-[0.08em] transition-all ${
                      cloud === c
                        ? "border-border-strong bg-surface-alt text-accent"
                        : "border-border bg-surface text-text-dim hover:text-text-muted"
                    }`}
                  >
                    {c === "all" ? "All" : CLOUD_LABEL[c]}
                  </button>
                ))}
              </div>
            </div>

            {/* Category filter tabs */}
            <div>
              <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-text-dim">
                Category
              </p>
              <div className="flex flex-wrap gap-1.5">
                {CATEGORY_TABS.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setCategory(cat)}
                    className={`rounded-md border px-3 py-1.5 font-mono text-[10.5px] uppercase tracking-[0.08em] transition-all ${
                      category === cat
                        ? "border-border-strong bg-surface-alt text-accent"
                        : "border-border bg-surface text-text-dim hover:text-text-muted"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Count readout */}
          <div className="mt-8 flex items-center justify-between">
            <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-text-dim">
              Showing{" "}
              <span className="text-text">{filtered.length}</span> of{" "}
              {AUDITOR_COUNT}
            </p>
            {filtersActive && (
              <button
                onClick={clearFilters}
                className="font-mono text-[11px] uppercase tracking-[0.12em] text-accent transition-colors hover:text-text"
              >
                Clear filters ✕
              </button>
            )}
          </div>

          {/* Grid / empty state */}
          {filtered.length === 0 ? (
            <div className="mx-auto mt-10 max-w-[600px] rounded-xl border-2 border-dashed border-border p-12 text-center">
              <span className="mb-4 block font-mono text-3xl text-warn">⚠</span>
              <h3 className="font-display text-lg font-medium text-text">
                No matching auditors
              </h3>
              <p className="mt-2 text-sm text-text-muted">
                Nothing matches these filters
                {query.trim() !== "" ? (
                  <>
                    {" "}
                    for &ldquo;
                    <span className="text-text">{query.trim()}</span>&rdquo;
                  </>
                ) : null}
                . Try a broader cloud or category.
              </p>
              <button
                onClick={clearFilters}
                className="mt-6 rounded-md border border-accent/20 bg-accent/5 px-4 py-2 font-mono text-xs uppercase tracking-wider text-accent transition-all hover:bg-accent/15"
              >
                Reset
              </button>
            </div>
          ) : (
            <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
              {filtered.map((a) => (
                <article
                  key={a.name}
                  className="halo-card group flex flex-col p-6 shadow-md transition-all duration-300 hover:-translate-y-1 hover:border-border-strong hover:shadow-xl"
                >
                  <div className="mb-4 flex flex-wrap items-center gap-1.5">
                    <button
                      onClick={() => setCloud(a.cloud)}
                      className={`rounded-md border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] transition-colors ${
                        cloud === a.cloud
                          ? "border-accent bg-accent/10 text-accent"
                          : "border-border bg-surface-alt text-text-muted hover:border-accent hover:text-accent"
                      }`}
                    >
                      {CLOUD_LABEL[a.cloud]}
                    </button>
                    <button
                      onClick={() => setCategory(a.category)}
                      className={`rounded-md border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] transition-colors ${
                        category === a.category
                          ? "border-accent bg-accent/10 text-accent"
                          : "border-border bg-surface-alt text-text-muted hover:border-accent hover:text-accent"
                      }`}
                    >
                      {a.category}
                    </button>
                  </div>

                  <h3 className="font-sans text-lg font-medium tracking-tight text-text transition-colors group-hover:text-accent">
                    {a.name}
                  </h3>
                  {a.description && (
                    <p className="mt-3 font-sans text-[13.5px] leading-[1.55] text-text-muted">
                      {a.description}
                    </p>
                  )}
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── Scanner types note ──────────────────────────────────── */}
      <HaloReveal as="section" delay={0} className="border-t border-border px-6 py-24 sm:px-12">
        <HaloSectionHead
          eyebrow="§ 03 · Under the hood"
          title="Two execution paths, one findings pipeline."
          titleAccent="one findings pipeline"
          blurb="Lightweight SDK auditors run in-process inside the scan worker. Heavy OSS tools — Prowler and the Checkov / Semgrep / Bandit IaC and SAST scanners — run as container-image Lambdas. Both normalize through a single ingest path (ADR-0003)."
        />

        <div className="mx-auto mt-12 max-w-[1000px]">
          <div className="halo-card p-7 sm:p-9">
            <p className="halo-eyebrow">§ Scanner families</p>
            <ul className="mt-6 grid grid-cols-1 gap-x-8 gap-y-3.5 sm:grid-cols-2">
              {SCANNER_TYPES.map((s) => (
                <li
                  key={s}
                  className="flex items-start font-sans text-[13.5px] leading-[1.5] text-text-muted"
                >
                  <span
                    className="mr-2.5 select-none font-mono text-accent"
                    aria-hidden="true"
                  >
                    ✓
                  </span>
                  <span>{s}</span>
                </li>
              ))}
            </ul>
            <p className="mt-8 border-t border-border pt-6 font-sans text-[13px] leading-[1.55] text-text-dim">
              Scanning uses a read-only, least-privilege cross-account IAM role —
              no write keys. Scanners collect the minimum posture data needed and
              never touch PII, customer records or business content.
            </p>
          </div>
        </div>
      </HaloReveal>

      <HaloCTA
        title="Read the source. Run it yourself."
        titleAccent="Run it yourself"
        sub="Every auditor above is real code in the open-source repo. Clone the full stack locally — no cloud account or API keys required."
        primaryLabel="View source"
        primaryHref={SITE.repoUrl}
        secondaryLabel="See it hosted"
        secondaryHref={SITE.hostedUrl}
      />

      <HaloFooter />
    </>
  );
}
