import { describe, it, expect, vi, beforeEach } from "vitest";

// ---- Mock external dependencies that may not be installed ----

vi.mock("@aws-sdk/client-sqs", () => ({
  SQSClient: vi.fn().mockImplementation(() => ({ send: vi.fn() })),
  SendMessageCommand: vi.fn(),
}));

// ---- Mock internal modules (must be declared before importing the module under test) ----

const mockDb = {} as any;
const mockCreateDb = vi.fn(() => ({ db: mockDb, superDb: mockDb, sql: vi.fn(), superSql: vi.fn() }));

vi.mock("../../src/db/connection.js", () => ({
  createDb: (...args: any[]) => mockCreateDb(...args),
}));

vi.mock("../../src/config.js", () => ({
  loadConfig: () => ({} as any),
}));

const mockMarkRunning = vi.fn();
const mockUpdateProgress = vi.fn();
const mockMarkCompleted = vi.fn();
const mockMarkFailed = vi.fn();

vi.mock("../../src/services/scan-service.js", () => ({
  ScanService: vi.fn().mockImplementation(() => ({
    markRunning: mockMarkRunning,
    updateProgress: mockUpdateProgress,
    markCompleted: mockMarkCompleted,
    markFailed: mockMarkFailed,
  })),
}));

const mockCreateFromAgent = vi.fn();

vi.mock("../../src/services/finding-service.js", () => ({
  FindingService: vi.fn().mockImplementation(() => ({
    createFromAgent: mockCreateFromAgent,
  })),
}));

const mockSnapshotScores = vi.fn();

vi.mock("../../src/services/compliance-service.js", () => ({
  ComplianceService: vi.fn().mockImplementation(() => ({
    snapshotScores: mockSnapshotScores,
  })),
}));

const mockRunSwarm = vi.fn();

vi.mock("../../src/agents/swarm-orchestrator.js", () => ({
  SwarmOrchestrator: vi.fn().mockImplementation(() => ({
    runSwarm: mockRunSwarm,
  })),
}));

vi.mock("../../src/queue/sqs-client.js", () => ({
  SqsQueue: vi.fn().mockImplementation(() => ({})),
}));

// ---- Import after mocks ----
import { handler } from "../../src/workers/scan-worker.js";

// ---- Helpers ----

function makeScanJobData(overrides: Record<string, unknown> = {}) {
  return {
    scanId: "scan-001",
    tenantId: "tenant-001",
    frameworks: ["soc2", "iso27001"],
    targets: ["aws"],
    triggeredBy: "user-001",
    integrations: [
      { id: "int-1", type: "aws", credentialRef: "vault://aws/int-1" },
    ],
    ...overrides,
  };
}

function makeSQSEvent(records: Array<{ jobName: string; data: ReturnType<typeof makeScanJobData> }>) {
  return {
    Records: records.map((r, i) => ({
      body: JSON.stringify(r),
      messageId: `msg-${i}`,
      receiptHandle: `rh-${i}`,
      md5OfBody: "",
      eventSource: "aws:sqs",
      eventSourceARN: "arn:aws:sqs:us-east-1:123:ScanJobsQueue",
      awsRegion: "us-east-1",
      attributes: {
        ApproximateReceiveCount: "1",
        SentTimestamp: "0",
        SenderId: "x",
        ApproximateFirstReceiveTimestamp: "0",
      },
      messageAttributes: {},
    })),
  };
}

function makeSwarmResult(overrides: Partial<{
  agentResults: Array<{ agentType: string; findingsCount: number; error: string | null; startedAt: Date; completedAt: Date }>;
  totalFindings: number;
}> = {}) {
  return {
    swarmId: "swarm_scan-001",
    totalFindings: 3,
    agentResults: [
      { agentType: "iam-auditor", findingsCount: 2, error: null, startedAt: new Date(), completedAt: new Date() },
      { agentType: "s3-auditor", findingsCount: 1, error: null, startedAt: new Date(), completedAt: new Date() },
    ],
    startedAt: new Date(),
    completedAt: new Date(),
    ...overrides,
  };
}

// ---- Tests ----

