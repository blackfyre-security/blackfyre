import type { Metadata } from "next";
import Link from "next/link";
import HaloNav from "@/components/halo/HaloNav";
import HaloFooter from "@/components/halo/HaloFooter";
import HaloSectionHead from "@/components/halo/HaloSectionHead";
import HaloCTA from "@/components/halo/HaloCTA";
import HaloReveal from "@/components/halo/HaloReveal";
import CopyBlock from "./CopyBlock";
import { SITE, QUICKSTART, DOCS, type DocLink } from "@/data/site";
import { AUDITOR_COUNT } from "@/data/auditors";
import { TOTAL_CONTROLS, FRAMEWORK_COUNT } from "@/data/frameworks";

export const metadata: Metadata = {
  title: "Self-host — Blackfyre",
  description:
    "Run Blackfyre yourself, free forever under Apache-2.0. Local evaluation on Docker Compose with no cloud account, or production on your own AWS via SST.",
};

const LICENSE_URL = `${SITE.repoUrl}/blob/main/LICENSE`;

// Pull the exact docs this page links, straight from the shared DOCS registry.
function doc(title: string): DocLink | undefined {
  return DOCS.find((d) => d.title === title);
}
const SELF_HOSTING_DOC = doc("Self-hosting Blackfyre");
const GUIDE_DOCS: readonly DocLink[] = [
  "Local development",
  "Self-hosting Blackfyre",
  "Architecture",
  "Configuration (bring your own credentials)",
  "Deployment",
]
  .map(doc)
  .filter((d): d is DocLink => Boolean(d));

const HERO_CHIPS: readonly { label: string; href: string; external?: boolean }[] = [
  { label: "$0 to run", href: "/pricing" },
  { label: "Apache-2.0", href: LICENSE_URL, external: true },
  { label: "Docker Compose", href: "#quickstart" },
  { label: "SST 4.13", href: "#production" },
  { label: `${AUDITOR_COUNT} auditors`, href: "/agents" },
];

interface Tier {
  id: string;
  eyebrow: string;
  badge: string;
  name: string;
  tagline: string;
  features: string[];
  note: string;
  primary: { label: string; href: string; external?: boolean };
  secondary: { label: string; href: string; external?: boolean };
  featured?: boolean;
}

const TIERS: readonly Tier[] = [
  {
    id: "local",
    eyebrow: "A",
    badge: "Free · no cloud",
    name: "Local / evaluation",
    tagline:
      "Bring the whole stack up on your laptop with Docker Compose — Postgres, Redis and LocalStack — plus npm. No AWS account and no API keys.",
    features: [
      "docker compose up  ·  postgres · redis · localstack",
      "No cloud account, no API keys required",
      "Seeded dev login — admin@acme.com / password123",
      "Portal :3001 · Admin :3003 · API :4000",
      "AI features degrade to deterministic heuristics with no key",
      "$0 — runs entirely on your own machine",
    ],
    note: "Ideal for evaluating Blackfyre, developing, or contributing. Roughly a 15-minute setup — see the Local development guide.",
    primary: { label: "Quickstart", href: "#quickstart" },
    secondary: doc("Local development")
      ? { label: "Local dev guide", href: doc("Local development")!.url, external: true }
      : { label: "View source", href: SITE.repoUrl, external: true },
    featured: true,
  },
  {
    id: "production",
    eyebrow: "B",
    badge: "SST 4.13",
    name: "Production · your AWS",
    tagline:
      "Deploy the backend into your own AWS account with SST — Lambda, RDS, SQS, S3, KMS, Secrets Manager and ECR — with the static frontends on Cloudflare Pages.",
    features: [
      "AWS: Lambda + RDS (Postgres 16) + SQS (4 + 4 DLQ) + S3 Object Lock",
      "KMS · Secrets Manager · ECR for containerized scanners",
      "11 SST-managed secrets per stage",
      "Static portal & admin on Cloudflare Pages",
      "Rough idle cost: ~$56/mo staging · ~$80/mo prod (multi-AZ RDS)",
      "Apache-2.0 — the software itself stays free forever",
    ],
    note: "You provision this into your own account; the project doesn't run a managed cloud with SLAs. See the Self-hosting and Deployment guides.",
    primary: SELF_HOSTING_DOC
      ? { label: "Self-hosting guide", href: SELF_HOSTING_DOC.url, external: true }
      : { label: "View source", href: SITE.repoUrl, external: true },
    secondary: doc("Deployment")
      ? { label: "Deployment guide", href: doc("Deployment")!.url, external: true }
      : { label: "Docs", href: SITE.repoUrl, external: true },
  },
];

