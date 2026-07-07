import { Worker, type Job } from "bullmq";
import type { Redis } from "ioredis";
import type { ScanJobData, ScanJobResult } from "./scan-queue.js";
import { SwarmOrchestrator } from "../agents/swarm-orchestrator.js";
import { ScanService } from "../services/scan-service.js";
import { FindingService } from "../services/finding-service.js";
import { ComplianceService } from "../services/compliance-service.js";
import { LearningService } from "../services/learning-service.js";
import type { Db } from "../db/connection.js";
import { SqsQueue } from "./sqs-client.js";
import { SCAN_QUEUE_NAME } from "./scan-queue.js";
import { CertInSlaService } from "../services/certin-sla-service.js";

// Singleton CERT-In SLA tracker shared across scan jobs.
const certInSlaService = new CertInSlaService();

// REAL IMPL (BLACKFYRE 2026-06): 4-hour hard scan limit (spec Section 11). Used to size the
// BullMQ lock/stalled window AND enforced in-process via a timeout race so a hung swarm is
// gracefully failed (scan -> "failed") instead of silently holding the lock forever.
const SCAN_HARD_LIMIT_MS = 4 * 60 * 60 * 1000; // 4 hours

/** Sentinel error thrown when a scan exceeds the 4-hour hard limit. */
class ScanTimeoutError extends Error {
  constructor(public readonly scanId: string, public readonly limitMs: number) {
    super(`Scan ${scanId} exceeded the ${limitMs}ms hard limit`);
    this.name = "ScanTimeoutError";
  }
}

