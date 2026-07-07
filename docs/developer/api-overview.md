# API overview

How `packages/api` is put together, and how to add an endpoint the way the existing
40 route modules do.

## App composition

`src/app.ts` `buildApp(config)` assembles everything in a fixed order:

1. **CORS** — request-validated allowlist from `CORS_ORIGINS` (skipped on Lambda,
   where the Function URL handles CORS; locally it defaults to
   `http://localhost:3001,3003`)
2. **DB pools** — `createDb()` gives the app three handles (decorated on the
   instance): `app.db` (owner pool), `app.superDb` (single-connection admin pool that
   bypasses RLS — callers must tenant-filter by hand), and `app.appSql` (the raw
   postgres-js pool that per-request RLS connections are reserved from)
3. **Queues** — `SqsQueue` producers for scan/monitor/AI/evidence (LocalStack locally
   via `SQS_ENDPOINT`, real SQS in AWS)
4. **Plugins** (`src/plugins/`) — security headers, request logger, rate limit
   (Redis), redis, auth (below), CSRF, audit log, plan gate, mTLS, zero-leakage, DLP
5. **Routes** — every module in `src/routes/` registered flat (no prefix nesting);
   each file owns its `/api/<resource>` paths
6. **Release hooks** — `onResponse`/`onError` RESET + release the request's reserved
   RLS connection so nothing leaks back into the pool

Entrypoints: `src/index.ts` (local server), `src/lambda.ts` (same app wrapped with
`@fastify/aws-lambda`), `src/sse-handler.ts` (the SSE Lambda).

## Auth model

Three layers, all in `src/plugins/auth.ts` + `src/plugins/csrf.ts`:

- **JWT (HS256, pinned)** — `Authorization: Bearer <accessToken>` from
  `POST /api/auth/login`. The verify algorithm list is pinned to HS256, and the
  `type` claim must be `access` (refresh/MFA/reset tokens are rejected at bearer
  endpoints). API keys (`x-api-key`) are the alternative: prefix lookup + argon2
  hash verify.
- **CSRF** — mutating methods (POST/PUT/PATCH/DELETE) require an `X-CSRF-Token`
  header matching the `csrf_token` cookie (double-submit). Exempt: `/api/auth/*`,
  webhooks (signature-authenticated), health, SCIM, contact.
- **RLS tenant binding (`request.db`)** — after a token verifies, the auth plugin
  reserves a dedicated connection from `app.appSql`, runs
  `SELECT set_config('app.current_tenant', <tenantId>, false)` + `SET ROLE app_user`,
  and exposes it as `request.db` (a Drizzle handle built with `drizzleReserved()` —
  see `db/connection.ts` for why plain `drizzle()` doesn't work on reserved
  connections). `app_user` is a non-owner role, so Postgres row-level security
  enforces tenant isolation on every query. Fail-closed: if the bind fails, the
  request 401s. Details: [ADR-0001](../adr/0001-rls-multi-tenancy.md).

Rules of thumb in route handlers:

- Tenant-scoped reads/writes → `request.db` (RLS does the filtering)
- Cross-tenant/admin/provisioning paths → `app.superDb` **with explicit
  `tenant_id` predicates** — it bypasses RLS
- `request.db.transaction()` is not supported (reserved connections lack `begin`);
  use `app.db`/`app.superDb` with explicit tenant scoping when you need a transaction

## Where contracts live

Request/response shapes are Zod schemas in **`packages/shared/src/schemas/`**
(one file per resource), re-exported from `@blackfyre/shared`. Routes parse input
with them; the portal/admin import the same schemas for types. Plain TS types
(including SSE event payloads) live in `packages/shared/src/types/`.

## Adding an endpoint

1. **Schema first** — add/extend the Zod schema in
   `packages/shared/src/schemas/<resource>.ts` and export it from the package index.
2. **Route** — in the matching `src/routes/<resource>.ts` (or a new file):

   ```ts
   export const widgetRoutes: FastifyPluginAsync = async (app) => {
     const adminOrEngineer = (app as any).requireRole("owner", "admin", "engineer");

     app.get("/api/widgets", { preHandler: [adminOrEngineer] }, async (request) => {
       const db = request.db ?? app.db;              // RLS-scoped handle
       return db.select().from(widgets);              // no manual tenant filter needed
     });
   };
   ```

   `requireRole(...)` runs `authenticate()` (JWT/API-key + RLS bind) and then checks
   the role claim. Roles: `owner`, `admin`, `engineer`, `viewer`, `auditor` (+
   platform-admin flag checked separately in admin routes).
3. **Register** — new files only: import and `app.register(widgetRoutes)` in
   `src/app.ts` next to the other routes.
4. **Validate input** — parse `request.body`/`query` with the shared schema; throw
   the typed helpers from `src/utils/errors.ts` (`badRequest`, `notFound`,
   `forbidden`, …) so the global error handler formats responses consistently.
5. **Feature gating** — plan-gated features use the plan-gate plugin /
   `request.tenantPlan` (populated at auth time from the tenant row).
6. **Test** — unit test in `packages/api/tests/unit/`; add an integration test if
   the behavior depends on real SQL/RLS. See [testing.md](testing.md).

## Background work

Don't do slow work in-request. Enqueue to the right queue
(`app.scanQueue` / `monitorQueue` / `aiQueue` / `evidenceQueue`) and let the worker
(`src/workers/<x>-worker.ts`) process it; workers run as SQS-subscribed Lambdas in
AWS and as `poller-*.ts` long-poll processes locally. **Never put secret material on
a queue payload** — pass references, or the AES-256-GCM `SecretEnvelope` pattern used
by scan jobs (`src/queue/scan-queue.ts` documents it). Architecture:
[ADR-0002](../adr/0002-queue-architecture.md).

## Observability

- Structured logs via Fastify/pino; every response gets `http.timing` with
  `requestId` + `tenantId`
- `GET /health` — liveness incl. DB/Redis/queue checks
- Sentry (optional, `SENTRY_DSN`) — `src/sentry.ts`, reports unhandled errors only
- Audit log plugin records privileged actions to the DB
