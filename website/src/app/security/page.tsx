import type { Metadata } from "next";
import Link from "next/link";
import HaloNav from "@/components/halo/HaloNav";
import HaloFooter from "@/components/halo/HaloFooter";
import HaloSectionHead from "@/components/halo/HaloSectionHead";
import HaloCTA from "@/components/halo/HaloCTA";
import HaloStatusDot from "@/components/halo/HaloStatusDot";
import HaloReveal from "@/components/halo/HaloReveal";
import { professionalServices, serviceCategories } from "@/data/content";

export const metadata: Metadata = {
  title: "Security — vCISO, VAPT, and Compliance Advisory | BLACKFYRE",
  description:
    "Practitioner-led security engagements. Fractional CISO leadership, pen testing with same-day critical escalation, SOC 2 and ISO 27001 advisory, and AI security for the EU AI Act era.",
};

const SECURITY_SERVICES = serviceCategories.find((c) => c.id === "security");
const AI_SERVICES = serviceCategories.find((c) => c.id === "ai");

interface DisclosureRow {
  sev: string;
  sla: string;
  tone: "crit" | "warn" | "text" | "muted";
}

const DISCLOSURE: readonly DisclosureRow[] = [
  { sev: "Critical", sla: "24h", tone: "crit" },
  { sev: "High", sla: "72h", tone: "warn" },
  { sev: "Medium", sla: "14d", tone: "text" },
  { sev: "Low", sla: "30d", tone: "muted" },
];

function toneColor(tone: DisclosureRow["tone"]): string {
  switch (tone) {
    case "crit":
      return "var(--crit)";
    case "warn":
      return "var(--warn)";
    case "text":
      return "var(--text)";
    case "muted":
      return "var(--muted)";
  }
}

