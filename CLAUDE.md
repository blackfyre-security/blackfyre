# CLAUDE.md

Blackfyre is an open-source (Apache-2.0) multi-cloud compliance platform: SDK-based
scanners audit AWS/Azure/GCP (plus on-prem targets), findings map onto 9 compliance
frameworks (SOC 2, ISO 27001, HIPAA, GDPR, PCI-DSS, DPDPA, ISO 42001, PDPPL, NIST
800-53), posture is scored per framework, and remediation is tracked with a
tamper-evident evidence vault. Multi-tenant SaaS enforced by Postgres row-level
security below the ORM. AI features (Claude via Anthropic API or Bedrock) degrade
gracefully to heuristics when no key is configured.

## Repo map

- `platform/` — the product. npm workspaces: `packages/shared` (Zod schemas/types),
  `packages/ui` (source-only component lib), `packages/api` (Fastify 4 backend +
  workers + scanners + migrations), `packages/portal` (customer Next.js app, :3001),
  `packages/cli`.
- `docs/` — architecture, developer guides (`docs/developer/`), ADRs (`docs/adr/`).
- `website/` — marketing site (separate Next.js static-export app, own lockfile).
- `sandbox/` — intentionally-vulnerable demo fixture data (out of scope for security reports).

## Architecture (read the ADRs, don't re-derive)

- API: `platform/packages/api/src/` — `index.ts` → `app.ts` (`buildApp`) → `plugins/`
  (auth, csrf, rate-limit, plan-gate, …) → `routes/` (41 files) → `services/` (56).
  `lambda.ts` wraps the same app for AWS. SSE lives in `sse-handler.ts`.
- Tenancy/RLS ([ADR-0001](docs/adr/0001-rls-multi-tenancy.md)): `plugins/auth.ts`
  reserves a connection, runs `set_config('app.current_tenant', <tenantId>)` then
  `SET ROLE app_user` (non-owner, no BYPASSRLS), and exposes it as `request.db`.
  Policies are fail-closed (`FORCE ROW LEVEL SECURITY`; missing setting → deny).
- Queues ([ADR-0002](docs/adr/0002-queue-architecture.md)): four SQS queues
  (scan/monitor/ai/evidence) consumed by pollers in `src/workers/`; LocalStack
  emulates SQS+S3 locally. Redis handles rate limits/caching.
- Scanners ([ADR-0003](docs/adr/0003-scanner-orchestration.md)): `src/agents/` —
  `aws/` (13), `azure/` (12), `gcp/` (11), plus on-prem auditors; orchestrated by
  `swarm-orchestrator.ts` via `registry.ts`. Prowler/IaC run as container Lambdas.
- Compliance data: `src/compliance/` — `control-registry.ts` registers the 9
  frameworks; catalogs live in `compliance/frameworks/`. New frameworks are data,
  not code.
- Deployment capability flags, both defaulting OFF and both enforced server-side:
  `PLATFORM_ADMIN_API` registers the cross-tenant operator routes (`/api/admin/*`,
  `/api/clients/*`) and is the only thing that makes `users.is_platform_admin` mean
  anything over HTTP ([ADR-0005](docs/adr/0005-operator-console-split.md));
  `ALLOW_UNPAID_REGISTRATION` gates `POST /api/auth/register`, which otherwise mints
  an owner on a paid-tier tenant to any caller. Self-hosting sets the latter true.
  `GET /api/v1/config` reports both to the portal, which is a static export and
  cannot read server env at build time.
- LLM ([ADR-0004](docs/adr/0004-model-routing.md)): `services/llm/client.ts` picks
  Anthropic API when `ANTHROPIC_API_KEY` is real, else Bedrock, else heuristics.

## Commands (all from `platform/`; Node 20, npm)

```bash
npm ci                                     # install (root, platform/, website/ each have lockfiles)
docker compose up -d postgres redis localstack   # local infra (see docker-compose.yml)
npm run db:migrate                         # raw-SQL migrations via src/db/migrate.ts
npm run dev                                # API on :4000 (tsx watch)
npm run dev --workspace=packages/portal    # portal :3001 (needs NEXT_PUBLIC_API_URL)
npm run build                              # shared, then api (order matters)
npm run test:unit --workspace=packages/api # CI-blocking unit suite (offline, mocked)
npm run test --workspace=packages/api      # full suite — needs live Postgres+Redis
npx vitest run tests/unit/foo.test.ts --config vitest.unit.config.ts   # single test (cwd packages/api)
npx tsc --noEmit -p packages/api/tsconfig.json   # typecheck (build shared first)
npm run lint --workspace=packages/portal
```

