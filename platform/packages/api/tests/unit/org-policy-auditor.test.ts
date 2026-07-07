// REAL IMPL (BLACKFYRE 2026-06): focused mocked-SDK unit test for the GCP
// org-policy auditor. Mocks @google-cloud/resource-manager (ProjectsClient) and
// drives the Org Policy API v2 reads through a mocked auth.getClient().request.
// Covers a pass-case (constraint enforced -> no finding) and a fail-case
// (constraint not enforced -> finding) for a couple of checks.
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { GcpCredentials } from "../../src/agents/gcp/credentials.js";

// ---------------------------------------------------------------------------
// Mock @google-cloud/resource-manager — the auditor resolves the project
// resource via ProjectsClient.getProject before reading policies.
// ---------------------------------------------------------------------------
const mockGetProject = vi.fn();
vi.mock("@google-cloud/resource-manager", () => ({
  ProjectsClient: vi.fn().mockImplementation(() => ({
    getProject: mockGetProject,
  })),
}));

import { auditGcpOrgPolicy } from "../../src/agents/gcp/org-policy-auditor.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ENFORCED_BOOLEAN = { spec: { rules: [{ enforce: true }] } };
const NOT_ENFORCED_BOOLEAN = { spec: { rules: [{ enforce: false }] } };
const DENY_ALL_LIST = { spec: { rules: [{ denyAll: true }] } };
const ALLOW_ALL_LIST = { spec: { rules: [{ allowAll: true }] } };

/**
 * Builds GcpCredentials whose auth.getClient() returns a request() that maps a
 * constraint id (taken from the request URL) to a canned Org Policy v2 payload.
 */
function makeCreds(
  policiesByConstraintLeaf: Record<string, unknown>,
): GcpCredentials {
  const request = vi.fn(async ({ url }: { url: string }) => {
    // URL shape: .../policies/<constraintLeaf>:getEffectivePolicy
    const match = url.match(/\/policies\/([^:]+):getEffectivePolicy/);
    const leaf = match?.[1] ?? "";
    const data = policiesByConstraintLeaf[leaf];
    if (data === "throw") throw new Error("permission denied");
    return { data: data ?? null };
  });

  return {
    auth: {
      getClient: vi.fn().mockResolvedValue({ request }),
    } as any,
    projectId: "proj-1",
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("auditGcpOrgPolicy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetProject.mockResolvedValue([{ name: "projects/proj-1" }]);
  });

  it("FAIL case: raises findings when key constraints are not enforced", async () => {
    const creds = makeCreds({
      // SA key creation NOT disabled -> finding
      "iam.disableServiceAccountKeyCreation": NOT_ENFORCED_BOOLEAN,
      // VM external IP wide open -> finding
      "compute.vmExternalIpAccess": ALLOW_ALL_LIST,
      // uniform bucket access not enforced (unset) -> finding
      "storage.uniformBucketLevelAccess": null,
      // Cloud SQL public IP not restricted (unset) -> finding
      "sql.restrictPublicIp": null,
    });

    const findings = await auditGcpOrgPolicy(creds);

    // All four constraint checks should fire.
    expect(findings.length).toBe(4);

    const saFinding = findings.find((f) =>
      f.title.includes("service account key creation"),
    );
    expect(saFinding).toBeDefined();
    expect(saFinding!.category).toBe("iam");
    expect(saFinding!.resourceType).toBe("orgpolicy.googleapis.com/Policy");
    expect(saFinding!.resourceId).toBe(
      "projects/proj-1/policies/iam.disableServiceAccountKeyCreation",
    );
    expect(saFinding!.resourceRegion).toBe("global");
    // Reuses an existing compliance-mapper key -> real control mappings present.
    expect(saFinding!.controlMappings!.length).toBeGreaterThan(0);

    const sqlFinding = findings.find((f) =>
      f.title.includes("public IP on Cloud SQL"),
    );
    expect(sqlFinding).toBeDefined();
    expect(sqlFinding!.severity).toBe("high");
  });

  it("PASS case: no findings when key constraints are enforced/restricted", async () => {
    const creds = makeCreds({
      "iam.disableServiceAccountKeyCreation": ENFORCED_BOOLEAN,
      "compute.vmExternalIpAccess": DENY_ALL_LIST,
      "storage.uniformBucketLevelAccess": ENFORCED_BOOLEAN,
      "sql.restrictPublicIp": ENFORCED_BOOLEAN,
    });

    const findings = await auditGcpOrgPolicy(creds);
    expect(findings.length).toBe(0);
  });

  it("skips constraints whose policy read fails (best effort), still flags the rest", async () => {
    const creds = makeCreds({
      // unreadable -> skipped, no finding
      "iam.disableServiceAccountKeyCreation": "throw",
      // enforced -> compliant
      "compute.vmExternalIpAccess": DENY_ALL_LIST,
      "storage.uniformBucketLevelAccess": ENFORCED_BOOLEAN,
      // not restricted -> finding
      "sql.restrictPublicIp": ALLOW_ALL_LIST,
    });

    const findings = await auditGcpOrgPolicy(creds);
    expect(findings.length).toBe(1);
    expect(findings[0].title).toContain("public IP on Cloud SQL");
  });
});
