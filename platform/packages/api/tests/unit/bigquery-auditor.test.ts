// REAL IMPL (BLACKFYRE 2026-06): mocked-SDK unit test for the real GCP BigQuery
// auditor. Mocks @google-cloud/bigquery so getDatasets()/getMetadata()/getTables()
// return crafted IDataset/ITable objects, then asserts the auditor derives findings
// purely from those real properties (default CMEK, public access[] bindings,
// table-expiration). 1 pass-case + 1 fail-case across a couple of checks.
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { GcpCredentials } from "../../src/agents/gcp/credentials.js";

// ---- Shared mock for the BigQuery client's getDatasets() ----
const mockGetDatasets = vi.fn();

vi.mock("@google-cloud/bigquery", () => ({
  BigQuery: vi.fn().mockImplementation(() => ({
    getDatasets: mockGetDatasets,
  })),
}));

// ---- Mock compliance-mapper so controlMappings are non-empty for any check ----
vi.mock("../../src/services/compliance-mapper.js", () => ({
  mapCheckToControls: vi.fn().mockImplementation(() => [
    {
      framework: "soc2",
      controlId: "CC6.1",
      controlName: "Test Control",
      status: "fail",
      weight: 3,
    },
  ]),
}));

// ---- Import after mocks ----
import { auditGcpBigQuery } from "../../src/agents/gcp/bigquery-auditor.js";

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

// Builds a mock Dataset object whose getMetadata/getTables resolve to the given
// metadata/tables, mirroring the @google-cloud/bigquery [resource] tuple shape.
function makeDataset(
  id: string,
  metadata: Record<string, any>,
  tables: Array<Record<string, any>> = [],
) {
  return {
    id,
    getMetadata: vi.fn().mockResolvedValue([metadata]),
    getTables: vi.fn().mockResolvedValue([tables]),
  };
}

function makeTable(id: string, metadata: Record<string, any>) {
  return {
    id,
    getMetadata: vi.fn().mockResolvedValue([metadata]),
  };
}

describe("auditGcpBigQuery (real BigQuery auditor)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("PASS-case: a fully compliant dataset produces no findings", async () => {
    // Dataset with default CMEK, no public access, and a default table expiration.
    const dataset = makeDataset("analytics", {
      location: "US",
      defaultEncryptionConfiguration: {
        kmsKeyName:
          "projects/proj-1/locations/us/keyRings/r/cryptoKeys/k",
      },
      defaultTableExpirationMs: "3600000",
      access: [
        { role: "OWNER", userByEmail: "owner@example.com" },
        { role: "READER", specialGroup: "projectReaders" },
      ],
    });
    mockGetDatasets.mockResolvedValue([[dataset]]);

    const findings = await auditGcpBigQuery(makeMockCreds());

    expect(findings).toHaveLength(0);
    // With a default table expiration set, the auditor must not even enumerate tables.
    expect(dataset.getTables).not.toHaveBeenCalled();
  });

  it("FAIL-case: no CMEK + public access + non-expiring table produce findings", async () => {
    const table = makeTable("events", {
      // No expirationTime -> indefinite retention.
      schema: { fields: [] },
    });
    const dataset = makeDataset(
      "public_ds",
      {
        location: "EU",
        // No defaultEncryptionConfiguration -> no CMEK.
        // No defaultTableExpirationMs -> tables checked for per-table expiration.
        access: [
          { role: "OWNER", userByEmail: "owner@example.com" },
          { role: "READER", specialGroup: "allAuthenticatedUsers" },
        ],
      },
      [table],
    );
    mockGetDatasets.mockResolvedValue([[dataset]]);

    const findings = await auditGcpBigQuery(makeMockCreds());

    // Expect a CMEK finding, a public-access finding, and a table-expiration finding.
    const cmek = findings.find((f) => f.category === "encryption");
    expect(cmek).toBeDefined();
    expect(cmek?.severity).toBe("high");
    expect(cmek?.resourceId).toBe("proj-1:public_ds");
    expect(cmek?.resourceRegion).toBe("EU");
    expect(cmek?.controlMappings?.length).toBeGreaterThan(0);

    const publicAccess = findings.find((f) => f.category === "iam");
    expect(publicAccess).toBeDefined();
    expect(publicAccess?.severity).toBe("critical");
    expect(publicAccess?.resourceType).toBe(
      "bigquery.googleapis.com/Dataset",
    );
    expect(publicAccess?.description).toContain("allAuthenticatedUsers");

    const tableExpiry = findings.find((f) => f.category === "config");
    expect(tableExpiry).toBeDefined();
    expect(tableExpiry?.severity).toBe("medium");
    expect(tableExpiry?.resourceId).toBe("proj-1:public_ds.events");
    expect(tableExpiry?.resourceType).toBe("bigquery.googleapis.com/Table");
    expect(tableExpiry?.controlMappings?.length).toBeGreaterThan(0);
  });

  it("detects allUsers via the iamMember binding form", async () => {
    const dataset = makeDataset("ds_iammember", {
      location: "US",
      defaultEncryptionConfiguration: { kmsKeyName: "k" },
      defaultTableExpirationMs: "3600000",
      access: [{ role: "READER", iamMember: "allUsers" }],
    });
    mockGetDatasets.mockResolvedValue([[dataset]]);

    const findings = await auditGcpBigQuery(makeMockCreds());

    const publicAccess = findings.filter((f) => f.category === "iam");
    expect(publicAccess).toHaveLength(1);
    expect(publicAccess[0].description).toContain("allUsers");
  });
});
