import type { Metadata } from "next";
import Link from "next/link";
import HaloNav from "@/components/halo/HaloNav";
import HaloFooter from "@/components/halo/HaloFooter";
import HaloSectionHead from "@/components/halo/HaloSectionHead";
import HaloCTA from "@/components/halo/HaloCTA";
import HaloReveal from "@/components/halo/HaloReveal";
import { engagementModels, serviceCategories } from "@/data/content";

export const metadata: Metadata = {
  title: "Services — Practitioner-Led Security & Engineering | BLACKFYRE",
  description:
    "Security consulting, cloud engineering, and software delivery led by practitioners who have held the pager. vCISO, VAPT, compliance advisory, AI security, and mobile and web development.",
};

interface PostureRow {
  k: string;
  v: string;
}

const POSTURE: readonly PostureRow[] = [
  { k: "Stack preference", v: "None. We pick what fits." },
  { k: "Certifications", v: "CISSP · OSCP · CEH · AWS · GCP" },
  { k: "Ship time to prod", v: "Typically day one" },
  { k: "On-call posture", v: "Real pagers, real rotations" },
  { k: "NDAs + DPA", v: "Standard, signed same day" },
];

interface DeliveryCard {
  href: string;
  kicker: string;
  title: string;
  body: string;
  tags: readonly string[];
}

// Software-delivery offerings that live on their own pages. These cards are the
// entry point into /webapp and /mobile — without them those pages are orphaned.
const DELIVERY: readonly DeliveryCard[] = [
  {
    href: "/webapp",
    kicker: "Web development",
    title: "Marketing sites, SaaS, internal tools.",
    body: "Next.js, Astro, Rails, Django — picked to fit the problem, not the portfolio. We design, build, host, and hand over the keys. Code, domain, and analytics in your account from day one.",
    tags: ["Next.js", "SaaS", "Internal tools", "Legacy modernization"],
  },
  {
    href: "/mobile",
    kicker: "Mobile app development",
    title: "Ship on Android, iOS, or both.",
    body: "Native craft where it counts, cross-platform when speed matters. From idea to Play Store and App Store — code, signing keys, and listings owned by you.",
    tags: ["iOS", "Android", "Flutter", "React Native"],
  },
];

