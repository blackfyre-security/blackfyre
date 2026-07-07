# Deployment

> How code reaches each environment. Two modes: **CI/CD (preferred)** and **manual from a laptop (fallback)**.

This doc describes the pipeline shape and how to deploy Blackfyre to **your own** AWS +
Cloudflare accounts. Blackfyre's own hosted deploy runbook (real endpoints, account IDs,
secret values) lives in a private ops repo — not needed for self-hosting.

---

## TL;DR

| Stage | Trigger | Outcome |
|---|---|---|
| **staging** | push to `staging` git branch | CI builds → SST deploys API/RDS/queues/scanners → CF Pages deploys portal + admin |
| **prod** | push to `main` git branch | same flow, `--stage prod` |
| **demo** | manual `workflow_dispatch` with `stage=demo` | SST deploys demo Lambda → CF Pages deploys demo portal |

If GitHub Actions secrets aren't set yet, every CI run fails at `sst deploy` because it
can't auth to AWS. **See [docs/developer/configuration.md](developer/configuration.md)
for the secret names the pipeline expects.** Once those are set, every commit auto-deploys.

---

## Auto-deploy (CI/CD)

### What triggers what

`.github/workflows/deploy.yml`:

```yaml
on:
  push:
    branches: [main, staging]
    paths:
      - "platform/**"
      - "website/**"
      - ".github/workflows/deploy.yml"
      - "sandbox/**"
  workflow_dispatch:
    inputs:
      stage:
        type: choice
        options: [staging, prod, demo]
```

- **Push to `staging` branch** → resolves stage=staging → deploys staging
- **Push to `main` branch** → resolves stage=prod → deploys prod
- **Manual dispatch** → choose stage at runtime

### What runs

1. `resolve-stage` (computes the stage from trigger)
2. `deploy-sst` (per stage):
   - npm ci
   - Build `@blackfyre/shared`
   - `sst unlock` (clear stale locks)
   - `sst secret set` for all 11 secrets (skipped for `stage=demo`)
   - `sst deploy --stage <stage>`
   - Run DB migrations via `aws lambda invoke <migrateLambdaName>` (skipped for `stage=demo`)
3. `deploy-portal` (if not demo): build portal → `wrangler pages deploy` to a stage-named CF Pages project
4. `deploy-admin` (if not demo): same for admin
5. `deploy-demo-portal` (if demo): build portal → `wrangler pages deploy` to the demo CF Pages project
6. `deploy-website` (prod only): build marketing site → `wrangler pages deploy` to the marketing CF Pages project

### Concurrency
`group: deploy-${stage}` — same stage can only have one deploy running at a time. Different stages can deploy in parallel.

### Required GitHub Actions secrets (set on your fork/repo)
The pipeline sets all 11 SST secrets from GitHub Actions secrets before deploying.
See [docs/developer/configuration.md](developer/configuration.md) for what each one is
and how to generate a value.

### Required GitHub Actions variables
After your first deploy of a stage, `sst deploy` prints the API's Lambda Function URL
(and, if enabled, an SSE endpoint URL). Capture those and set them as repo variables so
the portal/admin build steps can bake them in:

- `STAGING_API_URL` / `STAGING_SSE_URL` — from the first staging deploy
- `DEMO_API_URL` — from the first demo deploy
- `PROD_API_URL` / `PROD_SSE_URL` — from the first prod deploy

Set with: `gh variable set NAME --repo <you>/<your-fork> --body "<value>"`

---

## Manual deploy from laptop (fallback / emergencies)

When CI is broken, or you want to test a deploy before committing:

### Pre-flight

```bash
# Authenticate
aws sso login    # or your team's flow — `aws sts get-caller-identity` must work
npx wrangler whoami    # must show "logged in"

# Export AWS credentials to env vars (SST needs them, doesn't read SSO directly)
eval "$(aws configure export-credentials --format env)"

# Cloudflare for wrangler steps (token must have Pages:Edit + Zone:DNS:Edit if you'll touch DNS)
export CLOUDFLARE_API_TOKEN="<your token>"

cd platform
npm ci
npm run build --workspace=packages/shared
```

### Deploy demo

