// REAL IMPL (BLACKFYRE 2026-06): mocked-SDK unit test for the real Azure App
// Service auditor. We vi.mock @azure/arm-appservice (webApps.list +
// getConfiguration) and assert findings are derived from the actual returned
// properties — one pass-case (compliant app => no findings) and one fail-case
// (insecure app => httpsOnly / minTlsVersion / identity / remoteDebugging
// findings) for the httpsOnly + minTlsVersion + remoteDebugging checks.

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { TokenCredential } from "@azure/identity";
import type { AzureCredentials } from "../../src/agents/azure/credentials.js";

// ---- Helper: async iterable from array (matches azure-auditor.test.ts) ----
function asyncIter<T>(items: T[]): AsyncIterable<T> {
  return {
    [Symbol.asyncIterator]() {
      let i = 0;
      return {
        async next() {
          if (i < items.length) return { value: items[i++], done: false as const };
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

// ---- Mock: @azure/arm-appservice ----
const mockWebApps = {
  list: vi.fn(),
  getConfiguration: vi.fn(),
};

vi.mock("@azure/arm-appservice", () => ({
  WebSiteManagementClient: vi.fn().mockImplementation(() => ({
    webApps: mockWebApps,
  })),
}));

// ---- Mock: @azure/arm-authorization (used by testConnection only) ----
const mockRoleAssignments = { listForSubscription: vi.fn() };
vi.mock("@azure/arm-authorization", () => ({
  AuthorizationManagementClient: vi.fn().mockImplementation(() => ({
    roleAssignments: mockRoleAssignments,
  })),
}));

// ---- Mock: compliance-mapper (return a non-empty mapping) ----
vi.mock("../../src/services/compliance-mapper.js", () => ({
  mapCheckToControls: vi.fn().mockImplementation((_checkType: string) => [
    {
      framework: "soc2",
      controlId: "CC6.7",
      controlName: "Test Control",
      status: "fail",
      weight: 3,
    },
  ]),
}));

// ---- Mock: @azure/identity for credential resolution in the agent path ----
vi.mock("@azure/identity", () => ({
  ClientSecretCredential: vi.fn().mockImplementation(() => ({})),
  DefaultAzureCredential: vi.fn().mockImplementation(() => ({})),
}));

// ---- Import after mocks ----
import {
  auditAzureAppService,
  AzureAppServiceAuditorAgent,
} from "../../src/agents/azure/app-service-auditor.js";

describe("auditAzureAppService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fail-case: insecure web app produces https, tls, identity and remote-debugging findings", async () => {
    const creds = makeMockCreds();

    mockWebApps.list.mockReturnValue(
      asyncIter([
        {
          id: "/subscriptions/sub-1/resourceGroups/rg-1/providers/Microsoft.Web/sites/insecure-app",
          name: "insecure-app",
          location: "eastus",
          httpsOnly: false,
          identity: { type: "None" },
        },
      ]),
    );

    // Real getConfiguration returns a SiteConfigResource with weak TLS + debug on.
    mockWebApps.getConfiguration.mockResolvedValue({
      minTlsVersion: "1.0",
      remoteDebuggingEnabled: true,
    });

    const findings = await auditAzureAppService(creds);

    // All four checks should fire for this app.
    const https = findings.find((f) => f.title.includes("HTTPS-only"));
    const tls = findings.find((f) => f.title.includes("TLS below 1.2"));
    const identity = findings.find((f) => f.title.includes("managed identity"));
    const debug = findings.find((f) => f.title.includes("remote debugging"));

    expect(https).toBeDefined();
    expect(https!.severity).toBe("high");
    expect(https!.resourceId).toContain("insecure-app");
    expect(https!.resourceRegion).toBe("eastus");
    expect(https!.controlMappings!.length).toBeGreaterThan(0);

    expect(tls).toBeDefined();
    expect(tls!.severity).toBe("high");
    expect(tls!.category).toBe("encryption");

    expect(identity).toBeDefined();
    expect(debug).toBeDefined();
    expect(debug!.category).toBe("config");

    // getConfiguration was called with the real resource group + app name.
    expect(mockWebApps.getConfiguration).toHaveBeenCalledWith(
      "rg-1",
      "insecure-app",
    );
  });

  it("pass-case: fully compliant web app produces no findings", async () => {
    const creds = makeMockCreds();

    mockWebApps.list.mockReturnValue(
      asyncIter([
        {
          id: "/subscriptions/sub-1/resourceGroups/rg-1/providers/Microsoft.Web/sites/secure-app",
          name: "secure-app",
          location: "westus",
          httpsOnly: true,
          identity: { type: "SystemAssigned" },
        },
      ]),
    );

    mockWebApps.getConfiguration.mockResolvedValue({
      minTlsVersion: "1.2",
      remoteDebuggingEnabled: false,
    });

    const findings = await auditAzureAppService(creds);

    expect(findings).toHaveLength(0);
  });
});

describe("AzureAppServiceAuditorAgent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("emits real findings through ctx.onFinding for an insecure app", async () => {
    const agent = new AzureAppServiceAuditorAgent();

    mockWebApps.list.mockReturnValue(
      asyncIter([
        {
          id: "/subscriptions/sub-1/resourceGroups/rg-1/providers/Microsoft.Web/sites/insecure-app",
          name: "insecure-app",
          location: "eastus",
          httpsOnly: false,
          identity: { type: "None" },
        },
      ]),
    );
    mockWebApps.getConfiguration.mockResolvedValue({
      minTlsVersion: "1.0",
      remoteDebuggingEnabled: true,
    });

    const emitted: { title: string; source?: string }[] = [];
    const result = await agent.run({
      scanId: "scan-1",
      tenantId: "tenant-1",
      integrationId: "int-1",
      credentialRef: JSON.stringify({
        tenantId: "t-1",
        clientId: "c-1",
        clientSecret: "s-1",
        subscriptionId: "sub-1",
      }),
      frameworks: ["soc2"],
      onProgress: () => {},
      onFinding: async (f) => {
        emitted.push({ title: f.title, source: f.source });
      },
    });

    expect(result.error).toBeNull();
    expect(result.findingsCount).toBe(4);
    expect(emitted).toHaveLength(4);
    expect(emitted.every((f) => f.source === "azure-app-service-auditor")).toBe(
      true,
    );
  });

  it("testConnection returns false for a bogus (non-JSON) credentialRef", async () => {
    const agent = new AzureAppServiceAuditorAgent();
    const result = await agent.testConnection("azure-fake");
    expect(result).toBe(false);
  });
});
