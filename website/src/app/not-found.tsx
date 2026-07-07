import Link from "next/link";
import HaloNav from "@/components/halo/HaloNav";
import HaloFooter from "@/components/halo/HaloFooter";
import HaloReveal from "@/components/halo/HaloReveal";

export default function NotFound() {
  return (
    <>
      <HaloNav />
      <HaloReveal as="section" delay={0} className="relative min-h-[70vh] flex items-center px-12 py-32 overflow-hidden">
        <div className="halo-hero-glow" aria-hidden />
        <div className="relative max-w-[900px] mx-auto text-center">
          <div className="halo-label mb-6">ERR 404 · ROUTE NOT FOUND</div>
          <h1 className="font-display font-medium text-[clamp(64px,10vw,140px)] leading-none tracking-tightest">
            <span className="text-text-muted">This page is</span>{" "}
            <span className="halo-italic">missing.</span>
          </h1>
          <p className="mt-8 text-lg text-text-muted max-w-xl mx-auto leading-relaxed">
            The URL you followed doesn&apos;t match any route on our control plane. It may have
            been moved, archived, or never existed.
          </p>
          <div className="mt-10 flex justify-center gap-3">
            <Link href="/" className="halo-btn-accent">
              Return home <span className="halo-arrow" aria-hidden="true">→</span>
            </Link>
            <Link href="/contact" className="halo-btn-ghost">
              Talk to us
            </Link>
          </div>
        </div>
      </HaloReveal>
      <HaloFooter />
    </>
  );
}
