import type { Metadata } from "next";
import { Fragment } from "react";
import Link from "next/link";
import HaloNav from "@/components/halo/HaloNav";
import HaloFooter from "@/components/halo/HaloFooter";
import HaloSectionHead from "@/components/halo/HaloSectionHead";
import HaloCTA from "@/components/halo/HaloCTA";
import HaloReveal from "@/components/halo/HaloReveal";
import { FRAMEWORKS, TOTAL_CONTROLS, FRAMEWORK_COUNT } from "@/data/frameworks";
import { AUDITOR_COUNT } from "@/data/auditors";
import { SITE, DOCS } from "@/data/site";

export const metadata: Metadata = {
  title: "Platform — Blackfyre",
  description:
    "A product tour of Blackfyre: 55 auditors across AWS, Azure, GCP and on-prem mapped to 9 frameworks and 678 controls, with a tamper-evident evidence vault. Open source, Apache-2.0.",
};

const architectureDoc =
  DOCS.find((d) => d.title === "Architecture")?.url ?? SITE.repoUrl;
const selfHostDoc =
  DOCS.find((d) => d.title === "Self-hosting Blackfyre")?.url ?? SITE.repoUrl;

interface Spec {
  k: string;
  v: string;
}

const HERO_SPECS: readonly Spec[] = [
  { k: "Auditors", v: String(AUDITOR_COUNT) },
  { k: "Frameworks", v: String(FRAMEWORK_COUNT) },
  { k: "Controls", v: String(TOTAL_CONTROLS) },
  { k: "Clouds", v: "AWS · Azure · GCP · on-prem" },
  { k: "License", v: SITE.license },
  { k: "Deploy", v: "Self-host · free" },
];

interface Stage {
  n: string;
  label: string;
  title: string;
  detail: string;
  note: string;
}

const PIPELINE: readonly Stage[] = [
  {
    n: "01",
    label: "Frontends",
    title: "Portal + Admin",
    detail:
      "Next.js 14 static exports — Portal on :3001, Admin on :3003. Served from Cloudflare Pages.",
    note: "React · Tailwind",
  },
  {
    n: "02",
    label: "API",
    title: "Fastify gateway",
    detail:
      "Fastify 4 / Node 20 on :4000. Every request is JWT + CSRF authenticated and bound to an RLS-scoped db handle.",
    note: "jose · Zod · Drizzle",
  },
  {
    n: "03",
    label: "Data plane",
    title: "Postgres · Redis · SQS",
    detail:
      "Postgres 16 with row-level security, Redis, and 4 SQS work queues each paired with a dead-letter queue.",
    note: "ADR-0001 · ADR-0002",
  },
  {
    n: "04",
    label: "Workers",
    title: "Queue consumers",
    detail:
      "SQS-triggered Lambda workers drain the scan, monitor, AI and evidence queues — at-least-once, idempotent.",
    note: "durable background work",
  },
  {
    n: "05",
    label: "Scanners",
    title: "Auditors + tools",
    detail:
      "Lightweight SDK auditors run in-process; Prowler and the IaC scanners (Checkov / Semgrep / Bandit) run as container Lambdas.",
    note: "ADR-0003",
  },
  {
    n: "06",
    label: "Evidence",
    title: "S3 evidence vault",
    detail:
      "Findings and artifacts land in S3 with Object Lock + versioning (WORM), a SHA-256 hash per item, AES-256-GCM PII encryption.",
    note: "tamper-evident",
  },
];

interface Feature {
  tag: string;
  title: string;
  body: string;
}

