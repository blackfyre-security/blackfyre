import type { Metadata } from "next";
import {
  Sparkles,
  Terminal,
  KeyRound,
  Users,
  Server,
  Layers,
  BookOpen,
  FileCheck2,
  Check,
  ArrowUpRight,
} from "lucide-react";

import HaloNav from "@/components/halo/HaloNav";
import HaloFooter from "@/components/halo/HaloFooter";

import Section from "@/components/vibrant/Section";
import SectionHead from "@/components/vibrant/SectionHead";
import StatRow from "@/components/vibrant/StatRow";
import IconTile from "@/components/vibrant/IconTile";
import LogoRow from "@/components/vibrant/LogoRow";
import { FeatureCardLight } from "@/components/vibrant/Cards";
import { DeviceCluster } from "@/components/vibrant/Mockups";
import { LimeButton, GhostButton, GitHubIcon } from "@/components/vibrant/buttons";

import CopyBlock from "./CopyBlock";

import { SITE, QUICKSTART, DOCS, type DocLink } from "@/data/site";
import { AUDITOR_COUNT } from "@/data/auditors";
import { TOTAL_CONTROLS, FRAMEWORK_COUNT } from "@/data/frameworks";

export const metadata: Metadata = {
  title: "Self-host — Blackfyre",
  description:
    "Run Blackfyre yourself, free forever under Apache-2.0. Evaluate locally on Docker Compose with no cloud account or keys, or deploy to your own AWS via SST 4.13.",
};

/* ── docs registry lookups ──────────────────────────────────────────────── */
function doc(title: string): DocLink | undefined {
  return DOCS.find((d) => d.title === title);
}
const SELF_HOSTING_DOC = doc("Self-hosting Blackfyre");
const LOCAL_DEV_DOC = doc("Local development");
const DEPLOYMENT_DOC = doc("Deployment");

const DOCS_HREF = SELF_HOSTING_DOC?.url ?? SITE.repoUrl;
const LOCAL_HREF = LOCAL_DEV_DOC?.url ?? SITE.repoUrl;

const GUIDE_DOCS: readonly DocLink[] = [
  "Local development",
  "Self-hosting Blackfyre",
  "Architecture",
  "Configuration (bring your own credentials)",
  "Deployment",
]
  .map(doc)
  .filter((d): d is DocLink => Boolean(d));

/* ── hero value tiles ───────────────────────────────────────────────────── */
const TILES = [
  {
    icon: Terminal,
    title: "No cloud account",
    desc: "The whole stack runs locally on Docker Compose — Postgres, Redis and LocalStack.",
    accent: "blue" as const,
  },
  {
    icon: KeyRound,
    title: "No API keys",
    desc: "AI features degrade to deterministic heuristics when no key is set.",
    accent: "purple" as const,
  },
  {
    icon: Users,
    title: "No seats or gates",
    desc: `Every one of ${AUDITOR_COUNT} auditors, ${FRAMEWORK_COUNT} frameworks and ${TOTAL_CONTROLS} controls — unlocked.`,
    accent: "emerald" as const,
  },
  {
    icon: Server,
    title: "Your infrastructure",
    desc: "Deploy the backend into your own AWS account via SST when you're ready.",
    accent: "blue" as const,
  },
];

const QUICKSTART_BULLETS = [
  "No cloud account or API keys needed",
  "Postgres, Redis & LocalStack via Docker Compose",
  "Seeded dev login — admin@acme.com / password123",
  "Portal :3001 · Admin :3003 · API :4000",
];

