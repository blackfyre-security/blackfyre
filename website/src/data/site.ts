// AUTO-GENERATED site constants from repo metadata (README/docs). Single source of truth.

export const SITE = {
  name: "Blackfyre",
  repoUrl: "https://github.com/blackfyre-security/blackfyre",
  repoSlug: "blackfyre-security/blackfyre",
  hostedUrl: "https://blackfyre.tech",
  // Live hosted demo the "Hosted option" CTAs point at (kept separate from
  // hostedUrl, which is the canonical marketing domain used for SEO metadata).
  demoUrl: "https://demo.blackfyre.tech",
  license: "Apache-2.0",
  tagline: "Open-source multi-cloud compliance & security platform",
} as const;

export const QUICKSTART = "# Full local stack \u2014 no cloud account or API keys needed.\ngit clone https://github.com/blackfyre-security/blackfyre.git\ncd blackfyre/platform\ndocker compose up -d postgres redis localstack\nnpm install && npm run build\ncp packages/api/.env.example packages/api/.env   # edit per the local-dev guide\nnpm run db:migrate && npm run dev                # API on :4000\n\n# Then in two more terminals:\nNEXT_PUBLIC_API_URL=http://localhost:4000 npm run dev --workspace=packages/portal   # :3001\nNEXT_PUBLIC_API_URL=http://localhost:4000 npm run dev --workspace=packages/admin    # :3003\n\n# Log in at http://localhost:3001 \u2014 seeded dev user admin@acme.com / password123";

