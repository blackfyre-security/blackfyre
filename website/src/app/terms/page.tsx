import type { Metadata } from "next";
import Link from "next/link";
import HaloNav from "@/components/halo/HaloNav";
import HaloFooter from "@/components/halo/HaloFooter";
import HaloReveal from "@/components/halo/HaloReveal";

export const metadata: Metadata = {
  title: "Terms of Service — Blackfyre",
  description:
    "Terms governing the use of the BLACKFYRE platform and professional security services.",
};

export default function TermsOfService() {
  return (
    <>
      <HaloNav />

      <HaloReveal delay={0}>
      <main className="mx-auto max-w-[720px] px-6 py-16 sm:py-20">
        {/* Header */}
        <header className="mb-12">
          <p className="halo-eyebrow">§ Terms of Service</p>
          <h1 className="mt-4 font-display text-[clamp(32px,4.5vw,48px)] font-medium leading-[1.05] tracking-display text-text [text-wrap:balance]">
            Terms of Service
          </h1>
          <p className="halo-label mt-4">
            Effective date: 1 April 2026 &middot; Last updated: 1 April 2026
          </p>
          <div className="halo-hairline mt-10" />
          <p className="mt-10 text-[16px] leading-[1.75] text-text-muted">
            These Terms of Service (&ldquo;Terms&rdquo;) govern your access to and use of the BLACKFYRE platform
            and professional services provided by Blackfyre Consulting (&ldquo;Blackfyre&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;),
            a consulting firm based in Chennai, India. By accessing our platform or engaging our services
            you agree to be bound by these Terms.
          </p>
        </header>

        <div className="space-y-14 text-[16px] leading-[1.75] text-text-muted">
          {/* Section 1 */}
          <section>
            <h2 className="mb-5 font-display text-[24px] font-medium leading-[1.2] tracking-display text-text">
              1. Acceptance of Terms
            </h2>
            <p>
              By creating an account, signing an engagement letter, or otherwise accessing our services,
              you confirm that you have read, understood, and agree to these Terms and our{" "}
              <Link href="/privacy" className="text-accent underline-offset-4 hover:underline">
                Privacy Policy
              </Link>
              . If you are accepting on behalf of an organisation, you represent that you have the authority
              to bind that organisation. If you do not agree, do not use our services.
            </p>
          </section>

          {/* Section 2 */}
          <section>
            <h2 className="mb-5 font-display text-[24px] font-medium leading-[1.2] tracking-display text-text">
              2. Service Description
            </h2>
            <div className="space-y-4">
              <div className="halo-card p-5">
                <p className="mb-2 font-display text-[15px] font-medium tracking-display text-text">
                  SaaS Platform
                </p>
                <p className="text-[14px] leading-relaxed">
                  The BLACKFYRE platform is a multi-tenant, cloud-hosted security management product
                  available in three subscription tiers: Comply, Protect, and Defend. Features vary by
                  tier as described on our pricing page.
                </p>
              </div>
              <div className="halo-card p-5">
                <p className="mb-2 font-display text-[15px] font-medium tracking-display text-text">
                  Professional Services
                </p>
                <p className="text-[14px] leading-relaxed">
                  Advisory and hands-on services including virtual CISO (vCISO), Vulnerability Assessment
                  and Penetration Testing (VAPT), compliance advisory, and security architecture reviews.
                  Professional services are governed by a separate Statement of Work (SOW) or engagement
                  letter.
                </p>
              </div>
            </div>
          </section>

          {/* Section 3 */}
          <section>
            <h2 className="mb-5 font-display text-[24px] font-medium leading-[1.2] tracking-display text-text">
              3. Account Responsibilities
            </h2>
            <ul className="space-y-2">
              {[
                "You are responsible for maintaining the confidentiality of your login credentials.",
                "You must immediately notify us of any suspected unauthorised access at founder@blackfyre.tech.",
                "You must ensure all users within your tenant comply with these Terms.",
                "You must provide accurate registration information and keep it updated.",
                "You must not share credentials between multiple individuals.",
              ].map((item) => (
                <li key={item} className="flex gap-3">
                  <span className="mt-[10px] h-1.5 w-1.5 flex-shrink-0 rounded-full bg-accent" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* Section 4 */}
          <section>
            <h2 className="mb-5 font-display text-[24px] font-medium leading-[1.2] tracking-display text-text">
              4. Acceptable Use Policy
            </h2>
            <p className="mb-3">You must not:</p>
            <ul className="space-y-2">
              {[
                "Use the platform to conduct security tests against systems you do not own or have explicit written permission to test.",
                "Attempt to access other tenants' data or circumvent row-level security controls.",
                "Reverse-engineer, decompile, or attempt to extract the platform's source code.",
                "Resell or sublicense access to the platform without our written consent.",
                "Use the platform in violation of any applicable law or regulation.",
                "Introduce malware, viruses, or any code designed to disrupt platform operations.",
                "Exceed the resource usage limits for your subscription tier.",
              ].map((item) => (
                <li key={item} className="flex gap-3">
                  <span className="mt-[10px] h-1.5 w-1.5 flex-shrink-0 rounded-full bg-crit" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* Section 5 */}
          <section>
            <h2 className="mb-5 font-display text-[24px] font-medium leading-[1.2] tracking-display text-text">
              5. Payment Terms
            </h2>
            <p className="mb-4">
              All fees are quoted and invoiced in Indian Rupees (INR) unless otherwise stated in a separate agreement.
            </p>
            <div className="overflow-hidden rounded-[14px] border border-border">
              <table className="w-full text-[14px]">
                <thead className="bg-surface">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-text">Item</th>
                    <th className="px-4 py-3 text-left font-medium text-text">Detail</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {[
                    ["GST", "18% GST applied to all invoices as required under Indian tax law."],
                    ["Payment terms", "Net 30 days from invoice date."],
                    ["Platform subscriptions", "Billed monthly or annually in advance."],
                    ["Professional services", "50% upfront, 50% on delivery unless otherwise agreed."],
                    ["Late payments", "1.5% per month on overdue balances after 30-day grace period."],
                  ].map(([item, detail]) => (
                    <tr key={item} className="bg-bg">
                      <td className="whitespace-nowrap px-4 py-3 font-medium text-text">{item}</td>
                      <td className="px-4 py-3 text-text-muted">{detail}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Section 6 */}
          <section>
            <h2 className="mb-5 font-display text-[24px] font-medium leading-[1.2] tracking-display text-text">
              6. Service Levels &amp; Warranty
            </h2>
            <div className="halo-card space-y-4 p-5 text-[14px] leading-relaxed">
              <p>
                <span className="font-medium text-text">Self-hosted (Apache-2.0):</span> the
                software is provided &ldquo;as is&rdquo;, without warranty of any kind. You run it
                on infrastructure you control, and its availability is your responsibility. See the
                LICENSE for the full disclaimer.
              </p>
              <p className="border-t border-border pt-4">
                <span className="font-medium text-text">Hosted option:</span> the managed cloud is
                in early access and does not carry a committed uptime SLA. Any service levels for a
                paid hosted tier will be set out in a separate agreement if and when that tier
                becomes generally available.
              </p>
            </div>
          </section>

          {/* Section 7 */}
          <section>
            <h2 className="mb-5 font-display text-[24px] font-medium leading-[1.2] tracking-display text-text">
              7. Limitation of Liability
            </h2>
            <p className="mb-4">To the maximum extent permitted by applicable law:</p>
            <ul className="space-y-2">
              {[
                "Blackfyre's total aggregate liability to you for any claim arising from these Terms or the services shall not exceed the total fees paid by you in the 12 months preceding the claim.",
                "We shall not be liable for indirect, incidental, consequential, special, or punitive damages, including loss of profits, data, or business opportunity.",
                "We do not warrant that the platform will be error-free or that security vulnerabilities identified in assessments are exhaustive.",
              ].map((item) => (
                <li key={item} className="flex gap-3">
                  <span className="mt-[10px] h-1.5 w-1.5 flex-shrink-0 rounded-full bg-accent" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-[14px] text-text-dim">
              Nothing in these Terms limits liability for fraud, death or personal injury caused by negligence,
              or any other liability that cannot be excluded under applicable law.
            </p>
          </section>

          {/* Section 8 */}
          <section>
            <h2 className="mb-5 font-display text-[24px] font-medium leading-[1.2] tracking-display text-text">
              8. Intellectual Property
            </h2>
            <p className="mb-3">
              The BLACKFYRE platform, its underlying technology, brand assets, and proprietary methodologies
              are the sole intellectual property of Blackfyre Consulting. We grant you a limited,
              non-exclusive, non-transferable licence to use the platform for your internal business
              purposes during the subscription term.
            </p>
            <p>
              Reports, recommendations, and deliverables produced under a professional services engagement
              are licensed to you for internal use upon full payment. Blackfyre retains the right to use
              anonymised, aggregated insights for product improvement and research.
            </p>
          </section>

          {/* Section 9 */}
          <section>
            <h2 className="mb-5 font-display text-[24px] font-medium leading-[1.2] tracking-display text-text">
              9. Data Ownership
            </h2>
            <div className="halo-card p-5">
              <p>
                <span className="font-medium text-text">You own your data. Always.</span> Scan results,
                compliance evidence, uploaded assets, and all data you create or input into the platform
                remain your exclusive property. Blackfyre has no rights to your data beyond what is
                strictly necessary to deliver the services you have subscribed to.
              </p>
              <p className="mt-3 text-[14px] leading-relaxed">
                We will never use your data to train AI models, share it with competitors, or disclose it
                to third parties except as required by law or as directed by you.
              </p>
            </div>
          </section>

          {/* Section 10 */}
          <section>
            <h2 className="mb-5 font-display text-[24px] font-medium leading-[1.2] tracking-display text-text">
              10. Termination
            </h2>
            <div className="space-y-3">
              <p>
                Either party may terminate a platform subscription by providing 30 days&apos; written notice
                prior to the next renewal date. Professional services engagements may be terminated
                per the terms of the applicable SOW.
              </p>
              <p>
                Upon termination, you may request a full export of your data within 30 days. We will
                provide data in a standard, portable format (JSON/CSV) at no charge. After the 30-day
                window, data will be purged in accordance with our retention policy.
              </p>
              <p>
                We reserve the right to terminate immediately for material breach of these Terms,
                including violations of the Acceptable Use Policy, with written notice of the breach.
              </p>
            </div>
          </section>

          {/* Section 11 */}
          <section>
            <h2 className="mb-5 font-display text-[24px] font-medium leading-[1.2] tracking-display text-text">
              11. Governing Law &amp; Disputes
            </h2>
            <p>
              These Terms are governed by the laws of India. Any dispute arising from or relating to these
              Terms shall be subject to the exclusive jurisdiction of the courts of Chennai, Tamil Nadu,
              India. We encourage good-faith resolution of disputes before resorting to litigation —
              contact us at{" "}
              <a href="mailto:founder@blackfyre.tech" className="text-accent underline-offset-4 hover:underline">
                founder@blackfyre.tech
              </a>
              {" "}first.
            </p>
          </section>

          {/* Section 12 */}
          <section>
            <h2 className="mb-5 font-display text-[24px] font-medium leading-[1.2] tracking-display text-text">
              12. Changes to These Terms
            </h2>
            <p>
              We may update these Terms from time to time. Material changes will be communicated via
              email at least 14 days before taking effect. Your continued use of the services after the
              effective date constitutes acceptance of the revised Terms.
            </p>
          </section>

          {/* Contact */}
          <section className="halo-card p-6">
            <p className="halo-eyebrow">§ Questions</p>
            <p className="mt-4">
              For any questions about these Terms, please contact:
            </p>
            <div className="mt-4 space-y-1 text-[14px]">
              <p>Blackfyre Consulting</p>
              <p>Chennai, India</p>
              <p>
                Email:{" "}
                <a href="mailto:founder@blackfyre.tech" className="text-accent underline-offset-4 hover:underline">
                  founder@blackfyre.tech
                </a>
              </p>
            </div>
          </section>
        </div>
      </main>
      </HaloReveal>

      <HaloFooter />
    </>
  );
}
