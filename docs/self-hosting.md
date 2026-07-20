# Self-hosting Blackfyre

Two honest tiers. Pick the one that matches what you're trying to do.

| | Local / evaluation | Production |
|---|---|---|
| Runs on | Docker Compose on one machine | Your AWS account, deployed with SST |
| Good for | Trying Blackfyre, development, demos | Real tenants, real scans at scale |
| Cost | Free | Roughly $50–100+/month idle (see below) |
| Effort | ~15 minutes | An afternoon + AWS familiarity |

---

## Tier 1: Local / evaluation (Docker Compose)

The [local development guide](developer/local-development.md) is the evaluation
path — it stands up the full product (API, portal, Postgres, Redis, emulated
SQS/S3, seeded demo data) with no cloud account.

For an all-container variant (closer to production packaging), `platform/docker-compose.yml`
can also build and run the API, the four workers, both frontends, and an nginx
reverse proxy:

```bash
cd platform
docker compose up -d --build
# then add to /etc/hosts:
#   127.0.0.1 api.blackfyre.local app.blackfyre.local
# and open http://app.blackfyre.local
```

Limits of this tier: LocalStack emulates SQS/S3 (fine for functionality, not for
durability guarantees), the Prowler/IaC container scanners aren't wired locally
(SDK-based scanners work), and nothing here is hardened for internet exposure. Don't
put real customer data on it.

## Tier 2: Production (your AWS account, via SST)

The infrastructure is code in `platform/infra/` + `platform/sst.config.ts`
([SST v4](https://sst.dev)). One command deploys a complete, isolated stage.

### What gets provisioned

- **API + SSE** — Lambda functions behind Function URLs (`infra/api.ts`, `infra/sse.ts`)
- **Database** — RDS Postgres 16 inside a VPC with private subnets + NAT (`infra/database.ts`, `infra/network.ts`)
- **Queues** — 4 SQS queues (scan / monitor / AI / evidence) each with a DLQ
  (retry 3), with worker Lambdas subscribed (`infra/queues.ts`)
- **Scanners** — Prowler and IaC (Checkov/Semgrep/Bandit) as container-image Lambdas
  with their own ECR repos (`infra/scanners.ts`, `infra/containers/`)
- **Storage** — S3 evidence bucket (Object Lock + versioning) and a scan-artifacts
  bucket with 7-day expiry (`infra/storage.ts`)
- **Secrets** — 11 SST-managed secrets in AWS Secrets Manager, per stage (`infra/secrets.ts`)
- **Migration Lambda** — applies `packages/api/src/migrations/*.sql` from inside the
  VPC (`infra/migrations.ts`)
- **Budget alarms** — (`infra/budgets.ts`)

The frontends (portal/website) are static Next.js exports — host them on any
static host/CDN (the reference deployment uses Cloudflare Pages via
`.github/workflows/deploy.yml`) and point them at your API URL via
`NEXT_PUBLIC_API_URL` at build time.

### Deploy steps

```bash
cd platform
npm install

# 1. AWS credentials for the target account in your environment,
#    then set every secret BY NAME for your stage (values from your own vault):
npx sst secret set DbMasterPassword    "<value>" --stage <stage>
npx sst secret set JwtSecret           "<value>" --stage <stage>
npx sst secret set EncryptionMasterKey "<value>" --stage <stage>   # any high-entropy secret; SHA-256-normalized to a 32-byte key; API fails closed if empty
npx sst secret set AnthropicApiKey     "<value>" --stage <stage>
npx sst secret set SmtpPass            "<value>" --stage <stage>
npx sst secret set WebhookSigningSecret "<value>" --stage <stage>
npx sst secret set GoogleClientId      "<value>" --stage <stage>
npx sst secret set GoogleClientSecret  "<value>" --stage <stage>
npx sst secret set RazorpayKeyId       "<value>" --stage <stage>
npx sst secret set RazorpayKeySecret   "<value>" --stage <stage>
npx sst secret set RazorpayWebhookSecret "<value>" --stage <stage>

# 2. Deploy the stage
npx sst deploy --stage <stage>

# 3. Run migrations (the Lambda name is in the deploy outputs)
aws lambda invoke --function-name <MigrateLambdaName> --region <your-region> /tmp/migrate-out.json
cat /tmp/migrate-out.json    # {"ok":true,...}
```

How to generate safe values for each secret is covered in
[developer/configuration.md](developer/configuration.md) — never commit real values.
Optional integrations (Anthropic, SMTP, Google SSO, Razorpay/Stripe) can be set to
empty strings; the corresponding features no-op.

Stage semantics (from `sst.config.ts`): `prod` is protected (`retain` on removal);
any other stage name tears down cleanly with `npx sst remove --stage <stage>`. A
special `demo` stage deploys only a fixture-data sandbox Lambda (no DB/VPC/queues).
The default region in the config is `ap-south-1` — change it in
`platform/sst.config.ts` for your deployment. A custom domain for the API is wired
via a Cloudflare provider for the `prod` stage; without it, stages serve on the
generated Lambda Function URL.

### Costs to expect

Order-of-magnitude for an idle full stack (region-dependent — verify with the AWS
calculator):

- RDS Postgres (t4g.micro single-AZ): ~$15–25/mo — the biggest fixed cost; scale up
  for real workloads
- NAT (for in-VPC Lambdas' outbound): ~$5–35/mo depending on NAT instance vs gateway
- Lambda / SQS / S3: near zero idle; pay-per-use under load
- ECR storage for the two scanner images: ~$1/mo
- Secrets Manager: ~$0.40/secret/mo (11 secrets ≈ $4.40)

Historical reference points for this exact stack: ~$56/mo staging, ~$80/mo prod
(multi-AZ RDS). `infra/budgets.ts` ships budget alarms — set your own thresholds.

### Operational notes

- CI/CD: `.github/workflows/deploy.yml` is a working reference (staging on push to
  `staging`, prod on push to `main`, with an approval-gated prod environment). It
  needs the repo secrets/variables listed in [REPO_SETUP.md](REPO_SETUP.md).
- Upgrades: pull, `npx sst deploy --stage <stage>`, invoke the migrate Lambda.
  Migrations are tracked by filename and idempotent (see
  [developer/migrations.md](developer/migrations.md)).
- Backups/DR, WAF, and org-level hardening are yours to own — this repo gives you the
  application stack, not a managed service.

## Or skip all of this

The hosted option at [blackfyre.tech](https://blackfyre.tech) is the same codebase,
operated for you.
