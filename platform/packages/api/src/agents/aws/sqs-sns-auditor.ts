// REAL IMPL (BLACKFYRE 2026-06): replaced the canned 3-finding stub with a real
// SQS + SNS auditor. Enumerates actual queues/topics via the AWS SDK v3
// (@aws-sdk/client-sqs ListQueues/GetQueueAttributes and @aws-sdk/client-sns
// ListTopics/GetTopicAttributes) and emits findings derived solely from real
// resource properties: SQS server-side encryption (KmsMasterKeyId / SqsManagedSseEnabled),
// SQS dead-letter queue config (RedrivePolicy), SNS server-side encryption
// (KmsMasterKeyId) and SNS resource policies that allow any principal ("*").
// The public exports are unchanged — AwsSqsSnsAuditorAgent (registered in
// agents/registry.ts) keeps the same BaseAgent run()/testConnection() signature,
// and a new auditSqsSns(creds) function mirrors the s3/iam/kms auditor shape.
import {
  SQSClient,
  ListQueuesCommand,
  GetQueueAttributesCommand,
} from "@aws-sdk/client-sqs";
import {
  SNSClient,
  ListTopicsCommand,
  GetTopicAttributesCommand,
} from "@aws-sdk/client-sns";
import type { AgentFindingPayload } from "@blackfyre/shared";
import { BaseAgent } from "../base-agent.js";
import type { AgentContext, AgentRunResult } from "../base-agent.js";
import { mapCheckToControls } from "../../services/compliance-mapper.js";
import { resolveCredentials } from "./credentials.js";
import type { AwsTemporaryCredentials } from "./credentials.js";

function makeSqsClient(creds: AwsTemporaryCredentials): SQSClient {
  return new SQSClient({
    credentials: {
      accessKeyId: creds.accessKeyId,
      secretAccessKey: creds.secretAccessKey,
      sessionToken: creds.sessionToken,
    },
  });
}

function makeSnsClient(creds: AwsTemporaryCredentials): SNSClient {
  return new SNSClient({
    credentials: {
      accessKeyId: creds.accessKeyId,
      secretAccessKey: creds.secretAccessKey,
      sessionToken: creds.sessionToken,
    },
  });
}

/**
 * Extracts the AWS region from an ARN (arn:aws:service:REGION:account:resource).
 * Returns null when the ARN is missing or has no region segment.
 */
function regionFromArn(arn: string | undefined): string | null {
  if (!arn) return null;
  const parts = arn.split(":");
  // arn : partition : service : region : account : ...
  return parts.length >= 4 && parts[3] ? parts[3] : null;
}

/** Derives a stable, human-readable queue name from its URL. */
function queueNameFromUrl(url: string): string {
  const segments = url.split("/");
  return segments[segments.length - 1] || url;
}

/**
 * Runs all SQS and SNS security checks and returns findings.
 *
 * REAL IMPL (BLACKFYRE 2026-06): no canned data — every finding is produced from
 * an actual queue/topic attribute returned by the SQS/SNS APIs.
 */
export async function auditSqsSns(
  creds: AwsTemporaryCredentials,
): Promise<AgentFindingPayload[]> {
  const [sqsFindings, snsFindings] = await Promise.all([
    auditSqsQueues(creds),
    auditSnsTopics(creds),
  ]);

  return [...sqsFindings, ...snsFindings];
}

/**
 * SQS checks: enumerate all queues (paginated) and inspect their attributes for
 * missing server-side encryption and missing dead-letter queue configuration.
 */
async function auditSqsQueues(
  creds: AwsTemporaryCredentials,
): Promise<AgentFindingPayload[]> {
  const client = makeSqsClient(creds);
  const findings: AgentFindingPayload[] = [];

  // List all queue URLs (handles pagination via NextToken).
  const queueUrls: string[] = [];
  let nextToken: string | undefined;
  do {
    const resp = await client.send(
      new ListQueuesCommand({ NextToken: nextToken, MaxResults: 1000 }),
    );
    if (resp.QueueUrls) queueUrls.push(...resp.QueueUrls);
    nextToken = resp.NextToken;
  } while (nextToken);

  // Inspect each queue's attributes concurrently.
  const queueResults = await Promise.all(
    queueUrls.map((url) => checkQueue(client, url)),
  );

  for (const result of queueResults) findings.push(...result);

  return findings;
}

