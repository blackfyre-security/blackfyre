import type { Metadata } from "next";
import {
  Sparkles,
  Cloud,
  Cpu,
  ShieldCheck,
  Server,
  ScanLine,
  KeyRound,
  FileCheck2,
} from "lucide-react";

import HaloNav from "@/components/halo/HaloNav";
import HaloFooter from "@/components/halo/HaloFooter";
import QuickstartInstall from "@/components/halo/QuickstartInstall";

import Section from "@/components/vibrant/Section";
import SectionHead from "@/components/vibrant/SectionHead";
import StatRow from "@/components/vibrant/StatRow";
import IconTile from "@/components/vibrant/IconTile";
import LogoRow from "@/components/vibrant/LogoRow";
import CTABanner from "@/components/vibrant/CTABanner";
import StepTimeline from "@/components/vibrant/StepTimeline";
import { CaseStudyCardDark, FeatureCardLight } from "@/components/vibrant/Cards";
import { DeviceCluster } from "@/components/vibrant/Mockups";
import { Parallax } from "@/components/vibrant/motion";
import { LimeButton, GhostButton, GitHubIcon } from "@/components/vibrant/buttons";

import { SITE } from "@/data/site";
import { AUDITOR_COUNT } from "@/data/auditors";
import { FRAMEWORKS, FRAMEWORK_COUNT, TOTAL_CONTROLS } from "@/data/frameworks";

export const metadata: Metadata = {
  title: "Blackfyre — Open-source multi-cloud compliance & security platform",
  description:
    "Scan AWS, Azure & GCP against 678 controls across 9 frameworks with 55 auditors, AI-assisted analysis, and a tamper-evident evidence vault. Apache-2.0 — self-host free.",
};

/* ── tiny card illustrations (mono, on #09090e) ─────────────────────────── */
const IllRow = ({ k, v, c }: { k: string; v: string; c: string }) => (
  <div className="flex items-center justify-between font-mono text-[9px]">
    <span className="text-zinc-500">{k}</span>
    <span className={c}>{v}</span>
  </div>
);
const CloudScanIll = () => (
  <div className="w-full space-y-1.5 px-4">
    <IllRow k="aws" v="✓ 15 auditors" c="text-blue-400" />
    <IllRow k="azure" v="✓ 11 auditors" c="text-blue-400" />
    <IllRow k="gcp" v="✓ 10 auditors" c="text-blue-400" />
    <IllRow k="on-prem" v="✓ AD · SNMP" c="text-zinc-400" />
  </div>
);
const AiIll = () => (
  <div className="w-full space-y-1.5 px-4">
    <IllRow k="gap analysis" v="claude / bedrock" c="text-purple-400" />
    <IllRow k="mitre att&ck" v="mapped" c="text-purple-400" />
    <IllRow k="no api key" v="→ heuristics" c="text-zinc-400" />
  </div>
);
const EvidenceIll = () => (
  <div className="w-full space-y-1.5 px-4">
    <IllRow k="sha-256" v="9f2a…e71c" c="text-emerald-400" />
    <IllRow k="s3 object lock" v="✓ WORM" c="text-emerald-400" />
    <IllRow k="pii" v="aes-256-gcm" c="text-zinc-400" />
  </div>
);
const RlsIll = () => (
  <div className="w-full space-y-1.5 px-4">
    <IllRow k="postgres 16" v="FORCE RLS" c="text-blue-400" />
    <IllRow k="tenant bind" v="per-request" c="text-blue-400" />
    <IllRow k="on breach" v="fails closed" c="text-zinc-400" />
  </div>
);

