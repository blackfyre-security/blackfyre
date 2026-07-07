#!/bin/bash
# LocalStack ready hook — creates the 4 SQS queues + DLQs that production
# wires up via SST. Runs inside the localstack container at startup.

set -euo pipefail

echo "[localstack-init] creating SQS queues"

create() {
  local name="$1"
  awslocal sqs create-queue --queue-name "$name" >/dev/null
  echo "[localstack-init]   ✓ $name"
}

create ScanJobsQueue
create ScanJobsDLQ
create MonitorJobsQueue
create MonitorJobsDLQ
create AiJobsQueue
create AiJobsDLQ
create EvidenceJobsQueue
create EvidenceJobsDLQ

echo "[localstack-init] creating S3 buckets"
awslocal s3 mb s3://blackfyre-evidence-local >/dev/null
awslocal s3 mb s3://blackfyre-scan-artifacts-local >/dev/null
echo "[localstack-init]   ✓ blackfyre-evidence-local, blackfyre-scan-artifacts-local"

echo "[localstack-init] done"
