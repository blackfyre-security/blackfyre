import { describe, it, expect, vi, beforeEach } from "vitest";
import type { GcpCredentials } from "../../src/agents/gcp/credentials.js";

// ---------------------------------------------------------------------------
// Mock GCP client libraries
// ---------------------------------------------------------------------------

// Mock google-auth-library
vi.mock("google-auth-library", () => ({
  GoogleAuth: vi.fn().mockImplementation(() => ({
    getClient: vi.fn().mockResolvedValue({
      request: vi.fn().mockResolvedValue({ data: {} }),
    }),
  })),
}));

// Mock @google-cloud/resource-manager
const mockGetIamPolicy = vi.fn();
const mockGetProject = vi.fn();
vi.mock("@google-cloud/resource-manager", () => ({
  ProjectsClient: vi.fn().mockImplementation(() => ({
    getIamPolicy: mockGetIamPolicy,
    getProject: mockGetProject,
  })),
}));

// Mock @google-cloud/storage
const mockGetBuckets = vi.fn();
vi.mock("@google-cloud/storage", () => ({
  Storage: vi.fn().mockImplementation(() => ({
    getBuckets: mockGetBuckets,
  })),
}));

// Mock @google-cloud/compute
const mockFirewallListAsync = vi.fn();
const mockInstancesAggregatedListAsync = vi.fn();
const mockDisksAggregatedListAsync = vi.fn();
const mockSubnetworksAggregatedListAsync = vi.fn();
vi.mock("@google-cloud/compute", () => ({
  FirewallsClient: vi.fn().mockImplementation(() => ({
    listAsync: mockFirewallListAsync,
  })),
  InstancesClient: vi.fn().mockImplementation(() => ({
    aggregatedListAsync: mockInstancesAggregatedListAsync,
  })),
  DisksClient: vi.fn().mockImplementation(() => ({
    aggregatedListAsync: mockDisksAggregatedListAsync,
  })),
  SubnetworksClient: vi.fn().mockImplementation(() => ({
    aggregatedListAsync: mockSubnetworksAggregatedListAsync,
  })),
}));

// Mock @google-cloud/kms
const mockListKeyRings = vi.fn();
const mockListCryptoKeys = vi.fn();
const mockKmsGetIamPolicy = vi.fn();
const mockListCryptoKeyVersions = vi.fn();
vi.mock("@google-cloud/kms", () => ({
  KeyManagementServiceClient: vi.fn().mockImplementation(() => ({
    listKeyRings: mockListKeyRings,
    listCryptoKeys: mockListCryptoKeys,
    getIamPolicy: mockKmsGetIamPolicy,
    listCryptoKeyVersions: mockListCryptoKeyVersions,
  })),
}));

// ---------------------------------------------------------------------------
// Import sub-auditors and agent after mocks are set up
// ---------------------------------------------------------------------------

import { auditGcpIAM } from "../../src/agents/gcp/iam-auditor.js";
import { auditGcpStorage } from "../../src/agents/gcp/storage-auditor.js";
import { auditGcpCompute } from "../../src/agents/gcp/compute-auditor.js";
import { auditGcpNetwork } from "../../src/agents/gcp/network-auditor.js";
import { auditGcpKMS } from "../../src/agents/gcp/kms-auditor.js";
import { CloudAuditorGcpAgent } from "../../src/agents/cloud-auditor-gcp.js";

// ---------------------------------------------------------------------------
// Helper: create mock GcpCredentials
// ---------------------------------------------------------------------------

function makeMockCreds(): GcpCredentials {
  return {
    auth: {
      getClient: vi.fn().mockResolvedValue({
        request: vi.fn().mockResolvedValue({ data: {} }),
      }),
    } as any,
    projectId: "proj-1",
  };
}

// ---------------------------------------------------------------------------
// Async generator helpers for mock iterables
// ---------------------------------------------------------------------------

async function* asyncGen<T>(items: T[]): AsyncGenerator<T> {
  for (const item of items) {
    yield item;
  }
}

