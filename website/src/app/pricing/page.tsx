import type { Metadata } from "next";
import Link from "next/link";
import HaloNav from "@/components/halo/HaloNav";
import HaloFooter from "@/components/halo/HaloFooter";
import HaloSectionHead from "@/components/halo/HaloSectionHead";
import HaloCTA from "@/components/halo/HaloCTA";
import HaloReveal from "@/components/halo/HaloReveal";
import { SITE } from "@/data/site";
import { AUDITOR_COUNT } from "@/data/auditors";
import { TOTAL_CONTROLS, FRAMEWORK_COUNT } from "@/data/frameworks";

export const metadata: Metadata = {
  title: "Pricing — Blackfyre",
  description:
    "Blackfyre is free to self-host forever under Apache-2.0 — all 55 auditors, 9 frameworks and 678 controls. A managed hosted option is in early access.",
};

const LICENSE_URL = `${SITE.repoUrl}/blob/main/LICENSE`;

interface TierCTA {
  label: string;
  href: string;
  external?: boolean;
}

interface Tier {
  name: string;
  badge?: string;
  price: string;
  period?: string;
  tagline: string;
  features: string[];
  note?: string;
  primary: TierCTA;
  secondary: TierCTA;
  featured?: boolean;
}

const TIERS: readonly Tier[] = [
  {
    name: "Self-host",
    badge: "Free forever",
    price: "$0",
    period: "/ forever",
    tagline:
      "Apache-2.0. Clone it, run it on your own infrastructure, keep every feature — no seats, no gates, no expiry.",
    features: [
      `All ${AUDITOR_COUNT} auditors across AWS, Azure, GCP + on-prem`,
      `All ${FRAMEWORK_COUNT} frameworks · ${TOTAL_CONTROLS} controls, weighted per-framework scoring`,
      "Deploy to your own AWS via SST (Lambda / RDS / SQS / S3)",
      "Full source — read it, fork it, extend it, self-audit it",
      "Community support via GitHub Issues & Discussions",
      "Bring your own AI: Anthropic API key or AWS Bedrock IAM role",
    ],
    note: "Local evaluation runs on Docker Compose with no cloud account or API keys.",
    primary: { label: "Quickstart", href: "/self-host" },
    secondary: { label: "View source", href: SITE.repoUrl, external: true },
    featured: true,
  },
  {
    name: "Hosted option",
    badge: "Early access",
    price: "Contact us",
    tagline:
      "We run the AWS backend for you at blackfyre.tech — managed infrastructure, upgrades, and enterprise support on the same open-source core.",
    features: [
      "Managed infrastructure & upgrades — we operate the AWS backend",
      "Enterprise SSO / SAML / SCIM configured for you",
      "Auditor access for external assessors",
      "Priority support",
      "Everything in Self-host — same open-source platform",
    ],
    note: "Managed cloud is not yet live — pricing and SLAs are set during early access.",
    primary: { label: "Get early access", href: SITE.hostedUrl, external: true },
    secondary: { label: "Talk to us", href: "/contact" },
  },
];

interface ComparisonRow {
  feature: string;
  selfHost: string;
  hosted: string;
}

const COMPARISON: readonly ComparisonRow[] = [
  { feature: "Price", selfHost: "$0 forever", hosted: "Contact us" },
  { feature: `All ${AUDITOR_COUNT} auditors (AWS/Azure/GCP + on-prem)`, selfHost: "✓", hosted: "✓" },
  { feature: `${FRAMEWORK_COUNT} frameworks · ${TOTAL_CONTROLS} controls`, selfHost: "✓", hosted: "✓" },
  { feature: "Tamper-evident evidence vault", selfHost: "✓", hosted: "✓" },
  { feature: "Database-enforced multi-tenancy (RLS)", selfHost: "✓", hosted: "✓" },
  { feature: "Enterprise SSO / SAML / SCIM", selfHost: "Self-configured", hosted: "Managed for you" },
  { feature: "AI-assisted analysis", selfHost: "Your key / Bedrock", hosted: "Included" },
  { feature: "Runs on", selfHost: "Your AWS", hosted: "Our AWS" },
  { feature: "Infrastructure & upgrades", selfHost: "You operate", hosted: "Managed" },
  { feature: "Support", selfHost: "Community (GitHub)", hosted: "Priority" },
  { feature: "Full source (Apache-2.0)", selfHost: "✓", hosted: "✓" },
];

