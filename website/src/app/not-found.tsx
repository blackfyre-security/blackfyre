import Link from "next/link";
import HaloNav from "@/components/halo/HaloNav";
import HaloFooter from "@/components/halo/HaloFooter";
import HaloReveal from "@/components/halo/HaloReveal";
import { SITE } from "@/data/site";

export default function NotFound() {
  return (
    <>
      <HaloNav />
      <HaloReveal
        as="section"
        delay={0}
        className="relative flex min-h-[70vh] items-center overflow-hidden px-6 py-32 sm:px-12"
      >
        <div className="halo-hero-glow" aria-hidden />
        <div className="relative mx-auto max-w-[900px] text-center">
          <div className="halo-label mb-6">ERR 404 · ROUTE NOT FOUND</div>
          <h1 className="font-display font-medium text-[clamp(64px,10vw,140px)] leading-none tracking-tightest">
            <span className="text-text-muted">This page is</span>{" "}
            <span className="halo-italic">missing.</span>
          </h1>
          <p className="mx-auto mt-8 max-w-xl text-lg leading-relaxed text-text-muted">
            The URL you followed doesn&apos;t match any route on this site. It may
            have been moved, renamed, or never existed. The docs and the source are
            the fastest way back.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <Link href="/" className="halo-btn-accent">
              Return home{" "}
              <span className="halo-arrow" aria-hidden="true">
                →
              </span>
            </Link>
            <Link href="/docs" className="halo-btn-ghost">
              Browse docs
            </Link>
            <a
              href={SITE.repoUrl}
              target="_blank"
              rel="noreferrer"
              className="halo-btn-ghost"
            >
              GitHub
            </a>
          </div>
        </div>
      </HaloReveal>
      <HaloFooter />
    </>
  );
}
