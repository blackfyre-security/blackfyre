# BLACKFYRE Platform

Monorepo for the BLACKFYRE SaaS platform. Uses npm workspaces.

## Packages

| Package | Description | Port |
|---------|-------------|------|
| [`@blackfyre/api`](./packages/api/) | Backend API — Fastify + Drizzle ORM | 4000 |
| [`@blackfyre/admin`](./packages/admin/) | Admin dashboard — Next.js | 3003 |
| [`@blackfyre/client`](./packages/portal/) | Client portal — Next.js | 3001 |
| [`@blackfyre/shared`](./packages/shared/) | Shared types, schemas, Tailwind preset | — |
| [`@blackfyre/ui`](./packages/ui/) | Shared React component library | — |
| [`@blackfyre/cli`](./packages/cli/) | CLI tool | — |

## Setup

```bash
# Start local PostgreSQL
npm run db:up

# Install all packages
npm install

# Run migrations
npm run db:migrate

# Start API
npm run dev

# Start frontends (separate terminals)
npm run dev --workspace=packages/admin
npm run dev --workspace=packages/portal
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start API server |
| `npm run build` | Build shared + API |
| `npm test` | Run API tests |
| `npm run db:up` | Start PostgreSQL (Docker) |
| `npm run db:down` | Stop PostgreSQL |
| `npm run db:migrate` | Run database migrations |

## Infrastructure

Defined in `infra/` using [SST](https://sst.dev) (deployed to AWS ap-south-1):

- **API** — Lambda function (Fastify adapter)
- **Queues** — SQS (scan, monitor, AI, evidence)
- **Storage** — S3 (evidence vault)
- **Secrets** — AWS Secrets Manager
- **SSE** — Server-Sent Events endpoint
