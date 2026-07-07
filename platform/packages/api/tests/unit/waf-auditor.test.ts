// REAL IMPL (BLACKFYRE 2026-06): mocked-SDK unit tests for the real WAF auditor.
// @aws-sdk/client-wafv2 is vi.mock'd so findings are asserted purely from injected
// Web ACL definitions + logging configs (no live AWS, no canned auditor data).
// auditWaf() enumerates both WAFv2 scopes, so the mock routes ListWebACLs by Scope
// and only returns ACLs for REGIONAL (CLOUDFRONT yields an empty list) to keep the
// assertions focused on a single ACL while still exercising the dual-scope path.
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AwsTemporaryCredentials } from "../../src/agents/aws/credentials.js";

// ---- Mock: @aws-sdk/client-wafv2 ----
// One send() routes by command kind; commands stash their input for assertions.
const mockSend = vi.fn();
vi.mock("@aws-sdk/client-wafv2", () => {
  // A custom error type so the auditor's WAFNonexistentItemException branch (no
  // logging config attached) can be exercised by name.
  class WafError extends Error {}
  return {
    WAFV2Client: vi.fn().mockImplementation(() => ({ send: mockSend })),
    ListWebACLsCommand: vi
      .fn()
      .mockImplementation((input) => ({ _kind: "ListWebACLs", input })),
    GetWebACLCommand: vi
      .fn()
      .mockImplementation((input) => ({ _kind: "GetWebACL", input })),
    GetLoggingConfigurationCommand: vi
      .fn()
      .mockImplementation((input) => ({ _kind: "GetLoggingConfiguration", input })),
    __WafError: WafError,
  };
});

// ---- Mock: compliance-mapper (return a non-empty mapping for any check) ----
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
import { auditWaf } from "../../src/agents/aws/waf-auditor.js";

const creds: AwsTemporaryCredentials = {
  accessKeyId: "AKIA_TEST",
  secretAccessKey: "secret_test",
  sessionToken: "session_test",
};

const REGIONAL_ARN =
  "arn:aws:wafv2:us-east-1:123456789012:regional/webacl/my-acl/abc123";

/**
 * Wires the mocked SDK: REGIONAL ListWebACLs returns the supplied summary;
 * CLOUDFRONT ListWebACLs returns an empty list; GetWebACL returns the supplied
 * WebACL; GetLoggingConfiguration either returns a config or throws
 * WAFNonexistentItemException (loggingEnabled=false).
 */
async function wireSdk(opts: {
  webAcl: Record<string, unknown>;
  loggingDestinations: string[] | null; // null => no logging config attached
}) {
  const { __WafError } = (await import("@aws-sdk/client-wafv2")) as unknown as {
    __WafError: new (msg?: string) => Error;
  };

  mockSend.mockImplementation(async (command: { _kind: string; input: any }) => {
    if (command._kind === "ListWebACLs") {
      if (command.input.Scope === "REGIONAL") {
        return {
          WebACLs: [
            {
              Name: opts.webAcl.Name,
              Id: opts.webAcl.Id,
              ARN: opts.webAcl.ARN,
            },
          ],
          NextMarker: undefined,
        };
      }
      // CLOUDFRONT scope: no global ACLs in these fixtures.
      return { WebACLs: [], NextMarker: undefined };
    }
    if (command._kind === "GetWebACL") {
      return { WebACL: opts.webAcl };
    }
    if (command._kind === "GetLoggingConfiguration") {
      if (opts.loggingDestinations === null) {
        const err = new __WafError("no logging configuration");
        err.name = "WAFNonexistentItemException";
        throw err;
      }
      return {
        LoggingConfiguration: {
          ResourceArn: command.input.ResourceArn,
          LogDestinationConfigs: opts.loggingDestinations,
        },
      };
    }
    throw new Error(`unexpected command ${command._kind}`);
  });
}

describe("auditWaf", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("FAIL case: flags missing AWS managed rules, missing rate-based rule, and disabled logging", async () => {
    // A Web ACL with a single custom byte-match rule: no AWSManagedRules group,
    // no RateBasedStatement, and no logging configuration attached.
    await wireSdk({
      webAcl: {
        Name: "my-acl",
        Id: "abc123",
        ARN: REGIONAL_ARN,
        Rules: [
          {
            Name: "block-foo",
            Priority: 0,
            Statement: {
              ByteMatchStatement: {
                SearchString: "foo",
              },
            },
          },
        ],
      },
      loggingDestinations: null, // WAFNonexistentItemException => logging off
    });

    const findings = await auditWaf(creds);

    // Real enumeration path was exercised across both scopes.
    const { ListWebACLsCommand, GetWebACLCommand } = await import(
      "@aws-sdk/client-wafv2"
    );
    expect(ListWebACLsCommand).toHaveBeenCalledWith(
      expect.objectContaining({ Scope: "REGIONAL" }),
    );
    expect(ListWebACLsCommand).toHaveBeenCalledWith(
      expect.objectContaining({ Scope: "CLOUDFRONT" }),
    );
    expect(GetWebACLCommand).toHaveBeenCalledWith({
      Name: "my-acl",
      Id: "abc123",
      Scope: "REGIONAL",
    });

    const managedFinding = findings.find((f) =>
      f.title.includes("no AWS managed rule groups"),
    );
    expect(managedFinding).toBeDefined();
    expect(managedFinding!.severity).toBe("high");
    expect(managedFinding!.resourceId).toBe(REGIONAL_ARN);
    expect(managedFinding!.resourceRegion).toBe("us-east-1");
    expect(managedFinding!.controlMappings!.length).toBeGreaterThan(0);

    const rateFinding = findings.find((f) =>
      f.title.includes("no rate-based rule"),
    );
    expect(rateFinding).toBeDefined();
    expect(rateFinding!.severity).toBe("medium");
    expect(rateFinding!.category).toBe("network");

    const loggingFinding = findings.find((f) =>
      f.title.includes("does not have logging enabled"),
    );
    expect(loggingFinding).toBeDefined();
    expect(loggingFinding!.severity).toBe("medium");
    expect(loggingFinding!.category).toBe("logging");
  });

  it("PASS case: an ACL with AWS managed rules + rate-based rule + logging yields no findings", async () => {
    // AWSManagedRules group present, a RateBasedStatement nested under an
    // AndStatement (exercises the recursive walk), and logging streamed to a
    // Firehose destination.
    await wireSdk({
      webAcl: {
        Name: "hardened-acl",
        Id: "def456",
        ARN: "arn:aws:wafv2:eu-west-1:123456789012:regional/webacl/hardened-acl/def456",
        Rules: [
          {
            Name: "aws-common",
            Priority: 0,
            Statement: {
              ManagedRuleGroupStatement: {
                VendorName: "AWS",
                Name: "AWSManagedRulesCommonRuleSet",
              },
            },
          },
          {
            Name: "rate-limit",
            Priority: 1,
            Statement: {
              AndStatement: {
                Statements: [
                  {
                    RateBasedStatement: {
                      Limit: 2000,
                      AggregateKeyType: "IP",
                    },
                  },
                ],
              },
            },
          },
        ],
      },
      loggingDestinations: [
        "arn:aws:firehose:eu-west-1:123456789012:deliverystream/aws-waf-logs-stream",
      ],
    });

    const findings = await auditWaf(creds);
    expect(findings).toHaveLength(0);
  });
});
