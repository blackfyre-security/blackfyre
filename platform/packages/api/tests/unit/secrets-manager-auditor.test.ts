// REAL IMPL (BLACKFYRE 2026-06): mocked-SDK unit test for the real Secrets Manager
// auditor. Mocks @aws-sdk/client-secrets-manager so no live AWS access occurs;
// verifies the auditor enumerates secrets via ListSecrets (paginated), reads each
// secret's real configuration via DescribeSecret, pulls its resource policy via
// GetResourcePolicy, and emits findings from real properties (rotation disabled,
// rotation interval > 90 days, and an overly broad resource-policy principal as
// the fail cases; rotation enabled within 90 days + scoped/absent policy as the
// pass case).
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AwsTemporaryCredentials } from "../../src/agents/aws/credentials.js";

// ---- Mock @aws-sdk/client-secrets-manager ----
// vi.hoisted() runs BEFORE any vi.mock() factory or module import, so the mock
// fn and the synthetic ResourceNotFoundException class exist when the hoisted
// vi.mock factories below execute. Plain top-level declarations would be in the
// temporal dead zone at that point (vitest hoists vi.mock above all top-level code).
const { mockSend, MockResourceNotFoundException } = vi.hoisted(() => {
  const mockSend = vi.fn();
  class MockResourceNotFoundException extends Error {
    constructor() {
      super("Secrets Manager can't find the resource policy.");
      this.name = "ResourceNotFoundException";
    }
  }
  return { mockSend, MockResourceNotFoundException };
});
vi.mock("@aws-sdk/client-secrets-manager", () => ({
  SecretsManagerClient: vi.fn().mockImplementation(() => ({ send: mockSend })),
  ListSecretsCommand: vi
    .fn()
    .mockImplementation((input) => ({ _kind: "ListSecrets", input })),
  DescribeSecretCommand: vi
    .fn()
    .mockImplementation((input) => ({ _kind: "DescribeSecret", input })),
  GetResourcePolicyCommand: vi
    .fn()
    .mockImplementation((input) => ({ _kind: "GetResourcePolicy", input })),
  ResourceNotFoundException: MockResourceNotFoundException,
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
import { auditSecretsManager } from "../../src/agents/aws/secrets-manager-auditor.js";

const creds: AwsTemporaryCredentials = {
  accessKeyId: "AKIA_TEST",
  secretAccessKey: "secret_test",
  sessionToken: "session_test",
};

interface SecretFixture {
  ARN: string;
  Name: string;
  describe: Record<string, unknown>;
  // string => ResourcePolicy JSON; "none" => GetResourcePolicy returns no policy;
  // "notfound" => GetResourcePolicy throws ResourceNotFoundException.
  policy: string | "none" | "notfound";
}

/**
 * Wires the mocked SDK: one ListSecrets page returning the supplied secrets, then
 * a DescribeSecret / GetResourcePolicy response per secret keyed by ARN.
 */
function wireSdk(secrets: SecretFixture[]) {
  const byArn = new Map(secrets.map((s) => [s.ARN, s]));
  mockSend.mockImplementation(async (command: { _kind: string; input: any }) => {
    if (command._kind === "ListSecrets") {
      return {
        SecretList: secrets.map((s) => ({ ARN: s.ARN, Name: s.Name })),
        NextToken: undefined,
      };
    }
    if (command._kind === "DescribeSecret") {
      const s = byArn.get(command.input.SecretId as string)!;
      return { ARN: s.ARN, Name: s.Name, ...s.describe };
    }
    if (command._kind === "GetResourcePolicy") {
      const s = byArn.get(command.input.SecretId as string)!;
      if (s.policy === "notfound") throw new MockResourceNotFoundException();
      if (s.policy === "none") return { ARN: s.ARN, Name: s.Name };
      return { ARN: s.ARN, Name: s.Name, ResourcePolicy: s.policy };
    }
    throw new Error(`unexpected command ${command._kind}`);
  });
}

describe("auditSecretsManager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("FAIL case: flags rotation disabled and an overly broad resource policy", async () => {
    const arn =
      "arn:aws:secretsmanager:us-east-1:123456789012:secret:prod/db-AbCdEf";
    wireSdk([
      {
        ARN: arn,
        Name: "prod/db",
        describe: { RotationEnabled: false },
        policy: JSON.stringify({
          Version: "2012-10-17",
          Statement: [
            { Effect: "Allow", Principal: "*", Action: "secretsmanager:GetSecretValue" },
          ],
        }),
      },
    ]);

    const findings = await auditSecretsManager(creds);

    // Real enumeration path was exercised.
    const {
      ListSecretsCommand,
      DescribeSecretCommand,
      GetResourcePolicyCommand,
    } = await import("@aws-sdk/client-secrets-manager");
    expect(ListSecretsCommand).toHaveBeenCalled();
    expect(DescribeSecretCommand).toHaveBeenCalledWith({ SecretId: arn });
    expect(GetResourcePolicyCommand).toHaveBeenCalledWith({ SecretId: arn });

    const rotationFinding = findings.find((f) =>
      f.title.includes("does not have automatic rotation enabled"),
    );
    expect(rotationFinding).toBeDefined();
    expect(rotationFinding!.severity).toBe("high");
    expect(rotationFinding!.resourceId).toBe(arn);
    expect(rotationFinding!.resourceRegion).toBe("us-east-1");
    expect(rotationFinding!.controlMappings!.length).toBeGreaterThan(0);

    const policyFinding = findings.find((f) =>
      f.title.includes("overly broad principal"),
    );
    expect(policyFinding).toBeDefined();
    expect(policyFinding!.severity).toBe("high");
    expect(policyFinding!.category).toBe("iam");
    expect(policyFinding!.resourceId).toBe(arn);

    // Rotation is disabled, so the interval check must NOT fire (short-circuited).
    expect(
      findings.some((f) => f.title.includes("rotation interval exceeds")),
    ).toBe(false);
  });

  it("FAIL case: flags a rotation interval that exceeds 90 days", async () => {
    const arn =
      "arn:aws:secretsmanager:eu-west-1:123456789012:secret:api/key-XyZ123";
    wireSdk([
      {
        ARN: arn,
        Name: "api/key",
        describe: {
          RotationEnabled: true,
          RotationRules: { AutomaticallyAfterDays: 180 },
        },
        // Scoped policy (has a Condition) -> must NOT be flagged.
        policy: JSON.stringify({
          Version: "2012-10-17",
          Statement: [
            {
              Effect: "Allow",
              Principal: { AWS: "*" },
              Action: "secretsmanager:GetSecretValue",
              Condition: { StringEquals: { "aws:PrincipalOrgID": "o-abc123" } },
            },
          ],
        }),
      },
    ]);

    const findings = await auditSecretsManager(creds);

    const intervalFinding = findings.find((f) =>
      f.title.includes("rotation interval exceeds"),
    );
    expect(intervalFinding).toBeDefined();
    expect(intervalFinding!.severity).toBe("medium");
    expect(intervalFinding!.resourceRegion).toBe("eu-west-1");
    expect(intervalFinding!.description).toContain("180");

    // Rotation is enabled -> no "rotation disabled" finding. Conditioned wildcard
    // principal -> no "overly broad principal" finding.
    expect(
      findings.some((f) => f.title.includes("does not have automatic rotation enabled")),
    ).toBe(false);
    expect(findings.some((f) => f.title.includes("overly broad principal"))).toBe(
      false,
    );
  });

  it("PASS case: rotation enabled within 90 days and no resource policy yields no findings", async () => {
    const arn =
      "arn:aws:secretsmanager:ap-south-1:123456789012:secret:svc/token-PqRsTu";
    wireSdk([
      {
        ARN: arn,
        Name: "svc/token",
        describe: {
          RotationEnabled: true,
          RotationRules: { AutomaticallyAfterDays: 30 },
        },
        policy: "notfound", // GetResourcePolicy throws ResourceNotFoundException
      },
    ]);

    const findings = await auditSecretsManager(creds);
    expect(findings).toHaveLength(0);
  });
});
