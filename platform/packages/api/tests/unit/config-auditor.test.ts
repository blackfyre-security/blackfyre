// REAL IMPL (BLACKFYRE 2026-06): mocked-SDK unit test for the real AWS Config
// auditor. Mocks @aws-sdk/client-ec2 (region enumeration via DescribeRegions)
// and @aws-sdk/client-config-service (DescribeConfigurationRecorders,
// DescribeConfigurationRecorderStatus, DescribeDeliveryChannels,
// DescribeComplianceByConfigRule) so no live AWS access occurs. Verifies the
// auditor enumerates regions, reads the real recorders/status/delivery
// channels/rule-compliance, and emits findings from real properties:
//   - PASS: a recording recorder with full coverage + delivery channel +
//     compliant rule -> no findings.
//   - FAIL: a stopped recorder; a region with no recorder; a region with no
//     delivery channel; a NON_COMPLIANT Config rule.
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

// ---- Mock @aws-sdk/client-config-service ----
const cfgSend = vi.fn();
vi.mock("@aws-sdk/client-config-service", () => ({
  ConfigServiceClient: vi.fn().mockImplementation(() => ({ send: cfgSend })),
  DescribeConfigurationRecordersCommand: vi
    .fn()
    .mockImplementation((input) => ({ _kind: "DescribeRecorders", input })),
  DescribeConfigurationRecorderStatusCommand: vi
    .fn()
    .mockImplementation((input) => ({ _kind: "DescribeRecorderStatus", input })),
  DescribeDeliveryChannelsCommand: vi
    .fn()
    .mockImplementation((input) => ({ _kind: "DescribeDeliveryChannels", input })),
  DescribeComplianceByConfigRuleCommand: vi
    .fn()
    .mockImplementation((input) => ({ _kind: "DescribeCompliance", input })),
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
import { auditConfig } from "../../src/agents/aws/config-auditor.js";

const creds: AwsTemporaryCredentials = {
  accessKeyId: "AKIA_TEST",
  secretAccessKey: "secret_test",
  sessionToken: "session_test",
};

/** Wires the EC2 region enumeration to return the supplied region names. */
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

interface ConfigState {
  recorders?: Array<Record<string, unknown>>;
  recorderStatus?: Array<Record<string, unknown>>;
  deliveryChannels?: Array<Record<string, unknown>>;
  compliance?: Array<Record<string, unknown>>;
}

/**
 * Wires the AWS Config service responses for a single region (one page each).
 */
function wireConfig(state: ConfigState) {
  cfgSend.mockImplementation(async (command: { _kind: string }) => {
    switch (command._kind) {
      case "DescribeRecorders":
        return { ConfigurationRecorders: state.recorders ?? [] };
      case "DescribeRecorderStatus":
        return { ConfigurationRecordersStatus: state.recorderStatus ?? [] };
      case "DescribeDeliveryChannels":
        return { DeliveryChannels: state.deliveryChannels ?? [] };
      case "DescribeCompliance":
        return {
          ComplianceByConfigRules: state.compliance ?? [],
          NextToken: undefined,
        };
      default:
        throw new Error(`unexpected config command ${command._kind}`);
    }
  });
}

describe("auditConfig", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("PASS case: recording recorder w/ full coverage + delivery channel + compliant rule yields no findings", async () => {
    // Single region keeps assertions deterministic (regions are audited
    // concurrently, so the mock can't reliably attribute calls across regions).
    wireRegions(["us-east-1"]);
    wireConfig({
      recorders: [
        {
          name: "default",
          recordingGroup: {
            allSupported: true,
            includeGlobalResourceTypes: true,
          },
        },
      ],
      recorderStatus: [
        { name: "default", recording: true, lastStatus: "Success" },
      ],
      deliveryChannels: [{ name: "default" }],
      compliance: [
        {
          ConfigRuleName: "encrypted-volumes",
          Compliance: { ComplianceType: "COMPLIANT" },
        },
      ],
    });

    const findings = await auditConfig(creds);

    // Real enumeration path was exercised across all four describe calls.
    const { DescribeRegionsCommand } = await import("@aws-sdk/client-ec2");
    const {
      DescribeConfigurationRecordersCommand,
      DescribeConfigurationRecorderStatusCommand,
      DescribeDeliveryChannelsCommand,
      DescribeComplianceByConfigRuleCommand,
    } = await import("@aws-sdk/client-config-service");
    expect(DescribeRegionsCommand).toHaveBeenCalled();
    expect(DescribeConfigurationRecordersCommand).toHaveBeenCalled();
    expect(DescribeConfigurationRecorderStatusCommand).toHaveBeenCalled();
    expect(DescribeDeliveryChannelsCommand).toHaveBeenCalled();
    expect(DescribeComplianceByConfigRuleCommand).toHaveBeenCalled();

    expect(findings).toHaveLength(0);
  });

  it("FAIL case: a stopped recorder is flagged 'not recording' (high)", async () => {
    wireRegions(["us-east-1"]);
    wireConfig({
      recorders: [
        {
          name: "default",
          recordingGroup: {
            allSupported: true,
            includeGlobalResourceTypes: true,
          },
        },
      ],
      // recording=false -> recorder is stopped.
      recorderStatus: [
        { name: "default", recording: false, lastStatus: "Pending" },
      ],
      deliveryChannels: [{ name: "default" }],
      compliance: [],
    });

    const findings = await auditConfig(creds);

    const notRecording = findings.find((f) =>
      f.title.includes("is not recording"),
    );
    expect(notRecording).toBeDefined();
    expect(notRecording!.severity).toBe("high");
    expect(notRecording!.resourceId).toBe("default");
    expect(notRecording!.resourceRegion).toBe("us-east-1");
    expect(notRecording!.description).toContain("recording = false");
    expect(notRecording!.controlMappings!.length).toBeGreaterThan(0);

    // A stopped recorder short-circuits the coverage check for that recorder.
    expect(
      findings.some((f) => f.title.includes("incomplete coverage")),
    ).toBe(false);
  });

  it("FAIL case: a region with no recorder and no delivery channel is flagged (high x2)", async () => {
    wireRegions(["eu-west-1"]);
    wireConfig({
      recorders: [],
      recorderStatus: [],
      deliveryChannels: [],
      compliance: [],
    });

    const findings = await auditConfig(creds);

    const noRecorder = findings.find((f) =>
      f.title.includes("recorder is not set up"),
    );
    expect(noRecorder).toBeDefined();
    expect(noRecorder!.severity).toBe("high");
    expect(noRecorder!.resourceRegion).toBe("eu-west-1");
    expect(noRecorder!.resourceType).toBe("AWS::Config::ConfigurationRecorder");

    const noChannel = findings.find((f) =>
      f.title.includes("no delivery channel"),
    );
    expect(noChannel).toBeDefined();
    expect(noChannel!.severity).toBe("high");
    expect(noChannel!.resourceType).toBe("AWS::Config::DeliveryChannel");
  });

  it("FAIL case: a recording-but-incomplete recorder is flagged 'incomplete coverage' (medium)", async () => {
    wireRegions(["ap-south-1"]);
    wireConfig({
      recorders: [
        {
          name: "default",
          // Recording, but missing global resource types -> incomplete coverage.
          recordingGroup: {
            allSupported: true,
            includeGlobalResourceTypes: false,
          },
        },
      ],
      recorderStatus: [
        { name: "default", recording: true, lastStatus: "Success" },
      ],
      deliveryChannels: [{ name: "default" }],
      compliance: [],
    });

    const findings = await auditConfig(creds);

    const coverage = findings.find((f) =>
      f.title.includes("incomplete coverage"),
    );
    expect(coverage).toBeDefined();
    expect(coverage!.severity).toBe("medium");
    expect(coverage!.resourceId).toBe("default");
    expect(coverage!.description).toContain("global resource types");
    // Recorder is recording, so no "not recording" finding.
    expect(findings.some((f) => f.title.includes("is not recording"))).toBe(
      false,
    );
  });

  it("FAIL case: a NON_COMPLIANT Config rule is flagged (medium) with its real rule name", async () => {
    wireRegions(["us-west-2"]);
    wireConfig({
      recorders: [
        {
          name: "default",
          recordingGroup: {
            allSupported: true,
            includeGlobalResourceTypes: true,
          },
        },
      ],
      recorderStatus: [
        { name: "default", recording: true, lastStatus: "Success" },
      ],
      deliveryChannels: [{ name: "default" }],
      compliance: [
        {
          ConfigRuleName: "s3-bucket-public-read-prohibited",
          Compliance: {
            ComplianceType: "NON_COMPLIANT",
            ComplianceContributorCount: { CappedCount: 3, CapExceeded: false },
          },
        },
        {
          // A compliant rule must NOT produce a finding.
          ConfigRuleName: "encrypted-volumes",
          Compliance: { ComplianceType: "COMPLIANT" },
        },
      ],
    });

    const findings = await auditConfig(creds);

    const ruleFindings = findings.filter((f) =>
      f.resourceType === "AWS::Config::ConfigRule",
    );
    expect(ruleFindings).toHaveLength(1);
    const rule = ruleFindings[0];
    expect(rule.severity).toBe("medium");
    expect(rule.resourceId).toBe("s3-bucket-public-read-prohibited");
    expect(rule.resourceRegion).toBe("us-west-2");
    expect(rule.description).toContain("3 non-compliant resource(s)");
    expect(rule.controlMappings!.length).toBeGreaterThan(0);
  });
});
