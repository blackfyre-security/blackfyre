# ADR-0002: Queue architecture — SQS with DLQs, one queue per job class

Status: accepted

## Context

Scans run minutes to hours (a hard 4-hour cap), AI analysis takes tens of seconds,
evidence collection and monitoring are bursty. None of that belongs in an HTTP
request. We needed durable background work that (a) fits the serverless deployment
(API on Lambda — no resident process to host an in-memory queue), (b) retries safely,
and (c) can't lose or leak jobs. An earlier iteration used BullMQ on Redis; remnants
of that live in `src/queue/scan-queue.ts` (job payload types + a legacy worker) — but
Redis-backed queues would require an always-on worker fleet and make Redis a
durability dependency, which fights the Lambda model.

## Decision

**AWS SQS, four queues by job class, each with a dead-letter queue** (`infra/queues.ts`):

| Queue | Worker | Visibility timeout |
|---|---|---|
| ScanJobsQueue | `workers/scan-worker.ts` (1024 MB, 15 min) | 15 min |
| MonitorJobsQueue | `workers/monitor-worker.ts` | 5 min |
| AiJobsQueue | `workers/ai-worker.ts` | 10 min |
| EvidenceJobsQueue | `workers/evidence-worker.ts` | 5 min |

Each queue redrives to its DLQ after 3 failed receives. Producers go through the thin
`SqsQueue` wrapper (`src/queue/sqs-client.ts`), which fails loudly when a queue URL
is unconfigured. Workers are Lambda handlers subscribed to the queues in production;
locally and in docker-compose, the identical handlers run under `workers/poller-*.ts`
long-poll runners (LocalStack emulates SQS via `SQS_ENDPOINT`), with per-message
acknowledgement so one failing message doesn't redeliver the whole batch.

Two payload rules are load-bearing:
- **No secret material on a queue** — payloads carry references (integration ids,
  `vault://`/ARN pointers) or an AES-256-GCM `SecretEnvelope`; workers decrypt at run
  time (`src/queue/scan-queue.ts` documents the contract).
- Job types stay in `packages/api/src/queue/` so producers and workers share one
  definition.

## Consequences

- Zero idle worker cost (SQS-triggered Lambdas) and per-class tuning of
  memory/timeouts; a poison message parks in a DLQ instead of blocking a queue.
- SQS is at-least-once: every worker must be idempotent (e.g. findings upsert on a
  unique `(tenant_id, dedup_hash)` key rather than insert).
- Separate queue classes mean a scan storm can't starve evidence or AI jobs.
- Local dev needs LocalStack (compose provides it); the API still boots with queues
  unconfigured — enqueueing then throws per call.
- The vestigial BullMQ code remains until fully retired; new job types should follow
  the SQS path only.