const FAQ: readonly { q: string; a: string }[] = [
  {
    q: "Is self-host really full-featured?",
    a: `Yes. Self-host is the complete product — all ${AUDITOR_COUNT} auditors, all ${FRAMEWORK_COUNT} frameworks and ${TOTAL_CONTROLS} controls, the tamper-evident evidence vault, RLS multi-tenancy, and enterprise auth. Apache-2.0 means it's free forever with no feature gates or seat limits.`,
  },
  {
    q: "What does the hosted option add?",
    a: "Managed operations. We run and upgrade the AWS backend, configure enterprise SSO/SAML/SCIM for you, provide auditor access, and offer priority support. The core is the same open-source Blackfyre you can run yourself.",
  },
  {
    q: "Do I need an AI API key?",
    a: "No. AI-assisted analysis is optional: supply an Anthropic API key or use AWS Bedrock via a Lambda IAM role (no key). With nothing configured, those features degrade gracefully to deterministic heuristics.",
  },
  {
    q: "What does self-host cost to run on AWS?",
    a: "The software is free — you pay only your own AWS bill. As a rough guide that's about $56/mo idle for a staging stage and ~$80/mo for a multi-AZ production stage. Local evaluation via Docker Compose is $0.",
  },
  {
    q: "Is the managed hosted cloud live yet?",
    a: "Not yet. Managed hosting is in early access with no public pricing or SLAs. Self-host — local or on your own AWS — is fully available today.",
  },
];

const HERO_CHIPS: readonly { label: string; href: string; external?: boolean }[] = [
  { label: "$0 forever", href: "/self-host" },
  { label: `${AUDITOR_COUNT} auditors`, href: "/agents" },
  { label: `${FRAMEWORK_COUNT} frameworks`, href: "/security" },
  { label: `${TOTAL_CONTROLS} controls`, href: "/security" },
  { label: "Apache-2.0", href: LICENSE_URL, external: true },
];

function TierButton({ cta, variant }: { cta: TierCTA; variant: "accent" | "ghost" }) {
  const className = variant === "accent" ? "halo-btn-accent" : "halo-btn-ghost";
  const inner = (
    <>
      {cta.label}
      <span className="halo-arrow" aria-hidden="true">
        {" "}
        &rarr;
      </span>
    </>
  );
  if (cta.external) {
    return (
      <a href={cta.href} target="_blank" rel="noreferrer" className={className}>
        {inner}
      </a>
    );
  }
  return (
    <Link href={cta.href} className={className}>
      {inner}
    </Link>
  );
}

function chip(chipItem: { label: string; href: string; external?: boolean }) {
  const cls =
    "inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 font-mono text-[11px] uppercase tracking-[0.14em] text-text-muted transition-colors hover:border-border-strong hover:text-text";
  if (chipItem.external) {
    return (
      <a key={chipItem.label} href={chipItem.href} target="_blank" rel="noreferrer" className={cls}>
        {chipItem.label}
      </a>
    );
  }
  return (
    <Link key={chipItem.label} href={chipItem.href} className={cls}>
      {chipItem.label}
    </Link>
  );
}

