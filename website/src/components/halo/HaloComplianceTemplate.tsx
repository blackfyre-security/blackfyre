import type { ComponentType, ReactNode } from "react";
import {
  ShieldCheck,
  Lock,
  Cpu,
  FileCheck2,
  BookOpen,
  Workflow,
  ScanLine,
  Database,
} from "lucide-react";

import HaloNav from "@/components/halo/HaloNav";
import HaloFooter from "@/components/halo/HaloFooter";

import Section from "@/components/vibrant/Section";
import SectionHead from "@/components/vibrant/SectionHead";
import StatRow from "@/components/vibrant/StatRow";
import StepTimeline from "@/components/vibrant/StepTimeline";
import { LimeButton, GhostButton, GitHubIcon } from "@/components/vibrant/buttons";
import { ACCENTS, type Accent } from "@/components/vibrant/accents";

import { FRAMEWORKS, FRAMEWORK_COUNT, type FrameworkDetail } from "@/data/frameworks";
import { AUDITOR_COUNT } from "@/data/auditors";
import { SITE } from "@/data/site";

/**
 * Parameterised compliance page template (VIBRANT kit) used by
 * /soc2-compliance, /hipaa-compliance, /nist-800-53 and /iso-42001.
 *
 * HONEST FRAMING (OSS product, not a SaaS with SLAs):
 * Blackfyre *maps* multi-cloud + on-prem scan findings to a framework's
 * controls with weighted per-framework scoring, and writes tamper-evident
 * evidence to a vault. It assesses and evidences posture — it does not
 * certify compliance and makes no guarantees. Control counts, framework
 * names and summaries come straight from @/data (code-of-record). The
 * coverage panel and the vault record are illustrative of the SHAPE of a
 * scan, not a live customer posture — both are labelled "illustrative".
 * Pure CSS/hover; no client state, so this stays a Server Component.
 */

export type Framework = "soc2" | "hipaa" | "iso42001" | "nist80053";

interface Family {
  code: string;
  name: string;
  desc: string;
}

interface FrameworkView {
  /** hero (light) accent — per framework, per assignment */
  accent: Accent;
  /** dark "what it covers" section accent (purple/pink, matching home choreography) */
  darkAccent: Accent;
  heroIcon: ComponentType<{ className?: string }>;
  badge: string;
  /** the emphasised hero phrase */
  heroAccentWord: string;
  heroLede: ReactNode;
  coversTitle: ReactNode;
  coversAccentWord: string;
  families: readonly Family[];
  scopeNote?: string;
  ctaLead: string;
}

