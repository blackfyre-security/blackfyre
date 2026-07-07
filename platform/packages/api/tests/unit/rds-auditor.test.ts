// REAL IMPL (BLACKFYRE 2026-06): mocked-SDK unit test for the real RDS auditor.
// Mocks @aws-sdk/client-rds so DescribeDBInstances returns crafted DBInstance
// objects, then asserts the auditor derives findings from the real properties.
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AwsTemporaryCredentials } from "../../src/agents/aws/credentials.js";

// ---- Shared mock RDS client send() ----
const mockSend = vi.fn();

vi.mock("@aws-sdk/client-rds", () => ({
  RDSClient: vi.fn().mockImplementation(() => ({ send: mockSend })),
  // The auditor constructs `new DescribeDBInstancesCommand(input)`; capture the
  // input on the instance so we can assert pagination if needed.
  DescribeDBInstancesCommand: vi
    .fn()
    .mockImplementation((input: unknown) => ({ input })),
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

// ---- Mock: credentials resolution (avoid real STS) ----
vi.mock("../../src/agents/aws/credentials.js", () => ({
  resolveCredentials: vi.fn().mockResolvedValue({
    accessKeyId: "AKIA_TEST",
    secretAccessKey: "secret",
    sessionToken: "token",
  }),
}));

// ---- Import after mocks ----
import { auditRDS } from "../../src/agents/aws/rds-auditor.js";

function makeMockCreds(): AwsTemporaryCredentials {
  return {
    accessKeyId: "AKIA_TEST",
    secretAccessKey: "secret",
    sessionToken: "token",
  };
}

const ARN = "arn:aws:rds:us-west-2:123456789012:db:my-db";

describe("auditRDS (real RDS auditor)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("PASS-case: a fully compliant instance produces no findings", async () => {
    mockSend.mockResolvedValueOnce({
      DBInstances: [
        {
          DBInstanceIdentifier: "my-db",
          DBInstanceArn: ARN,
          Engine: "postgres",
          EngineVersion: "16.2",
          StorageEncrypted: true,
          PubliclyAccessible: false,
          BackupRetentionPeriod: 14,
          MultiAZ: true,
        },
      ],
      Marker: undefined,
    });

    const findings = await auditRDS(makeMockCreds());
    expect(findings).toHaveLength(0);
  });

  it("FAIL-case (encryption): unencrypted storage yields a critical encryption finding with real resourceId/region", async () => {
    mockSend.mockResolvedValueOnce({
      DBInstances: [
        {
          DBInstanceIdentifier: "my-db",
          DBInstanceArn: ARN,
          Engine: "postgres",
          EngineVersion: "16.2",
          StorageEncrypted: false, // <- the only violation
          PubliclyAccessible: false,
          BackupRetentionPeriod: 14,
          MultiAZ: true,
        },
      ],
      Marker: undefined,
    });

    const findings = await auditRDS(makeMockCreds());

    const enc = findings.find((f) => f.category === "encryption");
    expect(enc).toBeDefined();
    expect(enc!.severity).toBe("critical");
    expect(enc!.resourceId).toBe(ARN);
    expect(enc!.resourceRegion).toBe("us-west-2");
    expect(enc!.controlMappings!.length).toBeGreaterThan(0);
    // No other violations present
    expect(findings).toHaveLength(1);
  });

  it("FAIL-case (public access): publicly accessible instance yields a critical network finding", async () => {
    mockSend.mockResolvedValueOnce({
      DBInstances: [
        {
          DBInstanceIdentifier: "my-db",
          DBInstanceArn: ARN,
          Engine: "mysql",
          EngineVersion: "8.0.35",
          StorageEncrypted: true,
          PubliclyAccessible: true, // <- the only violation
          BackupRetentionPeriod: 7,
          MultiAZ: true,
        },
      ],
      Marker: undefined,
    });

    const findings = await auditRDS(makeMockCreds());

    const pub = findings.find((f) => f.category === "network");
    expect(pub).toBeDefined();
    expect(pub!.severity).toBe("critical");
    expect(pub!.title).toContain("publicly accessible");
    expect(findings).toHaveLength(1);
  });

  it("FAIL-case (backups + multi-AZ + deprecated engine): emits all three findings", async () => {
    mockSend.mockResolvedValueOnce({
      DBInstances: [
        {
          DBInstanceIdentifier: "legacy-db",
          DBInstanceArn: ARN,
          Engine: "mysql",
          EngineVersion: "5.7.44", // <- deprecated (floor is 5.7)
          StorageEncrypted: true,
          PubliclyAccessible: false,
          BackupRetentionPeriod: 0, // <- backups disabled
          MultiAZ: false, // <- not multi-AZ
        },
      ],
      Marker: undefined,
    });

    const findings = await auditRDS(makeMockCreds());

    expect(findings.some((f) => f.title.includes("automated backups disabled"))).toBe(true);
    expect(findings.some((f) => f.title.includes("not configured for Multi-AZ"))).toBe(true);
    expect(findings.some((f) => f.title.includes("deprecated engine version"))).toBe(true);
    expect(findings).toHaveLength(3);
  });

  it("paginates over the Marker until exhausted", async () => {
    mockSend
      .mockResolvedValueOnce({
        DBInstances: [
          {
            DBInstanceIdentifier: "db-1",
            DBInstanceArn: ARN,
            Engine: "postgres",
            EngineVersion: "16.2",
            StorageEncrypted: false, // 1 finding
            PubliclyAccessible: false,
            BackupRetentionPeriod: 14,
            MultiAZ: true,
          },
        ],
        Marker: "page-2",
      })
      .mockResolvedValueOnce({
        DBInstances: [
          {
            DBInstanceIdentifier: "db-2",
            DBInstanceArn: ARN,
            Engine: "postgres",
            EngineVersion: "16.2",
            StorageEncrypted: true,
            PubliclyAccessible: true, // 1 finding
            BackupRetentionPeriod: 14,
            MultiAZ: true,
          },
        ],
        Marker: undefined,
      });

    const findings = await auditRDS(makeMockCreds());

    expect(mockSend).toHaveBeenCalledTimes(2);
    expect(findings).toHaveLength(2);
  });
});
