import { AuthorizationManagementClient } from "@azure/arm-authorization";
import { BaseAgent, type AgentContext, type AgentRunResult } from "./base-agent.js";
import type { AgentFindingPayload } from "@blackfyre/shared";
import { resolveAzureCredentials } from "./azure/credentials.js";
import { auditAzureIAM } from "./azure/iam-auditor.js";
import { auditAzureStorage } from "./azure/storage-auditor.js";
import { auditAzureCompute } from "./azure/compute-auditor.js";
import { auditAzureNetwork } from "./azure/network-auditor.js";
import { auditAzureKeyVault } from "./azure/keyvault-auditor.js";

/**
 * Azure Cloud Auditor Agent
 *
 * Scans: IAM/RBAC, Storage, Compute, Network/NSG, Key Vault
 * Integration: Azure SDK (Service Principal via credentialRef)
 *
 * Uses real Azure ARM SDK calls via sub-auditor modules.
 * Each sub-auditor returns AgentFindingPayload[] with compliance control mappings.
 */
export class CloudAuditorAzureAgent extends BaseAgent {
  readonly type = "cloud-auditor-azure";
  readonly displayName = "Azure Cloud Auditor";
  readonly supportedIntegrations = ["azure"];

  async run(ctx: AgentContext): Promise<AgentRunResult> {
    const startedAt = new Date();
    let findingsCount = 0;

    try {
      ctx.onProgress(0);

      // Resolve credentials once, share across all sub-auditors
      const creds = await resolveAzureCredentials(ctx.credentialRef);

      // Phase 1: IAM/RBAC Audit (0-20%)
      const iamFindings = await this.runAuditPhase(
        () => auditAzureIAM(creds),
        ctx,
      );
      findingsCount += iamFindings;
      ctx.onProgress(20);

      // Phase 2: Storage Audit (20-40%)
      const storageFindings = await this.runAuditPhase(
        () => auditAzureStorage(creds),
        ctx,
      );
      findingsCount += storageFindings;
      ctx.onProgress(40);

      // Phase 3: Compute Audit (40-60%)
      const computeFindings = await this.runAuditPhase(
        () => auditAzureCompute(creds),
        ctx,
      );
      findingsCount += computeFindings;
      ctx.onProgress(60);

      // Phase 4: Network/NSG Audit (60-80%)
      const networkFindings = await this.runAuditPhase(
        () => auditAzureNetwork(creds),
        ctx,
      );
      findingsCount += networkFindings;
      ctx.onProgress(80);

      // Phase 5: Key Vault Audit (80-100%)
      const kvFindings = await this.runAuditPhase(
        () => auditAzureKeyVault(creds),
        ctx,
      );
      findingsCount += kvFindings;
      ctx.onProgress(100);

      return this.createResult(startedAt, findingsCount);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return this.createResult(startedAt, findingsCount, message);
    }
  }

  async testConnection(credentialRef: string): Promise<boolean> {
    try {
      const creds = await resolveAzureCredentials(credentialRef);
      const client = new AuthorizationManagementClient(
        creds.credential,
        creds.subscriptionId,
      );

      // Attempt to list one role assignment to verify API access
      for await (const _assignment of client.roleAssignments.listForSubscription()) {
        break; // One successful response means access is valid
      }

      return true;
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
