// REAL IMPL (BLACKFYRE 2026-06): focused mocked-SDK unit test for the real Azure
// Policy auditor. We vi.mock @azure/arm-policyinsights so no live Azure call is
// made; each test drives the mocked PolicyInsightsClient and asserts findings
// are derived from real properties. Covers a pass-case + fail-case for the
// per-assignment compliance-summary check and the per-resource non-compliance
// check, plus a real testConnection (valid creds -> true, bogus creds -> false).
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { TokenCredential } from "@azure/identity";
import type { AzureCredentials } from "../../src/agents/azure/credentials.js";

// ---- Helper: paged-async-iterable from array (mirrors SDK PagedAsyncIterableIterator) ----
function asyncIter<T>(items: T[]): AsyncIterable<T> {
  return {
    [Symbol.asyncIterator]() {
      let i = 0;
      return {
        async next() {
          if (i < items.length)
            return { value: items[i++], done: false as const };
          return { value: undefined as never, done: true as const };
        },
      };
    },
  };
}

function makeMockCreds(): AzureCredentials {
  return {
    credential: {} as TokenCredential,
    subscriptionId: "sub-1",
    tenantId: "t-1",
  };
}

// ---- Mock: @azure/arm-policyinsights ----
const mockPolicyStates = {
  summarizeForSubscription: vi.fn(),
  listQueryResultsForSubscription: vi.fn(),
};

vi.mock("@azure/arm-policyinsights", () => ({
  PolicyInsightsClient: vi.fn().mockImplementation(() => ({
    policyStates: mockPolicyStates,
  })),
}));

// ---- Mock: compliance-mapper ----
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

// ---- Mock: @azure/identity (used by credential resolution in testConnection) ----
vi.mock("@azure/identity", () => ({
  ClientSecretCredential: vi.fn().mockImplementation(() => ({})),
  DefaultAzureCredential: vi.fn().mockImplementation(() => ({})),
}));

// ---- Import after mocks ----
import {
  auditAzurePolicy,
  AzurePolicyAuditorAgent,
} from "../../src/agents/azure/policy-auditor.js";

const ASSIGN_ID =
  "/subscriptions/sub-1/providers/Microsoft.Authorization/policyAssignments/cis-benchmark";

// Defaults that produce NO findings, so each test can isolate one check:
// one fully-compliant assignment and no non-compliant resource states.
function setHealthyDefaults() {
  mockPolicyStates.summarizeForSubscription.mockResolvedValue({
    value: [
      {
        policyAssignments: [
          {
            policyAssignmentId: ASSIGN_ID,
            results: { nonCompliantResources: 0, nonCompliantPolicies: 0 },
          },
        ],
      },
    ],
  });
  mockPolicyStates.listQueryResultsForSubscription.mockReturnValue(
    asyncIter([
      {
        resourceId: "/subscriptions/sub-1/resourceGroups/rg/providers/x/y",
        complianceState: "Compliant",
        policyAssignmentName: "cis-benchmark",
      },
    ]),
  );
}