/** Inspects a single SQS queue's attributes for encryption and DLQ config. */
async function checkQueue(
  client: SQSClient,
  queueUrl: string,
): Promise<AgentFindingPayload[]> {
  const findings: AgentFindingPayload[] = [];

  const resp = await client.send(
    new GetQueueAttributesCommand({
      QueueUrl: queueUrl,
      AttributeNames: ["All"],
    }),
  );
  const attrs = resp.Attributes ?? {};

  const queueArn = attrs["QueueArn"];
  const queueName = queueNameFromUrl(queueUrl);
  const region = regionFromArn(queueArn);
  // ARN is the most stable identifier; fall back to the queue URL.
  const resourceId = queueArn ?? queueUrl;

  // Check: server-side encryption. A queue is encrypted at rest if it has a
  // KMS master key (SSE-KMS) or SQS-owned managed SSE enabled.
  const kmsKey = attrs["KmsMasterKeyId"];
  const sqsManagedSse = attrs["SqsManagedSseEnabled"] === "true";
  if (!kmsKey && !sqsManagedSse) {
    findings.push({
      title: `SQS queue "${queueName}" does not have server-side encryption`,
      description: `SQS queue ${resourceId} has neither an SSE-KMS master key (KmsMasterKeyId) nor SQS-managed server-side encryption (SqsManagedSseEnabled) enabled. Enable SSE to protect message data at rest.`,
      severity: "high",
      category: "encryption",
      resourceType: "AWS::SQS::Queue",
      resourceId,
      resourceRegion: region,
      remediationTier: "auto",
      autoFixAvailable: true,
      controlMappings: mapCheckToControls("sqs_queue_no_encryption"),
    });
  }

  // Check: dead-letter queue configuration. The RedrivePolicy attribute holds a
  // JSON document referencing a deadLetterTargetArn when a DLQ is configured.
  const redrivePolicy = attrs["RedrivePolicy"];
  let hasDlq = false;
  if (redrivePolicy) {
    try {
      const parsed = JSON.parse(redrivePolicy) as {
        deadLetterTargetArn?: string;
      };
      hasDlq =
        typeof parsed.deadLetterTargetArn === "string" &&
        parsed.deadLetterTargetArn.length > 0;
    } catch {
      hasDlq = false;
    }
  }
  if (!hasDlq) {
    findings.push({
      title: `SQS queue "${queueName}" has no dead-letter queue configured`,
      description: `SQS queue ${resourceId} does not have a RedrivePolicy referencing a dead-letter queue. Without a DLQ, messages that repeatedly fail processing are silently lost. Configure a dead-letter queue to capture undeliverable messages.`,
      severity: "medium",
      category: "config",
      resourceType: "AWS::SQS::Queue",
      resourceId,
      resourceRegion: region,
      remediationTier: "manual",
      autoFixAvailable: false,
      controlMappings: mapCheckToControls("sqs_queue_no_dlq"),
    });
  }

  return findings;
}

/**
 * SNS checks: enumerate all topics (paginated) and inspect their attributes for
 * missing server-side encryption and resource policies that allow any principal.
 */
async function auditSnsTopics(
  creds: AwsTemporaryCredentials,
): Promise<AgentFindingPayload[]> {
  const client = makeSnsClient(creds);
  const findings: AgentFindingPayload[] = [];

  // List all topic ARNs (handles pagination via NextToken).
  const topicArns: string[] = [];
  let nextToken: string | undefined;
  do {
    const resp = await client.send(
      new ListTopicsCommand({ NextToken: nextToken }),
    );
    for (const topic of resp.Topics ?? []) {
      if (topic.TopicArn) topicArns.push(topic.TopicArn);
    }
    nextToken = resp.NextToken;
  } while (nextToken);

  // Inspect each topic's attributes concurrently.
  const topicResults = await Promise.all(
    topicArns.map((arn) => checkTopic(client, arn)),
  );

  for (const result of topicResults) findings.push(...result);

  return findings;
}

