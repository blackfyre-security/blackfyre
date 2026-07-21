# Repo setup (one-time admin steps)

These need to be run **once** on the upstream repo (`blackfyre-security/blackfyre`) by someone with admin access. They can't be done via PR because they're repo-level settings, not files.

Everything below uses `gh` CLI. Where `gh api` is shown, copy/paste exactly.

## ⚠️ Plan limitations

| Feature | Free / Public | Free / Private | Paid (Pro/Team/Enterprise) |
|---|---|---|---|
| Branch protection (`required_status_checks`) | ✅ | ❌ — returns HTTP 403 "Upgrade to GitHub Pro" | ✅ |
| Repository rulesets | ✅ | ❌ same | ✅ |
| Dependabot alerts | ✅ | ✅ | ✅ |
| Secret scanning push protection | ✅ | partial | ✅ |
| Auto-delete head branches | ✅ | ✅ | ✅ |
| Issue/PR templates | ✅ | ✅ | ✅ |
| Workflows (GitHub Actions) | ✅ | ✅ (2000 min/mo limit on free) | ✅ |

**`blackfyre-security/blackfyre` is private + free tier**, so branch protection currently cannot be enforced via the API. Three options:

1. **Upgrade to GitHub Team** ($4/user/month). Cheapest path to enforced protection on private repos.
2. **Skip enforced protection.** Rely on the convention documented in `CONTRIBUTING.md`. Workflows can still gate via `if:` conditions on actor identity, but it's discipline-based.
3. **Make the repo public.** Not appropriate for a SaaS source code base.

Items 1, 2, 3 (branch protection + auto-delete) below assume option 1 (upgraded plan). Items 4+ work on free.

---

## 1. Branch protection — `main` (requires GH Pro/Team for private repos)

```bash
gh api -X PUT repos/blackfyre-security/blackfyre/branches/main/protection \
  -F required_status_checks[strict]=true \
  -F required_status_checks[contexts][]=platform \
  -F required_status_checks[contexts][]=website \
  -F enforce_admins=false \
  -F required_pull_request_reviews= \
  -F restrictions= \
  -F allow_force_pushes=false \
  -F allow_deletions=false \
  -F required_linear_history=false \
  -F required_conversation_resolution=false
```

What this enforces:
- Must PR to merge (no direct push)
- CI `platform` + `website` jobs must pass
- No force-push, no deletion
- **No required reviewer count** — either of you can self-merge

## 2. Branch protection — `staging`

Same as `main`, just substitute the branch:

```bash
gh api -X PUT repos/blackfyre-security/blackfyre/branches/staging/protection \
  -F required_status_checks[strict]=true \
  -F required_status_checks[contexts][]=platform \
  -F required_status_checks[contexts][]=website \
  -F enforce_admins=false \
  -F required_pull_request_reviews= \
  -F restrictions= \
  -F allow_force_pushes=false \
  -F allow_deletions=false
```

## 3. Auto-delete head branches after merge

```bash
gh api -X PATCH repos/blackfyre-security/blackfyre \
  -F delete_branch_on_merge=true
```

## 4. Allow only squash + merge-commit merges (disable rebase if you want stricter)

```bash
gh api -X PATCH repos/blackfyre-security/blackfyre \
  -F allow_squash_merge=true \
  -F allow_merge_commit=true \
  -F allow_rebase_merge=false
```

## 5. Enable secret scanning + Dependabot security alerts

Native secret scanning, push protection, and private vulnerability reporting are
now wrapped in a dry-run-by-default helper — [`scripts/enable-repo-security.sh`](../scripts/enable-repo-security.sh).
Preview first, then apply:

```bash
./scripts/enable-repo-security.sh          # dry-run — prints the exact API calls
./scripts/enable-repo-security.sh --apply  # secret scanning + push protection + PVR
```

Dependabot security alerts + automated fixes still go through `gh api` directly:

```bash
gh api -X PUT repos/blackfyre-security/blackfyre/vulnerability-alerts
gh api -X PUT repos/blackfyre-security/blackfyre/automated-security-fixes
```

Repo content is additionally scanned by the [`Secret scan`](../.github/workflows/gitleaks.yml)
gitleaks workflow, which runs on every PR/push to `main`/`staging` (blocking) and
sweeps the full git history weekly. That gate lives in the tree and needs no admin
setup — it's already active. When requiring status checks in step 1, its check name
is `Secret scan / gitleaks`.

## 6. Delete merged feature branches

```bash
gh api -X DELETE repos/blackfyre-security/blackfyre/git/refs/heads/halo-revamp
gh api -X DELETE repos/blackfyre-security/blackfyre/git/refs/heads/launch-blockers/w1-w4
```

## 7. Set required GitHub Actions secrets

