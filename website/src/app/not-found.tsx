import { Search, Globe } from "lucide-react";

import HaloNav from "@/components/halo/HaloNav";
import HaloFooter from "@/components/halo/HaloFooter";

import Section from "@/components/vibrant/Section";
import SectionHead from "@/components/vibrant/SectionHead";
import { LimeButton, GhostButton, GitHubIcon } from "@/components/vibrant/buttons";

import { SITE } from "@/data/site";

const DESTINATIONS: { label: string; href: string }[] = [
  { label: "Platform", href: "/platform" },
  { label: "Auditors", href: "/agents" },
  { label: "Self-host", href: "/self-host" },
  { label: "Docs", href: "/docs" },
];

export default function NotFound() {
  return (
    <>
      <HaloNav />

      {/* ── 404 · light · blue ──────────────────────────────────────────── */}
      <Section variant="light">
        <div className="mx-auto flex max-w-[760px] flex-col items-center text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 font-mono text-xs font-semibold uppercase tracking-wider text-blue-600">
            <Search className="h-3.5 w-3.5" />
            Error · Route not found
          </span>

          <p className="mt-6 select-none bg-gradient-to-r from-zinc-900 via-blue-600 to-zinc-900 bg-clip-text font-sans text-[clamp(96px,20vw,240px)] font-extrabold leading-none tracking-tight text-transparent">
            404
          </p>

          <h1 className="mt-2 text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">
            This page wandered off.
          </h1>
          <p className="mt-4 max-w-md text-lg leading-relaxed text-zinc-600">
            The URL you followed doesn&apos;t match any route on this site. It may
            have been moved, renamed, or never existed. The docs and the source
            are the fastest way back.
          </p>

          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <LimeButton href="/">Back home</LimeButton>
            <GhostButton href="/docs">Browse docs</GhostButton>
            <GhostButton href={SITE.repoUrl} external icon={<GitHubIcon />}>
              GitHub
            </GhostButton>
          </div>
        </div>
      </Section>

      {/* ── POPULAR DESTINATIONS · dark · lime ──────────────────────────── */}
      <Section variant="dark" orbs={false}>
        <div className="mx-auto flex max-w-[760px] flex-col items-center text-center">
          <SectionHead
            accent="lime"
            on="dark"
            align="center"
            eyebrow="Lost?"
            eyebrowIcon={<Globe className="h-3.5 w-3.5" />}
            title="Find your"
            accentWord="way back."
            sub="A few good places to pick up the trail — or star the project and browse the source directly."
          />
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            {DESTINATIONS.map((d) => (
              <GhostButton key={d.href} href={d.href} on="dark">
                {d.label}
              </GhostButton>
            ))}
            <LimeButton href={SITE.repoUrl} external icon={<GitHubIcon />}>
              Star on GitHub
            </LimeButton>
          </div>
        </div>
      </Section>

      <HaloFooter />
    </>
  );
}
