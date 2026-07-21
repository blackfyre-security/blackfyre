import type { Metadata } from "next";
import type { ComponentType, ReactNode } from "react";
import {
  Sparkles,
  Cloud,
  ShieldCheck,
  Lock,
  GitBranch,
  ArrowUpRight,
  FileCheck2,
} from "lucide-react";

import HaloNav from "@/components/halo/HaloNav";
import HaloFooter from "@/components/halo/HaloFooter";
import ContactForm from "@/components/ContactForm";

import Section from "@/components/vibrant/Section";
import SectionHead from "@/components/vibrant/SectionHead";
import StatRow from "@/components/vibrant/StatRow";
import { LimeButton, GhostButton, GitHubIcon } from "@/components/vibrant/buttons";

import { SITE } from "@/data/site";
import { AUDITOR_COUNT } from "@/data/auditors";
import { FRAMEWORK_COUNT, TOTAL_CONTROLS } from "@/data/frameworks";

export const metadata: Metadata = {
  title: "Contact — Blackfyre",
  description:
    "Contact the Blackfyre team for hosted / managed-cloud early access, enterprise SSO and support, or security disclosures. Bug reports and feature requests go to GitHub Issues.",
};

const ISSUES_URL = `${SITE.repoUrl}/issues`;
const SECURITY_URL = `${SITE.repoUrl}/blob/main/SECURITY.md`;

/* ── the three things this channel is for (hero right column) ────────────── */
const REASONS: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  detail: string;
  tile: string;
}[] = [
  {
    icon: Cloud,
    title: "Hosted & managed cloud",
    detail:
      "Early access to a managed Blackfyre — we run the AWS stack so you don't have to. Self-hosting stays free forever under Apache-2.0.",
    tile: "bg-blue-50 text-blue-600",
  },
  {
    icon: ShieldCheck,
    title: "Enterprise SSO & support",
    detail:
      "SAML, SCIM provisioning, auditor-scoped roles, and a support relationship for teams standardizing on Blackfyre.",
    tile: "bg-purple-50 text-purple-600",
  },
  {
    icon: Lock,
    title: "Security disclosures",
    detail:
      "Report a vulnerability privately. See the security policy for scope and the coordinated-disclosure process.",
    tile: "bg-emerald-50 text-emerald-600",
  },
];

/* ── contextual side cards next to the form ──────────────────────────────── */
const LINKS: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  body: ReactNode;
  tile: string;
}[] = [
  {
    icon: GitBranch,
    title: "Bugs & feature requests",
    tile: "bg-amber-50 text-amber-600",
    body: (
      <>
        Found a bug or want a feature? Open an issue on{" "}
        <a
          href={ISSUES_URL}
          target="_blank"
          rel="noreferrer"
          className="font-medium text-amber-700 underline-offset-4 hover:underline"
        >
          GitHub Issues
        </a>{" "}
        so the whole community can follow along — that&apos;s where the work happens
        in the open.
      </>
    ),
  },
  {
    icon: Lock,
    title: "Security disclosures",
    tile: "bg-rose-50 text-rose-600",
    body: (
      <>
        Please report vulnerabilities privately per the{" "}
        <a
          href={SECURITY_URL}
          target="_blank"
          rel="noreferrer"
          className="font-medium text-rose-700 underline-offset-4 hover:underline"
        >
          security policy
        </a>{" "}
        — not through public issues.
      </>
    ),
  },
  {
    icon: ArrowUpRight,
    title: "Direct email",
    tile: "bg-blue-50 text-blue-600",
    body: (
      <>
        Prefer to write first? Reach us at{" "}
        <a
          href="mailto:marketing@blackfyre.tech"
          className="font-medium text-blue-700 underline-offset-4 hover:underline"
        >
          marketing@blackfyre.tech
        </a>
        .
      </>
    ),
  },
];