- No browser/e2e suite lives here — the Playwright smoke tests belonged to the
  operator console, which is no longer part of the open-source release (ADR-0005).
- Demo API without a DB: `npm run demo --workspace=packages/api` (:4001, mocked).
- Env: copy `packages/api/.env.example` → `.env` (loaded via `--env-file-if-exists`);
  every var documented in [docs/developer/configuration.md](docs/developer/configuration.md).

## Conventions

- TypeScript strict (`platform/tsconfig.base.json`), ESM (`NodeNext`). Kebab-case
  filenames, camelCase identifiers, snake_case SQL. No Prettier — `.editorconfig`
  (2-space, LF) is the formatting law. ESLint only in portal/admin (`next/core-web-vitals`).
- Tests: Vitest, `packages/api/tests/{unit,integration,smoke,browser}/*.test.ts`.
  Unit tests must run offline; integration tests may assume compose services.
- Git: fork-and-PR onto `main`, branches like `feat/short-description`,
  [Conventional Commits](CONTRIBUTING.md#commit-message-style), **DCO sign-off
  required on every commit** (`git commit -s`). No direct pushes to `main`.
- Write an ADR (`docs/adr/`) for anything architectural: new subsystem, a change to
  tenancy/queues/scanner contracts, new external dependency class.

## Security invariants (this is a security product — hold the bar)

- **Never bypass `request.db`.** Route/service code touching tenant data must use the
  RLS-bound `request.db`, not `app.db`/`app.superDb`. Anything using the super
  connection needs explicit tenant scoping and reviewer sign-off.
- `request.db.transaction()` is **unsupported** (reserved connections can't `.begin`);
  transactional work uses `app.db` with explicit tenant predicates (issue #7 tracks a guard).
- Migrations touching tenant tables must `ENABLE`+`FORCE ROW LEVEL SECURITY` and add
  the `tenant_isolation` policy pattern from `009a_rls_enforcement.sql`.
- Cloud credentials are encrypted at rest (`ENCRYPTION_MASTER_KEY`, fail-closed at
  boot) and never logged. Secrets live in env / AWS Secrets Manager — never in code,
  never echoed. `.gitleaks.toml` governs scanning.
- The tenant-isolation integration tests (`tests/integration/tenant-isolation.test.ts`,
  `rls-isolation.test.ts`) are the most important tests in the repo. RLS-relevant
  changes must run them against the compose stack.

## Gotchas

- Build `packages/shared` before api typecheck/build — CI does; you must too.
- **CI only triggers on PRs targeting `main`/`staging`** (`.github/workflows/ci.yml`).
  A stacked PR onto another feature branch silently skips every blocking gate —
  `workflow_dispatch` it manually, or don't trust a green PR page.
- Never import `agents/registry.js` at module scope. It eagerly pulls all ~34
  auditor modules and the AWS/Azure/GCP SDKs (~210s of vitest collect, and the same
  cost on every Lambda cold start). `services/integration-service.ts` resolves it
  lazily; keep it that way. The two tests that must load it set their own timeout.
- Auth events are NOT audited. `plugins/audit-log.ts` skips when `tenantId`/`userId`
  are absent, and login/register are unauthenticated — so `audit_logs` records
  authenticated mutations only. Verified empty after a register plus four logins.
- Migrations are **hand-written SQL** in `src/migrations/`, applied by filename order
  and tracked in `_migrations`. Append-only: never rename/reorder applied files.
  drizzle-kit is installed but unused — there is no generate/push/studio flow.
  `src/migrations/run.ts` is deprecated; the runner is `src/db/migrate.ts`.
- Editing `db/schema.ts` does NOT generate a migration — write the SQL yourself.
- `request.db` uses `drizzleReserved()` from `db/connection.ts` — swapping in bare
  `drizzle()` silently breaks auth (postgres.js reserved connections lack `.options`).
- Full test suite defaults expect the docker-compose credentials; if `npm test` can't
  connect, check `DATABASE_URL`/`REDIS_URL` against `platform/docker-compose.yml`.
- portal/admin are Next.js **static exports** (`output: "export"`): no SSR, no API
  routes, images unoptimized. Browser talks to `NEXT_PUBLIC_API_URL`.
- `config.ts` hard-exits in production if `JWT_SECRET`/`DATABASE_URL` look like dev
  placeholders. Vitest injects a throwaway `ENCRYPTION_MASTER_KEY`.
- CI blocking gates: typecheck, unit tests, portal+admin lint, DCO. `npm audit` is
  warn-only. Don't "fix" CI by weakening these.
- Generated/do-not-edit: workspace `dist/`, `.sst/`, `sst-env.d.ts`.
