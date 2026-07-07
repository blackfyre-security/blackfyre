# @blackfyre/admin

Admin dashboard for BLACKFYRE platform operators.

## Pages (11)

- **Command Center** — Real-time stats, client health, system monitoring
- **Clients** — Client onboarding, plans, compliance scores
- **Users** — Admin users, roles, MFA status
- **Scans** — Scan management, agent coordination
- **Findings** — Severity filtering, bulk actions, CSV export
- **Compliance** — Framework scorecards, leaderboard
- **Billing** — MRR dashboard, invoices, plan breakdown
- **Audit Logs** — Activity trail with 9 action categories
- **Reports** — Generate readiness, gap analysis, board summary, evidence packages
- **Settings** — Frameworks, agents, notifications, security, platform config
- **AI Governance** — Ethics alerts, decision audit trail, bias monitoring

## Development

```bash
npm run dev          # http://localhost:3003
npm run build
npm run lint
```

Requires `NEXT_PUBLIC_API_URL` (defaults to `http://localhost:4001`).

## Deployment

Cloudflare Pages via `@cloudflare/next-on-pages`. See `wrangler.toml`.
