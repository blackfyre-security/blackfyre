import type { Metadata } from "next";

import HaloNav from "@/components/halo/HaloNav";
import HaloFooter from "@/components/halo/HaloFooter";
import HaloSectionHead from "@/components/halo/HaloSectionHead";
import HaloReveal from "@/components/halo/HaloReveal";
import ContactForm from "@/components/ContactForm";
import { SITE } from "@/data/site";

export const metadata: Metadata = {
  title: "Contact — Blackfyre",
  description:
    "Contact the Blackfyre team for hosted / managed-cloud early access, enterprise SSO and support, or security disclosures. Bug reports and feature requests go to GitHub Issues.",
};

const ISSUES_URL = `${SITE.repoUrl}/issues`;
const SECURITY_URL = `${SITE.repoUrl}/blob/main/SECURITY.md`;

const REASONS: { label: string; detail: string }[] = [
  {
    label: "Hosted & managed cloud",
    detail:
      "Early access to a managed Blackfyre — we run the AWS stack so you don't have to. Self-hosting stays free forever under Apache-2.0.",
  },
  {
    label: "Enterprise SSO & support",
    detail:
      "SAML, SCIM provisioning, auditor-scoped roles, and a support relationship for teams standardizing on Blackfyre.",
  },
  {
    label: "Security disclosures",
    detail:
      "Report a vulnerability privately. See the security policy for scope and the coordinated-disclosure process.",
  },
];

export default function ContactPage() {
  return (
    <>
      <HaloNav />

      <HaloReveal
        as="section"
        delay={0}
        className="relative overflow-hidden border-b border-border px-6 py-20 sm:px-12 sm:py-24"
      >
        <div className="halo-hero-glow" aria-hidden />
        <div className="relative">
          <HaloSectionHead
            eyebrow="§ Contact"
            title="Hosted, enterprise, and security."
            titleAccent="security"
            blurb="Blackfyre is open source and free to self-host. Use this channel for a managed / hosted deployment, enterprise SSO and support, or to disclose a security issue. For bug reports and feature requests, open a GitHub issue — that's where the work happens in the open."
          />
          <div className="mx-auto mt-8 flex max-w-[720px] flex-wrap justify-center gap-3">
            <a
              href={SITE.repoUrl}
              target="_blank"
              rel="noreferrer"
              className="halo-btn-accent"
            >
              Star on GitHub{" "}
              <span className="halo-arrow" aria-hidden="true">
                →
              </span>
            </a>
            <a
              href={ISSUES_URL}
              target="_blank"
              rel="noreferrer"
              className="halo-btn-ghost"
            >
              Open a GitHub issue
            </a>
          </div>
        </div>
      </HaloReveal>

      <HaloReveal as="section" delay={120} className="px-6 py-20 sm:px-12 sm:py-24">
        <div className="mx-auto grid max-w-[1120px] grid-cols-1 gap-12 lg:grid-cols-[1.15fr_0.85fr] lg:gap-16">
          <div className="halo-card p-8 sm:p-10">
            <p className="halo-eyebrow">§ Message</p>
            <h2 className="mt-3 font-display text-[clamp(24px,3vw,32px)] font-medium leading-[1.1] tracking-display text-text">
              Tell us what you need.
            </h2>
            <p className="mt-2 text-[14px] leading-relaxed text-text-muted">
              Routed to marketing@blackfyre.tech — a human reads every note and
              routes hosted, enterprise, or security requests to the right person.
            </p>
            <div className="mt-8">
              <ContactForm />
            </div>
          </div>

          <aside className="flex flex-col gap-8">
            <div className="halo-card p-8">
              <p className="halo-eyebrow">§ What this inbox is for</p>
              <ul className="mt-5 space-y-5">
                {REASONS.map((item) => (
                  <li key={item.label} className="flex items-start gap-3">
                    <span
                      className="mt-0.5 shrink-0 font-mono text-accent"
                      aria-hidden
                    >
                      ✓
                    </span>
                    <div>
                      <p className="font-display text-[15px] font-medium tracking-display text-text">
                        {item.label}
                      </p>
                      <p className="mt-1 text-[13.5px] leading-relaxed text-text-muted">
                        {item.detail}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="halo-card p-8">
              <p className="halo-label">Bugs &amp; feature requests</p>
              <p className="mt-3 text-[14px] leading-relaxed text-text-muted">
                Found a bug or want a feature? Open an issue on{" "}
                <a
                  href={ISSUES_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="text-accent underline-offset-4 hover:underline"
                >
                  GitHub Issues
                </a>{" "}
                so the whole community can follow along.
              </p>
            </div>

            <div className="halo-card p-8">
              <p className="halo-label">Security disclosures</p>
              <p className="mt-3 text-[14px] leading-relaxed text-text-muted">
                Please report vulnerabilities privately per the{" "}
                <a
                  href={SECURITY_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="text-accent underline-offset-4 hover:underline"
                >
                  security policy
                </a>{" "}
                — not through public issues.
              </p>
            </div>

            <div className="halo-card p-8">
              <p className="halo-label">Direct email</p>
              <p className="mt-3 text-[14px] leading-relaxed text-text-muted">
                Prefer to write first? Reach us at{" "}
                <a
                  href="mailto:marketing@blackfyre.tech"
                  className="text-accent underline-offset-4 hover:underline"
                >
                  marketing@blackfyre.tech
                </a>
                .
              </p>
            </div>
          </aside>
        </div>
      </HaloReveal>

      <HaloFooter />
    </>
  );
}
