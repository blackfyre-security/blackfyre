import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { BaseAgent, type AgentContext, type AgentRunResult } from "./base-agent.js";
import type { AgentFindingPayload } from "@blackfyre/shared";
import { normalizeOcsfFindings } from "./normalizers/ocsf-normalizer.js";
import { loadConfig } from "../config.js";

/** Validates IAM Role ARN format — must follow blackfyre-* naming convention */
const ROLE_ARN_RE = /^arn:aws:iam::\d{12}:role\/blackfyre-.+$/;

/** Maximum poll iterations (5s interval × 168 = 14 minutes) */
const MAX_POLLS = 168;
const POLL_INTERVAL_MS = 5_000;

/**
 * Prowler Deep Scanner Agent
 *
 * Invokes a separate Python Lambda container running Prowler to
 * perform deep cloud security scanning with 900+ checks.
 * Results are written to S3 and normalized into AgentFindingPayload.
 */
export class ProwlerAgent extends BaseAgent {
  readonly type = "prowler-deep-scan";
  readonly displayName = "Prowler Deep Scanner";
  readonly supportedIntegrations = ["aws"];

  private lambda = new LambdaClient({});
  private s3 = new S3Client({});

  async run(ctx: AgentContext): Promise<AgentRunResult> {
    const startedAt = new Date();
    let findingsCount = 0;

    try {
      ctx.onProgress(0);

      // Security: validate credential ref is a proper IAM role ARN
      if (!ROLE_ARN_RE.test(ctx.credentialRef)) {
        throw new Error(
          `Invalid role ARN format: must match arn:aws:iam::<account>:role/blackfyre-*`,
        );
      }

      const config = loadConfig();
      const outputBucket = config.SCAN_ARTIFACTS_BUCKET;
      const scannerFunctionArn = config.PROWLER_SCANNER_ARN;

      if (!outputBucket || !scannerFunctionArn) {
        throw new Error("SCAN_ARTIFACTS_BUCKET and PROWLER_SCANNER_ARN must be configured");
      }

      const s3Prefix = `prowler/${ctx.scanId}`;

      // Invoke Prowler scanner Lambda asynchronously
      await this.lambda.send(new InvokeCommand({
        FunctionName: scannerFunctionArn,
        InvocationType: "Event",
        Payload: Buffer.from(JSON.stringify({
          scanId: ctx.scanId,
          roleArn: ctx.credentialRef,
          frameworks: ctx.frameworks,
          outputBucket,
          s3Prefix,
        })),
      }));

      ctx.onProgress(5);

      // Poll S3 for completion status
      for (let poll = 0; poll < MAX_POLLS; poll++) {
        await sleep(POLL_INTERVAL_MS);

        const status = await this.pollStatus(outputBucket, s3Prefix);
        if (!status) {
          // Not yet complete — update progress linearly
          ctx.onProgress(5 + Math.round((poll / MAX_POLLS) * 85));
          continue;
        }

        if (status.status === "complete") {
          ctx.onProgress(90);

          // Read and normalize findings
          const findings = await this.readFindings(outputBucket, s3Prefix);
          for (const finding of findings) {
            await ctx.onFinding(finding);
            findingsCount++;
          }

          ctx.onProgress(100);
          return this.createResult(startedAt, findingsCount);
        }

        if (status.status === "error") {
          throw new Error(`Prowler scan failed: ${status.error ?? "unknown error"}`);
        }
      }

      // Timeout
      throw new Error("Prowler scan timed out after 14 minutes");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return this.createResult(startedAt, findingsCount, message);
    }
  }

  async testConnection(credentialRef: string): Promise<boolean> {
    if (!ROLE_ARN_RE.test(credentialRef)) return false;
    try {
      // Reuse the STS check pattern from cloud-auditor-aws
      const { STSClient, GetCallerIdentityCommand } = await import("@aws-sdk/client-sts");
      const { resolveCredentials } = await import("./aws/credentials.js");
      const creds = await resolveCredentials(credentialRef);
      const sts = new STSClient({
        credentials: {
          accessKeyId: creds.accessKeyId,
          secretAccessKey: creds.secretAccessKey,
          sessionToken: creds.sessionToken,
        },
      });
      const resp = await sts.send(new GetCallerIdentityCommand({}));
      return resp.Account !== undefined;
    } catch {
      return false;
    }
  }

  private async pollStatus(
    bucket: string,
    prefix: string,
  ): Promise<{ status: string; error?: string } | null> {
    try {
      const resp = await this.s3.send(new GetObjectCommand({
        Bucket: bucket,
        Key: `${prefix}/status.json`,
      }));
      const body = await resp.Body?.transformToString();
      if (!body) return null;
      return JSON.parse(body);
    } catch {
      return null; // File doesn't exist yet
    }
  }

  private async readFindings(
    bucket: string,
    prefix: string,
  ): Promise<AgentFindingPayload[]> {
    try {
      const resp = await this.s3.send(new GetObjectCommand({
        Bucket: bucket,
        Key: `${prefix}/results.json`,
      }));
      const body = await resp.Body?.transformToString();
      if (!body) return [];
      const ocsfData = JSON.parse(body);
      return normalizeOcsfFindings(ocsfData);
    } catch {
      return [];
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
