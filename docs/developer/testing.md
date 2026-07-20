# Testing

All automated tests live in `platform/packages/api/tests/` (Vitest). Run everything
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
npm test
```

- Config: `packages/api/vitest.config.ts`; `tests/helpers/setup.ts` connects to
  Postgres/Redis before the run
- The setup defaults match `platform/docker-compose.yml`
  (`postgres://blackfyre:blackfyre_dev@localhost:5432/blackfyre` and
  `redis://:blackfyre_redis_dev@localhost:6379`), so no overrides are needed
  against the compose services. Both honor `$DATABASE_URL` / `$REDIS_URL` if you
  point tests at a different instance.
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

## Browser / e2e

There is currently no browser/e2e suite in this repository. The Playwright smoke
tests lived in the operator console, which is no longer part of the open-source
release (see [ADR-0005](adr/0005-operator-console-split.md)). Portal e2e coverage
is open work — see the issue tracker.

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
