<div align="center">

# Blackfyre

**Open-source multi-cloud compliance & security platform**

Scan AWS, Azure, and GCP against 683 controls across 9 compliance frameworks —
with AI-assisted analysis, tamper-evident evidence, and real remediation tracking.

[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![CI](https://github.com/<ORG>/blackfyre/actions/workflows/ci.yml/badge.svg)](https://github.com/<ORG>/blackfyre/actions/workflows/ci.yml)

[Quickstart](#quickstart) · [Docs](#documentation) · [Contributing](CONTRIBUTING.md) · [Security](SECURITY.md) · [Hosted option](https://blackfyre.tech)

</div>

---

## What is Blackfyre?

Blackfyre is a multi-tenant compliance platform that audits your cloud
infrastructure and turns the results into framework-mapped compliance posture. It
deploys scanning agents across AWS, Azure, GCP (and on-prem targets), maps every
finding to the controls it affects, scores your posture per framework, and walks
findings through remediation — with evidence you can hand to an auditor.

## Key features

- **Multi-cloud scanning** — 40+ SDK-based auditors (IAM, storage, compute,
  networking, encryption, logging) plus Prowler and IaC scanning
  (Checkov/Semgrep/Bandit) as containerized scanners
- **9 compliance frameworks, 683 controls** — SOC 2, ISO 27001, HIPAA, GDPR,
  PCI-DSS, DPDPA, ISO 42001, PDPPL, NIST, with weighted control scoring
- **AI-assisted analysis** — gap analysis, MITRE ATT&CK mapping, remediation
  suggestions, and a security copilot (Claude via Anthropic API or AWS Bedrock);
  every AI feature degrades gracefully to heuristics when no key is configured
- **Evidence vault** — tamper-evident evidence chain with SHA-256 integrity
  verification, Object-Lock-backed storage
- **Real-time monitoring** — configuration drift detection and live scan progress
  over SSE
- **Serious multi-tenancy** — Postgres row-level security enforced below the ORM
  ([ADR-0001](docs/adr/0001-rls-multi-tenancy.md)), per-request tenant-bound
  connections, plan-based feature gating
- **Enterprise auth** — JWT + MFA, Google SSO, SAML, SCIM provisioning, API keys,
  auditor-scoped access

## Quickstart

Full local stack (no cloud account needed) — details in
[docs/developer/local-development.md](docs/developer/local-development.md):

```bash
git clone https://github.com/<ORG>/blackfyre.git && cd blackfyre/platform
docker compose up -d postgres redis localstack
npm install && npm run build
cp packages/api/.env.example packages/api/.env   # then edit per the local-dev guide
npm run db:migrate && npm run dev                # API on :4000
```

Then in two more terminals:

```bash
NEXT_PUBLIC_API_URL=http://localhost:4000 npm run dev --workspace=packages/portal   # :3001
NEXT_PUBLIC_API_URL=http://localhost:4000 npm run dev --workspace=packages/admin    # :3003
```

Log in at http://localhost:3001 with the seeded dev user `admin@acme.com` /
`password123`.

## Architecture

```
        Portal (Next.js)          Admin (Next.js)
           :3001                     :3003
              └───────────┬─────────────┘
                          v
                 REST API (Fastify)  :4000
                 JWT + CSRF + RLS-bound request.db
                          │
        ┌─────────────────┼─────────────────────┐
        v                 v                     v
  PostgreSQL 16      Redis            SQS queues (scan/monitor/AI/evidence + DLQs)
  (row-level         (rate limits,            │
   security)          caching)                v
                                     Workers ──> Scanners
                                     (SQS consumers)  ├─ SDK auditors (in-process)
                                                      └─ Prowler / IaC (container Lambdas)
                                              │
                                              v
                                     S3 evidence vault (Object Lock)
```

Locally, docker-compose provides Postgres/Redis and LocalStack emulates SQS/S3. In
production the same code deploys to AWS (Lambda + RDS + SQS + S3 + KMS) via SST —
see [docs/self-hosting.md](docs/self-hosting.md).

## Documentation

| Doc | What's in it |
|---|---|
| [docs/developer/local-development.md](docs/developer/local-development.md) | Verified 15-minute local setup, seeded logins, troubleshooting |
| [docs/developer/monorepo-map.md](docs/developer/monorepo-map.md) | Every package: what it is, key files, dependency direction |
| [docs/developer/configuration.md](docs/developer/configuration.md) | Every env var and secret, with safe local values |
| [docs/developer/testing.md](docs/developer/testing.md) | Unit / integration / Playwright suites and how to run one test |
| [docs/developer/migrations.md](docs/developer/migrations.md) | Migration ordering, idempotency, RDS gotchas, RLS pattern |
| [docs/developer/api-overview.md](docs/developer/api-overview.md) | Fastify app layout, auth model, how to add an endpoint |
| [docs/self-hosting.md](docs/self-hosting.md) | Local/evaluation vs production-on-AWS (SST), secrets, costs |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Deployment topology and infra invariants |
| [ROADMAP.md](ROADMAP.md) | Near/mid/long-term direction and how to propose work |
| [docs/adr/](docs/adr/) | Architecture decision records ([RLS](docs/adr/0001-rls-multi-tenancy.md), [queues](docs/adr/0002-queue-architecture.md), [scanners](docs/adr/0003-scanner-orchestration.md), [model routing](docs/adr/0004-model-routing.md)) |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Fork-and-PR flow, DCO sign-off, commit style |
| [SECURITY.md](SECURITY.md) | Private vulnerability disclosure |
| [GOVERNANCE.md](GOVERNANCE.md) · [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) | Project governance and conduct |

## Tech stack

Fastify 4 + Drizzle ORM + Zod on Node 20 · Next.js 14 static exports · PostgreSQL 16
with RLS · Redis · SQS · S3 · Anthropic Claude / AWS Bedrock · SST (AWS) ·
GitHub Actions

## License & trademark

Apache-2.0 — see [LICENSE](LICENSE) and [NOTICE](NOTICE). "Blackfyre" and the
Blackfyre logo are trademarks; see [TRADEMARK.md](TRADEMARK.md) for permitted use.

## Hosted option

Don't want to run it yourself? A hosted version is available at
[blackfyre.tech](https://blackfyre.tech).
