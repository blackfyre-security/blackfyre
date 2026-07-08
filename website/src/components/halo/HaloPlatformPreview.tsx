import HaloSectionHead from "@/components/halo/HaloSectionHead";

interface Feature {
  t: string;
  d: string;
  tags: readonly string[];
}

const FEATURES: readonly Feature[] = [
  {
    t: "Multi-cloud scanning",
    d: "55 auditors sweep AWS, Azure, GCP and on-prem (Active Directory, SNMP, IdP, EDR, Kubernetes, registries, VCS, SaaS) across IAM, storage, compute, networking, encryption, logging, database, monitoring and containers — plus Prowler and Checkov/Semgrep/Bandit as container Lambdas.",
    tags: ["AWS", "Azure", "GCP", "on-prem"],
  },
  {
    t: "Framework mapping",
    d: "Every finding maps to the affected controls across 9 frameworks and 678 controls, with weighted per-framework scoring so a fix moves the right scores.",
    tags: ["9 frameworks", "678 controls"],
  },
  {
    t: "AI-assisted analysis",
    d: "Gap analysis, MITRE ATT&CK mapping, remediation suggestions and the CORTEX copilot via Claude — Anthropic API or AWS Bedrock (no key needed). Degrades to deterministic heuristics when no provider is set.",
    tags: ["Claude", "Bedrock", "heuristic fallback"],
  },
  {
    t: "Tamper-evident evidence vault",
    d: "A SHA-256 integrity hash per item, S3 Object Lock with versioning, and AES-256-GCM encryption for PII — evidence auditors can trust.",
    tags: ["SHA-256", "Object Lock", "AES-256-GCM"],
  },
  {
    t: "Real-time monitoring & drift",
    d: "Configuration drift detection plus live scan progress streamed to the dashboard over Server-Sent Events.",
    tags: ["drift", "SSE"],
  },
  {
    t: "Database-enforced multi-tenancy",
    d: "Postgres 16 row-level security below the ORM: a non-owner role, FORCE RLS, and a request-scoped tenant binding that fails closed (ADR-0001).",
    tags: ["Postgres RLS", "fails closed"],
  },
  {
    t: "Enterprise auth",
    d: "JWT + MFA, Google SSO, SAML, SCIM and API keys (Argon2id), with auditor-scoped roles (owner/admin/engineer/viewer/auditor) and CSRF double-submit.",
    tags: ["SSO", "SAML", "SCIM", "MFA"],
  },
  {
    t: "Durable background scanning",
    d: "Four SQS queues (scan / monitor / AI / evidence) plus four dead-letter queues, driven by SQS-triggered Lambda workers with at-least-once idempotency (ADR-0002/0003).",
    tags: ["4 SQS queues", "4 DLQs", "Lambda"],
  },
];

export interface HaloPlatformPreviewProps {
  className?: string;
}

/**
 * The eight real platform capabilities in a hover-lift card grid. Pure SSR —
 * every claim is code-of-record.
 */
export default function HaloPlatformPreview({ className }: HaloPlatformPreviewProps) {
  return (
    <section
      className={["border-b border-border px-6 py-24 sm:px-12", className ?? ""]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="mx-auto max-w-[1280px]">
        <HaloSectionHead
          align="left"
          className="mx-0 max-w-[760px]"
          eyebrow="§ 02 · PLATFORM"
          title="One platform. Every posture signal."
          titleAccent="Every posture signal"
          blurb="Scanning, framework mapping, AI, an evidence vault, drift, multi-tenancy, auth and durable queues — one open-source codebase, all of it self-hostable."
        />

        <div className="mt-12 grid grid-cols-1 gap-px overflow-hidden rounded-[14px] border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f, i) => (
            <div
              key={f.t}
              className="halo-card-hover flex flex-col gap-3 bg-surface p-[22px]"
            >
              <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-text-dim">
                {String(i + 1).padStart(2, "0")}
              </div>
              <h3 className="font-sans text-[17px] font-medium leading-[1.25] tracking-[-0.01em] text-text">
                {f.t}
              </h3>
              <p className="font-sans text-[13.5px] leading-[1.55] text-text-muted">
                {f.d}
              </p>
              <div className="mt-auto flex flex-wrap gap-1.5 pt-1">
                {f.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-border px-2 py-0.5 font-mono text-[10px] text-text-dim"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