export interface DocLink { title: string; url: string; blurb?: string; }
export const DOCS: readonly DocLink[] = [
  { title: "Local development", url: "https://github.com/blackfyre-security/blackfyre/blob/main/docs/developer/local-development.md", blurb: "Verified ~15-minute local setup (Docker Compose Postgres/Redis/LocalStack + API/portal/admin via npm), seeded dev logins, worker pollers, reset flow, and real troubleshooting. No cloud account or API keys needed." },
  { title: "Self-hosting Blackfyre", url: "https://github.com/blackfyre-security/blackfyre/blob/main/docs/self-hosting.md", blurb: "The two deployment tiers side by side: local/evaluation via Docker Compose (free) vs production on your AWS account via SST (what gets provisioned, secret setup, deploy + migrate steps, stage semantics, and rough monthly costs)." },
  { title: "Architecture", url: "https://github.com/blackfyre-security/blackfyre/blob/main/docs/ARCHITECTURE.md", blurb: "Single-page deployment topology: three sized-alike stacks (demo/staging/prod), static frontends on Cloudflare Pages, backend on AWS Lambda + RDS + SQS + S3 via SST, why the shape, and the key infra invariants (e.g. frontends stay static exports)." },
  { title: "Monorepo map", url: "https://github.com/blackfyre-security/blackfyre/blob/main/docs/developer/monorepo-map.md", blurb: "Every package explained \u2014 api, portal, admin, shared, ui, cli, plus platform/infra (SST) and the standalone website \u2014 with key files, what each owns, and the strict dependency direction." },
  { title: "Configuration (bring your own credentials)", url: "https://github.com/blackfyre-security/blackfyre/blob/main/docs/developer/configuration.md", blurb: "Every environment variable and the 11 SST secrets: what each is for, whether it's required/optional, safe ways to generate local values, and which features gracefully no-op when a secret is left blank." },
  { title: "API overview", url: "https://github.com/blackfyre-security/blackfyre/blob/main/docs/developer/api-overview.md", blurb: "How packages/api is composed (Fastify app order, DB handles, plugins, routes), the three-layer auth model (JWT/API-key + CSRF + request-scoped RLS binding), where Zod contracts live, and the recipe for adding an endpoint." },
  { title: "Database migrations", url: "https://github.com/blackfyre-security/blackfyre/blob/main/docs/developer/migrations.md", blurb: "How the plain-SQL migrations run (filename-tracked, idempotent), the app.env-guarded dev-only seeds, numbering/ordering rules, RDS managed-Postgres gotchas (no superuser), and the required RLS-in-migration pattern for tenant tables." },
  { title: "Testing", url: "https://github.com/blackfyre-security/blackfyre/blob/main/docs/developer/testing.md", blurb: "The Vitest unit suite CI runs on every PR (offline, fully mocked) vs the integration suite that needs the Docker services (with the DATABASE_URL gotcha), plus the opt-in Playwright browser and staging-smoke suites, and where a new test belongs." },
  { title: "Deployment", url: "https://github.com/blackfyre-security/blackfyre/blob/main/docs/DEPLOYMENT.md", blurb: "How code reaches each environment for a self-hoster: the CI/CD pipeline shape (preferred) and manual laptop deploys (fallback) to your own AWS + Cloudflare accounts." },
  { title: "LLM provider routing", url: "https://github.com/blackfyre-security/blackfyre/blob/main/docs/LLM_PROVIDER.md", blurb: "Where the API talks to a Claude model and how it chooses between the Anthropic direct API and AWS Bedrock, driven by whether ANTHROPIC_API_KEY is set." },
  { title: "Data collection policy", url: "https://github.com/blackfyre-security/blackfyre/blob/main/docs/data-collection-policy.md", blurb: "What each scanner agent collects and, explicitly, what it never touches \u2014 minimum data for posture assessment, no PII, customer records, or business content. Useful for a trust/privacy page." },
  { title: "Roadmap", url: "https://github.com/blackfyre-security/blackfyre/blob/main/ROADMAP.md", blurb: "Near/mid/long-term direction (contributor experience, community releases, scanner coverage, a scanner plugin API, more frameworks as data, non-AWS deployment) and how to propose work via an issue." },
  { title: "ADR-0001: Multi-tenancy via Postgres row-level security", url: "https://github.com/blackfyre-security/blackfyre/blob/main/docs/adr/0001-rls-multi-tenancy.md", blurb: "Why tenant isolation is enforced by the database below the ORM: a non-owner app_user role, FORCE ROW LEVEL SECURITY, and a request-scoped connection binding that fails closed \u2014 plus the two earlier inert attempts it replaced." },
  { title: "ADR-0002: Queue architecture (SQS + DLQs)", url: "https://github.com/blackfyre-security/blackfyre/blob/main/docs/adr/0002-queue-architecture.md", blurb: "Why background work runs on four SQS queues (scan/monitor/AI/evidence), each with a dead-letter queue and SQS-triggered Lambda workers, the no-secrets-on-a-queue rule, and the at-least-once idempotency requirement." },
  { title: "ADR-0003: Scanner orchestration", url: "https://github.com/blackfyre-security/blackfyre/blob/main/docs/adr/0003-scanner-orchestration.md", blurb: "Why lightweight SDK auditors run in-process in the scan worker while heavy OSS tools (Prowler, Checkov/Semgrep/Bandit) run as container-image Lambdas, and how both normalize through one findings ingest path \u2014 the seed of the future scanner plugin API." },
  { title: "ADR-0004: Three-tier model routing for AI features", url: "https://github.com/blackfyre-security/blackfyre/blob/main/docs/adr/0004-model-routing.md", blurb: "The cost-driven tiering of AI work (deterministic heuristics / fast small model / frontier model), the fail-down-never-up rule so features degrade to heuristics without a key, and the provider-agnostic client \u2014 with an honest status note that tier 2 isn't wired yet." },
  { title: "Contributing to Blackfyre", url: "https://github.com/blackfyre-security/blackfyre/blob/main/CONTRIBUTING.md", blurb: "The fork-and-PR flow, mandatory DCO sign-off, Conventional Commits style, the pre-PR build + unit-test gate, and what CI checks \u2014 the source for a /contribute page." },
  { title: "Governance", url: "https://github.com/blackfyre-security/blackfyre/blob/main/GOVERNANCE.md", blurb: "The current BDFL model, how decisions are made, and the path from contributor to committer." },
  { title: "Security Policy", url: "https://github.com/blackfyre-security/blackfyre/blob/main/SECURITY.md", blurb: "Private vulnerability disclosure process, response SLAs, in-scope vs out-of-scope, security practices, and compliance posture." },
  { title: "Code of Conduct", url: "https://github.com/blackfyre-security/blackfyre/blob/main/CODE_OF_CONDUCT.md", blurb: "Contributor Covenant v2.1 covering all project spaces, with the enforcement contact and escalation ladder." },
  { title: "Trademark Notice", url: "https://github.com/blackfyre-security/blackfyre/blob/main/TRADEMARK.md", blurb: "What the Apache-2.0 license does and does not grant: code is free to use/modify/redistribute, but the Blackfyre name and logo are trademarks and forks must rename." },
  { title: "License (Apache-2.0)", url: "https://github.com/blackfyre-security/blackfyre/blob/main/LICENSE", blurb: "The full Apache License 2.0 text governing the source code (see NOTICE for attribution)." },
];

export interface SocialLink { label: string; url: string; }
export const SOCIALS: readonly SocialLink[] = [
  { label: "GitHub", url: SITE.repoUrl },
  { label: "LinkedIn", url: "https://www.linkedin.com/company/blackfyre-technologies/" },
  { label: "X", url: "https://x.com/blackfyretech" },
  { label: "Instagram", url: "https://www.instagram.com/blackfyre_technologies/" },
];