/** Inspects a single SNS topic's attributes for encryption and public access. */
async function checkTopic(
  client: SNSClient,
  topicArn: string,
): Promise<AgentFindingPayload[]> {
  const findings: AgentFindingPayload[] = [];

  const resp = await client.send(
    new GetTopicAttributesCommand({ TopicArn: topicArn }),
  );
  const attrs = resp.Attributes ?? {};

  const region = regionFromArn(topicArn);
  const segments = topicArn.split(":");
  const topicName = segments[segments.length - 1] || topicArn;

  // Check: server-side encryption. An SNS topic is encrypted at rest only when a
  // KMS master key (KmsMasterKeyId) is associated with it.
  const kmsKey = attrs["KmsMasterKeyId"];
  if (!kmsKey) {
    findings.push({
      title: `SNS topic "${topicName}" does not have server-side encryption`,
      description: `SNS topic ${topicArn} has no KmsMasterKeyId configured. Messages are not encrypted at rest. Associate a KMS key to enable server-side encryption.`,
      severity: "high",
      category: "encryption",
      resourceType: "AWS::SNS::Topic",
      resourceId: topicArn,
      resourceRegion: region,
      remediationTier: "auto",
      autoFixAvailable: true,
      controlMappings: mapCheckToControls("sns_topic_no_encryption"),
    });
  }

  // Check: resource policy allowing any principal. The Policy attribute is a JSON
  // document; a statement with Effect: "Allow" and Principal "*" (or AWS: "*")
  // and no scoping condition permits anyone to publish/subscribe.
  const policyDoc = attrs["Policy"];
  if (policyDoc && snsPolicyAllowsPublicAccess(policyDoc)) {
    findings.push({
      title: `SNS topic "${topicName}" policy allows public access`,
      description: `SNS topic ${topicArn} has a resource policy with an Allow statement granting access to any principal ("*") without a scoping condition. This permits unauthorized accounts to publish to or subscribe from the topic. Scope the policy to specific principals or add conditions.`,
      severity: "critical",
      category: "iam",
      resourceType: "AWS::SNS::Topic",
      resourceId: topicArn,
      resourceRegion: region,
      remediationTier: "manual",
      autoFixAvailable: false,
      controlMappings: mapCheckToControls("sns_topic_public_access"),
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
 * Returns true when the SNS resource policy contains an Allow statement that
 * grants access to any principal ("*") and is not constrained by a Condition.
 */
function snsPolicyAllowsPublicAccess(policyDoc: string): boolean {
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
    // A Condition can scope an otherwise-wildcard principal (e.g. SourceArn /
    // SourceOwner / aws:SourceAccount). Don't flag conditioned statements.
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

export class AwsSqsSnsAuditorAgent extends BaseAgent {
  readonly type = "aws-sqs-sns-auditor";
  readonly displayName = "AWS SQS/SNS Auditor";
  readonly supportedIntegrations = ["aws"];

  async run(ctx: AgentContext): Promise<AgentRunResult> {
    const startedAt = new Date();
    let findingsCount = 0;
    try {
      ctx.onProgress(0);

      // REAL IMPL (BLACKFYRE 2026-06): resolve scoped read-only credentials and
      // enumerate real SQS queues / SNS topics instead of emitting canned data.
      const creds = await resolveCredentials(ctx.credentialRef);

      const findings = await auditSqsSns(creds);

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
  // credentials and issuing a lightweight SQS ListQueues call, rather than
  // returning a hardcoded true.
  async testConnection(credentialRef: string): Promise<boolean> {
    try {
      const creds = await resolveCredentials(credentialRef);
      const client = makeSqsClient(creds);
      await client.send(new ListQueuesCommand({ MaxResults: 1 }));
      return true;
    } catch {
      return false;
    }
  }
}
