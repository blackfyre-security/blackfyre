// REAL IMPL (BLACKFYRE 2026-06): mocked-SDK unit test for the real ECS/EKS/ECR
// auditor. Mocks @aws-sdk/client-ecs, @aws-sdk/client-ecr and @aws-sdk/client-eks
// so list/describe calls return crafted resources, then asserts the auditor
// derives findings (and non-findings) from the real resource properties:
// ContainerDefinition.privileged, plaintext secret env vars,
// ECR imageScanningConfiguration.scanOnPush, EKS logging + endpointPublicAccess.
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AwsTemporaryCredentials } from "../../src/agents/aws/credentials.js";

// ---- Per-client mock send() functions ----
const ecsSend = vi.fn();
const ecrSend = vi.fn();
const eksSend = vi.fn();

vi.mock("@aws-sdk/client-ecs", () => ({
  ECSClient: vi.fn().mockImplementation(() => ({ send: ecsSend })),
  ListTaskDefinitionsCommand: vi
    .fn()
    .mockImplementation((input: unknown) => ({ _cmd: "ListTaskDefinitions", input })),
  DescribeTaskDefinitionCommand: vi
    .fn()
    .mockImplementation((input: unknown) => ({ _cmd: "DescribeTaskDefinition", input })),
}));

vi.mock("@aws-sdk/client-ecr", () => ({
  ECRClient: vi.fn().mockImplementation(() => ({ send: ecrSend })),
  DescribeRepositoriesCommand: vi
    .fn()
    .mockImplementation((input: unknown) => ({ _cmd: "DescribeRepositories", input })),
}));

vi.mock("@aws-sdk/client-eks", () => ({
  EKSClient: vi.fn().mockImplementation(() => ({ send: eksSend })),
  ListClustersCommand: vi
    .fn()
    .mockImplementation((input: unknown) => ({ _cmd: "ListClusters", input })),
  DescribeClusterCommand: vi
    .fn()
    .mockImplementation((input: unknown) => ({ _cmd: "DescribeCluster", input })),
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

// ---- Import after mocks ----
import {
  auditEcsTaskDefinitions,
  auditEcrRepositories,
  auditEksClusters,
} from "../../src/agents/aws/ecs-eks-auditor.js";

function makeMockCreds(): AwsTemporaryCredentials {
  return {
    accessKeyId: "AKIA_TEST",
    secretAccessKey: "secret",
    sessionToken: "token",
  };
}

const TD_ARN = "arn:aws:ecs:us-west-2:123456789012:task-definition/web:7";
const REPO_ARN = "arn:aws:ecr:eu-central-1:123456789012:repository/app";
const CLUSTER_ARN = "arn:aws:eks:ap-south-1:123456789012:cluster/prod";

describe("auditEcsTaskDefinitions (real ECS auditor)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("PASS-case: non-privileged container with no plaintext secrets produces no findings", async () => {
    // First call = ListTaskDefinitions, second = DescribeTaskDefinition.
    ecsSend
      .mockResolvedValueOnce({ taskDefinitionArns: [TD_ARN], nextToken: undefined })
      .mockResolvedValueOnce({
        taskDefinition: {
          taskDefinitionArn: TD_ARN,
          family: "web",
          containerDefinitions: [
            {
              name: "app",
              privileged: false,
              environment: [{ name: "LOG_LEVEL", value: "info" }],
              // Secret correctly referenced via the secrets block (not env).
              secrets: [{ name: "DB_PASSWORD", valueFrom: "arn:aws:secretsmanager:..." }],
            },
          ],
        },
      });

    const findings = await auditEcsTaskDefinitions(makeMockCreds());
    expect(findings).toHaveLength(0);
  });

  it("FAIL-case: privileged container + plaintext secret env var yield two critical findings with real resourceId/region", async () => {
    ecsSend
      .mockResolvedValueOnce({ taskDefinitionArns: [TD_ARN], nextToken: undefined })
      .mockResolvedValueOnce({
        taskDefinition: {
          taskDefinitionArn: TD_ARN,
          family: "web",
          containerDefinitions: [
            {
              name: "app",
              privileged: true, // <- violation 1
              environment: [
                { name: "LOG_LEVEL", value: "info" },
                { name: "DB_PASSWORD", value: "hunter2" }, // <- violation 2 (plaintext secret)
              ],
            },
          ],
        },
      });

    const findings = await auditEcsTaskDefinitions(makeMockCreds());

    const priv = findings.find((f) => f.category === "config");
    expect(priv).toBeDefined();
    expect(priv!.severity).toBe("critical");
    expect(priv!.title).toContain("privileged mode");
    expect(priv!.resourceId).toBe(TD_ARN);
    expect(priv!.resourceRegion).toBe("us-west-2");
    expect(priv!.controlMappings!.length).toBeGreaterThan(0);

    const secret = findings.find((f) => f.category === "encryption");
    expect(secret).toBeDefined();
    expect(secret!.severity).toBe("critical");
    expect(secret!.title).toContain("DB_PASSWORD");
    expect(secret!.resourceRegion).toBe("us-west-2");

    expect(findings).toHaveLength(2);
  });

  it("paginates ListTaskDefinitions until nextToken is exhausted", async () => {
    ecsSend
      .mockResolvedValueOnce({ taskDefinitionArns: [TD_ARN], nextToken: "page-2" })
      .mockResolvedValueOnce({ taskDefinitionArns: [TD_ARN], nextToken: undefined })
      // DescribeTaskDefinition for the two collected ARNs:
      .mockResolvedValueOnce({
        taskDefinition: { taskDefinitionArn: TD_ARN, family: "a", containerDefinitions: [{ name: "c", privileged: true }] },
      })
      .mockResolvedValueOnce({
        taskDefinition: { taskDefinitionArn: TD_ARN, family: "b", containerDefinitions: [{ name: "c", privileged: false }] },
      });

    const findings = await auditEcsTaskDefinitions(makeMockCreds());
    // 2 list calls + 2 describe calls = 4 sends total.
    expect(ecsSend).toHaveBeenCalledTimes(4);
    expect(findings).toHaveLength(1);
  });
});