```bash
# 1. Deploy the Lambda
cd platform
npx sst deploy --stage demo
# → prints the API's Lambda Function URL as `demoApiUrl` in the output; capture it

# 2. Build the portal pointing at that URL
cd packages/portal
rm -rf .next out
NEXT_PUBLIC_API_URL="<demoApiUrl from step 1>" NEXT_PUBLIC_DEMO_MODE="false" npm run build

# 3. Deploy to CF Pages
npx wrangler pages deploy out --project-name <your-project>-portal-demo --branch main --commit-dirty=true
```

### Deploy staging

```bash
cd platform

# 1. Set/refresh secrets (only needed if you're changing them; otherwise skip)
# See docs/developer/configuration.md for what each of the 11 secrets is and how to
# generate/obtain a value. Never commit real values — pull them from your own secrets
# manager or password vault.
npx sst secret set DbMasterPassword "<value>" --stage staging
# … same pattern for JwtSecret, EncryptionMasterKey, AnthropicApiKey, SmtpPass,
# WebhookSigningSecret, GoogleClientId, GoogleClientSecret, RazorpayKeyId,
# RazorpayKeySecret, RazorpayWebhookSecret

# 2. Deploy SST
npx sst deploy --stage staging
# Captures ~10-15 min on first run (RDS provisioning + container builds)

# 3. Run DB migrations (one-shot Lambda invoke)
FN=$(npx sst output --stage staging | grep migrateLambdaName | awk -F= '{print $2}' | tr -d ' ')
aws lambda invoke --function-name "$FN" --region ap-south-1 /tmp/migrate.json
cat /tmp/migrate.json    # check for "ok":true

# 4. Build + deploy portal
cd packages/portal
rm -rf .next out
NEXT_PUBLIC_API_URL="<staging API URL from sst output>" \
NEXT_PUBLIC_SSE_URL="<staging SSE URL from sst output>" \
NEXT_PUBLIC_DEMO_MODE="false" \
npm run build
npx wrangler pages deploy out --project-name <your-project>-portal-staging --branch main --commit-dirty=true

# 5. Build + deploy admin
cd ../admin
rm -rf .next out
NEXT_PUBLIC_API_URL="<staging API URL from sst output>" \
npm run build
npx wrangler pages deploy out --project-name <your-project>-admin-staging --branch main --commit-dirty=true
```

### Deploy prod

```bash
cd platform

# 1. Set prod secrets (first time only — fresh strong values, not staging's)
npx sst secret set DbMasterPassword     "$(openssl rand -base64 24)"        --stage prod
npx sst secret set JwtSecret            "$(openssl rand -base64 32)"        --stage prod
npx sst secret set EncryptionMasterKey  "$(openssl rand -hex 16)"           --stage prod
# … rest same pattern; for OAuth/Razorpay paste real values when ready

# 2. Deploy SST (longer than staging — multi-AZ RDS adds ~10 min)
npx sst deploy --stage prod

# 3. Migrate
FN=$(npx sst output --stage prod | grep migrateLambdaName | awk -F= '{print $2}' | tr -d ' ')
aws lambda invoke --function-name "$FN" --region ap-south-1 /tmp/migrate.json

# 4. Build + deploy portal
cd packages/portal
rm -rf .next out
NEXT_PUBLIC_API_URL="<prod API URL from sst output>" \
NEXT_PUBLIC_SSE_URL="<prod SSE URL from sst output>" \
NEXT_PUBLIC_DEMO_MODE="false" \
npm run build
npx wrangler pages deploy out --project-name <your-project>-portal --branch main --commit-dirty=true

# 5. Build + deploy admin
cd ../admin
rm -rf .next out
NEXT_PUBLIC_API_URL="<prod API URL>" npm run build
npx wrangler pages deploy out --project-name <your-project>-admin --branch main --commit-dirty=true

# 6. Build + deploy marketing site (only on prod)
cd ../../../website
npm ci
npm run build
npx wrangler pages deploy out --project-name <your-project> --branch main --commit-dirty=true

# 7. Add CF Pages custom domains via API (one-time)
CF_TOKEN="<your CF API token with Pages:Edit>"
ACC="<your Cloudflare account ID, from the dashboard sidebar>"
curl -X POST "https://api.cloudflare.com/client/v4/accounts/$ACC/pages/projects/<your-project>-portal/domains" \
  -H "Authorization: Bearer $CF_TOKEN" -H 'Content-Type: application/json' \
  -d '{"name":"app.yourdomain.com"}'
# Same for admin.yourdomain.com on the admin project
# Add api.yourdomain.com CNAME pointing at your API's URL (or set up a Worker proxy for proper TLS — see DNS setup below)
```

