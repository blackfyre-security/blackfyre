import { STSClient, GetCallerIdentityCommand } from "@aws-sdk/client-sts";
import { BaseAgent, type AgentContext, type AgentRunResult } from "./base-agent.js";
import type { AgentFindingPayload } from "@blackfyre/shared";
import { resolveCredentials } from "./aws/credentials.js";
import { auditIAM } from "./aws/iam-auditor.js";
import { auditS3 } from "./aws/s3-auditor.js";
import { auditEC2VPC } from "./aws/ec2-vpc-auditor.js";
import { auditCloudTrail } from "./aws/cloudtrail-auditor.js";
import { auditKMS } from "./aws/kms-auditor.js";
// REAL IMPL (BLACKFYRE 2026-06): wire the remaining real SDK-backed auditors into
// the orchestrator. Previously only 5 of the 13 AWS phases ran; the auditors below
// each enumerate live resources via the AWS SDK and return AgentFindingPayload[]
// built from real resource properties (no canned data). They share the single
// resolved STS session, exactly like the existing IAM/S3/EC2/CloudTrail/KMS phases.
import { auditRDS } from "./aws/rds-auditor.js";
import { auditLambda } from "./aws/lambda-auditor.js";
import {
  auditEcsTaskDefinitions,
  auditEcrRepositories,
  auditEksClusters,
} from "./aws/ecs-eks-auditor.js";
import { auditSqsSns } from "./aws/sqs-sns-auditor.js";
import { auditSecretsManager } from "./aws/secrets-manager-auditor.js";
import { auditGuardDuty } from "./aws/guardduty-auditor.js";
import { auditWaf } from "./aws/waf-auditor.js";
// REAL IMPL (BLACKFYRE 2026-06): AWS Config was implemented but never wired into
// the orchestrator, so its recorder/delivery-channel/rule findings never ran.
// Adding it here as the final phase enumerates Config recorders + Config rules
// across regions and emits real findings from live resource state.
import { auditConfig } from "./aws/config-auditor.js";

/**
 * AWS Cloud Auditor Agent
 *
 * Scans: IAM, S3, EC2, VPC, CloudTrail, KMS, RDS, Lambda, ECS/ECR/EKS,
 *        SQS/SNS, Secrets Manager, GuardDuty, WAF, AWS Config
 * Integration: AWS SDK (STS AssumeRole via credentialRef)
 *
 * Uses real AWS SDK v3 calls via sub-auditor modules.
 * The adapter pattern allows swapping in Ruflo agent swarm execution.
 */
export class CloudAuditorAwsAgent extends BaseAgent {
  readonly type = "cloud-auditor-aws";
  readonly displayName = "AWS Cloud Auditor";
  readonly supportedIntegrations = ["aws"];

  async run(ctx: AgentContext): Promise<AgentRunResult> {
    const startedAt = new Date();
    let findingsCount = 0;

    try {
      ctx.onProgress(0);

      // Resolve credentials once, share across all sub-auditors
      const creds = await resolveCredentials(ctx.credentialRef);

      // REAL IMPL (BLACKFYRE 2026-06): each entry is a real SDK-backed audit phase
      // returning findings derived from live resource properties. Progress is
      // distributed evenly across all phases so the existing progress contract
      // (0 -> 100, monotonically increasing) is preserved as phases were added.
      const phases: Array<() => Promise<AgentFindingPayload[]>> = [
        () => auditIAM(creds), // IAM
        () => auditS3(creds), // S3 buckets
        () => auditEC2VPC(creds), // EC2 + VPC
        () => auditCloudTrail(creds), // CloudTrail
        () => auditKMS(creds), // KMS
        () => auditRDS(creds), // RDS instances
        () => auditLambda(creds), // Lambda functions
        () => auditEcsTaskDefinitions(creds), // ECS task definitions
        () => auditEcrRepositories(creds), // ECR repositories
        () => auditEksClusters(creds), // EKS clusters
        () => auditSqsSns(creds), // SQS queues + SNS topics
        () => auditSecretsManager(creds), // Secrets Manager
        () => auditGuardDuty(creds), // GuardDuty (all regions)
        () => auditWaf(creds), // WAFv2 web ACLs
        () => auditConfig(creds), // AWS Config recorders + rules
      ];

      for (let i = 0; i < phases.length; i++) {
        findingsCount += await this.runAuditPhase(phases[i], ctx);
        ctx.onProgress(Math.round(((i + 1) / phases.length) * 100));
      }

      ctx.onProgress(100);

      return this.createResult(startedAt, findingsCount);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return this.createResult(startedAt, findingsCount, message);
    }
  }

  async testConnection(credentialRef: string): Promise<boolean> {
    try {
      const creds = await resolveCredentials(credentialRef);
      const stsClient = new STSClient({
        credentials: {
          accessKeyId: creds.accessKeyId,
          secretAccessKey: creds.secretAccessKey,
          sessionToken: creds.sessionToken,
        },
      });
      const resp = await stsClient.send(new GetCallerIdentityCommand({}));
      return resp.Account !== undefined;
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
