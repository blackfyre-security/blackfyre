import type { Metadata } from "next";
import Link from "next/link";
import HaloNav from "@/components/halo/HaloNav";
import HaloFooter from "@/components/halo/HaloFooter";
import HaloSectionHead from "@/components/halo/HaloSectionHead";
import HaloCTA from "@/components/halo/HaloCTA";
import HaloReveal from "@/components/halo/HaloReveal";
import HaloStatusDot from "@/components/halo/HaloStatusDot";
import { platformFeatures, platformTiers, tierComparison } from "@/data/content";

export const metadata: Metadata = {
  title: "Platform — Autonomous Compliance Infrastructure | BLACKFYRE",
  description:
    "Continuous posture mapping, agent-driven framework testing, and tamper-evident evidence across your cloud. Multi-tenant, RLS-isolated, WORM-stored.",
};

interface SpecRow {
  k: string;
  v: string;
}

const PLATFORM_SPECS: readonly SpecRow[] = [
  { k: "Frameworks", v: "9" },
  { k: "Agents", v: "34" },
  { k: "Scan cadence", v: "Continuous" },
  { k: "Evidence", v: "WORM storage" },
  { k: "Tenancy", v: "RLS-isolated" },
];

export default function PlatformPage() {
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
              "radial-gradient(ellipse 900px 400px at 20% 10%, rgba(var(--accent-rgb, 198 242 78), 0.09), transparent 60%)",
          }}
        />
        <div className="relative mx-auto grid max-w-[1280px] grid-cols-1 items-center gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:gap-[72px]">
          <div>
            <p className="halo-eyebrow">§ 00 · Platform</p>
            <h1 className="mt-6 font-display font-medium leading-[0.98] tracking-tightest text-text text-[clamp(48px,7vw,80px)]">
              The compliance
              <br />
              <span className="text-text-muted">infrastructure </span>
              <span className="italic font-normal text-accent">layer.</span>
            </h1>
            <p className="mt-7 max-w-[520px] font-sans text-lg leading-[1.55] text-text-muted">
              Continuous posture mapping, agent-driven framework testing, and
              tamper-evident evidence across your cloud. Multi-tenant,
              RLS-isolated, WORM-stored.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link href="/contact" className="halo-btn-accent">
                See it live <span className="halo-arrow" aria-hidden="true">&rarr;</span>
              </Link>
              <Link href="/blog" className="halo-btn-ghost">
                Read the architecture
              </Link>
            </div>
          </div>

          {/* Spec card */}
          <aside className="halo-card p-7">
            <p className="halo-eyebrow">§ Specs</p>
            <dl className="mt-4">
              {PLATFORM_SPECS.map((s, i) => (
                <div
                  key={s.k}
                  className={`flex items-baseline justify-between py-3.5 ${
                    i < PLATFORM_SPECS.length - 1 ? "border-b border-border" : ""
                  }`}
                >
                  <dt className="font-mono text-[11.5px] uppercase tracking-[0.08em] text-text-muted">
                    {s.k}
                  </dt>
                  <dd className="m-0 font-sans text-[15px] font-medium text-text">
                    {s.v}
                  </dd>
                </div>
              ))}
            </dl>
          </aside>
        </div>
      </section>

      {/* ── Capabilities ────────────────────────────────────────── */}
      <HaloReveal as="section" className="border-b border-border px-6 py-24 sm:px-12">
        <HaloSectionHead
          eyebrow="§ 01 · Capabilities"
          title="Everything an audit wants. Nothing a team hates."
          blurb="Six capability clusters, each built to the standards an external auditor would demand of you."
        />
        <div className="mx-auto mt-12 grid max-w-[1280px] grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {platformFeatures.map((f) => (
            <article
              key={f.title}
              className="halo-card relative overflow-hidden p-6 transition-colors hover:border-border-strong"
            >
              <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-accent">
                {f.icon}
              </div>
              <h3 className="mt-2.5 font-sans text-[22px] font-medium tracking-[-0.02em] text-text">
                {f.title}
              </h3>
              <p className="mt-2.5 font-sans text-sm leading-[1.55] text-text-muted">
                {f.description}
              </p>
            </article>
          ))}
        </div>
      </HaloReveal>

      {/* ── Tiers ──────────────────────────────────────────────── */}
      <HaloReveal as="section" delay={120} className="border-b border-border px-6 py-24 sm:px-12">
        <HaloSectionHead
          eyebrow="§ 02 · Tiers"
          title="Three tiers. One posture runtime."
          blurb="Start with automated compliance, layer on multi-cloud scanning and AI remediation, or unlock continuous defence with threat intelligence."
        />
        <div className="mx-auto mt-12 grid max-w-[1280px] grid-cols-1 gap-4 lg:grid-cols-3">
          {platformTiers.map((tier) => (
            <div key={tier.name} className="group relative">
              {tier.badge && (
                <span className="pointer-events-none absolute -top-3 left-6 z-10 rounded-full bg-accent px-3 py-1 font-mono text-[10.5px] uppercase tracking-[0.16em] text-[color:var(--accent-ink)] shadow-halo-glow transition-all duration-300 ease-out group-hover:-translate-y-0.5 group-hover:rotate-[-1.5deg] group-hover:shadow-[0_8px_24px_-6px_var(--accent)]">
                  {tier.badge}
                </span>
              )}
              <article
                className={`halo-card halo-card-hover flex h-full flex-col p-7 ${
                  tier.badge ? "border-accent" : ""
                }`}
              >
              <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-accent">
                {tier.name}
              </div>
              <div className="mt-3 flex items-baseline gap-1.5">
                <span className="font-sans text-[36px] font-medium tracking-[-0.02em] text-text">
                  {tier.price}
                </span>
                <span className="font-mono text-xs text-text-muted">
                  {tier.period}
                </span>
              </div>
              <p className="mt-3 font-sans text-sm leading-[1.55] text-text-muted">
                {tier.description}
              </p>
              <ul className="mt-5 flex flex-col gap-2.5">
                {tier.features.map((ft) => (
                  <li
                    key={ft}
                    className="flex items-start gap-2.5 font-sans text-[13.5px] leading-[1.5] text-text"
                  >
                    <HaloStatusDot size="sm" steady className="mt-1.5 shrink-0" />
                    <span>{ft}</span>
                  </li>
                ))}
              </ul>
              </article>
            </div>
          ))}
        </div>
        <div className="mx-auto mt-14 max-w-[1280px]">
          <div className="halo-card flex flex-col items-start gap-6 p-7 sm:flex-row sm:items-center sm:justify-between sm:gap-10 sm:p-9">
            <div className="max-w-[640px]">
              <p className="halo-eyebrow">§ Custom needs</p>
              <h3 className="mt-3 font-display text-[clamp(22px,2.4vw,28px)] font-medium leading-[1.15] tracking-display text-text">
                Need a plan that fits your stack?
              </h3>
              <p className="mt-2 text-[14px] leading-relaxed text-text-muted">
                Volume pricing, on-prem deployments, custom integrations, dedicated support — sales can shape any of it around your timeline.
              </p>
            </div>
            <Link href="/contact" className="halo-btn-accent shrink-0">
              Contact sales <span className="halo-arrow" aria-hidden="true">&rarr;</span>
            </Link>
          </div>
        </div>
      </HaloReveal>

      {/* ── Tier comparison ────────────────────────────────────── */}
      <HaloReveal as="section" delay={240} className="border-b border-border px-6 py-24 sm:px-12">
        <HaloSectionHead
          eyebrow="§ 03 · Coverage"
          title="What each tier includes."
        />
        <div className="mx-auto mt-12 max-w-[1160px] overflow-hidden rounded-[12px] border border-border bg-surface">
          <div className="grid grid-cols-[1.4fr_1fr_1fr_1fr] border-b border-border px-6 py-4 font-mono text-[11px] uppercase tracking-[0.14em] text-text-dim">
            <span>Capability</span>
            <span>Comply</span>
            <span>Protect</span>
            <span className="text-accent">Defend</span>
          </div>
          {tierComparison.map((row, i) => (
            <div
              key={row.feature}
              className={`grid grid-cols-[1.4fr_1fr_1fr_1fr] items-center px-6 py-4 font-sans text-sm ${
                i < tierComparison.length - 1 ? "border-b border-border" : ""
              }`}
            >
              <span className="text-text">{row.feature}</span>
              <span className="font-mono text-xs text-text-muted">
                {row.comply === "—" ? "—" : row.comply}
              </span>
              <span className="font-mono text-xs text-text">
                {row.protect === "—" ? "—" : row.protect}
              </span>
              <span className="font-mono text-xs text-accent">
                {row.defend === "—" ? "—" : row.defend}
              </span>
            </div>
          ))}
        </div>
      </HaloReveal>

      {/* ── Vs. competitors ────────────────────────────────────── */}
      <HaloReveal as="section" delay={360} className="border-b border-border px-6 py-24 sm:px-12">
        <HaloSectionHead
          eyebrow="§ 04 · Vs."
          title="Where we sit."
          blurb="Most tools pick one side: either an auditor-friendly checklist or a live scanner. Blackfyre is both — continuous posture + evidence vault + remediation in one runtime."
        />
        <div className="mx-auto mt-12 max-w-[1160px] overflow-hidden rounded-[12px] border border-border bg-surface">
          <div className="grid grid-cols-[1.4fr_1fr_1fr_1fr] border-b border-border px-6 py-4 font-mono text-[11px] uppercase tracking-[0.14em] text-text-dim">
            <span>Capability</span>
            <span>Checklist tools</span>
            <span>Point scanners</span>
            <span className="text-accent">Blackfyre</span>
          </div>
          {(
            [
              ["Continuous scanning", "no", "yes", "yes"],
              ["Framework mapping", "yes", "no", "yes"],
              ["Evidence vault (WORM)", "no", "no", "yes"],
              ["AI remediation", "no", "no", "yes"],
              ["Multi-tenant isolation", "yes", "no", "yes"],
              ["Auditor-ready exports", "yes", "no", "yes"],
            ] as const
          ).map((row, i, arr) => (
            <div
              key={row[0]}
              className={`grid grid-cols-[1.4fr_1fr_1fr_1fr] items-center px-6 py-4 font-sans text-sm ${
                i < arr.length - 1 ? "border-b border-border" : ""
              }`}
            >
              <span className="text-text">{row[0]}</span>
              {row.slice(1).map((cell, j) => (
                <span
                  key={j}
                  className={`font-mono text-xs ${
                    cell === "yes"
                      ? j === 2
                        ? "text-accent"
                        : "text-text"
                      : "text-text-dim"
                  }`}
                >
                  {cell === "yes" ? "✓" : "—"}
                </span>
              ))}
            </div>
          ))}
        </div>
      </HaloReveal>

      <HaloCTA
        title="See it live."
        titleAccent="live"
        sub="Two-click connect. First findings inside ten minutes."
        primaryLabel="Talk to us"
        primaryHref="/contact"
        secondaryLabel="Book a call"
        secondaryHref="/contact"
      />

      <HaloFooter />
    </>
  );
}
