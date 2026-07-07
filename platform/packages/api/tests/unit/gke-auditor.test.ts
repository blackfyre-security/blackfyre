// REAL IMPL (BLACKFYRE 2026-06): Mocked-SDK unit test for the real GCP GKE
// auditor. vi.mock replaces @google-cloud/container so checks run against
// fabricated ICluster objects with real-shaped properties (legacyAbac,
// masterAuthorizedNetworksConfig, networkPolicy, privateClusterConfig,
// shieldedNodes). Covers pass + fail cases per check plus the SDK-backed
// testConnection (not a string check). google-auth-library is mocked so
// resolveGcpCredentials produces an auth whose getClient() resolves.
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { GcpCredentials } from "../../src/agents/gcp/credentials.js";

// ---- Mock: @google-cloud/container ----
const mockListClusters = vi.fn();
vi.mock("@google-cloud/container", () => ({
  ClusterManagerClient: vi.fn().mockImplementation(() => ({
    listClusters: mockListClusters,
  })),
}));

// ---- Mock: compliance-mapper (GKE check ids gracefully map; assert non-empty) ----
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

// ---- Mock: google-auth-library so resolveGcpCredentials.auth.getClient() works ----
vi.mock("google-auth-library", () => ({
  GoogleAuth: vi.fn().mockImplementation(() => ({
    getClient: vi.fn().mockResolvedValue({ request: vi.fn() }),
  })),
}));

// ---- Import after mocks ----
import {
  auditGcpGke,
  GcpGkeAuditorAgent,
} from "../../src/agents/gcp/gke-auditor.js";

const PROJECT_ID = "proj-1";

function makeMockCreds(): GcpCredentials {
  return {
    auth: {
      getClient: vi.fn().mockResolvedValue({ request: vi.fn() }),
    } as unknown as GcpCredentials["auth"],
    projectId: PROJECT_ID,
  };
}

// Wrap a clusters array in the listClusters tuple response shape.
function listResponse(clusters: unknown[]) {
  return [{ clusters }];
}

const BASE_CLUSTER = {
  name: "gke-1",
  location: "us-central1",
  selfLink:
    "https://container.googleapis.com/v1/projects/proj-1/locations/us-central1/clusters/gke-1",
};

// A cluster hardened against every check.
const HARDENED = {
  ...BASE_CLUSTER,
  legacyAbac: { enabled: false },
  masterAuthorizedNetworksConfig: { enabled: true },
  networkPolicy: { enabled: true },
  privateClusterConfig: { enablePrivateNodes: true },
  shieldedNodes: { enabled: true },
};

