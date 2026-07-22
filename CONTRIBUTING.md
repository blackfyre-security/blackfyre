# Contributing to Blackfyre

Thanks for your interest in contributing. Blackfyre is Apache-2.0 licensed and
open to external contributions via the standard fork-and-PR flow.

## Before you start

- Read [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) — it applies to all project spaces.
- For anything beyond a small fix, open an issue first to discuss the approach
  before investing time in a PR. This avoids duplicate work and wasted effort
  on changes that don't fit the roadmap.
- Look for issues labeled [`good first issue`](https://github.com/blackfyre-security/blackfyre/labels/good%20first%20issue)
  if you're new to the codebase and want a well-scoped starting point. Comment on
  the issue to claim it — a maintainer will confirm nobody else is on it.
- For open-ended questions or ideas, use
  [GitHub Discussions](https://github.com/blackfyre-security/blackfyre/discussions);
  issues are for concrete bugs and scoped work.
- You don't have to write code to contribute meaningfully: compliance domain
  knowledge (control interpretations, framework mappings) is half of what this
  project runs on — see
  [Adding a cloud check or framework mapping](#adding-a-cloud-check-or-framework-mapping).

## Fork-and-PR flow

1. Fork the repo and clone your fork.
2. Create a branch off `main`: `git checkout -b feat/short-description`.
3. Make your change, following the local setup below.
4. Commit with sign-off (see DCO section) and a conventional-commit message.
5. Push to your fork and open a PR against `main`.
6. Address review feedback; once CI is green and the PR is approved, a
   maintainer merges it.

Do not push directly to this repository — all changes land via PR.

## Local development setup

Full setup instructions (prerequisites, environment variables, seeded logins,
troubleshooting) live in
[`docs/developer/local-development.md`](docs/developer/local-development.md).
The short version — you need Node 20, npm, and Docker:

```bash
git clone https://github.com/<your-fork>/blackfyre.git && cd blackfyre/platform
docker compose up -d postgres redis localstack   # Postgres 16, Redis, SQS/S3 emulation
npm install && npm run build
cp packages/api/.env.example packages/api/.env   # then edit per the local-dev guide
npm run db:migrate && npm run dev                # API on :4000
```

The portal (`:3001`) runs with
`NEXT_PUBLIC_API_URL=http://localhost:4000 npm run dev --workspace=packages/portal`.

## Secret scanning

Blackfyre is a security product — never commit real credentials. Secrets are read
from the environment / SST secrets at runtime (see
[`docs/developer/configuration.md`](docs/developer/configuration.md)), never from
the tree. Enable the local pre-commit hook once per clone so gitleaks scans your
staged changes before every commit:

```bash
git config core.hooksPath .githooks   # from the repo root
```

The hook is a convenience gate — if gitleaks isn't installed it warns and lets the
commit through (install: `brew install gitleaks`, or see the
[gitleaks install docs](https://github.com/gitleaks/gitleaks#installing)). The
**blocking** gates are the `Secret scan` CI workflow (runs on every PR/push and
fails the check on a finding) plus GitHub push protection. All three share the
repo's [`.gitleaks.toml`](.gitleaks.toml) allowlist, which covers only documented
synthetic fixtures — add a narrow path/regex entry there for a verified false
positive, never a blanket suppression.

## Running and writing tests

```bash
cd platform
npm run test:unit --workspace=packages/api   # unit suite — offline, CI-blocking
npm run test --workspace=packages/api        # full suite — needs the compose services up
cd packages/api && npx vitest run tests/unit/some-file.test.ts --config vitest.unit.config.ts   # one file
```

- Tests are Vitest, in `platform/packages/api/tests/{unit,integration,smoke}/`.
- **Unit tests must run offline** (no Postgres/Redis) — that's what gates PRs.
- A bug fix should come with a test that fails before the fix and passes after.
- If your change touches tenant-scoped data, run the tenant-isolation suite
  against the compose stack — it's the most important test in the repo:
  `npx vitest run tests/integration/tenant-isolation.test.ts` (from `packages/api`).
  run against a deployed environment — maintainers run these; you don't need to.

At minimum, before opening a PR:

```bash
cd platform
npm run build
npm run test:unit --workspace=packages/api
```

Both commands must pass. CI runs the equivalent checks on every PR and will
block merge if either fails.

## Adding a cloud check or framework mapping

The highest-leverage contribution to Blackfyre: more checks and better control
mappings directly improve every user's compliance coverage. Start with the
[new check proposal](https://github.com/blackfyre-security/blackfyre/issues/new?template=new_check_proposal.yml)
issue template so a maintainer can confirm scope before you build.

**Where things live** (all under `platform/packages/api/src/`):

- `agents/aws/`, `agents/azure/`, `agents/gcp/` — one auditor per cloud service
  (e.g. `agents/aws/s3-auditor.ts`). Each extends `base-agent.ts` and is registered in
  `agents/registry.ts`; the swarm orchestrator runs them uniformly
  ([ADR-0003](docs/adr/0003-scanner-orchestration.md)).
- `compliance/control-registry.ts` — registers the 9 frameworks; catalogs live
  in `compliance/frameworks/` (plus some inline in the registry). The
  `Framework` const map is in `packages/shared/src/types/control-mapping.ts`.
- Findings carry framework mappings — each check declares which control IDs it
  evidences, and scoring rolls up from there (`compliance/scoring.ts`).

**Adding a check to an existing auditor** is the gentlest on-ramp: find the
service file under `agents/<cloud>/`, follow the pattern of a neighboring check
(SDK call → evaluate → emit finding with control mappings + remediation text),
and add a unit test next to the existing ones for that auditor.

**Adding a framework** is data, not code: a control catalog (ID, title,
description, weight) in `compliance/frameworks/`, registered in
`control-registry.ts`, plus a `Framework` map entry. Mappings from existing
checks to the new framework's controls can then land incrementally — great
follow-up PRs for compliance-minded contributors.

Real cloud credentials are never required for tests — auditors are unit-tested
with mocked SDK responses, and `sandbox/fake-org/` provides a deliberately
misconfigured mock AWS for integration runs.

## Developer Certificate of Origin (DCO)

Every commit must be signed off:

```bash
git commit -s -m "feat: add scan result pagination"
```

The `-s` flag appends a `Signed-off-by: Your Name <you@example.com>` trailer
to the commit message. By adding it, you're certifying — under the
[Developer Certificate of Origin](https://developercertificate.org/) — that
you wrote the change (or otherwise have the right to submit it) and that
you're licensing it under this project's license (Apache-2.0).

PRs with unsigned commits will fail the DCO check and cannot be merged until
fixed. If you forgot to sign off, amend and force-push:

```bash
git commit --amend -s
git push --force-with-lease
```

For multiple unsigned commits, use `git rebase --exec 'git commit --amend --no-edit -s' -i <base>`
or squash them into one signed-off commit.

## Commit message style

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(api): add findings filter by framework
fix(portal/scans): handle empty scan list
docs: clarify local dev setup in CONTRIBUTING
ci: cache node_modules in build workflow
chore(deps): bump zod 3.23 → 3.24
```

Common types: `feat`, `fix`, `docs`, `ci`, `chore`, `refactor`, `test`. A scope
in parentheses (e.g. `(api)`, `(portal)`) is encouraged when the change is
localized to one package or area.

## What CI checks on every PR

- Dependency install (`npm ci`)
- Build (`npm run build`)
- Unit tests (`npm run test:unit --workspace=packages/api`)
- DCO sign-off on every commit

A PR must be green before it can be merged.

## Review expectations

- A maintainer will respond within a few days — ping the issue/PR if you
  haven't heard back after a week.
- Small, focused PRs get reviewed and merged fastest. Prefer several small
  PRs over one large one; split unrelated changes into separate PRs.
- Draft PRs are welcome if you want early feedback on direction before
  finishing the implementation.

## Reporting security issues

Do not open a public issue for security vulnerabilities — see
[SECURITY.md](SECURITY.md) for the private disclosure process.
