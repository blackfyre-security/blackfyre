# Database migrations

## Where they live

`platform/packages/api/src/migrations/*.sql` — plain SQL files, applied in filename
order. 51 files at the time of writing (`001_initial_schema.sql` through
`043_certification_readiness_assessments.sql`; the count exceeds the highest number
because several prefixes have intentional letter-suffixed or duplicate-numbered files).

## How they run

Two runners share the same contract; both track applied files **by filename** in a
`_migrations` table and apply anything not yet recorded, in `readdirSync().sort()`
order. Each file is executed as a single `sql.unsafe()` batch (files manage their own
`BEGIN/COMMIT` where needed).

**Locally:**

```bash
# from platform/  (uses packages/api/.env automatically)
npm run db:migrate            # → npm run migrate --workspace=packages/api → tsx src/db/migrate.ts
```

Re-running is safe — already-recorded files are skipped (`skip: <file> (already applied)`).

**Deployed (AWS):** migrations run via the **migrate Lambda**
(`src/db/migrate-lambda.ts`, defined in `infra/migrations.ts`). The SQL files are
bundled into the Lambda zip via SST `copyFiles`. After `sst deploy`:

```bash
aws lambda invoke --function-name <MigrateLambdaName> --region <region> /tmp/migrate-out.json
cat /tmp/migrate-out.json     # {"ok":true,"applied":[...],"skipped":[...]}
```

The Lambda runs inside the VPC (RDS isn't publicly reachable) and receives
`SST_STAGE` so it can decide whether dev-only seeds are allowed.

## Seed migrations & the app.env guard

`003_seed_data.sql` (demo tenants/users/scans) and `018_seed_blackfyre_admin.sql`
(platform admin) are **development-only**. They check
`current_setting('app.env')` — `003` aborts hard, `018` no-ops — unless it equals
`development`. Locally, `docker/postgres-init.sql` sets that GUC on the compose
database; production databases never have it, so seeds can't land there.

Seeded logins (`admin@acme.com` / `password123`, etc.) are real argon2id hashes of
dev-only passwords — see [local-development.md](local-development.md#6-log-in).

## Numbering & ordering rules

- Filename order **is** execution order (plain lexicographic sort). Zero-pad to three
  digits.
- New migrations: take the next unused number (044+ as of this writing).
- A migration may only reference objects created by files that sort **before** it.
  This is easy to get wrong when a "remediation" migration alters tables created by a
  later foundation file — it bit this repo twice. The established fix pattern is a
  letter suffix that slots the file into the right position:
  - `009a_rls_enforcement.sql` — must run after `009_refresh_tokens.sql` but before
    the `010_*` files
  - `015b_schema_remediation.sql` — formerly `011_…`; its `ALTER TABLE
    integration_credentials` requires `015_preprod_foundation.sql` to have created
    that table first (this failed on every fresh database until renamed)
- **Always verify against a fresh database** before merging:
  ```bash
  cd platform && docker compose down -v && docker compose up -d postgres redis localstack
  npm run db:migrate     # must end with "Migrations complete."
  ```

## Write idempotent migrations

Because tracking is by filename, a renamed file re-applies on databases that ran it
under the old name. All migrations here are written to be re-runnable no-ops:
`IF NOT EXISTS` / `IF EXISTS` on DDL, `ON CONFLICT DO NOTHING` on seeds, guarded
`DO $$ … $$` blocks for conditional logic. Keep that property for anything new — it's
also what makes partially-failed deploys recoverable.

## RDS compatibility gotchas (managed Postgres has no superuser)

On AWS RDS the master user is **not** a Postgres superuser. Statements that work on
a local Docker postgres will fail on RDS if they need superuser. Known patterns,
learned the hard way (see the in-file notes in `009a` and `022`):

- `ALTER ROLE … NOSUPERUSER/NOBYPASSRLS` — superuser-only attributes; don't re-assert
  them. A freshly created role has neither, and on RDS no role can obtain them
  (`009a_rls_enforcement.sql` documents this).
- `CREATE EXTENSION` — only extensions on RDS's allowlist, and some need
  `rds_superuser`.
- `ALTER SYSTEM`, modifying `pg_hba`, event triggers — unavailable; parameter changes
  belong in the RDS parameter group.
- Roles are cluster-wide on RDS — guard `CREATE ROLE` with an existence check
  (`009a` shows the pattern).

## RLS in migrations

Tenant tables must ship with their isolation policy in the same migration that
creates them: `ENABLE ROW LEVEL SECURITY` + `FORCE ROW LEVEL SECURITY` + a
`tenant_isolation_<table>` policy keyed on
`current_setting('app.current_tenant', true)::uuid` (the `true` makes an unset
context yield NULL → deny-all, not an error). Copy the pattern from any of the
`03x_*.sql` files. Background: [ADR-0001](../adr/0001-rls-multi-tenancy.md).