describe("scan-worker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRunSwarm.mockResolvedValue(makeSwarmResult());
  });

  it("calls ScanService.markRunning with scan ID and swarm ID before runSwarm", async () => {
    const data = makeScanJobData();
    const event = makeSQSEvent([{ jobName: "scan-scan-001", data }]);

    await handler(event);

    expect(mockMarkRunning).toHaveBeenCalledWith("scan-001", "swarm_scan-001");
    // markRunning should be called before runSwarm
    const markRunningOrder = mockMarkRunning.mock.invocationCallOrder[0];
    const runSwarmOrder = mockRunSwarm.mock.invocationCallOrder[0];
    expect(markRunningOrder).toBeLessThan(runSwarmOrder);
  });

  it("calls SwarmOrchestrator.runSwarm with correct SwarmConfig including onFinding calling findingService.createFromAgent", async () => {
    const data = makeScanJobData();
    const event = makeSQSEvent([{ jobName: "scan-scan-001", data }]);

    let capturedConfig: any;
    mockRunSwarm.mockImplementation(async (config: any) => {
      capturedConfig = config;
      await config.onFinding({ title: "test finding", controlMappings: [] }, "iam-auditor", "int-1");
      return makeSwarmResult();
    });

    await handler(event);

    expect(mockRunSwarm).toHaveBeenCalledOnce();
    expect(capturedConfig.scanId).toBe("scan-001");
    expect(capturedConfig.tenantId).toBe("tenant-001");
    expect(capturedConfig.frameworks).toEqual(["soc2", "iso27001"]);
    expect(capturedConfig.integrations).toEqual([
      { id: "int-1", type: "aws", credentialRef: "vault://aws/int-1" },
    ]);
    expect(mockCreateFromAgent).toHaveBeenCalledWith(
      "scan-001",
      "tenant-001",
      { title: "test finding", controlMappings: [] },
    );
  });

  it("calls ScanService.updateProgress from onProgress callback", async () => {
    const data = makeScanJobData();
    const event = makeSQSEvent([{ jobName: "scan-scan-001", data }]);

    mockRunSwarm.mockImplementation(async (config: any) => {
      await config.onProgress(50);
      return makeSwarmResult();
    });

    await handler(event);

    expect(mockUpdateProgress).toHaveBeenCalledWith("scan-001", 50);
  });

  it("calls ScanService.markCompleted(scanId, false) on full success (no agent errors)", async () => {
    const data = makeScanJobData();
    const event = makeSQSEvent([{ jobName: "scan-scan-001", data }]);

    mockRunSwarm.mockResolvedValue(makeSwarmResult({
      agentResults: [
        { agentType: "iam-auditor", findingsCount: 2, error: null, startedAt: new Date(), completedAt: new Date() },
      ],
    }));

    await handler(event);

    expect(mockMarkCompleted).toHaveBeenCalledWith("scan-001", false);
  });

  it("calls ComplianceService.snapshotScores after markCompleted", async () => {
    const data = makeScanJobData();
    const event = makeSQSEvent([{ jobName: "scan-scan-001", data }]);

    await handler(event);

    expect(mockSnapshotScores).toHaveBeenCalledWith("tenant-001", "scan-001");
    const markCompletedOrder = mockMarkCompleted.mock.invocationCallOrder[0];
    const snapshotOrder = mockSnapshotScores.mock.invocationCallOrder[0];
    expect(snapshotOrder).toBeGreaterThan(markCompletedOrder);
  });

  it("calls ScanService.markFailed(scanId, errorMessage) when runSwarm throws", async () => {
    const data = makeScanJobData();
    const event = makeSQSEvent([{ jobName: "scan-scan-001", data }]);

    mockRunSwarm.mockRejectedValue(new Error("AWS credentials expired"));

    await handler(event);

    expect(mockMarkFailed).toHaveBeenCalledWith("scan-001", "AWS credentials expired");
    expect(mockMarkCompleted).not.toHaveBeenCalled();
    expect(mockSnapshotScores).not.toHaveBeenCalled();
  });

  it("marks scan as completed_partial when SwarmResult has failed agents", async () => {
    const data = makeScanJobData();
    const event = makeSQSEvent([{ jobName: "scan-scan-001", data }]);

    mockRunSwarm.mockResolvedValue(makeSwarmResult({
      agentResults: [
        { agentType: "iam-auditor", findingsCount: 2, error: null, startedAt: new Date(), completedAt: new Date() },
        { agentType: "s3-auditor", findingsCount: 0, error: "S3 access denied", startedAt: new Date(), completedAt: new Date() },
      ],
    }));

    await handler(event);

    // hasErrors should be true because s3-auditor has a non-null error
    expect(mockMarkCompleted).toHaveBeenCalledWith("scan-001", true);
  });

  it("processes multiple SQS records sequentially", async () => {
    const data1 = makeScanJobData({ scanId: "scan-001", tenantId: "tenant-001" });
    const data2 = makeScanJobData({ scanId: "scan-002", tenantId: "tenant-002" });
    const event = makeSQSEvent([
      { jobName: "scan-scan-001", data: data1 },
      { jobName: "scan-scan-002", data: data2 },
    ]);

    const callOrder: string[] = [];
    mockMarkRunning.mockImplementation(async (scanId: string) => {
      callOrder.push(`markRunning:${scanId}`);
    });
    mockMarkCompleted.mockImplementation(async (scanId: string) => {
      callOrder.push(`markCompleted:${scanId}`);
    });

    await handler(event);

    expect(mockMarkRunning).toHaveBeenCalledTimes(2);
    expect(mockMarkCompleted).toHaveBeenCalledTimes(2);
    // Sequential: first scan completes before second starts
    expect(callOrder).toEqual([
      "markRunning:scan-001",
      "markCompleted:scan-001",
      "markRunning:scan-002",
      "markCompleted:scan-002",
    ]);
  });

  it("runs Azure integration through swarm orchestrator", async () => {
    const data = makeScanJobData({
      scanId: "scan-az-001",
      integrations: [
        { id: "int-az", type: "azure", credentialRef: "vault://azure/test" },
      ],
    });
    const event = makeSQSEvent([{ jobName: "scan-scan-az-001", data }]);

    mockRunSwarm.mockResolvedValue(makeSwarmResult({
      agentResults: [
        { agentType: "cloud-auditor-azure", findingsCount: 4, error: null, startedAt: new Date(), completedAt: new Date() },
      ],
      totalFindings: 4,
    }));

    let capturedConfig: any;
    mockRunSwarm.mockImplementation(async (config: any) => {
      capturedConfig = config;
      return makeSwarmResult({
        agentResults: [
          { agentType: "cloud-auditor-azure", findingsCount: 4, error: null, startedAt: new Date(), completedAt: new Date() },
        ],
        totalFindings: 4,
      });
    });

    await handler(event);

    expect(mockRunSwarm).toHaveBeenCalledOnce();
    expect(capturedConfig.integrations).toEqual([
      { id: "int-az", type: "azure", credentialRef: "vault://azure/test" },
    ]);
    expect(mockMarkCompleted).toHaveBeenCalledWith("scan-az-001", false);
  });

  it("runs GCP integration through swarm orchestrator", async () => {
    const data = makeScanJobData({
      scanId: "scan-gcp-001",
      integrations: [
        { id: "int-gcp", type: "gcp", credentialRef: "vault://gcp/test" },
      ],
    });
    const event = makeSQSEvent([{ jobName: "scan-scan-gcp-001", data }]);

    let capturedConfig: any;
    mockRunSwarm.mockImplementation(async (config: any) => {
      capturedConfig = config;
      return makeSwarmResult({
        agentResults: [
          { agentType: "cloud-auditor-gcp", findingsCount: 3, error: null, startedAt: new Date(), completedAt: new Date() },
        ],
        totalFindings: 3,
      });
    });

    await handler(event);

    expect(mockRunSwarm).toHaveBeenCalledOnce();
    expect(capturedConfig.integrations).toEqual([
      { id: "int-gcp", type: "gcp", credentialRef: "vault://gcp/test" },
    ]);
    expect(mockMarkCompleted).toHaveBeenCalledWith("scan-gcp-001", false);
  });

  it("runs multi-cloud scan with AWS + Azure + GCP integrations", async () => {
    const data = makeScanJobData({
      scanId: "scan-multi-001",
      integrations: [
        { id: "int-aws", type: "aws", credentialRef: "vault://aws/test" },
        { id: "int-az", type: "azure", credentialRef: "vault://azure/test" },
        { id: "int-gcp", type: "gcp", credentialRef: "vault://gcp/test" },
      ],
    });
    const event = makeSQSEvent([{ jobName: "scan-scan-multi-001", data }]);

    let capturedConfig: any;
    mockRunSwarm.mockImplementation(async (config: any) => {
      capturedConfig = config;
      return makeSwarmResult({
        agentResults: [
          { agentType: "cloud-auditor-aws", findingsCount: 5, error: null, startedAt: new Date(), completedAt: new Date() },
          { agentType: "cloud-auditor-azure", findingsCount: 4, error: null, startedAt: new Date(), completedAt: new Date() },
          { agentType: "cloud-auditor-gcp", findingsCount: 3, error: null, startedAt: new Date(), completedAt: new Date() },
        ],
        totalFindings: 12,
      });
    });

    await handler(event);

    expect(mockRunSwarm).toHaveBeenCalledOnce();
    expect(capturedConfig.integrations.length).toBe(3);
    expect(capturedConfig.integrations.map((i: any) => i.type)).toEqual(["aws", "azure", "gcp"]);
    expect(mockMarkCompleted).toHaveBeenCalledWith("scan-multi-001", false);
  });

  it("multi-cloud scan marks partial when one agent fails", async () => {
    const data = makeScanJobData({
      scanId: "scan-partial-001",
      integrations: [
        { id: "int-aws", type: "aws", credentialRef: "vault://aws/test" },
        { id: "int-az", type: "azure", credentialRef: "vault://azure/test" },
        { id: "int-gcp", type: "gcp", credentialRef: "vault://gcp/test" },
      ],
    });
    const event = makeSQSEvent([{ jobName: "scan-scan-partial-001", data }]);

    mockRunSwarm.mockResolvedValue(makeSwarmResult({
      agentResults: [
        { agentType: "cloud-auditor-aws", findingsCount: 5, error: null, startedAt: new Date(), completedAt: new Date() },
        { agentType: "cloud-auditor-azure", findingsCount: 0, error: "Azure credentials expired", startedAt: new Date(), completedAt: new Date() },
        { agentType: "cloud-auditor-gcp", findingsCount: 3, error: null, startedAt: new Date(), completedAt: new Date() },
      ],
      totalFindings: 8,
    }));

    await handler(event);

    // hasErrors should be true because azure agent has a non-null error
    expect(mockMarkCompleted).toHaveBeenCalledWith("scan-partial-001", true);
  });
});
