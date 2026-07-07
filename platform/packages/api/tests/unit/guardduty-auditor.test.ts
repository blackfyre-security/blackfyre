// REAL IMPL (BLACKFYRE 2026-06): mocked-SDK unit test for the real GuardDuty
// auditor. Mocks @aws-sdk/client-ec2 (region enumeration via DescribeRegions)
// and @aws-sdk/client-guardduty (ListDetectors/GetDetector) so no live AWS
// access occurs. Verifies the auditor enumerates regions, lists real detectors,
// reads each detector's real configuration, and emits findings from real
// properties: disabled detector status, disabled S3/EKS/malware protection, and
// the "no detector in region" case. Pass + fail cases for multiple checks.
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AwsTemporaryCredentials } from "../../src/agents/aws/credentials.js";

// ---- Mock @aws-sdk/client-ec2 (region discovery) ----
const ec2Send = vi.fn();
vi.mock("@aws-sdk/client-ec2", () => ({
  EC2Client: vi.fn().mockImplementation(() => ({ send: ec2Send })),
  DescribeRegionsCommand: vi
    .fn()
    .mockImplementation((input) => ({ _kind: "DescribeRegions", input })),
}));

// ---- Mock @aws-sdk/client-guardduty ----
const gdSend = vi.fn();
vi.mock("@aws-sdk/client-guardduty", () => ({
  GuardDutyClient: vi.fn().mockImplementation(() => ({ send: gdSend })),
  ListDetectorsCommand: vi
    .fn()
    .mockImplementation((input) => ({ _kind: "ListDetectors", input })),
  GetDetectorCommand: vi
    .fn()
    .mockImplementation((input) => ({ _kind: "GetDetector", input })),
}));

// ---- Mock compliance-mapper so findings carry non-empty control mappings ----
vi.mock("../../src/services/compliance-mapper.js", () => ({
  mapCheckToControls: vi.fn().mockImplementation((checkType: string) => [
    {
      framework: "soc2",
      controlId: "CC7.1",
      controlName: `Test Control for ${checkType}`,
      status: "fail",
      weight: 3,
    },
  ]),
}));

// ---- Import after mocks ----
import { auditGuardDuty } from "../../src/agents/aws/guardduty-auditor.js";

const creds: AwsTemporaryCredentials = {
  accessKeyId: "AKIA_TEST",
  secretAccessKey: "secret_test",
  sessionToken: "session_test",
};

/**
 * Wires the EC2 region enumeration to return the supplied region names.
 */
function wireRegions(regionNames: string[]) {
  ec2Send.mockImplementation(async (command: { _kind: string }) => {
    if (command._kind === "DescribeRegions") {
      return {
        Regions: regionNames.map((name) => ({
          RegionName: name,
          OptInStatus: "opt-in-not-required",
        })),
      };
    }
    throw new Error(`unexpected ec2 command ${command._kind}`);
  });
}

/**
 * Wires GuardDuty: ListDetectors returns the supplied detector IDs (one page),
 * and GetDetector returns the configuration keyed by detector ID.
 */
function wireGuardDuty(
  detectorIds: string[],
  detectorById: Record<string, Record<string, unknown>>,
) {
  gdSend.mockImplementation(
    async (command: { _kind: string; input: any }) => {
      if (command._kind === "ListDetectors") {
        return { DetectorIds: detectorIds, NextToken: undefined };
      }
      if (command._kind === "GetDetector") {
        return detectorById[command.input.DetectorId as string];
      }
      throw new Error(`unexpected guardduty command ${command._kind}`);
    },
  );
}