const CAPABILITIES = [
  { icon: Cloud, title: "Multi-cloud scanning", desc: "55 auditors across AWS, Azure, GCP and on-prem — plus Prowler & IaC scanners.", accent: "blue" as const, badge: "SCANNING", ill: <CloudScanIll />, tile: "Scan every layer of AWS, Azure & GCP." },
  { icon: Cpu, title: "AI, with a floor", desc: "Gap analysis & remediation via Claude or Bedrock — degrades to deterministic heuristics with no key.", accent: "purple" as const, badge: "ANALYSIS", ill: <AiIll />, tile: "Claude/Bedrock analysis, heuristic fallback." },
  { icon: ShieldCheck, title: "Tamper-evident evidence", desc: "SHA-256 integrity per item, S3 Object Lock + versioning, AES-256-GCM for PII.", accent: "emerald" as const, badge: "EVIDENCE", ill: <EvidenceIll />, tile: "Evidence an auditor can trust." },
  { icon: Server, title: "Database-enforced tenancy", desc: "Postgres row-level security below the ORM, request-scoped and fails closed.", accent: "blue" as const, badge: "MULTI-TENANCY", ill: <RlsIll />, tile: "Isolation enforced by the database." },
];

const STEPS = [
  { n: "01", title: "Connect a read-only role", desc: "A cross-account IAM role — read-only, no write keys. Blackfyre never mutates your infrastructure." },
  { n: "02", title: "55 auditors scan", desc: "SDK auditors run in-process; Prowler and IaC scanners run as containers. Every cloud, every layer." },
  { n: "03", title: "Findings map to 678 controls", desc: "Each finding is mapped to the controls it affects across 9 frameworks, with weighted per-framework scoring." },
  { n: "04", title: "AI + heuristics remediate", desc: "Gap analysis, MITRE ATT&CK mapping, and remediation steps — or deterministic heuristics when no key is set." },
  { n: "05", title: "Tamper-evident evidence", desc: "Every artifact lands in a SHA-256 chain on Object-Lock storage — audit-ready, hand it to an assessor." },
];

const FLAGSHIP = ["soc2", "hipaa", "iso42001", "nist80053"];

