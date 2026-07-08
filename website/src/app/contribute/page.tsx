import type { Metadata } from "next";
import HaloNav from "@/components/halo/HaloNav";
import HaloFooter from "@/components/halo/HaloFooter";
import HaloSectionHead from "@/components/halo/HaloSectionHead";
import HaloCTA from "@/components/halo/HaloCTA";
import HaloReveal from "@/components/halo/HaloReveal";
import { SITE, DOCS } from "@/data/site";

export const metadata: Metadata = {
  title: "Contribute — Blackfyre",
  description:
    "Help build the open compliance platform. The fork-and-PR flow, mandatory DCO sign-off, Conventional Commits, the pre-PR build + test gate, governance, and where to start.",
};

// Resolve a docs URL by a title fragment so links stay bound to the single
// source of truth in @/data/site. Falls back to the repo root.
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

const GOOD_FIRST_ISSUES_URL = `${SITE.repoUrl}/labels/good%20first%20issue`;
const ISSUES_URL = `${SITE.repoUrl}/issues`;
const NEW_ISSUE_URL = `${SITE.repoUrl}/issues/new`;

// ── § 02 · How to contribute (from CONTRIBUTING.md) ─────────────────────────
interface Step {
  n: string;
  label: string;
  title: string;
  desc: string;
  code?: string;
  note?: string;
}

const STEPS: readonly Step[] = [
  {
    n: "01",
    label: "FORK",
    title: "Fork & clone",
    desc: "Fork the repository on GitHub, then clone your fork locally. You'll open pull requests from your fork — nobody pushes directly to the main repo.",
    code: "git clone https://github.com/<you>/blackfyre.git",
  },
  {
    n: "02",
    label: "BRANCH",
    title: "Branch off main",
    desc: "Create a topic branch off main for your change. Never commit to main directly — every change lands via PR.",
    code: "git checkout -b feat/short-description",
  },
  {
    n: "03",
    label: "COMMITS",
    title: "Conventional Commits",
    desc: "Write commit messages in Conventional Commits style: a type prefix (feat, fix, docs, ci, chore, refactor, test) plus an optional package scope and an imperative summary.",
    code: "feat(api): add findings filter by framework",
  },
  {
    n: "04",
    label: "DCO — MANDATORY",
    title: "Sign off every commit",
    desc: "Every commit must be signed off. The -s flag appends a Signed-off-by trailer certifying — under the Developer Certificate of Origin — that you wrote the change (or have the right to submit it) and are licensing it under Apache-2.0. Unsigned commits fail the DCO check and cannot be merged.",
    code: 'git commit -s -m "feat: add scan result pagination"',
    note: "Forgot to sign off? Amend and force-push: git commit --amend -s && git push --force-with-lease",
  },
  {
    n: "05",
    label: "GATE",
    title: "Build + unit tests",
    desc: "Run the pre-PR gate locally before you push — the same checks CI runs on every PR. Both must pass or merge is blocked.",
    code: "cd platform\nnpm run build\nnpm run test:unit --workspace=packages/api",
  },
  {
    n: "06",
    label: "PR",
    title: "Open a pull request",
    desc: "Push your branch and open a PR against main. Link the issue you discussed, keep it small and focused, and split unrelated changes apart. Draft PRs are welcome for early feedback on direction.",
  },
  {
    n: "07",
    label: "CI",
    title: "CI + review, then merge",
    desc: "CI installs, builds, runs the unit suite, and verifies the DCO sign-off on every commit. Once the checks are green and a maintainer approves, your change is merged.",
  },
];

// CI checks (from CONTRIBUTING.md "What CI checks on every PR")
const CI_CHECKS: readonly { cmd: string; what: string }[] = [
  { cmd: "npm ci", what: "Dependency install" },
  { cmd: "npm run build", what: "Build all packages" },
  { cmd: "npm run test:unit --workspace=packages/api", what: "Offline, fully-mocked unit suite" },
  { cmd: "DCO", what: "Sign-off on every commit" },
];

// ── § 03 · Ways to help (from ROADMAP.md) ───────────────────────────────────
interface Way {
  label: string;
  title: string;
  desc: string;
  tags: readonly string[];
  href: string;
  linkLabel: string;
}

