# Monorepo map

Top-level layout:

```
blackfyre/
├── platform/        # the product — npm-workspaces monorepo (everything below)
├── website/         # marketing site (blackfyre.tech) — separate Next.js app
├── docs/            # this documentation tree
└── .github/         # CI (ci.yml) and deploy (deploy.yml) workflows
```

All product code lives in `platform/`, an npm-workspaces monorepo. Run npm commands
from `platform/` with `--workspace=packages/<name>`.

## packages/api — `@blackfyre/api`

The backend: Fastify 4 + Drizzle ORM + postgres-js, written for two runtimes — a
long-running server locally (`tsx watch src/index.ts`, port 4000) and AWS Lambda in
production (`src/lambda.ts` wraps the same app with `@fastify/aws-lambda`).

Key entry files:

- `src/index.ts` — local server bootstrap; `src/lambda.ts` — Lambda handler
- `src/app.ts` — builds the Fastify instance: CORS, plugin registration, all 40 route
  modules, request-scoped RLS connection release hooks
- `src/config.ts` — Zod-validated environment (see [configuration.md](configuration.md))
- `src/db/` — `connection.ts` (pools + `drizzleReserved`), `schema.ts` (Drizzle schema),
  `migrate.ts` (migration runner), `migrate-lambda.ts` (same, as a Lambda)
- `src/migrations/*.sql` — ordered SQL migrations (see [migrations.md](migrations.md))
- `src/routes/` — one file per resource (auth, scans, findings, evidence, …)
- `src/plugins/` — cross-cutting Fastify plugins (auth/RLS, CSRF, rate-limit, DLP, …)
- `src/services/` — business logic (scan orchestration, compliance scoring, encryption,
  evidence chain, payments, …)
- `src/agents/` — the scanner agents: per-cloud auditors (aws/, azure/, gcp/, plus
  on-prem/SNMP) coordinated by `swarm-orchestrator.ts`
- `src/workers/` — SQS consumers (scan / monitor / AI / evidence) + `poller-*.ts`
  long-poll entrypoints used by docker-compose and local dev
- `src/queue/` — SQS producer client and job payload types

Depends on `@blackfyre/shared`. Everything else depends on it at runtime via HTTP only.

## packages/portal — `@blackfyre/client`

The customer-facing app (Next.js 14, App Router, **static export**), port 3001 in dev.
Talks to the API with `src/lib/api.ts` (reads `NEXT_PUBLIC_API_URL` at build time).
Pages under `src/app/`: dashboard, scans, findings, evidence, reports, compliance,
settings, onboarding. Uses `@blackfyre/ui` + `@blackfyre/shared`.

Production invariant: the portal must stay `output: "export"` — no
middleware, no `app/api` routes, no server actions. It deploys to static hosting;
all dynamic behavior belongs in the API.

## packages/shared — `@blackfyre/shared`

The contract between API and frontends. No runtime dependencies beyond Zod.

- `src/schemas/` — Zod schemas for every API request/response (auth, scan, finding,
  evidence, report, tenant, …). The API validates with these; the frontends infer
  types from them. **Add/modify API contracts here first.**
- `src/types/` — plain TS types (incl. `sse-events.ts` for the live-scan stream)
- `src/constants/frameworks/` — the compliance framework/control catalog
- `src/pricing.ts` — plan tiers and entitlements

Everything depends on shared; shared depends on nothing.

## packages/ui — `@blackfyre/ui`

Shared React component library used by the portal — design-system primitives
(`Button`, `Card`, `DataTable`, `Toast`, …) and domain components (`FindingCard`,
`ScoreRing`, `ScanProgressBar`, `ComplianceStepper`, …). Entry: `src/index.ts`;
theme tokens under `src/theme/`.

## packages/cli — `@blackfyre/cli`

Small `commander`-based CLI (`bin: blackfyre`) for talking to the API from scripts.
Entry: `src/index.ts`. Depends on `@blackfyre/shared`.

## platform/infra — SST (AWS) infrastructure

SST v4 (Pulumi underneath) definitions, deployed with `npx sst deploy --stage <stage>`
(see [../self-hosting.md](../self-hosting.md)). One file per concern:

- `api.ts` / `sse.ts` — API + SSE Lambdas (Function URLs, CORS)
- `database.ts` / `network.ts` — RDS Postgres 16 in a VPC
- `queues.ts` — 4 SQS queues + DLQs with worker Lambda subscribers
- `scanners.ts` + `containers/{prowler-scanner,iac-scanner}/` — container-image Lambdas
- `storage.ts` — S3 evidence + scan-artifact buckets
- `secrets.ts` — the SST-managed secret set
- `migrations.ts` — the migrate Lambda (bundles `src/migrations/*.sql` via copyFiles)
- `demo.ts`, `budgets.ts` — demo stack and cost alarms

Root: `platform/sst.config.ts`.

## platform/docker — local-dev container support

`docker-compose.yml` services' config: `postgres-init.sql` (sets `app.env=development`
so seed migrations run), `localstack/init.sh` (creates queues/buckets), `nginx/`
(reverse proxy for the full containerized stack).

## website/

The marketing site — an independent Next.js static export, deployed separately from
the platform. Not part of the npm workspaces; `cd website && npm install && npm run dev`.

## Dependency direction

```
shared  ←  api
shared, ui  ←  portal
shared  ←  cli
(infra references api handlers by path; website is standalone)
```