```bash
# AWS (use a deploy-only IAM user with locked-down policy; rotate quarterly)
gh secret set AWS_ACCESS_KEY_ID     --repo blackfyre-security/blackfyre --body "AKIA..."
gh secret set AWS_SECRET_ACCESS_KEY --repo blackfyre-security/blackfyre --body "..."

# Cloudflare
gh secret set CLOUDFLARE_API_TOKEN  --repo blackfyre-security/blackfyre --body "cfat_..."
gh secret set CLOUDFLARE_ACCOUNT_ID --repo blackfyre-security/blackfyre --body "<your-cloudflare-account-id>"

# SST secrets (passed through to sst secret set in deploy workflow)
gh secret set DB_MASTER_PASSWORD       --repo blackfyre-security/blackfyre
gh secret set JWT_SECRET               --repo blackfyre-security/blackfyre
gh secret set ENCRYPTION_MASTER_KEY    --repo blackfyre-security/blackfyre
gh secret set ANTHROPIC_API_KEY        --repo blackfyre-security/blackfyre
gh secret set SMTP_PASS                --repo blackfyre-security/blackfyre
gh secret set WEBHOOK_SIGNING_SECRET   --repo blackfyre-security/blackfyre
gh secret set GOOGLE_CLIENT_ID         --repo blackfyre-security/blackfyre
gh secret set GOOGLE_CLIENT_SECRET     --repo blackfyre-security/blackfyre
gh secret set RAZORPAY_KEY_ID          --repo blackfyre-security/blackfyre
gh secret set RAZORPAY_KEY_SECRET      --repo blackfyre-security/blackfyre
gh secret set RAZORPAY_WEBHOOK_SECRET  --repo blackfyre-security/blackfyre
```

Get the SST secret values from your local secrets store (never committed to this repo).

## 8. Set GitHub Actions variables (non-secret config)

```bash
gh variable set STAGING_API_URL   --repo blackfyre-security/blackfyre --body "https://<your-staging-function-id>.lambda-url.ap-south-1.on.aws"
gh variable set STAGING_SSE_URL   --repo blackfyre-security/blackfyre --body "https://<your-staging-sse-function-id>.lambda-url.ap-south-1.on.aws"
gh variable set DEMO_API_URL      --repo blackfyre-security/blackfyre --body "https://<your-demo-function-id>.lambda-url.ap-south-1.on.aws"

# REQUIRED for prod deploys — deploy.yml fails fast without it. Zone id for the
# production domain, from the Cloudflare dashboard (zone Overview, right sidebar).
gh variable set CLOUDFLARE_ZONE_ID --repo blackfyre-security/blackfyre --body "<your-cloudflare-zone-id>"

# Set these after the prod deploy lands:
# gh variable set PROD_API_URL --repo ... --body "https://api.blackfyre.tech"
# gh variable set PROD_SSE_URL --repo ... --body "https://sse.blackfyre.tech"
```

## 9. GitHub Actions environments (gating prod)

```bash
# Create environments + (optional) require manual approval for prod
gh api -X PUT repos/blackfyre-security/blackfyre/environments/staging
gh api -X PUT repos/blackfyre-security/blackfyre/environments/demo
gh api -X PUT repos/blackfyre-security/blackfyre/environments/prod \
  -F 'wait_timer=0' \
  -F 'reviewers[][type]=User' \
  -F 'reviewers[][id]=GIRIDHAR_USER_ID' \
  -F 'reviewers[][type]=User' \
  -F 'reviewers[][id]=NARASIMA_USER_ID'
```

(Replace `_USER_ID` with the GitHub numeric IDs — look them up via `gh api users/USERNAME`.)

This makes prod deploys require either of you to click "approve" before the SST deploy step runs. Staging + demo go through automatically.

## 10. Verify settings stuck

```bash
# Branch protection
gh api repos/blackfyre-security/blackfyre/branches/main/protection
gh api repos/blackfyre-security/blackfyre/branches/staging/protection

# Repo settings
gh repo view blackfyre-security/blackfyre --json deleteBranchOnMerge,allowSquashMerge,allowMergeCommit

# Secrets
gh secret list --repo blackfyre-security/blackfyre

# Variables
gh variable list --repo blackfyre-security/blackfyre
```

## Rotate credentials

Quarterly cadence (set a calendar reminder):
- AWS access keys → re-run step 7 with new values
- Cloudflare API token → regenerate at https://dash.cloudflare.com/profile/api-tokens, re-run `gh secret set CLOUDFLARE_API_TOKEN`
- SST secrets — only rotate if compromised; otherwise leave

## Migrate to AWS OIDC (later, when you want)

Replacing long-lived IAM access keys with GitHub OIDC trust is more secure. Steps in [aws-actions/configure-aws-credentials docs](https://github.com/aws-actions/configure-aws-credentials#configuring-iam-to-trust-github). Requires creating an IAM Role in AWS console + replacing the `env:` block in deploy.yml with `permissions: id-token: write` + `role-to-assume`. Skip for now; long-lived keys are fine for staging.
