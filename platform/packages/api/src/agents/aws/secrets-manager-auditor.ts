// REAL IMPL (BLACKFYRE 2026-06): replaces the canned 3-finding stub with a real
// @aws-sdk/client-secrets-manager auditor. Enumerates actual secrets via
// ListSecrets (paginated by NextToken), reads each secret's authoritative
// configuration via DescribeSecret, and resolves each secret's resource policy
// via GetResourcePolicy. Findings are derived solely from real properties:
//   - rotation not enabled (RotationEnabled !== true)
//   - rotation interval exceeds 90 days (RotationRules.AutomaticallyAfterDays > 90)
//   - resource policy granting access to an overly broad principal ("*")
// No hardcoded findings, no sample data. The public export signature
// (class AwsSecretsManagerAuditorAgent extends BaseAgent, type
// "aws-secrets-manager-auditor") is kept identical so agents/registry.ts and all
// callers keep compiling. A new auditSecretsManager(creds) function mirrors the
// shape of the s3/iam/lambda/sqs-sns auditors.
import {
  SecretsManagerClient,
  ListSecretsCommand,
  DescribeSecretCommand,
  GetResourcePolicyCommand,
  ResourceNotFoundException,
} from "@aws-sdk/client-secrets-manager";
import type { DescribeSecretCommandOutput } from "@aws-sdk/client-secrets-manager";
import type { AgentFindingPayload } from "@blackfyre/shared";
import { BaseAgent } from "../base-agent.js";
import type { AgentContext, AgentRunResult } from "../base-agent.js";
import { mapCheckToControls } from "../../services/compliance-mapper.js";
import { resolveCredentials } from "./credentials.js";
import type { AwsTemporaryCredentials } from "./credentials.js";

// REAL IMPL (BLACKFYRE 2026-06): rotation interval ceiling. AWS Secrets Manager
// schedules rotation via RotationRules.AutomaticallyAfterDays; anything beyond 90
// days leaves long-lived static secrets in place. Matches the mandate's
// "AutomaticallyAfterDays <= 90" rule — values strictly greater than 90 fail.
const MAX_ROTATION_DAYS = 90;

function makeClient(creds: AwsTemporaryCredentials): SecretsManagerClient {
  return new SecretsManagerClient({
    credentials: {
      accessKeyId: creds.accessKeyId,
      secretAccessKey: creds.secretAccessKey,
      sessionToken: creds.sessionToken,
    },
  });
}

/**
 * Extracts the AWS region from an ARN
 * (arn:aws:secretsmanager:REGION:account:secret:name-suffix). Returns null when
 * the ARN is missing or has no region segment.
 */
function regionFromArn(arn: string | undefined): string | null {
  if (!arn) return null;
  const parts = arn.split(":");
  // arn : partition : service : region : account : ...
  return parts.length >= 4 && parts[3] ? parts[3] : null;
}

/**
 * AWS Secrets Manager Auditor Agent
 *
 * Scans: Secrets Manager secrets (rotation disabled, rotation interval > 90 days,
 *        resource policies granting access to overly broad principals).
 * Integration: AWS SDK v3 (@aws-sdk/client-secrets-manager) via STS AssumeRole
 *              credentialRef. Note: the scoped audit session (see credentials.ts)
 *              explicitly DENIES secretsmanager:GetSecretValue — this auditor only
 *              reads metadata (List/Describe/GetResourcePolicy), never the secret
 *              material itself.
 */
export class AwsSecretsManagerAuditorAgent extends BaseAgent {
  readonly type = "aws-secrets-manager-auditor";
  readonly displayName = "AWS Secrets Manager Auditor";
  readonly supportedIntegrations = ["aws"];

