import type { Metadata } from "next";
import type { ReactNode } from "react";
import {
  GitBranch,
  Sparkles,
  ScanLine,
  FileCheck2,
  BookOpen,
  Users,
  ShieldCheck,
  Workflow,
  CheckCircle2,
  ArrowUpRight,
  Star,
} from "lucide-react";

import HaloNav from "@/components/halo/HaloNav";
import HaloFooter from "@/components/halo/HaloFooter";

import Section from "@/components/vibrant/Section";
import SectionHead from "@/components/vibrant/SectionHead";
import StatRow from "@/components/vibrant/StatRow";
import LogoRow from "@/components/vibrant/LogoRow";
import StepTimeline from "@/components/vibrant/StepTimeline";
import { CaseStudyCardDark } from "@/components/vibrant/Cards";
import { LimeButton, GhostButton, GitHubIcon } from "@/components/vibrant/buttons";

import { SITE, DOCS } from "@/data/site";
import { AUDITOR_COUNT } from "@/data/auditors";
import { FRAMEWORK_COUNT, TOTAL_CONTROLS } from "@/data/frameworks";

export const metadata: Metadata = {
  title: "Contribute — Blackfyre",
  description:
    "Help build the open compliance platform. The fork-and-PR flow, mandatory DCO sign-off, Conventional Commits, the pre-PR build + test gate, governance, and where to start.",
};

/* ── docs URL resolution (bound to the single source of truth in @/data/site) ── */
function docUrl(needle: string): string {
  return (
    DOCS.find((d) => d.title.toLowerCase().includes(needle.toLowerCase()))?.url ??
    SITE.repoUrl
  );
}

const CONTRIBUTING_URL = docUrl("Contributing");
const GOVERNANCE_URL = docUrl("Governance");
const ROADMAP_URL = docUrl("Roadmap");
const COC_URL = docUrl("Code of Conduct");
const LOCAL_DEV_URL = docUrl("Local development");
const SCANNER_ADR_URL = docUrl("Scanner orchestration");
const ISSUES_URL = `${SITE.repoUrl}/issues`;

/* ── § 02 · How to contribute (from CONTRIBUTING.md) ─────────────────────── */
const STEPS = [
  {
    n: "01",
    title: "Fork & clone",
    desc: "Fork the repo on GitHub and clone your fork. Every change lands via a pull request from your fork — nobody pushes directly to main.",
  },
  {
    n: "02",
    title: "Branch off main",
    desc: "Cut a topic branch off main for your change (git checkout -b feat/short-description). Never commit to main directly.",
  },
  {
    n: "03",
    title: "Conventional Commits",
    desc: "Write messages Conventional-Commits style — a type prefix (feat, fix, docs, ci, chore, refactor, test), an optional scope, and an imperative summary.",
  },
  {
    n: "04",
    title: "Sign off — DCO, mandatory",
    desc: "Sign off every commit with git commit -s. The Signed-off-by trailer certifies, under the Developer Certificate of Origin, that you can license the change under Apache-2.0. Unsigned commits fail CI and cannot merge.",
  },
  {
    n: "05",
    title: "Build + unit tests",
    desc: "Run the pre-PR gate locally — npm run build and the offline unit suite (npm run test:unit) — the same checks CI runs. Both must pass or merge is blocked.",
  },
  {
    n: "06",
    title: "Open a pull request",
    desc: "Push your branch and open a PR against main. Link the issue, keep it small and focused, split unrelated changes. Draft PRs are welcome for early feedback.",
  },
  {
    n: "07",
    title: "CI + review, then merge",
    desc: "CI installs, builds, runs the unit suite, and verifies the DCO sign-off on every commit. Green checks plus a maintainer approval, and it merges.",
  },
];

const CI_CHECKS: { cmd: string; what: string }[] = [
  { cmd: "npm ci", what: "Dependency install" },
  { cmd: "npm run build", what: "Build all packages" },
  { cmd: "npm run test:unit", what: "Offline, fully-mocked unit suite" },
  { cmd: "DCO", what: "Sign-off on every commit" },
];

