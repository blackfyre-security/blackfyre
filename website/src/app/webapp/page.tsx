import type { Metadata } from "next";
import Link from "next/link";
import HaloNav from "@/components/halo/HaloNav";
import HaloFooter from "@/components/halo/HaloFooter";
import HaloCTA from "@/components/halo/HaloCTA";
import HaloSectionHead from "@/components/halo/HaloSectionHead";
import Reveal from "@/components/mobile-app/Reveal";
import WebMockups from "@/components/web/WebMockups";
import WebProcessTimeline from "@/components/web/WebProcessTimeline";
import WebFAQ from "@/components/web/WebFAQ";
import HaloReveal from "@/components/halo/HaloReveal";

export const metadata: Metadata = {
  title:
    "Web Development — Marketing Sites, SaaS Apps, Internal Tools | BLACKFYRE",
  description:
    "Practitioner-led web development. Marketing sites that load, SaaS that scales, internal tools that ship. Next.js, Astro, Rails, Django — picked to fit the problem, owned by you from day one.",
  openGraph: {
    title:
      "Web Development — Marketing Sites, SaaS Apps, Internal Tools | BLACKFYRE",
    description:
      "Marketing sites, SaaS applications, internal tools, and legacy modernization. Stack chosen by the problem — code, hosting, and credentials owned by you.",
    type: "article",
  },
};

interface UseCase {
  index: string;
  label: string;
  role: string;
  title: string;
  body: string;
}

const USE_CASES: UseCase[] = [
  {
    index: "01",
    label: "Marketing site",
    role: "Static, fast, editable",
    title: "The page your customer opens first.",
    body: "Next.js with static export or Astro, wired to a headless CMS like Sanity or Contentful so the marketing team ships copy without a deploy. Core Web Vitals green, edge-cached, instrumented.",
  },
  {
    index: "02",
    label: "SaaS application",
    role: "Auth, billing, multi-tenant",
    title: "The product your customers log in to.",
    body: "Next.js with tRPC and Postgres through Drizzle or Prisma. Stripe for billing, RBAC from the schema up, observability from week one. Multi-tenant isolation handled at the database, not bolted on.",
  },
  {
    index: "03",
    label: "Enterprise internal tool",
    role: "OAuth, RBAC, audit",
    title: "The admin console your team opens daily.",
    body: "TypeScript and React with OAuth, row-level security, SSO against your identity provider, and an audit log baked in. Admin consoles, ops dashboards, and back-office workflows that stand up to review.",
  },
  {
    index: "04",
    label: "Legacy modernization",
    role: "React layered, no rewrite",
    title: "The old app you're not ready to throw away.",
    body: "Strangler-fig migrations — one route at a time — and HTMX or React islands where they fit. Existing APIs preserved, UX lifted, business keeps moving while the codebase gets younger.",
  },
];

interface StackRow {
  shape: string;
  stack: string;
}

const STACK_ROWS: StackRow[] = [
  {
    shape: "Marketing-led, static, fast",
    stack: "Next.js (static export) or Astro, headless CMS, edge deploy",
  },
  {
    shape: "SaaS with auth + billing",
    stack:
      "Next.js + tRPC + Postgres (Drizzle/Prisma), Stripe, Clerk or Auth.js",
  },
  {
    shape: "Enterprise internal tool",
    stack:
      "TypeScript + React + OAuth + RBAC, Postgres, audit log baked in from day one",
  },
  {
    shape: "Legacy modernization",
    stack:
      "React islands or HTMX over existing backend, no big-bang rewrite",
  },
];

interface SpecRow {
  k: string;
  v: string;
}

const PRODUCTION_SPEC: SpecRow[] = [
  { k: "Hosting", v: "Vercel / Cloudflare / AWS" },
  { k: "Domain + DNS", v: "Registrar in your name" },
  { k: "CDN + caching", v: "Edge rules, ISR where it fits" },
  { k: "SSL + HSTS", v: "Auto-renewed, preload eligible" },
  { k: "Observability", v: "Sentry + structured logs" },
  { k: "CI/CD", v: "GitHub Actions, preview per PR" },
  { k: "Analytics", v: "Plausible / PostHog, privacy-first" },
];

