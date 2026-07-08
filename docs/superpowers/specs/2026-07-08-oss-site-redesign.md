# Blackfyre OSS Website Redesign — Design Spec

**Date:** 2026-07-08 · **Branch:** `feat/oss-site-redesign` · **Repo:** `blackfyre-security/blackfyre` → `website/`

## Goal

Rewire the marketing site from a closed **commercial-SaaS / security-consultancy**
pitch to an **open-source-first product** site, matching how the repo's own README
frames Blackfyre. Full visual redesign in the existing **Halo "spec-sheet"** theme
(the `/portfolio` page's technical, searchable-catalog flavor). No fabricated facts —
every number/claim traces to the repo.

Success = `next build` passes (static export), the site drives in a browser with
OSS-first positioning, real numbers, and the agency funnel pulled from nav/footer;
code-review + security-review gates pass; **stop before deploy/push.**

## Positioning (from README, code-true)

> **Blackfyre — open-source multi-cloud compliance & security platform.** Apache-2.0.
> Scan AWS, Azure & GCP (and on-prem) against **678 controls** across **9 frameworks**
> with **55 auditors** (SDK-based + Prowler + IaC: Checkov/Semgrep/Bandit), AI-assisted
> analysis (graceful heuristic fallback), a tamper-evident SHA-256 evidence vault, and
> Postgres-RLS multi-tenancy. **Self-host free**, or use the **hosted option**
> (blackfyre.tech).

- Primary CTA everywhere: **Star / Quickstart on GitHub** (`SITE.repoUrl`).
- Secondary CTA: **Hosted option** → `SITE.hostedUrl`.
- Kills the fabricated **"34 autonomous agents"** line (present in `lib/halo-data.ts`
  STATS and `data/content.ts` stats).
- **Honesty flags surfaced on-site copy where relevant:** control count is **678** per
  `platform/packages/api/src/compliance/control-registry.ts` (README says 683 — mismatch
  to reconcile upstream, not on the site). Production backend is documented **not yet
  deployed** — the site must not imply a running managed cloud beyond "hosted option".

## Design system (reuse, do not reinvent)

Halo tokens (already in `globals.css` / `tailwind.config.ts`):
- **Palette:** bg `#0a0a0b`, surfaces `#121214`/`#18181b`, text `#ececee`, muted
  `#8a8a92`, hairline borders (white 8%/14%), **accent lime `#c6f24e`**, violet-2
  `#7c3aed`, warn `#f59e0b`, crit `#f43f5e`. Light mode + `[data-accent]` variants exist.
- **Type:** Space Grotesk (`font-display`/`font-sans`) + JetBrains Mono (`font-mono`),
  self-hosted via `next/font/local` in `layout.tsx`. Tight heading tracking.
- **Utility classes:** `halo-card`, `halo-card-strong`, `halo-card-hover`, `halo-eyebrow`,
  `halo-label`, `halo-btn-accent`, `halo-btn-ghost`, `halo-live-dot`, `halo-hairline`,
  `halo-section-rule`, `halo-italic`, `halo-arrow`/`halo-arrow-parent`, `halo-hero-glow`,
  `shadow-halo-lift/glow`, `bg-halo-radial`, `animate-halo-*`.
- **Signatures to carry through:** `§ NN · LABEL` mono eyebrows, mono micro-labels,
  hover-lift cards, accent `✓` checklists, clickable mono tag-chips, **searchable/filterable
  catalog grid** (the portfolio pattern), radial accent-glow hero, `HaloReveal` scroll motion.

### Reusable components (props — do NOT edit; render with props)
`HaloNav` (none) · `HaloFooter` (none) · `HaloReveal {children, delay?}` ·
`HaloSectionHead {eyebrow, title, titleAccent?}` ·
`HaloCTA {title, titleAccent?, sub?, primaryLabel, primaryHref, secondaryLabel?, secondaryHref?}` ·
`HaloFrameworkGrid {frameworks?, eyebrow?, ...}` · `HaloComplianceTemplate {framework}` ·
`HaloSparkline`, `HaloStatusDot`, `AgentConstellation {labels}`, `ThemeToggle`.

### Shared data (already generated — import, don't duplicate)
- `@/data/auditors.ts` — `AUDITORS` (55), `AUDITOR_CLOUDS`, `AUDITOR_CATEGORIES`,
  `SCANNER_TYPES`, `AUDITOR_COUNT`.
- `@/data/frameworks.ts` — `FRAMEWORKS` (9, with `controls` + `slug?`), `TOTAL_CONTROLS`
  (678), `FRAMEWORK_COUNT`.
- `@/data/site.ts` — `SITE` (repoUrl/hostedUrl/license/tagline), `QUICKSTART`, `DOCS`
  (22 doc links), `SOCIALS` (GitHub-first).

## Information architecture

**Redesigned (OSS product):** `/` home · `/platform` product tour · `/agents`
auditor catalog (searchable) · `/pricing` self-host vs hosted · `/security` posture ·
`/soc2-compliance` `/hipaa-compliance` `/iso-42001` `/nist-800-53` (via
`HaloComplianceTemplate`, reframed honest).

**New (OSS-native):** `/self-host` (local/eval vs AWS-SST, costs) · `/docs` (hub linking
`DOCS`) · `/contribute` (CONTRIBUTING/GOVERNANCE/ROADMAP/CoC, DCO, PR flow).

**Kept, light touch:** `/blog`, `/privacy`, `/terms`, `/contact` (reframe: hosted &
security contact).

**De-emphasized (leave pages, remove from nav + footer):** `/portfolio` `/services`
`/mobile` `/webapp` `/cohort` `/bootcamp`. (Already archived to `~/blackfyre-archive/`.)

**Nav:** Platform · Auditors (`/agents`) · Frameworks (`/#frameworks` or `/platform`) ·
Docs · Self-host · Pricing · Contribute · Blog · **GitHub** (icon/count button) ·
**Hosted option** (accent button).

**Footer columns:** Product (Platform, Auditors, Frameworks, Security, Pricing) ·
Resources (Docs, Self-host, Roadmap, Changelog) · Community (GitHub, Contribute,
Governance, Code of Conduct, Security policy) · Legal (License Apache-2.0, Privacy,
Terms, Trademark). Socials GitHub-first. Trademark line: name/logo are trademarks;
forks must rename.

## Build units (file-disjoint; one owner each — no two agents touch the same file)

1. **chrome** — `components/halo/HaloNav.tsx`, `HaloFooter.tsx`.
2. **home** — `app/page.tsx`, `components/halo/HaloHero.tsx`, `HaloCustomers.tsx`,
   `HaloPlatformPreview.tsx`, `HaloHowItWorks.tsx`, `HaloFaq.tsx`, `lib/halo-data.ts`,
   `data/content.ts`, + new `components/halo/QuickstartInstall.tsx`,
   `components/halo/SelfHostBand.tsx`. Pass real props to `HaloFrameworkGrid`.
3. **auditors** — `app/agents/page.tsx` (searchable auditor catalog, portfolio pattern).
4. **platform** — `app/platform/page.tsx` (product tour: features/architecture/auth).
5. **pricing** — `app/pricing/page.tsx` (Self-host free vs Hosted).
6. **security** — `app/security/page.tsx` (RLS, evidence vault, auth, SECURITY.md).
7. **compliance** — `components/halo/HaloComplianceTemplate.tsx` + `app/soc2-compliance`,
   `app/hipaa-compliance`, `app/iso-42001`, `app/nist-800-53` pages.
8. **selfhost** — `app/self-host/page.tsx` (NEW).
9. **docs** — `app/docs/page.tsx` (NEW; renders `DOCS`).
10. **contribute** — `app/contribute/page.tsx` (NEW).
11. **misc** — `app/contact/page.tsx`, `app/not-found.tsx`, `app/layout.tsx` (metadata
    only), `public/sitemap.xml` (+ new routes), `public/robots.txt`.

**Rules for builders:** reuse Halo classes/components + shared data; no new deps; keep
`next/font` + `output:"export"` intact; do NOT run `next build`/npm scripts (orchestrator
verifies once); do NOT edit `globals.css`/`tailwind.config.ts`/data files; no invented
facts — pull from the shared data + provided facts only; `HaloNav`/`HaloFooter`/`HaloCTA`
are rendered with props, never edited outside their owner.

## Verify

`npm run build` green → serve `out/` → screenshot `/`, `/agents`, `/pricing`,
`/self-host`, `/contribute`, `/platform` → fix loop. Then code-review + security-review
gates. **STOP before push/deploy** (§1.4).