describe("auditAzurePolicy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setHealthyDefaults();
  });

  // ---- per-assignment summary: PASS case ----
  it("emits NO assignment finding when every evaluated assignment is fully compliant", async () => {
    const findings = await auditAzurePolicy(makeMockCreds());
    const assignmentFinding = findings.find(
      (f) => f.resourceId === ASSIGN_ID,
    );
    expect(assignmentFinding).toBeUndefined();
  });

  // ---- per-assignment summary: FAIL case ----
  it("emits a high finding for an assignment with >=10 non-compliant resources", async () => {
    mockPolicyStates.summarizeForSubscription.mockResolvedValue({
      value: [
        {
          policyAssignments: [
            {
              policyAssignmentId: ASSIGN_ID,
              policySetDefinitionId:
                "/providers/Microsoft.Authorization/policySetDefinitions/cis",
              results: { nonCompliantResources: 42, nonCompliantPolicies: 7 },
            },
          ],
        },
      ],
    });

    const findings = await auditAzurePolicy(makeMockCreds());

    const assignmentFinding = findings.find((f) => f.resourceId === ASSIGN_ID);
    expect(assignmentFinding).toBeDefined();
    expect(assignmentFinding!.severity).toBe("high");
    expect(assignmentFinding!.resourceRegion).toBe("global");
    expect(assignmentFinding!.resourceType).toBe(
      "Microsoft.Authorization/policyAssignments",
    );
    expect(assignmentFinding!.title).toContain("42 non-compliant resource");
    expect(assignmentFinding!.controlMappings!.length).toBeGreaterThan(0);
  });

  // ---- no-assignments: FAIL case (governance gap) ----
  it("emits a low governance-gap finding when the subscription has no evaluated assignments", async () => {
    mockPolicyStates.summarizeForSubscription.mockResolvedValue({
      value: [{ policyAssignments: [] }],
    });

    const findings = await auditAzurePolicy(makeMockCreds());

    const gap = findings.find((f) =>
      f.title.includes("no evaluated Azure Policy assignments"),
    );
    expect(gap).toBeDefined();
    expect(gap!.severity).toBe("low");
    expect(gap!.resourceRegion).toBe("global");
  });

  // ---- per-resource non-compliance: PASS case ----
  it("emits NO per-resource finding when no policy state is NonCompliant", async () => {
    const findings = await auditAzurePolicy(makeMockCreds());
    const resourceFinding = findings.find((f) =>
      f.resourceId.includes("/resourceGroups/rg/providers/x/y"),
    );
    expect(resourceFinding).toBeUndefined();
  });

  // ---- per-resource non-compliance: FAIL case ----
  it("emits a per-resource finding for each NonCompliant policy state with the real resourceId/region", async () => {
    mockPolicyStates.listQueryResultsForSubscription.mockReturnValue(
      asyncIter([
        {
          resourceId:
            "/subscriptions/sub-1/resourceGroups/rg/providers/Microsoft.Storage/storageAccounts/sa1",
          resourceType: "Microsoft.Storage/storageAccounts",
          resourceLocation: "eastus",
          complianceState: "NonCompliant",
          policyAssignmentName: "require-https",
          policyAssignmentId:
            "/subscriptions/sub-1/providers/Microsoft.Authorization/policyAssignments/require-https",
          policyDefinitionName: "Storage accounts should use HTTPS",
          policyDefinitionAction: "audit",
        },
        // A compliant record in the same page must be ignored.
        {
          resourceId: "/subscriptions/sub-1/resourceGroups/rg/providers/x/ok",
          complianceState: "Compliant",
        },
      ]),
    );

    const findings = await auditAzurePolicy(makeMockCreds());

    const resourceFinding = findings.find(
      (f) =>
        f.resourceId ===
        "/subscriptions/sub-1/resourceGroups/rg/providers/Microsoft.Storage/storageAccounts/sa1",
    );
    expect(resourceFinding).toBeDefined();
    expect(resourceFinding!.severity).toBe("medium");
    expect(resourceFinding!.resourceRegion).toBe("eastus");
    expect(resourceFinding!.title).toContain("require-https");

    // The Compliant record produced no finding.
    const compliant = findings.find((f) => f.resourceId.endsWith("/ok"));
    expect(compliant).toBeUndefined();
  });
});

describe("AzurePolicyAuditorAgent.testConnection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setHealthyDefaults();
  });

  it("returns true for valid JSON service-principal creds (real summarize call)", async () => {
    const agent = new AzurePolicyAuditorAgent();
    const validCreds = JSON.stringify({
      tenantId: "t-1",
      clientId: "c-1",
      clientSecret: "s-1",
      subscriptionId: "sub-1",
    });

    const result = await agent.testConnection(validCreds);
    expect(result).toBe(true);
    expect(mockPolicyStates.summarizeForSubscription).toHaveBeenCalled();
  });

  it("returns false for a bogus non-JSON credential ref (not a string check)", async () => {
    const agent = new AzurePolicyAuditorAgent();
    const result = await agent.testConnection("azure-fake");
    expect(result).toBe(false);
  });
});
