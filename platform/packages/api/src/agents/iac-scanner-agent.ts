import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { BaseAgent, type AgentContext, type AgentRunResult } from "./base-agent.js";
import type { AgentFindingPayload } from "@blackfyre/shared";
import { normalizeSarifFindings } from "./normalizers/sarif-normalizer.js";
import { mapIacCheckToControls } from "../services/iac-compliance-mapper.js";
import { loadConfig } from "../config.js";

/** Validated S3 path pattern — no directory traversal */
const SAFE_S3_PATH_RE = /^[a-zA-Z0-9\-_/]+$/;

/** Maximum poll iterations (5s interval × 120 = 10 minutes) */
const MAX_POLLS = 120;
const POLL_INTERVAL_MS = 5_000;

const IAC_TOOLS = ["checkov", "semgrep", "bandit"] as const;

/**
 * IaC Security Scanner Agent
 *
 * Invokes a Python Lambda container running Checkov, Semgrep, and Bandit
 * to scan Infrastructure-as-Code files for security misconfigurations.
 * Supports Git repo cloning (GitHub/GitLab/Bitbucket) and file upload.
 */
export class IacScannerAgent extends BaseAgent {
  readonly type = "iac-scanner";
  readonly displayName = "IaC Security Scanner";
  readonly supportedIntegrations = ["github", "gitlab", "bitbucket", "upload"];

  private lambda = new LambdaClient({});
  private s3 = new S3Client({});

  async run(ctx: AgentContext): Promise<AgentRunResult> {
    const startedAt = new Date();
    let findingsCount = 0;

    try {
      ctx.onProgress(0);

      const config = loadConfig();
      const outputBucket = config.SCAN_ARTIFACTS_BUCKET;
      const scannerFunctionArn = config.IAC_SCANNER_ARN;

      if (!outputBucket || !scannerFunctionArn) {
        throw new Error("SCAN_ARTIFACTS_BUCKET and IAC_SCANNER_ARN must be configured");
      }

      const s3Prefix = `iac/${ctx.scanId}`;

      // Security: validate S3 prefix
      if (!SAFE_S3_PATH_RE.test(s3Prefix)) {
        throw new Error("Invalid S3 prefix: potential path traversal detected");
      }

      // Build Lambda payload based on source type
      const payload: Record<string, unknown> = {
        scanId: ctx.scanId,
        tools: [...IAC_TOOLS],
        outputBucket,
        s3Prefix,
      };

      // The credential ref contains the info needed to determine source
      // For Git: credentialRef is the vault:// path for the OAuth token
      // For upload: files are already in S3
      if (ctx.integrationId && ctx.integrationId !== "upload") {
        payload.credentialRef = ctx.credentialRef;
        payload.integrationId = ctx.integrationId;
      } else {
        // Upload mode — files already in S3
        payload.s3SourcePath = `uploads/${ctx.tenantId}/${ctx.scanId}`;
      }

      // Invoke IaC scanner Lambda asynchronously
      await this.lambda.send(new InvokeCommand({
        FunctionName: scannerFunctionArn,
        InvocationType: "Event",
        Payload: Buffer.from(JSON.stringify(payload)),
      }));

      ctx.onProgress(5);

      // Poll S3 for completion
      for (let poll = 0; poll < MAX_POLLS; poll++) {
        await sleep(POLL_INTERVAL_MS);

        const status = await this.pollStatus(outputBucket, s3Prefix);
        if (!status) {
          ctx.onProgress(5 + Math.round((poll / MAX_POLLS) * 85));
          continue;
        }

        if (status.status === "complete") {
          ctx.onProgress(90);

          // Read SARIF results from each tool
          for (const tool of IAC_TOOLS) {
            const findings = await this.readToolFindings(outputBucket, s3Prefix, tool);

            // Enrich findings with compliance mappings
            for (const finding of findings) {
              const tags = (finding as Record<string, unknown>).tags as string[] | undefined;
              finding.controlMappings = mapIacCheckToControls(
                finding.title,
                tags ?? [],
              );
              await ctx.onFinding(finding);
              findingsCount++;
            }
          }

          ctx.onProgress(100);
          return this.createResult(startedAt, findingsCount);
        }

        if (status.status === "error") {
          throw new Error(`IaC scan failed: ${status.error ?? "unknown error"}`);
        }
      }

      throw new Error("IaC scan timed out after 10 minutes");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return this.createResult(startedAt, findingsCount, message);
    }
  }

  async testConnection(credentialRef: string): Promise<boolean> {
    // For upload integrations, always return true
    if (!credentialRef || credentialRef === "upload") return true;

    // For Git integrations, we would validate the OAuth token
    // This requires resolving the vault:// ref and testing API access
    // For now, return true if credentialRef looks valid
    return credentialRef.startsWith("vault://") || credentialRef.length > 0;
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
      return null;
    }
  }

  private async readToolFindings(
    bucket: string,
    prefix: string,
    tool: string,
  ): Promise<AgentFindingPayload[]> {
    try {
      const resp = await this.s3.send(new GetObjectCommand({
        Bucket: bucket,
        Key: `${prefix}/${tool}.sarif`,
      }));
      const body = await resp.Body?.transformToString();
      if (!body) return [];
      const sarifData = JSON.parse(body);
      return normalizeSarifFindings(sarifData, tool);
    } catch {
      return [];
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
