"use client";

import Link from "next/link";
import HaloNav from "@/components/halo/HaloNav";
import HaloFooter from "@/components/halo/HaloFooter";
import HaloSectionHead from "@/components/halo/HaloSectionHead";
import HaloReveal from "@/components/halo/HaloReveal";
import HaloCTA from "@/components/halo/HaloCTA";
import { useTicker } from "@/lib/halo-hooks";
import { FRAMEWORKS, type FrameworkDetail } from "@/data/frameworks";
import { AUDITORS, AUDITOR_COUNT, type Auditor, type AuditorCategory } from "@/data/auditors";
import { SITE } from "@/data/site";

/**
 * Parameterised compliance page template used by /soc2-compliance,
 * /hipaa-compliance, /nist-800-53 and /iso-42001.
 *
 * HONEST FRAMING (OSS product, not a SaaS with SLAs):
 * Blackfyre *maps* multi-cloud + on-prem scan findings to a framework's
 * controls with weighted per-framework scoring, and writes tamper-evident
 * evidence to a vault. It assesses and evidences posture — it does not
 * certify compliance and makes no guarantees. Control counts, framework
 * names and auditor lists come straight from @/data (code-of-record).
 * The animated "coverage" card is illustrative of the scan, not a live
 * customer posture. Ticker-driven accents respect `prefers-reduced-motion`
 * via the global reset in globals.css.
 */

export type Framework = "soc2" | "hipaa" | "iso42001" | "nist80053";

interface Family {
  code: string;
  name: string;
  desc: string;
}

interface FrameworkView {
  badge: string;
  heroLead: string;
  heroAccent: string;
  heroLede: string;
  standardTitle: string;
  standardTitleAccent: string;
  families: readonly Family[];
  auditorCategories: readonly AuditorCategory[];
  scopeNote?: string;
  ctaTitle: string;
  ctaAccent: string;
}

const CLOUD_LABEL: Record<Auditor["cloud"], string> = {
  aws: "AWS",
  azure: "Azure",
  gcp: "GCP",
  container: "Container",
  iac: "IaC",
  multi: "Multi-cloud",
  other: "On-prem / Other",
};