async function* asyncEntryGen<K, V>(
  entries: Array<[K, V]>,
): AsyncGenerator<[K, V]> {
  for (const entry of entries) {
    yield entry;
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("CloudAuditorGcpAgent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("produces IAM findings from auditGcpIAM", async () => {
    // Mock project IAM policy with allUsers binding
    mockGetIamPolicy.mockResolvedValue([
      {
        bindings: [
          {
            role: "roles/viewer",
            members: ["allUsers"],
          },
        ],
      },
    ]);

    const creds = makeMockCreds();
    const findings = await auditGcpIAM(creds);

    expect(findings.length).toBeGreaterThanOrEqual(1);
    expect(findings[0].category).toBe("iam");
    expect(findings[0].severity).toBe("critical");
    expect(findings[0].controlMappings.length).toBeGreaterThan(0);
  });

  it("produces storage findings from auditGcpStorage", async () => {
    // Mock bucket with no uniform access, no versioning, no CMEK
    const mockBucket = {
      name: "test-bucket",
      getMetadata: vi.fn().mockResolvedValue([
        {
          iamConfiguration: { uniformBucketLevelAccess: { enabled: false } },
          versioning: { enabled: false },
          encryption: {},
        },
      ]),
      iam: {
        getPolicy: vi.fn().mockResolvedValue([{ bindings: [] }]),
      },
    };
    mockGetBuckets.mockResolvedValue([[mockBucket]]);

    const creds = makeMockCreds();
    const findings = await auditGcpStorage(creds);

    expect(findings.length).toBeGreaterThanOrEqual(1);
    // Should have findings for uniform access, versioning, and CMEK
    const categories = findings.map((f) => f.category);
    expect(categories).toContain("config");
    expect(findings.every((f) => f.controlMappings.length > 0)).toBe(true);
  });

  it("produces compute findings from auditGcpCompute", async () => {
    // Mock firewall rule allowing SSH from 0.0.0.0/0
    mockFirewallListAsync.mockReturnValue(
      asyncGen([
        {
          name: "allow-ssh-all",
          direction: "INGRESS",
          sourceRanges: ["0.0.0.0/0"],
          allowed: [{ IPProtocol: "tcp", ports: ["22"] }],
        },
      ]),
    );

    // Mock empty instances and disks
    mockInstancesAggregatedListAsync.mockReturnValue(asyncEntryGen([]));
    mockDisksAggregatedListAsync.mockReturnValue(asyncEntryGen([]));

    const creds = makeMockCreds();
    const findings = await auditGcpCompute(creds);

    expect(findings.length).toBeGreaterThanOrEqual(1);
    expect(findings[0].category).toBe("network");
    expect(findings[0].severity).toBe("critical");
    expect(findings[0].controlMappings.length).toBeGreaterThan(0);
  });

  it("produces network findings from auditGcpNetwork", async () => {
    // Mock subnet without flow logs
    mockSubnetworksAggregatedListAsync.mockReturnValue(
      asyncEntryGen([
        [
          "regions/us-central1",
          {
            subnetworks: [
              {
                name: "default-subnet",
                network: "default",
                logConfig: { enable: false },
              },
            ],
          },
        ],
      ]),
    );

    // Mock project IAM policy with no audit configs
    mockGetIamPolicy.mockResolvedValue([
      {
        bindings: [],
        // No auditConfigs
      },
    ]);

    // Mock empty firewall list for all-ingress check
    mockFirewallListAsync.mockReturnValue(asyncGen([]));

    const creds = makeMockCreds();
    const findings = await auditGcpNetwork(creds);

    expect(findings.length).toBeGreaterThanOrEqual(1);
    const categories = findings.map((f) => f.category);
    expect(categories).toContain("logging");
    expect(findings.every((f) => f.controlMappings.length > 0)).toBe(true);
  });

  it("produces kms findings from auditGcpKMS", async () => {
    // Mock key ring with a key that has no rotation
    mockListKeyRings.mockResolvedValue([
      [
        {
          name: "projects/proj-1/locations/us-central1/keyRings/my-ring",
        },
      ],
    ]);

    mockListCryptoKeys.mockResolvedValue([
      [
        {
          name: "projects/proj-1/locations/us-central1/keyRings/my-ring/cryptoKeys/my-key",
          rotationPeriod: null,
        },
      ],
    ]);

    mockKmsGetIamPolicy.mockResolvedValue([{ bindings: [] }]);
    mockListCryptoKeyVersions.mockResolvedValue([[]]);

    const creds = makeMockCreds();
    const findings = await auditGcpKMS(creds);

    expect(findings.length).toBeGreaterThanOrEqual(1);
    expect(findings[0].category).toBe("encryption");
    expect(findings[0].severity).toBe("high");
    expect(findings[0].controlMappings.length).toBeGreaterThan(0);
  });

  it("testConnection validates real GCP API access not string check", async () => {
    // Mock ProjectsClient.getProject to succeed
    mockGetProject.mockResolvedValue([
      { name: "projects/proj-1" },
    ]);

    const agent = new CloudAuditorGcpAgent();
    const validCreds = JSON.stringify({
      projectId: "proj-1",
      serviceAccountKey: {
        client_email: "sa@proj-1.iam.gserviceaccount.com",
        private_key: "fake-key",
      },
    });

    const result = await agent.testConnection(validCreds);
    expect(result).toBe(true);

    // Verify it does NOT use string comparison (no .includes("gcp"))
    // The old stub returned true for credentialRef.includes("gcp") -- that's gone
    const notGcpString = await agent.testConnection("not-valid-json");
    expect(notGcpString).toBe(false);
  });
});
