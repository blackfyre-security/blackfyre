# Testing

All automated tests live in `platform/packages/api/tests/` (Vitest), plus an opt-in
Playwright browser suite in `platform/packages/admin/tests/browser/`. Run everything
from `platform/`.

## Unit tests (offline — what CI runs on every PR)

```bash
npm run test:unit --workspace=packages/api
```

- Config: `packages/api/vitest.unit.config.ts` (only `tests/unit/**`, no setup file)
- Fully mocked — needs **no** Postgres, Redis, or network
- Baseline at the time of writing: 66 files, 1107 passed / 25 skipped, ~16s

This is the suite CONTRIBUTING.md asks you to run before opening a PR, and what
`.github/workflows/ci.yml` enforces.

## Full suite (integration — needs the docker services)

```bash
# from platform/, with `docker compose up -d postgres redis` already running:
DATABASE_URL="postgres://blackfyre:blackfyre_dev@localhost:5432/blackfyre" \
REDIS_URL="redis://:blackfyre_redis_dev@localhost:6379" \
npm test
```

- Config: `packages/api/vitest.config.ts`; `tests/helpers/setup.ts` connects to
  Postgres/Redis before the run
- **Gotcha (real):** the setup default is
  `postgres://blackfyre:localdev@localhost:5432/blackfyre_audit`, which does **not**
  match `platform/docker-compose.yml` (user `blackfyre`, password `blackfyre_dev`,
  db `blackfyre`). Without the explicit `DATABASE_URL` above, every file fails with
  `password authentication failed for user "blackfyre"`. It honors `$DATABASE_URL`,
  so the override is all you need.
- Run migrations first (`npm run db:migrate`) — integration tests expect the schema.

Both configs inject a test-only `ENCRYPTION_MASTER_KEY` (the encryption service fails
closed without key material).

## Running one test file / one test

```bash
# one file (from packages/api)
cd packages/api
npx vitest run tests/unit/mfa-challenge.test.ts --config vitest.unit.config.ts

# one test by name
npx vitest run -t "rejects malformed strings" --config vitest.unit.config.ts

# watch mode (from platform/)
npm run test:watch --workspace=packages/api
```

## Browser / e2e (Playwright, opt-in)

```bash
npm run test:browser --workspace=packages/admin     # sets BROWSER_SMOKE=1
```

- Config: `packages/admin/playwright.config.ts`; tests in
  `packages/admin/tests/browser/`
- Deliberately opt-in (`BROWSER_SMOKE=1`): these drive a real deployed admin app
  cross-origin, so they're excluded from casual test runs and from PR CI.
- First run needs browsers: `npx playwright install chromium`.

## Staging smoke

```bash
npm run test:smoke --workspace=packages/api         # sets STAGING_SMOKE=1
```

Hits a deployed staging API (config `vitest.smoke.config.ts`). Only meaningful if you
operate a staging stack (see [../self-hosting.md](../self-hosting.md)).

## What CI checks on a PR

From `.github/workflows/ci.yml`: install (`npm ci`), build (`npm run build`), unit
tests, plus the website build. Integration/browser suites are not in PR CI — run them
locally when your change touches DB behavior, RLS, or auth flows.

## Writing tests: where does mine go?

- Pure logic, schema validation, service behavior with mocked deps →
  `tests/unit/**` (keeps PR CI fast and offline)
- Anything asserting real SQL/RLS/Redis behavior → integration (top-level
  `tests/**`, picked up by `npm test` only)
- A bug fix should come with a test that fails before the fix and passes after
