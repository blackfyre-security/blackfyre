# Configuration (bring your own credentials)

Blackfyre is configured entirely through environment variables and, for deployed
stages, SST-managed secrets. This doc lists every one you'll encounter, what it's for,
and how to get a safe value for local development. It does not contain any real
credentials — copy the `.env.example` files and fill in your own.

Source files:
- `platform/.env.example` — shared/API defaults used by `docker-compose` local dev
- `platform/packages/api/.env.example` — the API service's full reference

---

## Required for local dev

These must be set (or left at their `.env.example` default) for the API to boot and
handle requests at all.

| Variable | Purpose | Local dev value |
|---|---|---|
| `DATABASE_URL` | Postgres connection string | `postgresql://blackfyre:blackfyre_dev@localhost:5432/blackfyre` (matches `docker-compose.yml`) |
| `REDIS_URL` | Redis connection string (queues, caching) | `redis://:blackfyre_redis_dev@localhost:6379` |
| `JWT_SECRET` | Signs user session JWTs (HS256) | Any random string locally; generate with `openssl rand -base64 32` |
| `JWT_EXPIRES_IN` | Access token TTL | `15m` |
| `JWT_REFRESH_EXPIRES_IN` | Refresh token TTL | `7d` |
| `ENCRYPTION_MASTER_KEY` | Encrypts PII columns at the app layer | Any high-entropy secret (SHA-256-normalized to a 32-byte AES key; the API fails closed if empty); generate with `openssl rand -hex 32` |
| `PORT` | API listen port | `4000` |
| `HOST` | API bind address | `0.0.0.0` |
| `NODE_ENV` | Runtime mode | `development` locally |
| `CORS_ORIGINS` | Comma-separated allowed origins | Your local portal/admin ports, e.g. `http://localhost:3001,http://localhost:3003` |

None of these need a real third-party account — a fresh random value works for local dev.

---

## Optional locally, required for the features they gate

Leave these empty to disable the feature; the API no-ops rather than erroring.

| Variable | Purpose | Get a value at |
|---|---|---|
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | "Sign in with Google" SSO | Google Cloud Console → APIs & Services → Credentials |
| `GOOGLE_REDIRECT_URI` | OAuth callback URL | Your own app's auth callback route |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` | Outbound email (alerts, invites, password reset) | Any SMTP provider (Gmail app password, SES, Postmark, etc.) |
| `WEBHOOK_SIGNING_SECRET` | HMAC-signs outbound webhook deliveries | Generate: `openssl rand -hex 32` |
| `ANTHROPIC_API_KEY` | Claude API key — powers AI gap analysis, AI remediation suggestions, AI worker | https://console.anthropic.com/settings/keys |
| `PLATFORM_ADMIN_API` | `"true"` registers the cross-tenant operator routes (`/api/admin/*`, `/api/clients/*`) for a hosted multi-tenant service. Defaults to `"false"` — the only supported self-hosted setting. See [ADR-0005](../adr/0005-operator-console-split.md). | — |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` / `RAZORPAY_WEBHOOK_SECRET` | Subscription payments (India / INR) | https://dashboard.razorpay.com/app/keys and .../webhooks |
| `STRIPE_SECRET_KEY` / `STRIPE_PUBLISHABLE_KEY` / `STRIPE_WEBHOOK_SECRET` | Subscription payments (international / USD) | https://dashboard.stripe.com/apikeys |
| `STRIPE_PRICE_ID_COMPLY` / `STRIPE_PRICE_ID_PROTECT` / `STRIPE_PRICE_ID_DEFEND` | Pre-created recurring Stripe prices | Optional — blank means the checkout route creates inline pricing instead |
| `SENTRY_DSN` / `SENTRY_RELEASE` (also `NEXT_PUBLIC_SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_RELEASE` for portal/admin) | Error reporting & tracing | https://sentry.io — leave empty to disable entirely |

---

## Hosted-only (set by infrastructure, not by hand)

These are populated automatically by SST at deploy time — you don't set them yourself
even in production, and they're not meaningful for local dev:

- `SCAN_QUEUE_URL`, `MONITOR_QUEUE_URL`, `AI_QUEUE_URL`, `EVIDENCE_QUEUE_URL` — SQS queue URLs
- `SCAN_ARTIFACTS_BUCKET`, `EVIDENCE_BUCKET` — S3 bucket names
- `PROWLER_SCANNER_ARN`, `IAC_SCANNER_ARN` — Lambda scanner ARNs
- `AWS_REGION` — set this one yourself to whichever region you deploy to

## SAML SSO (optional)

- `SAML_SP_ENTITY_ID` — your app's SAML entity ID, e.g. `https://yourapp.example.com`
- `SAML_ACS_URL` — your app's Assertion Consumer Service URL, e.g. `https://yourapp.example.com/api/auth/saml/acs`

Only needed if you're wiring up an enterprise IdP (Okta, Azure AD, etc.).

---

## The 11 SST secrets (deployed stages only)

For `staging`/`prod` deploys, the same set of values above is stored as SST-managed
AWS Secrets Manager secrets (one per stage) rather than plain env vars, so the CI
pipeline can `sst secret set` them without ever writing real values into the repo.

| Secret name | What it is | How to get a real value |
|---|---|---|
| `DbMasterPassword` | RDS Postgres master password | Generate fresh per stage: `openssl rand -base64 24` |
| `JwtSecret` | HS256 secret for signing user JWTs | Generate fresh: `openssl rand -base64 32` |
| `EncryptionMasterKey` | App-level field encryption key (PII columns) | Generate: `openssl rand -hex 32` (any high-entropy secret works — it is SHA-256-normalized to a 32-byte key) |
| `AnthropicApiKey` | Claude API key | https://console.anthropic.com/settings/keys |
| `SmtpPass` | SMTP password for your outbound-mail sender address | Your SMTP provider's app-password / API-key flow |
| `WebhookSigningSecret` | HMAC secret for outbound webhook signing | Generate: `openssl rand -hex 32` |
| `GoogleClientId` / `GoogleClientSecret` | OAuth client ID/secret for SSO login | Google Cloud Console → APIs & Services → Credentials |
| `RazorpayKeyId` / `RazorpayKeySecret` | Razorpay live key | https://dashboard.razorpay.com/app/keys |
| `RazorpayWebhookSecret` | Razorpay webhook signing key | https://dashboard.razorpay.com/app/webhooks |

Set with `npx sst secret set <Name> "<value>" --stage <stage>` — see
[docs/DEPLOYMENT.md](../DEPLOYMENT.md) for the full deploy flow. Never commit real
values for any of these; pull them from your own secrets manager or password vault at
deploy time.

---

## Quick start: generating safe local values

```bash
# JWT signing secret
openssl rand -base64 32

# Field-level encryption key (any high-entropy secret; required — API fails closed if empty)
openssl rand -hex 32

# Webhook HMAC signing secret
openssl rand -hex 32

# DB master password (only relevant if you're not using the docker-compose default)
openssl rand -base64 24
```

Copy `platform/.env.example` to `platform/.env` (and/or
`platform/packages/api/.env.example` to `platform/packages/api/.env`), fill in the
generated values above, and leave every integration variable in the "optional" and
"hosted-only" sections blank until you actually need that feature.
