// REAL IMPL (BLACKFYRE 2026-06): mocked-SDK unit tests for the real SQS/SNS
// auditor. The AWS SDK clients are vi.mock'd so findings are asserted purely
// from injected resource attributes (no live AWS, no canned auditor data).
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AwsTemporaryCredentials } from "../../src/agents/aws/credentials.js";

// ---- Shared mock credentials ----
function makeMockCreds(): AwsTemporaryCredentials {
  return {
    accessKeyId: "AKIA-TEST",
    secretAccessKey: "secret-test",
    sessionToken: "token-test",
  };
}

// ---- Hoisted mock state ----
// vi.mock factories are hoisted above all top-level declarations, so anything
// the factories reference must be created inside vi.hoisted() to avoid the
// temporal dead zone. We declare the send() spies and AWS SDK command classes
// here so the @aws-sdk/* mock factories below can close over them safely.
const {
  sqsSend,
  snsSend,
  ListQueuesCommand,
  GetQueueAttributesCommand,
  ListTopicsCommand,
  GetTopicAttributesCommand,
} = vi.hoisted(() => {
  class ListQueuesCommand {
    constructor(public input: unknown) {}
  }
  class GetQueueAttributesCommand {
    constructor(public input: { QueueUrl?: string }) {}
  }
  class ListTopicsCommand {
    constructor(public input: unknown) {}
  }
  class GetTopicAttributesCommand {
    constructor(public input: { TopicArn?: string }) {}
  }
  return {
    sqsSend: vi.fn(),
    snsSend: vi.fn(),
    ListQueuesCommand,
    GetQueueAttributesCommand,
    ListTopicsCommand,
    GetTopicAttributesCommand,
  };
});

// ---- Mock: @aws-sdk/client-sqs ----
// A single send() per client routes by command class name.
vi.mock("@aws-sdk/client-sqs", () => ({
  SQSClient: vi.fn().mockImplementation(() => ({ send: sqsSend })),
  ListQueuesCommand,
  GetQueueAttributesCommand,
}));

// ---- Mock: @aws-sdk/client-sns ----
vi.mock("@aws-sdk/client-sns", () => ({
  SNSClient: vi.fn().mockImplementation(() => ({ send: snsSend })),
  ListTopicsCommand,
  GetTopicAttributesCommand,
}));

// ---- Mock: compliance-mapper (return a non-empty mapping for any check) ----
vi.mock("../../src/services/compliance-mapper.js", () => ({
  mapCheckToControls: vi.fn().mockImplementation(() => [
    {
      framework: "soc2",
      controlId: "CC6.1",
      controlName: "Test Control",
      status: "fail",
      weight: 3,
    },
  ]),
}));

// ---- Mock: credentials resolution (used by run()/testConnection()) ----
vi.mock("../../src/agents/aws/credentials.js", () => ({
  resolveCredentials: vi.fn().mockResolvedValue({
    accessKeyId: "AKIA-TEST",
    secretAccessKey: "secret-test",
    sessionToken: "token-test",
  }),
}));

// ---- Import after mocks ----
import { auditSqsSns } from "../../src/agents/aws/sqs-sns-auditor.js";

const QUEUE_URL = "https://sqs.us-east-1.amazonaws.com/123456789012/my-queue";
const QUEUE_ARN = "arn:aws:sqs:us-east-1:123456789012:my-queue";
const TOPIC_ARN = "arn:aws:sns:us-west-2:123456789012:my-topic";

// Route the SQS client's send() based on the command instance.
function routeSqs(opts: {
  queueUrls: string[];
  attributes: Record<string, string>;
}) {
  sqsSend.mockImplementation(async (cmd: unknown) => {
    if (cmd instanceof ListQueuesCommand) {
      return { QueueUrls: opts.queueUrls };
    }
    if (cmd instanceof GetQueueAttributesCommand) {
      return { Attributes: opts.attributes };
    }
    throw new Error("unexpected SQS command");
  });
}

// Route the SNS client's send() based on the command instance.
function routeSns(opts: {
  topicArns: string[];
  attributes: Record<string, string>;
}) {
  snsSend.mockImplementation(async (cmd: unknown) => {
    if (cmd instanceof ListTopicsCommand) {
      return { Topics: opts.topicArns.map((arn) => ({ TopicArn: arn })) };
    }
    if (cmd instanceof GetTopicAttributesCommand) {
      return { Attributes: opts.attributes };
    }
    throw new Error("unexpected SNS command");
  });
}

