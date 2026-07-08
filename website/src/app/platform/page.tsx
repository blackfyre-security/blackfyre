import type { Metadata } from "next";
import type { ComponentType, ReactNode } from "react";
import Link from "next/link";
import {
  Sparkles,
  Workflow,
  Laptop,
  Server,
  Database,
  Cpu,
  ScanLine,
  Lock,
  Cloud,
  ShieldCheck,
  FileCheck2,
  FileCheck,
  KeyRound,
  Layers,
  ArrowUpRight,
} from "lucide-react";

import HaloNav from "@/components/halo/HaloNav";
import HaloFooter from "@/components/halo/HaloFooter";

import Section from "@/components/vibrant/Section";
import SectionHead from "@/components/vibrant/SectionHead";
import StatRow from "@/components/vibrant/StatRow";
import IconTile from "@/components/vibrant/IconTile";
import LogoRow from "@/components/vibrant/LogoRow";
import { CaseStudyCardDark } from "@/components/vibrant/Cards";
import { DeviceCluster } from "@/components/vibrant/Mockups";
import { LimeButton, GhostButton, GitHubIcon } from "@/components/vibrant/buttons";
import { type Accent } from "@/components/vibrant/accents";

import { SITE, DOCS } from "@/data/site";
import { AUDITOR_COUNT } from "@/data/auditors";
import { FRAMEWORKS, TOTAL_CONTROLS, FRAMEWORK_COUNT } from "@/data/frameworks";

export const metadata: Metadata = {
  title: "Platform — Blackfyre",
  description:
    "A product tour of Blackfyre: 55 auditors across AWS, Azure, GCP and on-prem mapped to 9 frameworks and 678 controls, with a tamper-evident evidence vault. Open source, Apache-2.0.",
};

const docUrl = (title: string) =>
  DOCS.find((d) => d.title === title)?.url ?? SITE.repoUrl;

const architectureDoc = docUrl("Architecture");
const selfHostDoc = docUrl("Self-hosting Blackfyre");
const securityDoc = docUrl("Security Policy");

/* ── tiny mono card illustrations (on #09090e) ──────────────────────────── */
const IllRow = ({ k, v, c }: { k: string; v: string; c: string }) => (
  <div className="flex items-center justify-between font-mono text-[9px]">
    <span className="text-zinc-500">{k}</span>
    <span className={c}>{v}</span>
  </div>
);

const FrontendsIll = () => (
  <div className="w-full space-y-1.5 px-4">
    <IllRow k="portal" v=":3001 · static" c="text-blue-400" />
    <IllRow k="admin" v=":3003 · static" c="text-blue-400" />
    <IllRow k="host" v="cloudflare pages" c="text-zinc-400" />
  </div>
);
const ApiIll = () => (
  <div className="w-full space-y-1.5 px-4">
    <IllRow k="fastify 4" v=":4000" c="text-purple-400" />
    <IllRow k="every req" v="jwt · csrf" c="text-purple-400" />
    <IllRow k="db handle" v="rls-scoped" c="text-zinc-400" />
  </div>
);
const DataIll = () => (
  <div className="w-full space-y-1.5 px-4">
    <IllRow k="postgres 16" v="force rls" c="text-pink-400" />
    <IllRow k="queues" v="4 sqs + 4 dlq" c="text-pink-400" />
    <IllRow k="adr" v="0001 · 0002" c="text-zinc-400" />
  </div>
);
const WorkersIll = () => (
  <div className="w-full space-y-1.5 px-4">
    <IllRow k="drains" v="scan · monitor" c="text-blue-400" />
    <IllRow k="+ ai" v="+ evidence" c="text-blue-400" />
    <IllRow k="delivery" v="at-least-once" c="text-zinc-400" />
  </div>
);
const ScannersIll = () => (
  <div className="w-full space-y-1.5 px-4">
    <IllRow k="sdk auditors" v="55 · in-proc" c="text-purple-400" />
    <IllRow k="prowler" v="container λ" c="text-purple-400" />
    <IllRow k="adr" v="0003" c="text-zinc-400" />
  </div>
);
const EvidenceIll = () => (
  <div className="w-full space-y-1.5 px-4">
    <IllRow k="s3 object lock" v="✓ worm" c="text-emerald-400" />
    <IllRow k="sha-256" v="9f2a…e71c" c="text-emerald-400" />
    <IllRow k="pii" v="aes-256-gcm" c="text-zinc-400" />
  </div>
);

interface Stage {
  badge: string;
  icon: ComponentType<{ className?: string }>;
  title: string;
  desc: string;
  accent: Accent;
  ill: ReactNode;
}

