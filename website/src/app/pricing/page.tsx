import type { Metadata } from "next";
import Link from "next/link";
import HaloNav from "@/components/halo/HaloNav";
import HaloFooter from "@/components/halo/HaloFooter";
import HaloSectionHead from "@/components/halo/HaloSectionHead";
import HaloCTA from "@/components/halo/HaloCTA";
import HaloReveal from "@/components/halo/HaloReveal";
import HaloStatusDot from "@/components/halo/HaloStatusDot";
import { platformTiers, tierComparison } from "@/data/content";

export const metadata: Metadata = {
  title: "Pricing — Comply, Protect, Defend | BLACKFYRE",
  description:
    "Three tiers, one posture runtime. Start with automated compliance, layer on multi-cloud scanning and AI remediation, or unlock continuous defence with threat intelligence.",
};

export default function PricingPage() {
  return (
    <>
      <HaloNav />

      <HaloReveal as="section" delay={0} className="border-b border-border px-6 py-20 sm:px-12 sm:py-24">
        <HaloSectionHead
          eyebrow="§ Pricing"
          title="Three tiers. One posture runtime."
          titleAccent="One posture runtime."
          blurb="Start with automated compliance, layer on multi-cloud scanning and AI remediation, or unlock continuous defence with threat intelligence. All prices in INR (₹) — talk to us for USD or annual."
        />
      </HaloReveal>

      <HaloReveal as="section" delay={120} className="border-b border-border px-6 py-20 sm:px-12 sm:py-24">
        <div className="mx-auto grid max-w-[1280px] grid-cols-1 gap-4 lg:grid-cols-3">
          {platformTiers.map((tier) => (
            <div key={tier.name} className="group relative">
              {tier.badge && (
                <span className="pointer-events-none absolute -top-3 left-6 z-10 rounded-full bg-accent px-3 py-1 font-mono text-[10.5px] uppercase tracking-[0.16em] text-[color:var(--accent-ink)] shadow-halo-glow transition-all duration-300 ease-out group-hover:-translate-y-0.5 group-hover:rotate-[-1.5deg] group-hover:shadow-[0_8px_24px_-6px_var(--accent)]">
                  {tier.badge}
                </span>
              )}
              <article
                className={`halo-card halo-card-hover flex h-full flex-col p-7 ${
                  tier.badge ? "border-accent" : ""
                }`}
              >
              <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-accent">
                {tier.name}
              </div>
              <div className="mt-3 flex items-baseline gap-1.5">
                <span className="font-sans text-[36px] font-medium tracking-[-0.02em] text-text">
                  {tier.price}
                </span>
                <span className="font-mono text-xs text-text-muted">
                  {tier.period}
                </span>
              </div>
              <p className="mt-3 font-sans text-sm leading-[1.55] text-text-muted">
                {tier.description}
              </p>
              <ul className="mt-5 flex flex-col gap-2.5">
                {tier.features.map((ft) => (
                  <li
                    key={ft}
                    className="flex items-start gap-2.5 font-sans text-[13.5px] leading-[1.5] text-text"
                  >
                    <HaloStatusDot size="sm" steady className="mt-1.5 shrink-0" />
                    <span>{ft}</span>
                  </li>
                ))}
              </ul>
              </article>
            </div>
          ))}
        </div>
        <div className="mx-auto mt-14 max-w-[1280px]">
          <div className="halo-card flex flex-col items-start gap-6 p-7 sm:flex-row sm:items-center sm:justify-between sm:gap-10 sm:p-9">
            <div className="max-w-[640px]">
              <p className="halo-eyebrow">§ Custom needs</p>
              <h3 className="mt-3 font-display text-[clamp(22px,2.4vw,28px)] font-medium leading-[1.15] tracking-display text-text">
                Need a plan that fits your stack?
              </h3>
              <p className="mt-2 text-[14px] leading-relaxed text-text-muted">
                Volume pricing, on-prem deployments, custom integrations, dedicated support — sales can shape any of it around your timeline.
              </p>
            </div>
            <Link href="/contact" className="halo-btn-accent shrink-0">
              Contact sales <span className="halo-arrow" aria-hidden="true">&rarr;</span>
            </Link>
          </div>
        </div>
      </HaloReveal>

      <HaloReveal as="section" delay={240} className="border-b border-border px-6 py-20 sm:px-12 sm:py-24">
        <HaloSectionHead
          eyebrow="§ Coverage"
          title="What each tier includes."
        />
        <div className="mx-auto mt-12 max-w-[1160px] overflow-hidden rounded-[12px] border border-border bg-surface">
          <div className="grid grid-cols-[1.4fr_1fr_1fr_1fr] border-b border-border px-6 py-4 font-mono text-[11px] uppercase tracking-[0.14em] text-text-dim">
            <span>Capability</span>
            <span>Comply</span>
            <span>Protect</span>
            <span className="text-accent">Defend</span>
          </div>
          {tierComparison.map((row, i) => (
            <div
              key={row.feature}
              className={`grid grid-cols-[1.4fr_1fr_1fr_1fr] items-center px-6 py-4 font-sans text-sm ${
                i < tierComparison.length - 1 ? "border-b border-border" : ""
              }`}
            >
              <span className="text-text">{row.feature}</span>
              <span className="font-mono text-xs text-text-muted">
                {row.comply === "—" ? "—" : row.comply}
              </span>
              <span className="font-mono text-xs text-text">
                {row.protect === "—" ? "—" : row.protect}
              </span>
              <span className="font-mono text-xs text-accent">
                {row.defend === "—" ? "—" : row.defend}
              </span>
            </div>
          ))}
        </div>
      </HaloReveal>

      <HaloCTA
        title="Not sure which tier?"
        titleAccent="which tier"
        sub="Tell us what you're shipping — we'll point you at the right one within 24 hours."
        primaryLabel="Talk to us"
        primaryHref="/contact"
        secondaryLabel=""
        secondaryHref=""
      />

      <HaloFooter />
    </>
  );
}
