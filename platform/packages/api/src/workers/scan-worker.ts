import type { SQSEvent, SQSRecord } from "aws-lambda";
import type { ScanJobData } from "../queue/scan-queue.js";
import { createDb } from "../db/connection.js";
import { loadConfig } from "../config.js";
import { ScanService } from "../services/scan-service.js";
import { FindingService } from "../services/finding-service.js";
import { ComplianceService } from "../services/compliance-service.js";
import { SwarmOrchestrator } from "../agents/swarm-orchestrator.js";
import { SqsQueue } from "../queue/sqs-client.js";

// SECURITY FIX (BLACKFYRE audit 2026-06-05): scan-cred-resolution — minimal structured
// logger shape (Fastify/pino compatible). The Lambda SQS worker has no Fastify/pino
// instance, so we use a console-backed structured logger to keep credential-resolution and
// decrypt-failure events auditable. Never log the secret itself.
type Logger = {
  info: (obj: unknown, msg?: string) => void;
  warn: (obj: unknown, msg?: string) => void;
};

const consoleLogger: Logger = {
  info: (obj, msg) => console.log(JSON.stringify({ level: "info", msg, ...(obj as object) })),
  warn: (obj, msg) => console.warn(JSON.stringify({ level: "warn", msg, ...(obj as object) })),
};

export async function handler(event: SQSEvent): Promise<void> {
  for (const record of event.Records) {
    await processScanJob(record);
  }
}

async function processScanJob(record: SQSRecord): Promise<void> {
  const { data } = JSON.parse(record.body) as { jobName: string; data: ScanJobData };
  // SECURITY FIX (BLACKFYRE audit 2026-06-05): scan-cred-resolution — pull repoSource off
  // the job so the orchestrator can decrypt its envelope at run time (creds are no longer on
  // the queue in plaintext).
  const { scanId, tenantId, frameworks, integrations, scanTypes, repoSource } = data;

  const config = loadConfig();
  const { db } = createDb(config);
  // SECURITY FIX (BLACKFYRE audit 2026-06-05): scan-cred-resolution — pass the structured
  // logger so ScanService.resolveCredentialRef() records credential access (never secrets).
  const scanService = new ScanService(db, new SqsQueue<ScanJobData>(config.SCAN_QUEUE_URL), consoleLogger);
  const findingService = new FindingService(db);
  const complianceService = new ComplianceService(db);
  const orchestrator = new SwarmOrchestrator();

  try {
    const swarmId = `swarm_${scanId}`;
    await scanService.markRunning(scanId, swarmId);

    // SECURITY FIX (BLACKFYRE audit 2026-06-05): scan-cred-resolution — forward repoSource +
    // logger so the orchestrator reconstructs plaintext credentials from the on-queue
    // envelopes before building agent context. Without this, agents read undefined creds.
    const result = await orchestrator.runSwarm({
      scanId,
      tenantId,
      frameworks,
      scanTypes,
      integrations,
      repoSource,
      log: consoleLogger,
      onFinding: async (finding, _agentType, _integrationId) => {
        await findingService.createFromAgent(scanId, tenantId, finding);
      },
      onProgress: async (overallPercent) => {
        await scanService.updateProgress(scanId, overallPercent);
      },
      onAgentComplete: async (agentResult) => {
        console.log(`[scan-worker] Agent ${agentResult.agentType} complete: ${agentResult.findingsCount} findings`);
      },
      onAgentError: async (agentType, error) => {
        console.error(`[scan-worker] Agent ${agentType} error: ${error}`);
      },
    });

    const hasErrors = result.agentResults.some((r) => r.error !== null);
    await scanService.markCompleted(scanId, hasErrors);
    await complianceService.snapshotScores(tenantId, scanId);

    // REAL IMPL (BLACKFYRE 2026-06): scan->alert hook. Fire the alert engine with the scan's
    // REAL completion context (new-findings count + per-framework compliance score) so
    // scan-completion can actually trigger notifications. Guarded so any alert failure is
    // logged (structured, no secrets) and NEVER fails the scan.
    try {
      let scores: Array<{ framework: string; score: number }> = [];
      try {
        scores = (await complianceService.getScores(tenantId, scanId)) as Array<{
          framework: string;
          score: number;
        }>;
      } catch (scoreErr) {
        consoleLogger.warn(
          {
            event: "scan.alert.score_resolve_failed",
            tenantId,
            scanId,
            reason: scoreErr instanceof Error ? scoreErr.message : String(scoreErr),
          },
          "alert engine: could not resolve compliance score; evaluating without score context",
        );
      }
      const lowestScore = scores.length ? Math.min(...scores.map((s) => s.score)) : null;

      const { AlertService } = await import("../services/alert-service.js");
      const alertService = new AlertService(db);

      consoleLogger.info(
        {
          event: "scan.alert.evaluate",
          tenantId,
          scanId,
          findingsCount: result.totalFindings,
          lowestFrameworkScore: lowestScore,
          frameworkCount: scores.length,
        },
        "firing alert engine on scan completion with real findings/score context",
      );

      // REAL IMPL (BLACKFYRE 2026-06): fire the alert engine on scan completion.
      // evaluateRules self-fetches this scan's findings + compliance scores from the
      // DB, evaluates every enabled rule, and dispatches matches to their channels.
      await alertService.evaluateRules(tenantId, scanId);
    } catch (alertErr) {
      consoleLogger.warn(
        {
          event: "scan.alert.evaluate_failed",
          tenantId,
          scanId,
          reason: alertErr instanceof Error ? alertErr.message : String(alertErr),
        },
        "alert engine failed on scan completion (non-fatal; scan remains completed)",
      );
    }

    console.log(`[scan-worker] Scan ${scanId} complete: ${result.totalFindings} findings, ${hasErrors ? "partial" : "full"}`);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error(`[scan-worker] Scan ${scanId} failed:`, errorMessage);
    await scanService.markFailed(scanId, errorMessage);
  }
}
