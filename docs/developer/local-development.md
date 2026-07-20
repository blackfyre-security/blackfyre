# Local development

Get a full Blackfyre stack — API, client portal, admin dashboard, Postgres, Redis, and
emulated SQS/S3 — running on your machine in about 15 minutes. Every command in this
guide was executed against a fresh database before being written down.

## Prerequisites

- **Node.js 20+** (`.nvmrc` pins the version; Node 22 is what this guide was verified with)
- **Docker** with the **Compose v2 CLI plugin** (`docker compose version` must work —
  see [Troubleshooting](#troubleshooting) if it doesn't)
- ~2 GB free RAM for the three infra containers

No AWS account, no Anthropic key, no third-party credentials are needed for local dev.

## 1. Clone and start the infrastructure

```bash
git clone https://github.com/<ORG>/blackfyre.git
cd blackfyre/platform

docker compose up -d postgres redis localstack
docker compose ps   # wait until all three show (healthy)
```

This starts:

| Container | What | Port |
|---|---|---|
| `postgres` | Postgres 16 (db `blackfyre`, user `blackfyre`, password `blackfyre_dev`) | 5432 |
| `redis` | Redis 7 (password `blackfyre_redis_dev`) | 6379 |
| `localstack` | Emulated SQS + S3 — creates the 4 job queues + DLQs and 2 buckets at startup | 4566 |

> Start **only these three services** for the dev loop. The full `docker compose up`
> also builds and runs containerized api/admin/portal/nginx — useful for testing the
> production containers, but slower to iterate on than running them via npm below.

## 2. Install and build

```bash
# still in blackfyre/platform
npm install
npm run build        # tsc for packages/shared + packages/api
```

## 3. Configure the API environment

```bash
cp packages/api/.env.example packages/api/.env
```

Then edit `packages/api/.env` so the connection values match the compose containers:

```ini
DATABASE_URL=postgres://blackfyre:blackfyre_dev@localhost:5432/blackfyre
REDIS_URL=redis://:blackfyre_redis_dev@localhost:6379

# LocalStack-emulated SQS + S3 (so scan/AI/evidence enqueues work locally)
SQS_ENDPOINT=http://localhost:4566
SCAN_QUEUE_URL=http://localhost:4566/000000000000/ScanJobsQueue
MONITOR_QUEUE_URL=http://localhost:4566/000000000000/MonitorJobsQueue
AI_QUEUE_URL=http://localhost:4566/000000000000/AiJobsQueue
EVIDENCE_QUEUE_URL=http://localhost:4566/000000000000/EvidenceJobsQueue
EVIDENCE_BUCKET=blackfyre-evidence-local
SCAN_ARTIFACTS_BUCKET=blackfyre-scan-artifacts-local
AWS_ACCESS_KEY_ID=test
AWS_SECRET_ACCESS_KEY=test
AWS_REGION=ap-south-1

# JWT_SECRET needs 32+ chars; ENCRYPTION_MASTER_KEY accepts any high-entropy
# secret (required — the API fails closed if it's empty). Details in configuration.md.
JWT_SECRET=dev-only-secret-replace-in-production!!
ENCRYPTION_MASTER_KEY=dev-encryption-key-32-characters!!
```

Everything else in the `.env.example` (SMTP, Google SSO, payments, Sentry, Anthropic)
can stay empty — those features cleanly no-op when unconfigured. The full variable
reference lives in [configuration.md](configuration.md).

The API's npm scripts load this file automatically (`--env-file-if-exists=.env`), so
you don't need to export anything in your shell.

## 4. Migrate and seed

```bash
npm run db:migrate     # alias for: npm run migrate --workspace=packages/api
```

Expected output: one `applying:`/`done:` pair per file, ending with
`Migrations complete.` (51 migrations at the time of writing). Migration
`003_seed_data.sql` seeds three demo tenants with users, scans, findings, and scores;
`018_seed_blackfyre_admin.sql` seeds a platform admin. Both are guarded to never run
where `app.env != 'development'` — the compose Postgres sets that via
`docker/postgres-init.sql`.

## 5. Run the services

**Fast path — one terminal** (from `blackfyre/platform`):

```bash
npm run dev:all
```

This starts all three services concurrently — API (Fastify, port 4000), client
portal (Next.js, port 3001), and admin dashboard (Next.js, port 3003) — with
prefixed, color-coded logs. Ctrl+C shuts all three down together.

Prefer separate terminals (e.g. to restart one service without the others)?
The individual commands are:

```bash
# Terminal 1 — API (Fastify, port 4000)
npm run dev

# Terminal 2 — client portal (Next.js, port 3001)
NEXT_PUBLIC_API_URL=http://localhost:4000 npm run dev --workspace=packages/portal
```

Confirm the API is healthy:

```bash
curl http://localhost:4000/health
# {"status":"healthy",...,"checks":{"database":"ok","redis":"ok","queues":"ok"}}
```

## 6. Log in

Open http://localhost:3001 (portal) or http://localhost:3003 (admin) and sign in with
a seeded local user (dev-only credentials, never valid anywhere else):

| Email | Password | Role |
|---|---|---|
| `admin@acme.com` | `password123` | Tenant owner (Acme Corp — has seeded scans/findings) |
| `engineer@acme.com` | `password123` | Engineer |
| `viewer@acme.com` | `password123` | Viewer |
| `admin@healthfirst.com` | `password123` | Owner of a second tenant (handy for RLS testing) |
| `admin@blackfyre.tech` | `admin@blackfyre` | Platform admin (admin dashboard) |

Or via curl:

```bash
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@acme.com","password":"password123"}'
# → { "accessToken": "...", "refreshToken": "..." }

curl http://localhost:4000/api/scans -H "Authorization: Bearer <accessToken>"
# → the Acme tenant's seeded scans (and only Acme's — RLS scopes every query)
```

## 7. Optional: background workers

Scans, AI analysis, and evidence jobs are queued to (emulated) SQS and processed by
long-poll workers. The API runs fine without them — queued jobs just sit until a
worker starts. To actually process jobs, run any of:

```bash
npx tsx --env-file-if-exists=packages/api/.env packages/api/src/workers/poller-scan.ts
npx tsx --env-file-if-exists=packages/api/.env packages/api/src/workers/poller-monitor.ts
npx tsx --env-file-if-exists=packages/api/.env packages/api/src/workers/poller-ai.ts
npx tsx --env-file-if-exists=packages/api/.env packages/api/src/workers/poller-evidence.ts
```

(These are the same entrypoints the docker-compose worker containers run.)

## Resetting

```bash
docker compose down -v      # drops the Postgres volume too
docker compose up -d postgres redis localstack
npm run db:migrate          # fresh schema + seed
```

## Troubleshooting

Real issues hit while verifying this guide:

- **`docker compose` → `unknown shorthand flag: 'd'`** — the Compose v2 plugin isn't
  installed (common with non-Docker-Desktop setups like Lima/Colima). Install it:
  ```bash
  mkdir -p ~/.docker/cli-plugins
  curl -SL "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s | tr A-Z a-z)-$(uname -m | sed 's/arm64/aarch64/')" \
    -o ~/.docker/cli-plugins/docker-compose
  chmod +x ~/.docker/cli-plugins/docker-compose
  ```
- **LocalStack logs `Permission denied: /etc/localstack/init/ready.d/init.sh`** — the
  init hook lost its executable bit (e.g. a checkout with unusual umask). Fix:
  `chmod +x docker/localstack/init.sh && docker compose restart localstack`, then check
  `docker compose logs localstack` for `[localstack-init] done`.
- **`npm run migrate` → `DATABASE_URL is required`** — your `packages/api/.env` is
  missing (the scripts only auto-load `packages/api/.env`, not `platform/.env`).
- **Login returns 200 but every authenticated request 401s** — you're on a stale
  build/checkout without the `drizzleReserved` fix in
  `packages/api/src/db/connection.ts`. Pull latest; the per-request RLS handle used
  to fail construction on postgres.js reserved connections.
- **Port already in use** — API 4000, portal 3001, admin 3003, Postgres 5432,
  Redis 6379, LocalStack 4566. Stop whatever holds them or change `PORT` in `.env`
  (API only; the frontends pin theirs in their `dev` scripts).
- **Admin dev server warns `Middleware cannot be used with "output: export"`** —
  benign in dev; the admin app is a static export in production and the middleware
  file is ignored there.

## Where to next

- [monorepo-map.md](monorepo-map.md) — what each package does
- [testing.md](testing.md) — unit / integration / e2e
- [migrations.md](migrations.md) — adding schema changes
- [api-overview.md](api-overview.md) — how the API is put together
