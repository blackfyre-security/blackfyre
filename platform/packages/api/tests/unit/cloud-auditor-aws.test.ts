// REAL IMPL (BLACKFYRE 2026-06): mocked-SDK unit test for the AWS orchestrator
// wiring. The orchestrator (CloudAuditorAwsAgent) fans out to the per-service
// sub-auditors; here we mock each sub-auditor module + credentials/STS resolution
// so no real AWS call is made, then assert that the orchestrator (a) actually
// invokes the newly wired phases (RDS / Lambda / ECS / ECR / EKS / SQS-SNS /
// Secrets Manager / GuardDuty / WAF), (b) forwards every returned finding through
// ctx.onFinding and counts them, and (c) surfaces a thrown sub-auditor error.
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AgentFindingPayload } from "@blackfyre/shared";

// ---- Mock: credentials resolution (avoid real STS AssumeRole) ----
const mockCreds = {
  accessKeyId: "AKIA_TEST",
  secretAccessKey: "secret",
  sessionToken: "token",
};
const resolveCredentials = vi.fn().mockResolvedValue(mockCreds);
vi.mock("../../src/agents/aws/credentials.js", () => ({
  resolveCredentials: (ref: string) => resolveCredentials(ref),
}));

// ---- Mock: STS client (testConnection path) ----
const stsSend = vi.fn();
vi.mock("@aws-sdk/client-sts", () => ({
  STSClient: vi.fn().mockImplementation(() => ({ send: stsSend })),
  GetCallerIdentityCommand: vi.fn().mockImplementation((input: unknown) => ({ input })),
}));

// ---- Mock: every sub-auditor module ----
// Existing (already-wired) phases — return no findings by default.
const auditIAM = vi.fn().mockResolvedValue([]);
const auditS3 = vi.fn().mockResolvedValue([]);
const auditEC2VPC = vi.fn().mockResolvedValue([]);
const auditCloudTrail = vi.fn().mockResolvedValue([]);
const auditKMS = vi.fn().mockResolvedValue([]);
// Newly wired phases — these are what this test is guarding.
const auditRDS = vi.fn().mockResolvedValue([]);
const auditLambda = vi.fn().mockResolvedValue([]);
const auditEcsTaskDefinitions = vi.fn().mockResolvedValue([]);
const auditEcrRepositories = vi.fn().mockResolvedValue([]);
const auditEksClusters = vi.fn().mockResolvedValue([]);
const auditSqsSns = vi.fn().mockResolvedValue([]);
const auditSecretsManager = vi.fn().mockResolvedValue([]);
const auditGuardDuty = vi.fn().mockResolvedValue([]);
const auditWaf = vi.fn().mockResolvedValue([]);
const auditConfig = vi.fn().mockResolvedValue([]);

vi.mock("../../src/agents/aws/iam-auditor.js", () => ({ auditIAM: () => auditIAM() }));
vi.mock("../../src/agents/aws/s3-auditor.js", () => ({ auditS3: () => auditS3() }));
vi.mock("../../src/agents/aws/ec2-vpc-auditor.js", () => ({ auditEC2VPC: () => auditEC2VPC() }));
vi.mock("../../src/agents/aws/cloudtrail-auditor.js", () => ({ auditCloudTrail: () => auditCloudTrail() }));
vi.mock("../../src/agents/aws/kms-auditor.js", () => ({ auditKMS: () => auditKMS() }));
vi.mock("../../src/agents/aws/rds-auditor.js", () => ({ auditRDS: () => auditRDS() }));
vi.mock("../../src/agents/aws/lambda-auditor.js", () => ({ auditLambda: () => auditLambda() }));
vi.mock("../../src/agents/aws/ecs-eks-auditor.js", () => ({
  auditEcsTaskDefinitions: () => auditEcsTaskDefinitions(),
  auditEcrRepositories: () => auditEcrRepositories(),
  auditEksClusters: () => auditEksClusters(),
}));
vi.mock("../../src/agents/aws/sqs-sns-auditor.js", () => ({ auditSqsSns: () => auditSqsSns() }));
vi.mock("../../src/agents/aws/secrets-manager-auditor.js", () => ({ auditSecretsManager: () => auditSecretsManager() }));
vi.mock("../../src/agents/aws/guardduty-auditor.js", () => ({ auditGuardDuty: () => auditGuardDuty() }));
vi.mock("../../src/agents/aws/waf-auditor.js", () => ({ auditWaf: () => auditWaf() }));
vi.mock("../../src/agents/aws/config-auditor.js", () => ({ auditConfig: () => auditConfig() }));

// ---- Import after mocks ----
import { CloudAuditorAwsAgent } from "../../src/agents/cloud-auditor-aws.js";
import type { AgentContext } from "../../src/agents/base-agent.js";

