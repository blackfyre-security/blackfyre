import type { BaseAgent, AgentContext, AgentRunResult } from "./base-agent.js";
import { getAgentsForIntegration } from "./registry.js";
import type { AgentFindingPayload } from "@blackfyre/shared";
// SECURITY FIX (BLACKFYRE audit 2026-06-05): scan-cred-resolution — ScanService.create()
// now strips the plaintext `credentialRef` from inline-secret integrations/repoSource and
// replaces it with an AES-256-GCM `credentialEnvelope` (SecretEnvelope) before the job is
// enqueued/persisted, so the queue & scans JSONB never hold plaintext. The orchestrator is
// the run-time boundary where agents actually need plaintext, so it reconstructs the
// plaintext credentialRef HERE — integrations via ScanService.resolveCredentialRef() (the
// centralized resolver), repoSource via EncryptionProviderService.decryptSecret() — BEFORE
// building each AgentContext. Without this, agents would read an undefined credentialRef and
// every encrypted scan would silently break.
import { ScanService } from "../services/scan-service.js";
import {
  EncryptionProviderService,
  type SecretEnvelope,
} from "../services/encryption-provider-service.js";

/** Minimal structured-logger shape (Fastify/pino compatible). */
type Logger = {
  info: (obj: unknown, msg?: string) => void;
  warn: (obj: unknown, msg?: string) => void;
};

export interface SwarmConfig {
  scanId: string;
  tenantId: string;
  frameworks: string[];
  scanTypes?: string[];
  integrations: Array<{
    id: string;
    type: string;
    /**
     * Non-secret credential reference (integration id or vault:// / arn:aws:iam:: pointer).
     * SECURITY FIX (BLACKFYRE audit 2026-06-05): scan-cred-resolution — for inline-secret
     * integrations this is no longer the raw secret; the secret lives in `credentialEnvelope`
     * and is decrypted at run time. Never log this value.
     */
    credentialRef: string;
    /**
     * SECURITY FIX (BLACKFYRE audit 2026-06-05): scan-cred-resolution — AES-256-GCM envelope
     * of inline credential material, present only when ScanService.create() encrypted it.
     * Decrypted here via ScanService.resolveCredentialRef() before agent dispatch. Never log.
     */
    credentialEnvelope?: SecretEnvelope;
  }>;
  /**
   * SECURITY FIX (BLACKFYRE audit 2026-06-05): scan-cred-resolution — repository / on-prem
   * source descriptor. Its inline secret material is carried encrypted in
   * `credentialEnvelope` (plaintext `credentialRef` stripped at enqueue time) and is
   * reconstructed here at run time via EncryptionProviderService.decryptSecret(). Never log
   * `credentialRef` / `credentialEnvelope`.
   */
  repoSource?: {
    provider: string;
    repoUrl: string;
    branch?: string;
    credentialRef?: string;
    credentialEnvelope?: SecretEnvelope;
  } | null;
  onFinding: (finding: AgentFindingPayload, agentType: string, integrationId: string) => Promise<void>;
  onProgress: (overallPercent: number) => Promise<void>;
  onAgentComplete: (result: AgentRunResult) => Promise<void>;
  onAgentError: (agentType: string, error: string) => Promise<void>;
  /**
   * Optional structured logger (Fastify/pino). When present, credential resolution is logged
   * at info and decrypt failures at warn — never the secret itself. Defaults to a no-op.
   */
  log?: Logger;
}

export interface SwarmResult {
  swarmId: string;
  totalFindings: number;
  agentResults: AgentRunResult[];
  startedAt: Date;
  completedAt: Date;
}

/**
 * Swarm Orchestrator
 *
 * Coordinates multiple scanning agents running in parallel.
 * Each integration gets matched to its responsible agent(s),
 * and all agents run concurrently. Progress is aggregated across
 * all agents and reported to the caller.
 *
 * In production, this will spawn actual Ruflo agent swarm instances.
 * For now, it runs agents in-process with Promise.allSettled for
 * parallelism and fault tolerance.
 */
