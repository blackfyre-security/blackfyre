// REAL IMPL (BLACKFYRE 2026-06): mocked-SDK unit test for the real GCP Cloud
// SQL auditor. There is no dedicated Cloud SQL client, so the "SDK" here is
// google-auth-library + the Cloud SQL Admin REST API. We vi.mock
// google-auth-library so GoogleAuth.getClient() yields an auth client whose
// `request` returns a canned Cloud SQL Admin instances.list payload, and assert
// findings are derived from the actual returned instance properties — a
// fail-case (insecure instance => SSL / authorized-network / public-IP / backup
// findings) and a pass-case (fully hardened instance => no findings) for the
// requireSsl + authorizedNetworks(0.0.0.0/0) + publicIp + backupConfiguration
// checks. Also covers REST pagination (nextPageToken) and the agent path.

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { GcpCredentials } from "../../src/agents/gcp/credentials.js";

// ---- Mock: google-auth-library (the auth client whose .request hits REST) ----
// `mockRequest` is what each test configures with the canned instances.list
// response(s). resolveGcpCredentials constructs a real GoogleAuth, but the
// mocked constructor returns an object exposing getClient() -> { request }.
const mockRequest = vi.fn();
vi.mock("google-auth-library", () => ({
  GoogleAuth: vi.fn().mockImplementation(() => ({
    getClient: vi.fn().mockResolvedValue({ request: mockRequest }),
  })),
}));

// ---- Mock: compliance-mapper (return a non-empty mapping like sql-auditor) ----
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

// ---- Import after mocks ----
import {
  auditGcpCloudSql,
  GcpCloudSqlAuditorAgent,
} from "../../src/agents/gcp/cloud-sql-auditor.js";

const PROJECT_ID = "proj-1";

// A credentialRef shaped like a downloaded service-account key, so the real
// resolveGcpCredentials accepts it and builds the (mocked) GoogleAuth.
const SA_CREDENTIAL_REF = JSON.stringify({
  type: "service_account",
  project_id: PROJECT_ID,
  client_email: "sa@proj-1.iam.gserviceaccount.com",
  private_key: "fake-key",
});

function makeMockCreds(): GcpCredentials {
  return {
    auth: {
      getClient: vi.fn().mockResolvedValue({ request: mockRequest }),
    } as any,
    projectId: PROJECT_ID,
  };
}

const INSECURE_INSTANCE = {
  name: "db-insecure",
  region: "us-central1",
  selfLink: `https://sqladmin.googleapis.com/sql/v1beta4/projects/${PROJECT_ID}/instances/db-insecure`,
  connectionName: `${PROJECT_ID}:us-central1:db-insecure`,
  settings: {
    ipConfiguration: {
      requireSsl: false,
      sslMode: "ALLOW_UNENCRYPTED_AND_ENCRYPTED",
      ipv4Enabled: true,
      authorizedNetworks: [{ name: "open-to-world", value: "0.0.0.0/0" }],
    },
    backupConfiguration: { enabled: false },
  },
  ipAddresses: [{ type: "PRIMARY", ipAddress: "34.10.0.1" }],
};

const SECURE_INSTANCE = {
  name: "db-secure",
  region: "europe-west1",
  selfLink: `https://sqladmin.googleapis.com/sql/v1beta4/projects/${PROJECT_ID}/instances/db-secure`,
  connectionName: `${PROJECT_ID}:europe-west1:db-secure`,
  settings: {
    ipConfiguration: {
      sslMode: "ENCRYPTED_ONLY",
      ipv4Enabled: false,
      authorizedNetworks: [{ name: "office", value: "203.0.113.10/32" }],
    },
    backupConfiguration: { enabled: true },
  },
  // Private-IP only: no PRIMARY public address.
  ipAddresses: [{ type: "PRIVATE", ipAddress: "10.1.2.3" }],
};

