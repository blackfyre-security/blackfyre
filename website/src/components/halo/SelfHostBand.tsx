import Link from "next/link";
import { Check } from "lucide-react";
import { SITE } from "@/data/site";
import HaloSectionHead from "@/components/halo/HaloSectionHead";

const SELF_HOST: readonly string[] = [
  "Apache-2.0 — every feature, no license fee, forever",
  "Local evaluation via Docker Compose (Postgres / Redis / LocalStack)",
  "Production on your own AWS via SST (Lambda / RDS / SQS / S3 / KMS)",
  "Read-only cross-account access — your data never leaves your account",
];

const HOSTED: readonly string[] = [
  "Managed cloud — we run the infrastructure, you use the platform",
  "Same open-source codebase, no fork required",
  "Production isn't live yet — join for early access",
];

/**
 * Two-column deploy contrast: self-host (free, your infra, all features) vs a
 * planned managed cloud. Framed honestly — no hosted SLAs, since production is
 * documented as not yet deployed. Pure SSR.
 */
export default function SelfHostBand() {
  return (
    <section className="border-b border-border px-6 py-24 sm:px-12">
      <div className="mx-auto max-w-[1280px]">
        <HaloSectionHead
          align="left"
          className="mx-0 max-w-[760px]"
          eyebrow="§ 04 · SELF-HOST"
          title="Run it your way — free forever."
          titleAccent="free forever"
          blurb="Apache-2.0 means self-hosting is free, forever, with every feature. Evaluate locally with Docker Compose, or run production on your own AWS account."
        />

        <div className="mt-12 grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Self-host card */}
          <div className="halo-card-strong flex flex-col p-8">
            <div className="flex items-center gap-2.5">
              <span className="halo-live-dot" />
              <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-accent">
                Recommended
              </span>
            </div>
            <h3 className="mt-4 font-display text-[26px] font-medium leading-[1.1] tracking-display text-text">
              Self-host
            </h3>
            <p className="mt-2 font-sans text-[14.5px] leading-[1.55] text-text-muted">
              Your infrastructure, your data, all features — for the cost of
              running it.
            </p>

            <ul className="mt-6 grid gap-3">
              {SELF_HOST.map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <span className="mt-0.5 text-accent" aria-hidden="true">
                    <Check size={16} strokeWidth={1.8} />
                  </span>
                  <span className="font-sans text-[14px] leading-[1.5] text-text">
                    {item}
                  </span>
                </li>
              ))}
            </ul>

            <p className="mt-6 font-mono text-[11px] leading-[1.6] text-text-dim">
              Rough idle cost on your AWS: ~$56/mo staging · ~$80/mo prod
              (multi-AZ RDS). Static frontends on Cloudflare Pages.
            </p>

            <div className="mt-7 flex flex-wrap gap-3 pt-1">
              <a
                href={SITE.repoUrl}
                target="_blank"
                rel="noreferrer"
                className="halo-btn-accent halo-arrow-parent"
              >
                View source{" "}
                <span className="halo-arrow" aria-hidden="true">
                  &rarr;
                </span>
              </a>
              <Link href="/self-host" className="halo-btn-ghost">
                Self-hosting guide
              </Link>
            </div>
          </div>

          {/* Hosted card */}
          <div className="halo-card flex flex-col p-8">
            <div className="flex items-center gap-2.5">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-border-strong" />
              <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted">
                Early access
              </span>
            </div>
            <h3 className="mt-4 font-display text-[26px] font-medium leading-[1.1] tracking-display text-text">
              Hosted option
            </h3>
            <p className="mt-2 font-sans text-[14.5px] leading-[1.55] text-text-muted">
              A managed cloud is on the way at blackfyre.tech — if you&apos;d rather
              not run the infrastructure yourself.
            </p>

            <ul className="mt-6 grid gap-3">
              {HOSTED.map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <span
                    className="mt-0.5 text-text-muted"
                    aria-hidden="true"
                  >
                    <Check size={16} strokeWidth={1.8} />
                  </span>
                  <span className="font-sans text-[14px] leading-[1.5] text-text-muted">
                    {item}
                  </span>
                </li>
              ))}
            </ul>

            <div className="mt-auto flex flex-wrap gap-3 pt-8">
              <a
                href={SITE.hostedUrl}
                target="_blank"
                rel="noreferrer"
                className="halo-btn-ghost halo-arrow-parent"
              >
                Get early access{" "}
                <span className="halo-arrow" aria-hidden="true">
                  &rarr;
                </span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
