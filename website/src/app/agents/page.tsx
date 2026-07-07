import type { Metadata } from "next";
import Link from "next/link";
import HaloNav from "@/components/halo/HaloNav";
import HaloFooter from "@/components/halo/HaloFooter";
import HaloSectionHead from "@/components/halo/HaloSectionHead";
import HaloCTA from "@/components/halo/HaloCTA";
import HaloStatusDot from "@/components/halo/HaloStatusDot";
import AgentConstellation from "@/components/halo/AgentConstellation";
import HaloReveal from "@/components/halo/HaloReveal";
import { AGENTS } from "@/lib/halo-data";

export const metadata: Metadata = {
  title: "Agents — Five autonomous operators | BLACKFYRE",
  description:
    "SCOUT scans. SHIELD maps. HELIX fixes. PULSE monitors. CORTEX answers. Your compliance ops, on autopilot — with a human in every approval gate.",
};

export interface NamedAgent {
  n: string;
  name: string;
  role: string;
  d: string;
  id: string;
  scans: number;
  findings: number;
  scope: string;
}

// Merge the 5-agent narrative from the Halo design with the telemetry
// from halo-data.ts (scope, scans, findings) so every card has live numbers.
const NAMED_AGENTS: readonly NamedAgent[] = [
  {
    n: "01",
    name: "SCOUT",
    role: "The Scanner",
    d: "33+ specialised cloud auditors across AWS, Azure, GCP, Kubernetes, and connected SaaS. Severity scored. Signal-refined per tenant.",
    id: AGENTS[0].id,
    scans: AGENTS[0].scans,
    findings: AGENTS[0].findings,
    scope: AGENTS[0].scope,
  },
  {
    n: "02",
    name: "SHIELD",
    role: "The Compliance Engine",
    d: "Maps every finding to nine frameworks simultaneously. Controls that satisfy SOC 2 often satisfy ISO 27001 and NIST in the same motion.",
    id: AGENTS[1].id,
    scans: AGENTS[1].scans,
    findings: AGENTS[1].findings,
    scope: AGENTS[1].scope,
  },
  {
    n: "03",
    name: "HELIX",
    role: "The Fixer",
    d: "Takes a finding, produces a working fix — Terraform, CloudFormation, Kubernetes. Blast-radius estimate. Snapshot. Rollback path.",
    id: AGENTS[2].id,
    scans: AGENTS[2].scans,
    findings: AGENTS[2].findings,
    scope: AGENTS[2].scope,
  },
  {
    n: "04",
    name: "PULSE",
    role: "The Monitor",
    d: "Watches for drift around the clock. IAM loosened, bucket re-created, SG rule added — classifies severity, triggers re-scan.",
    id: AGENTS[3].id,
    scans: AGENTS[3].scans,
    findings: AGENTS[3].findings,
    scope: AGENTS[3].scope,
  },
  {
    n: "05",
    name: "CORTEX",
    role: "The AI Brain",
    d: "Answers compliance questions in plain language. RAG-powered knowledge base + 20+ remediation playbooks. Correlates across clouds.",
    id: AGENTS[4].id,
    scans: AGENTS[4].scans,
    findings: AGENTS[4].findings,
    scope: AGENTS[4].scope,
  },
];

export default function AgentsPage() {
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
              "radial-gradient(ellipse 900px 400px at 70% 20%, rgba(var(--accent-rgb, 198 242 78), 0.1), transparent 60%)",
          }}
        />
        <div className="relative mx-auto grid max-w-[1280px] grid-cols-1 items-center gap-12 lg:grid-cols-[1.15fr_0.85fr] lg:gap-[72px]">
          <div>
            <p className="halo-eyebrow">§ 00 · Agents</p>
            <h1 className="mt-6 font-display font-medium leading-[0.98] tracking-tightest text-text text-[clamp(48px,7vw,80px)]">
              Five agents.
              <br />
              <span className="text-text-muted">One autonomous </span>
              <span className="italic font-normal text-accent">posture.</span>
            </h1>
            <p className="mt-7 max-w-[520px] font-sans text-lg leading-[1.55] text-text-muted">
              SCOUT scans. SHIELD maps. HELIX fixes. PULSE monitors. CORTEX
              answers. Your compliance ops, on autopilot — with a human in
              every approval gate.
            </p>
          </div>
          <div className="halo-card relative overflow-hidden p-7 min-h-[320px]">
            <p className="halo-eyebrow">§ Live</p>
            <AgentConstellation
              labels={NAMED_AGENTS.map((a) => a.name.slice(0, 3))}
            />
          </div>
        </div>
      </section>

      {/* ── Roster ──────────────────────────────────────────────── */}
      <HaloReveal as="section" delay={0} className="border-b border-border px-6 py-24 sm:px-12">
        <HaloSectionHead
          eyebrow="§ 01 · Roster"
          title="Specialists, coordinating."
          blurb="Each agent owns a surface. Together they keep your posture current without a human in the loop until you want one."
        />

        <div className="mx-auto mt-12 max-w-[1160px]">
          {NAMED_AGENTS.map((a, i) => (
            <article
              key={a.name}
              className={`grid grid-cols-1 items-start gap-8 py-9 sm:grid-cols-[80px_220px_1fr_220px] ${
                i < NAMED_AGENTS.length - 1 ? "border-b border-border" : ""
              }`}
            >
              <div className="font-mono text-[13px] uppercase tracking-[0.14em] text-accent">
                {a.n}
              </div>
              <div>
                <div className="font-sans text-[32px] font-medium tracking-[-0.02em] text-text">
                  {a.name}
                </div>
                <div className="mt-1 font-mono text-[11.5px] uppercase tracking-[0.1em] text-text-muted">
                  {a.role}
                </div>
                <div className="mt-3 font-mono text-[10.5px] uppercase tracking-[0.14em] text-text-dim">
                  {a.id} · {a.scope}
                </div>
              </div>
              <p className="m-0 font-sans text-base leading-[1.6] text-text-muted">
                {a.d}
              </p>
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between font-mono text-[10.5px] uppercase tracking-[0.14em] text-text-dim">
                  <span>Scans</span>
                  <span className="text-text">{a.scans.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between font-mono text-[10.5px] uppercase tracking-[0.14em] text-text-dim">
                  <span>Findings</span>
                  <span
                    className={
                      a.findings === 0 ? "text-accent" : "text-warn"
                    }
                  >
                    {a.findings === 0 ? "clean" : a.findings}
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <HaloStatusDot size="sm" />
                  <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-accent">
                    Active
                  </span>
                </div>
              </div>
            </article>
          ))}
        </div>
      </HaloReveal>

      <HaloCTA
        title="Watch them work."
        titleAccent="work"
        sub="Live agent activity feed opens as soon as you connect your first cloud."
        primaryLabel="Talk to us"
        primaryHref="/contact"
        secondaryLabel="Book a demo"
        secondaryHref="/contact"
      />

      <HaloFooter />
    </>
  );
}