const PIPELINE: readonly Stage[] = [
  {
    badge: "01 · FRONTENDS",
    icon: Laptop,
    title: "Portal + Admin",
    desc: "Next.js static exports — Portal and Admin — served from Cloudflare Pages. No server, nothing to patch.",
    accent: "blue",
    ill: <FrontendsIll />,
  },
  {
    badge: "02 · API",
    icon: Server,
    title: "Fastify gateway",
    desc: "Fastify on :4000. Every request is JWT + CSRF authenticated and bound to an RLS-scoped database handle.",
    accent: "purple",
    ill: <ApiIll />,
  },
  {
    badge: "03 · DATA PLANE",
    icon: Database,
    title: "Postgres · Redis · SQS",
    desc: "Postgres 16 with row-level security, Redis, and four SQS work queues — each paired with a dead-letter queue.",
    accent: "pink",
    ill: <DataIll />,
  },
  {
    badge: "04 · WORKERS",
    icon: Cpu,
    title: "Queue consumers",
    desc: "SQS-triggered Lambda workers drain the scan, monitor, AI and evidence queues — at-least-once and idempotent.",
    accent: "blue",
    ill: <WorkersIll />,
  },
  {
    badge: "05 · SCANNERS",
    icon: ScanLine,
    title: "Auditors + tools",
    desc: "Lightweight SDK auditors run in-process; Prowler and the IaC scanners (Checkov / Semgrep / Bandit) run as container Lambdas.",
    accent: "purple",
    ill: <ScannersIll />,
  },
  {
    badge: "06 · EVIDENCE",
    icon: Lock,
    title: "S3 evidence vault",
    desc: "Artifacts land in S3 with Object Lock + versioning (WORM), a SHA-256 hash per item, and AES-256-GCM for PII.",
    accent: "emerald",
    ill: <EvidenceIll />,
  },
];

interface Feature {
  icon: ComponentType<{ className?: string }>;
  title: string;
  desc: string;
  accent: Accent;
}

const FEATURES: readonly Feature[] = [
  {
    icon: Cloud,
    title: "Multi-cloud scanning",
    desc: "55 auditors across AWS, Azure, GCP and on-prem, plus Prowler and the IaC scanners Checkov, Semgrep and Bandit.",
    accent: "blue",
  },
  {
    icon: FileCheck2,
    title: "Framework mapping",
    desc: "Every finding maps to the controls it affects across 9 frameworks, with weighted per-framework scoring.",
    accent: "purple",
  },
  {
    icon: Cpu,
    title: "AI-assisted analysis",
    desc: "Gap analysis, MITRE ATT&CK mapping and remediation via Claude or Bedrock — degrades to deterministic heuristics with no key.",
    accent: "pink",
  },
  {
    icon: ShieldCheck,
    title: "Tamper-evident evidence",
    desc: "SHA-256 per item, S3 Object Lock + versioning (WORM), and AES-256-GCM field encryption for PII.",
    accent: "emerald",
  },
  {
    icon: ScanLine,
    title: "Real-time drift",
    desc: "Continuous drift detection catches regressions after a passing scan; live scan progress streams over Server-Sent Events.",
    accent: "blue",
  },
  {
    icon: Server,
    title: "Database-enforced tenancy",
    desc: "Postgres 16 row-level security below the ORM, request-scoped and fails closed (ADR-0001).",
    accent: "purple",
  },
  {
    icon: KeyRound,
    title: "Enterprise auth",
    desc: "JWT + MFA, Google SSO, SAML, SCIM, Argon2id API keys, auditor-scoped roles and CSRF double-submit.",
    accent: "pink",
  },
  {
    icon: Workflow,
    title: "Durable scanning",
    desc: "Scan, monitor, AI and evidence each get an SQS queue plus a DLQ, drained by idempotent Lambda workers (ADR-0002 / 0003).",
    accent: "emerald",
  },
];

interface AuthItem {
  label: string;
  detail: string;
}

const AUTH_MODEL: readonly AuthItem[] = [
  { label: "JWT + MFA sessions", detail: "Signed with jose; MFA on top of password login." },
  { label: "Google SSO · SAML · SCIM", detail: "Federated login and directory-driven provisioning." },
  { label: "API keys (Argon2id)", detail: "Programmatic access; keys hashed with Argon2id at rest." },
  { label: "Auditor-scoped roles", detail: "owner / admin / engineer / viewer / auditor." },
  { label: "Database-enforced RLS", detail: "Row-level security below the ORM; fails closed (ADR-0001)." },
  { label: "CSRF double-submit", detail: "Every state-changing request is CSRF-protected." },
  { label: "Read-only scan access", detail: "Cross-account IAM role is read-only, least-privilege — no write keys." },
  { label: "Minimum-data collection", detail: "Scanners collect posture data only — never PII or customer records." },
];

