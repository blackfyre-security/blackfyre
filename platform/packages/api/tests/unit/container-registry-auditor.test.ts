// REAL IMPL (BLACKFYRE 2026-06): mocked-SDK unit test for the real container
// registry (ECR) auditor. Mocks @aws-sdk/client-ecr so the
// list/describe/get-policy calls return crafted resources, then asserts the
// auditor derives findings (and non-findings) from the real resource
// properties: Repository.imageTagMutability, imageScanningConfiguration.scanOnPush,
// the repository resource policy (public principal), and the real
// imageScanFindingsSummary.findingSeverityCounts returned by
// DescribeImageScanFindings.
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AwsTemporaryCredentials } from "../../src/agents/aws/credentials.js";

// ---- Single mock send() (commands are discriminated by their _cmd tag) ----
// vitest hoists vi.mock() factories above all top-level declarations, so a plain
// top-level `const ecrSend = vi.fn()` would be in the temporal dead zone when the
// factory below executes. Declare it via vi.hoisted() so it is initialised first.
const { ecrSend } = vi.hoisted(() => ({ ecrSend: vi.fn() }));

vi.mock("@aws-sdk/client-ecr", () => ({
  ECRClient: vi.fn().mockImplementation(() => ({ send: ecrSend })),
  DescribeRepositoriesCommand: vi
    .fn()
    .mockImplementation((input: unknown) => ({ _cmd: "DescribeRepositories", input })),
  GetRepositoryPolicyCommand: vi
    .fn()
    .mockImplementation((input: unknown) => ({ _cmd: "GetRepositoryPolicy", input })),
  GetRegistryPolicyCommand: vi
    .fn()
    .mockImplementation((input: unknown) => ({ _cmd: "GetRegistryPolicy", input })),
  ListImagesCommand: vi
    .fn()
    .mockImplementation((input: unknown) => ({ _cmd: "ListImages", input })),
  DescribeImageScanFindingsCommand: vi
    .fn()
    .mockImplementation((input: unknown) => ({ _cmd: "DescribeImageScanFindings", input })),
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
import { auditEcrRegistry } from "../../src/agents/container-registry-auditor.js";

function makeMockCreds(): AwsTemporaryCredentials {
  return {
    accessKeyId: "AKIA_TEST",
    secretAccessKey: "secret",
    sessionToken: "token",
  };
}

const REPO_ARN = "arn:aws:ecr:eu-central-1:123456789012:repository/app";

interface MockCmd {
  _cmd: string;
}

/**
 * Routes mocked sends by command name. Each route returns the response for that
 * command; image-scan/list responses model an image with crafted scan counts.
 */
function routeSends(opts: {
  registryPolicy?: { policyText?: string } | (() => never);
  repository: Record<string, unknown>;
  repoPolicy?: { policyText?: string } | (() => never);
  imageIds?: Array<{ imageDigest?: string; imageTag?: string }>;
  scanSummary?: Record<string, unknown> | (() => never);
}): void {
  ecrSend.mockImplementation(async (cmd: MockCmd) => {
    switch (cmd._cmd) {
      case "GetRegistryPolicy":
        if (typeof opts.registryPolicy === "function") return opts.registryPolicy();
        if (!opts.registryPolicy) {
          const e = new Error("not found");
          e.name = "RegistryPolicyNotFoundException";
          throw e;
        }
        return opts.registryPolicy;
      case "DescribeRepositories":
        return { repositories: [opts.repository], nextToken: undefined };
      case "GetRepositoryPolicy":
        if (typeof opts.repoPolicy === "function") return opts.repoPolicy();
        if (!opts.repoPolicy) {
          const e = new Error("not found");
          e.name = "RepositoryPolicyNotFoundException";
          throw e;
        }
        return opts.repoPolicy;
      case "ListImages":
        return { imageIds: opts.imageIds ?? [], nextToken: undefined };
      case "DescribeImageScanFindings":
        if (typeof opts.scanSummary === "function") return opts.scanSummary();
        if (!opts.scanSummary) {
          const e = new Error("no scan");
          e.name = "ScanNotFoundException";
          throw e;
        }
        return { imageScanFindings: opts.scanSummary };
      default:
        throw new Error(`unexpected command ${cmd._cmd}`);
    }
  });
}

describe("auditEcrRegistry (real container registry auditor)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("PASS-case: immutable + scan-on-push + private repo with a clean scanned image produces no findings", async () => {
    routeSends({
      // No registry-wide policy, no repository policy -> not public.
      repository: {
        repositoryName: "app",
        repositoryArn: REPO_ARN,
        imageTagMutability: "IMMUTABLE",
        imageScanningConfiguration: { scanOnPush: true },
      },
      imageIds: [{ imageDigest: "sha256:clean", imageTag: "v1" }],
      // Scanner reported zero CRITICAL/HIGH.
      scanSummary: { findingSeverityCounts: { MEDIUM: 2, LOW: 5 } },
    });

    const findings = await auditEcrRegistry(makeMockCreds());
    expect(findings).toHaveLength(0);
  });

  it("FAIL-case: mutable tags + scan-on-push off + public repo policy + CRITICAL image scan yield real findings with real resourceId/region", async () => {
    routeSends({
      repository: {
        repositoryName: "app",
        repositoryArn: REPO_ARN,
        imageTagMutability: "MUTABLE", // <- violation: tags overwritable
        imageScanningConfiguration: { scanOnPush: false }, // <- violation: no scan on push
      },
      // Repository policy grants an anonymous wildcard principal -> public.
      repoPolicy: {
        policyText: JSON.stringify({
          Version: "2012-10-17",
          Statement: [
            { Effect: "Allow", Principal: "*", Action: "ecr:BatchGetImage", Resource: "*" },
          ],
        }),
      },
      imageIds: [{ imageDigest: "sha256:vuln", imageTag: "latest" }],
      // Scanner reported real CRITICAL vulnerabilities for this image.
      scanSummary: { findingSeverityCounts: { CRITICAL: 3, HIGH: 7, MEDIUM: 4 } },
    });

    const findings = await auditEcrRegistry(makeMockCreds());

    const tag = findings.find((f) => f.title.includes("mutable image tags"));
    expect(tag).toBeDefined();
    expect(tag!.severity).toBe("medium");
    expect(tag!.resourceId).toBe(REPO_ARN);
    expect(tag!.resourceRegion).toBe("eu-central-1");
    expect(tag!.controlMappings!.length).toBeGreaterThan(0);

    const scan = findings.find((f) => f.title.includes("scan images on push"));
    expect(scan).toBeDefined();
    expect(scan!.severity).toBe("high");
    expect(scan!.resourceRegion).toBe("eu-central-1");

    const pub = findings.find((f) => f.title.includes("publicly accessible"));
    expect(pub).toBeDefined();
    expect(pub!.severity).toBe("critical");
    expect(pub!.category).toBe("network");
    expect(pub!.resourceId).toBe(REPO_ARN);

    const vuln = findings.find((f) => f.title.includes("known vulnerabilities"));
    expect(vuln).toBeDefined();
    // CRITICAL count > 0 -> finding severity escalates to critical.
    expect(vuln!.severity).toBe("critical");
    expect(vuln!.title).toContain("3 CRITICAL");
    expect(vuln!.title).toContain("7 HIGH");
    expect(vuln!.resourceId).toBe(`${REPO_ARN}@sha256:vuln`);
    expect(vuln!.resourceRegion).toBe("eu-central-1");

    expect(findings).toHaveLength(4);
  });

  it("does not flag a wildcard repository policy that is scoped back to the owning account", async () => {
    routeSends({
      repository: {
        repositoryName: "app",
        repositoryArn: REPO_ARN,
        imageTagMutability: "IMMUTABLE",
        imageScanningConfiguration: { scanOnPush: true },
      },
      // Wildcard principal but condition scopes it to the owning account -> NOT public.
      repoPolicy: {
        policyText: JSON.stringify({
          Version: "2012-10-17",
          Statement: [
            {
              Effect: "Allow",
              Principal: { AWS: "*" },
              Action: "ecr:BatchGetImage",
              Resource: "*",
              Condition: { StringEquals: { "aws:SourceAccount": "123456789012" } },
            },
          ],
        }),
      },
      imageIds: [],
    });

    const findings = await auditEcrRegistry(makeMockCreds());
    expect(findings.find((f) => f.title.includes("publicly accessible"))).toBeUndefined();
    expect(findings).toHaveLength(0);
  });
});
