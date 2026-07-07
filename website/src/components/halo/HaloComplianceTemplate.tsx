"use client";

import Link from "next/link";
import HaloNav from "@/components/halo/HaloNav";
import HaloFooter from "@/components/halo/HaloFooter";
import HaloSectionHead from "@/components/halo/HaloSectionHead";
import HaloCTA from "@/components/halo/HaloCTA";
import { useTicker } from "@/lib/halo-hooks";

/**
 * Parameterised compliance page template used by /soc2-compliance,
 * /hipaa-compliance, /nist-800-53 and /iso-42001. Ticker-driven accents
 * (live score, sweeping control cell, active row, feature accent bar,
 * timeline progress) respect `prefers-reduced-motion` via the global
 * reset in globals.css — the interval keeps ticking but transitions
 * collapse to ~0ms so nothing visibly moves.
 */

export type Framework = "soc2" | "hipaa" | "nist" | "iso42001";

interface ControlGroup {
  k: string;
  t: string;
  c: number;
  ok: number;
}

interface Feature {
  t: string;
  d: string;
}

interface TimelineStop {
  n: string;
  t: string;
  d: string;
  when: string;
}

interface EvidenceLine {
  id: string;
  ctrl: string;
  msg: string;
}

interface FrameworkConfig {
  eyebrow: string;
  name: string;
  badge: string;
  heroLead: string;
  heroAccent: string;
  heroLede: string;
  controlsTotal: number;
  controlsPass: number;
  controlsScore: number;
  trustCriteria: readonly string[];
  controlGroups: readonly ControlGroup[];
  features: readonly Feature[];
  timeline: readonly TimelineStop[];
  evidence: readonly EvidenceLine[];
  ctaTitle: string;
  ctaAccent: string;
}

