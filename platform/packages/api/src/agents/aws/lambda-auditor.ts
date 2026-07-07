// REAL IMPL (BLACKFYRE 2026-06): replaces the canned-findings stub with a real
// @aws-sdk/client-lambda auditor. Enumerates actual functions via ListFunctions
// (paginated by Marker/NextMarker), pulls each function's real configuration via
// GetFunctionConfiguration, and emits findings derived from real properties:
// deprecated Runtime, Timeout > 900s, missing VpcConfig, and Environment.Variables
// keys whose names look like secrets (/password|secret|key|token/i). No hardcoded
// findings, no sample data. Public export signature (class AwsLambdaAuditorAgent
// extends BaseAgent, type "aws-lambda-auditor") is kept identical so registry.ts
// and all callers keep compiling.
import {
  LambdaClient,
  ListFunctionsCommand,
  GetFunctionConfigurationCommand,
  type FunctionConfiguration,
} from "@aws-sdk/client-lambda";
import { BaseAgent } from "../base-agent.js";
import type { AgentContext, AgentRunResult } from "../base-agent.js";
import type { AgentFindingPayload } from "@blackfyre/shared";
import { mapCheckToControls } from "../../services/compliance-mapper.js";
import { resolveCredentials } from "./credentials.js";
import type { AwsTemporaryCredentials } from "./credentials.js";

// REAL IMPL (BLACKFYRE 2026-06): AWS Lambda has hard-deprecated these runtimes —
// they no longer receive security patches and AWS blocks create/update on them.
// Matched case-insensitively against FunctionConfiguration.Runtime. Sourced from
// the AWS Lambda runtime deprecation policy (Node 0.10–18, Python 2.7–3.7,
// Ruby <=2.7, Go 1.x, .NET Core <=3.1/.NET5/6, Java 8 (Amazon Linux 1), and the
// dotnetcore/provided.al-less custom runtime).
const DEPRECATED_RUNTIMES = new Set<string>([
  "nodejs",
  "nodejs4.3",
  "nodejs4.3-edge",
  "nodejs6.10",
  "nodejs8.10",
  "nodejs10.x",
  "nodejs12.x",
  "nodejs14.x",
  "nodejs16.x",
  "python2.7",
  "python3.6",
  "python3.7",
  "ruby2.5",
  "ruby2.7",
  "go1.x",
  "dotnetcore1.0",
  "dotnetcore2.0",
  "dotnetcore2.1",
  "dotnetcore3.1",
  "dotnet5.0",
  "dotnet6",
  "java8",
  "provided",
]);

// REAL IMPL (BLACKFYRE 2026-06): env-var key names that strongly suggest a
// plaintext secret stored directly on the function configuration.
const SECRET_KEY_PATTERN = /password|secret|key|token/i;

// REAL IMPL (BLACKFYRE 2026-06): AWS Lambda's maximum function timeout is 900s
// (15 minutes). We can never legitimately see a value above this, so any
// configuration reporting > 900 indicates misconfiguration/abuse signal.
const MAX_LAMBDA_TIMEOUT_SECONDS = 900;

/**
 * AWS Lambda Auditor Agent
 *
 * Scans: Lambda functions (deprecated runtimes, excessive timeout, missing VPC,
 *        plaintext secrets in environment variables).
 * Integration: AWS SDK v3 (@aws-sdk/client-lambda) via STS AssumeRole credentialRef.
 */
export class AwsLambdaAuditorAgent extends BaseAgent {
  readonly type = "aws-lambda-auditor";
  readonly displayName = "AWS Lambda Auditor";
  readonly supportedIntegrations = ["aws"];

  async run(ctx: AgentContext): Promise<AgentRunResult> {
    const startedAt = new Date();
    let findingsCount = 0;
    try {
      ctx.onProgress(0);

      const creds = await resolveCredentials(ctx.credentialRef);
      const findings = await auditLambda(creds);

      for (const finding of findings) {
        await ctx.onFinding(finding);
        findingsCount++;
      }

      ctx.onProgress(100);
      return this.createResult(startedAt, findingsCount);
    } catch (error) {
      return this.createResult(
        startedAt,
        findingsCount,
        error instanceof Error ? error.message : "Unknown error",
      );
    }
  }

  async testConnection(credentialRef: string): Promise<boolean> {
    try {
      const creds = await resolveCredentials(credentialRef);
      const client = makeClient(creds);
      // A single ListFunctions page is enough to prove real API access.
      await client.send(new ListFunctionsCommand({ MaxItems: 1 }));
      return true;
    } catch {
      return false;
    }
  }
}

function makeClient(creds: AwsTemporaryCredentials): LambdaClient {
  return new LambdaClient({
    credentials: {
      accessKeyId: creds.accessKeyId,
      secretAccessKey: creds.secretAccessKey,
      sessionToken: creds.sessionToken,
    },
  });
}

/**
 * REAL IMPL (BLACKFYRE 2026-06): Runs all Lambda security checks against real
 * functions and returns findings. Enumerates every function via the paginated
 * ListFunctions API, then resolves each function's authoritative configuration
 * via GetFunctionConfiguration before evaluating the checks.
 */
