import type { Metadata } from "next";
import Link from "next/link";
import HaloNav from "@/components/halo/HaloNav";
import HaloFooter from "@/components/halo/HaloFooter";
import HaloReveal from "@/components/halo/HaloReveal";

export const metadata: Metadata = {
  title: "Privacy Policy — Blackfyre",
  description:
    "How Blackfyre Consulting collects, processes, and protects your data. GDPR and DPDPA compliant.",
};

export default function PrivacyPolicy() {
  return (
    <>
      <HaloNav />

      <HaloReveal delay={0}>
      <main className="mx-auto max-w-[720px] px-6 py-16 sm:py-20">
        {/* Header */}
        <header className="mb-12">
          <p className="halo-eyebrow">§ Privacy Policy</p>
          <h1 className="mt-4 font-display text-[clamp(32px,4.5vw,48px)] font-medium leading-[1.05] tracking-display text-text [text-wrap:balance]">
            Privacy Policy
          </h1>
          <p className="halo-label mt-4">
            Effective date: 1 April 2026 &middot; Last updated: 1 April 2026
          </p>
          <div className="halo-hairline mt-10" />
          <p className="mt-10 text-[16px] leading-[1.75] text-text-muted">
            Blackfyre Consulting (&ldquo;we&rdquo;, &ldquo;us&rdquo;, or &ldquo;our&rdquo;), Chennai, India, operates the
            BLACKFYRE security platform and related professional services. This policy explains how we collect,
            use, store, and protect personal data. We are committed to compliance with the EU General Data
            Protection Regulation (GDPR) and India&apos;s Digital Personal Data Protection Act 2023 (DPDPA).
          </p>
        </header>

        <div className="space-y-14 text-[16px] leading-[1.75] text-text-muted">
          {/* Section 1 */}
          <section>
            <h2 className="mb-5 font-display text-[24px] font-medium leading-[1.2] tracking-display text-text">
              1. Data We Collect
            </h2>
            <div className="space-y-4">
              <div className="halo-card p-5">
                <p className="mb-2 font-display text-[15px] font-medium tracking-display text-text">
                  Contact Form Submissions
                </p>
                <p>
                  Name, email address, company name, and the message content you provide when reaching out to us. This data is collected solely to respond to your inquiry.
                </p>
              </div>
              <div className="halo-card p-5">
                <p className="mb-2 font-display text-[15px] font-medium tracking-display text-text">
                  Platform Usage Data
                </p>
                <p>
                  For registered platform users: login events, feature interactions, audit log entries, and session metadata. This data is associated with your tenant account and never shared across tenants.
                </p>
              </div>
              <div className="halo-card p-5">
                <p className="mb-2 font-display text-[15px] font-medium tracking-display text-text">
                  Scan Results and Evidence
                </p>
                <p>
                  Vulnerability scan outputs, compliance evidence artefacts, and assessment reports that you or our consultants upload or generate on the platform. You own this data — see Section 10.
                </p>
              </div>
              <div className="halo-card p-5">
                <p className="mb-2 font-display text-[15px] font-medium tracking-display text-text">
                  Technical Data
                </p>
                <p>
                  IP addresses, browser type, and access timestamps collected automatically for security monitoring and abuse prevention. This data is not used for advertising.
                </p>
              </div>
            </div>
          </section>

          {/* Section 2 */}
          <section>
            <h2 className="mb-5 font-display text-[24px] font-medium leading-[1.2] tracking-display text-text">
              2. How We Use Your Data
            </h2>
            <ul className="space-y-2 list-none">
              {[
                "Service delivery — provisioning and operating the platform and professional services you have engaged.",
                "Communication — responding to inquiries, sending service notifications, and delivering reports.",
                "Security operations — detecting and investigating threats, abuse, and unauthorised access.",
                "Product improvement — aggregated, anonymised analytics to improve platform features. No individual profiling.",
                "Legal compliance — meeting obligations under applicable Indian and international law.",
              ].map((item) => (
                <li key={item} className="flex gap-3">
                  <span className="mt-[10px] h-1.5 w-1.5 flex-shrink-0 rounded-full bg-accent" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <p className="mt-5">
              We process data on the legal bases of contractual necessity, legitimate interest (security
              monitoring), and — where required — your explicit consent.
            </p>
          </section>

          {/* Section 3 */}
          <section>
            <h2 className="mb-5 font-display text-[24px] font-medium leading-[1.2] tracking-display text-text">
              3. Data Retention
            </h2>
            <div className="overflow-hidden rounded-[14px] border border-border">
              <table className="w-full text-[14px]">
                <thead className="bg-surface">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-text">Data Category</th>
                    <th className="px-4 py-3 text-left font-medium text-text">Retention Period</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {[
                    ["Contact form data", "2 years from submission"],
                    ["Platform usage logs", "90 days rolling"],
                    ["Scan results — Comply Tier", "12 months from scan date"],
                    ["Scan results — Protect Tier", "24 months from scan date"],
                    ["Scan results — Defend Tier", "36 months or as agreed in contract"],
                    ["Billing records", "7 years (statutory requirement)"],
                    ["Audit logs", "2 years"],
                  ].map(([cat, ret]) => (
                    <tr key={cat} className="bg-bg">
                      <td className="px-4 py-3 text-text-muted">{cat}</td>
                      <td className="px-4 py-3 text-text-muted">{ret}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-4 text-[14px] text-text-dim">
              Upon account termination you may request a full data export. Data is purged within 30 days of
              the export window closing, except where retention is required by law.
            </p>
          </section>

          {/* Section 4 */}
          <section>
            <h2 className="mb-5 font-display text-[24px] font-medium leading-[1.2] tracking-display text-text">
              4. Your GDPR Rights
            </h2>
            <p className="mb-5">
              If you are located in the European Economic Area or UK, you have the following rights:
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { right: "Right of Access", desc: "Request a copy of the personal data we hold about you." },
                { right: "Right to Rectification", desc: "Ask us to correct inaccurate or incomplete data." },
                { right: "Right to Erasure", desc: "Request deletion of your data where no legitimate basis for retention exists." },
                { right: "Right to Portability", desc: "Receive your data in a structured, machine-readable format." },
                { right: "Right to Object", desc: "Object to processing based on legitimate interests." },
                { right: "Right to Restrict", desc: "Ask us to pause processing while a dispute is resolved." },
              ].map(({ right, desc }) => (
                <div key={right} className="halo-card p-4">
                  <p className="font-display text-[14px] font-medium tracking-display text-text">{right}</p>
                  <p className="mt-1 text-[13px] leading-relaxed text-text-muted">{desc}</p>
                </div>
              ))}
            </div>
            <p className="mt-5 text-[14px]">
              To exercise any of these rights, email{" "}
              <a href="mailto:founder@blackfyre.tech" className="text-accent underline-offset-4 hover:underline">
                founder@blackfyre.tech
              </a>
              . We will respond within 30 days.
            </p>
          </section>

          {/* Section 5 */}
          <section>
            <h2 className="mb-5 font-display text-[24px] font-medium leading-[1.2] tracking-display text-text">
              5. DPDPA Compliance (India)
            </h2>
            <p className="mb-4">
              Blackfyre Consulting is a Data Fiduciary under the Digital Personal Data Protection Act 2023.
              We process personal data of Indian residents in accordance with the Act, including:
            </p>
            <ul className="space-y-2">
              {[
                "Collecting data only for a specified, lawful purpose with your consent or on legitimate grounds.",
                "Appointing a Data Protection Officer reachable at founder@blackfyre.tech.",
                "Implementing appropriate technical and organisational safeguards.",
                "Notifying the Data Protection Board and affected individuals of a personal data breach within 72 hours.",
                "Honouring grievance redressal requests within 30 days.",
              ].map((item) => (
                <li key={item} className="flex gap-3">
                  <span className="mt-[10px] h-1.5 w-1.5 flex-shrink-0 rounded-full bg-accent" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* Section 6 */}
          <section>
            <h2 className="mb-5 font-display text-[24px] font-medium leading-[1.2] tracking-display text-text">
              6. Data Processing Agreement
            </h2>
            <p>
              Enterprise customers who require a Data Processing Agreement (DPA) for GDPR or contractual
              compliance can request one by emailing{" "}
              <a href="mailto:founder@blackfyre.tech" className="text-accent underline-offset-4 hover:underline">
                founder@blackfyre.tech
              </a>
              . We will provide a DPA within five business days.
            </p>
          </section>

          {/* Section 7 */}
          <section>
            <h2 className="mb-5 font-display text-[24px] font-medium leading-[1.2] tracking-display text-text">
              7. Third-Party Processors
            </h2>
            <p className="mb-4">
              We engage the following sub-processors. All are bound by data processing agreements and
              appropriate security standards:
            </p>
            <div className="overflow-hidden rounded-[14px] border border-border">
              <table className="w-full text-[14px]">
                <thead className="bg-surface">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-text">Processor</th>
                    <th className="px-4 py-3 text-left font-medium text-text">Purpose</th>
                    <th className="px-4 py-3 text-left font-medium text-text">Location</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {[
                    ["Amazon Web Services (AWS)", "Infrastructure, compute, and encrypted storage", "ap-south-1 (Mumbai)"],
                    ["AWS S3 WORM", "Immutable evidence storage", "ap-south-1 (Mumbai)"],
                  ].map(([proc, purpose, loc]) => (
                    <tr key={proc} className="bg-bg">
                      <td className="px-4 py-3 font-medium text-text">{proc}</td>
                      <td className="px-4 py-3 text-text-muted">{purpose}</td>
                      <td className="px-4 py-3 text-text-muted">{loc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-4 text-[14px] font-medium text-text">
              We do not sell, rent, or trade your personal data to any third party, ever.
            </p>
          </section>

          {/* Section 8 */}
          <section>
            <h2 className="mb-5 font-display text-[24px] font-medium leading-[1.2] tracking-display text-text">
              8. Cookie Policy
            </h2>
            <p className="mb-4">
              We use only strictly necessary cookies required for platform authentication and session
              management. We do not use advertising cookies, third-party tracking pixels, or behavioural
              analytics. Cookies set:
            </p>
            <div className="overflow-hidden rounded-[14px] border border-border">
              <table className="w-full text-[14px]">
                <thead className="bg-surface">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-text">Cookie</th>
                    <th className="px-4 py-3 text-left font-medium text-text">Purpose</th>
                    <th className="px-4 py-3 text-left font-medium text-text">Duration</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {[
                    ["session_id", "Authenticated session token (httpOnly, Secure, SameSite=Strict)", "Session"],
                    ["csrf_token", "Cross-site request forgery prevention", "Session"],
                  ].map(([name, purpose, dur]) => (
                    <tr key={name} className="bg-bg">
                      <td className="px-4 py-3 font-mono text-[12px] text-text-muted">{name}</td>
                      <td className="px-4 py-3 text-text-muted">{purpose}</td>
                      <td className="px-4 py-3 text-text-muted">{dur}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Section 9 */}
          <section>
            <h2 className="mb-5 font-display text-[24px] font-medium leading-[1.2] tracking-display text-text">
              9. Security
            </h2>
            <p>
              We protect your data using AES-256 encryption at rest, TLS 1.3 in transit, row-level security
              for tenant isolation, and immutable audit logs. For a full account of our security practices
              visit our{" "}
              <Link href="/security" className="text-accent underline-offset-4 hover:underline">
                Security Practices
              </Link>{" "}
              page.
            </p>
          </section>

          {/* Section 10 */}
          <section>
            <h2 className="mb-5 font-display text-[24px] font-medium leading-[1.2] tracking-display text-text">
              10. Changes to This Policy
            </h2>
            <p>
              We may update this policy from time to time. Material changes will be notified via email to
              registered account holders at least 14 days before taking effect. The current version is
              always available at this URL.
            </p>
          </section>

          {/* Contact */}
          <section className="halo-card p-6">
            <p className="halo-eyebrow">§ Contact</p>
            <p className="mt-4">
              For any privacy-related question, data subject request, or to report a concern:
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
