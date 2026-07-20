# BLACKFYRE Architecture

> Single-page overview. For exhaustive detail on each layer, see:
> - [self-hosting.md](self-hosting.md) — what gets provisioned on AWS and how to deploy it
> - [DEPLOYMENT.md](DEPLOYMENT.md) — how to deploy each environment
> - [developer/configuration.md](developer/configuration.md) — every env var and secret, and how to source safe values

---

## Three environments, three identical-but-sized stacks

| Env | URL prefix | What runs | Cost/mo idle |
|---|---|---|---|
| **demo** | `demo.blackfyre.tech` | Public sandbox, fixture data, no DB | ~$0 |
| **staging** | `*-staging.blackfyre.tech` | Pre-prod, real DB (test data), internal use | ~$56 |
| **prod** | `*.blackfyre.tech` | Live customers (NOT YET DEPLOYED) | ~$80 |

All three use the **same Next.js source code** + **same Fastify API code** + **same SST infra definitions**. The only differences are:
- demo runs a separate Lambda handler that reads fixture JSON instead of hitting RDS
- staging vs prod size their AWS resources differently (RDS micro vs medium, single-AZ vs multi-AZ, etc.)

---

## High-level topology

```
                ┌─ blackfyre.tech ──── Cloudflare Pages ─── blackfyre (marketing site, Next.js static)
                │
       browsers ┼─ demo.blackfyre.tech ────────────────── blackfyre-portal-demo
                │                                              │
                │                                              ▼
                │                                         BlackfyreDemoApi
                │                                       (1 Lambda, no DB)
                │                                              │
                │                                              ▼
                │                                       scan-bundle.json
                │                                       (baked into zip)
                │
                ├─ app-staging.blackfyre.tech ──────────── blackfyre-portal-staging
                │                                              │
                │                                              ▼
                │                                         BlackfyreApi   ◀──┐
                │                                       BlackfyreSse       │
                │                                       4 worker Lambdas   │
                │                                       2 scanner Lambdas  │
                │                                              │           │
                │                                              ▼           │
                │                                       VPC (10.0/16)      │
                │                                       NAT GW + IGW       │
                │                                              │           │
                │                                              ▼           │
                │                                       RDS Postgres 16    │
                │                                       4 SQS queues       │
                │                                       2 S3 buckets       │
                │                                       11 SST secrets     │
                │                                                          │
                ├─ app.blackfyre.tech ────────────── blackfyre-portal      │
                │                                                          │
                │                                       (same as staging,  │
                │                                       sized up for prod) │
                │                                                          │
                ↑                                                          │
               (DNS via Cloudflare zone blackfyre.tech)         (--stage staging / prod)
```

---

## What deploys where

**Frontend** (portal, marketing site) → **Cloudflare Pages**, static export only.

**Backend** (API, SSE, workers, scanners, DB) → **AWS Lambda + RDS + SQS + S3** via SST.

**DNS** → **Cloudflare zone** `blackfyre.tech` (we own it on Cloudflare).

No ECS, no EC2, no ALB, no Terraform — all gone as of 2026-05-11.

---

## Why this shape

1. **Static frontend** → CF Pages is free CDN-cached HTML; zero MAU cost on free tier; instant DNS-anycast globally. Frontend never needs server compute.

2. **API on Lambda** → pay-per-request, zero idle cost, scales to zero. Cold-start ~600ms is acceptable for a B2B compliance product.

3. **Workers on SQS-triggered Lambda** → no Fargate-running-24/7 (~$120/mo savings vs ECS). Workers fire only when a scan/AI/evidence job is queued.

4. **Scanners as container Lambdas** → Prowler is a 700MB Python install; container packageType is the only way Lambda accepts it. Container scanners get their own ECR repos.

5. **RDS in VPC** → DB needs IAM-isolated network. Lambdas attached to same VPC reach RDS via private subnets. NAT GW for outbound internet from in-VPC Lambdas.

6. **Demo = separate Lambda function** → physically isolated from prod. Cannot accidentally leak real customer data (no IAM grant, no DB connection, no VPC attachment).

---

## Key invariants

1. **Frontend is static export.** Never reintroduce `middleware.ts`, `app/api/*/route.ts`, `"use server"`, or change `next.config.mjs` away from `output: "export"`. See `CONTRIBUTING.md` for why.

2. **Demo data is fixture, regenerated not hand-edited.** `sandbox/fake-org/scan-bundle.json` is rebuilt by `sandbox/fake-org/cross-cutting/run-all.sh`.

3. **CORS lives at one layer per env.** In Lambda → Lambda Function URL CORS config (`infra/api.ts` `url.cors`). In local dev → Fastify `@fastify/cors`. `app.ts` skips Fastify cors when `AWS_LAMBDA_FUNCTION_NAME` is set so headers don't duplicate.

4. **`AWS_REGION` and `AWS_LAMBDA_FUNCTION_NAME` are reserved.** Lambda runtime sets them; never include in `environment:` Function config.

5. **No stray AWS resources.** Migrations include teardown of the old version. Old Terraform stack was destroyed when SST stack came up — same expected for future migrations.

---

## Tech stack summary

| Layer | Tech | Notes |
|---|---|---|
| Frontend (portal) | Next.js 14 (App Router, `output: "export"`) + Tailwind + React | Static HTML/JS only |
| Marketing site | Next.js 14 static | Lives in `/website` |
| API | Fastify 4 + Drizzle ORM + postgres-js | Wrapped by `@fastify/aws-lambda` |
| Workers | Fastify-less Lambda handlers | SQS-triggered |
| Scanners | Python 3.12 (Prowler) + Python 3.12 (Checkov/Semgrep/Bandit) | Container Lambdas via `@pulumi/docker-build` |
| Auth | JWT (jose) + Argon2id (`@node-rs/argon2`) | Rust-based Argon2 for cross-platform |
| Database | RDS Postgres 16 | Multi-AZ on prod |
| Queues | AWS SQS (4 + 4 DLQs) | DLQ retries=3 |
| Object store | AWS S3 with Object Lock + versioning | Evidence GOVERNANCE 1d staging / COMPLIANCE 7y prod |
| Secrets | AWS Secrets Manager via SST | One secret per key, per stage |
| IaC | SST 4.13 (Pulumi underneath) | `platform/sst.config.ts` + `platform/infra/*.ts` |
| DNS + CDN + TLS | Cloudflare | Zone `blackfyre.tech` |
| CI/CD | GitHub Actions | `.github/workflows/{ci,deploy,dependabot-auto-merge}.yml` |
| Sandbox/demo data | TypeScript generators → JSON fixture | `sandbox/fake-org/cross-cutting/` |