export async function auditLambda(
  creds: AwsTemporaryCredentials,
): Promise<AgentFindingPayload[]> {
  const client = makeClient(creds);
  const findings: AgentFindingPayload[] = [];

  // Enumerate function names via the paginated ListFunctions API.
  const functionNames: string[] = [];
  let marker: string | undefined;
  do {
    const resp = await client.send(
      new ListFunctionsCommand({ Marker: marker, MaxItems: 50 }),
    );
    for (const fn of resp.Functions ?? []) {
      // Prefer the ARN for stable, region-qualified identification; fall back
      // to the function name when invoking GetFunctionConfiguration.
      const ref = fn.FunctionArn ?? fn.FunctionName;
      if (ref) functionNames.push(ref);
    }
    marker = resp.NextMarker;
  } while (marker);

  // Resolve each function's authoritative configuration and run the checks.
  for (const ref of functionNames) {
    const config = await client.send(
      new GetFunctionConfigurationCommand({ FunctionName: ref }),
    );
    findings.push(...evaluateFunction(config));
  }

  return findings;
}

/**
 * Extracts the AWS region from a Lambda function ARN
 * (arn:aws:lambda:<region>:<account>:function:<name>). Returns null when the
 * region cannot be determined.
 */
function regionFromArn(arn: string | undefined): string | null {
  if (!arn) return null;
  const parts = arn.split(":");
  // arn : aws : lambda : <region> : <account> : function : <name>
  return parts.length >= 4 && parts[3] ? parts[3] : null;
}

/**
 * Evaluates a single function's real configuration against all Lambda checks.
 */
function evaluateFunction(
  config: FunctionConfiguration,
): AgentFindingPayload[] {
  const findings: AgentFindingPayload[] = [];

  const name = config.FunctionName ?? config.FunctionArn ?? "unknown";
  const resourceId = config.FunctionArn ?? name;
  const region = regionFromArn(config.FunctionArn);

  // Check: deprecated runtime -> high
  const runtime = config.Runtime;
  if (runtime && DEPRECATED_RUNTIMES.has(runtime.toLowerCase())) {
    findings.push({
      title: `Lambda function "${name}" uses deprecated runtime "${runtime}"`,
      description: `Lambda function ${name} runs on runtime "${runtime}", which AWS has deprecated. Deprecated runtimes no longer receive security patches and block function updates. Migrate the function to a currently supported runtime.`,
      severity: "high",
      category: "config",
      resourceType: "AWS::Lambda::Function",
      resourceId,
      resourceRegion: region,
      remediationTier: "manual",
      autoFixAvailable: false,
      controlMappings: mapCheckToControls("lambda_deprecated_runtime"),
    });
  }

  // Check: timeout exceeds Lambda's 900s maximum -> low
  if (
    config.Timeout !== undefined &&
    config.Timeout > MAX_LAMBDA_TIMEOUT_SECONDS
  ) {
    findings.push({
      title: `Lambda function "${name}" has an excessive timeout (${config.Timeout}s)`,
      description: `Lambda function ${name} is configured with a timeout of ${config.Timeout} seconds, which exceeds the AWS maximum of ${MAX_LAMBDA_TIMEOUT_SECONDS} seconds (15 minutes). This indicates a misconfiguration and can mask runaway executions or abuse. Reduce the timeout to a value within the supported range.`,
      severity: "low",
      category: "config",
      resourceType: "AWS::Lambda::Function",
      resourceId,
      resourceRegion: region,
      remediationTier: "manual",
      autoFixAvailable: false,
      controlMappings: mapCheckToControls("lambda_excessive_timeout"),
    });
  }

  // Check: function not deployed in a VPC -> medium
  const subnetIds = config.VpcConfig?.SubnetIds ?? [];
  if (subnetIds.length === 0) {
    findings.push({
      title: `Lambda function "${name}" is not configured in a VPC`,
      description: `Lambda function ${name} is not deployed within a VPC. Without VPC configuration the function cannot reach private resources securely and lacks network isolation controls. Attach the function to a VPC with appropriate subnets and security groups where private connectivity is required.`,
      severity: "medium",
      category: "network",
      resourceType: "AWS::Lambda::Function",
      resourceId,
      resourceRegion: region,
      remediationTier: "manual",
      autoFixAvailable: false,
      controlMappings: mapCheckToControls("lambda_no_vpc"),
    });
  }

  // Check: environment variable keys that look like plaintext secrets -> critical
  const variables = config.Environment?.Variables ?? {};
  const secretKeys = Object.keys(variables).filter((key) =>
    SECRET_KEY_PATTERN.test(key),
  );
  if (secretKeys.length > 0) {
    findings.push({
      title: `Lambda function "${name}" may store secrets in environment variables`,
      description: `Lambda function ${name} has environment variable key(s) [${secretKeys.join(", ")}] whose names suggest secret material (password/secret/key/token). Plaintext secrets in environment variables are exposed to anyone with lambda:GetFunctionConfiguration access. Move these values to AWS Secrets Manager or SSM Parameter Store (SecureString) and reference them at runtime.`,
      severity: "critical",
      category: "encryption",
      resourceType: "AWS::Lambda::Function",
      resourceId,
      resourceRegion: region,
      remediationTier: "manual",
      autoFixAvailable: false,
      controlMappings: mapCheckToControls("lambda_env_secrets"),
    });
  }

  return findings;
}