/* ── § 03 · tiny mono illustrations (on #09090e, inside dark cards) ───────── */
const IllRow = ({ k, v, c }: { k: string; v: string; c: string }) => (
  <div className="flex items-center justify-between font-mono text-[9px]">
    <span className="text-zinc-500">{k}</span>
    <span className={c}>{v}</span>
  </div>
);
const ScannerIll = () => (
  <div className="w-full space-y-1.5 px-4">
    <IllRow k="coverage" v="aws · azure · gcp" c="text-blue-400" />
    <IllRow k="sdk auditors" v="in-process" c="text-blue-400" />
    <IllRow k="prowler / iac" v="container lambda" c="text-zinc-400" />
    <IllRow k="normalize" v="→ 1 findings path" c="text-zinc-400" />
  </div>
);
const FrameworkIll = () => (
  <div className="w-full space-y-1.5 px-4">
    <IllRow k="shipped" v={`${FRAMEWORK_COUNT} frameworks`} c="text-purple-400" />
    <IllRow k="controls" v={String(TOTAL_CONTROLS)} c="text-purple-400" />
    <IllRow k="as data" v="packages/shared" c="text-zinc-400" />
    <IllRow k="add yours" v="+ mapping, no code" c="text-zinc-400" />
  </div>
);
const DocsIll = () => (
  <div className="w-full space-y-1.5 px-4">
    <IllRow k="local setup" v="~15 min" c="text-pink-400" />
    <IllRow k="dev docs" v="guides · ADRs" c="text-pink-400" />
    <IllRow k="fresh clone" v="keep it honest" c="text-zinc-400" />
  </div>
);
const TriageIll = () => (
  <div className="w-full space-y-1.5 px-4">
    <IllRow k="reproduce" v="bug reports" c="text-emerald-400" />
    <IllRow k="label" v="incoming issues" c="text-emerald-400" />
    <IllRow k="review" v="open PRs" c="text-zinc-400" />
    <IllRow k="path" v="→ committer" c="text-zinc-400" />
  </div>
);

const WAYS = [
  {
    badge: "SCANNERS",
    icon: ScanLine,
    accent: "blue" as const,
    title: "New auditors & scanners",
    desc: "Deepen AWS/Azure/GCP coverage — more services, more checks — or give the Prowler and IaC container scanners a better local story. Every agent normalizes through one findings path.",
    ill: <ScannerIll />,
    linkLabel: "Read ADR-0003",
    linkHref: SCANNER_ADR_URL,
  },
  {
    badge: "FRAMEWORKS",
    icon: FileCheck2,
    accent: "purple" as const,
    title: "Framework control mappings",
    desc: "New frameworks land as data — control catalogs and mappings in packages/shared, not code. Well-scoped and a great first contribution beyond the shipped nine.",
    ill: <FrameworkIll />,
    linkLabel: "See the roadmap",
    linkHref: ROADMAP_URL,
  },
  {
    badge: "DOCS",
    icon: BookOpen,
    accent: "pink" as const,
    title: "Documentation",
    desc: "Keep the 15-minute local setup honest on a fresh clone, sharpen the developer docs, or improve an ADR. Documentation PRs are first-class here.",
    ill: <DocsIll />,
    linkLabel: "Local development",
    linkHref: LOCAL_DEV_URL,
  },
  {
    badge: "TRIAGE",
    icon: Users,
    accent: "emerald" as const,
    title: "Triage & review",
    desc: "Help reproduce reported bugs, label incoming issues, and review open pull requests. Sustained, quality help here is the path from contributor to committer.",
    ill: <TriageIll />,
    linkLabel: "Browse issues",
    linkHref: ISSUES_URL,
  },
];

/* ── § 04 · Resources (from @/data/site DOCS) ────────────────────────────── */
const RESOURCE_TITLES = ["Contributing", "Governance", "Roadmap", "Code of Conduct", "Security Policy"];
const RESOURCES = RESOURCE_TITLES.map(
  (needle) => DOCS.find((d) => d.title.toLowerCase().includes(needle.toLowerCase()))!,
).filter(Boolean);

/* ── hero terminal card (mono git-flow, dark on the light hero) ──────────── */
const TermLine = ({ children }: { children: ReactNode }) => (
  <div className="flex gap-2">
    <span className="select-none text-zinc-600">$</span>
    <span className="text-zinc-200">{children}</span>
  </div>
);