const FRAMEWORK_CONFIG: Record<Framework, FrameworkConfig> = {
  soc2: {
    eyebrow: "§ Compliance automation",
    name: "SOC 2 Type II",
    badge: "SOC 2 TYPE II",
    heroLead: "Continuous trust,",
    heroAccent: "automated.",
    heroLede:
      "BLACKFYRE runs your entire SOC 2 Type II journey — continuous control monitoring, evidence chain with SHA-256 integrity, audit-ready packages on demand. Stop scrambling before audits.",
    controlsTotal: 142,
    controlsPass: 139,
    controlsScore: 97.9,
    trustCriteria: [
      "Security (CC)",
      "Availability (A)",
      "Confidentiality (C)",
      "Processing integrity (PI)",
      "Privacy (P)",
    ],
    controlGroups: [
      { k: "CC1", t: "Control environment", c: 18, ok: 18 },
      { k: "CC2", t: "Communication", c: 14, ok: 14 },
      { k: "CC3", t: "Risk assessment", c: 16, ok: 15 },
      { k: "CC4", t: "Monitoring", c: 12, ok: 12 },
      { k: "CC5", t: "Control activities", c: 22, ok: 21 },
      { k: "CC6", t: "Logical access", c: 28, ok: 27 },
      { k: "CC7", t: "System operations", c: 18, ok: 17 },
      { k: "CC8", t: "Change management", c: 8, ok: 8 },
      { k: "CC9", t: "Risk mitigation", c: 6, ok: 6 },
    ],
    features: [
      {
        t: "Continuous control monitoring",
        d: "SCOUT agents scan AWS, Azure, GCP against Trust Services Criteria — CC1 through CC9 — every minute, not just before audits.",
      },
      {
        t: "Automated evidence collection",
        d: "LEDGER collects and chains artefacts with SHA-256 integrity. Every config snapshot, policy export, and access review is timestamped and tamper-evident.",
      },
      {
        t: "AI gap analysis",
        d: "CORTEX tells you exactly what's missing, partial, and passing across every SOC 2 control — with remediation steps.",
      },
      {
        t: "One-click remediation",
        d: "HELIX generates Terraform, CloudFormation, or CLI fixes per finding. Auto-fix low-risk issues; guided flow for complex fixes.",
      },
      {
        t: "Real-time posture score",
        d: "SHIELD maps findings to controls and calculates your SOC 2 score live. Watch it move as the team ships fixes.",
      },
      {
        t: "Auditor-ready packages",
        d: "Generate a complete evidence package with one click — control matrix, artefacts, chain certificates, trend analysis.",
      },
    ],
    timeline: [
      { n: "01", t: "Connect clouds", d: "OIDC into AWS, Azure, GCP. Read-only by default.", when: "Day 1" },
      { n: "02", t: "Gap analysis", d: "CORTEX scans your environment against all CC controls.", when: "Day 1–3" },
      { n: "03", t: "Fix & monitor", d: "HELIX remediates; PULSE watches for drift.", when: "Weeks 1–8" },
      { n: "04", t: "Type I", d: "Point-in-time attestation. Evidence package handed to auditor.", when: "Week 8" },
      { n: "05", t: "Type II observation", d: "Six months of continuous evidence. All in the vault.", when: "Months 2–8" },
      { n: "06", t: "Attestation", d: "Auditor issues Type II report. You ship it to customers.", when: "Month 9" },
    ],
    evidence: [
      { id: "SHA-256:d4a1…9c02", ctrl: "CC6.1", msg: "IAM MFA enforced · 142 principals · evidence pinned" },
      { id: "SHA-256:7b33…e91f", ctrl: "CC7.2", msg: "Kernel CVE-2024-1086 patched on 214 hosts" },
      { id: "SHA-256:02cd…4a18", ctrl: "CC6.6", msg: "TLS 1.3 enforced on 62 public endpoints" },
      { id: "SHA-256:f11a…6b7c", ctrl: "CC5.3", msg: "Access review cycle auto-scheduled · 72 roles" },
    ],
    ctaTitle: "Get SOC 2 ready.",
    ctaAccent: "ready",
  },

  hipaa: {
    eyebrow: "§ Healthcare compliance",
    name: "HIPAA",
    badge: "HIPAA · 45 CFR PART 164",
    heroLead: "ePHI,",
    heroAccent: "always compliant.",
    heroLede:
      "Protect electronic PHI with automated technical-safeguard monitoring, continuous evidence collection, and auditor-ready packages — across AWS, Azure, GCP, and your SaaS stack.",
    controlsTotal: 98,
    controlsPass: 94,
    controlsScore: 95.9,
    trustCriteria: [
      "Administrative safeguards",
      "Physical safeguards",
      "Technical safeguards",
      "Breach notification",
      "BAAs on file",
    ],
    controlGroups: [
      { k: "§164.308", t: "Administrative safeguards", c: 22, ok: 21 },
      { k: "§164.310", t: "Physical safeguards", c: 12, ok: 12 },
      { k: "§164.312", t: "Technical safeguards", c: 28, ok: 26 },
      { k: "§164.314", t: "Organizational requirements", c: 8, ok: 8 },
      { k: "§164.316", t: "Policies & documentation", c: 10, ok: 9 },
      { k: "§164.400", t: "Breach notification", c: 18, ok: 18 },
    ],
    features: [
      {
        t: "§164.312(a) Access control",
        d: "Unique user IDs, emergency access procedures, automatic logoff, and ePHI encryption/decryption — all monitored live.",
      },
      {
        t: "§164.312(b) Audit controls",
        d: "Continuous audit-trail monitoring with LEDGER chain. Every ePHI access logged, hashed, and tamper-evident.",
      },
      {
        t: "§164.312(c) Integrity controls",
        d: "Checksum validation, versioning enforcement, and unauthorized-modification detection across cloud storage.",
      },
      {
        t: "§164.312(e) Transmission security",
        d: "TLS 1.2+ enforcement everywhere. Certificate expiry tracking and protocol downgrade detection.",
      },
      {
        t: "Evidence chain for auditors",
        d: "LEDGER builds a tamper-evident chain for every HIPAA control. Auditors verify independently with chain certificates.",
      },
      {
        t: "Breach notification readiness",
        d: "APEX auto-triages potential ePHI breaches and tracks the 60-day notification timeline with SLA alarms.",
      },
    ],
    timeline: [
      { n: "01", t: "Connect", d: "OIDC into clouds + EHR/SaaS connectors.", when: "Day 1" },
      { n: "02", t: "Classify ePHI", d: "CORTEX + Macie/CrowdStrike infer ePHI locations.", when: "Day 1–5" },
      { n: "03", t: "Safeguards mapping", d: "Findings mapped to §164.308/310/312.", when: "Week 1" },
      { n: "04", t: "BAAs on file", d: "Vendor BAA tracker links each subprocessor.", when: "Weeks 1–2" },
      { n: "05", t: "Continuous", d: "PULSE watches drift; APEX triages incidents.", when: "Always" },
      { n: "06", t: "Audit response", d: "One-click package with chain certs for auditors.", when: "On demand" },
    ],
    evidence: [
      { id: "SHA-256:8c1a…22fe", ctrl: "§164.312(a)", msg: "ePHI encryption at rest · 38 datastores verified" },
      { id: "SHA-256:41ee…90b3", ctrl: "§164.312(b)", msg: "Audit trail chain · 6.2M events · 0 gaps" },
      { id: "SHA-256:ab04…7c19", ctrl: "§164.308(a)", msg: "Workforce access review · 214 users · signed" },
      { id: "SHA-256:73d9…05ef", ctrl: "§164.314(a)", msg: "BAA on file · 24 of 24 subprocessors" },
    ],
    ctaTitle: "Get HIPAA ready.",
    ctaAccent: "ready",
  },

  nist: {
    eyebrow: "§ Federal compliance",
    name: "NIST 800-53 r5",
    badge: "NIST SP 800-53 REV 5",
    heroLead: "Federal-grade",
    heroAccent: "controls, live.",
    heroLede:
      "Map your posture to all 20 NIST 800-53 Revision 5 control families. Moderate, High, or tailored baselines. Continuous assessment with authoritative evidence for your FedRAMP or StateRAMP path.",
    controlsTotal: 371,
    controlsPass: 358,
    controlsScore: 96.5,
    trustCriteria: [
      "Baseline: Moderate",
      "Baseline: High",
      "FedRAMP Low/Mod/High",
      "StateRAMP",
      "DoD CC SRG",
    ],
    controlGroups: [
      { k: "AC", t: "Access control", c: 42, ok: 41 },
      { k: "AU", t: "Audit & accountability", c: 20, ok: 20 },
      { k: "CM", t: "Configuration management", c: 24, ok: 23 },
      { k: "CP", t: "Contingency planning", c: 18, ok: 17 },
      { k: "IA", t: "Identification & auth", c: 22, ok: 22 },
      { k: "IR", t: "Incident response", c: 14, ok: 14 },
      { k: "SC", t: "System & comms protection", c: 48, ok: 46 },
      { k: "SI", t: "System & info integrity", c: 32, ok: 30 },
      { k: "RA", t: "Risk assessment", c: 12, ok: 12 },
    ],
    features: [
      {
        t: "All 20 families, one console",
        d: "From AC to SR. Per-baseline (Low / Moderate / High) with tailoring support.",
      },
      {
        t: "ATO-ready artefacts",
        d: "SSP, SAP, SAR, and POA&M documents generated from live posture data.",
      },
      {
        t: "FedRAMP lineage",
        d: "Controls pre-mapped to FedRAMP Rev 5 baseline. Inheritance from CSPs annotated.",
      },
      {
        t: "Continuous ConMon",
        d: "Monthly ConMon deliverables produced automatically — no more scramble the last week of the month.",
      },
      {
        t: "Inheritance graph",
        d: "See which controls you inherit, share, or fully own — per cloud and per service.",
      },
      {
        t: "Tailoring workbench",
        d: "Adjust parameter values and mark not-applicable with justification. Everything audited.",
      },
    ],
    timeline: [
      { n: "01", t: "Baseline select", d: "Low / Moderate / High / tailored — choose starting point.", when: "Day 1" },
      { n: "02", t: "Connect & classify", d: "Discover systems; categorize per FIPS-199.", when: "Days 1–5" },
      { n: "03", t: "Control allocation", d: "Inherit from CSP, share, or own — per control.", when: "Week 1–2" },
      { n: "04", t: "SSP + gap", d: "SSP generated. CORTEX lists gaps and POA&M items.", when: "Week 2–3" },
      { n: "05", t: "Remediate + ConMon", d: "HELIX fixes; PULSE + monthly ConMon keep things clean.", when: "Month 1+" },
      { n: "06", t: "3PAO-ready", d: "Artefact bundle for your 3PAO with evidence chain.", when: "On demand" },
    ],
    evidence: [
      { id: "SHA-256:c5f2…88a1", ctrl: "AC-2", msg: "Privileged account review · 42 accounts · signed" },
      { id: "SHA-256:1e09…4477", ctrl: "AU-6", msg: "Log review · 7 days · 0 anomalies escalated" },
      { id: "SHA-256:ba81…c0e3", ctrl: "CM-6", msg: "Config baseline drift · 0 non-compliant hosts" },
      { id: "SHA-256:9207…b1fa", ctrl: "SC-13", msg: "FIPS-validated crypto · 48 endpoints verified" },
    ],
    ctaTitle: "Get NIST 800-53 ready.",
    ctaAccent: "ready",
  },

  iso42001: {
    eyebrow: "§ AI governance",
    name: "ISO 42001",
    badge: "ISO/IEC 42001:2023",
    heroLead: "AI,",
    heroAccent: "governed.",
    heroLede:
      "The first international standard for AI management systems. BLACKFYRE operationalises ISO 42001 — risk assessment, AIMS design, control implementation, and continuous monitoring across your model estate.",
    controlsTotal: 38,
    controlsPass: 36,
    controlsScore: 94.7,
    trustCriteria: [
      "AI policy",
      "Risk & impact",
      "AIMS design",
      "Operational controls",
      "Monitoring",
    ],
    controlGroups: [
      { k: "A.2", t: "AI policies", c: 4, ok: 4 },
      { k: "A.3", t: "Internal organization", c: 3, ok: 3 },
      { k: "A.4", t: "Resources", c: 4, ok: 4 },
      { k: "A.5", t: "Impact assessment", c: 6, ok: 6 },
      { k: "A.6", t: "AI lifecycle", c: 7, ok: 6 },
      { k: "A.7", t: "Data & model management", c: 6, ok: 5 },
      { k: "A.8", t: "Information for interested parties", c: 4, ok: 4 },
      { k: "A.9", t: "Use of AI", c: 4, ok: 4 },
    ],
    features: [
      {
        t: "AI impact assessment (AIA)",
        d: "Automated AIAs per model — risk, bias, environmental cost, rights impact. Updated on every model release.",
      },
      {
        t: "Model inventory",
        d: "Every model, dataset, prompt template, and deployment catalogued with ownership + lineage.",
      },
      {
        t: "Prompt injection defence",
        d: "Runtime guardrails + red-team harness. Continuous eval against 200+ attack patterns.",
      },
      {
        t: "Data provenance",
        d: "Track training data provenance, consent, and retention policies per model.",
      },
      {
        t: "Responsible-AI scorecards",
        d: "Public scorecards per model — ready to publish with your trust center.",
      },
      {
        t: "Human oversight gates",
        d: "Reviewer gates on model releases + prompt changes. All approvals logged to LEDGER.",
      },
    ],
    timeline: [
      { n: "01", t: "Scope the AIMS", d: "Define boundary — which systems, which risk tier.", when: "Week 1" },
      { n: "02", t: "Inventory models", d: "Discover every model in use; tag with risk tier.", when: "Weeks 1–2" },
      { n: "03", t: "Impact assessments", d: "AIA per high-risk model. Mitigations booked.", when: "Weeks 2–4" },
      { n: "04", t: "Operational controls", d: "Prompt guardrails, eval harness, reviewer gates live.", when: "Weeks 4–8" },
      { n: "05", t: "Monitoring", d: "Drift, hallucination rate, injection attempts — all tracked.", when: "Always" },
      { n: "06", t: "Certification", d: "Artefacts ready for your ISO 42001 certification body.", when: "Month 6+" },
    ],
    evidence: [
      { id: "SHA-256:ef14…a2c8", ctrl: "A.5.2", msg: "AIA completed · model credit-risk-v3 · risk tier high" },
      { id: "SHA-256:6a70…1d9b", ctrl: "A.6.2", msg: "Red-team eval · 211 attack patterns · 4 regressions" },
      { id: "SHA-256:33ab…5e0c", ctrl: "A.7.3", msg: "Training data provenance · 12 datasets · consent logged" },
      { id: "SHA-256:80fd…7241", ctrl: "A.9.3", msg: "Reviewer gate · model release v3.2 · approved" },
    ],
    ctaTitle: "Get ISO 42001 ready.",
    ctaAccent: "ready",
  },
};