const VIEW: Record<Framework, FrameworkView> = {
  soc2: {
    badge: "SOC 2 · AICPA TSC 2017",
    heroLead: "Your SOC 2 controls,",
    heroAccent: "continuously mapped.",
    heroLede:
      "Blackfyre's 55 auditors scan AWS, Azure, GCP and on-prem, then map every finding to the SOC 2 controls across the five Trust Services Categories — with weighted scoring and tamper-evident evidence. Open source, self-host free.",
    standardTitle: "What SOC 2 covers.",
    standardTitleAccent: "SOC 2",
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
    auditorCategories: ["iam", "logging", "monitoring", "encryption", "networking", "storage"],
    ctaTitle: "SOC 2, mapped and evidenced.",
    ctaAccent: "evidenced.",
  },

  hipaa: {
    badge: "HIPAA · 45 CFR Part 164",
    heroLead: "Protecting ePHI,",
    heroAccent: "safeguard by safeguard.",
    heroLede:
      "Blackfyre maps multi-cloud and on-prem findings to the HIPAA Security Rule controls — administrative, physical, and technical safeguards — with weighted scoring and a tamper-evident evidence vault. It scans configuration posture, never the ePHI itself.",
    standardTitle: "What the HIPAA Security Rule covers.",
    standardTitleAccent: "HIPAA Security Rule",
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
    auditorCategories: ["encryption", "storage", "logging", "iam", "database", "monitoring"],
    scopeNote:
      "Blackfyre's scanners collect the minimum posture data needed to assess a control — configuration and metadata. They never read ePHI, customer records, or business content. That data-collection boundary is documented, not just asserted.",
    ctaTitle: "HIPAA, mapped and evidenced.",
    ctaAccent: "evidenced.",
  },

  iso42001: {
    badge: "ISO/IEC 42001:2023",
    heroLead: "AI governance,",
    heroAccent: "operationalised.",
    heroLede:
      "Blackfyre maps infrastructure findings to the ISO/IEC 42001:2023 controls, evidencing the operational and technical safeguards behind the systems your AI runs on — data storage, access, logging, and monitoring. Open source, self-host free.",
    standardTitle: "What ISO 42001 covers.",
    standardTitleAccent: "ISO 42001",
    families: [
      {
        code: "A.2",
        name: "AI policies",
        desc: "Policies for the responsible development and use of AI systems.",
      },
      {
        code: "A.3",
        name: "Internal organization",
        desc: "Roles, responsibilities, and reporting for the AI management system.",
      },
      {
        code: "A.4",
        name: "Resources for AI systems",
        desc: "Data, tooling, compute, and human resources for AI.",
      },
      {
        code: "A.5",
        name: "Impact assessment",
        desc: "Assessing impacts of AI systems on individuals, groups, and society.",
      },
      {
        code: "A.6",
        name: "AI system life cycle",
        desc: "Responsible design, development, deployment, and operation.",
      },
      {
        code: "A.7",
        name: "Data for AI systems",
        desc: "Data quality, provenance, and management across the lifecycle.",
      },
      {
        code: "A.8",
        name: "Information for interested parties",
        desc: "Transparency and information provided to users and stakeholders.",
      },
      {
        code: "A.9",
        name: "Use of AI systems",
        desc: "Responsible operation and intended-use controls.",
      },
      {
        code: "A.10",
        name: "Third-party relationships",
        desc: "Managing suppliers, customers, and third-party AI components.",
      },
    ],
    auditorCategories: ["storage", "database", "iam", "logging", "monitoring", "encryption"],
    scopeNote:
      "Blackfyre assesses the cloud and on-prem infrastructure that hosts your AI systems and maps posture findings to ISO 42001's technical and operational controls. It is not a model-level red-teaming or evaluation tool — pair it with your own AI-lifecycle and impact-assessment process.",
    ctaTitle: "ISO 42001, mapped and evidenced.",
    ctaAccent: "evidenced.",
  },

  nist80053: {
    badge: "NIST SP 800-53 Rev 5",
    heroLead: "800-53 controls,",
    heroAccent: "assessed continuously.",
    heroLede:
      "Blackfyre maps multi-cloud and on-prem findings to the NIST SP 800-53 Rev 5 controls across all 20 families — with weighted scoring and tamper-evident evidence to support your ATO or FedRAMP process. Open source, self-host free.",
    standardTitle: "What NIST 800-53 covers.",
    standardTitleAccent: "NIST 800-53",
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
    auditorCategories: ["iam", "logging", "monitoring", "networking", "encryption", "container", "compute"],
    ctaTitle: "NIST 800-53, mapped and evidenced.",
    ctaAccent: "evidenced.",
  },
};

const PIPELINE = [
  {
    t: "Scan",
    d: "55 auditors enumerate real resources across AWS, Azure, GCP and on-prem — plus Prowler (900+ AWS checks) and Checkov / Semgrep / Bandit as containerised scanners.",
  },
  {
    t: "Map",
    d: "Every finding maps to the affected controls. A single misconfiguration can touch several controls at once — the mapping records each one.",
  },
  {
    t: "Score",
    d: "Weighted per-framework scoring rolls findings up into a posture score you can track as your team ships fixes — no spreadsheet reconciliation.",
  },
  {
    t: "Evidence",
    d: "Each result is written to a tamper-evident vault — SHA-256 integrity hash, S3 Object Lock, versioning — ready to hand to an auditor.",
  },
] as const;

const CAPABILITIES = [
  {
    t: "AI-assisted analysis, with a floor",
    d: "Gap analysis, MITRE ATT&CK mapping, remediation suggestions, and the CORTEX copilot run on Claude via Anthropic or AWS Bedrock — and degrade to deterministic heuristics when no key is set.",
  },
  {
    t: "Real-time monitoring & drift",
    d: "Config drift and live scan progress stream over SSE, so posture doesn't silently rot in the months between audits.",
  },
  {
    t: "Multi-tenancy below the ORM",
    d: "Tenant isolation is enforced by Postgres row-level security under the ORM — a non-owner role with FORCE RLS and request-scoped binding that fails closed.",
  },
] as const;

const VAULT_PROPS = [
  "SHA-256 integrity hash on every evidence item",
  "S3 Object Lock (WORM) + versioning — write-once, immutable",
  "AES-256-GCM encryption for sensitive fields",
  "Independently verifiable — auditors check the hash themselves",
  "Read-only, least-privilege cross-account IAM for scanning (no write keys)",
] as const;

export interface HaloComplianceTemplateProps {
  framework: Framework;
}