function GitFlowCard() {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-[#09090e] p-5 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.5)]">
      <div className="flex items-center gap-1.5 border-b border-zinc-800/80 pb-3">
        <span className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
        <span className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
        <span className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
        <span className="ml-2 font-mono text-[10px] text-zinc-500">contributor@fork · blackfyre</span>
      </div>
      <div className="mt-4 space-y-2 overflow-x-auto font-mono text-[12px] leading-relaxed">
        <TermLine>git clone …/blackfyre.git</TermLine>
        <TermLine>git checkout -b feat/new-auditor</TermLine>
        <TermLine>git commit -s -m &quot;feat: add auditor&quot;</TermLine>
        <div className="pl-4 text-[#c6f24e]">Signed-off-by: You &lt;you@dev&gt;</div>
        <TermLine>git push -u origin HEAD</TermLine>
        <div className="pl-4 text-blue-400">→ opened PR · CI running ✓</div>
      </div>
    </div>
  );
}

function Resource({ title, url, blurb }: { title: string; url: string; blurb?: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="group flex flex-col rounded-2xl border border-zinc-200/80 bg-white p-6 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-base font-bold tracking-tight text-zinc-900">{title}</h3>
        <ArrowUpRight className="h-4 w-4 flex-shrink-0 text-zinc-400 transition-colors group-hover:text-emerald-600" />
      </div>
      {blurb && <p className="mt-2.5 flex-1 text-xs leading-relaxed text-zinc-500">{blurb}</p>}
    </a>
  );
}

