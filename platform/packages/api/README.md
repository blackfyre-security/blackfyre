# @blackfyre/api

Backend API for the BLACKFYRE compliance platform.

## Tech Stack

- **Framework:** Fastify
- **ORM:** Drizzle (PostgreSQL / Neon)
- **Auth:** JWT (jose) + MFA (OTP) + Argon2 password hashing
- **Queue:** SQS (scan, monitor, AI, evidence)
- **Storage:** S3 (evidence vault with SHA-256 integrity)
- **AI:** Anthropic Claude API

## API Endpoints (28)

**Core:** health, auth, scans, findings, evidence, compliance, integrations, reports, remediations, alerts

**Advanced:** drift detection, learning patterns, clients, admin, auditors

**AI & Security:** ai-analysis, ai-ethics, threat-intel, policies, confidential-compute, sovereignty, audit-chain, satellite-hardening, mcp, privacy-shield, stakeholder, ot-scada, onprem

## Database

23 tables with Row-Level Security for multi-tenant isolation. Schema in `src/db/schema.ts`, migrations in `src/migrations/`.

## Scanning Agents

40+ agents organized by cloud provider:

- **AWS** (5): IAM, S3, EC2/VPC, CloudTrail, KMS
- **Azure** (5): IAM, Storage, Compute, Network, KeyVault
- **GCP** (4): IAM, Storage, Compute, KMS
- **On-Prem** (4+): Active Directory, Network, SNMP, Endpoint, OT/SCADA

## Development

```bash
npm run dev          # Start on :4000
npm test             # Run all tests (45 files)
npm run test:unit    # Unit tests only
npm run migrate      # Run DB migrations
```

## Demo Mode

`npm run demo` starts a fully mocked API on :4001 with sample data — no database or cloud credentials required.