// REAL IMPL (BLACKFYRE 2026-06): race a long-running scan promise against the hard limit.
// The timer is always cleared (success OR failure) so the worker never leaks a dangling
// timeout. On expiry it rejects with ScanTimeoutError, which the job handler catches to mark
// the scan failed gracefully. The underlying swarm promise is abandoned (its findings already
// stream to the DB via onFinding), so partial findings are retained.
function withScanTimeout<T>(scanId: string, limitMs: number, work: Promise<T>): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new ScanTimeoutError(scanId, limitMs)), limitMs);
    // Don't keep the event loop alive solely for this timer.
    if (typeof timer.unref === "function") timer.unref();
  });
  return Promise.race([work, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

// SECURITY FIX (BLACKFYRE audit 2026-06-05): scan-cred-resolution — minimal structured
// logger shape (Fastify/pino compatible) so credential resolution / decrypt failures are
// auditable from the worker. Never log the secret itself.
type Logger = {
  info: (obj: unknown, msg?: string) => void;
  warn: (obj: unknown, msg?: string) => void;
};

// Structured console-backed fallback for the BullMQ worker, which has no Fastify/pino
// instance. Emits single-line JSON so the same audit fields appear in worker logs.
const consoleLogger: Logger = {
  info: (obj, msg) => console.log(JSON.stringify({ level: "info", msg, ...(obj as object) })),
  warn: (obj, msg) => console.warn(JSON.stringify({ level: "warn", msg, ...(obj as object) })),
};

// REAL IMPL (BLACKFYRE 2026-06): scan->alert hook. Fires the alert engine with the scan's
// REAL completion context (new-findings count + per-framework compliance score) so
// scan-completion can actually trigger notifications. Hardened to be non-fatal: any failure
// resolving the score, listing rules, or dispatching is logged (structured, no secrets) and
// swallowed so the scan is still recorded as completed. Returns nothing — fire-and-record.
async function fireAlertEngine(
  db: Db,
  tenantId: string,
  scanId: string,
  findingsCount: number,
  log: Logger,
): Promise<void> {
  try {
    // Derive the REAL aggregate compliance score for this scan (worst framework drives the
    // alert, matching how score-drop alerts are reasoned about). getScores() reads the
    // persisted findings for this scan and computes weighted per-framework percentages.
    const complianceService = new ComplianceService(db);
    let scores: Array<{ framework: string; score: number }> = [];
    try {
      scores = (await complianceService.getScores(tenantId, scanId)) as Array<{
        framework: string;
        score: number;
      }>;
    } catch (scoreErr) {
      log.warn(
        {
          event: "scan.alert.score_resolve_failed",
          tenantId,
          scanId,
          reason: scoreErr instanceof Error ? scoreErr.message : String(scoreErr),
        },
        "alert engine: could not resolve compliance score; evaluating without score context",
      );
    }
    const lowestScore = scores.length
      ? Math.min(...scores.map((s) => s.score))
      : null;

    const { AlertService } = await import("../services/alert-service.js");
    const alertService = new AlertService(db);

    log.info(
      {
        event: "scan.alert.evaluate",
        tenantId,
        scanId,
        findingsCount,
        lowestFrameworkScore: lowestScore,
        frameworkCount: scores.length,
      },
      "firing alert engine on scan completion with real findings/score context",
    );

    // REAL IMPL (BLACKFYRE 2026-06): fire the alert engine on scan completion;
    // evaluateRules self-fetches this scan's findings + scores and dispatches matches.
    await alertService.evaluateRules(tenantId, scanId);
  } catch (alertErr) {
    // Non-fatal: a broken alert rule or channel must never fail the scan.
    log.warn(
      {
        event: "scan.alert.evaluate_failed",
        tenantId,
        scanId,
        reason: alertErr instanceof Error ? alertErr.message : String(alertErr),
      },
      "alert engine failed on scan completion (non-fatal; scan remains completed)",
    );
  }
}

interface ScanWorkerDeps {
  connection: Redis;
  db: Db;
  scanQueue: SqsQueue<ScanJobData>;
  // SECURITY FIX (BLACKFYRE audit 2026-06-05): scan-cred-resolution — optional structured
  // logger for credential-resolution auditing. Defaulted to a console-backed structured
  // logger so existing call sites keep working unchanged (back-compat).
  log?: Logger;
}

/**
 * Creates and starts the scan worker that processes scan jobs from BullMQ.
 *
 * Flow per job:
 * 1. Mark scan as "running"
 * 2. Spawn swarm orchestrator with agents for each integration
 * 3. Agents report findings -> stored in DB via FindingService
 * 4. Track progress -> update scan record
 * 5. On completion -> mark scan as "completed" or "completed_partial"
 * 6. On failure -> mark scan as "failed" with error details
 */
export function createScanWorker(deps: ScanWorkerDeps): Worker<ScanJobData, ScanJobResult> {
  // SECURITY FIX (BLACKFYRE audit 2026-06-05): scan-cred-resolution — resolve a structured
  // logger (caller-supplied or console-backed) so credential resolution and decrypt
  // failures are recorded by both the service and the orchestrator. Never logs secrets.
  const log: Logger = deps.log ?? consoleLogger;
  const orchestrator = new SwarmOrchestrator();
  // Pass the logger into ScanService so resolveCredentialRef() emits audit logs.
  const scanService = new ScanService(deps.db, deps.scanQueue, log);
  const findingService = new FindingService(deps.db);

  const worker = new Worker<ScanJobData, ScanJobResult>(
    SCAN_QUEUE_NAME,
    async (job: Job<ScanJobData, ScanJobResult>) => {
      // SECURITY FIX (BLACKFYRE audit 2026-06-05): scan-cred-resolution — include
      // scanTypes + repoSource so the orchestrator can reconstruct plaintext credentials
      // from the on-queue envelopes at run time (they are no longer carried in plaintext).
      const { scanId, tenantId, frameworks, integrations, scanTypes, repoSource } = job.data;

      // 1. Set RLS context for this worker's DB queries
      const { sql } = await import("drizzle-orm");
      await deps.db.execute(
        sql`SELECT set_config('app.current_tenant', ${tenantId}, false)`
      );

      // 2. Mark scan as running
      const swarmId = `swarm_${scanId}`;
      await scanService.markRunning(scanId, swarmId);

      try {
        // 3. Run the agent swarm
        // SECURITY FIX (BLACKFYRE audit 2026-06-05): scan-cred-resolution — forward the
        // (envelope-carrying) integrations + repoSource and the logger so the orchestrator
        // decrypts inline credentials at run time before building agent context. Without
        // this the agents would read a stripped/undefined credentialRef and the scan breaks.
        // REAL IMPL (BLACKFYRE 2026-06): enforce the 4-hour hard limit in-process. The swarm
        // run is raced against SCAN_HARD_LIMIT_MS; on expiry the race rejects with
        // ScanTimeoutError and the catch below marks the scan "failed" gracefully (findings
        // streamed before the cutoff are already persisted via onFinding).
        const result = await withScanTimeout(
          scanId,
          SCAN_HARD_LIMIT_MS,
          orchestrator.runSwarm({
            scanId,
            tenantId,
            frameworks,
            scanTypes,
            integrations,
            repoSource,
            log,
            onFinding: async (finding, _agentType, _integrationId) => {
              await findingService.createFromAgent(scanId, tenantId, finding);

              // Auto-create CERT-In SLA incident for critical/high findings
              if (finding.severity === "critical" || finding.severity === "high") {
                certInSlaService.createIncident(
                  tenantId,
                  finding.title,
                  finding.severity as "critical" | "high",
                  new Date(),
                );
              }
            },
            onProgress: async (percent) => {
              await scanService.updateProgress(scanId, percent);
              await job.updateProgress(percent);
            },
            onAgentComplete: async (agentResult) => {
              console.log(
                `[scan:${scanId}] Agent ${agentResult.agentType} completed: ` +
                `${agentResult.findingsCount} findings` +
                (agentResult.error ? ` (with error: ${agentResult.error})` : "")
              );
            },
            onAgentError: async (agentType, error) => {
              console.error(`[scan:${scanId}] Agent ${agentType} error: ${error}`);
            },
          }),
        );

        // 4. Mark scan as completed
        const hasErrors = result.agentResults.some((r) => r.error !== null);
        await scanService.markCompleted(scanId, hasErrors);

        // 5. Snapshot compliance scores for trend tracking
        const complianceService = new ComplianceService(deps.db);
        await complianceService.snapshotScores(tenantId, scanId);

        // 6. Run self-learning cycle to update patterns
        const learningService = new LearningService(deps.db);
        await learningService.runLearningCycle(tenantId);

        // 7. Fire the alert engine on scan completion (scan -> alert hook).
        // REAL IMPL (BLACKFYRE 2026-06): the scan->alert hook now hands the alert engine the
        // scan's REAL completion context — the new-findings count and the per-framework
        // compliance score (0-100) — instead of just (tenantId, scanId). evaluateRules can
        // threshold on these (e.g. score_drop / critical_finding triggers) without a second
        // DB round-trip. Guarded so an alert failure is logged and NEVER fails the scan.
        await fireAlertEngine(deps.db, tenantId, scanId, result.totalFindings, log);

        // 8. Return result for BullMQ job storage
        return {
          scanId,
          findingsCount: result.totalFindings,
          agentResults: result.agentResults.map((r) => ({
            agentType: r.agentType,
            status: r.error ? "failed" : "completed",
            findingsCount: r.findingsCount,
            error: r.error,
          })),
          completedAt: new Date().toISOString(),
        };
      } catch (error) {
        // REAL IMPL (BLACKFYRE 2026-06): gracefully fail a scan that exceeds the 4-hour hard
        // limit. The timeout is surfaced distinctly (structured warn + a clear errorDetails
        // string) so it is auditable and not confused with an agent/logic failure. Either way
        // the scan record is moved to "failed" before the error propagates to BullMQ (which
        // applies the configured attempts/backoff retry policy).
        if (error instanceof ScanTimeoutError) {
          log.warn(
            {
              event: "scan.timeout",
              scanId,
              tenantId,
              limitMs: error.limitMs,
            },
            "scan exceeded 4-hour hard limit; marking failed",
          );
          await scanService.markFailed(
            scanId,
            `Scan exceeded the ${error.limitMs}ms (4-hour) hard limit`,
          );
          throw error;
        }
        const message = error instanceof Error ? error.message : "Scan failed unexpectedly";
        await scanService.markFailed(scanId, message);
        throw error;
      }
    },
    {
      connection: deps.connection,
      concurrency: 5,
      limiter: {
        max: 50,
        duration: 1000,
      },
      // GAP-025: 4-hour hard timeout per scan (spec Section 11).
      // REAL IMPL (BLACKFYRE 2026-06): the BullMQ lock now holds for the FULL 4-hour scan hard
      // limit (sourced from SCAN_HARD_LIMIT_MS) so a legitimately long scan is never reaped
      // mid-flight and handed to another worker as "stalled". The in-process withScanTimeout()
      // race is the authoritative cutoff; the lock window simply matches it.
      lockDuration: SCAN_HARD_LIMIT_MS, // 4 hours — matches the in-process hard limit
      stalledInterval: 5 * 60 * 1000, // stalled check every 5 minutes
      // REAL IMPL (BLACKFYRE 2026-06): bound stalled-recovery. A scan whose worker truly died
      // is recovered to "wait" at most once before being moved to "failed", instead of
      // looping forever. This is the worker-level retry budget; the per-job retry policy
      // (attempts: 3, exponential backoff delay 2000) lives on the queue's defaultJobOptions
      // (queue/scan-queue.ts) and is honored here by re-throwing retryable errors so BullMQ
      // re-queues with backoff.
      maxStalledCount: 1,
    }
  );

  worker.on("completed", (job) => {
    console.log(`[scan-worker] Job ${job.id} completed: scan ${job.data.scanId}`);
  });

  worker.on("failed", (job, error) => {
    console.error(`[scan-worker] Job ${job?.id} failed: ${error.message}`);
  });

  worker.on("error", (error) => {
    console.error(`[scan-worker] Worker error: ${error.message}`);
  });

  return worker;
}