describe("auditGcpCloudSql", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fail-case: insecure instance produces SSL, authorized-network, public-IP and backup findings", async () => {
    const creds = makeMockCreds();
    mockRequest.mockResolvedValue({ data: { items: [INSECURE_INSTANCE] } });

    const findings = await auditGcpCloudSql(creds);

    const ssl = findings.find((f) => f.title.includes("does not require SSL"));
    const network = findings.find((f) =>
      f.title.includes("authorizes the entire internet"),
    );
    const publicIp = findings.find((f) =>
      f.title.includes("accessible via a public IP"),
    );
    const backups = findings.find((f) =>
      f.title.includes("does not have automated backups"),
    );

    expect(ssl).toBeDefined();
    expect(ssl!.severity).toBe("high");
    expect(ssl!.category).toBe("encryption");
    expect(ssl!.resourceId).toBe(INSECURE_INSTANCE.selfLink);
    expect(ssl!.resourceRegion).toBe("us-central1");

    expect(network).toBeDefined();
    expect(network!.severity).toBe("critical");
    expect(network!.category).toBe("network");
    expect(network!.resourceId).toBe(INSECURE_INSTANCE.selfLink);
    expect(network!.controlMappings!.length).toBeGreaterThan(0);

    expect(publicIp).toBeDefined();
    expect(publicIp!.category).toBe("network");

    expect(backups).toBeDefined();
    expect(backups!.severity).toBe("high");
    expect(backups!.category).toBe("config");

    // The instances.list endpoint was addressed with the real project id.
    expect(mockRequest).toHaveBeenCalledTimes(1);
    expect(mockRequest.mock.calls[0][0].url).toContain(
      `/projects/${PROJECT_ID}/instances`,
    );
  });

  it("pass-case: fully hardened instance produces no findings", async () => {
    const creds = makeMockCreds();
    mockRequest.mockResolvedValue({ data: { items: [SECURE_INSTANCE] } });

    const findings = await auditGcpCloudSql(creds);

    expect(findings).toHaveLength(0);
  });

  it("pages over nextPageToken and audits instances from every page", async () => {
    const creds = makeMockCreds();
    mockRequest
      .mockResolvedValueOnce({
        data: { items: [SECURE_INSTANCE], nextPageToken: "tok-2" },
      })
      .mockResolvedValueOnce({ data: { items: [INSECURE_INSTANCE] } });

    const findings = await auditGcpCloudSql(creds);

    // Page 1 (secure) => 0 findings; page 2 (insecure) => 4 findings.
    expect(findings).toHaveLength(4);
    expect(mockRequest).toHaveBeenCalledTimes(2);
    expect(mockRequest.mock.calls[1][0].params).toEqual({ pageToken: "tok-2" });
  });
});

describe("GcpCloudSqlAuditorAgent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("emits real findings through ctx.onFinding for an insecure instance", async () => {
    const agent = new GcpCloudSqlAuditorAgent();
    mockRequest.mockResolvedValue({ data: { items: [INSECURE_INSTANCE] } });

    const emitted: { title: string; source?: string }[] = [];
    const result = await agent.run({
      scanId: "scan-1",
      tenantId: "tenant-1",
      integrationId: "int-1",
      credentialRef: SA_CREDENTIAL_REF,
      frameworks: ["soc2"],
      onProgress: () => {},
      onFinding: async (f) => {
        emitted.push({ title: f.title, source: f.source });
      },
    });

    expect(result.error).toBeNull();
    // SSL + authorized-network + public-IP + backups = 4 findings.
    expect(result.findingsCount).toBe(4);
    expect(emitted).toHaveLength(4);
    expect(emitted.every((f) => f.source === "gcp-cloud-sql-auditor")).toBe(
      true,
    );
  });

  it("testConnection returns true when the Cloud SQL Admin list call succeeds", async () => {
    const agent = new GcpCloudSqlAuditorAgent();
    mockRequest.mockResolvedValue({ data: { items: [] } });

    const result = await agent.testConnection(SA_CREDENTIAL_REF);
    expect(result).toBe(true);
  });

  it("testConnection returns false for a bogus (non-JSON) credentialRef", async () => {
    const agent = new GcpCloudSqlAuditorAgent();
    const result = await agent.testConnection("gcp-fake");
    expect(result).toBe(false);
  });
});
