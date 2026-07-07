// REAL IMPL (BLACKFYRE 2026-06): mocked-SDK unit test for the real Azure SQL
// auditor. We vi.mock @azure/arm-sql (servers.list + serverBlobAuditingPolicies
// + serverAzureADAdministrators + firewallRules + databases +
// transparentDataEncryptions) and assert findings are derived from the actual
// returned properties — one pass-case (fully hardened server => no findings)
// and one fail-case (insecure server => auditing / AAD-admin / firewall / TDE
// findings) for the auditing + firewall + TDE + AAD-admin checks.

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { TokenCredential } from "@azure/identity";
import type { AzureCredentials } from "../../src/agents/azure/credentials.js";

// ---- Helper: async iterable from array (matches app-service-auditor.test.ts) ----
function asyncIter<T>(items: T[]): AsyncIterable<T> {
  return {
    [Symbol.asyncIterator]() {
      let i = 0;
      return {
        async next() {
          if (i < items.length)
            return { value: items[i++], done: false as const };
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

// ---- Mock: @azure/arm-sql ----
const mockServers = { list: vi.fn() };
const mockServerBlobAuditingPolicies = { get: vi.fn() };
const mockServerAzureADAdministrators = { listByServer: vi.fn() };
const mockFirewallRules = { listByServer: vi.fn() };
const mockDatabases = { listByServer: vi.fn() };
const mockTransparentDataEncryptions = { get: vi.fn() };

vi.mock("@azure/arm-sql", () => ({
  SqlManagementClient: vi.fn().mockImplementation(() => ({
    servers: mockServers,
    serverBlobAuditingPolicies: mockServerBlobAuditingPolicies,
    serverAzureADAdministrators: mockServerAzureADAdministrators,
    firewallRules: mockFirewallRules,
    databases: mockDatabases,
    transparentDataEncryptions: mockTransparentDataEncryptions,
  })),
}));

// ---- Mock: compliance-mapper (return a non-empty mapping) ----
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

// ---- Mock: @azure/identity for credential resolution in the agent path ----
vi.mock("@azure/identity", () => ({
  ClientSecretCredential: vi.fn().mockImplementation(() => ({})),
  DefaultAzureCredential: vi.fn().mockImplementation(() => ({})),
}));

// ---- Import after mocks ----
import {
  auditAzureSql,
  AzureSqlAuditorAgent,
} from "../../src/agents/azure/sql-auditor.js";

const SERVER_ID =
  "/subscriptions/sub-1/resourceGroups/rg-1/providers/Microsoft.Sql/servers/sql-1";

describe("auditAzureSql", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fail-case: insecure server produces auditing, AAD-admin, firewall and TDE findings", async () => {
    const creds = makeMockCreds();

    mockServers.list.mockReturnValue(
      asyncIter([
        { id: SERVER_ID, name: "sql-1", location: "eastus" },
      ]),
    );

    // Auditing disabled.
    mockServerBlobAuditingPolicies.get.mockResolvedValue({ state: "Disabled" });

    // No Azure AD administrator configured.
    mockServerAzureADAdministrators.listByServer.mockReturnValue(asyncIter([]));

    // An "allow all Azure services" firewall rule (0.0.0.0).
    mockFirewallRules.listByServer.mockReturnValue(
      asyncIter([
        {
          name: "AllowAllWindowsAzureIps",
          startIpAddress: "0.0.0.0",
          endIpAddress: "0.0.0.0",
        },
      ]),
    );

    // One non-system database (master is skipped).
    mockDatabases.listByServer.mockReturnValue(
      asyncIter([
        {
          id: `${SERVER_ID}/databases/appdb`,
          name: "appdb",
          location: "eastus",
        },
        { id: `${SERVER_ID}/databases/master`, name: "master" },
      ]),
    );

    // TDE disabled on the database.
    mockTransparentDataEncryptions.get.mockResolvedValue({ state: "Disabled" });

    const findings = await auditAzureSql(creds);

    const auditing = findings.find((f) => f.title.includes("auditing enabled"));
    const aad = findings.find((f) => f.title.includes("Azure AD administrator"));
    const firewall = findings.find((f) => f.title.includes("allows all access"));
    const tde = findings.find((f) => f.title.includes("TDE enabled"));

    expect(auditing).toBeDefined();
    expect(auditing!.severity).toBe("high");
    expect(auditing!.category).toBe("logging");
    expect(auditing!.resourceId).toBe(SERVER_ID);

    expect(aad).toBeDefined();
    expect(aad!.category).toBe("identity");

    expect(firewall).toBeDefined();
    expect(firewall!.category).toBe("network");
    expect(firewall!.resourceId).toBe(SERVER_ID);

    expect(tde).toBeDefined();
    expect(tde!.severity).toBe("critical");
    expect(tde!.category).toBe("encryption");
    expect(tde!.resourceId).toBe(`${SERVER_ID}/databases/appdb`);
    expect(tde!.controlMappings!.length).toBeGreaterThan(0);

    // TDE was queried with the real (rg, server, db, "current") tuple, and only
    // for the non-system database (master is skipped).
    expect(mockTransparentDataEncryptions.get).toHaveBeenCalledTimes(1);
    expect(mockTransparentDataEncryptions.get).toHaveBeenCalledWith(
      "rg-1",
      "sql-1",
      "appdb",
      "current",
    );
    // Sub-resource APIs were addressed by the real resource group + server name.
    expect(mockServerBlobAuditingPolicies.get).toHaveBeenCalledWith(
      "rg-1",
      "sql-1",
    );
    expect(mockFirewallRules.listByServer).toHaveBeenCalledWith("rg-1", "sql-1");
  });

  it("pass-case: fully hardened server produces no findings", async () => {
    const creds = makeMockCreds();

    mockServers.list.mockReturnValue(
      asyncIter([
        { id: SERVER_ID, name: "sql-1", location: "westus" },
      ]),
    );

    // Auditing enabled.
    mockServerBlobAuditingPolicies.get.mockResolvedValue({ state: "Enabled" });

    // An Azure AD administrator is configured.
    mockServerAzureADAdministrators.listByServer.mockReturnValue(
      asyncIter([{ login: "dba@contoso.com", administratorType: "ActiveDirectory" }]),
    );

    // Only a narrow least-privilege firewall rule (not allow-all).
    mockFirewallRules.listByServer.mockReturnValue(
      asyncIter([
        {
          name: "office",
          startIpAddress: "203.0.113.10",
          endIpAddress: "203.0.113.10",
        },
      ]),
    );

    mockDatabases.listByServer.mockReturnValue(
      asyncIter([
        { id: `${SERVER_ID}/databases/appdb`, name: "appdb", location: "westus" },
      ]),
    );

    // TDE enabled on the database.
    mockTransparentDataEncryptions.get.mockResolvedValue({ state: "Enabled" });

    const findings = await auditAzureSql(creds);

    expect(findings).toHaveLength(0);
  });
});

describe("AzureSqlAuditorAgent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("emits real findings through ctx.onFinding for an insecure server", async () => {
    const agent = new AzureSqlAuditorAgent();

    mockServers.list.mockReturnValue(
      asyncIter([{ id: SERVER_ID, name: "sql-1", location: "eastus" }]),
    );
    mockServerBlobAuditingPolicies.get.mockResolvedValue({ state: "Disabled" });
    mockServerAzureADAdministrators.listByServer.mockReturnValue(asyncIter([]));
    mockFirewallRules.listByServer.mockReturnValue(
      asyncIter([
        {
          name: "AllowAll",
          startIpAddress: "0.0.0.0",
          endIpAddress: "255.255.255.255",
        },
      ]),
    );
    mockDatabases.listByServer.mockReturnValue(
      asyncIter([{ id: `${SERVER_ID}/databases/appdb`, name: "appdb" }]),
    );
    mockTransparentDataEncryptions.get.mockResolvedValue({ state: "Disabled" });

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
    // auditing + AAD admin + firewall + TDE = 4 findings.
    expect(result.findingsCount).toBe(4);
    expect(emitted).toHaveLength(4);
    expect(emitted.every((f) => f.source === "azure-sql-auditor")).toBe(true);
  });

  it("testConnection returns false for a bogus (non-JSON) credentialRef", async () => {
    const agent = new AzureSqlAuditorAgent();
    const result = await agent.testConnection("azure-fake");
    expect(result).toBe(false);
  });
});
