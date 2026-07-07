import { describe, it, expect, vi, beforeEach } from "vitest";
import type { TokenCredential } from "@azure/identity";
import type { AzureCredentials } from "../../src/agents/azure/credentials.js";

// ---- Helper: async iterable from array ----
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

// ---- Shared mock credentials ----
function makeMockCreds(): AzureCredentials {
  return {
    credential: {} as TokenCredential,
    subscriptionId: "sub-1",
    tenantId: "t-1",
  };
}

// ---- Mock: @azure/arm-authorization ----
const mockRoleAssignments = {
  listForSubscription: vi.fn(),
};
const mockRoleDefinitions = {
  list: vi.fn(),
};
const mockClassicAdmins = {
  list: vi.fn(),
};

vi.mock("@azure/arm-authorization", () => ({
  AuthorizationManagementClient: vi.fn().mockImplementation(() => ({
    roleAssignments: mockRoleAssignments,
    roleDefinitions: mockRoleDefinitions,
    classicAdministrators: mockClassicAdmins,
  })),
}));

// ---- Mock: @azure/arm-storage ----
const mockStorageAccounts = {
  list: vi.fn(),
};
const mockBlobServices = {
  getServiceProperties: vi.fn(),
};

vi.mock("@azure/arm-storage", () => ({
  StorageManagementClient: vi.fn().mockImplementation(() => ({
    storageAccounts: mockStorageAccounts,
    blobServices: mockBlobServices,
  })),
}));

// ---- Mock: @azure/arm-compute ----
const mockVirtualMachines = {
  listAll: vi.fn(),
};

vi.mock("@azure/arm-compute", () => ({
  ComputeManagementClient: vi.fn().mockImplementation(() => ({
    virtualMachines: mockVirtualMachines,
  })),
}));

// ---- Mock: @azure/arm-network ----
const mockNetworkSecurityGroups = {
  listAll: vi.fn(),
};
const mockFlowLogs = {
  list: vi.fn(),
};
const mockNetworkInterfaces = {
  get: vi.fn(),
};

vi.mock("@azure/arm-network", () => ({
  NetworkManagementClient: vi.fn().mockImplementation(() => ({
    networkSecurityGroups: mockNetworkSecurityGroups,
    flowLogs: mockFlowLogs,
    networkInterfaces: mockNetworkInterfaces,
  })),
}));

// ---- Mock: @azure/arm-keyvault ----
const mockVaults = {
  listBySubscription: vi.fn(),
};

vi.mock("@azure/arm-keyvault", () => ({
  KeyVaultManagementClient: vi.fn().mockImplementation(() => ({
    vaults: mockVaults,
  })),
}));