const WAYS: readonly Way[] = [
  {
    label: "SCANNERS",
    title: "New auditors & scanners",
    desc: "Deepen AWS/Azure/GCP coverage — more services per cloud, more checks per service — or help give the Prowler and IaC container scanners a local story. Every agent normalizes through one findings path, the seed of a future scanner plugin API.",
    tags: ["auditors", "Prowler / IaC", "plugin API"],
    href: SCANNER_ADR_URL,
    linkLabel: "Read ADR-0003",
  },
  {
    label: "FRAMEWORKS",
    title: "Framework control mappings",
    desc: "New compliance frameworks land as data — control catalogs and mappings in packages/shared, not code. That makes them well-scoped and a great first contribution beyond the shipped nine.",
    tags: ["frameworks-as-data", "good first issue"],
    href: ROADMAP_URL,
    linkLabel: "See the roadmap",
  },
  {
    label: "DOCS",
    title: "Documentation",
    desc: "Keep the 15-minute local setup honest on a fresh clone, sharpen the developer docs, or improve an ADR. Documentation PRs are first-class here.",
    tags: ["docs", "local-dev"],
    href: LOCAL_DEV_URL,
    linkLabel: "Local development",
  },
  {
    label: "BUGS",
    title: "Bug reports",
    desc: "Hit something broken? Open an issue with a clear description, impact, and steps to reproduce. Reproducible reports are among the most valuable contributions.",
    tags: ["issues", "repro steps"],
    href: NEW_ISSUE_URL,
    linkLabel: "Open an issue",
  },
  {
    label: "TRIAGE",
    title: "Triage & review",
    desc: "Help reproduce reported bugs, label incoming issues, and review open pull requests. Sustained, quality help here is the path from contributor to committer.",
    tags: ["triage", "review"],
    href: ISSUES_URL,
    linkLabel: "Browse issues",
  },
];

// ── § 06 · Resources (from @/data/site DOCS) ────────────────────────────────
const RESOURCE_TITLES: readonly string[] = [
  "Contributing",
  "Governance",
  "Roadmap",
  "Code of Conduct",
  "Security Policy",
];

const RESOURCES = RESOURCE_TITLES.map(
  (needle) => DOCS.find((d) => d.title.toLowerCase().includes(needle.toLowerCase()))!,
).filter(Boolean);

function Check() {
  return (
    <span aria-hidden="true" className="mt-0.5 shrink-0 font-mono text-[13px] text-accent">
      ✓
    </span>
  );
}