export default function SecurityPage() {
  return (
    <>
      <HaloNav />

      {/* ── Hero ────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-border bg-surface px-6 py-24 text-center sm:px-12 sm:py-28">
        <p className="halo-eyebrow justify-center">
          Trust &amp; transparency
        </p>
        <h1 className="mt-4 font-display font-medium leading-[1] tracking-tightest text-text text-[clamp(44px,5.4vw,64px)]">
          Security <span className="italic font-normal text-accent">practices.</span>
        </h1>
        <p className="mx-auto mt-5 max-w-[720px] font-sans text-[17px] leading-[1.6] text-text-muted">
          We are a security company. We hold ourselves to the same standard we
          hold our clients. This page documents how we secure our platform,
          your data, and our own operations — and the engagements we run for
          teams that need the same posture.
        </p>
      </section>

      {/* ── Security engagements (vCISO, VAPT, advisory) ───────── */}
      {SECURITY_SERVICES && (
        <HaloReveal as="section" delay={0} className="border-b border-border px-6 py-24 sm:px-12">
          <HaloSectionHead
            eyebrow="§ 01 · Engagements"
            title="vCISO, VAPT, and the long game."
            blurb="Five practitioner-led engagement shapes. Start with a gap analysis. End with attestation, a clean pen test report, and a security leader who has read every runbook you own."
          />
          <div className="mx-auto mt-12 grid max-w-[1280px] grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {SECURITY_SERVICES.services.map((svc, i) => (
              <article
                key={svc.name}
                className="halo-card relative flex flex-col p-7 transition-colors hover:border-border-strong"
              >
                <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-accent">
                  {String(i + 1).padStart(2, "0")}
                </div>
                <h3 className="mt-3.5 font-sans text-[22px] font-medium tracking-[-0.02em] text-text">
                  {svc.name}
                </h3>
                <p className="mt-2.5 font-sans text-sm leading-[1.55] text-text-muted">
                  {svc.description}
                </p>
                <div className="mt-5 flex flex-wrap gap-1.5">
                  {svc.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-md border border-border bg-surface-alt px-2 py-0.5 font-mono text-[10.5px] text-text-muted"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                <Link
                  href="/contact"
                  className="halo-arrow-parent mt-6 font-mono text-xs uppercase tracking-[0.06em] text-accent"
                >
                  Engage <span className="halo-arrow" aria-hidden="true">&rarr;</span>
                </Link>
              </article>
            ))}
          </div>
        </HaloReveal>
      )}

      {/* ── Pricing strip ──────────────────────────────────────── */}
      <HaloReveal as="section" delay={120} className="border-b border-border px-6 py-24 sm:px-12">
        <HaloSectionHead
          eyebrow="§ 02 · Investment"
          title="Transparent pricing. No retainer minimums we hide."
          blurb="Everything below is the actual starting price. Scope shapes the number. We'll tell you before we bill you."
        />
        <div className="mx-auto mt-12 grid max-w-[1160px] grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {professionalServices.map((ps) => (
            <div key={ps.name} className="halo-card p-6">
              <div className="flex items-baseline justify-between">
                <h3 className="font-sans text-[18px] font-medium tracking-[-0.02em] text-text">
                  {ps.name}
                </h3>
                <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-text-dim">
                  /{ps.unit}
                </span>
              </div>
              <div className="mt-3 font-mono text-[13px] text-accent">
                {ps.price}
              </div>
              <p className="mt-3 font-sans text-[13.5px] leading-[1.55] text-text-muted">
                {ps.description}
              </p>
            </div>
          ))}
        </div>
      </HaloReveal>

      {/* ── AI security ────────────────────────────────────────── */}
      {AI_SERVICES && (
        <HaloReveal as="section" delay={240} className="border-b border-border px-6 py-24 sm:px-12">
          <HaloSectionHead
            eyebrow="§ 03 · AI security"
            title="Secured from the first prompt."
            blurb="EU AI Act enforcement began August 2025 with full obligations phased through 2026. We run LLM threat assessments, prompt-injection defence, and AI governance for teams shipping production AI."
          />
          <div className="mx-auto mt-12 grid max-w-[1160px] grid-cols-1 gap-4 lg:grid-cols-2">
            {AI_SERVICES.services.map((svc) => (
              <article key={svc.name} className="halo-card halo-card-hover p-7">
                <h3 className="font-sans text-[22px] font-medium tracking-[-0.02em] text-text">
                  {svc.name}
                </h3>
                <p className="mt-3 font-sans text-sm leading-[1.6] text-text-muted">
                  {svc.description}
                </p>
                <div className="mt-5 flex flex-wrap gap-1.5">
                  {svc.tags.map((tag) => (
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
        </HaloReveal>
      )}

      {/* ── Data isolation / infra ─────────────────────────────── */}
      <HaloReveal as="section" delay={360} className="border-b border-border px-6 py-24 sm:px-12">
        <HaloSectionHead
          eyebrow="§ 04 · Posture"
          title="How we run our own platform."
          blurb="AWS ap-south-1. IaC-provisioned. AES-256 at rest. TLS 1.3 in transit. RLS-isolated tenants. WORM-stored evidence."
        />
        <div className="mx-auto mt-12 grid max-w-[1160px] grid-cols-1 gap-4 sm:grid-cols-2">
          {[
            {
              t: "Cloud provider",
              d: "AWS ap-south-1 (Mumbai). All infra provisioned via IaC with no manual console changes in production.",
            },
            {
              t: "Encryption at rest",
              d: "AES-256 for all stored data — database volumes, S3 buckets, backups.",
            },
            {
              t: "Encryption in transit",
              d: "TLS 1.3 enforced for all endpoints. TLS 1.0 and 1.1 disabled. HSTS with 1-year max-age.",
            },
            {
              t: "Row-level security",
              d: "Every table carries a tenant ID. RLS policies make cross-tenant reads structurally impossible.",
            },
            {
              t: "Per-tenant KMS",
              d: "Evidence artefacts are encrypted with per-tenant KMS keys. One tenant's breach cannot decrypt another.",
            },
            {
              t: "WORM evidence vault",
              d: "Evidence is written once, read many — hashed, timestamped, and immutable for the audit window.",
            },
          ].map((x) => (
            <div key={x.t} className="halo-card halo-card-hover p-5">
              <div className="flex items-center gap-2">
                <HaloStatusDot size="sm" steady />
                <h3 className="font-sans text-[15px] font-medium text-text">
                  {x.t}
                </h3>
              </div>
              <p className="mt-2 font-sans text-[13.5px] leading-[1.55] text-text-muted">
                {x.d}
              </p>
            </div>
          ))}
        </div>
      </HaloReveal>

      {/* ── Responsible disclosure ─────────────────────────────── */}
      <HaloReveal as="section" delay={480} className="border-b border-border px-6 py-24 sm:px-12">
        <HaloSectionHead
          eyebrow="§ 05 · Disclosure"
          title="Responsible disclosure."
          blurb="If you believe you've found a security issue, please email us first. We triage inside 24 hours and target a fix SLA based on severity. We will credit the reporter publicly if desired."
        />
        <div className="mx-auto mt-12 grid max-w-[1160px] grid-cols-1 gap-8 rounded-[12px] border border-border bg-surface p-7 sm:grid-cols-[1.4fr_1fr]">
          <div>
            <p className="font-sans text-sm leading-[1.6] text-text-muted">
              Email first. We triage inside 24 hours, target a fix SLA based on
              severity, and will credit the reporter publicly if desired. We do
              not pursue legal action against researchers acting in good faith.
            </p>
            <a
              href="mailto:security@blackfyre.tech?subject=Responsible%20Disclosure%20Report"
              className="mt-4 inline-block font-mono text-[13px] text-accent"
            >
              security@blackfyre.tech
            </a>
            <p className="mt-2 font-mono text-xs text-text-muted">
              PGP: 0x4B2A F8D1 · keys.openpgp.org
            </p>
          </div>
          <div className="font-mono text-xs">
            {DISCLOSURE.map((row) => (
              <div
                key={row.sev}
                className="flex items-center justify-between border-b border-border py-2.5 last:border-b-0"
              >
                <span
                  className="tracking-[0.08em]"
                  style={{ color: toneColor(row.tone) }}
                >
                  ● {row.sev}
                </span>
                <span className="text-text">SLA · {row.sla}</span>
              </div>
            ))}
          </div>
        </div>
      </HaloReveal>

      <HaloCTA
        title="Bring your hardest security problem."
        titleAccent="hardest"
        sub="A 30-minute call. We'll scope the engagement, name the practitioner, and ship a signed SOW the same day."
        primaryLabel="Book a call"
        primaryHref="/contact"
        secondaryLabel="Report a vulnerability"
        secondaryHref="mailto:security@blackfyre.tech"
      />

      <HaloFooter />
    </>
  );
}
