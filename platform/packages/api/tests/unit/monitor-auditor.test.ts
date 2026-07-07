// REAL IMPL (BLACKFYRE 2026-06): focused mocked-SDK unit test for the real Azure
// Monitor auditor. vi.mock replaces @azure/arm-monitor's MonitorClient with a
// stub whose diagnosticSettings / logProfiles / activityLogAlerts operations are
// vi.fn()s, so the test drives the auditor's real property-derived logic without
// touching Azure. Covers a pass-case + fail-case for a couple of checks.
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { TokenCredential } from "@azure/identity";
import type { AzureCredentials } from "../../src/agents/azure/credentials.js";

// ---- Helper: async iterable from array (matches the SDK's paged iterators) ----
function asyncIter<T>(items: T[]): AsyncIterable<T> {
  return {
    [Symbol.asyncIterator]() {
      let i = 0;
      return {
        async next() {
          if (i < items.length) {
            return { value: items[i++], done: false as const };
          }
          return { value: undefined as any, done: true as const };
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

// ---- Mock: @azure/arm-monitor ----
const mockDiagnosticSettings = {
  list: vi.fn(),
};
const mockLogProfiles = {
  list: vi.fn(),
};
const mockActivityLogAlerts = {
  listBySubscriptionId: vi.fn(),
};

vi.mock("@azure/arm-monitor", () => ({
  MonitorClient: vi.fn().mockImplementation(() => ({
    diagnosticSettings: mockDiagnosticSettings,
    logProfiles: mockLogProfiles,
    activityLogAlerts: mockActivityLogAlerts,
  })),
}));

// ---- Mock: compliance-mapper (every check resolves to one control) ----
vi.mock("../../src/services/compliance-mapper.js", () => ({
  mapCheckToControls: vi.fn().mockImplementation(() => [
    {
      framework: "soc2",
      controlId: "CC7.2",
      controlName: "Test Control",
      status: "fail",
      weight: 2,
    },
  ]),
}));

// ---- Mock: @azure/identity for credential resolution (testConnection path) ----
vi.mock("@azure/identity", () => ({
  ClientSecretCredential: vi.fn().mockImplementation(() => ({})),
  DefaultAzureCredential: vi.fn().mockImplementation(() => ({})),
}));

// ---- Import after mocks ----
import {
  auditAzureMonitor,
  AzureMonitorAuditorAgent,
} from "../../src/agents/azure/monitor-auditor.js";

// Convenience defaults so each test only sets what it cares about.
function setHealthyDefaults() {
  // One diagnostic setting wired to Log Analytics with an enabled log category.
  mockDiagnosticSettings.list.mockResolvedValue({
    value: [
      {
        id: "/subscriptions/sub-1/providers/Microsoft.Insights/diagnosticSettings/to-law",
        name: "to-law",
        workspaceId:
          "/subscriptions/sub-1/resourceGroups/rg/providers/Microsoft.OperationalInsights/workspaces/law-1",
        logs: [{ category: "Administrative", enabled: true }],
      },
    ],
  });
  // One log profile with indefinite retention covering global.
  mockLogProfiles.list.mockReturnValue(
    asyncIter([
      {
        id: "/subscriptions/sub-1/providers/Microsoft.Insights/logprofiles/default",
        name: "default",
        locations: ["global", "eastus"],
        categories: ["Write", "Delete", "Action"],
        retentionPolicy: { enabled: true, days: 0 },
      },
    ]),
  );
  // One enabled activity log alert.
  mockActivityLogAlerts.listBySubscriptionId.mockReturnValue(
    asyncIter([
      {
        id: "/subscriptions/sub-1/providers/Microsoft.Insights/activityLogAlerts/nsg-alert",
        name: "nsg-alert",
        enabled: true,
      },
    ]),
  );
}

describe("auditAzureMonitor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ---- Check 1: diagnostic settings / Log Analytics linkage ----

  it("PASS: a fully-healthy monitor config yields no findings", async () => {
    setHealthyDefaults();

    const findings = await auditAzureMonitor(makeMockCreds());

    expect(findings).toHaveLength(0);
    // resourceUri passed to diagnosticSettings.list must be the subscription.
    expect(mockDiagnosticSettings.list).toHaveBeenCalledWith(
      "/subscriptions/sub-1",
    );
  });

  it("FAIL: no diagnostic setting flags Activity Log export as not configured", async () => {
    setHealthyDefaults();
    // Override: empty diagnostic-settings collection.
    mockDiagnosticSettings.list.mockResolvedValue({ value: [] });

    const findings = await auditAzureMonitor(makeMockCreds());

    const exportFinding = findings.find((f) =>
      f.title.includes("no diagnostic setting"),
    );
    expect(exportFinding).toBeDefined();
    expect(exportFinding!.severity).toBe("high");
    expect(exportFinding!.category).toBe("logging");
    expect(exportFinding!.resourceType).toBe(
      "Microsoft.Insights/diagnosticSettings",
    );
    expect(exportFinding!.resourceRegion).toBe("global");
    expect(exportFinding!.controlMappings!.length).toBeGreaterThan(0);
  });

  it("FAIL: a diagnostic setting without a Log Analytics workspace flags missing linkage", async () => {
    setHealthyDefaults();
    // Override: setting exports only to storage, no workspaceId.
    mockDiagnosticSettings.list.mockResolvedValue({
      value: [
        {
          id: "/subscriptions/sub-1/providers/Microsoft.Insights/diagnosticSettings/to-storage",
          name: "to-storage",
          storageAccountId:
            "/subscriptions/sub-1/resourceGroups/rg/providers/Microsoft.Storage/storageAccounts/sa1",
          logs: [{ category: "Administrative", enabled: true }],
        },
      ],
    });

    const findings = await auditAzureMonitor(makeMockCreds());

    const linkageFinding = findings.find((f) =>
      f.title.includes("not linked to a Log Analytics workspace"),
    );
    expect(linkageFinding).toBeDefined();
    expect(linkageFinding!.severity).toBe("medium");
    expect(linkageFinding!.resourceId).toBe(
      "/subscriptions/sub-1/providers/Microsoft.Insights/diagnosticSettings/to-storage",
    );
  });

  // ---- Check 2: log profiles ----

  it("FAIL: no log profile flags absent Activity Log profile", async () => {
    setHealthyDefaults();
    // Override: no log profiles at all.
    mockLogProfiles.list.mockReturnValue(asyncIter([]));

    const findings = await auditAzureMonitor(makeMockCreds());

    const profileFinding = findings.find((f) =>
      f.title.includes("No Activity Log profile is configured"),
    );
    expect(profileFinding).toBeDefined();
    expect(profileFinding!.severity).toBe("medium");
    expect(profileFinding!.resourceType).toBe(
      "Microsoft.Insights/logProfiles",
    );
  });

  it("FAIL: a log profile with disabled retention flags retention gap", async () => {
    setHealthyDefaults();
    mockLogProfiles.list.mockReturnValue(
      asyncIter([
        {
          id: "/subscriptions/sub-1/providers/Microsoft.Insights/logprofiles/default",
          name: "default",
          locations: ["global"],
          categories: ["Write"],
          retentionPolicy: { enabled: false, days: 0 },
        },
      ]),
    );

    const findings = await auditAzureMonitor(makeMockCreds());

    const retentionFinding = findings.find((f) =>
      f.title.includes("retention disabled"),
    );
    expect(retentionFinding).toBeDefined();
    expect(retentionFinding!.severity).toBe("medium");
    expect(retentionFinding!.controlMappings!.length).toBeGreaterThan(0);
  });

  // ---- Check 3: activity log alerts ----

  it("FAIL: no activity log alerts flags missing alerting", async () => {
    setHealthyDefaults();
    mockActivityLogAlerts.listBySubscriptionId.mockReturnValue(asyncIter([]));

    const findings = await auditAzureMonitor(makeMockCreds());

    const alertFinding = findings.find((f) =>
      f.title.includes("No Activity Log alerts are configured"),
    );
    expect(alertFinding).toBeDefined();
    expect(alertFinding!.severity).toBe("medium");
    expect(alertFinding!.resourceType).toBe(
      "Microsoft.Insights/activityLogAlerts",
    );
  });

  it("FAIL: a disabled activity log alert is flagged with its real resource id", async () => {
    setHealthyDefaults();
    mockActivityLogAlerts.listBySubscriptionId.mockReturnValue(
      asyncIter([
        {
          id: "/subscriptions/sub-1/providers/Microsoft.Insights/activityLogAlerts/inert-alert",
          name: "inert-alert",
          enabled: false,
        },
      ]),
    );

    const findings = await auditAzureMonitor(makeMockCreds());

    const disabledFinding = findings.find((f) =>
      f.title.includes('Activity Log alert "inert-alert" is disabled'),
    );
    expect(disabledFinding).toBeDefined();
    expect(disabledFinding!.severity).toBe("low");
    expect(disabledFinding!.resourceId).toBe(
      "/subscriptions/sub-1/providers/Microsoft.Insights/activityLogAlerts/inert-alert",
    );
  });
});

describe("AzureMonitorAuditorAgent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("streams real findings through ctx.onFinding and stamps source", async () => {
    setHealthyDefaults();
    // Force one finding so we can assert the streaming/source behavior.
    mockActivityLogAlerts.listBySubscriptionId.mockReturnValue(asyncIter([]));

    const agent = new AzureMonitorAuditorAgent();
    const emitted: any[] = [];
    const result = await agent.run({
      scanId: "scan-1",
      tenantId: "tenant-1",
      integrationId: "integ-1",
      credentialRef: JSON.stringify({
        tenantId: "t-1",
        clientId: "c-1",
        clientSecret: "s-1",
        subscriptionId: "sub-1",
      }),
      frameworks: ["soc2"],
      onProgress: () => {},
      onFinding: async (f) => {
        emitted.push(f);
      },
    });

    expect(result.error).toBeNull();
    expect(result.findingsCount).toBe(emitted.length);
    expect(emitted.length).toBeGreaterThan(0);
    expect(emitted.every((f) => f.source === "azure-monitor-auditor")).toBe(
      true,
    );
  });

  it("testConnection validates real API access, not a string check", async () => {
    setHealthyDefaults();

    const agent = new AzureMonitorAuditorAgent();
    const validCreds = JSON.stringify({
      tenantId: "t-1",
      clientId: "c-1",
      clientSecret: "s-1",
      subscriptionId: "sub-1",
    });

    // Healthy iterator -> connection succeeds.
    await expect(agent.testConnection(validCreds)).resolves.toBe(true);

    // The old stub returned true for any string; a bogus non-JSON ref must now
    // fail because credential resolution throws.
    await expect(agent.testConnection("azure-fake")).resolves.toBe(false);
  });
});