describe("GCP GKE auditor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("PASS: emits no findings for a fully hardened cluster", async () => {
    const creds = makeMockCreds();
    mockListClusters.mockResolvedValue(listResponse([HARDENED]));

    const findings = await auditGcpGke(creds);

    expect(findings).toHaveLength(0);
  });

  it("FAIL: flags Legacy ABAC enabled with real resourceId/region", async () => {
    const creds = makeMockCreds();
    mockListClusters.mockResolvedValue(
      listResponse([
        {
          ...HARDENED,
          legacyAbac: { enabled: true }, // only this check should fire
        },
      ]),
    );

    const findings = await auditGcpGke(creds);

    expect(findings).toHaveLength(1);
    const abac = findings[0];
    expect(abac.title).toContain("Legacy Authorization");
    expect(abac.severity).toBe("high");
    expect(abac.category).toBe("iam");
    expect(abac.resourceType).toBe("container.googleapis.com/Cluster");
    expect(abac.resourceId).toBe(BASE_CLUSTER.selfLink);
    expect(abac.resourceRegion).toBe("us-central1");
    expect(abac.source).toBe("gcp-gke-auditor");
    expect(abac.controlMappings && abac.controlMappings.length).toBeGreaterThan(
      0,
    );
  });

  it("FAIL: flags missing master authorized networks and disabled network policy", async () => {
    const creds = makeMockCreds();
    mockListClusters.mockResolvedValue(
      listResponse([
        {
          ...HARDENED,
          masterAuthorizedNetworksConfig: { enabled: false },
          networkPolicy: { enabled: false },
        },
      ]),
    );

    const findings = await auditGcpGke(creds);

    const man = findings.find((f) =>
      f.title.includes("Master Authorized Networks"),
    );
    const netpol = findings.find((f) => f.title.includes("Network Policy"));

    expect(man).toBeDefined();
    expect(man!.severity).toBe("high");
    expect(man!.category).toBe("network");

    expect(netpol).toBeDefined();
    expect(netpol!.severity).toBe("high");
    expect(netpol!.category).toBe("network");

    // Legacy ABAC was disabled -> no ABAC finding.
    expect(findings.some((f) => f.title.includes("Legacy Authorization"))).toBe(
      false,
    );
  });

  it("FAIL: flags non-private cluster and disabled shielded nodes", async () => {
    const creds = makeMockCreds();
    mockListClusters.mockResolvedValue(
      listResponse([
        {
          ...HARDENED,
          // enablePrivateNodes unset -> private cluster finding
          privateClusterConfig: {},
          // shieldedNodes omitted entirely -> shielded nodes finding
          shieldedNodes: undefined,
        },
      ]),
    );

    const findings = await auditGcpGke(creds);

    const priv = findings.find((f) => f.title.includes("not a private cluster"));
    const shielded = findings.find((f) =>
      f.title.includes("Shielded GKE Nodes"),
    );

    expect(priv).toBeDefined();
    expect(priv!.severity).toBe("high");
    expect(priv!.category).toBe("network");

    expect(shielded).toBeDefined();
    expect(shielded!.severity).toBe("medium");
    expect(shielded!.category).toBe("config");
  });

  it("enumerates clusters across all locations (single listClusters call) and keys findings on real resources", async () => {
    const creds = makeMockCreds();
    mockListClusters.mockResolvedValue(
      listResponse([
        {
          ...HARDENED,
          name: "gke-zonal",
          location: undefined,
          zone: "us-central1-a",
          selfLink: undefined,
          legacyAbac: { enabled: true },
        },
        {
          ...HARDENED,
          name: "gke-regional",
          location: "europe-west1",
          selfLink:
            "https://container.googleapis.com/v1/projects/proj-1/locations/europe-west1/clusters/gke-regional",
          networkPolicy: { enabled: false },
        },
      ]),
    );

    const findings = await auditGcpGke(creds);

    // Wildcard location parent enumerates all clusters in one RPC.
    expect(mockListClusters).toHaveBeenCalledTimes(1);
    expect(mockListClusters).toHaveBeenCalledWith({
      parent: `projects/${PROJECT_ID}/locations/-`,
    });

    // Zonal cluster: selfLink absent -> resourceId falls back to qualified path,
    // region from `zone`.
    const zonal = findings.find((f) => f.title.includes("gke-zonal"));
    expect(zonal).toBeDefined();
    expect(zonal!.resourceRegion).toBe("us-central1-a");
    expect(zonal!.resourceId).toBe(
      `projects/${PROJECT_ID}/locations/us-central1-a/clusters/gke-zonal`,
    );

    const regional = findings.find((f) => f.title.includes("gke-regional"));
    expect(regional).toBeDefined();
    expect(regional!.resourceRegion).toBe("europe-west1");
  });

  it("testConnection validates real GCP API access, not a string check", async () => {
    const agent = new GcpGkeAuditorAgent();
    const validCreds = JSON.stringify({
      type: "service_account",
      project_id: PROJECT_ID,
      client_email: "sa@proj-1.iam.gserviceaccount.com",
      private_key: "-----BEGIN PRIVATE KEY-----\nfake\n-----END PRIVATE KEY-----\n",
    });

    // A reachable API resolves without throwing.
    mockListClusters.mockResolvedValue(listResponse([]));
    expect(await agent.testConnection(validCreds)).toBe(true);

    // A non-JSON ref cannot resolve credentials -> false (not a substring match).
    expect(await agent.testConnection("gcp-fake")).toBe(false);

    // An API/authorization failure -> false.
    mockListClusters.mockRejectedValueOnce(new Error("PERMISSION_DENIED"));
    expect(await agent.testConnection(validCreds)).toBe(false);
  });
});