const FEATURES: readonly Feature[] = [
  {
    tag: "01 · Multi-cloud scanning",
    title: "55 auditors, every cloud + on-prem",
    body: "Auditors span AWS, Azure and GCP plus on-prem estates — Active Directory, SNMP devices, IdP, EDR, Kubernetes, registries, VCS and SaaS — covering IAM, storage, compute, networking, encryption, logging, database, monitoring and containers. Prowler (900+ AWS checks) and the IaC scanners Checkov, Semgrep and Bandit run as containerized Lambdas.",
  },
  {
    tag: "02 · Framework mapping",
    title: "9 frameworks · 678 controls",
    body: "Every finding maps to the specific controls it affects, with weighted per-framework scoring — so a single misconfiguration shows up against SOC 2, ISO 27001, HIPAA and the rest at once, each scored on its own terms.",
  },
  {
    tag: "03 · AI-assisted analysis",
    title: "AI with a deterministic fallback",
    body: "Gap analysis, MITRE ATT&CK mapping, remediation suggestions and the CORTEX copilot run through a provider-agnostic client — Claude via the Anthropic API or AWS Bedrock (which uses the Lambda IAM role, no key). With no key set, features degrade gracefully to deterministic heuristics.",
  },
  {
    tag: "04 · Evidence vault",
    title: "Tamper-evident by construction",
    body: "Each item carries a SHA-256 integrity hash and is written to S3 with Object Lock and versioning (WORM). PII is encrypted at the field level with AES-256-GCM. Evidence you can hand an auditor and prove has not been altered.",
  },
  {
    tag: "05 · Monitoring & drift",
    title: "Real-time monitoring & drift detection",
    body: "Continuous configuration-drift detection catches posture regressions after a passing scan, and live scan progress streams to the portal over Server-Sent Events — no polling.",
  },
  {
    tag: "06 · Multi-tenancy",
    title: "Isolation enforced by the database",
    body: "Tenant isolation lives below the ORM: Postgres 16 row-level security with a non-owner role, FORCE ROW LEVEL SECURITY, and a request-scoped tenant binding that fails closed. A missing binding returns nothing rather than leaking (ADR-0001).",
  },
  {
    tag: "07 · Enterprise auth",
    title: "JWT, MFA, SSO, SAML, SCIM",
    body: "Session auth is JWT + MFA, with Google SSO, SAML and SCIM provisioning. API keys are hashed with Argon2id, roles are auditor-scoped (owner / admin / engineer / viewer / auditor), and mutations are guarded by CSRF double-submit.",
  },
  {
    tag: "08 · Durable scanning",
    title: "Background work that survives failure",
    body: "Scans, monitoring, AI and evidence each get their own SQS queue plus a dead-letter queue — four and four — drained by SQS-triggered Lambda workers, so long-running jobs are durable and retryable (ADR-0002 / ADR-0003).",
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
  { label: "Minimum-data collection", detail: "Scanners collect posture data only — never PII, customer records or business content." },
];

interface StackGroup {
  label: string;
  items: readonly string[];
}

const STACK: readonly StackGroup[] = [
  {
    label: "Backend",
    items: ["Fastify 4", "Node 20", "Drizzle ORM", "postgres-js", "Zod", "jose JWT", "Argon2id", "AES-256-GCM"],
  },
  {
    label: "Frontend",
    items: ["Next.js 14 (static export)", "React", "Tailwind CSS"],
  },
  {
    label: "Data & infra",
    items: ["Postgres 16 (RLS)", "Redis", "AWS SQS", "S3 Object Lock", "Lambda", "RDS", "KMS", "Secrets Manager", "ECR"],
  },
  {
    label: "AI",
    items: ["Anthropic Claude", "AWS Bedrock"],
  },
  {
    label: "Scanners",
    items: ["Python 3.12", "Prowler", "Checkov", "Semgrep", "Bandit"],
  },
  {
    label: "Deploy & CI",
    items: ["SST 4.13 (Pulumi)", "docker-compose", "LocalStack", "Cloudflare Pages", "GitHub Actions"],
  },
];

export default function PlatformPage() {
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
              "radial-gradient(ellipse 900px 420px at 18% 8%, rgba(var(--accent-rgb, 198 242 78), 0.09), transparent 60%)",
          }}
        />
        <div className="relative mx-auto grid max-w-[1280px] grid-cols-1 items-center gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:gap-[72px]">
          <div>
            <p className="halo-eyebrow">§ 01 · The platform</p>
            <h1 className="mt-6 font-display font-medium leading-[1.02] tracking-tightest text-text text-[clamp(44px,7vw,78px)]">
              The whole compliance
              <br />
              stack, built{" "}
              <span className="text-accent italic font-normal">in the open.</span>
            </h1>
            <p className="mt-7 max-w-[540px] font-sans text-lg leading-[1.55] text-text-muted">
              Blackfyre maps your multi-cloud and on-prem posture to nine
              compliance frameworks, stores tamper-evident evidence, and ships as
              source you run yourself. {AUDITOR_COUNT} auditors, {TOTAL_CONTROLS}{" "}
              controls, one runtime — Apache-2.0.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
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
                href={architectureDoc}
                target="_blank"
                rel="noreferrer"
                className="halo-btn-ghost"
              >
                Read the architecture
              </a>
            </div>
          </div>

          {/* Spec card */}
          <aside className="halo-card p-7">
            <p className="halo-eyebrow">§ At a glance</p>
            <dl className="mt-4">
              {HERO_SPECS.map((s, i) => (
                <div
                  key={s.k}
                  className={`flex items-baseline justify-between gap-4 py-3.5 ${
                    i < HERO_SPECS.length - 1 ? "border-b border-border" : ""
                  }`}
                >
                  <dt className="font-mono text-[11.5px] uppercase tracking-[0.08em] text-text-muted">
                    {s.k}
                  </dt>
                  <dd className="m-0 text-right font-sans text-[15px] font-medium text-text">
                    {s.v}
                  </dd>
                </div>
              ))}
            </dl>
          </aside>
        </div>
      </section>

      {/* ── Architecture ────────────────────────────────────────── */}
      <HaloReveal as="section" className="border-b border-border px-6 py-24 sm:px-12">
        <HaloSectionHead
          eyebrow="§ Architecture"
          title="One request pipeline, end to end."
          blurb="Static frontends talk to a Fastify API; the API writes to Postgres and enqueues work; Lambda workers drain the queues, run the scanners, and land tamper-evident evidence in S3."
        />
        <div className="mx-auto mt-12 max-w-[1280px]">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-stretch">
            {PIPELINE.map((s, i) => (
              <Fragment key={s.n}>
                <div className="halo-card halo-card-hover flex flex-1 flex-col p-5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] font-medium text-accent">
                      {s.n}
                    </span>
                    <span className="halo-label">{s.label}</span>
                  </div>
                  <h3 className="mt-3 font-sans text-[17px] font-medium tracking-[-0.01em] text-text">
                    {s.title}
                  </h3>
                  <p className="mt-2 flex-1 font-sans text-[12.5px] leading-[1.5] text-text-muted">
                    {s.detail}
                  </p>
                  <div className="mt-4 font-mono text-[10px] uppercase tracking-[0.14em] text-text-dim">
                    {s.note}
                  </div>
                </div>
                {i < PIPELINE.length - 1 && (
                  <div
                    aria-hidden="true"
                    className="flex items-center justify-center text-text-dim"
                  >
                    <span className="lg:hidden">&darr;</span>
                    <span className="hidden lg:inline">&rarr;</span>
                  </div>
                )}
              </Fragment>
            ))}
          </div>
          <p className="mt-8 max-w-[760px] font-sans text-sm leading-[1.6] text-text-muted">
            Locally, the whole thing runs on docker-compose with LocalStack — no
            cloud account or API keys required. For production it deploys to your
            own AWS account via SST 4.13; that path is fully documented but is not
            yet a hosted, managed service.
          </p>
        </div>
      </HaloReveal>

      {/* ── Capabilities ────────────────────────────────────────── */}
      <HaloReveal as="section" delay={120} className="border-b border-border px-6 py-24 sm:px-12">
        <HaloSectionHead
          eyebrow="§ 02 · Capabilities"
          title="Eight capabilities, one runtime."
          blurb="Scanning, framework mapping, AI analysis, evidence, monitoring, tenancy, auth and durable background work — each built to what an external auditor would demand."
        />
        <div className="mx-auto mt-12 grid max-w-[1280px] grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <article
              key={f.tag}
              className="halo-card halo-card-hover flex flex-col p-6"
            >
              <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-accent">
                {f.tag}
              </div>
              <h3 className="mt-2.5 font-sans text-[20px] font-medium tracking-[-0.02em] text-text">
                {f.title}
              </h3>
              <p className="mt-2.5 font-sans text-sm leading-[1.55] text-text-muted">
                {f.body}
              </p>
            </article>
          ))}
        </div>
      </HaloReveal>

      {/* ── Frameworks ──────────────────────────────────────────── */}
      <section
        id="frameworks"
        className="scroll-mt-24 border-b border-border px-6 py-24 sm:px-12"
      >
        <HaloReveal>
          <HaloSectionHead
            eyebrow="§ 03 · Frameworks"
            title="Every framework you're accountable to."
            blurb={`${FRAMEWORK_COUNT} frameworks · ${TOTAL_CONTROLS} controls. Findings map to affected controls with weighted per-framework scoring.`}
          />
          <div className="mx-auto mt-12 grid max-w-[1280px] grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FRAMEWORKS.map((fw) => {
              const inner = (
                <>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-sans text-[19px] font-medium tracking-[-0.01em] text-text">
                      {fw.short}
                    </span>
                    <span className="shrink-0 rounded-full border border-border bg-surface-alt px-2.5 py-1 font-mono text-[10.5px] uppercase tracking-[0.08em] text-text-muted">
                      {fw.controls} controls
                    </span>
                  </div>
                  <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.06em] text-text-dim">
                    {fw.name}
                  </p>
                  <p className="mt-3 flex-1 font-sans text-[13px] leading-[1.55] text-text-muted">
                    {fw.summary}
                  </p>
                  {fw.slug && (
                    <span className="mt-4 inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-[0.1em] text-accent">
                      View mapping{" "}
                      <span className="halo-arrow" aria-hidden="true">
                        &rarr;
                      </span>
                    </span>
                  )}
                </>
              );
              return fw.slug ? (
                <Link
                  key={fw.key}
                  href={fw.slug}
                  className="halo-arrow-parent halo-card halo-card-hover flex flex-col p-6"
                >
                  {inner}
                </Link>
              ) : (
                <article
                  key={fw.key}
                  className="halo-card flex flex-col p-6"
                >
                  {inner}
                </article>
              );
            })}
          </div>
        </HaloReveal>
      </section>

      {/* ── Auth & security ─────────────────────────────────────── */}
      <HaloReveal as="section" delay={120} className="border-b border-border px-6 py-24 sm:px-12">
        <HaloSectionHead
          eyebrow="§ 04 · Auth & security"
          title="A security model auditors recognize."
          blurb="Identity, tenancy and least-privilege access aren't add-ons — they're wired through every request, every queue and every scan."
        />
        <div className="mx-auto mt-12 max-w-[1160px]">
          <div className="halo-card grid grid-cols-1 gap-x-10 gap-y-1 p-7 sm:grid-cols-2 sm:p-9">
            {AUTH_MODEL.map((item) => (
              <div
                key={item.label}
                className="flex items-start gap-3 border-b border-border py-4 last:border-b-0 sm:[&:nth-last-child(2)]:border-b-0"
              >
                <span
                  aria-hidden="true"
                  className="mt-0.5 select-none font-mono text-sm font-bold text-accent"
                >
                  ✓
                </span>
                <div>
                  <p className="font-sans text-[15px] font-medium text-text">
                    {item.label}
                  </p>
                  <p className="mt-0.5 font-sans text-[13px] leading-[1.5] text-text-muted">
                    {item.detail}
                  </p>
                </div>
              </div>
            ))}
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
      </HaloReveal>

      {/* ── Tech stack ──────────────────────────────────────────── */}
      <HaloReveal as="section" delay={240} className="border-b border-border px-6 py-24 sm:px-12">
        <HaloSectionHead
          eyebrow="§ 05 · Stack"
          title="Boring where it counts."
          blurb="Mature, well-understood building blocks — chosen so a self-hoster can read the source and know exactly what they're running."
        />
        <div className="mx-auto mt-12 grid max-w-[1160px] grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {STACK.map((group) => (
            <div key={group.label} className="halo-card p-6">
              <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-accent">
                {group.label}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {group.items.map((item) => (
                  <span
                    key={item}
                    className="inline-flex items-center rounded-full border border-border bg-surface px-3 py-1 font-mono text-[11.5px] text-text-muted transition-colors hover:border-border-strong hover:text-text"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </HaloReveal>

      <HaloCTA
        eyebrow="§ Get the source"
        title="Read the code. Run it yourself."
        titleAccent="yourself"
        sub="Blackfyre is Apache-2.0 — clone it, self-host it, and audit every line. No sales call required."
        primaryLabel="Star on GitHub"
        primaryHref={SITE.repoUrl}
        secondaryLabel="Self-hosting guide"
        secondaryHref={selfHostDoc}
      />

      <HaloFooter />
    </>
  );
}