const REPO_SPEC: SpecRow[] = [
  { k: "Source", v: "Your GitHub, day one" },
  { k: "Types", v: "End-to-end TypeScript" },
  { k: "Tests", v: "Vitest + Playwright" },
  { k: "Docs", v: "README + architecture notes" },
  { k: "Runbooks", v: "Deploy, rollback, oncall" },
  { k: "Components", v: "Storybook or equivalent" },
];

export default function WebDevelopmentPage() {
  return (
    <>
      <HaloNav />

      {/* § 00 — HERO */}
      <section className="relative overflow-hidden border-b border-border bg-halo-radial px-6 pb-24 pt-24 sm:pb-32 sm:pt-32 md:px-12">
        <div className="mx-auto grid max-w-[1280px] grid-cols-1 items-center gap-12 lg:grid-cols-[1.15fr_0.85fr] lg:gap-20">
          <div>
            <Reveal>
              <p className="halo-eyebrow">§ 00 &middot; Web Development</p>
            </Reveal>

            <Reveal delay={80}>
              <h1 className="mt-6 font-display text-[clamp(44px,6.8vw,88px)] font-medium leading-[0.98] tracking-display text-text [text-wrap:balance]">
                Marketing sites that load.{" "}
                <span className="halo-italic">SaaS</span> that scales.{" "}
                <span className="text-text-muted">Internal tools that ship.</span>
              </h1>
            </Reveal>

            <Reveal delay={180}>
              <p className="mt-8 max-w-lg text-[17px] leading-[1.65] text-text-muted">
                Practitioner-led web builds. Next.js, Astro, Rails, Django —
                picked to fit the job, not the portfolio. We design, build,
                host, and hand over the keys. Code, domain, and analytics sit
                in your account from day one.
              </p>
            </Reveal>

            <Reveal delay={260}>
              <div className="mt-10 flex flex-wrap items-center gap-3">
                <Link href="/contact" className="halo-btn-accent">
                  Book a discovery call <span className="halo-arrow" aria-hidden="true">&rarr;</span>
                </Link>
                <Link href="/services" className="halo-btn-ghost">
                  Explore services
                </Link>
              </div>
            </Reveal>
          </div>

          <div className="relative hidden lg:block">
            <WebMockups />
          </div>
        </div>
      </section>

      {/* § 01 — USE CASES */}
      <HaloReveal as="section" delay={0} className="border-b border-border px-6 py-24 sm:py-32 md:px-12">
        <div className="mx-auto max-w-[1280px]">
          <HaloSectionHead
            eyebrow="§ 01 &middot; Use cases"
            title="Four shapes of the modern web."
            titleAccent="modern"
          />
          <ol className="mx-auto mt-16 max-w-[1000px] divide-y divide-border border-y border-border">
            {USE_CASES.map((uc, i) => (
              <Reveal as="li" key={uc.index} delay={i * 80}>
                <article className="grid grid-cols-12 gap-x-6 gap-y-4 py-12 sm:py-16">
                  <div className="col-span-12 sm:col-span-3">
                    <p className="font-mono text-xs text-accent">{uc.index}</p>
                    <p className="halo-label mt-2">{uc.role}</p>
                  </div>
                  <div className="col-span-12 sm:col-span-9">
                    <p className="halo-label mb-3">{uc.label}</p>
                    <h3 className="font-display text-2xl leading-[1.15] tracking-display text-text sm:text-[32px]">
                      {uc.title}
                    </h3>
                    <p className="mt-4 max-w-xl text-[16px] leading-[1.7] text-text-muted">
                      {uc.body}
                    </p>
                  </div>
                </article>
              </Reveal>
            ))}
          </ol>
        </div>
      </HaloReveal>

      {/* § 02 — PULL QUOTE */}
      <HaloReveal as="section" delay={120} className="relative border-b border-border bg-surface px-6 py-28 sm:py-36 md:px-12">
        <div className="mx-auto max-w-[1000px]">
          <Reveal>
            <p className="halo-eyebrow justify-center">§ 02 &middot; Ethos</p>
          </Reveal>
          <Reveal delay={80}>
            <blockquote className="mx-auto mt-8 max-w-5xl text-center font-display text-[clamp(36px,5.5vw,72px)] font-medium leading-[1.05] tracking-display text-text [text-wrap:balance]">
              <span className="text-text-dim">&ldquo;</span>The web is not a
              framework.
              <span className="block text-text-muted">
                It is the thing your customer opens first.
              </span>
              <span className="text-text-dim">&rdquo;</span>
            </blockquote>
          </Reveal>
          <Reveal delay={120}>
            <p className="mt-10 flex items-center justify-center gap-3 text-text-dim">
              <span className="h-px w-8 bg-border-strong" />
              <span className="font-mono text-xs uppercase tracking-[0.22em]">
                How we build for the browser
              </span>
              <span className="h-px w-8 bg-border-strong" />
            </p>
          </Reveal>
        </div>
      </HaloReveal>

      {/* § 03 — STACK SELECTION */}
      <HaloReveal as="section" delay={240} className="border-b border-border px-6 py-24 sm:py-32 md:px-12">
        <div className="mx-auto grid max-w-[1280px] grid-cols-12 gap-x-6">
          <div className="col-span-12 lg:col-span-3">
            <Reveal>
              <p className="halo-eyebrow">§ 03 &middot; Stack selection</p>
            </Reveal>
            <Reveal delay={80}>
              <h2 className="mt-5 font-display text-[clamp(28px,3.6vw,42px)] font-medium leading-[1.1] tracking-display text-text">
                How we choose the stack.
              </h2>
            </Reveal>
            <Reveal delay={160}>
              <p className="mt-5 max-w-[24ch] text-[15px] leading-[1.7] text-text-muted">
                The shape of the problem picks the stack — never the other way
                around. We hold no allegiance to any one framework.
              </p>
            </Reveal>
          </div>

          <div className="col-span-12 lg:col-span-9 lg:pl-10">
            <ol className="space-y-6">
              {STACK_ROWS.map((row, i) => (
                <Reveal as="li" key={row.shape} delay={i * 70}>
                  <article className="halo-card halo-card-hover grid grid-cols-12 gap-x-6 gap-y-3 p-6 sm:p-8">
                    <div className="col-span-12 sm:col-span-5">
                      <p className="halo-label mb-2">If the site is</p>
                      <p className="font-display text-[20px] leading-[1.2] tracking-display text-text">
                        {row.shape}
                      </p>
                    </div>
                    <div className="col-span-12 sm:col-span-7">
                      <p className="halo-label mb-2">Default stack</p>
                      <p className="font-mono text-[13px] leading-[1.7] text-text-muted">
                        {row.stack}
                      </p>
                    </div>
                  </article>
                </Reveal>
              ))}
            </ol>
          </div>
        </div>
      </HaloReveal>

      {/* § 04 — PROCESS */}
      <HaloReveal as="section" delay={360} className="border-b border-border px-6 py-24 sm:py-32 md:px-12">
        <div className="mx-auto max-w-[1000px]">
          <HaloSectionHead
            eyebrow="§ 04 &middot; Process"
            title="Six weeks, six milestones."
            titleAccent="Six weeks"
            blurb="Discovery to post-launch, linear and unfussy. A staging URL from week one, production by week six — faster when the scope is tight, slower only when you ask us to slow down."
          />
          <div className="mt-16">
            <WebProcessTimeline />
          </div>
        </div>
      </HaloReveal>

      {/* § 05 — DELIVERABLES */}
      <HaloReveal as="section" delay={480} className="border-b border-border bg-surface px-6 py-24 sm:py-32 md:px-12">
        <div className="mx-auto max-w-[1280px]">
          <div className="grid grid-cols-12 gap-x-6">
            <div className="col-span-12 lg:col-span-4">
              <Reveal>
                <p className="halo-eyebrow">§ 05 &middot; Deliverables</p>
              </Reveal>
              <Reveal delay={80}>
                <h2 className="mt-5 font-display text-[clamp(28px,3.6vw,42px)] font-medium leading-[1.1] tracking-display text-text">
                  What lands in your account.
                </h2>
              </Reveal>
              <Reveal delay={160}>
                <p className="mt-6 max-w-sm text-[15px] leading-[1.7] text-text-muted">
                  A literal handover list. Infrastructure in your accounts,
                  source in your repo, runbooks written by the people who built
                  the thing.
                </p>
              </Reveal>
            </div>

            <div className="col-span-12 lg:col-span-8 lg:pl-10">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-8">
                <Reveal>
                  <SpecColumn
                    heading="Production"
                    caption="Live infrastructure"
                    rows={PRODUCTION_SPEC}
                  />
                </Reveal>
                <Reveal delay={120}>
                  <SpecColumn
                    heading="Repo & DX"
                    caption="What your team inherits"
                    rows={REPO_SPEC}
                  />
                </Reveal>
              </div>

              <Reveal delay={220}>
                <p className="mt-10 text-[14px] leading-[1.7] text-text-dim">
                  <span className="font-mono text-xs uppercase tracking-[0.18em] text-text-muted">
                    Engagement
                  </span>
                  <span className="mx-3 text-border-strong">·</span>
                  Fixed-scope. Marketing site, SaaS MVP, internal tool, or
                  migration — quoted after discovery.{" "}
                  <Link
                    href="/contact"
                    className="halo-arrow-parent text-accent underline-offset-4 hover:underline"
                  >
                    Start the conversation <span className="halo-arrow" aria-hidden="true">&rarr;</span>
                  </Link>
                </p>
              </Reveal>
            </div>
          </div>
        </div>
      </HaloReveal>

      {/* TRUST STRIP */}
      <HaloReveal as="section" delay={480} className="border-b border-border px-6 py-20 sm:py-28 md:px-12">
        <Reveal>
          <p className="mx-auto max-w-5xl text-center font-display text-[clamp(24px,3vw,40px)] font-medium leading-[1.2] tracking-display text-text [text-wrap:balance]">
            Code in your repo.{" "}
            <span className="text-text-muted">Hosting in your name.</span>{" "}
            <span className="text-text-dim">Domain on your registrar.</span>
          </p>
        </Reveal>
      </HaloReveal>

      {/* § 06 — FAQ */}
      <HaloReveal as="section" delay={480} className="border-b border-border px-6 py-24 sm:py-32 md:px-12">
        <div className="mx-auto grid max-w-[1280px] grid-cols-12 gap-x-6">
          <div className="col-span-12 lg:col-span-3">
            <Reveal>
              <p className="halo-eyebrow">§ 06 &middot; Questions</p>
            </Reveal>
            <Reveal delay={80}>
              <h2 className="mt-5 max-w-xs font-display text-[clamp(24px,3vw,40px)] font-medium leading-[1.1] tracking-display text-text">
                Common questions, answered flat.
              </h2>
            </Reveal>
          </div>
          <div className="col-span-12 lg:col-span-9 lg:pl-10">
            <WebFAQ />
          </div>
        </div>
      </HaloReveal>

      {/* § 07 — CTA */}
      <HaloCTA
        eyebrow="§ 07 &middot; Begin"
        title="Tell us what the site needs to do."
        titleAccent="needs"
        sub="A thirty-minute discovery call. No slides, no pitch. You leave with a clearer picture of stack, timeline, and trade-offs — whether you hire us or not."
        primaryLabel="Start the conversation"
        primaryHref="/contact"
        secondaryLabel="Explore services"
        secondaryHref="/services"
      />

      <HaloFooter />
    </>
  );
}

function SpecColumn({
  heading,
  caption,
  rows,
}: {
  heading: string;
  caption: string;
  rows: { k: string; v: string }[];
}) {
  return (
    <div className="halo-card p-6">
      <div className="flex items-baseline justify-between border-b border-border pb-3">
        <h3 className="font-display text-[22px] font-medium tracking-display text-text">
          {heading}
        </h3>
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-text-dim">
          {caption}
        </span>
      </div>
      <dl className="mt-4 space-y-3">
        {rows.map((r) => (
          <div
            key={r.k}
            className="flex items-baseline justify-between gap-4 border-b border-border/60 pb-2 last:border-b-0"
          >
            <dt className="font-mono text-[11px] uppercase tracking-[0.14em] text-text-dim">
              {r.k}
            </dt>
            <dd className="text-right text-[13.5px] text-text-muted">{r.v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
