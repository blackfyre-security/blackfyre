import type { Metadata } from "next";
import type { ReactNode } from "react";
import {
  Sparkles,
  Layers,
  ScanLine,
  BookOpen,
  Star,
  Server,
  Cloud,
  Check,
  ShieldCheck,
  FileCheck2,
} from "lucide-react";

import HaloNav from "@/components/halo/HaloNav";
import HaloFooter from "@/components/halo/HaloFooter";

import Section from "@/components/vibrant/Section";
import SectionHead from "@/components/vibrant/SectionHead";
import StatRow from "@/components/vibrant/StatRow";
import { LimeButton, GhostButton, GitHubIcon } from "@/components/vibrant/buttons";

import { SITE } from "@/data/site";
import { AUDITOR_COUNT } from "@/data/auditors";
import { TOTAL_CONTROLS, FRAMEWORK_COUNT } from "@/data/frameworks";

export const metadata: Metadata = {
  title: "Pricing — Blackfyre",
  description:
    "Blackfyre is free to self-host forever under Apache-2.0 — all 55 auditors, 9 frameworks and 678 controls. A managed hosted option is in early access.",
};

const LICENSE_URL = `${SITE.repoUrl}/blob/main/LICENSE`;

/* ── data ──────────────────────────────────────────────────────────────── */

interface Tier {
  name: string;
  icon: typeof Server;
  badge: string;
  badgeClass: string;
  price: string;
  period?: string;
  tagline: string;
  features: string[];
  note: string;
  checkClass: string;
  featured?: boolean;
}

const TIERS: readonly Tier[] = [
  {
    name: "Self-host",
    icon: Server,
    badge: "Free forever",
    badgeClass: "bg-[#c6f24e] text-zinc-950",
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
    checkClass: "text-lime-600",
    featured: true,
  },
  {
    name: "Hosted option",
    icon: Cloud,
    badge: "Early access",
    badgeClass: "border border-amber-200 bg-amber-100 text-amber-800",
    price: "Contact us",
    tagline:
      "We run the AWS backend for you at blackfyre.tech — managed infrastructure, upgrades and enterprise support on the same open-source core.",
    features: [
      "Managed infrastructure & upgrades — we operate the AWS backend",
      "Enterprise SSO / SAML / SCIM configured for you",
      "Auditor access for external assessors",
      "Priority support",
      "Everything in Self-host — same open-source platform",
    ],
    note: "Managed cloud is not live yet — pricing and SLAs are set during early access.",
    checkClass: "text-blue-600",
  },
];

interface ComparisonRow {
  feature: string;
  selfHost: string;
  hosted: string;
}

