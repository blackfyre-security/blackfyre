import type { Metadata } from "next";
import {
  ShieldCheck,
  Lock,
  KeyRound,
  Database,
  Network,
  Search,
  ScanLine,
  CheckCircle2,
  FileCheck2,
  Server,
} from "lucide-react";

import HaloNav from "@/components/halo/HaloNav";
import HaloFooter from "@/components/halo/HaloFooter";

import Section from "@/components/vibrant/Section";
import SectionHead from "@/components/vibrant/SectionHead";
import StatRow from "@/components/vibrant/StatRow";
import IconTile from "@/components/vibrant/IconTile";
import LogoRow from "@/components/vibrant/LogoRow";
import StepTimeline from "@/components/vibrant/StepTimeline";
import { CaseStudyCardDark } from "@/components/vibrant/Cards";
import HeroThreatScan from "@/components/vibrant/heroes/HeroThreatScan";
import { LimeButton, GhostButton, GitHubIcon } from "@/components/vibrant/buttons";

import { SITE, DOCS } from "@/data/site";
import { AUDITOR_COUNT } from "@/data/auditors";
import { FRAMEWORK_COUNT, TOTAL_CONTROLS } from "@/data/frameworks";

export const metadata: Metadata = {
  title: "Security — Blackfyre",
  description:
    "How Blackfyre stays safe: read-only least-privilege scanning, database-enforced tenant isolation, tamper-evident evidence, and private vulnerability disclosure — all in the open.",
};

// Resolve a docs URL by a title fragment so links stay bound to the single
// source of truth in @/data/site. Falls back to the repo root.
function docUrl(needle: string): string {
  return DOCS.find((d) => d.title.toLowerCase().includes(needle.toLowerCase()))?.url ?? SITE.repoUrl;
}

const SECURITY_POLICY_URL = docUrl("Security Policy");
const DATA_POLICY_URL = docUrl("Data collection policy");
const RLS_ADR_URL = docUrl("Multi-tenancy via Postgres");
const ADVISORY_URL = `${SITE.repoUrl}/security/advisories/new`;

/* ── tiny dark-card illustrations (mono, on #09090e) ────────────────────── */
const IllRow = ({ k, v, c }: { k: string; v: string; c: string }) => (
  <div className="flex items-center justify-between font-mono text-[9px]">
    <span className="text-zinc-500">{k}</span>
    <span className={c}>{v}</span>
  </div>
);
const RoleIll = () => (
  <div className="w-full space-y-1.5 px-4">
    <IllRow k="grant type" v="cross-account IAM" c="text-blue-400" />
    <IllRow k="write keys" v="✕ never held" c="text-zinc-400" />
    <IllRow k="access" v="read-only" c="text-blue-400" />
  </div>
);
const ScopeIll = () => (
  <div className="w-full space-y-1.5 px-4">
    <IllRow k="permissions" v="per-auditor" c="text-purple-400" />
    <IllRow k="write actions" v="✕ none requested" c="text-zinc-400" />
    <IllRow k="assume-role" v="per run" c="text-purple-400" />
  </div>
);
const MinDataIll = () => (
  <div className="w-full space-y-1.5 px-4">
    <IllRow k="pii" v="✕ never read" c="text-emerald-400" />
    <IllRow k="customer records" v="✕ never read" c="text-emerald-400" />
    <IllRow k="what it reads" v="posture only" c="text-zinc-400" />
  </div>
);
const CredIll = () => (
  <div className="w-full space-y-1.5 px-4">
    <IllRow k="standing creds" v="✕ none" c="text-pink-400" />
    <IllRow k="secrets on queue" v="✕ forbidden" c="text-pink-400" />
    <IllRow k="lifetime" v="scoped to run" c="text-zinc-400" />
  </div>
);

// § 02 — scanning stays safe -------------------------------------------------
const SCAN_SAFE: readonly string[] = [
  "Cross-account access is a READ-ONLY IAM role — Blackfyre is granted, never handed, your keys.",
  "No write permissions are ever requested; the scan role cannot mutate your account.",
  "Least-privilege by construction — permissions are scoped to the posture data each auditor reads.",
  "Scan workers hold no standing customer credentials; they assume the read-only role per run.",
];

const NEVER_COLLECTED: readonly string[] = [
  "Passwords, private keys, or secret values",
  "Customer PII or business data",
  "File contents, database records, or application data",
  "Network traffic payloads or packet contents",
];