export default function ContributePage() {
  return (
    <>
      <HaloNav />

      {/* ── HERO · light · purple ───────────────────────────────────────── */}
      <Section variant="light">
        <div className="grid gap-16 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
          <div>
            <SectionHead
              size="hero"
              accent="purple"
              on="light"
              eyebrow="Open source · Apache-2.0"
              eyebrowIcon={<Sparkles className="h-3.5 w-3.5" />}
              title={<>Build the</>}
              accentWord="open compliance platform."
              sub={
                <>
                  Blackfyre is Apache-2.0 and built in the open via the standard
                  fork-and-PR flow — {AUDITOR_COUNT} auditors, {FRAMEWORK_COUNT}{" "}
                  frameworks, {TOTAL_CONTROLS} controls. Add a cloud auditor, map a new
                  framework as data, fix a bug, or sharpen the docs. Here&apos;s exactly
                  how a change gets from your fork to merged.
                </>
              }
            />
            <div className="mt-8 flex flex-wrap gap-3">
              <LimeButton href={ISSUES_URL} external icon={<GitHubIcon />}>
                Good first issues
              </LimeButton>
              <GhostButton href={CONTRIBUTING_URL} external>
                Read CONTRIBUTING
              </GhostButton>
            </div>

            <StatRow
              className="mt-10"
              kicker="Ground rules"
              stats={[
                { value: "Apache-2.0", label: "License" },
                { value: String(FRAMEWORK_COUNT), label: "Frameworks as data" },
                { value: String(TOTAL_CONTROLS), label: "Controls", color: "text-purple-600" },
                { value: "DCO", label: "Sign-off required" },
              ]}
            />

            <div className="mt-8">
              <LogoRow
                label="Contribute via"
                items={["Fork & PR", "DCO sign-off", "Conventional Commits", "GitHub Issues", "CI on every PR"]}
              />
            </div>
          </div>

          <div className="hidden lg:block">
            <GitFlowCard />
          </div>
        </div>
      </Section>

      {/* ── HOW TO CONTRIBUTE · warm · amber ────────────────────────────── */}
      <Section variant="warm">
        <div className="grid gap-16 lg:grid-cols-[0.95fr_1.05fr] lg:items-start">
          <div className="lg:sticky lg:top-12">
            <SectionHead
              accent="amber"
              on="light"
              eyebrow="The flow"
              eyebrowIcon={<GitBranch className="h-3.5 w-3.5" />}
              title="From fork to"
              accentWord="merged."
              accentStyle="solid"
              sub="The whole path is the standard fork-and-PR flow, with two hard requirements: a DCO sign-off on every commit and a green pre-PR build + unit-test gate."
            />
            <div className="mt-10">
              <StepTimeline steps={STEPS} accent="amber" />
            </div>
          </div>

          <div className="space-y-6 lg:mt-4">
            <div className="rounded-2xl border border-zinc-200/80 bg-white p-7">
              <p className="font-mono text-[11px] font-semibold uppercase tracking-wider text-amber-700">
                What CI checks on every PR
              </p>
              <div className="mt-4 divide-y divide-zinc-100">
                {CI_CHECKS.map((c) => (
                  <div key={c.cmd} className="flex items-baseline justify-between gap-4 py-2.5">
                    <code className="flex-shrink-0 font-mono text-[12px] text-zinc-900">{c.cmd}</code>
                    <span className="text-right text-[12.5px] leading-snug text-zinc-500">{c.what}</span>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-[12.5px] leading-relaxed text-zinc-500">
                A PR must be green before it can merge. Open an issue first for anything
                beyond a small fix — it avoids duplicate work on changes that don&apos;t
                fit the roadmap.
              </p>
            </div>

            <div className="rounded-2xl border border-zinc-200/80 bg-white p-7">
              <p className="font-mono text-[11px] font-semibold uppercase tracking-wider text-amber-700">
                The DCO sign-off, every commit
              </p>
              <pre className="mt-4 overflow-x-auto rounded-lg border border-zinc-200 bg-[#09090e] px-4 py-3">
                <code className="font-mono text-[12.5px] leading-relaxed text-zinc-100">
                  git commit -s -m &quot;feat: add scan result pagination&quot;
                </code>
              </pre>
              <p className="mt-3 font-mono text-[11.5px] leading-relaxed text-zinc-500">
                Forgot to sign off? git commit --amend -s &amp;&amp; git push --force-with-lease
              </p>
            </div>
          </div>
        </div>
      </Section>

      {/* ── WAYS TO HELP · dark · blue ──────────────────────────────────── */}
      <Section variant="dark">
        <div className="grid gap-16 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div className="lg:sticky lg:top-12">
            <SectionHead
              accent="blue"
              on="dark"
              eyebrow="Ways to help"
              eyebrowIcon={<Workflow className="h-3.5 w-3.5" />}
              title="Pick something that"
              accentWord="fits your energy."
              sub="Straight from the roadmap. New frameworks and docs are the most well-scoped first contributions; scanners and triage are the deep end."
            />
            <ul className="mt-8 space-y-4">
              {[
                { t: "Frameworks land as data", d: "Control catalogs and mappings in packages/shared — no engine changes." },
                { t: "Docs PRs are first-class", d: "Keeping the ~15-minute local setup honest on a fresh clone counts." },
                { t: "Triage is a real path", d: "Sustained review and labelling is the road from contributor to committer." },
              ].map((r) => (
                <li key={r.t} className="flex gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-400" />
                  <div>
                    <p className="text-sm font-semibold text-white">{r.t}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-zinc-400">{r.d}</p>
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-8">
              <GhostButton href={ISSUES_URL} external on="dark">
                Browse good first issues
              </GhostButton>
            </div>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            {WAYS.map((w) => (
              <CaseStudyCardDark
                key={w.title}
                badge={w.badge}
                icon={w.icon}
                title={w.title}
                desc={w.desc}
                accent={w.accent}
                illustration={w.ill}
                linkLabel={w.linkLabel}
                linkHref={w.linkHref}
              />
            ))}
          </div>
        </div>
      </Section>

      {/* ── GOVERNANCE & STANDARDS · light · emerald ────────────────────── */}
      <Section variant="light">
        <SectionHead
          accent="emerald"
          on="light"
          eyebrow="Governance & standards"
          eyebrowIcon={<ShieldCheck className="h-3.5 w-3.5" />}
          title="A BDFL model, with a real path to"
          accentWord="committer."
          accentStyle="solid"
          sub="The honest state of a young project, not its end state — and the door from contributor to committer is open. Blackfyre adopts the Contributor Covenant v2.1 across every project space."
        />

        <div className="mt-12 grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-2xl border border-zinc-200/80 bg-white p-7">
            <p className="font-mono text-[11px] font-semibold uppercase tracking-wider text-emerald-600">
              How decisions are made
            </p>
            <h3 className="mt-3 text-xl font-bold tracking-tight text-zinc-900">
              Benevolent-dictator model
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-zinc-600">
              Blackfyre currently uses a BDFL model: the project founder is the maintainer
              and has final say on the roadmap and merges. Everyone submits PRs under the
              DCO, and all merged code is Apache-2.0.
            </p>
            <a
              href={GOVERNANCE_URL}
              target="_blank"
              rel="noreferrer"
              className="mt-5 inline-flex items-center gap-1 text-xs font-semibold text-emerald-600"
            >
              Read GOVERNANCE.md
              <ArrowUpRight className="h-3.5 w-3.5" />
            </a>
          </div>

          <div className="rounded-2xl border border-zinc-200/80 bg-white p-7">
            <p className="font-mono text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
              Contributor → committer
            </p>
            <ul className="mt-4 space-y-3">
              {[
                "Submit PRs under the DCO — the standard fork-and-PR flow.",
                "Build a track record of sustained, quality contributions.",
                "Get invited as a committer with merge rights over the areas you work on.",
              ].map((item) => (
                <li key={item} className="flex gap-2.5">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-500" />
                  <span className="text-sm leading-snug text-zinc-600">{item}</span>
                </li>
              ))}
            </ul>
            <p className="mt-5 text-xs leading-relaxed text-zinc-400">
              Triage and review count. Sustained help maintaining the project is the fastest
              way there.
            </p>
          </div>
        </div>

        {/* Code of Conduct */}
        <div className="mt-6 rounded-2xl border border-zinc-200/80 bg-white p-7">
          <div className="grid gap-6 sm:grid-cols-[1fr_auto] sm:items-center">
            <div>
              <p className="font-mono text-[11px] font-semibold uppercase tracking-wider text-emerald-600">
                Code of Conduct
              </p>
              <h3 className="mt-3 text-xl font-bold tracking-tight text-zinc-900">
                Contributor Covenant v2.1
              </h3>
              <p className="mt-3 max-w-[620px] text-sm leading-relaxed text-zinc-600">
                We expect a welcoming, harassment-free experience for everyone. The Code of
                Conduct covers all project spaces and includes the enforcement contact and
                escalation ladder — it applies to your first issue as much as your hundredth PR.
              </p>
              <a
                href={COC_URL}
                target="_blank"
                rel="noreferrer"
                className="mt-5 inline-flex items-center gap-1 text-xs font-semibold text-emerald-600"
              >
                Read the Code of Conduct
                <ArrowUpRight className="h-3.5 w-3.5" />
              </a>
            </div>
            <div className="flex flex-wrap gap-1.5 sm:max-w-[200px] sm:justify-end">
              {["Welcoming", "Harassment-free", "All spaces", "v2.1"].map((chip) => (
                <span
                  key={chip}
                  className="rounded-md border border-zinc-200 bg-zinc-50 px-2.5 py-1 font-mono text-[10.5px] uppercase tracking-[0.08em] text-zinc-500"
                >
                  {chip}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Resources */}
        <div className="mt-12">
          <p className="font-mono text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
            Everything, in the repo · the canonical docs behind this page
          </p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {RESOURCES.map((r) => (
              <Resource key={r.title} title={r.title} url={r.url} blurb={r.blurb} />
            ))}
          </div>
        </div>
      </Section>

      {/* ── GET STARTED · dark · lime ───────────────────────────────────── */}
      <Section variant="dark" orbs={false}>
        <div className="mx-auto flex max-w-[720px] flex-col items-center text-center">
          <SectionHead
            accent="lime"
            on="dark"
            align="center"
            eyebrow="Start"
            eyebrowIcon={<Star className="h-3.5 w-3.5" />}
            title="Start with a"
            accentWord="good first issue."
            sub="Grab a well-scoped issue, sign off your commits, and open a PR. Apache-2.0 — self-host it free, and shape where it goes."
          />
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <LimeButton href={SITE.repoUrl} external icon={<GitHubIcon />}>
              Star on GitHub
            </LimeButton>
            <GhostButton href={ISSUES_URL} external on="dark">
              Good first issues
            </GhostButton>
          </div>
        </div>
      </Section>

      <HaloFooter />
    </>
  );
}