export default function ServicesPage() {
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
              "radial-gradient(ellipse 900px 400px at 80% 10%, rgba(var(--accent-rgb, 198 242 78), 0.08), transparent 60%)",
          }}
        />
        <div className="relative mx-auto grid max-w-[1280px] grid-cols-1 items-center gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:gap-[72px]">
          <div>
            <p className="halo-eyebrow">§ 00 · Services</p>
            <h1 className="mt-6 font-display font-medium leading-[1] tracking-tightest text-text text-[clamp(44px,6.4vw,72px)]">
              Practitioner-led.
              <br />
              <span className="text-text-muted">Hands on the keys.</span>
              <br />
              <span className="italic font-normal text-accent">
                Shipping day one.
              </span>
            </h1>
            <p className="mt-7 max-w-[520px] font-sans text-lg leading-[1.55] text-text-muted">
              Every engagement is staffed by people who have held the pager,
              written the runbooks, and answered the 3am call. Security
              advisory, cloud engineering, and software delivery — on the same
              team.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link href="/contact" className="halo-btn-accent">
                Book a call <span className="halo-arrow" aria-hidden="true">&rarr;</span>
              </Link>
              <Link href="/blog" className="halo-btn-ghost">
                See case studies
              </Link>
            </div>
          </div>

          <aside className="halo-card p-7">
            <p className="halo-eyebrow">§ Posture</p>
            <dl className="mt-4">
              {POSTURE.map((row, i) => (
                <div
                  key={row.k}
                  className={`flex items-baseline justify-between py-3.5 ${
                    i < POSTURE.length - 1 ? "border-b border-border" : ""
                  }`}
                >
                  <dt className="font-mono text-[11.5px] uppercase tracking-[0.08em] text-text-muted">
                    {row.k}
                  </dt>
                  <dd className="m-0 font-sans text-sm text-text">{row.v}</dd>
                </div>
              ))}
            </dl>
          </aside>
        </div>
      </section>

      {/* ── Categories: block-of-6 layouts ─────────────────────── */}
      {serviceCategories.map((cat, idx) => (
        <section
          key={cat.id}
          className="border-b border-border px-6 py-24 sm:px-12"
        >
          <HaloSectionHead
            eyebrow={`§ 0${idx + 1} · ${cat.label}`}
            title={
              cat.id === "security"
                ? "Security that earns its pay."
                : cat.id === "identity"
                ? "Identity and devices, managed."
                : cat.id === "cloud"
                ? "Cloud that holds up under audit."
                : "AI, secured from the first prompt."
            }
            blurb={
              cat.id === "security"
                ? "Vendor-neutral, practitioner-led security engagements. Pick one, pick all — they compound."
                : cat.id === "identity"
                ? "SSO, MFA, device compliance, and lifecycle automation across macOS, Windows, and mobile fleets."
                : cat.id === "cloud"
                ? "Architecture, hardening, FinOps, DR, and dedicated hosting for regulated industries."
                : "LLM threat assessments, prompt-injection defence, and AI governance for the EU AI Act and NIST AI RMF era."
            }
          />
          <div className="mx-auto mt-12 grid max-w-[1280px] grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {cat.services.map((svc, i) => (
              <article
                key={svc.name}
                className="halo-card relative flex flex-col p-7 transition-colors hover:border-border-strong"
              >
                <div className="flex items-baseline justify-between">
                  <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-accent">
                    {String(i + 1).padStart(2, "0")}
                  </div>
                  <div className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-text-dim">
                    {cat.label}
                  </div>
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
        </section>
      ))}

      {/* ── Software delivery: entry point into /webapp and /mobile ── */}
      <section className="border-b border-border px-6 py-24 sm:px-12">
        <HaloSectionHead
          eyebrow={`§ 0${serviceCategories.length + 1} · Build`}
          title="Software delivery, end to end."
          blurb="Beyond advisory — we design and ship the product itself. Web and mobile builds led by the same practitioners, handed over with the keys."
        />
        <div className="mx-auto mt-12 grid max-w-[1280px] grid-cols-1 gap-4 lg:grid-cols-2">
          {DELIVERY.map((card, i) => (
            <Link
              key={card.href}
              href={card.href}
              className="halo-card halo-card-hover halo-arrow-parent group relative flex flex-col p-8 transition-colors hover:border-border-strong"
            >
              <div className="flex items-baseline justify-between">
                <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-accent">
                  {String(i + 1).padStart(2, "0")}
                </div>
                <div className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-text-dim">
                  {card.kicker}
                </div>
              </div>
              <h3 className="mt-4 font-display text-[26px] font-medium leading-[1.1] tracking-display text-text">
                {card.title}
              </h3>
              <p className="mt-3 max-w-md font-sans text-sm leading-[1.6] text-text-muted">
                {card.body}
              </p>
              <div className="mt-5 flex flex-wrap gap-1.5">
                {card.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-md border border-border bg-surface-alt px-2 py-0.5 font-mono text-[10.5px] text-text-muted"
                  >
                    {tag}
                  </span>
                ))}
              </div>
              <span className="mt-7 font-mono text-xs uppercase tracking-[0.06em] text-accent">
                Explore <span className="halo-arrow" aria-hidden="true">&rarr;</span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* ── Engagement shapes ──────────────────────────────────── */}
      <section className="border-b border-border px-6 py-24 sm:px-12">
        <HaloSectionHead
          eyebrow={`§ 0${serviceCategories.length + 2} · Shape`}
          title="Four ways to engage."
          blurb="Pick the shape that fits the moment. Retainers compound. Projects ship. Hourly covers the incident you didn't see coming."
        />
        <div className="mx-auto mt-12 grid max-w-[1160px] grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {engagementModels.map((m) => (
            <div key={m.title} className="halo-card halo-card-hover p-6">
              <h3 className="font-sans text-[20px] font-medium tracking-[-0.02em] text-text">
                {m.title}
              </h3>
              <p className="mt-3 font-sans text-[13.5px] leading-[1.55] text-text-muted">
                {m.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      <HaloCTA
        title="Talk to a practitioner, not a salesperson."
        titleAccent="practitioner"
        sub="30-minute call. If we're not the right fit, we'll tell you who is."
        primaryLabel="Book a call"
        primaryHref="/contact"
        secondaryLabel="See case studies"
        secondaryHref="/blog"
      />

      <HaloFooter />
    </>
  );
}
