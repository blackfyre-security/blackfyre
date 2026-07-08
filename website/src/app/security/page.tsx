import type { Metadata } from "next";
import HaloNav from "@/components/halo/HaloNav";
import HaloFooter from "@/components/halo/HaloFooter";
import HaloSectionHead from "@/components/halo/HaloSectionHead";
import HaloCTA from "@/components/halo/HaloCTA";
import HaloReveal from "@/components/halo/HaloReveal";
import { SITE, DOCS } from "@/data/site";

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
const EVIDENCE_ADVISORY_URL = `${SITE.repoUrl}/security/advisories/new`;

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

// § 03 — platform hardening --------------------------------------------------
interface Control {
  label: string;
  title: string;
  desc: string;
  tags: readonly string[];
}

const CONTROLS: readonly Control[] = [
  {
    label: "TENANCY",
    title: "Isolation below the ORM",
    desc: "Multi-tenancy is enforced by Postgres 16 row-level security, not application code: a non-owner database role, FORCE ROW LEVEL SECURITY, and a request-scoped tenant binding that fails closed if the tenant is ever unset.",
    tags: ["Postgres RLS", "fails closed", "ADR-0001"],
  },
  {
    label: "SECRETS",
    title: "Argon2id credential hashing",
    desc: "Passwords and API keys are hashed with Argon2id. Runtime secrets live in AWS Secrets Manager per stage — never in code, never on a queue.",
    tags: ["Argon2id", "Secrets Manager"],
  },
  {
    label: "AUTH",
    title: "Enterprise authentication",
    desc: "JWT sessions with MFA, Google SSO, SAML, and SCIM provisioning. Roles are auditor-scoped (owner / admin / engineer / viewer / auditor) so access is least-privilege by default.",
    tags: ["JWT + MFA", "SSO / SAML", "SCIM"],
  },
  {
    label: "REQUESTS",
    title: "CSRF double-submit",
    desc: "State-changing requests are guarded by a double-submit CSRF token, layered on top of the JWT / API-key check and the RLS-bound request connection.",
    tags: ["CSRF", "defense-in-depth"],
  },
  {
    label: "CRYPTO",
    title: "AES-256-GCM at the field",
    desc: "Sensitive fields are encrypted with AES-256-GCM before they hit the database. Everything is AES-256 at rest and TLS 1.3 in transit.",
    tags: ["AES-256-GCM", "TLS 1.3"],
  },
  {
    label: "PLUGINS",
    title: "mTLS & DLP hooks",
    desc: "Optional mTLS and DLP plugins extend the perimeter for teams that need mutual authentication or data-loss controls at the edge.",
    tags: ["mTLS", "DLP"],
  },
];

// § 05 — disclosure timeline (from SECURITY.md) ------------------------------
interface TimelineRow {
  when: string;
  action: string;
}

const TIMELINE: readonly TimelineRow[] = [
  { when: "within 72h", action: "Initial acknowledgement" },
  { when: "within 7 days", action: "Triage + severity assessment" },
  { when: "within 90 days", action: "Patch released (sooner for critical)" },
  { when: "at patch release", action: "Coordinated disclosure with credit, if wanted" },
];

function Check() {
  return (
    <span aria-hidden="true" className="mt-0.5 shrink-0 font-mono text-[13px] text-accent">
      ✓
    </span>
  );
}