export interface HaloComplianceTemplateProps {
  framework: Framework;
}

export default function HaloComplianceTemplate({ framework }: HaloComplianceTemplateProps) {
  const f = FRAMEWORK_CONFIG[framework];
  const tick = useTicker(1, 9999, 600);
  // Tiny oscillation so the headline score feels "live" — reduced-motion
  // users still see it, it just doesn't animate.
  const score = f.controlsScore + Math.sin(tick / 8) * 0.4;
  const passPct = (f.controlsPass / f.controlsTotal) * 100;

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
            <p className="halo-eyebrow">{f.eyebrow}</p>
            <div className="mt-5 inline-flex items-center gap-2.5 rounded-full border border-border-strong px-3.5 py-1.5">
              <span
                aria-hidden="true"
                className="inline-block h-1.5 w-1.5 rounded-sm bg-accent shadow-[0_0_8px_var(--accent)]"
              />
              <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-text">
                {f.badge}
              </span>
            </div>
            <h1 className="mt-5 font-display font-medium leading-[0.98] tracking-tightest text-text text-[clamp(48px,7vw,76px)] [text-wrap:balance]">
              {f.heroLead}
              <br />
              <span className="halo-italic">{f.heroAccent}</span>
            </h1>
            <p className="mt-7 max-w-[540px] font-sans text-lg leading-[1.55] text-text-muted">
              {f.heroLede}
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link href="/contact" className="halo-btn-accent">
                Get {f.name} ready <span className="halo-arrow" aria-hidden="true">&rarr;</span>
              </Link>
              <Link href="/contact" className="halo-btn-ghost">
                Talk to an expert
              </Link>
            </div>
          </div>

          {/* Live posture card */}
          <aside className="halo-card relative overflow-hidden p-7">
            <div className="flex items-baseline justify-between">
              <p className="halo-label">§ Live posture</p>
              <div className="flex items-center gap-1.5 font-mono text-[11px] text-accent">
                <span
                  aria-hidden="true"
                  className="inline-block h-1.5 w-1.5 rounded-sm bg-accent animate-halo-pulse"
                />
                Scanning
              </div>
            </div>

            <div className="mt-5 flex items-baseline gap-2.5">
              <div
                className="font-display text-[56px] font-medium leading-none tracking-[-0.03em] text-accent tabular-nums"
                aria-label={`${score.toFixed(1)} out of 100`}
              >
                {score.toFixed(1)}
              </div>
              <div className="font-mono text-xs text-text-muted">/ 100</div>
            </div>
            <p className="mt-1 font-mono text-xs text-text-muted">
              {f.controlsPass} of {f.controlsTotal} controls passing
            </p>

            {/* Control cells grid — live sweep */}
            <div
              aria-hidden="true"
              className="mt-5 grid gap-[3px]"
              style={{ gridTemplateColumns: "repeat(auto-fill, minmax(14px, 1fr))" }}
            >
              {Array.from({ length: f.controlsTotal }).map((_, i) => {
                const passing = i < f.controlsPass;
                const sweep = Math.floor(tick / 3) % f.controlsTotal === i;
                const cls = passing
                  ? sweep
                    ? "bg-text opacity-100"
                    : "bg-accent opacity-75"
                  : "bg-warn opacity-80";
                return (
                  <span
                    key={i}
                    className={`h-3.5 rounded-[2px] transition-[background-color,opacity] duration-200 ${cls}`}
                  />
                );
              })}
            </div>

            <div className="mt-5 flex flex-wrap gap-1.5">
              {f.trustCriteria.map((c) => (
                <span
                  key={c}
                  className="rounded-[3px] border border-border bg-surface-alt px-2.5 py-1 font-mono text-[10.5px] tracking-[0.06em] text-text-muted"
                >
                  {c}
                </span>
              ))}
            </div>
          </aside>
        </div>
      </section>

      {/* ── Control groups ──────────────────────────────────────── */}
      <section className="border-b border-border px-6 py-24 sm:px-12">
        <HaloSectionHead
          eyebrow="§ 01 · Control map"
          title={`Every ${f.name} group, scored continuously.`}
          blurb="Every control family gets a live posture score. Drill into any group to see the findings and evidence that drove it."
        />
        <div className="mx-auto mt-12 max-w-[1160px] overflow-hidden rounded-[12px] border border-border bg-surface">
          <div className="grid grid-cols-[110px_1fr_80px_160px_70px] items-center border-b border-border px-6 py-3.5 font-mono text-[10.5px] uppercase tracking-[0.14em] text-text-dim">
            <span>Group</span>
            <span>Scope</span>
            <span>Controls</span>
            <span>Posture</span>
            <span className="text-right">Score</span>
          </div>
          {f.controlGroups.map((g, i) => {
            const pct = (g.ok / g.c) * 100;
            const active = i === Math.floor(tick / 4) % f.controlGroups.length;
            const full = pct === 100;
            return (
              <div
                key={g.k}
                className={`grid grid-cols-[110px_1fr_80px_160px_70px] items-center border-l-2 px-6 py-4 transition-colors ${
                  active
                    ? "border-l-accent bg-[color:var(--accent-glow)]"
                    : "border-l-transparent"
                } ${i < f.controlGroups.length - 1 ? "border-b border-b-border" : ""}`}
              >
                <span className="font-mono text-[12.5px] tracking-[0.08em] text-accent">
                  {g.k}
                </span>
                <span className="font-sans text-sm text-text">{g.t}</span>
                <span className="font-mono text-xs text-text-muted tabular-nums">
                  {g.ok}/{g.c}
                </span>
                <div className="h-[5px] overflow-hidden rounded-[3px] bg-border">
                  <div
                    className={`h-full transition-[width] duration-500 ${full ? "bg-accent" : "bg-warn"}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span
                  className={`text-right font-mono text-xs tabular-nums ${full ? "text-accent" : "text-text"}`}
                >
                  {pct.toFixed(0)}%
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Capabilities ────────────────────────────────────────── */}
      <section className="border-b border-border px-6 py-24 sm:px-12">
        <HaloSectionHead
          eyebrow="§ 02 · Capabilities"
          title="How BLACKFYRE runs your programme."
        />
        <div className="mx-auto mt-12 grid max-w-[1280px] grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {f.features.map((fe, i) => {
            const active = i === tick % f.features.length;
            return (
              <article
                key={fe.t}
                className="halo-card relative overflow-hidden p-6 transition-colors hover:border-border-strong"
              >
                {active && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 top-0 h-[2px] bg-accent opacity-60"
                  />
                )}
                <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-accent">
                  {String(i + 1).padStart(2, "0")}
                </div>
                <h3 className="mt-2.5 font-sans text-[20px] font-medium tracking-[-0.02em] text-text">
                  {fe.t}
                </h3>
                <p className="mt-2.5 font-sans text-sm leading-[1.55] text-text-muted">
                  {fe.d}
                </p>
              </article>
            );
          })}
        </div>
      </section>

      {/* ── Evidence strip ──────────────────────────────────────── */}
      <section className="border-b border-border px-6 py-24 sm:px-12">
        <HaloSectionHead
          eyebrow="§ 03 · Evidence"
          title="Recent evidence, chained and pinned."
          blurb="Every scan writes a SHA-256-pinned artefact to your WORM vault. Auditors verify independently with chain certificates."
        />
        <div className="mx-auto mt-12 max-w-[1160px] overflow-hidden rounded-[12px] border border-border bg-surface">
          <div className="flex items-center justify-between border-b border-border px-6 py-3.5">
            <p className="halo-label">§ Evidence feed</p>
            <span className="flex items-center gap-1.5 font-mono text-[10.5px] text-accent">
              <span
                aria-hidden="true"
                className="inline-block h-1.5 w-1.5 rounded-sm bg-accent animate-halo-pulse"
              />
              Live
            </span>
          </div>
          {f.evidence.map((e, i) => (
            <div
              key={e.id}
              className={`grid grid-cols-[minmax(0,220px)_110px_1fr] items-center gap-4 px-6 py-3.5 font-mono text-[12px] ${
                i < f.evidence.length - 1 ? "border-b border-border" : ""
              }`}
            >
              <span className="truncate text-text-dim">{e.id}</span>
              <span className="text-accent">{e.ctrl}</span>
              <span className="truncate font-sans text-[13.5px] text-text-muted">
                {e.msg}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Timeline ────────────────────────────────────────────── */}
      <section className="border-b border-border px-6 py-24 sm:px-12">
        <HaloSectionHead
          eyebrow="§ 04 · Journey"
          title={`Your path to ${f.name}.`}
          blurb="Six stations. Evidence stacking at every stop."
        />
        <div className="relative mx-auto mt-12 max-w-[1160px]">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute bottom-10 left-10 top-10 w-px bg-border"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-10 top-10 w-px bg-accent shadow-[0_0_10px_var(--accent)] transition-[height] duration-500"
            style={{ height: `${((tick % 24) / 24) * 80}%` }}
          />
          {f.timeline.map((s, i) => (
            <div
              key={s.n}
              className={`relative grid grid-cols-[80px_1fr_140px] items-start gap-6 py-7 ${
                i < f.timeline.length - 1 ? "border-b border-border" : ""
              }`}
            >
              <div className="relative">
                <div className="ml-6 flex h-7 w-7 items-center justify-center rounded-full border-2 border-accent bg-bg font-mono text-[11px] font-semibold text-accent shadow-[0_0_12px_color-mix(in_oklab,var(--accent)_40%,transparent)]">
                  {s.n}
                </div>
              </div>
              <div className="pl-6">
                <div className="font-display text-[22px] font-medium tracking-[-0.02em] text-text">
                  {s.t}
                </div>
                <p className="mt-1.5 font-sans text-sm leading-[1.55] text-text-muted">
                  {s.d}
                </p>
              </div>
              <div className="pt-1.5 text-right font-mono text-[11.5px] tracking-[0.1em] text-accent">
                {s.when}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Posture proof band ──────────────────────────────────── */}
      <section className="border-b border-border px-6 py-20 sm:px-12">
        <div className="mx-auto grid max-w-[1160px] grid-cols-2 gap-4 sm:grid-cols-4">
          {(
            [
              { k: "Controls", v: `${f.controlsTotal}` },
              { k: "Passing", v: `${f.controlsPass}` },
              { k: "At-risk", v: `${f.controlsTotal - f.controlsPass}` },
              { k: "Coverage", v: `${passPct.toFixed(1)}%` },
            ] as const
          ).map((s) => (
            <div
              key={s.k}
              className="halo-card flex flex-col gap-2 p-5"
            >
              <span className="halo-label">{s.k}</span>
              <span className="font-display text-[32px] font-medium leading-none tracking-[-0.02em] text-text tabular-nums">
                {s.v}
              </span>
            </div>
          ))}
        </div>
      </section>

      <HaloCTA
        title={f.ctaTitle}
        titleAccent={f.ctaAccent}
        sub="Two-click connect. First findings and mapped evidence inside 10 minutes."
        primaryLabel={`Start ${f.name}`}
        primaryHref="/contact"
        secondaryLabel="Book a call"
        secondaryHref="/contact"
      />

      <HaloFooter />
    </>
  );
}
