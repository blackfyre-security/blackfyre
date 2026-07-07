# Contributing to Blackfyre

Thanks for your interest in contributing. Blackfyre is Apache-2.0 licensed and
open to external contributions via the standard fork-and-PR flow.

## Before you start

- Read [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) — it applies to all project spaces.
- For anything beyond a small fix, open an issue first to discuss the approach
  before investing time in a PR. This avoids duplicate work and wasted effort
  on changes that don't fit the roadmap.
- Look for issues labeled [`good first issue`](https://github.com/<ORG>/blackfyre/labels/good%20first%20issue)
  if you're new to the codebase and want a well-scoped starting point.

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

Full setup instructions (prerequisites, environment variables, running
services locally) live in
[`docs/developer/local-development.md`](docs/developer/local-development.md).

At minimum, before opening a PR:

```bash
cd platform
npm run build
npm run test:unit --workspace=packages/api
```

Both commands must pass. CI runs the equivalent checks on every PR and will
block merge if either fails.

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