describe("auditEcrRepositories (real ECR auditor)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("PASS-case: repository with scanOnPush enabled produces no findings", async () => {
    ecrSend.mockResolvedValueOnce({
      repositories: [
        {
          repositoryName: "app",
          repositoryArn: REPO_ARN,
          imageScanningConfiguration: { scanOnPush: true },
        },
      ],
      nextToken: undefined,
    });

    const findings = await auditEcrRepositories(makeMockCreds());
    expect(findings).toHaveLength(0);
  });

  it("FAIL-case: repository without scanOnPush yields a high config finding with real resourceId/region", async () => {
    ecrSend.mockResolvedValueOnce({
      repositories: [
        {
          repositoryName: "app",
          repositoryArn: REPO_ARN,
          imageScanningConfiguration: { scanOnPush: false }, // <- violation
        },
      ],
      nextToken: undefined,
    });

    const findings = await auditEcrRepositories(makeMockCreds());

    expect(findings).toHaveLength(1);
    const f = findings[0];
    expect(f.severity).toBe("high");
    expect(f.category).toBe("config");
    expect(f.title).toContain("scan images on push");
    expect(f.resourceId).toBe(REPO_ARN);
    expect(f.resourceRegion).toBe("eu-central-1");
    expect(f.controlMappings!.length).toBeGreaterThan(0);
  });
});

describe("auditEksClusters (real EKS auditor)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("PASS-case: full logging + private endpoint produces no findings", async () => {
    eksSend
      .mockResolvedValueOnce({ clusters: ["prod"], nextToken: undefined })
      .mockResolvedValueOnce({
        cluster: {
          name: "prod",
          arn: CLUSTER_ARN,
          logging: {
            clusterLogging: [
              { enabled: true, types: ["api", "audit", "authenticator", "controllerManager", "scheduler"] },
            ],
          },
          resourcesVpcConfig: {
            endpointPublicAccess: false,
            endpointPrivateAccess: true,
            publicAccessCidrs: [],
          },
        },
      });

    const findings = await auditEksClusters(makeMockCreds());
    expect(findings).toHaveLength(0);
  });

  it("FAIL-case: disabled logging + world-open public endpoint yield logging + critical network findings", async () => {
    eksSend
      .mockResolvedValueOnce({ clusters: ["prod"], nextToken: undefined })
      .mockResolvedValueOnce({
        cluster: {
          name: "prod",
          arn: CLUSTER_ARN,
          logging: {
            clusterLogging: [{ enabled: false, types: ["api", "audit", "authenticator"] }], // <- logging off
          },
          resourcesVpcConfig: {
            endpointPublicAccess: true, // <- public endpoint
            endpointPrivateAccess: false,
            publicAccessCidrs: ["0.0.0.0/0"], // <- open to the world
          },
        },
      });

    const findings = await auditEksClusters(makeMockCreds());

    const logging = findings.find((f) => f.category === "logging");
    expect(logging).toBeDefined();
    expect(logging!.severity).toBe("medium");
    expect(logging!.resourceId).toBe(CLUSTER_ARN);
    expect(logging!.resourceRegion).toBe("ap-south-1");

    const network = findings.find((f) => f.category === "network");
    expect(network).toBeDefined();
    expect(network!.severity).toBe("critical"); // escalated because 0.0.0.0/0
    expect(network!.title).toContain("publicly accessible");
    expect(network!.controlMappings!.length).toBeGreaterThan(0);

    expect(findings).toHaveLength(2);
  });
});