export default function SelfHostPage() {
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
              eyebrow="Self-host · Apache-2.0"
              eyebrowIcon={<Sparkles className="h-3.5 w-3.5" />}
              title={<>Run it yourself.<br /></>}
              accentWord="Free forever."
              sub={
                <>
                  Blackfyre is open source under Apache-2.0 — the entire platform, all{" "}
                  <strong className="font-semibold text-zinc-900">{AUDITOR_COUNT} auditors</strong>,{" "}
                  {FRAMEWORK_COUNT} frameworks and {TOTAL_CONTROLS} controls. Evaluate it locally on
                  Docker Compose with no cloud account or keys, or deploy it to your own AWS. No seats,
                  no feature gates, no expiry.
                </>
              }
            />
            <div className="mt-8 flex flex-wrap gap-3">
              <LimeButton href={SITE.repoUrl} external icon={<GitHubIcon />}>
                Star on GitHub
              </LimeButton>
              <GhostButton href={DOCS_HREF} external icon={<BookOpen className="h-4 w-4" />}>
                Read the docs
              </GhostButton>
            </div>

            <StatRow
              className="mt-10"
              kicker="What self-hosting gets you"
              stats={[
                { value: "$0", label: "To run" },
                { value: String(AUDITOR_COUNT), label: "Auditors" },
                { value: String(FRAMEWORK_COUNT), label: "Frameworks" },
                { value: String(TOTAL_CONTROLS), label: "Controls", color: "text-blue-600" },
              ]}
            />

            <div className="mt-8 grid gap-1 sm:grid-cols-2">
              {TILES.map((t) => (
                <IconTile key={t.title} icon={t.icon} title={t.title} desc={t.desc} accent={t.accent} />
              ))}
            </div>
          </div>

          <div className="hidden lg:block">
            <DeviceCluster />
          </div>
        </div>

        <LogoRow
          label="Runs on"
          items={[
            "Docker Compose",
            "LocalStack",
            "Node 20",
            "PostgreSQL 16",
            "AWS · SST 4.13",
            "Cloudflare Pages",
          ]}
        />
      </Section>

      {/* ── QUICKSTART · dark · lime ────────────────────────────────────── */}
      <Section id="quickstart" variant="dark">
        <div className="grid gap-16 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <SectionHead
              accent="lime"
              on="dark"
              eyebrow="Quickstart"
              eyebrowIcon={<Terminal className="h-3.5 w-3.5" />}
              title="Up and running in"
              accentWord="one paste."
              sub="The full local stack — no cloud account or API keys. Clone, start the services, run the migrations, and log in as the seeded dev user. Roughly fifteen minutes."
            />
            <ul className="mt-8 space-y-3">
              {QUICKSTART_BULLETS.map((b) => (
                <li key={b} className="flex items-start gap-3">
                  <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-lime-300" strokeWidth={2.2} />
                  <span className="text-sm leading-relaxed text-zinc-300">{b}</span>
                </li>
              ))}
            </ul>
            <div className="mt-8">
              <GhostButton href={LOCAL_HREF} external on="dark">
                Local development guide
              </GhostButton>
            </div>
          </div>

          <div>
            <CopyBlock code={QUICKSTART} />
            <p className="mt-4 text-center font-mono text-[11.5px] leading-relaxed text-zinc-500">
              No cloud account or API keys needed · prerequisites: Node 20, Docker + Compose, Git.
            </p>
          </div>
        </div>
      </Section>

      {/* ── TWO WAYS TO RUN IT · warm · amber ───────────────────────────── */}
      <Section variant="warm">
        <div className="mx-auto max-w-[720px] text-center">
          <SectionHead
            align="center"
            accent="amber"
            on="light"
            eyebrow="Two ways to run it"
            eyebrowIcon={<Layers className="h-3.5 w-3.5" />}
            title="Evaluate locally, or deploy to"
            accentWord="your own AWS."
            accentStyle="solid"
            sub="Both tiers run the exact same open-source codebase. Start on your laptop for free, move to your own cloud when you're ready."
            className="items-center"
          />
        </div>

        <div className="mt-14 grid gap-6 lg:grid-cols-2">
          <FeatureCardLight
            kicker="A · Local / evaluation"
            title="Docker Compose, on your laptop"
            desc="Bring the whole stack up locally — Postgres, Redis and LocalStack — with no AWS account and no API keys. Seeded dev login admin@acme.com / password123. Ideal for evaluating, developing, or contributing."
            thumb={
              <div className="text-center">
                <p className="font-mono text-3xl font-extrabold text-amber-700">$0</p>
                <p className="mt-1 font-mono text-[9px] uppercase tracking-wide text-zinc-500">to run</p>
              </div>
            }
            stats={[
              { label: "Setup", value: "~15 min" },
              { label: "Cost", value: "$0" },
              { label: "Cloud", value: "None" },
            ]}
            linkLabel="Local dev guide"
            linkHref={LOCAL_HREF}
          />

          <FeatureCardLight
            kicker="B · Production · your AWS"
            title="Deploy to your own AWS via SST 4.13"
            desc="Provision the backend into an account you own — Lambda, RDS (Postgres 16), SQS (4 + 4 DLQ), S3 Object Lock, KMS, Secrets Manager and ECR — with static portal & admin on Cloudflare Pages. 11 SST-managed secrets per stage. Self-provisioned: the project doesn't run a managed cloud with SLAs."
            thumb={
              <div className="text-center">
                <p className="font-mono text-3xl font-extrabold text-amber-700">SST</p>
                <p className="mt-1 font-mono text-[9px] uppercase tracking-wide text-zinc-500">your aws</p>
              </div>
            }
            stats={[
              { label: "Staging", value: "~$56/mo" },
              { label: "Prod idle", value: "~$80/mo" },
              { label: "Secrets", value: "11/stage" },
            ]}
            linkLabel="Self-hosting guide"
            linkHref={SELF_HOSTING_DOC?.url ?? SITE.repoUrl}
          />
        </div>

        <p className="mt-6 text-center font-sans text-[13px] leading-relaxed text-zinc-500">
          You provision production into your own AWS + Cloudflare accounts — rough idle costs, not a
          managed service.{" "}
          {DEPLOYMENT_DOC ? (
            <a
              href={DEPLOYMENT_DOC.url}
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-amber-700 underline-offset-2 hover:underline"
            >
              See the deployment guide
            </a>
          ) : (
            "See the deployment guide."
          )}
        </p>
      </Section>

      {/* ── READ THE DOCS · light · purple ──────────────────────────────── */}
      <Section variant="light">
        <SectionHead
          accent="purple"
          on="light"
          eyebrow="Read the docs"
          eyebrowIcon={<BookOpen className="h-3.5 w-3.5" />}
          title="Everything the guide"
          accentWord="walks you through."
        />
        <div className="mt-12 grid gap-4 md:grid-cols-2">
          {GUIDE_DOCS.map((d) => (
            <a
              key={d.title}
              href={d.url}
              target="_blank"
              rel="noreferrer"
              className="group flex flex-col rounded-2xl border border-zinc-200/80 bg-white p-6 transition-all duration-300 hover:-translate-y-0.5 hover:border-purple-200 hover:shadow-lg"
            >
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-lg font-bold text-zinc-900">{d.title}</h3>
                <ArrowUpRight className="mt-1 h-4 w-4 flex-shrink-0 text-zinc-400 transition-colors group-hover:text-purple-600" />
              </div>
              {d.blurb && (
                <p className="mt-2 text-xs leading-relaxed text-zinc-500">{d.blurb}</p>
              )}
            </a>
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
            eyebrowIcon={<FileCheck2 className="h-3.5 w-3.5" />}
            title="Clone it and"
            accentWord="run it today."
            sub="Apache-2.0 and free forever to self-host — up and evaluating locally in about fifteen minutes, then deploy to your own AWS when you're ready."
            className="items-center"
          />
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <LimeButton href={SITE.repoUrl} external icon={<GitHubIcon />}>
              Star on GitHub
            </LimeButton>
            <GhostButton href="#quickstart" on="dark">
              Get the quickstart
            </GhostButton>
          </div>
        </div>
      </Section>

      <HaloFooter />
    </>
  );
}
