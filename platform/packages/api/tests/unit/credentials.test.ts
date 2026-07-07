// REAL IMPL (BLACKFYRE 2026-06): focused mocked-SDK tests for the real Azure
// credential resolver. The @azure/identity SDK is mocked so we can assert that
// the correct real credential type is constructed with the correct arguments
// for each production auth mode, without making network/IMDS calls.
import { describe, it, expect, vi, beforeEach } from "vitest";

const clientSecretCtor = vi.fn();
const defaultCtor = vi.fn();

vi.mock("@azure/identity", () => {
  class MockClientSecretCredential {
    kind = "client_secret";
    tenantId: string;
    clientId: string;
    constructor(tenantId: string, clientId: string, clientSecret: string) {
      clientSecretCtor(tenantId, clientId, clientSecret);
      this.tenantId = tenantId;
      this.clientId = clientId;
    }
  }
  class MockDefaultAzureCredential {
    kind = "default";
    options?: { tenantId?: string };
    constructor(options?: { tenantId?: string }) {
      defaultCtor(options);
      this.options = options;
    }
  }
  return {
    ClientSecretCredential: MockClientSecretCredential,
    DefaultAzureCredential: MockDefaultAzureCredential,
  };
});

import { resolveAzureCredentials } from "../../src/agents/azure/credentials.js";

describe("resolveAzureCredentials (real)", () => {
  beforeEach(() => {
    clientSecretCtor.mockClear();
    defaultCtor.mockClear();
  });

  // ---- Service Principal mode (pass-case) ----
  it("builds a ClientSecretCredential from a full Service Principal config", async () => {
    const ref = JSON.stringify({
      tenantId: "t-1",
      clientId: "c-1",
      clientSecret: "s-1",
      subscriptionId: "sub-1",
    });

    const result = await resolveAzureCredentials(ref);

    expect(result.subscriptionId).toBe("sub-1");
    expect(result.tenantId).toBe("t-1");
    expect((result.credential as { kind: string }).kind).toBe("client_secret");
    expect(clientSecretCtor).toHaveBeenCalledWith("t-1", "c-1", "s-1");
    expect(defaultCtor).not.toHaveBeenCalled();
  });

  // ---- Service Principal mode (fail-case): incomplete SP fields ----
  it("throws when authMode=client_secret but SP fields are incomplete", async () => {
    const ref = JSON.stringify({
      authMode: "client_secret",
      tenantId: "t-1",
      // clientId / clientSecret intentionally missing
      subscriptionId: "sub-1",
    });

    await expect(resolveAzureCredentials(ref)).rejects.toThrow(
      "Azure Service Principal credentials must include tenantId, clientId, clientSecret",
    );
    expect(clientSecretCtor).not.toHaveBeenCalled();
  });

  // ---- Managed / Workload identity mode (pass-case) ----
  it("builds a DefaultAzureCredential when no client secret is supplied", async () => {
    const ref = JSON.stringify({
      tenantId: "t-2",
      subscriptionId: "sub-2",
    });

    const result = await resolveAzureCredentials(ref);

    expect(result.subscriptionId).toBe("sub-2");
    expect(result.tenantId).toBe("t-2");
    expect((result.credential as { kind: string }).kind).toBe("default");
    // tenant hint is forwarded to DefaultAzureCredential
    expect(defaultCtor).toHaveBeenCalledWith({ tenantId: "t-2" });
    expect(clientSecretCtor).not.toHaveBeenCalled();
  });

  it("builds a DefaultAzureCredential with no tenant hint when tenantId is absent", async () => {
    const ref = JSON.stringify({ subscriptionId: "sub-3" });

    const result = await resolveAzureCredentials(ref);

    expect(result.subscriptionId).toBe("sub-3");
    expect(result.tenantId).toBe("");
    expect((result.credential as { kind: string }).kind).toBe("default");
    expect(defaultCtor).toHaveBeenCalledWith(undefined);
  });

  // ---- subscriptionId is mandatory for every ARM client (fail-case) ----
  it("throws when subscriptionId is missing", async () => {
    const ref = JSON.stringify({
      tenantId: "t-1",
      clientId: "c-1",
      clientSecret: "s-1",
    });

    await expect(resolveAzureCredentials(ref)).rejects.toThrow(
      "Azure credentials must include subscriptionId",
    );
  });

  // ---- format guards ----
  it("throws on non-JSON credentialRef", async () => {
    await expect(resolveAzureCredentials("invalid-string")).rejects.toThrow(
      "Unsupported Azure credential format",
    );
  });

  it("throws on vault:// credentialRef (dereferenced upstream)", async () => {
    await expect(
      resolveAzureCredentials("vault://secret/azure/sp"),
    ).rejects.toThrow("Vault credential resolution not yet integrated.");
  });
});