export default function HaloComplianceTemplate({ framework }: HaloComplianceTemplateProps) {
  const view = VIEW[framework];
  const detail = FRAMEWORKS.find((fr) => fr.key === framework) as FrameworkDetail;
  const controls = detail.controls;
  const tick = useTicker(1, 9999, 700);

  const relevantAuditors = AUDITORS.filter((a) => view.auditorCategories.includes(a.category));
  const shownAuditors = relevantAuditors.slice(0, 12);

  // Cap the illustrative control-cell grid so a 298-control framework doesn't
  // render an enormous block; the headline number stays exact.
  const cellCount = Math.min(controls, 96);
  const sweep = cellCount > 0 ? Math.floor(tick / 2) % cellCount : 0;

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
              "radial-gradient(ellipse 900px 400px at 70% 15%, var(--accent-glow), transparent 60%)",
          }}
        />
        <div className="relative mx-auto grid max-w-[1280px] grid-cols-1 items-center gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:gap-[72px]">
          <div>
            <p className="halo-eyebrow">§ Framework · {detail.short}</p>
            <div className="mt-5 inline-flex items-center gap-2.5 rounded-full border border-border-strong px-3.5 py-1.5">
              <span
                aria-hidden="true"
                className="inline-block h-1.5 w-1.5 rounded-sm bg-accent shadow-[0_0_8px_var(--accent)]"
              />
              <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-text">
                {view.badge}
              </span>
            </div>
            <h1 className="mt-5 font-display font-medium leading-[0.98] tracking-tightest text-text text-[clamp(44px,7vw,72px)] [text-wrap:balance]">
              {view.heroLead}
              <br />
              <span className="text-accent italic font-normal">{view.heroAccent}</span>
            </h1>
            <p className="mt-7 max-w-[560px] font-sans text-lg leading-[1.55] text-text-muted">
              {view.heroLede}
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <a
                href={SITE.repoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="halo-btn-accent"
              >
                Star on GitHub <span className="halo-arrow" aria-hidden="true">&rarr;</span>
              </a>
              <Link href="/docs" className="halo-btn-ghost">
                Read the docs
              </Link>
              <a
                href={SITE.hostedUrl}
                className="font-mono text-[12.5px] text-text-muted underline decoration-border underline-offset-4 transition-colors hover:text-text"
              >
                Or try the hosted option &rarr;
              </a>
            </div>
          </div>

          {/* Coverage card — illustrative of the scan, not a live posture. */}
          <aside className="halo-card relative overflow-hidden p-7">
            <div className="flex items-baseline justify-between">
              <p className="halo-label">§ Coverage</p>
              <div className="flex items-center gap-1.5 font-mono text-[11px] text-accent">
                <span
                  aria-hidden="true"
                  className="inline-block h-1.5 w-1.5 rounded-sm bg-accent animate-halo-pulse"
                />
                Illustrative scan
              </div>
            </div>

            <div className="mt-5 flex items-baseline gap-2.5">
              <div className="font-display text-[56px] font-medium leading-none tracking-[-0.03em] text-accent tabular-nums">
                {controls}
              </div>
              <div className="font-mono text-xs text-text-muted">
                {detail.short} controls mapped
              </div>
            </div>
            <p className="mt-1 font-mono text-xs text-text-muted">
              Each finding maps to the controls it affects.
            </p>

            {/* Control cells — every cell is a mapped control; the sweep is the
                scanner moving through them. No pass/fail: this is not a real
                customer posture. */}
            <div
              aria-hidden="true"
              className="mt-5 grid gap-[3px]"
              style={{ gridTemplateColumns: "repeat(auto-fill, minmax(14px, 1fr))" }}
            >
              {Array.from({ length: cellCount }).map((_, i) => {
                const isSweep = i === sweep;
                return (
                  <span
                    key={i}
                    className={`h-3.5 rounded-[2px] transition-[background-color,opacity] duration-200 ${
                      isSweep ? "bg-text opacity-100" : "bg-accent opacity-70"
                    }`}
                  />
                );
              })}
            </div>

            <div className="mt-5 flex flex-wrap gap-1.5">
              {view.families.slice(0, 6).map((fam) => (
                <span
                  key={fam.code}
                  className="rounded-[3px] border border-border bg-surface-alt px-2.5 py-1 font-mono text-[10.5px] tracking-[0.06em] text-text-muted"
                >
                  {fam.code}
                </span>
              ))}
              {view.families.length > 6 && (
                <span className="rounded-[3px] border border-border bg-surface-alt px-2.5 py-1 font-mono text-[10.5px] tracking-[0.06em] text-text-dim">
                  +{view.families.length - 6}
                </span>
              )}
            </div>
          </aside>
        </div>
      </section>

      {/* ── The standard ────────────────────────────────────────── */}
      <HaloReveal as="section" className="border-b border-border px-6 py-24 sm:px-12">
        <HaloSectionHead
          eyebrow="§ 01 · The standard"
          title={view.standardTitle}
          titleAccent={view.standardTitleAccent}
          blurb={detail.summary}
        />
        <div className="mx-auto mt-12 grid max-w-[1160px] grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {view.families.map((fam, i) => {
            const active = i === Math.floor(tick / 3) % view.families.length;
            return (
              <article
                key={fam.code}
                className="halo-card relative overflow-hidden p-6 transition-colors hover:border-border-strong"
              >
                {active && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 top-0 h-[2px] bg-accent opacity-60"
                  />
                )}
                <div className="font-mono text-[12.5px] tracking-[0.08em] text-accent">
                  {fam.code}
                </div>
                <h3 className="mt-2 font-sans text-[18px] font-medium tracking-[-0.02em] text-text">
                  {fam.name}
                </h3>
                <p className="mt-2 font-sans text-sm leading-[1.55] text-text-muted">
                  {fam.desc}
                </p>
              </article>
            );
          })}
        </div>
        <p className="mx-auto mt-6 max-w-[1160px] text-center font-mono text-[11.5px] text-text-dim">
          Blackfyre maps findings to the {controls} {detail.short} controls it tracks · one of {FRAMEWORKS.length} frameworks in the platform.
        </p>
      </HaloReveal>

      {/* ── How Blackfyre helps ─────────────────────────────────── */}
      <HaloReveal as="section" className="border-b border-border px-6 py-24 sm:px-12">
        <HaloSectionHead
          eyebrow="§ 02 · How Blackfyre helps"
          title="From scan to audit-ready evidence."
          titleAccent="audit-ready evidence"
          blurb={`Scan, map, score, evidence — the same pipeline that produces your ${detail.short} posture also produces the artefacts an auditor asks for.`}
        />
        <div className="mx-auto mt-12 grid max-w-[1280px] grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PIPELINE.map((step, i) => (
            <article key={step.t} className="halo-card p-6">
              <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-accent">
                {String(i + 1).padStart(2, "0")}
              </div>
              <h3 className="mt-2.5 font-sans text-[20px] font-medium tracking-[-0.02em] text-text">
                {step.t}
              </h3>
              <p className="mt-2.5 font-sans text-sm leading-[1.55] text-text-muted">
                {step.d}
              </p>
            </article>
          ))}
        </div>
        <div className="mx-auto mt-4 grid max-w-[1280px] grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CAPABILITIES.map((cap) => (
            <article
              key={cap.t}
              className="halo-card p-6 transition-colors hover:border-border-strong"
            >
              <h3 className="font-sans text-[18px] font-medium tracking-[-0.02em] text-text">
                {cap.t}
              </h3>
              <p className="mt-2.5 font-sans text-sm leading-[1.55] text-text-muted">
                {cap.d}
              </p>
            </article>
          ))}
        </div>
      </HaloReveal>

      {/* ── Relevant auditors ───────────────────────────────────── */}
      <HaloReveal as="section" className="border-b border-border px-6 py-24 sm:px-12">
        <HaloSectionHead
          eyebrow="§ 03 · Auditors"
          title={`The auditors that feed your ${detail.short} evidence.`}
          titleAccent={detail.short}
          blurb={`${relevantAuditors.length} of the ${AUDITOR_COUNT} auditors produce findings that map to ${detail.short} controls. Each enumerates real resources — no questionnaire guesswork.`}
        />
        <div className="mx-auto mt-12 grid max-w-[1160px] grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {shownAuditors.map((a) => (
            <article
              key={a.name}
              className="halo-card p-5 transition-colors hover:border-border-strong"
            >
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-sans text-[15px] font-medium tracking-[-0.01em] text-text">
                  {a.name}
                </h3>
                <span className="shrink-0 rounded-[3px] border border-border bg-surface-alt px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.08em] text-text-dim">
                  {CLOUD_LABEL[a.cloud]}
                </span>
              </div>
              {a.description && (
                <p className="mt-2 font-sans text-[13px] leading-[1.5] text-text-muted">
                  {a.description}
                </p>
              )}
            </article>
          ))}
        </div>
        <div className="mx-auto mt-6 flex max-w-[1160px] items-center justify-center">
          <Link
            href="/agents"
            className="halo-btn-ghost !py-2.5 !text-[13px]"
          >
            See all {AUDITOR_COUNT} auditors <span className="halo-arrow" aria-hidden="true">&rarr;</span>
          </Link>
        </div>
      </HaloReveal>

      {/* ── Evidence vault ──────────────────────────────────────── */}
      <HaloReveal as="section" className="border-b border-border px-6 py-24 sm:px-12">
        <HaloSectionHead
          eyebrow="§ 04 · Evidence"
          title="Tamper-evident by construction."
          titleAccent="Tamper-evident"
          blurb="Every scan writes an artefact to a write-once vault. Your auditor doesn't take Blackfyre's word for it — they verify the hash."
        />
        <div className="mx-auto mt-12 grid max-w-[1160px] grid-cols-1 items-start gap-4 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="halo-card p-7">
            <p className="halo-label">§ Vault properties</p>
            <ul className="mt-5 space-y-3.5">
              {VAULT_PROPS.map((prop) => (
                <li key={prop} className="flex items-start gap-3">
                  <span
                    aria-hidden="true"
                    className="mt-0.5 font-mono text-accent"
                  >
                    &#10003;
                  </span>
                  <span className="font-sans text-sm leading-[1.55] text-text-muted">
                    {prop}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Illustrative vault record — shows the SHAPE, not real data. */}
          <div className="halo-card-strong overflow-hidden p-0">
            <div className="flex items-center justify-between border-b border-border px-6 py-3.5">
              <p className="halo-label">§ Vault record</p>
              <span className="font-mono text-[10.5px] text-text-dim">illustrative</span>
            </div>
            <dl className="divide-y divide-border font-mono text-[12px]">
              {(
                [
                  ["integrity", "sha256:d4a1…9c02"],
                  ["control", view.families[0].code],
                  ["source", shownAuditors[0]?.name ?? "AWS IAM Auditor"],
                  ["storage", "S3 Object Lock · versioned"],
                  ["pii", "AES-256-GCM · field-encrypted"],
                  ["verify", "auditor recomputes the hash"],
                ] as const
              ).map(([k, v]) => (
                <div
                  key={k}
                  className="grid grid-cols-[92px_1fr] items-center gap-4 px-6 py-3"
                >
                  <dt className="uppercase tracking-[0.1em] text-text-dim">{k}</dt>
                  <dd className="truncate text-text-muted">
                    {k === "control" || k === "integrity" ? (
                      <span className="text-accent">{v}</span>
                    ) : (
                      v
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </HaloReveal>

      {/* ── Stats band ──────────────────────────────────────────── */}
      <HaloReveal as="section" className="border-b border-border px-6 py-20 sm:px-12">
        <div className="mx-auto grid max-w-[1160px] grid-cols-2 gap-4 sm:grid-cols-4">
          {(
            [
              { k: `${detail.short} controls`, v: `${controls}` },
              { k: "Auditors", v: `${AUDITOR_COUNT}` },
              { k: "Frameworks", v: `${FRAMEWORKS.length}` },
              { k: "Clouds", v: "3 + on-prem" },
            ] as const
          ).map((s) => (
            <div key={s.k} className="halo-card flex flex-col gap-2 p-5">
              <span className="halo-label">{s.k}</span>
              <span className="font-display text-[32px] font-medium leading-none tracking-[-0.02em] text-text tabular-nums">
                {s.v}
              </span>
            </div>
          ))}
        </div>
      </HaloReveal>

      {/* ── Scope note (honesty callout) ────────────────────────── */}
      {view.scopeNote && (
        <HaloReveal as="section" className="border-b border-border px-6 py-16 sm:px-12">
          <div className="mx-auto max-w-[880px] halo-card border-l-2 border-l-accent p-7">
            <p className="halo-label">§ Scope &amp; honesty</p>
            <p className="mt-3 font-sans text-[15px] leading-[1.6] text-text-muted">
              {view.scopeNote}
            </p>
          </div>
        </HaloReveal>
      )}

      <HaloCTA
        eyebrow="§ Open source"
        title={view.ctaTitle}
        titleAccent={view.ctaAccent}
        sub="Blackfyre is Apache-2.0 — self-host free forever, or use the hosted option. First findings and mapped evidence in about 15 minutes locally."
        primaryLabel="Star on GitHub"
        primaryHref={SITE.repoUrl}
        secondaryLabel="Read the docs"
        secondaryHref="/docs"
      />

      <HaloFooter />
    </>
  );
}
