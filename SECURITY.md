# Security Policy

## Supported versions

We maintain the latest deployed `main` branch only. There are no historical version branches.

## Reporting a vulnerability

If you've found a security issue in Blackfyre — vulnerability in the platform code, an exploitable bug in the demo, a credential leak, etc. — please **report it privately**. Do not open a public GitHub issue.

Report privately via either:
- Email: **security@blackfyre.tech**
- [GitHub private vulnerability reporting](../../security/advisories/new) for this repo

Include:
- A clear description of the issue and its impact
- Steps to reproduce
- The environment (demo / staging / prod)
- Your name + how you'd like to be credited (or anonymous)

Please do not publicly disclose the issue (blog posts, social media, public issues/PRs)
until we've had a chance to investigate and ship a fix. We follow coordinated
disclosure: once a patch is released, we'll credit you (if you want) in the
advisory and release notes.

## What to expect

| Timeline | Action |
|---|---|
| within 72h | initial acknowledgement |
| within 7 days | triage + severity assessment |
| within 90 days | patch released (sooner for critical / customer-affecting) |
| at patch release | coordinated public disclosure with credit (if you want it) |

Critical issues affecting customer data or auth get same-day attention.

## Scope

**In scope:** the code in this repository.
- Auth bypasses
- IDOR / authorization bugs
- SQL injection
- XSS / CSRF
- SSRF via the scanner Lambdas
- Secret / credential leaks (env vars, S3 bucket exposure, etc.)
- Cross-tenant data leakage
- Cryptographic weaknesses (incl. JWT validation issues)

**Out of scope:**
- The hosted `blackfyre.tech` service itself (infrastructure, hosting config,
  DNS, third-party integrations) — this policy covers vulnerabilities in the
  repo's code, not operational issues with the live service
- Social engineering (phishing, pretexting, etc. against maintainers or users)
- Findings in `sandbox/fake-org/` — that data is intentionally vulnerable, it's a test fixture
- Issues only affecting `demo.blackfyre.tech` that don't impact the real product (e.g., demo allows any password — by design)
- DoS via volumetric attack on the public demo Lambda — we throttle naturally at the Lambda concurrency limit; not a bug
- Auth bypasses that require pre-existing valid credentials (privilege escalation is in scope, replay isn't)

## Security practices

- All data encrypted at rest (AES-256) and in transit (TLS 1.3)
- Multi-tenant isolation via PostgreSQL Row-Level Security
- JWT authentication with MFA support
- Automated dependency scanning (Dependabot + GitHub secret scanning)
- Secrets stored in AWS Secrets Manager (per-stage), never in code

## Compliance

Blackfyre maintains compliance with:
- SOC 2 Type II (in progress)
- ISO 27001:2022 (planned)
- GDPR
- DPDPA 2023

## Hall of fame

(We'd love to add you here. Be the first.)
