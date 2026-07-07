import type { AgentFindingPayload } from "@blackfyre/shared";

export interface AgentContext {
  scanId: string;
  tenantId: string;
  integrationId: string;
  credentialRef: string;
  frameworks: string[];
  onProgress: (percent: number) => void;
  onFinding: (finding: AgentFindingPayload) => Promise<void>;
}

export interface AgentRunResult {
  agentType: string;
  findingsCount: number;
  error: string | null;
  startedAt: Date;
  completedAt: Date;
}

export abstract class BaseAgent {
  abstract readonly type: string;
  abstract readonly displayName: string;
  abstract readonly supportedIntegrations: string[];

  /**
   * Runs the agent scan against the target infrastructure.
   * Must call ctx.onFinding() for each discovered finding.
   * Must call ctx.onProgress() periodically.
   */
  abstract run(ctx: AgentContext): Promise<AgentRunResult>;

  /**
   * Tests connectivity to the target integration.
   * Returns true if connection is successful.
   */
  abstract testConnection(credentialRef: string): Promise<boolean>;

  protected createResult(
    startedAt: Date,
    findingsCount: number,
    error: string | null = null,
  ): AgentRunResult {
    return {
      agentType: this.type,
      findingsCount,
      error,
      startedAt,
      completedAt: new Date(),
    };
  }
}