export default function PricingPage() {
  return (
    <>
      <HaloNav />

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border">
        <div className="halo-hero-glow" aria-hidden="true" />
        <div className="relative mx-auto max-w-[1280px] px-6 py-20 sm:px-12 sm:py-24">
          <p className="halo-eyebrow">§ 01 · PRICING</p>
          <h1 className="mt-4 max-w-[16ch] font-display text-[clamp(40px,6.2vw,68px)] font-medium leading-[1.03] tracking-tightest text-text [text-wrap:balance]">
            Free forever when you{" "}
            <span className="text-accent italic font-normal">self-host.</span>
          </h1>
          <p className="mt-5 max-w-[62ch] font-sans text-[17px] leading-[1.55] text-text-muted">
            Blackfyre is open source under Apache-2.0. The whole platform —{" "}
            {AUDITOR_COUNT} auditors, {FRAMEWORK_COUNT} frameworks, {TOTAL_CONTROLS}{" "}
            controls, the evidence vault, everything — is free to run on your own
            infrastructure, with no seats and no feature gates. Prefer we run it? A
            managed hosted option is in early access.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a href={SITE.repoUrl} target="_blank" rel="noreferrer" className="halo-btn-accent">
              Star on GitHub
              <span className="halo-arrow" aria-hidden="true">
                {" "}
                &rarr;
              </span>
            </a>
            <Link href="/self-host" className="halo-btn-ghost">
              Quickstart
            </Link>
          </div>
          <div className="mt-8 flex flex-wrap gap-2">{HERO_CHIPS.map(chip)}</div>
        </div>
      </section>

      {/* Two tiers */}
      <HaloReveal as="section" delay={0} className="border-b border-border px-6 py-20 sm:px-12 sm:py-24">
        <HaloSectionHead
          eyebrow="§ 02 · CHOOSE YOUR PATH"
          title="Run it yourself, or let us run it."
          titleAccent="run it."
        />
        <div className="mx-auto mt-14 grid max-w-[960px] grid-cols-1 gap-5 md:grid-cols-2">
          {TIERS.map((tier) => (
            <div key={tier.name} className="group relative">
              {tier.badge && (
                <span className="pointer-events-none absolute -top-3 left-6 z-10 rounded-full bg-accent px-3 py-1 font-mono text-[10.5px] uppercase tracking-[0.16em] text-[color:var(--accent-ink)] shadow-halo-glow">
                  {tier.badge}
                </span>
              )}
              <article
                className={`halo-card halo-card-hover flex h-full flex-col p-7 ${
                  tier.featured ? "border-accent" : ""
                }`}
              >
                <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-accent">
                  {tier.name}
                </div>
                <div className="mt-3 flex items-baseline gap-1.5">
                  <span className="font-display text-[clamp(30px,3.4vw,40px)] font-medium tracking-tightest text-text">
                    {tier.price}
                  </span>
                  {tier.period && (
                    <span className="font-mono text-xs text-text-muted">{tier.period}</span>
                  )}
                </div>
                <p className="mt-3 font-sans text-sm leading-[1.55] text-text-muted">
                  {tier.tagline}
                </p>
                <ul className="mt-6 flex flex-col gap-3">
                  {tier.features.map((ft) => (
                    <li
                      key={ft}
                      className="flex items-start gap-2.5 font-sans text-[13.5px] leading-[1.5] text-text"
                    >
                      <span className="mt-px shrink-0 font-mono text-accent" aria-hidden="true">
                        ✓
                      </span>
                      <span>{ft}</span>
                    </li>
                  ))}
                </ul>
                {tier.note && (
                  <p className="mt-5 border-t border-border pt-4 font-sans text-[12.5px] leading-[1.5] text-text-dim">
                    {tier.note}
                  </p>
                )}
                <div className="mt-6 flex flex-wrap items-center gap-3 pt-1">
                  <TierButton cta={tier.primary} variant="accent" />
                  <TierButton cta={tier.secondary} variant="ghost" />
                </div>
              </article>
            </div>
          ))}
        </div>
      </HaloReveal>

      {/* Comparison table */}
      <HaloReveal as="section" delay={0} className="border-b border-border px-6 py-20 sm:px-12 sm:py-24">
        <HaloSectionHead eyebrow="§ 03 · COMPARISON" title="Self-host vs. hosted, side by side." />
        <div className="mx-auto mt-12 max-w-[960px] overflow-x-auto">
          <div className="min-w-[560px] overflow-hidden rounded-[12px] border border-border bg-surface">
            <div className="grid grid-cols-[1.6fr_1fr_1fr] border-b border-border px-6 py-4 font-mono text-[11px] uppercase tracking-[0.14em] text-text-dim">
              <span>Capability</span>
              <span className="text-accent">Self-host</span>
              <span>Hosted</span>
            </div>
            {COMPARISON.map((row, i) => (
              <div
                key={row.feature}
                className={`grid grid-cols-[1.6fr_1fr_1fr] items-center px-6 py-4 font-sans text-sm ${
                  i < COMPARISON.length - 1 ? "border-b border-border" : ""
                }`}
              >
                <span className="text-text">{row.feature}</span>
                <span
                  className={`font-mono text-xs ${
                    row.selfHost === "✓" ? "text-accent" : "text-text"
                  }`}
                >
                  {row.selfHost}
                </span>
                <span
                  className={`font-mono text-xs ${
                    row.hosted === "✓" ? "text-accent" : "text-text-muted"
                  }`}
                >
                  {row.hosted}
                </span>
              </div>
            ))}
          </div>
        </div>
      </HaloReveal>

      {/* FAQ */}
      <HaloReveal as="section" delay={0} className="border-b border-border px-6 py-20 sm:px-12 sm:py-24">
        <HaloSectionHead eyebrow="§ 04 · FAQ" title="Questions, answered honestly." titleAccent="honestly." />
        <div className="mx-auto mt-12 grid max-w-[960px] grid-cols-1 gap-4 md:grid-cols-2">
          {FAQ.map((item) => (
            <article key={item.q} className="halo-card halo-card-hover flex h-full flex-col p-6">
              <h3 className="font-display text-[17px] font-medium leading-[1.25] tracking-tightest text-text">
                {item.q}
              </h3>
              <p className="mt-3 font-sans text-[13.5px] leading-[1.55] text-text-muted">
                {item.a}
              </p>
            </article>
          ))}
        </div>
      </HaloReveal>

      <HaloCTA
        title="Free forever, or fully managed."
        titleAccent="Free forever"
        sub="Self-host the whole platform at no cost, or join the early-access list for managed hosting on our AWS backend."
        eyebrow="§ 05 · START"
        primaryLabel="Star on GitHub"
        primaryHref={SITE.repoUrl}
        secondaryLabel="Get the quickstart"
        secondaryHref="/self-host"
      />

      <HaloFooter />
    </>
  );
}