const SCAN_CARDS = [
  {
    badge: "ACCESS",
    icon: Lock,
    title: "Read-only cross-account IAM",
    desc: "Blackfyre is granted a read-only role in your account — it is never handed a write key and cannot mutate your infrastructure.",
    accent: "blue" as const,
    ill: <RoleIll />,
  },
  {
    badge: "LEAST-PRIVILEGE",
    icon: ShieldCheck,
    title: "Scoped to what it reads",
    desc: "Permissions are scoped to the posture data each auditor reads. No write actions are requested; roles are assumed per run.",
    accent: "purple" as const,
    ill: <ScopeIll />,
  },
  {
    badge: "MINIMUM-DATA",
    icon: Search,
    title: "Never PII, records, or content",
    desc: "It reads posture, not data. No customer PII, no business records, no file contents — anything out of scope is dropped and logged.",
    accent: "emerald" as const,
    ill: <MinDataIll />,
  },
  {
    badge: "NO STANDING CREDS",
    icon: KeyRound,
    title: "Nothing left holding the keys",
    desc: "Workers keep no standing credentials and secrets never ride a queue — the role is assumed for the run and nothing outlives it.",
    accent: "pink" as const,
    ill: <CredIll />,
  },
];

// § 03 — platform hardening (IconTile grid) ----------------------------------
const HARDENING = [
  {
    icon: Database,
    title: "Postgres RLS · fails closed",
    desc: "Tenant isolation is enforced by row-level security below the ORM — request-scoped and fails closed if the tenant is unset (ADR-0001).",
    accent: "blue" as const,
  },
  {
    icon: KeyRound,
    title: "Argon2id credentials",
    desc: "Passwords and API keys are hashed with Argon2id; runtime secrets live in AWS Secrets Manager per stage, never in code.",
    accent: "purple" as const,
  },
  {
    icon: ShieldCheck,
    title: "JWT + MFA, SSO, SCIM",
    desc: "JWT sessions with MFA, Google SSO, SAML, and SCIM provisioning; roles are auditor-scoped so access is least-privilege by default.",
    accent: "blue" as const,
  },
  {
    icon: CheckCircle2,
    title: "CSRF double-submit",
    desc: "State-changing requests clear a double-submit CSRF token layered over the auth check and the RLS-bound request connection.",
    accent: "amber" as const,
  },
  {
    icon: Lock,
    title: "AES-256-GCM at the field",
    desc: "Sensitive fields are encrypted with AES-256-GCM before they reach the database — AES-256 at rest, TLS 1.3 in transit.",
    accent: "emerald" as const,
  },
  {
    icon: Network,
    title: "mTLS & DLP hooks",
    desc: "Optional mTLS and DLP plugins extend the perimeter for teams needing mutual authentication or data-loss controls at the edge.",
    accent: "pink" as const,
  },
];

// The request path every read clears — defense in depth, in order.
const REQUEST_PATH = [
  { n: "01", title: "Authenticate", desc: "A JWT session or Argon2id-hashed API key is verified — MFA and SSO enforced where enabled." },
  { n: "02", title: "CSRF check", desc: "State-changing requests must carry a matching double-submit CSRF token." },
  { n: "03", title: "Bind the tenant", desc: "The request opens a tenant-scoped Postgres connection that fails closed if the tenant is unset." },
  { n: "04", title: "Read a row", desc: "Row-level security enforces isolation in the database, below the ORM — not in application code." },
];

// § 04 — tamper-evident evidence ---------------------------------------------
const EVIDENCE = [
  {
    label: "INTEGRITY",
    title: "SHA-256 per item",
    desc: "Each evidence item is hashed on write. Re-hash the artefact later and the digest either matches or the tamper is visible.",
  },
  {
    label: "IMMUTABILITY",
    title: "S3 Object Lock + versioning",
    desc: "Artefacts are written once with S3 Object Lock and versioning — they cannot be silently overwritten or deleted within the retention window.",
  },
  {
    label: "CONFIDENTIALITY",
    title: "AES-256-GCM PII",
    desc: "PII inside evidence is encrypted with AES-256-GCM before storage, so the vault holds proof without holding readable secrets.",
  },
];

// § 05 — disclosure timeline (from SECURITY.md) ------------------------------
const TIMELINE: readonly { when: string; action: string }[] = [
  { when: "within 72h", action: "Initial acknowledgement" },
  { when: "within 7 days", action: "Triage + severity assessment" },
  { when: "within 90 days", action: "Patch released (sooner for critical)" },
  { when: "at patch release", action: "Coordinated disclosure with credit, if wanted" },
];

const HERO_CHIPS = ["Read-only scanning", "Postgres RLS", "SHA-256 evidence", "Apache-2.0", "Private disclosure"];