const VIEW: Record<Framework, FrameworkView> = {
  soc2: {
    accent: "blue",
    darkAccent: "purple",
    heroIcon: ShieldCheck,
    badge: "SOC 2 · AICPA TSC 2017",
    heroAccentWord: "continuously mapped.",
    heroLede: (
      <>
        Blackfyre&rsquo;s {AUDITOR_COUNT} auditors scan AWS, Azure, GCP and on-prem, then map every
        finding to the SOC 2 controls across the five Trust Services Categories — with weighted
        scoring and tamper-evident evidence. Open source, self-host free.
      </>
    ),
    coversTitle: <>What SOC&nbsp;2</>,
    coversAccentWord: "covers.",
    families: [
      {
        code: "Security (CC)",
        name: "Common Criteria",
        desc: "CC1–CC9: control environment, communication, risk assessment, monitoring, control activities, logical & physical access, system operations, change management, and risk mitigation.",
      },
      {
        code: "Availability (A1)",
        name: "Availability",
        desc: "System availability commitments — capacity planning, backup, and recovery.",
      },
      {
        code: "Confidentiality (C1)",
        name: "Confidentiality",
        desc: "Protection of information designated confidential across its lifecycle.",
      },
      {
        code: "Integrity (PI1)",
        name: "Processing integrity",
        desc: "Complete, valid, accurate, timely and authorised system processing.",
      },
      {
        code: "Privacy (P)",
        name: "Privacy",
        desc: "Notice, choice, collection, use, retention, and disposal of personal information.",
      },
    ],
    ctaLead: "SOC 2, mapped and",
  },

  hipaa: {
    accent: "emerald",
    darkAccent: "pink",
    heroIcon: Lock,
    badge: "HIPAA · 45 CFR Part 164",
    heroAccentWord: "continuously mapped.",
    heroLede: (
      <>
        Blackfyre maps multi-cloud and on-prem findings to the HIPAA Security Rule controls —
        administrative, physical, and technical safeguards — with weighted scoring and a
        tamper-evident evidence vault. It scans configuration posture, never the ePHI itself.
      </>
    ),
    coversTitle: <>What the HIPAA Security Rule</>,
    coversAccentWord: "covers.",
    families: [
      {
        code: "§164.308",
        name: "Administrative safeguards",
        desc: "Security management, workforce security, access management, training, contingency planning, and evaluation.",
      },
      {
        code: "§164.310",
        name: "Physical safeguards",
        desc: "Facility access, workstation use and security, and device / media controls.",
      },
      {
        code: "§164.312",
        name: "Technical safeguards",
        desc: "Access control, audit controls, integrity, authentication, and transmission security.",
      },
      {
        code: "§164.314",
        name: "Organizational requirements",
        desc: "Business-associate contracts and requirements for group health plans.",
      },
      {
        code: "§164.316",
        name: "Policies & documentation",
        desc: "Written policies and procedures, plus the required retention of documentation.",
      },
    ],
    scopeNote:
      "Blackfyre's scanners collect the minimum posture data needed to assess a control — configuration and metadata. They never read ePHI, customer records, or business content. That data-collection boundary is documented, not just asserted.",
    ctaLead: "HIPAA, mapped and",
  },

  iso42001: {
    accent: "purple",
    darkAccent: "pink",
    heroIcon: Cpu,
    badge: "ISO/IEC 42001:2023",
    heroAccentWord: "continuously mapped.",
    heroLede: (
      <>
        Blackfyre maps infrastructure findings to the ISO/IEC 42001:2023 controls, evidencing the
        operational and technical safeguards behind the systems your AI runs on — data storage,
        access, logging, and monitoring. Open source, self-host free.
      </>
    ),
    coversTitle: <>What ISO&nbsp;42001</>,
    coversAccentWord: "covers.",
    families: [
      { code: "A.2", name: "AI policies", desc: "Policies for the responsible development and use of AI systems." },
      { code: "A.3", name: "Internal organization", desc: "Roles, responsibilities, and reporting for the AI management system." },
      { code: "A.4", name: "Resources for AI systems", desc: "Data, tooling, compute, and human resources for AI." },
      { code: "A.5", name: "Impact assessment", desc: "Assessing impacts of AI systems on individuals, groups, and society." },
      { code: "A.6", name: "AI system life cycle", desc: "Responsible design, development, deployment, and operation." },
      { code: "A.7", name: "Data for AI systems", desc: "Data quality, provenance, and management across the lifecycle." },
      { code: "A.8", name: "Information for interested parties", desc: "Transparency and information provided to users and stakeholders." },
      { code: "A.9", name: "Use of AI systems", desc: "Responsible operation and intended-use controls." },
      { code: "A.10", name: "Third-party relationships", desc: "Managing suppliers, customers, and third-party AI components." },
    ],
    scopeNote:
      "Blackfyre assesses the cloud and on-prem infrastructure that hosts your AI systems and maps posture findings to ISO 42001's technical and operational controls. It is not a model-level red-teaming or evaluation tool — pair it with your own AI-lifecycle and impact-assessment process.",
    ctaLead: "ISO 42001, mapped and",
  },

  nist80053: {
    accent: "amber",
    darkAccent: "purple",
    heroIcon: FileCheck2,
    badge: "NIST SP 800-53 Rev 5",
    heroAccentWord: "continuously mapped.",
    heroLede: (
      <>
        Blackfyre maps multi-cloud and on-prem findings to the NIST SP 800-53 Rev 5 controls across
        all 20 families — with weighted scoring and tamper-evident evidence to support your ATO or
        FedRAMP process. Open source, self-host free.
      </>
    ),
    coversTitle: <>What NIST&nbsp;800-53</>,
    coversAccentWord: "covers.",
    families: [
      { code: "AC", name: "Access control", desc: "Least privilege, separation of duties, remote access." },
      { code: "AT", name: "Awareness & training", desc: "Security, privacy, and role-based training." },
      { code: "AU", name: "Audit & accountability", desc: "Event logging, review, and log protection." },
      { code: "CA", name: "Assessment & authorization", desc: "Control assessments, ATO, and continuous monitoring." },
      { code: "CM", name: "Configuration management", desc: "Baselines, change control, and least functionality." },
      { code: "CP", name: "Contingency planning", desc: "Backup, recovery, and continuity of operations." },
      { code: "IA", name: "Identification & auth", desc: "User / device identity, MFA, and authenticators." },
      { code: "IR", name: "Incident response", desc: "Handling, reporting, and response testing." },
      { code: "MA", name: "Maintenance", desc: "Controlled system maintenance and tooling." },
      { code: "MP", name: "Media protection", desc: "Media access, marking, storage, and sanitisation." },
      { code: "PE", name: "Physical & environmental", desc: "Facility access and environmental controls." },
      { code: "PL", name: "Planning", desc: "Security / privacy plans and rules of behaviour." },
      { code: "PM", name: "Program management", desc: "Organisation-wide security and privacy program." },
      { code: "PS", name: "Personnel security", desc: "Screening, termination, and transfer controls." },
      { code: "PT", name: "PII processing & transparency", desc: "Consent, purpose, and privacy notices." },
      { code: "RA", name: "Risk assessment", desc: "Categorisation, vulnerability scanning, and risk analysis." },
      { code: "SA", name: "System & services acquisition", desc: "SDLC, supplier, and developer security." },
      { code: "SC", name: "System & comms protection", desc: "Boundary defence, cryptography, and isolation." },
      { code: "SI", name: "System & info integrity", desc: "Flaw remediation, malware defence, and monitoring." },
      { code: "SR", name: "Supply chain risk", desc: "Supply-chain controls and component provenance." },
    ],
    ctaLead: "NIST 800-53, mapped and",
  },
};