interface Need {
  label: string;
  detail: string;
  scope: string;
}

const NEEDS: readonly Need[] = [
  {
    label: "Node 20",
    detail: "The monorepo builds and runs on Node 20 with npm workspaces.",
    scope: "both tiers",
  },
  {
    label: "Docker + Compose",
    detail: "Runs Postgres 16, Redis and LocalStack for the local stack.",
    scope: "local tier",
  },
  {
    label: "Git",
    detail: "Clone the Apache-2.0 repo to get the source and start the stack.",
    scope: "both tiers",
  },
  {
    label: "AWS account",
    detail: "Only for production — SST deploys into an account you own.",
    scope: "production tier",
  },
];

function TierButton({
  cta,
  variant,
}: {
  cta: { label: string; href: string; external?: boolean };
  variant: "accent" | "ghost";
}) {
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

function chip(item: { label: string; href: string; external?: boolean }) {
  const cls =
    "inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 font-mono text-[11px] uppercase tracking-[0.14em] text-text-muted transition-colors hover:border-border-strong hover:text-text";
  if (item.external) {
    return (
      <a key={item.label} href={item.href} target="_blank" rel="noreferrer" className={cls}>
        {item.label}
      </a>
    );
  }
  return (
    <Link key={item.label} href={item.href} className={cls}>
      {item.label}
    </Link>
  );
}

export default function SelfHostPage() {
  return (
    <>
      <HaloNav />

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border">
        <div className="halo-hero-glow" aria-hidden="true" />
        <div className="relative mx-auto max-w-[1280px] px-6 py-20 sm:px-12 sm:py-24">
          <p className="halo-eyebrow">§ 01 · SELF-HOST</p>
          <h1 className="mt-4 max-w-[18ch] font-display text-[clamp(40px,6.2vw,68px)] font-medium leading-[1.03] tracking-tightest text-text [text-wrap:balance]">
            Run it yourself.{" "}
            <span className="text-accent italic font-normal">Free forever.</span>
          </h1>
          <p className="mt-5 max-w-[64ch] font-sans text-[17px] leading-[1.55] text-text-muted">
            Blackfyre is open source under Apache-2.0 — the entire platform, all{" "}
            {AUDITOR_COUNT} auditors, {FRAMEWORK_COUNT} frameworks and {TOTAL_CONTROLS}{" "}
            controls. Evaluate it locally on Docker Compose with no cloud account or
            keys, or deploy it to your own AWS via SST. No seats, no feature gates, no
            expiry.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a href={SITE.repoUrl} target="_blank" rel="noreferrer" className="halo-btn-accent">
              Star on GitHub
              <span className="halo-arrow" aria-hidden="true">
                {" "}
                &rarr;
              </span>
            </a>
            {SELF_HOSTING_DOC ? (
              <a
                href={SELF_HOSTING_DOC.url}
                target="_blank"
                rel="noreferrer"
                className="halo-btn-ghost"
              >
                Docs
              </a>
            ) : (
              <Link href="#quickstart" className="halo-btn-ghost">
                Quickstart
              </Link>
            )}
          </div>
          <div className="mt-8 flex flex-wrap gap-2">{HERO_CHIPS.map(chip)}</div>
        </div>
      </section>

      {/* Quickstart */}
      <HaloReveal
        as="section"
        delay={0}
        className="scroll-mt-24 border-b border-border px-6 py-20 sm:px-12 sm:py-24"
      >
        <div id="quickstart" className="scroll-mt-24" />
        <HaloSectionHead
          eyebrow="§ 02 · QUICKSTART"
          title="Up and running in one paste."
          titleAccent="one paste."
          blurb="The full local stack — no cloud account or API keys. Clone, start the services, migrate, and log in as the seeded dev user."
        />
        <div className="mx-auto mt-12 max-w-[860px]">
          <CopyBlock code={QUICKSTART} />
          <p className="mt-4 text-center font-sans text-[12.5px] leading-[1.5] text-text-dim">
            Prerequisites: Node 20, Docker + Docker Compose, and Git. Full walkthrough
            and troubleshooting live in the Local development guide.
          </p>
        </div>
      </HaloReveal>

      {/* Two tiers */}
      <HaloReveal
        as="section"
        delay={0}
        className="border-b border-border px-6 py-20 sm:px-12 sm:py-24"
      >
        <HaloSectionHead
          eyebrow="§ 03 · TWO WAYS TO RUN IT"
          title="Evaluate locally, or deploy to your own AWS."
          titleAccent="your own AWS."
        />
        <div className="mx-auto mt-14 grid max-w-[960px] grid-cols-1 gap-5 md:grid-cols-2">
          {TIERS.map((tier) => (
            <div key={tier.id} id={tier.id} className="group relative scroll-mt-24">
              <span className="pointer-events-none absolute -top-3 left-6 z-10 rounded-full bg-accent px-3 py-1 font-mono text-[10.5px] uppercase tracking-[0.16em] text-[color:var(--accent-ink)] shadow-halo-glow">
                {tier.badge}
              </span>
              <article
                className={`halo-card halo-card-hover flex h-full flex-col p-7 ${
                  tier.featured ? "border-accent" : ""
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full border border-border-strong font-mono text-[13px] text-accent">
                    {tier.eyebrow}
                  </span>
                  <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-accent">
                    {tier.name}
                  </div>
                </div>
                <p className="mt-4 font-sans text-sm leading-[1.55] text-text-muted">
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
                <p className="mt-5 border-t border-border pt-4 font-sans text-[12.5px] leading-[1.5] text-text-dim">
                  {tier.note}
                </p>
                <div className="mt-6 flex flex-wrap items-center gap-3 pt-1">
                  <TierButton cta={tier.primary} variant="accent" />
                  <TierButton cta={tier.secondary} variant="ghost" />
                </div>
              </article>
            </div>
          ))}
        </div>
      </HaloReveal>

      {/* What you need */}
      <HaloReveal
        as="section"
        delay={0}
        className="border-b border-border px-6 py-20 sm:px-12 sm:py-24"
      >
        <HaloSectionHead
          eyebrow="§ 04 · WHAT YOU NEED"
          title="A short list of prerequisites."
          titleAccent="prerequisites."
        />
        <div className="mx-auto mt-12 grid max-w-[960px] grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {NEEDS.map((need) => (
            <article key={need.label} className="halo-card halo-card-hover flex h-full flex-col p-6">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-display text-[17px] font-medium leading-[1.2] tracking-tightest text-text">
                  {need.label}
                </h3>
              </div>
              <p className="mt-3 flex-1 font-sans text-[13px] leading-[1.55] text-text-muted">
                {need.detail}
              </p>
              <span className="mt-4 inline-flex w-fit items-center rounded-full border border-border bg-surface px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-text-dim">
                {need.scope}
              </span>
            </article>
          ))}
        </div>
      </HaloReveal>

      {/* Docs */}
      <HaloReveal
        as="section"
        delay={0}
        className="border-b border-border px-6 py-20 sm:px-12 sm:py-24"
      >
        <HaloSectionHead
          eyebrow="§ 05 · READ THE DOCS"
          title="Everything the guide covers."
          titleAccent="the guide"
        />
        <div className="mx-auto mt-12 grid max-w-[960px] grid-cols-1 gap-4 md:grid-cols-2">
          {GUIDE_DOCS.map((d) => (
            <a
              key={d.title}
              href={d.url}
              target="_blank"
              rel="noreferrer"
              className="halo-card halo-card-hover halo-arrow-parent flex h-full flex-col p-6"
            >
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-display text-[17px] font-medium leading-[1.25] tracking-tightest text-text">
                  {d.title}
                </h3>
                <span className="halo-arrow mt-1 shrink-0 font-mono text-accent" aria-hidden="true">
                  &rarr;
                </span>
              </div>
              {d.blurb && (
                <p className="mt-3 font-sans text-[13px] leading-[1.55] text-text-muted">
                  {d.blurb}
                </p>
              )}
            </a>
          ))}
        </div>
      </HaloReveal>

      <HaloCTA
        title="Clone it and run it today."
        titleAccent="run it"
        sub="It's Apache-2.0 and free forever to self-host — start locally in about fifteen minutes, then deploy to your own AWS when you're ready."
        eyebrow="§ 06 · START"
        primaryLabel="Star on GitHub"
        primaryHref={SITE.repoUrl}
        secondaryLabel="Get the quickstart"
        secondaryHref="#quickstart"
      />

      <HaloFooter />
    </>
  );
}