export default function Home() {
  const frameworks = FRAMEWORKS.filter((f) => FLAGSHIP.includes(f.key));
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
              eyebrow="Open source · Apache-2.0"
              eyebrowIcon={<Sparkles className="h-3.5 w-3.5" />}
              title={<>Compliance posture,<br /></>}
              accentWord="continuously proven."
              sub={
                <>
                  Blackfyre scans AWS, Azure, GCP and on-prem against{" "}
                  <strong className="font-semibold text-zinc-900">{TOTAL_CONTROLS} controls</strong> across{" "}
                  {FRAMEWORK_COUNT} frameworks with {AUDITOR_COUNT} auditors, then maps every finding to the
                  controls it affects. Self-host it free.
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
              kicker="What ships in the box"
              stats={[
                { value: String(AUDITOR_COUNT), label: "Auditors" },
                { value: String(FRAMEWORK_COUNT), label: "Frameworks" },
                { value: String(TOTAL_CONTROLS), label: "Controls", color: "text-blue-600" },
                { value: "Free", label: "Apache-2.0" },
              ]}
            />

            <div className="mt-8 grid gap-1 sm:grid-cols-2">
              {CAPABILITIES.map((c) => (
                <IconTile key={c.title} icon={c.icon} title={c.title} desc={c.tile} accent={c.accent} />
              ))}
            </div>

            <div className="mt-8">
              <CTABanner
                dotLabel="Free forever · self-host"
                title="Run the whole platform on your own infrastructure."
                primaryLabel="Star on GitHub"
                primaryHref={SITE.repoUrl}
                primaryExternal
                secondaryLabel="Read the docs"
                secondaryHref="/docs"
              />
            </div>
          </div>

          <Parallax className="hidden lg:block" shift={-6}>
            <DeviceCluster />
          </Parallax>
        </div>

        <LogoRow
          label="Built on"
          items={["Next.js", "Fastify", "PostgreSQL · RLS", "Drizzle", "AWS · SST", "Cloudflare", "Claude / Bedrock"]}
        />
      </Section>

      {/* ── COVERAGE · dark · violet→pink→blue ──────────────────────────── */}
      <Section variant="dark">
        <div className="grid gap-16 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div className="lg:sticky lg:top-12">
            <SectionHead
              accent="purple"
              on="dark"
              eyebrow="Coverage"
              eyebrowIcon={<ScanLine className="h-3.5 w-3.5" />}
              title="Scan everything."
              accentWord="Prove anything."
              sub="One open-source codebase covers the whole estate — cloud, containers, identity, network and on-prem — and turns every finding into framework-mapped, audit-ready posture."
            />
            <ul className="mt-8 space-y-4">
              {[
                { t: "Read-only by design", d: "Cross-account IAM role, no write keys — least privilege, minimum data." },
                { t: "Graceful degradation", d: "Every AI feature falls back to deterministic heuristics with no key set." },
                { t: "Serious multi-tenancy", d: "Postgres RLS below the ORM, request-scoped, fails closed (ADR-0001)." },
              ].map((r) => (
                <li key={r.t} className="flex gap-3">
                  <ShieldCheck className="mt-0.5 h-5 w-5 flex-shrink-0 text-purple-400" />
                  <div>
                    <p className="text-sm font-semibold text-white">{r.t}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-zinc-400">{r.d}</p>
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-8">
              <GhostButton href="/agents" on="dark">
                Browse all {AUDITOR_COUNT} auditors
              </GhostButton>
            </div>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            {CAPABILITIES.map((c) => (
              <CaseStudyCardDark
                key={c.title}
                badge={c.badge}
                icon={c.icon}
                title={c.title}
                desc={c.desc}
                accent={c.accent}
                illustration={c.ill}
                linkLabel="View source"
                linkHref={SITE.repoUrl}
              />
            ))}
          </div>
        </div>
      </Section>

      {/* ── METHODOLOGY · warm · amber ──────────────────────────────────── */}
      <Section variant="warm">
        <div className="grid gap-16 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div className="lg:sticky lg:top-12">
            <SectionHead
              accent="amber"
              on="light"
              eyebrow="How it works"
              eyebrowIcon={<KeyRound className="h-3.5 w-3.5" />}
              title="From scan to"
              accentWord="audit-ready evidence."
              accentStyle="solid"
              sub="The same pipeline that scores your posture also produces the artifacts an auditor asks for — no spreadsheet reconciliation."
            />
            <div className="mt-10">
              <StepTimeline steps={STEPS} accent="amber" />
            </div>
          </div>

          <div className="space-y-6">
            <p className="font-mono text-[11px] font-semibold uppercase tracking-wider text-amber-700">
              {FRAMEWORK_COUNT} frameworks · {TOTAL_CONTROLS} controls · four shown
            </p>
            {frameworks.map((f) => (
              <FeatureCardLight
                key={f.key}
                kicker={f.short}
                title={f.name}
                desc={f.summary}
                thumb={
                  <div className="text-center">
                    <p className="font-mono text-3xl font-extrabold text-amber-700">{f.controls}</p>
                    <p className="mt-1 font-mono text-[9px] uppercase tracking-wide text-zinc-500">controls</p>
                  </div>
                }
                stats={[
                  { label: "Controls", value: String(f.controls) },
                  { label: "Scoring", value: "Weighted" },
                  { label: "Evidence", value: "Mapped" },
                ]}
                linkLabel="See framework"
                linkHref={f.slug ?? "/platform#frameworks"}
              />
            ))}
          </div>
        </div>
      </Section>

      {/* ── GET STARTED · dark · lime ───────────────────────────────────── */}
      <Section variant="dark" orbs={false}>
        <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
          <SectionHead
            accent="lime"
            on="dark"
            eyebrow="Get started"
            eyebrowIcon={<FileCheck2 className="h-3.5 w-3.5" />}
            title="Clone. Compose."
            accentWord="Done."
            sub="The full stack runs locally on Docker Compose — no cloud account or API keys. Up and evaluating in about fifteen minutes."
          />
          <QuickstartInstall />
        </div>
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <LimeButton href={SITE.repoUrl} external icon={<GitHubIcon />}>
            Star on GitHub
          </LimeButton>
          <GhostButton href="/self-host" on="dark">
            Self-hosting guide
          </GhostButton>
        </div>
      </Section>

      <HaloFooter />
    </>
  );
}