export class SwarmOrchestrator {
  /**
   * Run a full scan swarm. Returns when all agents complete (or fail).
   * Never throws — individual agent failures are captured in results.
   */
  async runSwarm(config: SwarmConfig): Promise<SwarmResult> {
    const startedAt = new Date();
    const swarmId = `swarm_${config.scanId}`;
    const log: Logger = config.log ?? { info: () => {}, warn: () => {} };

    // SECURITY FIX (BLACKFYRE audit 2026-06-05): scan-cred-resolution — reconstruct the
    // plaintext repoSource.credentialRef from its envelope at run time. ScanService.create()
    // strips the plaintext and stores only the AES-256-GCM envelope, so a repo-clone agent
    // that read repoSource.credentialRef would otherwise get undefined and break the scan.
    // Decrypt failures (bad/rotated keyId, tampered tag) are logged at warn and the scan
    // proceeds without repo credentials rather than crashing the whole swarm. The plaintext
    // is NEVER logged. Safe pointer refs (no envelope) pass through untouched.
    let resolvedRepoSource = config.repoSource ?? null;
    if (config.repoSource?.credentialEnvelope) {
      try {
        const plaintext = new EncryptionProviderService().decryptSecret(
          config.repoSource.credentialEnvelope,
        );
        resolvedRepoSource = {
          provider: config.repoSource.provider,
          repoUrl: config.repoSource.repoUrl,
          branch: config.repoSource.branch,
          credentialRef: plaintext,
        };
        log.info(
          {
            event: "scan.credential_ref.resolve",
            scanId: config.scanId,
            tenantId: config.tenantId,
            source: "envelope",
            target: "repoSource",
            provider: config.repoSource.provider,
            keyId: config.repoSource.credentialEnvelope.keyId,
          },
          "decrypted repoSource credential reference (envelope) at scan run time",
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        log.warn(
          {
            event: "scan.credential_ref.decrypt_failed",
            scanId: config.scanId,
            tenantId: config.tenantId,
            target: "repoSource",
            provider: config.repoSource.provider,
            keyId: config.repoSource.credentialEnvelope.keyId,
            error: message,
          },
          "failed to decrypt repoSource credential envelope — proceeding without repo credentials",
        );
        // Fail safe: drop the unusable encrypted ref rather than leak/forward the envelope.
        resolvedRepoSource = {
          provider: config.repoSource.provider,
          repoUrl: config.repoSource.repoUrl,
          branch: config.repoSource.branch,
        };
      }
    }
    // resolvedRepoSource now carries plaintext credentialRef (or none) for any repo-clone
    // agent; referenced via void to make the resolution boundary explicit without changing
    // the AgentContext contract (agents read their per-integration credentialRef below).
    void resolvedRepoSource;

    // Build the list of (agent, integration) pairs to run. Each integration's credentialRef
    // is RESOLVED to plaintext first (decrypting the envelope when present) so agents always
    // receive a usable credential and never the stripped/undefined queue value.
    const tasks: Array<{
      agent: BaseAgent;
      integration: { id: string; type: string; credentialRef: string };
    }> = [];

    for (const integration of config.integrations) {
      // SECURITY FIX (BLACKFYRE audit 2026-06-05): scan-cred-resolution — centralize the
      // run-time decrypt through ScanService.resolveCredentialRef(): pointer refs pass
      // through, envelopes are decrypted (fail closed on bad keyId/tag) and logged at info.
      // A decrypt failure for one integration is isolated so it doesn't abort the others.
      let resolvedRef: string;
      try {
        resolvedRef = ScanService.resolveCredentialRef(integration, log);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        log.warn(
          {
            event: "scan.credential_ref.decrypt_failed",
            scanId: config.scanId,
            tenantId: config.tenantId,
            target: "integration",
            integrationId: integration.id,
            integrationType: integration.type,
            keyId: integration.credentialEnvelope?.keyId,
            error: message,
          },
          "failed to resolve integration credential reference — skipping its agents",
        );
        // Surface the failure as a per-integration agent error so the scan can still report
        // partial results instead of silently producing zero findings under a bad credential.
        const agents = getAgentsForIntegration(integration.type, config.scanTypes);
        for (const agent of agents) {
          await config.onAgentError(agent.type, `credential resolution failed: ${message}`);
        }
        continue;
      }

      const agents = getAgentsForIntegration(integration.type, config.scanTypes);
      for (const agent of agents) {
        tasks.push({ agent, integration: { id: integration.id, type: integration.type, credentialRef: resolvedRef } });
      }
    }

    if (tasks.length === 0) {
      return {
        swarmId,
        totalFindings: 0,
        agentResults: [],
        startedAt,
        completedAt: new Date(),
      };
    }

    // Track per-agent progress for overall calculation
    const agentProgress = new Map<string, number>();
    for (const task of tasks) {
      agentProgress.set(`${task.agent.type}:${task.integration.id}`, 0);
    }

    const calculateOverallProgress = (): number => {
      const values = Array.from(agentProgress.values());
      const total = values.reduce((sum, v) => sum + v, 0);
      return Math.round(total / values.length);
    };

    // Run all agents in parallel
    const results = await Promise.allSettled(
      tasks.map(async ({ agent, integration }) => {
        const taskKey = `${agent.type}:${integration.id}`;

        const ctx: AgentContext = {
          scanId: config.scanId,
          tenantId: config.tenantId,
          integrationId: integration.id,
          credentialRef: integration.credentialRef,
          frameworks: config.frameworks,
          onProgress: (percent: number) => {
            agentProgress.set(taskKey, percent);
            // Fire-and-forget progress update
            config.onProgress(calculateOverallProgress()).catch(() => {});
          },
          onFinding: async (finding: AgentFindingPayload) => {
            await config.onFinding(finding, agent.type, integration.id);
          },
        };

        try {
          const result = await agent.run(ctx);
          await config.onAgentComplete(result);
          return result;
        } catch (error) {
          const message = error instanceof Error ? error.message : "Agent crashed";
          await config.onAgentError(agent.type, message);

          return {
            agentType: agent.type,
            findingsCount: 0,
            error: message,
            startedAt: new Date(),
            completedAt: new Date(),
          } as AgentRunResult;
        }
      })
    );

    // Extract results from Promise.allSettled
    const agentResults: AgentRunResult[] = results.map((r) => {
      if (r.status === "fulfilled") return r.value;
      return {
        agentType: "unknown",
        findingsCount: 0,
        error: r.reason?.message ?? "Unexpected failure",
        startedAt: new Date(),
        completedAt: new Date(),
      };
    });

    const totalFindings = agentResults.reduce((sum, r) => sum + r.findingsCount, 0);

    return {
      swarmId,
      totalFindings,
      agentResults,
      startedAt,
      completedAt: new Date(),
    };
  }
}