function makeFinding(title: string): AgentFindingPayload {
  return {
    title,
    description: `${title} description`,
    severity: "high",
    category: "config",
    resourceType: "AWS::Test::Resource",
    resourceId: "arn:aws:test:us-east-1:123456789012:resource/x",
    resourceRegion: "us-east-1",
    remediationTier: "manual",
    autoFixAvailable: false,
  };
}

function makeCtx(): { ctx: AgentContext; findings: AgentFindingPayload[]; progress: number[] } {
  const findings: AgentFindingPayload[] = [];
  const progress: number[] = [];
  const ctx: AgentContext = {
    scanId: "scan-1",
    tenantId: "tenant-1",
    integrationId: "int-1",
    credentialRef: "arn:aws:iam::123456789012:role/blackfyre-audit",
    frameworks: ["soc2"],
    onProgress: (p) => { progress.push(p); },
    onFinding: async (f) => { findings.push(f); },
  };
  return { ctx, findings, progress };
}

describe("CloudAuditorAwsAgent orchestrator wiring (mocked sub-auditors)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolveCredentials.mockResolvedValue(mockCreds);
    // restore default empty resolutions after clearAllMocks
    for (const fn of [
      auditIAM, auditS3, auditEC2VPC, auditCloudTrail, auditKMS,
      auditRDS, auditLambda, auditEcsTaskDefinitions, auditEcrRepositories,
      auditEksClusters, auditSqsSns, auditSecretsManager, auditGuardDuty, auditWaf, auditConfig,
    ]) {
      fn.mockResolvedValue([]);
    }
  });

  it("PASS-case: invokes the newly wired phases and forwards their findings", async () => {
    // Give a couple of the *newly wired* auditors real findings to forward.
    auditRDS.mockResolvedValueOnce([makeFinding("RDS unencrypted")]);
    auditGuardDuty.mockResolvedValueOnce([
      makeFinding("GuardDuty disabled in us-east-1"),
      makeFinding("GuardDuty disabled in eu-west-1"),
    ]);
    auditWaf.mockResolvedValueOnce([makeFinding("WAF missing rate-limit rule")]);

    const { ctx, findings, progress } = makeCtx();
    const agent = new CloudAuditorAwsAgent();
    const result = await agent.run(ctx);

    // Credentials resolved exactly once and shared across phases.
    expect(resolveCredentials).toHaveBeenCalledTimes(1);

    // Every newly wired phase was actually invoked (proves they are wired in).
    expect(auditRDS).toHaveBeenCalledTimes(1);
    expect(auditLambda).toHaveBeenCalledTimes(1);
    expect(auditEcsTaskDefinitions).toHaveBeenCalledTimes(1);
    expect(auditEcrRepositories).toHaveBeenCalledTimes(1);
    expect(auditEksClusters).toHaveBeenCalledTimes(1);
    expect(auditSqsSns).toHaveBeenCalledTimes(1);
    expect(auditSecretsManager).toHaveBeenCalledTimes(1);
    expect(auditGuardDuty).toHaveBeenCalledTimes(1);
    expect(auditWaf).toHaveBeenCalledTimes(1);
    expect(auditConfig).toHaveBeenCalledTimes(1);

    // The pre-existing phases still run too.
    expect(auditIAM).toHaveBeenCalledTimes(1);
    expect(auditS3).toHaveBeenCalledTimes(1);

    // All findings from every phase are forwarded through ctx.onFinding and counted.
    expect(findings).toHaveLength(4);
    expect(findings.map((f) => f.title)).toContain("RDS unencrypted");
    expect(findings.map((f) => f.title)).toContain("WAF missing rate-limit rule");
    expect(result.findingsCount).toBe(4);
    expect(result.error).toBeNull();
    expect(result.agentType).toBe("cloud-auditor-aws");

    // Progress is monotonic and reaches 100.
    expect(progress[progress.length - 1]).toBe(100);
  });

  it("FAIL-case: a thrown sub-auditor error is surfaced on the result", async () => {
    auditSecretsManager.mockRejectedValueOnce(
      new Error("AccessDenied: secretsmanager:ListSecrets"),
    );

    const { ctx } = makeCtx();
    const agent = new CloudAuditorAwsAgent();
    const result = await agent.run(ctx);

    expect(result.error).toBe("AccessDenied: secretsmanager:ListSecrets");
    expect(result.agentType).toBe("cloud-auditor-aws");
  });

  it("testConnection returns true when STS GetCallerIdentity resolves an account", async () => {
    stsSend.mockResolvedValueOnce({ Account: "123456789012" });
    const agent = new CloudAuditorAwsAgent();
    const ok = await agent.testConnection("arn:aws:iam::123456789012:role/blackfyre-audit");
    expect(ok).toBe(true);
  });
});