/* ── Illustrative coverage panel (hero right column) ─────────────────────── */
function CoveragePanel({
  controls,
  short,
  accent,
  families,
}: {
  controls: number;
  short: string;
  accent: Accent;
  families: readonly Family[];
}) {
  const a = ACCENTS[accent];
  // Cap the illustrative control-cell grid so a 298-control framework doesn't
  // render an enormous block; the headline number stays exact.
  const cellCount = Math.min(controls, 84);
  return (
    <aside className="relative overflow-hidden rounded-2xl border border-zinc-200 bg-white p-7 shadow-[0_20px_60px_-30px_rgba(0,0,0,0.25)]">
      <div className="flex items-baseline justify-between">
        <p className="font-mono text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
          Coverage
        </p>
        <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
          <span className={`inline-block h-1.5 w-1.5 rounded-full ${a.dot} animate-pulse motion-reduce:animate-none`} />
          Illustrative
        </span>
      </div>

      <div className="mt-5 flex items-baseline gap-2.5">
        <span className={`font-mono text-[56px] font-extrabold leading-none tracking-tight tabular-nums ${a.textLight}`}>
          {controls}
        </span>
        <span className="font-mono text-xs text-zinc-500">{short} controls mapped</span>
      </div>
      <p className="mt-1.5 font-mono text-[11px] text-zinc-400">
        Each finding maps to the controls it affects.
      </p>

      {/* Every cell is a mapped control — no pass/fail, this is not a live posture. */}
      <div
        aria-hidden
        className="mt-5 grid gap-[3px]"
        style={{ gridTemplateColumns: "repeat(auto-fill, minmax(14px, 1fr))" }}
      >
        {Array.from({ length: cellCount }).map((_, i) => (
          <span key={i} className={`h-3.5 rounded-[2px] ${a.dot} ${i % 7 === 0 ? "opacity-100" : "opacity-60"}`} />
        ))}
      </div>

      <div className="mt-5 flex flex-wrap gap-1.5">
        {families.slice(0, 6).map((fam) => (
          <span
            key={fam.code}
            className="rounded-[4px] border border-zinc-200 bg-zinc-50 px-2.5 py-1 font-mono text-[10.5px] tracking-[0.04em] text-zinc-500"
          >
            {fam.code}
          </span>
        ))}
        {families.length > 6 && (
          <span className="rounded-[4px] border border-zinc-200 bg-zinc-50 px-2.5 py-1 font-mono text-[10.5px] tracking-[0.04em] text-zinc-400">
            +{families.length - 6}
          </span>
        )}
      </div>
    </aside>
  );
}

export interface HaloComplianceTemplateProps {
  framework: Framework;
}