export default function SecurityPage() {
  return (
    <>
      <HaloNav />

      {/* ── Hero ────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-border bg-surface">
        <div className="halo-hero-glow" aria-hidden="true" />
        <div className="relative mx-auto max-w-[1280px] px-6 py-24 sm:px-12 sm:py-28">
          <p className="halo-eyebrow">
            <span className="halo-live-dot" aria-hidden="true" />
            § 01 · Security
          </p>
          <h1 className="mt-5 max-w-[860px] font-display font-medium leading-[1.05] tracking-tightest text-text text-[clamp(44px,5.6vw,68px)] [text-wrap:balance]">
            Security, in the{" "}
            <span className="text-accent italic font-normal">open.</span>
          </h1>
          <p className="mt-6 max-w-[640px] font-sans text-[17px] leading-[1.55] text-text-muted">
            Blackfyre is a compliance and security platform, so its own controls
            are engineered, documented, and auditable — every one of them in a
            public repository you can read line by line. Read-only scanning,
            database-enforced tenant isolation, tamper-evident evidence, and a
            private disclosure process. No trust required; verify it yourself.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a
              href={SITE.repoUrl}
              target="_blank"
              rel="noreferrer"
              className="halo-btn-accent"
            >
              View source{" "}
              <span className="halo-arrow" aria-hidden="true">
                &rarr;
              </span>
            </a>
            <a
              href={SECURITY_POLICY_URL}
              target="_blank"
              rel="noreferrer"
              className="halo-btn-ghost"
            >
              Security policy
            </a>
          </div>
          <div className="mt-9 flex flex-wrap gap-1.5">
            {["Read-only scanning", "Postgres RLS", "SHA-256 evidence", "Apache-2.0", "Private disclosure"].map(
              (chip) => (
                <span
                  key={chip}
                  className="rounded-md border border-border bg-surface-alt px-2.5 py-1 font-mono text-[10.5px] uppercase tracking-[0.1em] text-text-muted"
                >
                  {chip}
                </span>
              ),
            )}
          </div>
        </div>
      </section>

      {/* ── § 02 · How scanning stays safe ──────────────────────── */}
      <HaloReveal as="section" delay={0} className="border-b border-border px-6 py-24 sm:px-12">
        <HaloSectionHead
          eyebrow="§ 02 · Scanning"
          title="Read-only by design. Minimum data by policy."
          titleAccent="Read-only"
          blurb="Blackfyre reads your posture and nothing else. It is granted a read-only, least-privilege cross-account role — it never holds write keys, and it never collects the data an attacker would want."
        />
        <div className="mx-auto mt-12 grid max-w-[1080px] grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="halo-card halo-card-hover p-7">
            <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-accent">
              Least-privilege access
            </div>
            <h3 className="mt-3 font-sans text-[20px] font-medium tracking-[-0.02em] text-text">
              What the scan role can do
            </h3>
            <ul className="mt-5 flex flex-col gap-3">
              {SCAN_SAFE.map((item) => (
                <li key={item} className="flex gap-2.5">
                  <Check />
                  <span className="font-sans text-[14px] leading-[1.5] text-text-muted">
                    {item}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="halo-card halo-card-hover p-7">
            <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-text-dim">
              Minimum-data collection
            </div>
            <h3 className="mt-3 font-sans text-[20px] font-medium tracking-[-0.02em] text-text">
              What it never touches
            </h3>
            <ul className="mt-5 flex flex-col gap-3">
              {NEVER_COLLECTED.map((item) => (
                <li key={item} className="flex gap-2.5">
                  <span
                    aria-hidden="true"
                    className="mt-0.5 shrink-0 font-mono text-[13px] text-text-dim"
                  >
                    ✕
                  </span>
                  <span className="font-sans text-[14px] leading-[1.5] text-text-muted">
                    {item}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-5 font-sans text-[13px] leading-[1.5] text-text-dim">
              Every finding is validated against an allowed-scopes list before it is
              written; anything out of scope is dropped and logged.
            </p>
            <a
              href={DATA_POLICY_URL}
              target="_blank"
              rel="noreferrer"
              className="halo-arrow-parent mt-5 inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-[0.06em] text-accent"
            >
              Data-collection policy{" "}
              <span className="halo-arrow" aria-hidden="true">
                &rarr;
              </span>
            </a>
          </div>
        </div>
      </HaloReveal>

      {/* ── § 03 · Platform hardening ───────────────────────────── */}
      <HaloReveal as="section" delay={0} className="border-b border-border px-6 py-24 sm:px-12">
        <HaloSectionHead
          eyebrow="§ 03 · Hardening"
          title="Defense in depth, enforced by the database."
          titleAccent="database"
          blurb="Isolation lives below the ORM, credentials are hashed with Argon2id, and every request clears auth, CSRF, and a tenant-bound connection before it reads a row."
        />
        <div className="mx-auto mt-12 grid max-w-[1160px] grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CONTROLS.map((c) => (
            <article key={c.title} className="halo-card halo-card-hover flex flex-col p-6">
              <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-accent">
                {c.label}
              </div>
              <h3 className="mt-3 font-sans text-[17px] font-medium tracking-[-0.02em] text-text">
                {c.title}
              </h3>
              <p className="mt-2.5 flex-1 font-sans text-[13.5px] leading-[1.55] text-text-muted">
                {c.desc}
              </p>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {c.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-md border border-border bg-surface-alt px-2 py-0.5 font-mono text-[10.5px] text-text-muted"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </article>
          ))}
        </div>
        <div className="mx-auto mt-6 max-w-[1160px]">
          <a
            href={RLS_ADR_URL}
            target="_blank"
            rel="noreferrer"
            className="halo-arrow-parent inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-[0.06em] text-accent"
          >
            Read ADR-0001 · RLS multi-tenancy{" "}
            <span className="halo-arrow" aria-hidden="true">
              &rarr;
            </span>
          </a>
        </div>
      </HaloReveal>

      {/* ── § 04 · Tamper-evident evidence ──────────────────────── */}
      <HaloReveal as="section" delay={0} className="border-b border-border px-6 py-24 sm:px-12">
        <HaloSectionHead
          eyebrow="§ 04 · Evidence"
          title="Evidence you can prove wasn't touched."
          titleAccent="prove"
          blurb="Every artefact in the vault carries a cryptographic integrity hash and lands in immutable storage, so an auditor can verify the chain instead of taking your word for it."
        />
        <div className="mx-auto mt-12 grid max-w-[1080px] grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            {
              label: "INTEGRITY",
              t: "SHA-256 per item",
              d: "Each evidence item is hashed on write. Re-hash the artefact later and the digest either matches or the tamper is visible.",
            },
            {
              label: "IMMUTABILITY",
              t: "S3 Object Lock + versioning",
              d: "Artefacts are stored write-once with S3 Object Lock and versioning — they cannot be silently overwritten or deleted within the retention window.",
            },
            {
              label: "CONFIDENTIALITY",
              t: "AES-256-GCM PII encryption",
              d: "PII inside evidence is encrypted with AES-256-GCM before storage, so the vault holds proof without holding readable secrets.",
            },
          ].map((x) => (
            <div key={x.t} className="halo-card halo-card-hover p-6">
              <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-accent">
                {x.label}
              </div>
              <h3 className="mt-3 font-sans text-[16px] font-medium text-text">
                {x.t}
              </h3>
              <p className="mt-2.5 font-sans text-[13.5px] leading-[1.55] text-text-muted">
                {x.d}
              </p>
            </div>
          ))}
        </div>
      </HaloReveal>

      {/* ── § 05 · Responsible disclosure ───────────────────────── */}
      <HaloReveal as="section" delay={0} className="border-b border-border px-6 py-24 sm:px-12">
        <HaloSectionHead
          eyebrow="§ 05 · Disclosure"
          title="Found something? Tell us privately."
          titleAccent="privately"
          blurb="We follow coordinated disclosure. Report privately, and we credit you on release if you'd like. We do not chase researchers acting in good faith."
        />
        <div className="mx-auto mt-12 grid max-w-[1080px] grid-cols-1 gap-4 sm:grid-cols-[1.1fr_0.9fr]">
          <div className="halo-card p-7">
            <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-accent">
              How to report
            </div>
            <p className="mt-3 font-sans text-[14px] leading-[1.6] text-text-muted">
              Please do not open a public issue. Use GitHub private vulnerability
              reporting on the repository, or email the security address. Include
              a description, impact, and steps to reproduce.
            </p>
            <div className="mt-5 flex flex-col gap-2.5">
              <a
                href={EVIDENCE_ADVISORY_URL}
                target="_blank"
                rel="noreferrer"
                className="halo-arrow-parent inline-flex items-center gap-1.5 font-mono text-[13px] text-accent"
              >
                GitHub private advisory{" "}
                <span className="halo-arrow" aria-hidden="true">
                  &rarr;
                </span>
              </a>
              <a
                href="mailto:security@blackfyre.tech?subject=Security%20report"
                className="font-mono text-[13px] text-text"
              >
                security@blackfyre.tech
              </a>
            </div>
            <p className="mt-5 font-sans text-[12.5px] leading-[1.5] text-text-dim">
              In scope: the code in this repository — auth bypasses, IDOR, injection,
              XSS/CSRF, SSRF, credential leaks, cross-tenant leakage, and crypto
              weaknesses. Full scope lives in the security policy.
            </p>
            <a
              href={SECURITY_POLICY_URL}
              target="_blank"
              rel="noreferrer"
              className="halo-arrow-parent mt-4 inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-[0.06em] text-accent"
            >
              Read SECURITY.md{" "}
              <span className="halo-arrow" aria-hidden="true">
                &rarr;
              </span>
            </a>
          </div>

          <div className="halo-card p-7">
            <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-text-dim">
              What to expect
            </div>
            <div className="mt-4 font-mono text-xs">
              {TIMELINE.map((row) => (
                <div
                  key={row.when}
                  className="flex items-start justify-between gap-4 border-b border-border py-3 last:border-b-0"
                >
                  <span className="shrink-0 tracking-[0.06em] text-accent">
                    {row.when}
                  </span>
                  <span className="text-right leading-[1.45] text-text-muted">
                    {row.action}
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-4 font-sans text-[12.5px] leading-[1.5] text-text-dim">
              Critical issues affecting auth or customer data get same-day attention.
              Dependencies are watched with Dependabot and GitHub secret scanning.
            </p>
          </div>
        </div>
      </HaloReveal>

      <HaloCTA
        title="Don't trust it — read it."
        titleAccent="read it"
        sub="Every control on this page is implemented in a public, Apache-2.0 repository. Clone it, audit it, and self-host it for free."
        eyebrow="§ Verify"
        primaryLabel="Star on GitHub"
        primaryHref={SITE.repoUrl}
        secondaryLabel="Security policy"
        secondaryHref={SECURITY_POLICY_URL}
      />

      <HaloFooter />
    </>
  );
}
