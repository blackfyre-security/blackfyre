// REAL IMPL (BLACKFYRE 2026-06): mocked-SDK unit test for the real Lambda auditor.
// Mocks @aws-sdk/client-lambda so no live AWS access occurs; verifies the auditor
// enumerates functions via ListFunctions (paginated), reads each function's real
// configuration via GetFunctionConfiguration, and emits findings from real
// properties (deprecated runtime + plaintext-secret env vars as the fail cases,
// modern/in-VPC/no-secrets config as the pass cases).
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AwsTemporaryCredentials } from "../../src/agents/aws/credentials.js";

// ---- Mock @aws-sdk/client-lambda ----
const mockSend = vi.fn();
vi.mock("@aws-sdk/client-lambda", () => ({
  LambdaClient: vi.fn().mockImplementation(() => ({ send: mockSend })),
  ListFunctionsCommand: vi
    .fn()
    .mockImplementation((input) => ({ _kind: "ListFunctions", input })),
  GetFunctionConfigurationCommand: vi
    .fn()
    .mockImplementation((input) => ({ _kind: "GetFunctionConfiguration", input })),
}));

// ---- Mock compliance-mapper so findings carry non-empty control mappings ----
vi.mock("../../src/services/compliance-mapper.js", () => ({
  mapCheckToControls: vi.fn().mockImplementation((checkType: string) => [
    {
      framework: "soc2",
      controlId: "CC6.1",
      controlName: `Test Control for ${checkType}`,
      status: "fail",
      weight: 3,
    },
  ]),
}));

// ---- Import after mocks ----
import { auditLambda } from "../../src/agents/aws/lambda-auditor.js";

const creds: AwsTemporaryCredentials = {
  accessKeyId: "AKIA_TEST",
  secretAccessKey: "secret_test",
  sessionToken: "session_test",
};

/**
 * Wires the mocked SDK: one ListFunctions page returning the supplied function
 * ARNs, then a GetFunctionConfiguration response per function keyed by ARN.
 */
function wireSdk(
  functions: Array<{ FunctionArn: string; FunctionName: string }>,
  configByArn: Record<string, Record<string, unknown>>,
) {
  mockSend.mockImplementation(async (command: { _kind: string; input: any }) => {
    if (command._kind === "ListFunctions") {
      return { Functions: functions, NextMarker: undefined };
    }
    if (command._kind === "GetFunctionConfiguration") {
      const arn = command.input.FunctionName as string;
      return configByArn[arn];
    }
    throw new Error(`unexpected command ${command._kind}`);
  });
}

describe("auditLambda", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("FAIL case: flags a deprecated runtime and plaintext-secret env vars", async () => {
    const arn = "arn:aws:lambda:us-east-1:123456789012:function:legacy-fn";
    wireSdk(
      [{ FunctionArn: arn, FunctionName: "legacy-fn" }],
      {
        [arn]: {
          FunctionName: "legacy-fn",
          FunctionArn: arn,
          Runtime: "nodejs14.x", // deprecated
          Timeout: 30, // within limit -> no timeout finding
          VpcConfig: { SubnetIds: ["subnet-abc"] }, // in VPC -> no VPC finding
          Environment: {
            Variables: {
              LOG_LEVEL: "info",
              DB_PASSWORD: "hunter2", // matches /password/i
              API_TOKEN: "abc123", // matches /token/i
            },
          },
        },
      },
    );

    const findings = await auditLambda(creds);

    // Real enumeration path was exercised.
    const { ListFunctionsCommand, GetFunctionConfigurationCommand } =
      await import("@aws-sdk/client-lambda");
    expect(ListFunctionsCommand).toHaveBeenCalled();
    expect(GetFunctionConfigurationCommand).toHaveBeenCalledWith({
      FunctionName: arn,
    });

    const runtimeFinding = findings.find((f) =>
      f.title.includes("deprecated runtime"),
    );
    expect(runtimeFinding).toBeDefined();
    expect(runtimeFinding!.severity).toBe("high");
    expect(runtimeFinding!.resourceId).toBe(arn);
    expect(runtimeFinding!.resourceRegion).toBe("us-east-1");
    expect(runtimeFinding!.controlMappings!.length).toBeGreaterThan(0);

    const secretFinding = findings.find((f) =>
      f.title.includes("store secrets in environment variables"),
    );
    expect(secretFinding).toBeDefined();
    expect(secretFinding!.severity).toBe("critical");
    // Only the secret-looking keys are reported, not LOG_LEVEL.
    expect(secretFinding!.description).toContain("DB_PASSWORD");
    expect(secretFinding!.description).toContain("API_TOKEN");
    expect(secretFinding!.description).not.toContain("LOG_LEVEL");

    // No timeout/VPC findings for this (compliant on those axes) function.
    expect(findings.some((f) => f.title.includes("excessive timeout"))).toBe(
      false,
    );
    expect(findings.some((f) => f.title.includes("not configured in a VPC"))).toBe(
      false,
    );
  });

  it("PASS case: a modern, in-VPC, secret-free, in-limit function yields no findings", async () => {
    const arn = "arn:aws:lambda:eu-west-1:123456789012:function:healthy-fn";
    wireSdk(
      [{ FunctionArn: arn, FunctionName: "healthy-fn" }],
      {
        [arn]: {
          FunctionName: "healthy-fn",
          FunctionArn: arn,
          Runtime: "nodejs20.x", // supported
          Timeout: 60, // within 900s limit
          VpcConfig: { SubnetIds: ["subnet-1", "subnet-2"] }, // in VPC
          Environment: { Variables: { LOG_LEVEL: "info", REGION: "eu-west-1" } },
        },
      },
    );

    const findings = await auditLambda(creds);
    expect(findings).toHaveLength(0);
  });

  it("FAIL case: flags excessive timeout and missing VPC config", async () => {
    const arn = "arn:aws:lambda:ap-south-1:123456789012:function:slow-fn";
    wireSdk(
      [{ FunctionArn: arn, FunctionName: "slow-fn" }],
      {
        [arn]: {
          FunctionName: "slow-fn",
          FunctionArn: arn,
          Runtime: "python3.12", // supported -> no runtime finding
          Timeout: 1200, // > 900 -> excessive
          VpcConfig: { SubnetIds: [] }, // not in VPC
          Environment: { Variables: {} },
        },
      },
    );

    const findings = await auditLambda(creds);

    const timeoutFinding = findings.find((f) =>
      f.title.includes("excessive timeout"),
    );
    expect(timeoutFinding).toBeDefined();
    expect(timeoutFinding!.severity).toBe("low");
    expect(timeoutFinding!.resourceRegion).toBe("ap-south-1");

    const vpcFinding = findings.find((f) =>
      f.title.includes("not configured in a VPC"),
    );
    expect(vpcFinding).toBeDefined();
    expect(vpcFinding!.severity).toBe("medium");
    expect(vpcFinding!.category).toBe("network");

    // Supported runtime + empty env -> no runtime/secret findings.
    expect(findings.some((f) => f.title.includes("deprecated runtime"))).toBe(
      false,
    );
    expect(
      findings.some((f) => f.title.includes("store secrets in environment variables")),
    ).toBe(false);
  });
});