// ---- Mock: compliance-mapper ----
vi.mock("../../src/services/compliance-mapper.js", () => ({
  mapCheckToControls: vi.fn().mockImplementation((checkType: string) => [
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
import { auditAzureIAM } from "../../src/agents/azure/iam-auditor.js";
import { auditAzureStorage } from "../../src/agents/azure/storage-auditor.js";
import { auditAzureCompute } from "../../src/agents/azure/compute-auditor.js";
import { auditAzureNetwork } from "../../src/agents/azure/network-auditor.js";
import { auditAzureKeyVault } from "../../src/agents/azure/keyvault-auditor.js";
import { CloudAuditorAzureAgent } from "../../src/agents/cloud-auditor-azure.js";

describe("CloudAuditorAzureAgent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("produces IAM findings from auditAzureIAM", async () => {
    const creds = makeMockCreds();
    const ownerRoleGuid = "8e3af657-a8ff-443c-a75c-2fe8c4bcb635";

    // Mock 5 Owner role assignments (> 3 threshold)
    mockRoleAssignments.listForSubscription.mockReturnValue(
      asyncIter(
        Array.from({ length: 5 }, (_, i) => ({
          id: `assignment-${i}`,
          principalId: `principal-${i}`,
          principalType: "User",
          roleDefinitionId: `/subscriptions/sub-1/providers/Microsoft.Authorization/roleDefinitions/${ownerRoleGuid}`,
        })),
      ),
    );

    // Mock no custom roles
    mockRoleDefinitions.list.mockReturnValue(asyncIter([]));

    // Mock no classic admins
    mockClassicAdmins.list.mockReturnValue(asyncIter([]));

    const findings = await auditAzureIAM(creds);

    expect(findings.length).toBeGreaterThanOrEqual(1);
    expect(findings[0].category).toBe("iam");
    expect(findings[0].controlMappings.length).toBeGreaterThan(0);
  });

  it("produces storage findings from auditAzureStorage", async () => {
    const creds = makeMockCreds();

    // Mock a storage account with public blob access
    mockStorageAccounts.list.mockReturnValue(
      asyncIter([
        {
          id: "/subscriptions/sub-1/resourceGroups/rg-1/providers/Microsoft.Storage/storageAccounts/mystorage",
          name: "mystorage",
          enableHttpsTrafficOnly: true,
          allowBlobPublicAccess: true,
          encryption: { keySource: "Microsoft.Storage" },
        },
      ]),
    );

    // Mock blob service without soft delete
    mockBlobServices.getServiceProperties.mockResolvedValue({
      deleteRetentionPolicy: { enabled: false },
    });

    const findings = await auditAzureStorage(creds);

    expect(findings.length).toBeGreaterThanOrEqual(1);
    // Should have at least public blob finding
    const publicBlobFinding = findings.find((f) =>
      f.title.includes("public blob access"),
    );
    expect(publicBlobFinding).toBeDefined();
    expect(publicBlobFinding!.severity).toBe("critical");
    expect(publicBlobFinding!.controlMappings.length).toBeGreaterThan(0);
  });

  it("produces compute findings from auditAzureCompute", async () => {
    const creds = makeMockCreds();

    // Mock a VM with unencrypted disk
    mockVirtualMachines.listAll.mockReturnValue(
      asyncIter([
        {
          id: "/subscriptions/sub-1/resourceGroups/rg-1/providers/Microsoft.Compute/virtualMachines/vm-1",
          name: "vm-1",
          storageProfile: {
            osDisk: {
              encryptionSettings: { enabled: false },
              managedDisk: { diskEncryptionSet: null },
              vhd: null,
            },
          },
          networkProfile: { networkInterfaces: [] },
        },
      ]),
    );

    const findings = await auditAzureCompute(creds);

    expect(findings.length).toBeGreaterThanOrEqual(1);
    expect(findings[0].category).toBe("encryption");
    expect(findings[0].severity).toBe("high");
    expect(findings[0].controlMappings.length).toBeGreaterThan(0);
  });

  it("produces network findings from auditAzureNetwork", async () => {
    const creds = makeMockCreds();

    // Mock an NSG with SSH from any
    mockNetworkSecurityGroups.listAll.mockReturnValue(
      asyncIter([
        {
          id: "/subscriptions/sub-1/resourceGroups/rg-1/providers/Microsoft.Network/networkSecurityGroups/nsg-1",
          name: "nsg-1",
          securityRules: [
            {
              name: "AllowSSH",
              access: "Allow",
              direction: "Inbound",
              sourceAddressPrefix: "*",
              destinationPortRange: "22",
            },
          ],
        },
      ]),
    );

    // Mock no flow logs
    mockFlowLogs.list.mockReturnValue(asyncIter([]));

    const findings = await auditAzureNetwork(creds);

    expect(findings.length).toBeGreaterThanOrEqual(1);
    const sshFinding = findings.find((f) => f.title.includes("SSH"));
    expect(sshFinding).toBeDefined();
    expect(sshFinding!.severity).toBe("critical");
    expect(sshFinding!.controlMappings.length).toBeGreaterThan(0);
  });

  it("produces keyvault findings from auditAzureKeyVault", async () => {
    const creds = makeMockCreds();

    // Mock a vault with no soft delete and no purge protection
    mockVaults.listBySubscription.mockReturnValue(
      asyncIter([
        {
          id: "/subscriptions/sub-1/resourceGroups/rg-1/providers/Microsoft.KeyVault/vaults/myvault",
          name: "myvault",
          properties: {
            enableSoftDelete: false,
            enablePurgeProtection: false,
            enableRbacAuthorization: false,
          },
        },
      ]),
    );

    const findings = await auditAzureKeyVault(creds);

    expect(findings.length).toBe(3);
    expect(findings.some((f) => f.title.includes("soft delete"))).toBe(true);
    expect(findings.some((f) => f.title.includes("purge protection"))).toBe(true);
    expect(findings.some((f) => f.title.includes("RBAC"))).toBe(true);
    // Verify all findings have control mappings
    for (const finding of findings) {
      expect(finding.controlMappings.length).toBeGreaterThan(0);
    }
  });

  it("testConnection validates real Azure API access not string check", async () => {
    const agent = new CloudAuditorAzureAgent();
    const validCreds = JSON.stringify({
      tenantId: "t-1",
      clientId: "c-1",
      clientSecret: "s-1",
      subscriptionId: "sub-1",
    });

    // Mock role assignments to return at least one entry (access is valid)
    mockRoleAssignments.listForSubscription.mockReturnValue(
      asyncIter([{ id: "test-assignment" }]),
    );

    const result = await agent.testConnection(validCreds);
    expect(result).toBe(true);

    // Verify it does NOT use string check
    // The old stub used: credentialRef.includes("azure")
    // With real implementation, "azure" string without proper JSON should fail
    const bogusResult = await agent.testConnection("azure-fake");
    expect(bogusResult).toBe(false);
  });
});