const COMPARISON: readonly ComparisonRow[] = [
  { feature: "Price", selfHost: "$0 forever", hosted: "Contact us" },
  { feature: `All ${AUDITOR_COUNT} auditors (AWS / Azure / GCP + on-prem)`, selfHost: "✓", hosted: "✓" },
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
    a: `Yes. Self-host is the complete product — all ${AUDITOR_COUNT} auditors, all ${FRAMEWORK_COUNT} frameworks and ${TOTAL_CONTROLS} controls, the tamper-evident evidence vault, RLS multi-tenancy and enterprise auth. Apache-2.0 means it's free forever with no feature gates or seat limits.`,
  },
  {
    q: "What does the hosted option add?",
    a: "Managed operations. We run and upgrade the AWS backend, configure enterprise SSO / SAML / SCIM for you, provide auditor access and offer priority support. The core is the same open-source Blackfyre you can run yourself.",
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

/* ── hero price-card illustration (dark inset on the light hero) ─────────── */

const PriceRow = ({ k, v }: { k: string; v: string }) => (
  <div className="flex items-center justify-between font-mono text-[11px]">
    <span className="text-zinc-500">{k}</span>
    <span className="text-emerald-400">{v}</span>
  </div>
);

function HeroPriceCard() {
  return (
    <div className="relative rounded-2xl border border-zinc-800 bg-[#09090e] p-7 text-white shadow-2xl">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-[#c6f24e]/10 blur-3xl"
      />
      <div className="relative">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">
            Self-host · Apache-2.0
          </span>
          <ShieldCheck className="h-4 w-4 text-[#c6f24e]" />
        </div>
        <div className="mt-5 flex items-baseline gap-2">
          <span className="font-mono text-5xl font-extrabold tracking-tight">$0</span>
          <span className="font-mono text-xs text-zinc-500">/ forever</span>
        </div>
        <div className="mt-6 space-y-2 border-t border-zinc-800 pt-5">
          <PriceRow k={`${AUDITOR_COUNT} auditors`} v="included" />
          <PriceRow k={`${FRAMEWORK_COUNT} frameworks`} v="included" />
          <PriceRow k={`${TOTAL_CONTROLS} controls`} v="included" />
          <PriceRow k="evidence vault" v="included" />
          <PriceRow k="rls multi-tenancy" v="included" />
        </div>
        <div className="mt-5 flex items-center justify-between border-t border-zinc-800 pt-5">
          <span className="font-mono text-[11px] uppercase tracking-wider text-zinc-400">Total</span>
          <span className="font-mono text-lg font-bold text-[#c6f24e]">$0.00</span>
        </div>
        <p className="mt-4 font-mono text-[10px] leading-relaxed text-zinc-600">
          No seats · no feature gates · no expiry
        </p>
      </div>
    </div>
  );
}

/* ── tier card ─────────────────────────────────────────────────────────── */

function TierCard({ tier, children }: { tier: Tier; children: ReactNode }) {
  const Icon = tier.icon;
  return (
    <div className="relative">
      <span
        className={`pointer-events-none absolute -top-3 left-7 z-10 rounded-full px-3 py-1 font-mono text-[10.5px] font-semibold uppercase tracking-[0.16em] ${tier.badgeClass}`}
      >
        {tier.badge}
      </span>
      <article
        className={`flex h-full flex-col rounded-2xl bg-white p-8 transition-all duration-300 hover:-translate-y-1 ${
          tier.featured
            ? "border-2 border-lime-300 shadow-[0_12px_44px_-14px_rgba(163,190,60,0.55)]"
            : "border border-zinc-200 hover:shadow-lg"
        }`}
      >
        <div className="flex items-center gap-2">
          <Icon className={`h-4 w-4 ${tier.checkClass}`} />
          <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
            {tier.name}
          </span>
        </div>
        <div className="mt-4 flex items-baseline gap-2">
          <span className="font-mono text-4xl font-extrabold tracking-tight text-zinc-900 sm:text-5xl">
            {tier.price}
          </span>
          {tier.period && <span className="font-mono text-xs text-zinc-500">{tier.period}</span>}
        </div>
        <p className="mt-4 text-sm leading-relaxed text-zinc-600">{tier.tagline}</p>
        <ul className="mt-6 flex flex-1 flex-col gap-3">
          {tier.features.map((ft) => (
            <li key={ft} className="flex items-start gap-2.5 text-[13.5px] leading-snug text-zinc-800">
              <Check className={`mt-0.5 h-4 w-4 flex-shrink-0 ${tier.checkClass}`} />
              <span>{ft}</span>
            </li>
          ))}
        </ul>
        <p className="mt-6 border-t border-zinc-100 pt-4 text-[12.5px] leading-relaxed text-zinc-500">
          {tier.note}
        </p>
        <div className="mt-6 flex flex-wrap gap-3">{children}</div>
      </article>
    </div>
  );
}

/* ── page ──────────────────────────────────────────────────────────────── */

export default function PricingPage() {
  const [selfHost, hosted] = TIERS;

  return (
    <>
      <HaloNav />

      {/* ── HERO · light · blue ─────────────────────────────────────────── */}
      <Section variant="light">
        <div className="grid gap-16 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
          <div>
            <SectionHead
              size="hero"
              accent="blue"
              on="light"
              eyebrow="Pricing · Apache-2.0"
              eyebrowIcon={<Sparkles className="h-3.5 w-3.5" />}
              title={
                <>
                  Free forever when you
                  <br />
                </>
              }
              accentWord="self-host."
              sub={
                <>
                  Blackfyre is open source. The whole platform —{" "}
                  <strong className="font-semibold text-zinc-900">{AUDITOR_COUNT} auditors</strong>,{" "}
                  {FRAMEWORK_COUNT} frameworks, {TOTAL_CONTROLS} controls, the evidence vault,
                  everything — is free to run on your own infrastructure, with no seats and no feature
                  gates. Prefer we run it? A managed hosted option is in early access.
                </>
              }
            />
            <div className="mt-8 flex flex-wrap gap-3">
              <LimeButton href={SITE.repoUrl} external icon={<GitHubIcon />}>
                Star on GitHub
              </LimeButton>
              <GhostButton href="/self-host">Quickstart</GhostButton>
            </div>

            <StatRow
              className="mt-10"
              kicker="What $0 gets you"
              stats={[
                { value: "$0", label: "Self-host", color: "text-lime-600" },
                { value: String(AUDITOR_COUNT), label: "Auditors" },
                { value: String(FRAMEWORK_COUNT), label: "Frameworks", color: "text-blue-600" },
                { value: "Apache-2.0", label: "Licence" },
              ]}
            />
          </div>

          <div className="hidden lg:block">
            <HeroPriceCard />
          </div>
        </div>
      </Section>

      {/* ── CHOOSE YOUR PATH · warm · amber ─────────────────────────────── */}
      <Section variant="warm">
        <SectionHead
          align="center"
          className="mx-auto"
          accent="amber"
          on="light"
          eyebrow="Choose your path"
          eyebrowIcon={<Layers className="h-3.5 w-3.5" />}
          title="Run it yourself, or let us"
          accentWord="run it."
          accentStyle="solid"
          sub="Two ways to get Blackfyre. Same open-source core, same 678 controls — you decide who operates the infrastructure."
        />

        <div className="mx-auto mt-14 grid max-w-[960px] grid-cols-1 gap-6 md:grid-cols-2">
          <TierCard tier={selfHost}>
            <LimeButton href="/self-host">Quickstart</LimeButton>
            <GhostButton href={SITE.repoUrl} external icon={<GitHubIcon />}>
              View source
            </GhostButton>
          </TierCard>

          <TierCard tier={hosted}>
            <GhostButton href={SITE.demoUrl} external>
              Get early access
            </GhostButton>
            <GhostButton href="/contact">Talk to us</GhostButton>
          </TierCard>
        </div>
      </Section>

      {/* ── COMPARISON · dark · purple ──────────────────────────────────── */}
      <Section variant="dark">
        <SectionHead
          accent="purple"
          on="dark"
          eyebrow="Compare"
          eyebrowIcon={<ScanLine className="h-3.5 w-3.5" />}
          title="Self-host vs. hosted,"
          accentWord="side by side."
          sub="Every capability ships in both. The only difference is who runs the AWS backend and configures the enterprise plumbing."
        />

        <div className="mt-12 overflow-x-auto">
          <div className="min-w-[620px] overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950">
            <div className="grid grid-cols-[1.7fr_1fr_1fr] border-b border-zinc-800 px-6 py-4 font-mono text-[11px] uppercase tracking-[0.14em] text-zinc-500">
              <span>Capability</span>
              <span className="text-purple-400">Self-host</span>
              <span>Hosted</span>
            </div>
            {COMPARISON.map((row, i) => (
              <div
                key={row.feature}
                className={`grid grid-cols-[1.7fr_1fr_1fr] items-center px-6 py-4 text-sm ${
                  i < COMPARISON.length - 1 ? "border-b border-zinc-900" : ""
                }`}
              >
                <span className="pr-4 text-zinc-200">{row.feature}</span>
                <Cell value={row.selfHost} accentClass="text-purple-400" checkClass="text-purple-400" />
                <Cell value={row.hosted} accentClass="text-zinc-300" checkClass="text-emerald-400" />
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* ── FAQ · light · emerald ───────────────────────────────────────── */}
      <Section variant="light">
        <SectionHead
          accent="emerald"
          on="light"
          eyebrow="FAQ"
          eyebrowIcon={<BookOpen className="h-3.5 w-3.5" />}
          title="Questions, answered"
          accentWord="honestly."
          sub="No dark patterns. If the managed cloud isn't live yet, we say so."
        />

        <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-2">
          {FAQ.map((item) => (
            <article
              key={item.q}
              className="flex h-full flex-col rounded-2xl border border-zinc-200/80 bg-white p-6 transition-shadow duration-300 hover:shadow-lg"
            >
              <h3 className="text-[17px] font-bold leading-snug text-zinc-900">{item.q}</h3>
              <p className="mt-3 text-sm leading-relaxed text-zinc-600">{item.a}</p>
            </article>
          ))}
        </div>
      </Section>

      {/* ── GET STARTED · dark · lime ───────────────────────────────────── */}
      <Section variant="dark" orbs={false}>
        <div className="flex flex-col items-center text-center">
          <SectionHead
            align="center"
            accent="lime"
            on="dark"
            eyebrow="Start"
            eyebrowIcon={<Star className="h-3.5 w-3.5" />}
            title="Free forever, or"
            accentWord="fully managed."
            sub="Self-host the whole platform at no cost, or join the early-access list for managed hosting on our AWS backend."
          />
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <LimeButton href={SITE.repoUrl} external icon={<GitHubIcon />}>
              Star on GitHub
            </LimeButton>
            <GhostButton href="/self-host" on="dark" icon={<FileCheck2 className="h-4 w-4" />}>
              Get the quickstart
            </GhostButton>
          </div>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
            {[
              { label: "$0 forever", href: "/self-host", external: false },
              { label: `${AUDITOR_COUNT} auditors`, href: "/agents", external: false },
              { label: `${TOTAL_CONTROLS} controls`, href: "/security", external: false },
              { label: "Apache-2.0", href: LICENSE_URL, external: true },
            ].map((c) => (
              <a
                key={c.label}
                href={c.href}
                target={c.external ? "_blank" : undefined}
                rel={c.external ? "noreferrer" : undefined}
                className="inline-flex items-center rounded-full border border-zinc-800 bg-zinc-900/60 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.14em] text-zinc-400 transition-colors hover:border-zinc-700 hover:text-white"
              >
                {c.label}
              </a>
            ))}
          </div>
        </div>
      </Section>

      <HaloFooter />
    </>
  );
}

/* ── comparison cell ───────────────────────────────────────────────────── */

function Cell({
  value,
  accentClass,
  checkClass,
}: {
  value: string;
  accentClass: string;
  checkClass: string;
}) {
  if (value === "✓") {
    return <Check className={`h-4 w-4 ${checkClass}`} aria-label="Included" />;
  }
  return <span className={`font-mono text-xs ${accentClass}`}>{value}</span>;
}