export default function ContactPage() {
  return (
    <>
      <HaloNav />

      {/* ── HERO · light · blue ─────────────────────────────────────────── */}
      <Section variant="light">
        <div className="grid gap-16 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
          <div>
            <SectionHead
              size="hero"
              accent="blue"
              on="light"
              eyebrow="Contact"
              eyebrowIcon={<Sparkles className="h-3.5 w-3.5" />}
              title={<>Hosted, enterprise</>}
              accentWord="& security."
              sub={
                <>
                  Blackfyre is open source and free to self-host. Use this
                  channel for a managed / hosted deployment, enterprise SSO and
                  support, or to disclose a security issue. For bug reports and
                  feature requests, open a{" "}
                  <a
                    href={ISSUES_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold text-blue-600 underline-offset-4 hover:underline"
                  >
                    GitHub issue
                  </a>{" "}
                  — that&apos;s where the work happens in the open.
                </>
              }
            />
            <div className="mt-8 flex flex-wrap gap-3">
              <LimeButton href={SITE.repoUrl} external icon={<GitHubIcon />}>
                Star on GitHub
              </LimeButton>
              <GhostButton href={ISSUES_URL} external>
                Open a GitHub issue
              </GhostButton>
            </div>

            <StatRow
              className="mt-10"
              kicker="What's in the open"
              stats={[
                { value: String(AUDITOR_COUNT), label: "Auditors" },
                { value: String(FRAMEWORK_COUNT), label: "Frameworks" },
                { value: String(TOTAL_CONTROLS), label: "Controls", color: "text-blue-600" },
                { value: "Free", label: "Apache-2.0" },
              ]}
            />
          </div>

          {/* right column — what this channel is for */}
          <div className="flex flex-col gap-4">
            {REASONS.map((r) => (
              <div
                key={r.title}
                className="flex gap-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm"
              >
                <span
                  className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg ${r.tile}`}
                >
                  <r.icon className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-zinc-900">{r.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-zinc-500">
                    {r.detail}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* ── MESSAGE · warm · amber ──────────────────────────────────────── */}
      <Section variant="warm">
        <SectionHead
          accent="amber"
          on="light"
          eyebrow="Message"
          eyebrowIcon={<Sparkles className="h-3.5 w-3.5" />}
          title="Tell us"
          accentWord="what you need."
          accentStyle="solid"
          sub="Routed to marketing@blackfyre.tech — a human reads every note and sends hosted, enterprise, or security requests to the right person."
        />

        <div className="mt-12 grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:gap-12">
          {/* Form lives in a light card. The site theme defaults to dark, so we
              scope the ContactForm's design tokens (--text/--border/--surface)
              to the light palette here — otherwise its near-white token text
              would be invisible on the white card. */}
          <div
            data-theme="light"
            className="rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm sm:p-10"
          >
            <p className="font-mono text-[11px] font-semibold uppercase tracking-wider text-amber-700">
              Send a note
            </p>
            <h3 className="mt-3 text-2xl font-bold tracking-tight text-zinc-900">
              What are you trying to solve?
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-zinc-600">
              Hosted access, an enterprise rollout, or a partnership — a couple
              of lines is plenty for us to route it well.
            </p>
            <div className="mt-8">
              <ContactForm />
            </div>
          </div>

          {/* contextual side cards */}
          <aside className="flex flex-col gap-4">
            {LINKS.map((l) => (
              <div
                key={l.title}
                className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ${l.tile}`}
                  >
                    <l.icon className="h-4 w-4" />
                  </span>
                  <p className="text-sm font-semibold text-zinc-900">
                    {l.title}
                  </p>
                </div>
                <p className="mt-3 text-[13px] leading-relaxed text-zinc-600">
                  {l.body}
                </p>
              </div>
            ))}
          </aside>
        </div>
      </Section>

      {/* ── GET STARTED · dark · lime ───────────────────────────────────── */}
      <Section variant="dark" orbs={false}>
        <div className="mx-auto flex max-w-[720px] flex-col items-center text-center">
          <SectionHead
            accent="lime"
            on="dark"
            align="center"
            eyebrow="Open source"
            eyebrowIcon={<FileCheck2 className="h-3.5 w-3.5" />}
            title="Rather build in"
            accentWord="the open?"
            sub="Everything Blackfyre does is in the repository — 40+ SDK auditors, 9 frameworks, 678 controls. Star it, fork it, or file an issue."
          />
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <LimeButton href={SITE.repoUrl} external icon={<GitHubIcon />}>
              Star on GitHub
            </LimeButton>
            <GhostButton href="/docs" on="dark">
              Browse the docs
            </GhostButton>
          </div>
        </div>
      </Section>

      <HaloFooter />
    </>
  );
}
