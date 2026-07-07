# ADR-0003: Scanner orchestration — in-process SDK agents + container Lambdas for heavy tools

Status: accepted

## Context

A scan fans out across clouds and check types. Two very different kinds of scanner
exist:

1. **SDK auditors** — TypeScript agents that call cloud APIs directly (AWS SDK, Azure
   ARM, Google Cloud clients) and evaluate findings in code. Dozens of them, small,
   fast, easy to unit-test.
2. **Heavyweight OSS tools** — Prowler (a ~700 MB Python install) and the IaC tool
   chain (Checkov/Semgrep/Bandit). Enormous value, but impossible to bundle into a
   normal Node Lambda zip and unreasonable to port.

We needed both under one orchestration model without forcing the heavy tools'
runtime onto the API.

## Decision

- **SDK scanners run in-process in the scan worker.** `agents/swarm-orchestrator.ts`
  fans out the per-cloud auditors (`src/agents/aws|azure|gcp|…`), streams findings to
  the DB as they arrive (`onFinding`), and tolerates per-agent failure — one agent
  erroring doesn't kill the scan.
- **Prowler and the IaC scanner run as container-image Lambdas**
  (`infra/scanners.ts`, Dockerfiles under `infra/containers/`). Container
  `packageType` is the only Lambda packaging that accepts them; each gets its own
  ECR repo, memory/timeout profile, and IAM role. The scan worker invokes them by
  ARN (`PROWLER_SCANNER_ARN`, `IAC_SCANNER_ARN`) and they write results (OCSF/SARIF)
  to the scan-artifacts S3 bucket (7-day lifecycle) for the worker to ingest.
- Scan-level guarantees live in the worker, not the scanners: the 4-hour hard
  timeout race, scan status transitions, findings dedup/upsert, and compliance
  rescoring after ingest.

## Consequences

- Adding a check to an existing cloud is a small TS change with unit tests; adding a
  whole new tool means a new container Lambda — significant, but isolated from the
  API runtime.
- Container scanners cost nothing idle (Lambda) but pay cold-start + image-pull on
  first invoke; they're sized per tool rather than inflating the worker's memory.
- Findings from external tools normalize through the same ingest path as SDK
  findings, so scoring/dedup/RLS treat them identically.
- Local dev limitation: the container scanners aren't wired into docker-compose —
  SDK scanners work locally, Prowler/IaC require a deployed stage (on the roadmap).
- The stable finding contract this creates is the seed of the future scanner plugin
  API ([ROADMAP.md](../../ROADMAP.md)).