export default function SecurityPage() {
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
              eyebrow="Security · Apache-2.0"
              eyebrowIcon={<ShieldCheck className="h-3.5 w-3.5" />}
              title={<>Security,<br /></>}
              accentWord="in the open."
              sub={
                <>
                  Blackfyre is a compliance and security platform, so its own controls are engineered,
                  documented, and <strong className="font-semibold text-zinc-900">auditable line by line</strong> in
                  a public repository. Read-only scanning, database-enforced isolation, tamper-evident
                  evidence, and a private disclosure process. No trust required — verify it yourself.
                </>
              }
            />
            <div className="mt-8 flex flex-wrap gap-3">
              <LimeButton href={SITE.repoUrl} external icon={<GitHubIcon />}>
                Star on GitHub
              </LimeButton>
              <GhostButton href={SECURITY_POLICY_URL} external>
                Security policy
              </GhostButton>
            </div>

            <div className="mt-8 flex flex-wrap gap-1.5">
              {HERO_CHIPS.map((chip) => (
                <span
                  key={chip}
                  className="rounded-md border border-zinc-200 bg-zinc-50 px-2.5 py-1 font-mono text-[10.5px] uppercase tracking-[0.1em] text-zinc-500"
                >
                  {chip}
                </span>
              ))}
            </div>

            <StatRow
              className="mt-10"
              kicker="Verifiable posture"
              stats={[
                { value: String(AUDITOR_COUNT), label: "Read-only auditors", color: "text-blue-600" },
                { value: String(FRAMEWORK_COUNT), label: "Frameworks" },
                { value: String(TOTAL_CONTROLS), label: "Controls" },
                { value: "Free", label: "Apache-2.0" },
              ]}
            />
          </div>

          <div className="hidden lg:block">
            <HeroThreatScan />
          </div>
        </div>

        <LogoRow
          label="Hardened with"
          items={[
            "Postgres · RLS",
            "Argon2id",
            "AES-256-GCM",
            "TLS 1.3",
            "S3 Object Lock",
            "JWT + MFA",
            "SAML / SCIM",
          ]}
        />
      </Section>

      {/* ── SCANNING · dark · purple ────────────────────────────────────── */}
      <Section variant="dark">
        <div className="grid gap-16 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div className="lg:sticky lg:top-12">
            <SectionHead
              accent="purple"
              on="dark"
              eyebrow="Scanning"
              eyebrowIcon={<ScanLine className="h-3.5 w-3.5" />}
              title="How scanning"
              accentWord="stays safe."
              sub="Blackfyre reads your posture and nothing else. It is granted a read-only, least-privilege cross-account role — it never holds write keys, and it never collects the data an attacker would want."
            />
            <ul className="mt-8 space-y-4">
              {SCAN_SAFE.map((item) => (
                <li key={item} className="flex gap-3">
                  <ShieldCheck className="mt-0.5 h-5 w-5 flex-shrink-0 text-purple-400" />
                  <p className="text-sm leading-relaxed text-zinc-400">{item}</p>
                </li>
              ))}
            </ul>

            <div className="mt-8 rounded-2xl border border-zinc-900 bg-zinc-950 p-6">
              <p className="font-mono text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                What it never collects
              </p>
              <ul className="mt-4 space-y-2.5">
                {NEVER_COLLECTED.map((item) => (
                  <li key={item} className="flex gap-2.5">
                    <span aria-hidden className="mt-0.5 shrink-0 font-mono text-[13px] text-zinc-600">
                      ✕
                    </span>
                    <span className="text-xs leading-relaxed text-zinc-400">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-8">
              <GhostButton href={DATA_POLICY_URL} external on="dark">
                Data-collection policy
              </GhostButton>
            </div>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            {SCAN_CARDS.map((c) => (
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

      {/* ── HARDENING · warm · amber ────────────────────────────────────── */}
      <Section variant="warm">
        <div className="grid gap-16 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div className="lg:sticky lg:top-12">
            <SectionHead
              accent="amber"
              on="light"
              eyebrow="Hardening"
              eyebrowIcon={<KeyRound className="h-3.5 w-3.5" />}
              title="Defense in depth,"
              accentWord="enforced by the database."
              accentStyle="solid"
              sub="Isolation lives below the ORM, credentials are hashed with Argon2id, and every request clears auth, CSRF, and a tenant-bound connection before it reads a row."
            />
            <div className="mt-10">
              <p className="mb-6 font-mono text-[11px] font-semibold uppercase tracking-wider text-amber-700">
                The path every read clears
              </p>
              <StepTimeline steps={REQUEST_PATH} accent="amber" />
            </div>
            <div className="mt-8">
              <GhostButton href={RLS_ADR_URL} external>
                Read ADR-0001 · RLS multi-tenancy
              </GhostButton>
            </div>
          </div>

          <div className="grid gap-1 sm:grid-cols-2">
            {HARDENING.map((h) => (
              <IconTile key={h.title} icon={h.icon} title={h.title} desc={h.desc} accent={h.accent} />
            ))}
          </div>
        </div>
      </Section>

      {/* ── EVIDENCE · light · emerald ──────────────────────────────────── */}
      <Section variant="light">
        <SectionHead
          accent="emerald"
          on="light"
          align="center"
          eyebrow="Evidence"
          eyebrowIcon={<FileCheck2 className="h-3.5 w-3.5" />}
          title="Evidence you can"
          accentWord="prove wasn't touched."
          sub="Every artefact in the vault carries a cryptographic integrity hash and lands in immutable storage, so an auditor can verify the chain instead of taking your word for it."
          className="mx-auto max-w-[720px]"
        />

        <div className="mx-auto mt-14 grid max-w-[1080px] gap-6 sm:grid-cols-3">
          {EVIDENCE.map((e) => (
            <div
              key={e.title}
              className="group rounded-2xl border border-zinc-200/80 bg-white p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-50 text-green-600 transition-colors duration-300 group-hover:bg-green-600 group-hover:text-white">
                <ShieldCheck className="h-5 w-5" />
              </span>
              <p className="mt-5 font-mono text-[10.5px] font-semibold uppercase tracking-[0.14em] text-emerald-600">
                {e.label}
              </p>
              <h3 className="mt-2 text-lg font-bold text-zinc-900">{e.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-500">{e.desc}</p>
            </div>
          ))}
        </div>

        <StatRow
          className="mx-auto mt-8 max-w-[1080px]"
          cols="grid-cols-2 sm:grid-cols-4"
          stats={[
            { value: "SHA-256", label: "Per-item hash", color: "text-emerald-600" },
            { value: "WORM", label: "S3 Object Lock" },
            { value: "Versioned", label: "No silent delete" },
            { value: "AES-256-GCM", label: "PII encryption" },
          ]}
        />
      </Section>

      {/* ── DISCLOSURE + close · dark · pink → lime ─────────────────────── */}
      <Section variant="dark">
        <SectionHead
          accent="pink"
          on="dark"
          eyebrow="Disclosure"
          eyebrowIcon={<Server className="h-3.5 w-3.5" />}
          title="Found something?"
          accentWord="Tell us privately."
          sub="We follow coordinated disclosure. Report privately and we credit you on release if you'd like. We do not chase researchers acting in good faith."
        />

        <div className="mt-12 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-2xl border border-zinc-900 bg-zinc-950 p-7">
            <p className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.14em] text-pink-400">
              How to report
            </p>
            <p className="mt-3 text-sm leading-relaxed text-zinc-400">
              Please do not open a public issue. Use GitHub private vulnerability reporting on the
              repository, or email the security address. Include a description, impact, and steps to
              reproduce.
            </p>
            <div className="mt-5 flex flex-col gap-2.5">
              <a
                href={ADVISORY_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 font-mono text-[13px] font-semibold text-pink-400 hover:text-pink-300"
              >
                <GitHubIcon className="h-3.5 w-3.5" />
                Open a GitHub private advisory
              </a>
              <a href="mailto:security@blackfyre.tech?subject=Security%20report" className="font-mono text-[13px] text-zinc-300">
                security@blackfyre.tech
              </a>
            </div>
            <p className="mt-5 text-xs leading-relaxed text-zinc-500">
              In scope: the code in this repository — auth bypasses, IDOR, injection, XSS/CSRF, SSRF,
              credential leaks, cross-tenant leakage, and crypto weaknesses. Full scope lives in the
              security policy.
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-900 bg-zinc-950 p-7">
            <p className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
              What to expect
            </p>
            <div className="mt-4 font-mono text-xs">
              {TIMELINE.map((row) => (
                <div
                  key={row.when}
                  className="flex items-start justify-between gap-4 border-b border-zinc-900 py-3 last:border-b-0"
                >
                  <span className="shrink-0 tracking-[0.06em] text-pink-400">{row.when}</span>
                  <span className="text-right leading-[1.45] text-zinc-400">{row.action}</span>
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs leading-relaxed text-zinc-500">
              Critical issues affecting auth or customer data get same-day attention. Dependencies are
              watched with Dependabot and GitHub secret scanning.
            </p>
          </div>
        </div>

        {/* ── closing lime CTA ──────────────────────────────────────────── */}
        <div className="mt-16 flex flex-col items-center border-t border-zinc-900 pt-16 text-center">
          <SectionHead
            accent="lime"
            on="dark"
            align="center"
            eyebrow="Verify"
            eyebrowIcon={<CheckCircle2 className="h-3.5 w-3.5" />}
            title="Don't trust it —"
            accentWord="read it."
            sub="Every control on this page is implemented in a public, Apache-2.0 repository. Clone it, audit it, and self-host it for free."
            className="items-center"
          />
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <LimeButton href={SITE.repoUrl} external icon={<GitHubIcon />}>
              Star on GitHub
            </LimeButton>
            <GhostButton href={SECURITY_POLICY_URL} external on="dark">
              Read SECURITY.md
            </GhostButton>
          </div>
        </div>
      </Section>

      <HaloFooter />
    </>
  );
}
