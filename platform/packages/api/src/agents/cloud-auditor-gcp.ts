import { ProjectsClient } from "@google-cloud/resource-manager";
import { BaseAgent, type AgentContext, type AgentRunResult } from "./base-agent.js";
import type { AgentFindingPayload } from "@blackfyre/shared";
import { resolveGcpCredentials } from "./gcp/credentials.js";
import { auditGcpIAM } from "./gcp/iam-auditor.js";
import { auditGcpStorage } from "./gcp/storage-auditor.js";
import { auditGcpCompute } from "./gcp/compute-auditor.js";
import { auditGcpNetwork } from "./gcp/network-auditor.js";
import { auditGcpKMS } from "./gcp/kms-auditor.js";

/**
 * GCP Cloud Auditor Agent
 *
 * Scans: IAM, GCS, Compute, VPC, KMS
 * Integration: GCP SDK (Service Account Key via credentialRef)
 *
 * Uses real GCP SDK calls via sub-auditor modules.
 * The adapter pattern allows swapping in Ruflo agent swarm execution.
 */
export class CloudAuditorGcpAgent extends BaseAgent {
  readonly type = "cloud-auditor-gcp";
  readonly displayName = "GCP Cloud Auditor";
  readonly supportedIntegrations = ["gcp"];

  async run(ctx: AgentContext): Promise<AgentRunResult> {
    const startedAt = new Date();
    let findingsCount = 0;

    try {
      ctx.onProgress(0);

      // Resolve credentials once, share across all sub-auditors
      const creds = await resolveGcpCredentials(ctx.credentialRef);

      // Phase 1: IAM Audit (0-20%)
      const iamFindings = await this.runAuditPhase(
        () => auditGcpIAM(creds),
        ctx,
      );
      findingsCount += iamFindings;
      ctx.onProgress(20);

      // Phase 2: Storage Audit (20-40%)
      const storageFindings = await this.runAuditPhase(
        () => auditGcpStorage(creds),
        ctx,
      );
      findingsCount += storageFindings;
      ctx.onProgress(40);

      // Phase 3: Compute Audit (40-60%)
      const computeFindings = await this.runAuditPhase(
        () => auditGcpCompute(creds),
        ctx,
      );
      findingsCount += computeFindings;
      ctx.onProgress(60);

      // Phase 4: Network/Logging Audit (60-80%)
      const networkFindings = await this.runAuditPhase(
        () => auditGcpNetwork(creds),
        ctx,
      );
      findingsCount += networkFindings;
      ctx.onProgress(80);

      // Phase 5: KMS Audit (80-100%)
      const kmsFindings = await this.runAuditPhase(
        () => auditGcpKMS(creds),
        ctx,
      );
      findingsCount += kmsFindings;
      ctx.onProgress(100);

      return this.createResult(startedAt, findingsCount);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return this.createResult(startedAt, findingsCount, message);
    }
  }

  async testConnection(credentialRef: string): Promise<boolean> {
    try {
      const creds = await resolveGcpCredentials(credentialRef);
      const authClient = await creds.auth.getClient();
      const client = new ProjectsClient({ authClient: authClient as any });
      const [project] = await client.getProject({
        name: `projects/${creds.projectId}`,
      });
      return project?.name !== undefined;
    } catch {
      return false;
    }
  }

  /**
   * Runs an audit function and emits each finding through the context.
   * Returns the number of findings emitted.
   */
  private async runAuditPhase(
    auditFn: () => Promise<AgentFindingPayload[]>,
    ctx: AgentContext,
  ): Promise<number> {
    const findings = await auditFn();
    for (const finding of findings) {
      await ctx.onFinding(finding);
    }
    return findings.length;
  }
}
