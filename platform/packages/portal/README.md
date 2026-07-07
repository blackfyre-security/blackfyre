# @blackfyre/client (Portal)

Client-facing portal for BLACKFYRE compliance management.

## Pages (18)

- **Dashboard** — Compliance overview, recent scans, finding summary
- **Onboarding** — 4-step wizard (company, credentials, scan config, launch)
- **Findings** — Security findings with severity/status filtering
- **Compliance** — Framework scores, control matrix
- **Remediation** — Auto/approval/manual tier tracking
- **Evidence** — Evidence vault with upload and integrity verification
- **Monitoring** — Drift detection, configuration change tracking
- **Scans Config** — Framework selection, scan frequency
- **Reports** — Generate readiness, evidence, board summary, gap analysis
- **AI Ethics** — AIBOM, SBOM, bias assessments
- **Trust** — Trust score, sovereignty, data residency
- **Privacy** — Privacy shield dashboard
- **Clients** — Enterprise client management
- **Team** — Member invite, role-based access
- **Integrations** — AWS, Azure, GCP, Okta connection management
- **Settings** — Profile, notifications, API keys
- **Insights** — Industry benchmarking

## Development

```bash
npm run dev          # http://localhost:3001
npm run build
npm run lint
```

Requires `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_SSE_URL` for live scan streaming.

## Deployment

Cloudflare Pages via `@cloudflare/next-on-pages`. See `wrangler.toml`.
