import type { Metadata } from "next";
import HaloNav from "@/components/halo/HaloNav";
import HaloHero from "@/components/halo/HaloHero";
import QuickstartInstall from "@/components/halo/QuickstartInstall";
import HaloPlatformPreview from "@/components/halo/HaloPlatformPreview";
import HaloHowItWorks from "@/components/halo/HaloHowItWorks";
import SelfHostBand from "@/components/halo/SelfHostBand";
import HaloFrameworkGrid from "@/components/halo/HaloFrameworkGrid";
import HaloFaq from "@/components/halo/HaloFaq";
import HaloCTA from "@/components/halo/HaloCTA";
import HaloFooter from "@/components/halo/HaloFooter";
import HaloReveal from "@/components/halo/HaloReveal";
import { FRAMEWORKS } from "@/data/frameworks";
import { SITE } from "@/data/site";

export const metadata: Metadata = {
  title: "Blackfyre — Open-source multi-cloud compliance platform",
  description:
    "Open-source, self-hostable compliance & security platform: 55 auditors across AWS, Azure, GCP + on-prem map findings to 9 frameworks and 678 controls. Apache-2.0.",
};

export default function Home() {
  return (
    <>
      <HaloNav />
      <HaloHero />

      <HaloReveal delay={0}>
        <QuickstartInstall />
      </HaloReveal>

      <HaloReveal delay={120}>
        <HaloPlatformPreview />
      </HaloReveal>

      <HaloReveal delay={240}>
        <HaloHowItWorks />
      </HaloReveal>

      <HaloReveal delay={0}>
        <SelfHostBand />
      </HaloReveal>

      <HaloReveal
        as="section"
        delay={120}
        className="halo-section-rule border-b border-border px-6 py-24 sm:px-12"
      >
        <div className="mx-auto grid max-w-[1280px] grid-cols-1 gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:gap-[72px]">
          <HaloFrameworkGrid
            frameworks={FRAMEWORKS.map((f) => f.short)}
            eyebrow="§ 05 · FRAMEWORKS"
            heading="Every finding maps to a control."
          />
          <HaloFaq />
        </div>
      </HaloReveal>

      <HaloCTA
        title="Prove your posture. Own your stack."
        titleAccent="Own your stack"
        sub="Blackfyre is Apache-2.0 and self-hostable. Star it, clone it, run it on your own infrastructure — free, forever."
        eyebrow="§ Open source"
        primaryLabel="Star on GitHub"
        primaryHref={SITE.repoUrl}
        secondaryLabel="Read the docs"
        secondaryHref="/docs"
      />

      <HaloFooter />
    </>
  );
}