export default function PlatformPage() {
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
              eyebrow="§ 01 · The platform"
              eyebrowIcon={<Sparkles className="h-3.5 w-3.5" />}
              title={
                <>
                  The whole compliance stack,
                  <br />
                  built{" "}
                </>
              }
              accentWord="in the open."
              sub={
                <>
                  Blackfyre maps your multi-cloud and on-prem posture to{" "}
                  {FRAMEWORK_COUNT} compliance frameworks, stores tamper-evident
                  evidence, and ships as source you run yourself.{" "}
                  <strong className="font-semibold text-zinc-900">
                    {AUDITOR_COUNT} auditors, {TOTAL_CONTROLS} controls, one runtime
                  </strong>{" "}
                  — Apache-2.0.
                </>
              }
            />
            <div className="mt-8 flex flex-wrap gap-3">
              <LimeButton href={SITE.repoUrl} external icon={<GitHubIcon />}>
                Star on GitHub
              </LimeButton>
              <GhostButton href={architectureDoc} external>
                Read the architecture
              </GhostButton>
            </div>

            <StatRow
              className="mt-10"
              kicker="What ships in the box"
              stats={[
                { value: String(AUDITOR_COUNT), label: "Auditors" },
                { value: String(FRAMEWORK_COUNT), label: "Frameworks" },
                { value: String(TOTAL_CONTROLS), label: "Controls", color: "text-blue-600" },
                { value: "Free", label: "Apache-2.0" },
              ]}
            />
          </div>

          <div className="hidden lg:block">
            <DeviceCluster />
          </div>
        </div>

        <LogoRow
          label="Built on"
          items={["Next.js", "Fastify", "PostgreSQL · RLS", "Drizzle", "AWS · SST", "Cloudflare", "Claude / Bedrock"]}
        />
      </Section>

      {/* ── ARCHITECTURE · dark · violet→pink→blue ──────────────────────── */}
      <Section variant="dark">
        <SectionHead
          accent="purple"
          on="dark"
          eyebrow="§ 02 · Architecture"
          eyebrowIcon={<Workflow className="h-3.5 w-3.5" />}
          title="One request pipeline,"
          accentWord="end to end."
          sub="Static frontends talk to a Fastify API; the API writes to Postgres and enqueues work; Lambda workers drain the queues, run the scanners, and land tamper-evident evidence in S3."
        />
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {PIPELINE.map((s) => (
            <CaseStudyCardDark
              key={s.badge}
              badge={s.badge}
              icon={s.icon}
              title={s.title}
              desc={s.desc}
              accent={s.accent}
              illustration={s.ill}
              linkLabel="Read the architecture"
              linkHref={architectureDoc}
            />
          ))}
        </div>
        <p className="mt-8 max-w-[760px] text-sm leading-relaxed text-zinc-400">
          Locally, the whole thing runs on docker-compose with LocalStack — no cloud
          account or API keys required. For production it deploys to your own AWS
          account via SST 4.13; that path is fully documented but is not yet a
          hosted, managed service.
        </p>
      </Section>

      {/* ── POSTURE SIGNALS + FRAMEWORKS · warm · amber ─────────────────── */}
      <Section variant="warm">
        <SectionHead
          accent="amber"
          on="light"
          eyebrow="§ 03 · Capabilities"
          eyebrowIcon={<Layers className="h-3.5 w-3.5" />}
          title="Every posture signal,"
          accentWord="one runtime."
          accentStyle="solid"
          sub="Scanning, framework mapping, AI analysis, evidence, drift, tenancy, auth and durable background work — each built to what an external auditor would demand."
        />
        <div className="mt-10 grid gap-1 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <IconTile
              key={f.title}
              icon={f.icon}
              title={f.title}
              desc={f.desc}
              accent={f.accent}
            />
          ))}
        </div>

        {/* Frameworks block — anchored at /platform#frameworks */}
        <div id="frameworks" className="scroll-mt-28 pt-20">
          <div className="border-t border-zinc-200 pt-14">
            <SectionHead
              accent="amber"
              on="light"
              eyebrow="§ Frameworks"
              eyebrowIcon={<FileCheck className="h-3.5 w-3.5" />}
              title="Every framework you're"
              accentWord="accountable to."
              accentStyle="solid"
              sub={
                <>
                  {FRAMEWORK_COUNT} frameworks · {TOTAL_CONTROLS} controls. A single
                  finding maps to the controls it affects across every one, each
                  scored on its own weighted terms.
                </>
              }
            />
            <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {FRAMEWORKS.map((fw) => {
                const inner = (
                  <>
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-lg font-bold tracking-tight text-zinc-900">
                        {fw.short}
                      </span>
                      <span className="shrink-0 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                        {fw.controls} controls
                      </span>
                    </div>
                    <p className="mt-1.5 font-mono text-[10px] uppercase tracking-wide text-zinc-400">
                      {fw.name}
                    </p>
                    <p className="mt-3 flex-1 text-xs leading-relaxed text-zinc-500">
                      {fw.summary}
                    </p>
                    {fw.slug && (
                      <span className="mt-4 inline-flex items-center gap-1 font-mono text-[11px] font-semibold uppercase tracking-wide text-amber-700">
                        View mapping
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      </span>
                    )}
                  </>
                );
                return fw.slug ? (
                  <Link
                    key={fw.key}
                    href={fw.slug}
                    className="flex flex-col rounded-2xl border border-zinc-200/80 bg-white p-6 transition-all duration-300 hover:-translate-y-0.5 hover:border-amber-300 hover:shadow-lg"
                  >
                    {inner}
                  </Link>
                ) : (
                  <article
                    key={fw.key}
                    className="flex flex-col rounded-2xl border border-zinc-200/80 bg-white p-6"
                  >
                    {inner}
                  </article>
                );
              })}
            </div>
          </div>
        </div>
      </Section>

      {/* ── AUTH & SECURITY · dark · blue ───────────────────────────────── */}
      <Section variant="dark">
        <div className="grid gap-14 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div className="lg:sticky lg:top-12">
            <SectionHead
              accent="blue"
              on="dark"
              eyebrow="§ 04 · Auth & security"
              eyebrowIcon={<Lock className="h-3.5 w-3.5" />}
              title="A security model"
              accentWord="auditors recognize."
              sub="Identity, tenancy and least-privilege access aren't add-ons — they're wired through every request, every queue and every scan."
            />
            <p className="mt-8 text-sm leading-relaxed text-zinc-400">
              Found a vulnerability? Blackfyre runs a private disclosure process —
              see{" "}
              <a
                href={securityDoc}
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-blue-400 underline decoration-blue-900 underline-offset-4 hover:decoration-blue-400"
              >
                SECURITY.md
              </a>
              .
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-900 bg-zinc-950 p-2">
            <div className="grid grid-cols-1 gap-x-8 sm:grid-cols-2">
              {AUTH_MODEL.map((item) => (
                <div
                  key={item.label}
                  className="flex items-start gap-3 border-b border-zinc-900 p-4 last:border-b-0 sm:[&:nth-last-child(2)]:border-b-0"
                >
                  <span
                    aria-hidden
                    className="mt-0.5 select-none font-mono text-sm font-bold text-blue-400"
                  >
                    ✓
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-white">{item.label}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-zinc-400">
                      {item.detail}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <p className="mt-6 font-sans text-sm leading-[1.6] text-text-muted">
            Found a vulnerability? Blackfyre runs a private disclosure process —
            see{" "}
            <a
              href={
                DOCS.find((d) => d.title === "Security Policy")?.url ??
                SITE.repoUrl
              }
              target="_blank"
              rel="noreferrer"
              className="text-accent underline decoration-border underline-offset-4 hover:decoration-accent"
            >
              SECURITY.md
            </a>
            .
          </p>
        </div>
      </Section>

      {/* ── GET STARTED · dark · lime ───────────────────────────────────── */}
      <Section variant="dark" orbs={false}>
        <div className="mx-auto max-w-[720px] text-center">
          <SectionHead
            accent="lime"
            on="dark"
            align="center"
            eyebrow="§ Get the source"
            eyebrowIcon={<FileCheck2 className="h-3.5 w-3.5" />}
            title="Read the code."
            accentWord="Run it yourself."
            sub="Blackfyre is Apache-2.0 — clone it, self-host it, and audit every line. The full stack runs locally on Docker Compose with no cloud account or API keys. No sales call required."
          />
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <LimeButton href={SITE.repoUrl} external icon={<GitHubIcon />}>
              Star on GitHub
            </LimeButton>
            <GhostButton href={selfHostDoc} external on="dark">
              Self-hosting guide
            </GhostButton>
          </div>
        </div>
      </Section>

      <HaloFooter />
    </>
  );
}
