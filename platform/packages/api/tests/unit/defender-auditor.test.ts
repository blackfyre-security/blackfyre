// REAL IMPL (BLACKFYRE 2026-06): focused mocked-SDK unit test for the real Azure
// Defender for Cloud auditor. We vi.mock @azure/arm-security so no live Azure
// call is made; each test drives the mocked SecurityCenter client and asserts
// findings are derived from real properties. Covers a pass-case + fail-case for
// the pricings check and the security-contacts check, plus a real
// testConnection (valid creds -> true, bogus creds -> false).
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

// ---- Mock: @azure/arm-security ----
const mockPricings = { list: vi.fn() };
const mockAutoProvisioning = { list: vi.fn() };
const mockSecurityContacts = { list: vi.fn() };

vi.mock("@azure/arm-security", () => ({
  SecurityCenter: vi.fn().mockImplementation(() => ({
    pricings: mockPricings,
    autoProvisioningSettings: mockAutoProvisioning,
    securityContacts: mockSecurityContacts,
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
  auditAzureDefender,
  AzureDefenderAuditorAgent,
} from "../../src/agents/azure/defender-auditor.js";

// Defaults that produce NO findings, so each test can isolate one check.
function setHealthyDefaults() {
  mockPricings.list.mockResolvedValue({
    value: [{ name: "default", id: "/sub/default", pricingTier: "Standard" }],
  });
  mockAutoProvisioning.list.mockReturnValue(
    asyncIter([{ name: "default", id: "/sub/ap", autoProvision: "On" }]),
  );
  mockSecurityContacts.list.mockReturnValue(
    asyncIter([
      {
        name: "default",
        id: "/sub/contact",
        email: "soc@example.com",
        alertNotifications: "On",
      },
    ]),
  );
}

describe("auditAzureDefender", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setHealthyDefaults();
  });

  // ---- pricings: PASS case ----
  it("emits NO pricing finding when the default plan is on the Standard tier", async () => {
    const findings = await auditAzureDefender(makeMockCreds());
    const pricingFinding = findings.find(
      (f) => f.resourceType === "Microsoft.Security/pricings",
    );
    expect(pricingFinding).toBeUndefined();
  });

  // ---- pricings: FAIL case ----
  it("emits a critical finding when the default Defender plan is on the Free tier", async () => {
    mockPricings.list.mockResolvedValue({
      value: [
        {
          name: "default",
          id: "/subscriptions/sub-1/providers/Microsoft.Security/pricings/default",
          pricingTier: "Free",
        },
        {
          name: "StorageAccounts",
          id: "/subscriptions/sub-1/providers/Microsoft.Security/pricings/StorageAccounts",
          pricingTier: "Free",
        },
      ],
    });

    const findings = await auditAzureDefender(makeMockCreds());

    const defaultFinding = findings.find(
      (f) =>
        f.resourceType === "Microsoft.Security/pricings" &&
        f.resourceId ===
          "/subscriptions/sub-1/providers/Microsoft.Security/pricings/default",
    );
    expect(defaultFinding).toBeDefined();
    expect(defaultFinding!.severity).toBe("critical");
    expect(defaultFinding!.resourceRegion).toBe("global");
    expect(defaultFinding!.controlMappings!.length).toBeGreaterThan(0);

    // The individual StorageAccounts plan being Free is a (lesser) high finding.
    const storageFinding = findings.find((f) =>
      f.resourceId.endsWith("/pricings/StorageAccounts"),
    );
    expect(storageFinding).toBeDefined();
    expect(storageFinding!.severity).toBe("high");
  });

  // ---- security contacts: PASS case ----
  it("emits NO contact finding when a contact has an email and alerts enabled", async () => {
    const findings = await auditAzureDefender(makeMockCreds());
    const contactFinding = findings.find(
      (f) => f.resourceType === "Microsoft.Security/securityContacts",
    );
    expect(contactFinding).toBeUndefined();
  });

  // ---- security contacts: FAIL case (no contacts at all) ----
  it("emits a high finding when no security contact is configured", async () => {
    mockSecurityContacts.list.mockReturnValue(asyncIter([]));

    const findings = await auditAzureDefender(makeMockCreds());

    const contactFinding = findings.find(
      (f) =>
        f.resourceType === "Microsoft.Security/securityContacts" &&
        f.title.includes("No Defender for Cloud security contact"),
    );
    expect(contactFinding).toBeDefined();
    expect(contactFinding!.severity).toBe("high");
    expect(contactFinding!.resourceId).toContain("/securityContacts");
  });

  // ---- security contacts: FAIL case (contact missing email + alerts off) ----
  it("flags a contact with no email (high) and alerts off (medium)", async () => {
    mockSecurityContacts.list.mockReturnValue(
      asyncIter([
        {
          name: "default",
          id: "/subscriptions/sub-1/providers/Microsoft.Security/securityContacts/default",
          email: "",
          alertNotifications: "Off",
        },
      ]),
    );

    const findings = await auditAzureDefender(makeMockCreds());

    const noEmail = findings.find((f) => f.title.includes("no email address"));
    expect(noEmail).toBeDefined();
    expect(noEmail!.severity).toBe("high");

    const alertsOff = findings.find((f) =>
      f.title.includes("not set to receive alert notifications"),
    );
    expect(alertsOff).toBeDefined();
    expect(alertsOff!.severity).toBe("medium");
  });

  // ---- auto-provisioning: FAIL case ----
  it("emits a medium finding when auto-provisioning is Off", async () => {
    mockAutoProvisioning.list.mockReturnValue(
      asyncIter([
        {
          name: "default",
          id: "/subscriptions/sub-1/providers/Microsoft.Security/autoProvisioningSettings/default",
          autoProvision: "Off",
        },
      ]),
    );

    const findings = await auditAzureDefender(makeMockCreds());

    const apFinding = findings.find(
      (f) => f.resourceType === "Microsoft.Security/autoProvisioningSettings",
    );
    expect(apFinding).toBeDefined();
    expect(apFinding!.severity).toBe("medium");
    expect(apFinding!.resourceRegion).toBe("global");
  });
});

describe("AzureDefenderAuditorAgent.testConnection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setHealthyDefaults();
  });

  it("returns true for valid JSON service-principal creds (real pricings.list call)", async () => {
    const agent = new AzureDefenderAuditorAgent();
    const validCreds = JSON.stringify({
      tenantId: "t-1",
      clientId: "c-1",
      clientSecret: "s-1",
      subscriptionId: "sub-1",
    });

    const result = await agent.testConnection(validCreds);
    expect(result).toBe(true);
    expect(mockPricings.list).toHaveBeenCalled();
  });

  it("returns false for a bogus non-JSON credential ref (not a string check)", async () => {
    const agent = new AzureDefenderAuditorAgent();
    const result = await agent.testConnection("azure-fake");
    expect(result).toBe(false);
  });
});