describe("auditSqsSns", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: no topics, so SNS contributes nothing unless overridden.
    routeSns({ topicArns: [], attributes: {} });
    // Default: no queues, so SQS contributes nothing unless overridden.
    routeSqs({ queueUrls: [], attributes: {} });
  });

  // ---- SQS encryption check ----
  it("FAIL: flags an SQS queue with no SSE and no DLQ", async () => {
    routeSqs({
      queueUrls: [QUEUE_URL],
      // No KmsMasterKeyId, SqsManagedSseEnabled not "true", no RedrivePolicy.
      attributes: { QueueArn: QUEUE_ARN, SqsManagedSseEnabled: "false" },
    });

    const findings = await auditSqsSns(makeMockCreds());

    const enc = findings.find(
      (f) =>
        f.resourceType === "AWS::SQS::Queue" &&
        f.title.includes("server-side encryption"),
    );
    expect(enc).toBeDefined();
    expect(enc!.severity).toBe("high");
    expect(enc!.category).toBe("encryption");
    expect(enc!.resourceId).toBe(QUEUE_ARN);
    expect(enc!.resourceRegion).toBe("us-east-1");
    expect(enc!.controlMappings!.length).toBeGreaterThan(0);

    const dlq = findings.find(
      (f) =>
        f.resourceType === "AWS::SQS::Queue" &&
        f.title.includes("dead-letter queue"),
    );
    expect(dlq).toBeDefined();
    expect(dlq!.severity).toBe("medium");
  });

  it("PASS: SQS queue with KMS encryption and a DLQ produces no SQS findings", async () => {
    routeSqs({
      queueUrls: [QUEUE_URL],
      attributes: {
        QueueArn: QUEUE_ARN,
        KmsMasterKeyId: "alias/aws/sqs",
        RedrivePolicy: JSON.stringify({
          deadLetterTargetArn: "arn:aws:sqs:us-east-1:123456789012:my-dlq",
          maxReceiveCount: 5,
        }),
      },
    });

    const findings = await auditSqsSns(makeMockCreds());

    const sqsFindings = findings.filter(
      (f) => f.resourceType === "AWS::SQS::Queue",
    );
    expect(sqsFindings).toHaveLength(0);
  });

  // ---- SNS public-access policy check ----
  it("FAIL: flags an SNS topic whose policy allows any principal", async () => {
    routeSns({
      topicArns: [TOPIC_ARN],
      attributes: {
        // Encrypted, so only the public-access finding should appear.
        KmsMasterKeyId: "alias/aws/sns",
        Policy: JSON.stringify({
          Version: "2008-10-17",
          Statement: [
            {
              Effect: "Allow",
              Principal: "*",
              Action: "SNS:Publish",
              Resource: TOPIC_ARN,
            },
          ],
        }),
      },
    });

    const findings = await auditSqsSns(makeMockCreds());

    const pub = findings.find(
      (f) =>
        f.resourceType === "AWS::SNS::Topic" &&
        f.title.includes("public access"),
    );
    expect(pub).toBeDefined();
    expect(pub!.severity).toBe("critical");
    expect(pub!.category).toBe("iam");
    expect(pub!.resourceId).toBe(TOPIC_ARN);
    expect(pub!.resourceRegion).toBe("us-west-2");
    expect(pub!.controlMappings!.length).toBeGreaterThan(0);
  });

  it("PASS: SNS topic with KMS and a wildcard principal scoped by a Condition produces no public-access finding", async () => {
    routeSns({
      topicArns: [TOPIC_ARN],
      attributes: {
        KmsMasterKeyId: "alias/aws/sns",
        Policy: JSON.stringify({
          Version: "2008-10-17",
          Statement: [
            {
              Effect: "Allow",
              Principal: "*",
              Action: "SNS:Publish",
              Resource: TOPIC_ARN,
              // A scoping condition means this is not truly public.
              Condition: {
                StringEquals: { "aws:SourceAccount": "123456789012" },
              },
            },
          ],
        }),
      },
    });

    const findings = await auditSqsSns(makeMockCreds());

    const pub = findings.find(
      (f) =>
        f.resourceType === "AWS::SNS::Topic" &&
        f.title.includes("public access"),
    );
    expect(pub).toBeUndefined();
  });
});
