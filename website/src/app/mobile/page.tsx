import type { Metadata } from "next";
import Link from "next/link";
import HaloNav from "@/components/halo/HaloNav";
import HaloFooter from "@/components/halo/HaloFooter";
import HaloCTA from "@/components/halo/HaloCTA";
import HaloSectionHead from "@/components/halo/HaloSectionHead";
import PhoneMockups from "@/components/mobile-app/PhoneMockups";
import ProcessTimeline from "@/components/mobile-app/ProcessTimeline";
import MobileFAQ from "@/components/mobile-app/MobileFAQ";
import Reveal from "@/components/mobile-app/Reveal";
import HaloReveal from "@/components/halo/HaloReveal";

export const metadata: Metadata = {
  title: "Mobile App Development — Android & iOS | BLACKFYRE",
  description:
    "Release on Android, iOS, or both. Native craft where it counts, cross-platform when speed matters. Design, build, and publish to the Play Store and App Store — code, keys, and listings owned by you.",
  openGraph: {
    title: "Mobile App Development — Android & iOS | BLACKFYRE",
    description:
      "From idea to Play Store and App Store. Native, Flutter, React Native, or Kotlin Multiplatform — we help pick the stack and build it end-to-end.",
    type: "article",
  },
};

interface UseCase {
  index: string;
  label: string;
  title: string;
  body: string;
}
const USE_CASES: UseCase[] = [
  {
    index: "01",
    label: "Consumer",
    title: "A product your users live inside.",
    body: "Onboarding, payments, notifications, analytics, App Store review — the lot. The foundations new consumer apps release with in 2026, not the boilerplate of 2019.",
  },
  {
    index: "02",
    label: "Enterprise",
    title: "The app your teams open before coffee.",
    body: "Field teams, asset tracking, warehouse operations. MDM-ready, offline-first where it needs to be, hardened for the environments it actually runs in.",
  },
  {
    index: "03",
    label: "Companion",
    title: "The mobile half of your web product.",
    body: "Your customers already live on phones. We build the native companion to your SaaS with SSO, deep-links into the web app, and feature parity where it matters.",
  },
];

interface DecisionRow {
  n: string;
  if: string;
  then: string;
  note: string;
}
const DECISIONS: DecisionRow[] = [
  {
    n: "01",
    if: "Fastest path to one codebase across platforms",
    then: "Flutter or React Native",
    note: "Most teams land here.",
  },
  {
    n: "02",
    if: "Deep iOS integrations (HealthKit, ARKit, Apple Pay)",
    then: "Native Swift / SwiftUI",
    note: "Where the platform is the product.",
  },
  {
    n: "03",
    if: "Deep Android integrations (MDM, Wear OS, Automotive)",
    then: "Native Kotlin / Jetpack Compose",
    note: "Hardware-close or enterprise-fleet.",
  },
  {
    n: "04",
    if: "Enterprise internal tool, parity on both platforms",
    then: "Kotlin Multiplatform or React Native",
    note: "Shared logic, native shell.",
  },
];

interface SpecRow {
  k: string;
  v: string;
}
const SPECS: { android: SpecRow[]; ios: SpecRow[] } = {
  android: [
    { k: "Artifact", v: "Signed AAB + production keystore" },
    { k: "Listing", v: "Play Console, metadata, screenshots" },
    { k: "Billing", v: "Play Billing + subscriptions wired" },
    { k: "Telemetry", v: "Crashlytics / Play Vitals" },
    { k: "Tracks", v: "Internal, closed, open testing" },
    { k: "Cadence", v: "Release management playbook" },
  ],
  ios: [
    { k: "Artifact", v: "Signed IPA + distribution profiles" },
    { k: "Listing", v: "App Store Connect, metadata, screenshots" },
    { k: "Billing", v: "StoreKit 2 + subscriptions wired" },
    { k: "Telemetry", v: "MetricKit, Xcode Organizer" },
    { k: "Review", v: "TestFlight build for reviewers" },
    { k: "Cadence", v: "Xcode Cloud or CI pipeline" },
  ],
};