describe("auditGuardDuty", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("FAIL case: an ENABLED detector with S3/EKS/malware all disabled is flagged on each axis", async () => {
    // Single region keeps assertions deterministic (regions are audited
    // concurrently, so the mock can't reliably attribute calls across regions).
    wireRegions(["us-east-1"]);
    const detectorId = "detector-use1";
    wireGuardDuty([detectorId], {
      [detectorId]: {
        Status: "ENABLED",
        Features: [
          { Name: "S3_DATA_EVENTS", Status: "DISABLED" },
          { Name: "EKS_AUDIT_LOGS", Status: "DISABLED" },
          { Name: "EBS_MALWARE_PROTECTION", Status: "DISABLED" },
        ],
      },
    });

    const findings = await auditGuardDuty(creds);

    // Real enumeration path was exercised.
    const { DescribeRegionsCommand } = await import("@aws-sdk/client-ec2");
    const { ListDetectorsCommand, GetDetectorCommand } = await import(
      "@aws-sdk/client-guardduty"
    );
    expect(DescribeRegionsCommand).toHaveBeenCalled();
    expect(ListDetectorsCommand).toHaveBeenCalled();
    expect(GetDetectorCommand).toHaveBeenCalledWith({ DetectorId: detectorId });

    // The detector's three protections are each flagged from real properties.
    const s3 = findings.find((f) => f.title.includes("S3 protection is disabled"));
    expect(s3).toBeDefined();
    expect(s3!.severity).toBe("high");
    expect(s3!.resourceId).toBe(detectorId);
    expect(s3!.resourceRegion).toBe("us-east-1");
    expect(s3!.controlMappings!.length).toBeGreaterThan(0);

    expect(
      findings.some((f) => f.title.includes("EKS protection is disabled")),
    ).toBe(true);
    const malware = findings.find((f) =>
      f.title.includes("malware protection is disabled"),
    );
    expect(malware).toBeDefined();
    expect(malware!.severity).toBe("medium");

    // The detector itself is ENABLED, so no "not enabled in region" finding.
    expect(
      findings.some((f) => f.title.includes("not enabled in region")),
    ).toBe(false);
  });

  it("FAIL case: a region with no detector is flagged critical (GuardDuty not enabled)", async () => {
    wireRegions(["eu-west-1"]);
    wireGuardDuty([], {});

    const findings = await auditGuardDuty(creds);

    expect(findings).toHaveLength(1);
    expect(findings[0].title).toContain("not enabled in region");
    expect(findings[0].severity).toBe("critical");
    expect(findings[0].resourceRegion).toBe("eu-west-1");
    // No GetDetector call should happen when there are no detectors.
    const { GetDetectorCommand } = await import("@aws-sdk/client-guardduty");
    expect(GetDetectorCommand).not.toHaveBeenCalled();
  });

  it("PASS case: a single region with a fully-enabled detector yields no findings", async () => {
    wireRegions(["us-east-1"]);
    wireGuardDuty(["detector-healthy"], {
      "detector-healthy": {
        Status: "ENABLED",
        Features: [
          { Name: "S3_DATA_EVENTS", Status: "ENABLED" },
          { Name: "EKS_AUDIT_LOGS", Status: "ENABLED" },
          { Name: "EBS_MALWARE_PROTECTION", Status: "ENABLED" },
        ],
      },
    });

    const findings = await auditGuardDuty(creds);
    expect(findings).toHaveLength(0);
  });

  it("PASS case: legacy DataSources shape (no Features[]) with everything enabled yields no findings", async () => {
    wireRegions(["ap-south-1"]);
    wireGuardDuty(["detector-legacy"], {
      "detector-legacy": {
        Status: "ENABLED",
        DataSources: {
          S3Logs: { Status: "ENABLED" },
          Kubernetes: { AuditLogs: { Status: "ENABLED" } },
          MalwareProtection: {
            ScanEc2InstanceWithFindings: {
              EbsVolumes: { Status: "ENABLED" },
            },
          },
        },
      },
    });

    const findings = await auditGuardDuty(creds);
    expect(findings).toHaveLength(0);
  });

  it("FAIL case: a SUSPENDED detector is flagged critical and per-feature checks are skipped", async () => {
    wireRegions(["us-west-2"]);
    wireGuardDuty(["detector-suspended"], {
      "detector-suspended": {
        Status: "DISABLED",
        Features: [{ Name: "S3_DATA_EVENTS", Status: "DISABLED" }],
      },
    });

    const findings = await auditGuardDuty(creds);

    expect(findings).toHaveLength(1);
    expect(findings[0].title).toContain("is not enabled in region");
    expect(findings[0].severity).toBe("critical");
    expect(findings[0].resourceId).toBe("detector-suspended");
    expect(findings[0].resourceRegion).toBe("us-west-2");
    // Per-feature S3 finding must NOT be emitted for a suspended detector.
    expect(
      findings.some((f) => f.title.includes("S3 protection is disabled")),
    ).toBe(false);
  });
});
