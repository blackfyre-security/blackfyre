# Roadmap

Where Blackfyre is headed as an open project. This is a statement of intent, not a
contract — priorities move with contributor energy and user feedback. Items reference
GitHub issues where they exist; propose changes by opening an issue.

## Near term

**Harden the local-dev and contributor experience**
- Keep the [15-minute local setup](docs/developer/local-development.md) honest — every
  release must pass a fresh-clone walkthrough
- Fix the integration-test/docker-compose environment mismatch so `npm test` works
  against the compose services without manual `DATABASE_URL` overrides
- Bring the full integration suite to a green, CI-enforced baseline (today only the
  unit suite gates PRs — see [docs/developer/testing.md](docs/developer/testing.md))

**First community releases**
- Tagged, changelogged releases with upgrade notes (migrations are already
  filename-tracked and idempotent)
- Prebuilt container images for api/workers/portal/admin so evaluation doesn't
  require a local build

**Scanner coverage**
- Deepen AWS/Azure/GCP auditor coverage (more services per cloud, more checks per
  service) and keep the control catalog in `packages/shared/src/constants/frameworks`
  current
- Local story for the Prowler/IaC container scanners (today they're wired for
  Lambda only)

## Mid term

**Plugin API for scanners**
- A documented interface so third-party scanners can register findings without
  forking `packages/api/src/agents/` — the swarm orchestrator already treats agents
  uniformly; the work is stabilizing that contract and loading external ones safely

**More compliance frameworks**
- Beyond the shipped nine (SOC 2, ISO 27001, HIPAA, GDPR, PCI-DSS, DPDPA, ISO 42001,
  PDPPL, NIST): community-requested frameworks land as data (control catalogs +
  mappings) rather than code, which makes them a great first contribution

**Deployment breadth**
- A supported non-AWS production path (plain containers + Postgres + Redis + any
  S3-compatible store) so self-hosters aren't tied to Lambda/SQS
- Terraform/OpenTofu reference for teams that can't adopt SST

## Longer term / exploratory

- Continuous (agent-based) evidence collection beyond point-in-time scans
- Auditor-facing workflow: scoped read-only access is in the product; the export and
  attestation trail around it can go much further
- Multi-region / data-residency-aware deployments (the tenant geo-pinning primitives
  exist in the encryption layer)

## How to propose something

Open a GitHub issue describing the problem (not just the feature), the users it
affects, and — if you want to build it — a sketch of the approach. Architectural
context lives in [docs/adr/](docs/adr/) and [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md);
matching an existing ADR (or writing a new one) is the fastest way to get a design
agreed. See [CONTRIBUTING.md](CONTRIBUTING.md) for the PR flow.