  async run(ctx: AgentContext): Promise<AgentRunResult> {
    const startedAt = new Date();
    let findingsCount = 0;
    try {
      ctx.onProgress(0);

      // REAL IMPL (BLACKFYRE 2026-06): resolve scoped read-only credentials and
      // enumerate real Secrets Manager secrets instead of emitting canned data.
      const creds = await resolveCredentials(ctx.credentialRef);

      const findings = await auditSecretsManager(creds);

      for (const finding of findings) {
        await ctx.onFinding({ ...finding, source: this.type });
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

  // REAL IMPL (BLACKFYRE 2026-06): validate real API access by resolving
  // credentials and issuing a lightweight ListSecrets call, rather than
  // returning a hardcoded true.
  async testConnection(credentialRef: string): Promise<boolean> {
    try {
      const creds = await resolveCredentials(credentialRef);
      const client = makeClient(creds);
      await client.send(new ListSecretsCommand({ MaxResults: 1 }));
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * REAL IMPL (BLACKFYRE 2026-06): runs all Secrets Manager security checks against
 * real secrets and returns findings. Enumerates every secret via the paginated
 * ListSecrets API, resolves each secret's authoritative configuration via
 * DescribeSecret, and pulls its resource policy via GetResourcePolicy before
 * evaluating the checks. No canned data — every finding is produced from an
 * actual secret property.
 */
export async function auditSecretsManager(
  creds: AwsTemporaryCredentials,
): Promise<AgentFindingPayload[]> {
  const client = makeClient(creds);
  const findings: AgentFindingPayload[] = [];

  // Enumerate secret ARNs via the paginated ListSecrets API.
  const secretIds: string[] = [];
  let nextToken: string | undefined;
  do {
    const resp = await client.send(
      new ListSecretsCommand({ NextToken: nextToken, MaxResults: 100 }),
    );
    for (const secret of resp.SecretList ?? []) {
      // Prefer the ARN for stable, region-qualified identification; fall back to
      // the secret name when issuing the subsequent metadata calls.
      const ref = secret.ARN ?? secret.Name;
      if (ref) secretIds.push(ref);
    }
    nextToken = resp.NextToken;
  } while (nextToken);

  // Inspect each secret's configuration + resource policy.
  for (const secretId of secretIds) {
    findings.push(...(await checkSecret(client, secretId)));
  }

  return findings;
}

/**
 * Inspects a single secret: rotation configuration (DescribeSecret) and resource
 * policy (GetResourcePolicy).
 */
async function checkSecret(
  client: SecretsManagerClient,
  secretId: string,
): Promise<AgentFindingPayload[]> {
  const findings: AgentFindingPayload[] = [];

  const describe = await client.send(
    new DescribeSecretCommand({ SecretId: secretId }),
  );

  const arn = describe.ARN ?? secretId;
  const name = describe.Name ?? arn;
  const region = regionFromArn(describe.ARN ?? (secretId.startsWith("arn:") ? secretId : undefined));
  const resourceId = arn;

  findings.push(...evaluateRotation(describe, { name, resourceId, region }));

  // Resolve the resource policy. A secret may simply not have one; GetResourcePolicy
  // returns an empty/absent ResourcePolicy in that case (and ResourceNotFoundException
  // is treated as "no policy" defensively).
  let policyDoc: string | undefined;
  try {
    const policyResp = await client.send(
      new GetResourcePolicyCommand({ SecretId: secretId }),
    );
    policyDoc = policyResp.ResourcePolicy ?? undefined;
  } catch (error) {
    if (!(error instanceof ResourceNotFoundException)) throw error;
    policyDoc = undefined;
  }

  if (policyDoc && resourcePolicyAllowsBroadPrincipal(policyDoc)) {
    findings.push({
      title: `Secrets Manager secret "${name}" resource policy grants access to an overly broad principal`,
      description: `Secret ${resourceId} has a resource policy with an Allow statement granting access to any principal ("*") without a scoping condition. This permits unintended accounts/identities to retrieve or manage the secret. Scope the policy to specific principals or add a Condition (e.g. aws:PrincipalOrgID / aws:SourceAccount).`,
      severity: "high",
      category: "iam",
      resourceType: "AWS::SecretsManager::Secret",
      resourceId,
      resourceRegion: region,
      remediationTier: "manual",
      autoFixAvailable: false,
      controlMappings: mapCheckToControls("secretsmanager_policy_broad_principal"),
    });
  }

  return findings;
}

interface SecretIdentity {
  name: string;
  resourceId: string;
  region: string | null;
}

/**
 * Evaluates a secret's rotation configuration: rotation must be enabled, and when
 * enabled the automatic rotation interval must not exceed 90 days.
 */
function evaluateRotation(
  describe: DescribeSecretCommandOutput,
  id: SecretIdentity,
): AgentFindingPayload[] {
  const findings: AgentFindingPayload[] = [];
  const { name, resourceId, region } = id;

  const rotationEnabled = describe.RotationEnabled === true;

  if (!rotationEnabled) {
    findings.push({
      title: `Secrets Manager secret "${name}" does not have automatic rotation enabled`,
      description: `Secret ${resourceId} has RotationEnabled = false. Without automatic rotation the secret becomes a long-lived static credential, increasing the blast radius if it leaks. Configure automatic rotation with a rotation Lambda and a schedule of at most ${MAX_ROTATION_DAYS} days.`,
      severity: "high",
      category: "config",
      resourceType: "AWS::SecretsManager::Secret",
      resourceId,
      resourceRegion: region,
      remediationTier: "manual",
      autoFixAvailable: false,
      controlMappings: mapCheckToControls("secretsmanager_rotation_disabled"),
    });
    return findings;
  }

  // Rotation is enabled — verify the interval is within the 90-day ceiling.
  const days = describe.RotationRules?.AutomaticallyAfterDays;
  if (typeof days === "number" && days > MAX_ROTATION_DAYS) {
    findings.push({
      title: `Secrets Manager secret "${name}" rotation interval exceeds ${MAX_ROTATION_DAYS} days`,
      description: `Secret ${resourceId} rotates automatically every ${days} days (RotationRules.AutomaticallyAfterDays = ${days}), which exceeds the recommended maximum of ${MAX_ROTATION_DAYS} days. Long rotation windows leave a compromised secret valid for longer. Reduce AutomaticallyAfterDays to ${MAX_ROTATION_DAYS} or fewer.`,
      severity: "medium",
      category: "config",
      resourceType: "AWS::SecretsManager::Secret",
      resourceId,
      resourceRegion: region,
      remediationTier: "manual",
      autoFixAvailable: false,
      controlMappings: mapCheckToControls("secretsmanager_rotation_interval_too_long"),
    });
  }

  return findings;
}

interface PolicyStatement {
  Effect?: string;
  Principal?: string | { AWS?: string | string[]; [key: string]: unknown };
  Condition?: Record<string, unknown>;
}

/**
 * Returns true when the resource policy contains an Allow statement that grants
 * access to any principal ("*") and is not constrained by a Condition. A
 * Condition (e.g. aws:PrincipalOrgID, aws:SourceAccount) can legitimately scope
 * an otherwise-wildcard principal, so conditioned statements are not flagged.
 */
function resourcePolicyAllowsBroadPrincipal(policyDoc: string): boolean {
  let parsed: { Statement?: PolicyStatement | PolicyStatement[] };
  try {
    parsed = JSON.parse(policyDoc) as {
      Statement?: PolicyStatement | PolicyStatement[];
    };
  } catch {
    return false;
  }

  const statements = parsed.Statement
    ? Array.isArray(parsed.Statement)
      ? parsed.Statement
      : [parsed.Statement]
    : [];

  for (const stmt of statements) {
    if (stmt.Effect !== "Allow") continue;
    if (stmt.Condition && Object.keys(stmt.Condition).length > 0) continue;

    const principal = stmt.Principal;
    if (principal === "*") return true;
    if (principal && typeof principal === "object") {
      const awsPrincipal = principal.AWS;
      if (awsPrincipal === "*") return true;
      if (Array.isArray(awsPrincipal) && awsPrincipal.some((p) => p === "*")) {
        return true;
      }
    }
  }

  return false;
}
