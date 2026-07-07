// REAL IMPL (BLACKFYRE 2026-06): Mocked-SDK unit test for the real Azure AKS
// auditor. vi.mock replaces @azure/arm-containerservice so checks run against
// fabricated ManagedCluster objects with real-shaped properties (enableRbac,
// networkProfile.networkPolicy, aadProfile). Covers pass + fail cases per check
// plus the SDK-backed testConnection (not a string check).
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { TokenCredential } from "@azure/identity";
import type { ManagedCluster } from "@azure/arm-containerservice";
import type { AzureCredentials } from "../../src/agents/azure/credentials.js";

// ---- Helper: async iterable from array (mirrors managedClusters.list paging) ----
function asyncIter<T>(items: T[]): AsyncIterable<T> {
  return {
    [Symbol.asyncIterator]() {
      let i = 0;
      return {
        async next() {
          if (i < items.length) return { value: items[i++], done: false as const };
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

// ---- Mock: @azure/arm-containerservice ----
const mockManagedClusters = {
  list: vi.fn(),
};

vi.mock("@azure/arm-containerservice", () => ({
  ContainerServiceClient: vi.fn().mockImplementation(() => ({
    managedClusters: mockManagedClusters,
  })),
}));

// ---- Mock: compliance-mapper ----
vi.mock("../../src/services/compliance-mapper.js", () => ({
  mapCheckToControls: vi.fn().mockImplementation((_checkType: string) => [
    {
      framework: "soc2",
      controlId: "CC6.1",
      controlName: "Test Control",
      status: "fail",
      weight: 3,
    },
  ]),
}));

// ---- Mock: @azure/identity for credential resolution ----
vi.mock("@azure/identity", () => ({
  ClientSecretCredential: vi.fn().mockImplementation(() => ({})),
}));

// ---- Import after mocks ----
import {
  auditAzureAks,
  AzureAksAuditorAgent,
} from "../../src/agents/azure/aks-auditor.js";

const BASE_CLUSTER: ManagedCluster = {
  id: "/subscriptions/sub-1/resourceGroups/rg-1/providers/Microsoft.ContainerService/managedClusters/aks-1",
  name: "aks-1",
  location: "eastus",
} as ManagedCluster;

describe("Azure AKS auditor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("PASS: emits no findings for a fully hardened cluster", async () => {
    const creds = makeMockCreds();
    mockManagedClusters.list.mockReturnValue(
      asyncIter([
        {
          ...BASE_CLUSTER,
          enableRbac: true,
          networkProfile: { networkPolicy: "azure" },
          aadProfile: { managed: true, enableAzureRbac: true },
        },
      ]),
    );

    const findings = await auditAzureAks(creds);

    expect(findings).toHaveLength(0);
  });

  it("FAIL: flags RBAC disabled and reports real resourceId/region", async () => {
    const creds = makeMockCreds();
    mockManagedClusters.list.mockReturnValue(
      asyncIter([
        {
          ...BASE_CLUSTER,
          enableRbac: false,
          // hardened on the other two checks so only the RBAC finding fires
          networkProfile: { networkPolicy: "calico" },
          aadProfile: { managed: true },
        },
      ]),
    );

    const findings = await auditAzureAks(creds);

    expect(findings).toHaveLength(1);
    const rbac = findings[0];
    expect(rbac.title).toContain("Kubernetes RBAC");
    expect(rbac.severity).toBe("critical");
    expect(rbac.category).toBe("iam");
    expect(rbac.resourceType).toBe(
      "Microsoft.ContainerService/managedClusters",
    );
    expect(rbac.resourceId).toBe(BASE_CLUSTER.id);
    expect(rbac.resourceRegion).toBe("eastus");
    expect(rbac.source).toBe("azure-aks-auditor");
    expect(rbac.controlMappings && rbac.controlMappings.length).toBeGreaterThan(
      0,
    );
  });

  it("FAIL: flags missing network policy and missing Azure AD integration", async () => {
    const creds = makeMockCreds();
    mockManagedClusters.list.mockReturnValue(
      asyncIter([
        {
          ...BASE_CLUSTER,
          enableRbac: true, // RBAC ok
          networkProfile: { networkPolicy: "none" }, // no policy
          // aadProfile omitted -> AAD finding
        },
      ]),
    );

    const findings = await auditAzureAks(creds);

    const netFinding = findings.find((f) =>
      f.title.includes("no network policy"),
    );
    const aadFinding = findings.find((f) =>
      f.title.includes("not integrated with Azure AD"),
    );

    expect(netFinding).toBeDefined();
    expect(netFinding!.severity).toBe("high");
    expect(netFinding!.category).toBe("network");

    expect(aadFinding).toBeDefined();
    expect(aadFinding!.severity).toBe("high");
    expect(aadFinding!.category).toBe("identity");

    // RBAC was enabled, so no RBAC finding
    expect(findings.some((f) => f.title.includes("Kubernetes RBAC"))).toBe(
      false,
    );
  });

  it("paginates across multiple clusters", async () => {
    const creds = makeMockCreds();
    mockManagedClusters.list.mockReturnValue(
      asyncIter([
        {
          ...BASE_CLUSTER,
          id: "/subscriptions/sub-1/resourceGroups/rg-1/providers/Microsoft.ContainerService/managedClusters/aks-a",
          name: "aks-a",
          enableRbac: false,
          networkProfile: { networkPolicy: "azure" },
          aadProfile: { managed: true },
        },
        {
          ...BASE_CLUSTER,
          id: "/subscriptions/sub-1/resourceGroups/rg-2/providers/Microsoft.ContainerService/managedClusters/aks-b",
          name: "aks-b",
          location: "westus",
          enableRbac: true,
          networkProfile: { networkPolicy: "azure" },
          // aadProfile omitted -> AAD finding for aks-b
        },
      ]),
    );

    const findings = await auditAzureAks(creds);

    expect(findings).toHaveLength(2);
    expect(findings.some((f) => f.resourceId?.includes("aks-a"))).toBe(true);
    expect(
      findings.some((f) => f.resourceId?.includes("aks-b") && f.resourceRegion === "westus"),
    ).toBe(true);
  });

  it("testConnection validates real Azure API access, not a string check", async () => {
    const agent = new AzureAksAuditorAgent();
    const validCreds = JSON.stringify({
      tenantId: "t-1",
      clientId: "c-1",
      clientSecret: "s-1",
      subscriptionId: "sub-1",
    });

    // A reachable API returns a (possibly empty) page without throwing.
    mockManagedClusters.list.mockReturnValue(asyncIter([]));
    expect(await agent.testConnection(validCreds)).toBe(true);

    // A non-JSON ref cannot resolve credentials -> false (not a substring match).
    expect(await agent.testConnection("azure-fake")).toBe(false);
  });
});
