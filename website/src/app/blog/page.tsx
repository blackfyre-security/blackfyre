import Link from "next/link";
import type { Metadata } from "next";
import HaloNav from "@/components/halo/HaloNav";
import HaloFooter from "@/components/halo/HaloFooter";
import HaloSectionHead from "@/components/halo/HaloSectionHead";
import HaloReveal from "@/components/halo/HaloReveal";

export const metadata: Metadata = {
  title: "Insights & Resources — BLACKFYRE",
  description:
    "Security research, compliance guides, and industry analysis from the BLACKFYRE team. Stay current on DPDPA, AI security, CERT-In, and more.",
};

interface Article {
  slug: string;
  category: string;
  title: string;
  description: string;
  date: string;
  readTime: string;
}

const articles: Article[] = [
  {
    slug: "dpdpa-indian-startups-guide",
    category: "Compliance",
    title: "DPDPA 2023: What Indian Startups Need to Know Before the Deadline",
    description:
      "India's Digital Personal Data Protection Act is now enforceable. Here's a practical breakdown of what it means for your SaaS startup — obligations, penalties, and a 90-day compliance roadmap.",
    date: "March 28, 2026",
    readTime: "5 min read",
  },
  {
    slug: "llm-prompt-injection-defense",
    category: "AI Security",
    title: "Securing Your LLM Pipeline: A Practical Guide to Prompt Injection Defense",
    description:
      "Prompt injection remains the #1 vulnerability in production LLM applications. We break down the attack vectors, show real-world examples, and provide a defense-in-depth strategy that actually works.",
    date: "March 15, 2026",
    readTime: "5 min read",
  },
  {
    slug: "cert-in-6-hour-reporting-automation",
    category: "Threat Intelligence",
    title: "CERT-In's 6-Hour Reporting Rule: Building an Automated Compliance Pipeline",
    description:
      "CERT-In mandates incident reporting within 6 hours. Manual processes won't cut it. Here's how to build an automated detection-to-reporting pipeline that keeps you compliant without a 24/7 SOC team.",
    date: "March 1, 2026",
    readTime: "5 min read",
  },
];

export default function BlogPage() {
  return (
    <>
      <HaloNav />

      <HaloReveal as="section" delay={0} className="border-b border-border px-6 py-20 sm:px-12 sm:py-24">
        <HaloSectionHead
          eyebrow="§ Journal"
          title="Notes from the field."
          titleAccent="field"
          blurb="Security research, compliance guides, and industry analysis from the BLACKFYRE team."
        />
      </HaloReveal>

      <HaloReveal as="section" delay={120} className="px-6 py-20 sm:px-12 sm:py-24">
        <div className="mx-auto max-w-[1120px]">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 lg:gap-8">
            {articles.map((article) => (
              <article
                key={article.slug}
                className="halo-card group flex flex-col p-7 transition-colors hover:border-border-strong"
              >
                <div className="flex items-center justify-between">
                  <p className="halo-label">{article.category}</p>
                  <p className="halo-label">{article.date}</p>
                </div>

                <h2 className="mt-5 font-display text-[22px] font-medium leading-[1.15] tracking-display text-text [text-wrap:balance] group-hover:text-accent">
                  <Link href={`/blog/${article.slug}`}>{article.title}</Link>
                </h2>

                <p className="mt-4 flex-1 text-[14px] leading-relaxed text-text-muted">
                  {article.description}
                </p>

                <div className="mt-6 flex items-center justify-between border-t border-border pt-4">
                  <span className="halo-label">{article.readTime}</span>
                  <Link
                    href={`/blog/${article.slug}`}
                    className="halo-arrow-parent text-[13px] font-medium text-accent transition-colors hover:opacity-80"
                  >
                    Read <span className="halo-arrow" aria-hidden="true">&rarr;</span>
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </div>
      </HaloReveal>

      <HaloFooter />
    </>
  );
}