export default function MobileAppDevelopmentPage() {
  return (
    <>
      <HaloNav />

      {/* § 01 — HERO */}
      <section className="relative overflow-hidden border-b border-border bg-halo-radial px-6 pb-24 pt-24 sm:pb-32 sm:pt-32 md:px-12">
        <div className="mx-auto grid max-w-[1280px] grid-cols-1 items-center gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:gap-20">
          <div>
            <Reveal>
              <p className="halo-eyebrow">§ 01 &middot; Mobile</p>
            </Reveal>

            <Reveal delay={80}>
              <h1 className="mt-6 font-display text-[clamp(44px,6.8vw,88px)] font-medium leading-[0.98] tracking-display text-text [text-wrap:balance]">
                Release on <span className="halo-italic">iOS</span>, on{" "}
                <span className="halo-italic">Android</span>,{" "}
                <span className="text-text-muted">or on both.</span>
              </h1>
            </Reveal>

            <Reveal delay={180}>
              <p className="mt-8 max-w-lg text-[17px] leading-[1.65] text-text-muted">
                Native craft where it counts. Cross-platform when speed matters.
                We help you pick the stack that fits the product, then build it
                end-to-end — code, keys, and listings owned by you.
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

          <div className="relative">
            <PhoneMockups />
          </div>
        </div>
      </section>

      {/* § 02 — USE CASES */}
      <HaloReveal as="section" delay={0} className="border-b border-border px-6 py-24 sm:py-32 md:px-12">
        <div className="mx-auto max-w-[1280px]">
          <HaloSectionHead
            eyebrow="§ 02 &middot; Use cases"
            title="Three kinds of apps. One engineering practice."
            titleAccent="One"
          />
          <ol className="mx-auto mt-16 max-w-[1000px] divide-y divide-border border-y border-border">
            {USE_CASES.map((uc, i) => (
              <Reveal as="li" key={uc.index} delay={i * 80}>
                <article className="grid grid-cols-12 gap-x-6 gap-y-4 py-12 sm:py-16">
                  <div className="col-span-12 sm:col-span-3">
                    <p className="font-mono text-xs text-accent">{uc.index}</p>
                    <p className="halo-label mt-2">{uc.label}</p>
                  </div>
                  <div className="col-span-12 sm:col-span-9">
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

      {/* § 03 — PULL QUOTE */}
      <HaloReveal as="section" delay={120} className="relative border-b border-border bg-surface px-6 py-28 sm:py-36 md:px-12">
        <div className="mx-auto max-w-[1000px]">
          <Reveal>
            <blockquote className="mx-auto max-w-5xl text-center font-display text-[clamp(36px,5.5vw,72px)] font-medium leading-[1.05] tracking-display text-text [text-wrap:balance]">
              <span className="text-text-dim">&ldquo;</span>Your product decides
              the stack.{" "}
              <span className="block text-text-muted">
                Not the other way around.
              </span>
              <span className="text-text-dim">&rdquo;</span>
            </blockquote>
          </Reveal>
          <Reveal delay={120}>
            <p className="mt-10 flex items-center justify-center gap-3 text-text-dim">
              <span className="h-px w-8 bg-border-strong" />
              <span className="font-mono text-xs uppercase tracking-[0.22em]">
                How we pick it
              </span>
              <span className="h-px w-8 bg-border-strong" />
            </p>
          </Reveal>
        </div>
      </HaloReveal>

      {/* § 04 — DECISION MATRIX */}
      <HaloReveal as="section" delay={240} className="border-b border-border px-6 py-24 sm:py-32 md:px-12">
        <div className="mx-auto grid max-w-[1280px] grid-cols-12 gap-x-6">
          <div className="col-span-12 lg:col-span-3">
            <Reveal>
              <p className="halo-eyebrow">§ 04 &middot; Decision</p>
            </Reveal>
            <Reveal delay={120}>
              <h2 className="mt-5 font-display text-[clamp(28px,3.6vw,42px)] font-medium leading-[1.1] tracking-display text-text">
                How we pick your stack.
              </h2>
            </Reveal>
            <Reveal delay={200}>
              <p className="mt-5 max-w-[24ch] text-[15px] leading-[1.7] text-text-muted">
                Every engagement starts with a one-page decision brief after
                discovery. Here&apos;s how it tends to read.
              </p>
            </Reveal>
          </div>

          <div className="col-span-12 lg:col-span-9 lg:pl-10">
            <ol className="space-y-8">
              {DECISIONS.map((d, i) => (
                <Reveal as="li" key={d.n} delay={i * 70}>
                  <article className="halo-card halo-card-hover grid grid-cols-12 gap-x-6 p-6 sm:p-8">
                    <div className="col-span-12 sm:col-span-1">
                      <p className="font-mono text-xs text-accent">{d.n}</p>
                    </div>
                    <div className="col-span-12 sm:col-span-7">
                      <p className="halo-label">If you need</p>
                      <p className="mt-2 text-[17px] leading-[1.55] text-text">
                        {d.if}
                      </p>
                      <p className="mt-3 text-[14px] leading-[1.6] text-text-dim">
                        {d.note}
                      </p>
                    </div>
                    <div className="col-span-12 sm:col-span-4">
                      <p className="halo-label">We build in</p>
                      <p className="mt-2 font-display text-[20px] leading-[1.2] tracking-display text-text">
                        {d.then}
                      </p>
                    </div>
                  </article>
                </Reveal>
              ))}
            </ol>
          </div>
        </div>
      </HaloReveal>

      {/* § 05 — PROCESS */}
      <HaloReveal as="section" delay={360} className="border-b border-border px-6 py-24 sm:py-32 md:px-12">
        <div className="mx-auto max-w-[1000px]">
          <HaloSectionHead
            eyebrow="§ 05 &middot; Process"
            title="A working build on your phone by the second week."
            titleAccent="working"
            blurb="Discovery to post-launch, linear and unfussy. No fixed-price theatre, no hidden change-requests — you see the build in your own TestFlight and Play Console from week two."
          />
          <div className="mt-16">
            <ProcessTimeline />
          </div>
        </div>
      </HaloReveal>

      {/* § 06 — DELIVERABLES */}
      <HaloReveal as="section" delay={480} className="border-b border-border bg-surface px-6 py-24 sm:py-32 md:px-12">
        <div className="mx-auto max-w-[1280px]">
          <div className="grid grid-cols-12 gap-x-6">
            <div className="col-span-12 lg:col-span-4">
              <Reveal>
                <p className="halo-eyebrow">§ 06 &middot; Deliverables</p>
              </Reveal>
              <Reveal delay={80}>
                <h2 className="mt-5 font-display text-[clamp(28px,3.6vw,42px)] font-medium leading-[1.1] tracking-display text-text">
                  Both stores.{" "}
                  <span className="text-text-muted">Both signed.</span>{" "}
                  <span className="text-text-dim">Both in your name.</span>
                </h2>
              </Reveal>
              <Reveal delay={160}>
                <p className="mt-6 max-w-sm text-[15px] leading-[1.7] text-text-muted">
                  A literal handover list. Source in your repo, signing keys in
                  your vault, listings on your accounts.
                </p>
              </Reveal>
            </div>

            <div className="col-span-12 lg:col-span-8 lg:pl-10">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-8">
                <Reveal>
                  <SpecColumn platform="iOS" rows={SPECS.ios} />
                </Reveal>
                <Reveal delay={120}>
                  <SpecColumn platform="Android" rows={SPECS.android} />
                </Reveal>
              </div>

              <Reveal delay={220}>
                <p className="mt-10 text-[14px] leading-[1.7] text-text-dim">
                  <span className="font-mono text-xs uppercase tracking-[0.18em] text-text-muted">
                    Engagement
                  </span>
                  <span className="mx-3 text-border-strong">·</span>
                  Fixed-scope. Prototype, cross-platform MVP, or native
                  production — quoted after discovery.{" "}
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
            <span className="text-text-muted">Keys in your vault.</span>{" "}
            <span className="text-text-dim">Listings in your name.</span>
          </p>
        </Reveal>
      </HaloReveal>

      {/* § 07 — FAQ */}
      <HaloReveal as="section" delay={480} className="border-b border-border px-6 py-24 sm:py-32 md:px-12">
        <div className="mx-auto grid max-w-[1280px] grid-cols-12 gap-x-6">
          <div className="col-span-12 lg:col-span-3">
            <Reveal>
              <p className="halo-eyebrow">§ 07 &middot; Questions</p>
            </Reveal>
            <Reveal delay={80}>
              <h2 className="mt-5 max-w-xs font-display text-[clamp(24px,3vw,40px)] font-medium leading-[1.1] tracking-display text-text">
                The honest answers, before the call.
              </h2>
            </Reveal>
          </div>
          <div className="col-span-12 lg:col-span-9 lg:pl-10">
            <MobileFAQ />
          </div>
        </div>
      </HaloReveal>

      {/* § 08 — CTA */}
      <HaloCTA
        eyebrow="§ 08 &middot; Begin"
        title="Let's figure out what to build, and how to build it."
        titleAccent="how"
        sub="A thirty-minute call. No slides, no pitch. You leave with a clearer picture of stack, timeline, and trade-offs — whether you hire us or not."
        primaryLabel="Book a discovery call"
        primaryHref="/contact"
        secondaryLabel="Explore services"
        secondaryHref="/services"
      />

      <HaloFooter />
    </>
  );
}

function SpecColumn({
  platform,
  rows,
}: {
  platform: string;
  rows: { k: string; v: string }[];
}) {
  return (
    <div className="halo-card p-6">
      <div className="flex items-baseline justify-between border-b border-border pb-3">
        <h3 className="font-display text-[22px] font-medium tracking-display text-text">
          {platform}
        </h3>
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-text-dim">
          {platform === "iOS" ? "App Store" : "Play Store"}
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