---

## DB migrations

### How they run
- File: `platform/packages/api/src/db/migrate.ts` (the runner) + 18 SQL files in `platform/packages/api/src/migrations/`
- In Lambda: invoke `MigrateLambda` via `aws lambda invoke` (bundles SQL files via SST `copyFiles`)
- Locally: `cd platform/packages/api && DATABASE_URL="..." npm run migrate`

### What 003_seed_data.sql does
Seeds test users (admin@acme.com, password123) + 3 tenants + sample data. Guarded by `current_setting('app.env', true) = 'development'`. The migrate Lambda sets `app.env = 'development'` before running so seeds load on staging too.

For prod: DON'T run the seed migration. Either skip it from the runner or change the guard.

---

## DNS setup (one-time per domain)

CF Pages handles SSL cert issuance and route. You just need:
1. Add custom domain to CF Pages project via API or dashboard.
2. CF auto-creates a CNAME from your subdomain to the Pages project's default domain. If a conflicting CNAME exists (e.g., from a previous setup), the new domain stays "pending" until you delete the old CNAME.
3. CF auto-issues cert (~2-5 minutes).

For the API's raw AWS endpoint (e.g., `api-staging.yourdomain.com`):
1. AWS Lambda Function URLs resolve to an AWS-managed `*.on.aws` hostname (visible in `sst output`). Create a CNAME from your subdomain to that hostname, proxy OFF.
2. Browser TLS will fail this way — the AWS-issued cert covers the `*.on.aws` domain, not yours.
3. To make HTTPS work: deploy a CF Worker that proxies + rewrites the Host header, OR front the Lambda with a CDN/API Gateway custom domain + your own ACM/CF cert.

---

## Rollback procedures

### Frontend (CF Pages)
- Each deploy creates a versioned preview URL (shown in the CI logs / CF Pages dashboard)
- In CF Pages dashboard → Deployments → select previous deploy → "Promote to production"
- Or via wrangler: `npx wrangler pages deployment list --project-name <your-project>` then `wrangler pages deployment activate <id>`

### Backend (SST)
- SST keeps state history but doesn't natively support rollback
- Easiest: `git revert` the bad commit, push → CI redeploys the previous version
- Hard rollback: `git checkout <good-tag> && npx sst deploy --stage X`
- For DB schema regressions: write a forward-fix migration (don't try to reverse-apply)

### Emergency: kill the demo
```bash
npx sst remove --stage demo
# Removes the demo Lambda + S3 code object. Re-deploy with `sst deploy --stage demo` when ready.
```

### Emergency: kill staging
```bash
# DON'T DO THIS LIGHTLY — destroys all staging data
npx sst remove --stage staging
# Takes 10-15 min; RDS final snapshot is taken automatically (skipFinalSnapshot=false on staging).
```

### Emergency: nuke prod
```bash
# Don't.
# Really don't.
# If you enable deletion protection on RDS and Object Lock COMPLIANCE on the evidence
# bucket (recommended for prod), tear-down requires manual AWS console intervention.
```

---

## Validation after each deploy

```bash
# API health
curl <your API URL>/health
# → {"status":"healthy","checks":{"database":"ok","redis":"unknown","queues":"ok"},...}

# Frontend reachable
curl -o /dev/null -w "%{http_code}\n" https://app-staging.yourdomain.com/login    # → 200
curl -o /dev/null -w "%{http_code}\n" https://admin-staging.yourdomain.com/login  # → 200
curl -o /dev/null -w "%{http_code}\n" https://demo.yourdomain.com/login           # → 200

# End-to-end auth (demo, using the seeded test user)
TOKEN=$(curl -s -X POST <your demo API URL>/api/auth/login \
  -H 'Content-Type: application/json' -d '{"email":"admin@acme.com","password":"x"}' \
  | python -c "import json,sys;print(json.load(sys.stdin)['accessToken'])")
curl -s -H "Authorization: Bearer $TOKEN" \
  <your demo API URL>/api/findings?limit=1 \
  | python -c "import json,sys;d=json.load(sys.stdin);print('findings count:', len(d['findings']))"
```