export default function ContributePage() {
  return (
    <>
      <HaloNav />

      {/* ── Hero ────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-border bg-surface">
        <div className="halo-hero-glow" aria-hidden="true" />
        <div className="relative mx-auto max-w-[1280px] px-6 py-24 sm:px-12 sm:py-28">
          <p className="halo-eyebrow">
            <span className="halo-live-dot" aria-hidden="true" />
            § 01 · Contribute
          </p>
          <h1 className="mt-5 max-w-[880px] font-display font-medium leading-[1.05] tracking-tightest text-text text-[clamp(44px,5.6vw,68px)] [text-wrap:balance]">
            Build the{" "}
            <span className="text-accent italic font-normal">open</span> compliance
            platform.
          </h1>
          <p className="mt-6 max-w-[660px] font-sans text-[17px] leading-[1.55] text-text-muted">
            Blackfyre is Apache-2.0 and built in the open via the standard
            fork-and-PR flow. Whether you&apos;re adding a cloud auditor, mapping a new
            framework as data, fixing a bug, or sharpening the docs — here&apos;s exactly
            how a change gets from your fork to merged.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a
              href={GOOD_FIRST_ISSUES_URL}
              target="_blank"
              rel="noreferrer"
              className="halo-btn-accent"
            >
              Good first issues{" "}
              <span className="halo-arrow" aria-hidden="true">
                &rarr;
              </span>
            </a>
            <a
              href={CONTRIBUTING_URL}
              target="_blank"
              rel="noreferrer"
              className="halo-btn-ghost"
            >
              Read CONTRIBUTING
            </a>
          </div>
          <div className="mt-9 flex flex-wrap gap-1.5">
            {["Apache-2.0", "Fork & PR", "DCO sign-off", "Conventional Commits", "BDFL → committer"].map(
              (chip) => (
                <span
                  key={chip}
                  className="rounded-md border border-border bg-surface-alt px-2.5 py-1 font-mono text-[10.5px] uppercase tracking-[0.1em] text-text-muted"
                >
                  {chip}
                </span>
              ),
            )}
          </div>
        </div>
      </section>

      {/* ── § 02 · How to contribute ────────────────────────────── */}
      <HaloReveal as="section" delay={0} className="border-b border-border px-6 py-24 sm:px-12">
        <HaloSectionHead
          eyebrow="§ 02 · The flow"
          title="From fork to merged, step by step."
          titleAccent="merged"
          blurb="The whole path is the standard fork-and-PR flow with two hard requirements: a DCO sign-off on every commit and a green pre-PR build + unit-test gate."
        />
        <div className="mx-auto mt-12 max-w-[1000px] flex flex-col gap-4">
          {STEPS.map((s) => (
            <article
              key={s.n}
              className="halo-card halo-card-hover grid grid-cols-1 gap-5 p-6 sm:grid-cols-[auto_1fr] sm:p-7"
            >
              <div className="flex shrink-0 items-start gap-3 sm:flex-col sm:items-start">
                <span className="font-mono text-[28px] font-medium leading-none tracking-[-0.02em] text-accent">
                  {s.n}
                </span>
                <span className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-text-dim sm:mt-3">
                  {s.label}
                </span>
              </div>
              <div className="min-w-0">
                <h3 className="font-sans text-[19px] font-medium tracking-[-0.02em] text-text">
                  {s.title}
                </h3>
                <p className="mt-2 font-sans text-[14px] leading-[1.6] text-text-muted">
                  {s.desc}
                </p>
                {s.code && (
                  <pre className="mt-4 overflow-x-auto rounded-lg border border-border bg-bg px-4 py-3">
                    <code className="font-mono text-[12.5px] leading-[1.7] text-text">
                      {s.code}
                    </code>
                  </pre>
                )}
                {s.note && (
                  <p className="mt-3 font-mono text-[11.5px] leading-[1.5] text-text-dim">
                    {s.note}
                  </p>
                )}
              </div>
            </article>
          ))}
        </div>

        {/* CI checks callout */}
        <div className="mx-auto mt-8 max-w-[1000px]">
          <div className="halo-card p-7">
            <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-accent">
              What CI checks on every PR
            </div>
            <div className="mt-4 grid grid-cols-1 gap-x-8 gap-y-2.5 sm:grid-cols-2">
              {CI_CHECKS.map((c) => (
                <div
                  key={c.cmd}
                  className="flex items-baseline justify-between gap-4 border-b border-border py-2 last:border-b-0 sm:last:border-b"
                >
                  <code className="shrink-0 font-mono text-[12px] text-text">{c.cmd}</code>
                  <span className="text-right font-sans text-[12.5px] leading-[1.4] text-text-muted">
                    {c.what}
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-4 font-sans text-[12.5px] leading-[1.5] text-text-dim">
              A PR must be green before it can be merged. Before you push anything,
              open an issue first for changes beyond a small fix — it avoids duplicate
              work on things that don&apos;t fit the roadmap.
            </p>
          </div>
        </div>
      </HaloReveal>

      {/* ── § 03 · Ways to help ─────────────────────────────────── */}
      <HaloReveal as="section" delay={0} className="border-b border-border px-6 py-24 sm:px-12">
        <HaloSectionHead
          eyebrow="§ 03 · Ways to help"
          title="Pick something that fits your energy."
          titleAccent="fits"
          blurb="Straight from the roadmap. New frameworks and docs are the most well-scoped first contributions; scanners and triage are the deep end."
        />
        <div className="mx-auto mt-12 grid max-w-[1160px] grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {WAYS.map((w) => (
            <article key={w.title} className="halo-card halo-card-hover flex flex-col p-6">
              <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-accent">
                {w.label}
              </div>
              <h3 className="mt-3 font-sans text-[17px] font-medium tracking-[-0.02em] text-text">
                {w.title}
              </h3>
              <p className="mt-2.5 flex-1 font-sans text-[13.5px] leading-[1.55] text-text-muted">
                {w.desc}
              </p>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {w.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-md border border-border bg-surface-alt px-2 py-0.5 font-mono text-[10.5px] text-text-muted"
                  >
                    {tag}
                  </span>
                ))}
              </div>
              <a
                href={w.href}
                target="_blank"
                rel="noreferrer"
                className="halo-arrow-parent mt-5 inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-[0.06em] text-accent"
              >
                {w.linkLabel}{" "}
                <span className="halo-arrow" aria-hidden="true">
                  &rarr;
                </span>
              </a>
            </article>
          ))}
        </div>
      </HaloReveal>

      {/* ── § 04 · Governance ───────────────────────────────────── */}
      <HaloReveal as="section" delay={0} className="border-b border-border px-6 py-24 sm:px-12">
        <HaloSectionHead
          eyebrow="§ 04 · Governance"
          title="A BDFL model, with a real path to committer."
          titleAccent="committer"
          blurb="This is the honest state of a young project, not the end state — and the door from contributor to committer is open."
        />
        <div className="mx-auto mt-12 grid max-w-[1080px] grid-cols-1 gap-4 sm:grid-cols-[1.05fr_0.95fr]">
          <div className="halo-card p-7">
            <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-accent">
              How decisions are made
            </div>
            <h3 className="mt-3 font-sans text-[19px] font-medium tracking-[-0.02em] text-text">
              Benevolent-dictator model
            </h3>
            <p className="mt-3 font-sans text-[14px] leading-[1.6] text-text-muted">
              Blackfyre currently uses a BDFL model: the project founder is the
              maintainer and has final say on the roadmap and merges. Everyone submits
              PRs under the DCO, and all merged code is Apache-2.0.
            </p>
            <a
              href={GOVERNANCE_URL}
              target="_blank"
              rel="noreferrer"
              className="halo-arrow-parent mt-5 inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-[0.06em] text-accent"
            >
              Read GOVERNANCE.md{" "}
              <span className="halo-arrow" aria-hidden="true">
                &rarr;
              </span>
            </a>
          </div>

          <div className="halo-card p-7">
            <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-text-dim">
              Contributor → committer
            </div>
            <ul className="mt-4 flex flex-col gap-3">
              {[
                "Submit PRs under the DCO — the standard fork-and-PR flow.",
                "Build a track record of sustained, quality contributions.",
                "Get invited as a committer with merge rights over the areas you work on.",
              ].map((item) => (
                <li key={item} className="flex gap-2.5">
                  <Check />
                  <span className="font-sans text-[14px] leading-[1.5] text-text-muted">
                    {item}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-5 font-sans text-[12.5px] leading-[1.5] text-text-dim">
              Triage and review count. Sustained help maintaining the project is the
              fastest way there.
            </p>
          </div>
        </div>
      </HaloReveal>

      {/* ── § 05 · Community standards ──────────────────────────── */}
      <HaloReveal as="section" delay={0} className="border-b border-border px-6 py-24 sm:px-12">
        <HaloSectionHead
          eyebrow="§ 05 · Community"
          title="One standard, every space."
          titleAccent="every"
          blurb="Blackfyre adopts the Contributor Covenant v2.1. It applies to all project spaces — issues, PRs, discussions, and beyond."
        />
        <div className="mx-auto mt-12 max-w-[1080px]">
          <div className="halo-card p-7">
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-[1fr_auto] sm:items-center">
              <div>
                <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-accent">
                  Code of Conduct
                </div>
                <h3 className="mt-3 font-sans text-[19px] font-medium tracking-[-0.02em] text-text">
                  Contributor Covenant v2.1
                </h3>
                <p className="mt-3 max-w-[620px] font-sans text-[14px] leading-[1.6] text-text-muted">
                  We expect a welcoming, harassment-free experience for everyone. The
                  Code of Conduct covers all project spaces and includes the
                  enforcement contact and escalation ladder. Read it before you engage
                  — it applies to your first issue as much as your hundredth PR.
                </p>
                <a
                  href={COC_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="halo-arrow-parent mt-5 inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-[0.06em] text-accent"
                >
                  Read the Code of Conduct{" "}
                  <span className="halo-arrow" aria-hidden="true">
                    &rarr;
                  </span>
                </a>
              </div>
              <div className="flex flex-wrap gap-1.5 sm:max-w-[180px] sm:justify-end">
                {["Welcoming", "Harassment-free", "All spaces", "v2.1"].map((chip) => (
                  <span
                    key={chip}
                    className="rounded-md border border-border bg-surface-alt px-2.5 py-1 font-mono text-[10.5px] uppercase tracking-[0.1em] text-text-muted"
                  >
                    {chip}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </HaloReveal>

      {/* ── § 06 · Resources ────────────────────────────────────── */}
      <HaloReveal as="section" delay={0} className="border-b border-border px-6 py-24 sm:px-12">
        <HaloSectionHead
          eyebrow="§ 06 · Resources"
          title="Everything, in the repo."
          titleAccent="repo"
          blurb="The canonical docs behind this page. Each links straight to the source of truth on GitHub."
        />
        <div className="mx-auto mt-12 grid max-w-[1160px] grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {RESOURCES.map((r) => (
            <a
              key={r.title}
              href={r.url}
              target="_blank"
              rel="noreferrer"
              className="halo-card halo-card-hover halo-arrow-parent flex flex-col p-6"
            >
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-sans text-[16px] font-medium tracking-[-0.02em] text-text">
                  {r.title}
                </h3>
                <span className="halo-arrow shrink-0 font-mono text-accent" aria-hidden="true">
                  &rarr;
                </span>
              </div>
              {r.blurb && (
                <p className="mt-2.5 flex-1 font-sans text-[13px] leading-[1.55] text-text-muted">
                  {r.blurb}
                </p>
              )}
            </a>
          ))}
        </div>
      </HaloReveal>

      <HaloCTA
        title="Start with a good first issue."
        titleAccent="good first issue"
        sub="Grab a well-scoped issue, sign off your commits, and open a PR. Apache-2.0 — self-host it free, and shape where it goes."
        eyebrow="§ Start"
        primaryLabel="Star on GitHub"
        primaryHref={SITE.repoUrl}
        secondaryLabel="Good first issues"
        secondaryHref={GOOD_FIRST_ISSUES_URL}
      />

      <HaloFooter />
    </>
  );
}
