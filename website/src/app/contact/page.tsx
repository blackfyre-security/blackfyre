"use client";

import HaloNav from "@/components/halo/HaloNav";
import HaloFooter from "@/components/halo/HaloFooter";
import HaloSectionHead from "@/components/halo/HaloSectionHead";
import ContactForm from "@/components/ContactForm";
import HaloReveal from "@/components/halo/HaloReveal";

const WHAT_TO_EXPECT: { label: string; detail: string }[] = [
  {
    label: "24-hour reply",
    detail: "A real reply from the founding team — not a ticket auto-reply.",
  },
  {
    label: "Honest assessment",
    detail: "We'll tell you if we're the right fit, and flag it early if we're not.",
  },
  {
    label: "Next step proposed",
    detail:
      "Either a 30-minute call, a written scope, or a pointer to someone better suited.",
  },
];

export default function ContactPage() {
  return (
    <>
      <HaloNav />

      <HaloReveal as="section" delay={0} className="border-b border-border px-6 py-20 sm:px-12 sm:py-24">
        <HaloSectionHead
          eyebrow="§ Talk to us"
          title="Tell us what you're shipping."
          titleAccent="shipping"
          blurb="A short message gets you a real reply from the founding team within 24 hours. No drip campaign, no sequence — just one human reading what you sent."
        />
      </HaloReveal>

      <HaloReveal as="section" delay={120} className="px-6 py-20 sm:px-12 sm:py-24">
        <div className="mx-auto grid max-w-[1120px] grid-cols-1 gap-12 lg:grid-cols-[1.15fr_0.85fr] lg:gap-16">
          <div className="halo-card p-8 sm:p-10">
            <p className="halo-eyebrow">§ Message</p>
            <h2 className="mt-3 font-display text-[clamp(24px,3vw,32px)] font-medium leading-[1.1] tracking-display text-text">
              Send us a note.
            </h2>
            <p className="mt-2 text-[14px] leading-relaxed text-text-muted">
              Routed to marketing@blackfyre.tech · reply within 24 hours.
            </p>
            <div className="mt-8">
              <ContactForm />
            </div>
          </div>

          <aside className="flex flex-col gap-8">
            <div className="halo-card p-8">
              <p className="halo-eyebrow">§ What to expect</p>
              <ul className="mt-5 divide-y divide-border">
                {WHAT_TO_EXPECT.map((item) => (
                  <li key={item.label} className="flex items-start gap-4 py-4 first:pt-0 last:pb-0">
                    <span className="halo-live-dot mt-1.5 shrink-0" aria-hidden />
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

            <div className="halo-card p-8">
              <p className="halo-label">Who reads this</p>
              <p className="mt-3 text-[14px] leading-relaxed text-text-muted">
                The founding team. Same people who&apos;ll write the first line
                of code, sit in your architecture reviews, and ship the release
                notes.
              </p>
            </div>
          </aside>
        </div>
      </HaloReveal>

      <HaloFooter />
    </>
  );
}
