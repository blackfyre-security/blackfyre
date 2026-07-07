# Branch protection — `main`

`main` is the production deploy target. The CI workflow `deploy.yml` triggers a
`sst deploy --stage prod` when a `workflow_run` from CI completes successfully
on `main`. Direct pushes to `main` would bypass review and ship straight to
prod, so `main` must require a PR.

## Rule to enable (GitHub Settings → Branches → Branch protection)

| Setting | Value |
|---|---|
| Branch name pattern | `main` |
| Require a pull request before merging | ✅ |
| Required approving reviews | 1 |
| Dismiss stale approvals when new commits pushed | ✅ |
| Require review from Code Owners | optional |
| Require status checks to pass | ✅ |
| Required status check | `CI / Platform — build + typecheck + lint` + `CI / Website — build` (the existing `ci.yml` jobs) |
| Require branches to be up to date | ✅ |
| Require linear history | ✅ (matches the Friday-rebase rhythm) |
| Require conversation resolution | ✅ |
| Restrict who can push | Repo admins only |
| Allow force pushes | ❌ |
| Allow deletions | ❌ |

> **Requires GitHub Pro / Team** for private repos. If the repo is on the free
> plan, the alternative is a CODEOWNERS file + social convention; the rule
> won't be enforced server-side.

## Friday rhythm

The weekly promotion is automated by `.github/workflows/friday-staging-to-main.yml`:

- Cron: Friday 04:30 UTC (10:00 IST).
- Opens (or updates) a PR from `staging` → `main` with the week's commits.
- Reviewer merges with **rebase** so `main` stays linear.

If a Friday is missed, the workflow is `workflow_dispatch`-triggerable from
the Actions tab.

## Hot-fix bypass

If a critical bug needs to ship outside the Friday rhythm:

1. Branch off `main` as `hotfix/<slug>`.
2. PR back to `main` directly with a 24-hour review SLA.
3. Cherry-pick into `staging` immediately so the next Friday PR doesn't
   reintroduce the bug.

Hot-fixes are the exception; the default cadence remains weekly.
