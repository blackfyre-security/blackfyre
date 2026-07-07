import type { Metadata } from "next";
import Link from "next/link";
import HaloNav from "@/components/halo/HaloNav";
import HaloFooter from "@/components/halo/HaloFooter";
import HaloSectionHead from "@/components/halo/HaloSectionHead";
import HaloCTA from "@/components/halo/HaloCTA";
import HaloReveal from "@/components/halo/HaloReveal";
import CohortHero from "@/components/cohort/CohortHero";
import CohortMarquee from "@/components/cohort/CohortMarquee";
import CohortTimeline, { type TimelineItem } from "@/components/cohort/CohortTimeline";

export const metadata: Metadata = {
  title: "Cloud Security Cohort — Live, Practitioner-Led Coaching | BLACKFYRE",
  description:
    "An 8-week, live online cohort that takes you from cloud fundamentals to shipping audit-ready security posture across AWS, Azure, and GCP. Small group, real labs, practitioners who have held the pager.",
};

/* ── Marquee band ──────────────────────────────────────────────── */
const MARQUEE: readonly string[] = [
  "AWS", "Azure", "GCP", "IAM", "KMS", "SOC 2", "ISO 27001", "HIPAA",
  "NIST 800-53", "Terraform", "VPC / SSRF", "Detection", "Incident Response", "Capstone",
];

/* ── Curriculum (week-by-week) ─────────────────────────────────── */
const MODULES: readonly TimelineItem[] = [
  {
    week: "01",
    title: "Threat modelling the cloud",
    blurb:
      "Map your real attack surface across AWS, Azure, and GCP. Trust boundaries, blast radius, and where multi-tenant isolation actually breaks.",
    tags: ["IAM", "Boundaries", "STRIDE"],
  },
  {
    week: "02",
    title: "Identity is the perimeter",
    blurb:
      "Least-privilege roles, federation, and policy patterns that survive an audit. Hands-on: break and then fix a privilege-escalation path.",
    tags: ["IAM", "Federation", "SSO"],
  },
  {
    week: "03",
    title: "Secrets, keys, and crypto",
    blurb:
      "KMS, envelope encryption, BYOK, and rotation that doesn't page you at 3am. Build a fail-closed secret store from scratch.",
    tags: ["KMS", "AES-GCM", "Rotation"],
  },
  {
    week: "04",
    title: "Network & data-plane hardening",
    blurb:
      "VPC design, egress control, SSRF defence, and private connectivity. Lab: ship a service that can't be tricked into reaching metadata.",
    tags: ["VPC", "SSRF", "Egress"],
  },
  {
    week: "05",
    title: "Detection & continuous posture",
    blurb:
      "Wire findings to action. Build a scanner that maps cloud config to controls and fires real alerts — not dashboards nobody reads.",
    tags: ["Detection", "Alerting", "Logs"],
  },
  {
    week: "06",
    title: "Compliance that maps to reality",
    blurb:
      "SOC 2, ISO 27001, HIPAA, and NIST without the theatre. Turn 600+ controls into an evidence trail an auditor will actually accept.",
    tags: ["SOC 2", "ISO 27001", "Evidence"],
  },
  {
    week: "07",
    title: "Incident response, for real",
    blurb:
      "Runbooks, on-call posture, and a live tabletop. Detect, contain, and write the post-mortem your future self will thank you for.",
    tags: ["IR", "Tabletop", "Post-mortem"],
  },
  {
    week: "08",
    title: "Capstone & career",
    blurb:
      "Ship a hardened, audit-ready environment end to end. Present it, get reviewed by a practitioner, and walk away with proof of work.",
    tags: ["Capstone", "Review", "Portfolio"],
  },
];

/* ── Who it's for ──────────────────────────────────────────────── */
const AUDIENCE: readonly { title: string; body: string; icon: "code" | "shield" | "rocket" }[] = [
  {
    title: "Engineers going deeper",
    body: "Backend and platform engineers who keep getting handed security work and want to own it with confidence.",
    icon: "code",
  },
  {
    title: "Security folks going cloud",
    body: "Practitioners strong on fundamentals but newer to multi-cloud who want hands-on reps, not slideware.",
    icon: "shield",
  },
  {
    title: "Founders & early teams",
    body: "Builders who need to pass their first SOC 2 or HIPAA review without hiring a full security team yet.",
    icon: "rocket",
  },
];

/* ── What you get ──────────────────────────────────────────────── */
const INCLUDED: readonly { title: string; body: string }[] = [
  { title: "Live coaching, twice a week", body: "90-minute sessions with screen-share, Q&A, and no recordings-only filler. Show up and build." },
  { title: "Real labs on real cloud", body: "Every module ships hands-on labs in disposable AWS/Azure/GCP accounts. You break things safely, then fix them." },
  { title: "Private cohort channel", body: "A small, high-signal group plus direct access to instructors between sessions for unblocking." },
  { title: "Code & runbook templates", body: "Take home the same hardening templates, IaC, and runbooks our team uses on real engagements." },
  { title: "1:1 capstone review", body: "A practitioner reviews your final project line by line and signs off on what's portfolio-ready." },
  { title: "Certificate of completion", body: "Proof of work tied to a real, defensible capstone — not an attendance sticker." },
];

