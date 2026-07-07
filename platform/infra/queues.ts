import { storage } from "./storage.js";
import { secrets } from "./secrets.js";
import { vpc } from "./network.js";
import { database } from "./database.js";

const workerEnv = {
  NODE_ENV: "production",
  DATABASE_URL: database.url,
  JWT_SECRET: secrets.jwtSecret.value,
  EVIDENCE_BUCKET: storage.evidenceBucket.name,
  ANTHROPIC_API_KEY: secrets.anthropicApiKey.value,
  ENCRYPTION_MASTER_KEY: secrets.encryptionMasterKey.value,
};

// DLQs declared separately to avoid circular reference in SST serialization
const scanDlq = new sst.aws.Queue("ScanJobsDLQ");
const monitorDlq = new sst.aws.Queue("MonitorJobsDLQ");
const aiDlq = new sst.aws.Queue("AiJobsDLQ");
const evidenceDlq = new sst.aws.Queue("EvidenceJobsDLQ");

export const queues = {
  scanQueue: new sst.aws.Queue("ScanJobsQueue", {
    visibilityTimeout: "15 minutes",
    dlq: { queue: scanDlq.arn, retry: 3 },
  }),
  monitorQueue: new sst.aws.Queue("MonitorJobsQueue", {
    visibilityTimeout: "5 minutes",
    dlq: { queue: monitorDlq.arn, retry: 3 },
  }),
  aiQueue: new sst.aws.Queue("AiJobsQueue", {
    visibilityTimeout: "10 minutes",
    dlq: { queue: aiDlq.arn, retry: 3 },
  }),
  evidenceQueue: new sst.aws.Queue("EvidenceJobsQueue", {
    visibilityTimeout: "5 minutes",
    dlq: { queue: evidenceDlq.arn, retry: 3 },
  }),
};

queues.scanQueue.subscribe({
  handler: "packages/api/src/workers/scan-worker.handler",
  timeout: "15 minutes",
  memory: "1024 MB",
  vpc,
  environment: workerEnv,
  // Cap CloudWatch log growth — 14-day retention on the managed log group.
  logging: { retention: "2 weeks" },
  permissions: [
    {
      actions: ["sts:AssumeRole"],
      resources: ["arn:aws:iam::*:role/blackfyre-*"],
    },
  ],
});
queues.monitorQueue.subscribe({
  handler: "packages/api/src/workers/monitor-worker.handler",
  timeout: "5 minutes",
  memory: "512 MB",
  vpc,
  environment: workerEnv,
  // Cap CloudWatch log growth — 14-day retention on the managed log group.
  logging: { retention: "2 weeks" },
});
queues.aiQueue.subscribe({
  handler: "packages/api/src/workers/ai-worker.handler",
  timeout: "10 minutes",
  memory: "512 MB",
  vpc,
  environment: workerEnv,
  // Cap CloudWatch log growth — 14-day retention on the managed log group.
  logging: { retention: "2 weeks" },
});
queues.evidenceQueue.subscribe({
  handler: "packages/api/src/workers/evidence-worker.handler",
  timeout: "5 minutes",
  memory: "512 MB",
  vpc,
  environment: workerEnv,
  // Cap CloudWatch log growth — 14-day retention on the managed log group.
  logging: { retention: "2 weeks" },
});
