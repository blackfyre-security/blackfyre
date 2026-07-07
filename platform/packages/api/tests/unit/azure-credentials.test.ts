import { describe, it, expect, vi } from "vitest";

vi.mock("@azure/identity", () => {
  class MockClientSecretCredential {
    tenantId: string;
    clientId: string;
    constructor(tenantId: string, clientId: string, _clientSecret: string) {
      this.tenantId = tenantId;
      this.clientId = clientId;
    }
  }
  return { ClientSecretCredential: MockClientSecretCredential };
});

import { resolveAzureCredentials } from "../../src/agents/azure/credentials.js";

describe("Azure Credential Resolver", () => {
  it("resolves JSON credentialRef to AzureCredentials with credential, subscriptionId, tenantId", async () => {
    const credentialRef = JSON.stringify({
      tenantId: "t-1",
      clientId: "c-1",
      clientSecret: "s-1",
      subscriptionId: "sub-1",
    });

    const result = await resolveAzureCredentials(credentialRef);

    expect(result.subscriptionId).toBe("sub-1");
    expect(result.tenantId).toBe("t-1");
    expect(result.credential).toBeDefined();
  });

  it("throws on unsupported credentialRef format", async () => {
    await expect(
      resolveAzureCredentials("invalid-string"),
    ).rejects.toThrow("Unsupported Azure credential format");
  });

  it("creates valid ClientSecretCredential from tenant/client/secret", async () => {
    const credentialRef = JSON.stringify({
      tenantId: "t-1",
      clientId: "c-1",
      clientSecret: "s-1",
      subscriptionId: "sub-1",
    });

    const result = await resolveAzureCredentials(credentialRef);

    // The credential should be truthy (a ClientSecretCredential instance)
    expect(result.credential).toBeTruthy();
    // Verify the mock got correct parameters
    const cred = result.credential as any;
    expect(cred.tenantId).toBe("t-1");
    expect(cred.clientId).toBe("c-1");
  });
});