/* ── Pricing ───────────────────────────────────────────────────── */
interface Plan {
  name: string;
  price: string;
  cadence: string;
  blurb: string;
  features: readonly string[];
  cta: string;
  featured?: boolean;
}
const PLANS: readonly Plan[] = [
  {
    name: "Self-paced",
    price: "₹0",
    cadence: "no live access",
    blurb: "Follow the public labs on your own time. No live sessions or review.",
    features: ["All lab briefs", "Community read access", "No live coaching", "No capstone review"],
    cta: "Browse labs",
  },
  {
    name: "Cohort",
    price: "₹25,000",
    cadence: "per seat · 8 weeks",
    blurb: "The full live experience. Coaching, labs, group, and a reviewed capstone.",
    features: ["16 live sessions", "All hands-on labs", "Private cohort channel", "1:1 capstone review", "Templates & runbooks", "Certificate"],
    cta: "Reserve a seat",
    featured: true,
  },
  {
    name: "Team",
    price: "Let's talk",
    cadence: "4+ seats",
    blurb: "Private or blended cohort for your team, mapped to your stack and frameworks.",
    features: ["Everything in Cohort", "Private scheduling", "Stack-specific labs", "Manager debrief"],
    cta: "Talk to us",
  },
];

/* ── FAQ ───────────────────────────────────────────────────────── */
const FAQ: readonly { q: string; a: string }[] = [
  { q: "Do I need to be a security expert already?", a: "No. You need comfort with the cloud console and a terminal. We start at threat modelling and build up — the labs meet you where you are." },
  { q: "What if I miss a live session?", a: "Every session is recorded and the labs are async. The live time is for Q&A and pairing, but you won't fall behind if you miss one." },
  { q: "Will this cost me anything in cloud bills?", a: "Labs run in short-lived sandbox accounts and stay inside free-tier or near-zero spend. We give you teardown scripts so nothing lingers." },
  { q: "Is there a refund policy?", a: "Full refund up to the end of week one, no questions asked. If the cohort isn't for you, you leave whole." },
];

/* ── Small inline icons for the audience cards ─────────────────── */
function AudienceIcon({ kind }: { kind: "code" | "shield" | "rocket" }) {
  const common = "h-5 w-5";
  if (kind === "code")
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={common}>
        <path d="m8 9-3 3 3 3M16 9l3 3-3 3M13 5l-2 14" />
      </svg>
    );
  if (kind === "shield")
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={common}>
        <path d="M12 3 5 6v5c0 5 3 8 7 10 4-2 7-5 7-10V6z" />
        <path d="m9 12 2 2 4-4" />
      </svg>
    );
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={common}>
      <path d="M5 16c-1 2-1 4-1 4s2 0 4-1m1-3a8 8 0 0 1 2-8c3-3 7-4 8-4s0 5-4 8a8 8 0 0 1-8 2zM9 15l-2-2" />
      <circle cx="14.5" cy="9.5" r="1.5" />
    </svg>
  );
}

