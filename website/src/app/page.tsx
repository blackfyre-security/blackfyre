import type { Metadata } from "next";
import HaloNav from "@/components/halo/HaloNav";
import HaloHero from "@/components/halo/HaloHero";
import HaloCustomers from "@/components/halo/HaloCustomers";
import HaloPlatformPreview from "@/components/halo/HaloPlatformPreview";
import HaloHowItWorks from "@/components/halo/HaloHowItWorks";
import HaloFrameworkGrid from "@/components/halo/HaloFrameworkGrid";
import HaloFaq from "@/components/halo/HaloFaq";
import HaloCTA from "@/components/halo/HaloCTA";
import HaloFooter from "@/components/halo/HaloFooter";
import HaloReveal from "@/components/halo/HaloReveal";

export const metadata: Metadata = {
  title: "BLACKFYRE — Security posture, continuously mapped.",
  description:
    "Thirty-four autonomous agents scan your infrastructure every minute, map findings to nine frameworks, and hand your team an auditable trail.",
};

export default function Home() {
  return (
    <>
      <HaloNav />
      <HaloHero />
      <HaloReveal delay={0}>
        <HaloCustomers />
      </HaloReveal>
      <HaloReveal delay={120}>
        <HaloPlatformPreview />
      </HaloReveal>
      <HaloReveal delay={240}>
        <HaloHowItWorks />
      </HaloReveal>

      <HaloReveal as="section" delay={360} className="halo-section-rule border-b border-border px-6 py-24 sm:px-12">
        <div className="mx-auto grid max-w-[1280px] grid-cols-1 gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:gap-[72px]">
          <HaloFrameworkGrid />
          <HaloFaq />
        </div>
      </HaloReveal>

      <HaloCTA
        title="Ship with posture on."
        titleAccent="posture"
        sub="Connect your first cloud. Your first agent report lands in ten minutes."
        primaryLabel="Talk to us"
        primaryHref="/contact"
        secondaryLabel="Talk to founding team"
        secondaryHref="/contact"
      />

      <HaloFooter />
    </>
  );
}