export default function HaloComplianceTemplate({ framework }: HaloComplianceTemplateProps) {
  const view = VIEW[framework];
  const detail = FRAMEWORKS.find((fr) => fr.key === framework) as FrameworkDetail;
  const controls = detail.controls;
  const HeroIcon = view.heroIcon;
  const dark = ACCENTS[view.darkAccent];

  const steps = [
    {
      n: "01",
      title: "Scan",
      desc: `${AUDITOR_COUNT} auditors enumerate real resources across AWS, Azure, GCP and on-prem — plus Prowler and Checkov / Semgrep / Bandit as containerised scanners.`,
    },
    {
      n: "02",
      title: "Map",
      desc: `Every finding maps to the ${controls} ${detail.short} controls it affects. A single misconfiguration can touch several controls at once — the mapping records each one.`,
    },
    {
      n: "03",
      title: "Score",
      desc: "Weighted per-framework scoring rolls findings into a posture score you track as your team ships fixes — no spreadsheet reconciliation.",
    },
    {
      n: "04",
      title: "Evidence",
      desc: "Each result is written to a tamper-evident vault — SHA-256 integrity hash, S3 Object Lock, versioning — ready to hand to an auditor.",
    },
  ];

  const vaultRecord: readonly [string, string, boolean][] = [
    ["integrity", "sha256:d4a1…9c02", true],
    ["control", view.families[0].code, true],
    ["storage", "S3 Object Lock · versioned", false],
    ["pii", "AES-256-GCM · field-encrypted", false],
    ["verify", "auditor recomputes the hash", false],
  ];

  return (
    <>
      <HaloNav />

      {/* ── HERO · light · framework accent ─────────────────────────────── */}
      <Section variant="light">
        <div className="grid gap-16 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <SectionHead
              size="hero"
              accent={view.accent}
              on="light"
              eyebrow={view.badge}
              eyebrowIcon={<HeroIcon className="h-3.5 w-3.5" />}
              title={<>Your {detail.short} controls,<br /></>}
              accentWord={view.heroAccentWord}
              sub={view.heroLede}
            />
            <div className="mt-8 flex flex-wrap gap-3">
              <LimeButton href={SITE.repoUrl} external icon={<GitHubIcon />}>
                Star on GitHub
              </LimeButton>
              <GhostButton href="/docs">Read the docs</GhostButton>
            </div>

            <StatRow
              className="mt-10"
              kicker="Coverage · illustrative"
              stats={[
                { value: String(controls), label: `${detail.short} controls`, color: ACCENTS[view.accent].textLight },
                { value: String(FRAMEWORK_COUNT), label: "Frameworks" },
                { value: "3 + on-prem", label: "Clouds" },
                { value: "Free", label: "Apache-2.0" },
              ]}
            />
          </div>

          <div className="hidden lg:block">
            <CoveragePanel
              controls={controls}
              short={detail.short}
              accent={view.accent}
              families={view.families}
            />
          </div>
        </div>
      </Section>

      {/* ── WHAT IT COVERS · dark · purple/pink ─────────────────────────── */}
      <Section variant="dark">
        <SectionHead
          accent={view.darkAccent}
          on="dark"
          eyebrow="The standard"
          eyebrowIcon={<BookOpen className="h-3.5 w-3.5" />}
          title={view.coversTitle}
          accentWord={view.coversAccentWord}
          sub={detail.summary}
        />
        <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {view.families.map((fam) => (
            <article
              key={fam.code}
              className={`rounded-2xl border border-zinc-900 bg-zinc-950 p-6 transition-all duration-300 hover:-translate-y-1 ${dark.cardBorder}`}
            >
              <div className={`font-mono text-[12.5px] tracking-[0.08em] ${dark.textDark}`}>{fam.code}</div>
              <h3 className="mt-2 text-[17px] font-semibold tracking-tight text-white">{fam.name}</h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">{fam.desc}</p>
            </article>
          ))}
        </div>
        <p className="mt-8 text-center font-mono text-[11.5px] text-zinc-500">
          Blackfyre maps findings to the {controls} {detail.short} controls it tracks · one of {FRAMEWORK_COUNT} frameworks in the platform.
        </p>
      </Section>

      {/* ── METHODOLOGY · warm · amber ──────────────────────────────────── */}
      <Section variant="warm">
        <div className="grid gap-16 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div className="lg:sticky lg:top-12">
            <SectionHead
              accent="amber"
              on="light"
              eyebrow="How it works"
              eyebrowIcon={<Workflow className="h-3.5 w-3.5" />}
              title="From scan to"
              accentWord="audit-ready evidence."
              accentStyle="solid"
              sub={
                <>
                  The same pipeline that scores your {detail.short} posture also produces the artifacts
                  an auditor asks for — no spreadsheet reconciliation. Blackfyre assesses and evidences
                  posture; it never claims a certification on your behalf.
                </>
              }
            />
            <div className="mt-10">
              <StepTimeline steps={steps} accent="amber" />
            </div>
          </div>

          <div className="space-y-4">
            <p className="font-mono text-[11px] font-semibold uppercase tracking-wider text-amber-700">
              Illustrative vault record · shows the shape, not real data
            </p>

            {/* Illustrative vault record — the SHAPE of an evidence item, not a live posture. */}
            <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
              <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-3.5">
                <span className="inline-flex items-center gap-2 font-mono text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                  <ScanLine className="h-3.5 w-3.5 text-amber-600" />
                  Evidence vault
                </span>
                <span className="font-mono text-[10.5px] text-zinc-400">illustrative</span>
              </div>
              <dl className="divide-y divide-zinc-100 font-mono text-[12px]">
                {vaultRecord.map(([k, v, accented]) => (
                  <div key={k} className="grid grid-cols-[92px_1fr] items-center gap-4 px-6 py-3">
                    <dt className="uppercase tracking-[0.1em] text-zinc-400">{k}</dt>
                    <dd className="truncate text-zinc-600">
                      {accented ? <span className="text-amber-700">{v}</span> : v}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { icon: ScanLine, v: String(AUDITOR_COUNT), k: "Auditors" },
                { icon: FileCheck2, v: String(controls), k: `${detail.short} controls` },
                { icon: Database, v: "3 + on-prem", k: "Clouds" },
                { icon: ShieldCheck, v: "SHA-256", k: "Tamper-evident" },
              ].map((s) => (
                <div key={s.k} className="rounded-xl border border-zinc-200 bg-white p-4">
                  <s.icon className="h-4 w-4 text-amber-600" />
                  <p className="mt-2.5 font-mono text-lg font-extrabold tracking-tight text-zinc-900 tabular-nums">
                    {s.v}
                  </p>
                  <p className="mt-0.5 font-mono text-[10px] uppercase tracking-wide text-zinc-500">{s.k}</p>
                </div>
              ))}
            </div>

            {view.scopeNote && (
              <div className="rounded-2xl border border-zinc-200 border-l-2 border-l-amber-500 bg-white p-6">
                <p className="font-mono text-[11px] font-semibold uppercase tracking-wider text-amber-700">
                  Scope &amp; honesty
                </p>
                <p className="mt-2.5 text-[14px] leading-relaxed text-zinc-600">{view.scopeNote}</p>
              </div>
            )}
          </div>
        </div>
      </Section>

      {/* ── GET STARTED · dark · lime ───────────────────────────────────── */}
      <Section variant="dark" orbs={false}>
        <div className="grid gap-12 lg:grid-cols-[1fr_0.9fr] lg:items-center">
          <SectionHead
            accent="lime"
            on="dark"
            eyebrow="Open source · Apache-2.0"
            eyebrowIcon={<FileCheck2 className="h-3.5 w-3.5" />}
            title={<>{view.ctaLead}</>}
            accentWord="evidenced."
            sub={
              <>
                Blackfyre is Apache-2.0 — self-host it free forever, or try the hosted option (early
                access). First findings and mapped {detail.short} evidence in about fifteen minutes
                locally. It assesses and evidences your posture; it does not certify compliance.
              </>
            }
          />
          <div className="space-y-6">
            <StatRow
              surface={false}
              cols="grid-cols-2 sm:grid-cols-2"
              stats={[
                { value: String(controls), label: `${detail.short} controls`, color: "text-lime-300" },
                { value: String(FRAMEWORK_COUNT), label: "Frameworks", color: "text-white" },
                { value: String(AUDITOR_COUNT), label: "Auditors", color: "text-white" },
                { value: "Free", label: "Apache-2.0", color: "text-lime-300" },
              ]}
            />
            <div className="flex flex-wrap gap-3">
              <LimeButton href={SITE.repoUrl} external icon={<GitHubIcon />}>
                Star on GitHub
              </LimeButton>
              <GhostButton href="/docs" on="dark">
                Read the docs
              </GhostButton>
              <GhostButton href={SITE.hostedUrl} external on="dark">
                Try hosted (early access)
              </GhostButton>
            </div>
          </div>
        </div>
      </Section>

      <HaloFooter />
    </>
  );
}