export default function CohortPage() {
  return (
    <>
      <HaloNav />

      <CohortHero />

      <CohortMarquee items={MARQUEE} />

      {/* ── Who it's for ──────────────────────────────────────── */}
      <HaloReveal as="section" className="border-b border-border px-6 py-24 sm:px-12">
        <HaloSectionHead
          eyebrow="§ 01 · Who it's for"
          title="Built for people who ship."
          titleAccent="ship"
          blurb="Not a lecture series. A working group for engineers who'd rather build the secure thing than read about it."
        />
        <div className="mx-auto mt-12 grid max-w-[1160px] grid-cols-1 gap-4 sm:grid-cols-3">
          {AUDIENCE.map((a, i) => (
            <HaloReveal key={a.title} delay={i * 110}>
              <div className="halo-card co-tilt h-full p-7">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-surface-alt text-accent co-float">
                  <AudienceIcon kind={a.icon} />
                </span>
                <h3 className="mt-5 font-sans text-[20px] font-medium tracking-[-0.02em] text-text">
                  {a.title}
                </h3>
                <p className="mt-3 font-sans text-[13.5px] leading-[1.55] text-text-muted">
                  {a.body}
                </p>
              </div>
            </HaloReveal>
          ))}
        </div>
      </HaloReveal>

      {/* ── Curriculum (animated timeline) ────────────────────── */}
      <section id="curriculum" className="scroll-mt-24 border-b border-border px-6 py-24 sm:px-12">
        <HaloSectionHead
          eyebrow="§ 02 · Curriculum"
          title="Eight weeks, hands on the keys."
          titleAccent="hands"
          blurb="Every week pairs a live session with a lab you ship. By the end you've built a hardened, audit-ready environment end to end."
        />
        <CohortTimeline items={MODULES} />
      </section>

      {/* ── What you get ──────────────────────────────────────── */}
      <HaloReveal as="section" className="border-b border-border px-6 py-24 sm:px-12">
        <HaloSectionHead
          eyebrow="§ 03 · What's included"
          title="Coaching, not a content dump."
          titleAccent="Coaching"
          blurb="Live time, real labs, and the same templates our team carries into engagements. You leave with proof of work, not a playlist."
        />
        <div className="mx-auto mt-12 grid max-w-[1160px] grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {INCLUDED.map((f, i) => (
            <HaloReveal key={f.title} delay={(i % 3) * 100}>
              <article className="halo-card co-tilt h-full p-7">
                <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-accent">
                  {String(i + 1).padStart(2, "0")}
                </div>
                <h3 className="mt-3.5 font-sans text-[20px] font-medium tracking-[-0.02em] text-text">
                  {f.title}
                </h3>
                <p className="mt-2.5 font-sans text-sm leading-[1.55] text-text-muted">
                  {f.body}
                </p>
              </article>
            </HaloReveal>
          ))}
        </div>
      </HaloReveal>

      {/* ── Pricing ───────────────────────────────────────────── */}
      <HaloReveal as="section" className="border-b border-border px-6 py-24 sm:px-12">
        <HaloSectionHead
          eyebrow="§ 04 · Enrol"
          title="One price. Every seat earns it back."
          titleAccent="price"
          blurb="Seats are capped so the room stays high-signal. Reserve early — cohorts have filled before launch."
        />
        <div className="mx-auto mt-12 grid max-w-[1100px] grid-cols-1 gap-4 lg:grid-cols-3">
          {PLANS.map((plan, i) => (
            <HaloReveal key={plan.name} delay={i * 120}>
              <article
                className={`relative flex h-full flex-col p-7 ${
                  plan.featured
                    ? "halo-card-strong co-shield-glow border-accent/40 shadow-halo-glow"
                    : "halo-card co-tilt"
                }`}
              >
                {plan.featured && (
                  <span className="absolute right-6 top-6 rounded-md border border-accent/40 bg-surface-alt px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-accent">
                    Most picked
                  </span>
                )}
                <h3 className="font-sans text-[20px] font-medium tracking-[-0.02em] text-text">
                  {plan.name}
                </h3>
                <div className="mt-4 flex items-baseline gap-2">
                  <span className="font-display text-[40px] font-medium leading-none tracking-display text-text">
                    {plan.price}
                  </span>
                  <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-text-dim">
                    {plan.cadence}
                  </span>
                </div>
                <p className="mt-4 font-sans text-[13.5px] leading-[1.55] text-text-muted">
                  {plan.blurb}
                </p>
                <ul className="mt-6 flex flex-1 flex-col gap-2.5">
                  {plan.features.map((feat) => (
                    <li key={feat} className="flex items-start gap-2.5 font-sans text-[13.5px] text-text">
                      <span className="mt-[7px] h-1.5 w-1.5 flex-shrink-0 rounded-full bg-accent" aria-hidden="true" />
                      {feat}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/contact"
                  className={`mt-7 ${plan.featured ? "halo-btn-accent" : "halo-btn-ghost"} justify-center`}
                >
                  {plan.cta}
                  {plan.featured && <span className="halo-arrow" aria-hidden="true"> &rarr;</span>}
                </Link>
              </article>
            </HaloReveal>
          ))}
        </div>
      </HaloReveal>

      {/* ── FAQ ───────────────────────────────────────────────── */}
      <HaloReveal as="section" className="border-b border-border px-6 py-24 sm:px-12">
        <HaloSectionHead
          eyebrow="§ 05 · Questions"
          title="The things people ask first."
          titleAccent="ask"
        />
        <div className="mx-auto mt-12 grid max-w-[900px] grid-cols-1 gap-4 sm:grid-cols-2">
          {FAQ.map((item, i) => (
            <HaloReveal key={item.q} delay={(i % 2) * 100}>
              <div className="halo-card co-tilt h-full p-7">
                <h3 className="font-sans text-[16px] font-medium tracking-[-0.01em] text-text">
                  {item.q}
                </h3>
                <p className="mt-2.5 font-sans text-[13.5px] leading-[1.55] text-text-muted">
                  {item.a}
                </p>
              </div>
            </HaloReveal>
          ))}
        </div>
      </HaloReveal>

      <HaloCTA
        title="Your next cohort starts soon."
        titleAccent="cohort"
        sub="18 seats. 8 weeks. A defensible cloud-security skill set and proof you can ship it."
        eyebrow="§ Enrol"
        primaryLabel="Reserve a seat"
        primaryHref="/contact"
        secondaryLabel="Ask a question"
        secondaryHref="/contact"
      />

      <HaloFooter />
    </>
  );
}
