// REAL IMPL (BLACKFYRE 2026-06): Mocked-SDK unit test for the real GCP Security
// Command Center auditor. vi.mock replaces @google-cloud/security-center so the
// auditor runs against fabricated SCC ListFindingsResult objects with
// real-shaped properties (finding.state, finding.severity, finding.mute,
// finding.category, finding.canonicalName/name/resourceName, resource.location).
// Covers a pass-case (no active findings) + fail-cases (active findings of
// varying severity), state/mute filtering, real resourceId/region derivation,
// pagination over the async iterables, and the SDK-backed testConnection (not a
// string check). google-auth-library is mocked so resolveGcpCredentials produces
// an auth whose getClient() resolves.
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { GcpCredentials } from "../../src/agents/gcp/credentials.js";

// ---- Mock: @google-cloud/security-center ----
const mockListFindingsAsync = vi.fn();
const mockListSourcesAsync = vi.fn();
const mockListFindings = vi.fn();
vi.mock("@google-cloud/security-center", () => ({
  SecurityCenterClient: vi.fn().mockImplementation(() => ({
    listFindingsAsync: mockListFindingsAsync,
    listSourcesAsync: mockListSourcesAsync,
    listFindings: mockListFindings,
  })),
}));

// ---- Mock: compliance-mapper (SCC check id gracefully maps; assert non-empty) ----
vi.mock("../../src/services/compliance-mapper.js", () => ({
  mapCheckToControls: vi.fn().mockImplementation((_checkType: string) => [
    {
      framework: "soc2",
      controlId: "CC7.1",
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
  auditGcpScc,
  GcpSccAuditorAgent,
} from "../../src/agents/gcp/security-command-center-auditor.js";

const PROJECT_ID = "proj-1";

function makeMockCreds(): GcpCredentials {
  return {
    auth: {
      getClient: vi.fn().mockResolvedValue({ request: vi.fn() }),
    } as unknown as GcpCredentials["auth"],
    projectId: PROJECT_ID,
  };
}

// Turn an array into an async iterable, matching the gax *Async() return type.
function asyncIterable<T>(items: T[]): AsyncIterable<T> {
  return {
    async *[Symbol.asyncIterator]() {
      for (const item of items) yield item;
    },
  };
}

// A ListFindingsResult envelope: { finding, resource }.
function result(finding: unknown, resource?: unknown) {
  return { finding, resource };
}

const SOURCE_PATH = `projects/${PROJECT_ID}/sources/src-123`;

// An active, un-muted, HIGH-severity finding from a real-shaped finding object.
const ACTIVE_HIGH = {
  name: `${SOURCE_PATH}/findings/find-1`,
  canonicalName: `projects/111/sources/src-123/findings/find-1`,
  parent: SOURCE_PATH,
  state: "ACTIVE",
  severity: "HIGH",
  mute: "UNMUTED",
  category: "PUBLIC_BUCKET_ACL",
  resourceName: "//storage.googleapis.com/buckets/secret-bucket",
  description: "Bucket is publicly accessible.",
  externalUri: "https://console.cloud.google.com/security/...",
};

const ACTIVE_RESOURCE = {
  name: "//storage.googleapis.com/buckets/secret-bucket",
  location: "us-central1",
};

describe("GCP Security Command Center auditor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: no sources, no findings unless a test overrides.
    mockListSourcesAsync.mockReturnValue(asyncIterable([]));
    mockListFindingsAsync.mockReturnValue(asyncIterable([]));
  });

  it("PASS: emits no findings when SCC has no active findings", async () => {
    const creds = makeMockCreds();
    // Only INACTIVE / muted findings -> nothing surfaced.
    mockListFindingsAsync.mockReturnValue(
      asyncIterable([
        result({ ...ACTIVE_HIGH, state: "INACTIVE" }),
        result({ ...ACTIVE_HIGH, mute: "MUTED" }),
      ]),
    );

    const findings = await auditGcpScc(creds);

    expect(findings).toHaveLength(0);
    // Findings were enumerated under the project-scoped sources wildcard.
    expect(mockListFindingsAsync).toHaveBeenCalledWith({
      parent: `projects/${PROJECT_ID}/sources/-`,
    });
  });

  it("FAIL: surfaces an active SCC finding with real resourceId/region/severity", async () => {
    const creds = makeMockCreds();
    mockListSourcesAsync.mockReturnValue(
      asyncIterable([
        { name: SOURCE_PATH, displayName: "Security Health Analytics" },
      ]),
    );
    mockListFindingsAsync.mockReturnValue(
      asyncIterable([result(ACTIVE_HIGH, ACTIVE_RESOURCE)]),
    );

    const findings = await auditGcpScc(creds);

    expect(findings).toHaveLength(1);
    const f = findings[0];
    expect(f.title).toContain("PUBLIC_BUCKET_ACL");
    expect(f.severity).toBe("high");
    expect(f.category).toBe("config");
    expect(f.resourceType).toBe("securitycenter.googleapis.com/Finding");
    // resourceId prefers canonicalName.
    expect(f.resourceId).toBe(
      "projects/111/sources/src-123/findings/find-1",
    );
    // region comes from the live ListFindingsResult.resource.location.
    expect(f.resourceRegion).toBe("us-central1");
    expect(f.source).toBe("gcp-scc-auditor");
    // detector name resolved from the enumerated source's displayName.
    expect(f.description).toContain("Security Health Analytics");
    expect(f.description).toContain("Bucket is publicly accessible.");
    expect(f.controlMappings && f.controlMappings.length).toBeGreaterThan(0);
  });

  it("FAIL: maps SCC severities and skips inactive/muted within one page", async () => {
    const creds = makeMockCreds();
    mockListFindingsAsync.mockReturnValue(
      asyncIterable([
        result({
          ...ACTIVE_HIGH,
          name: `${SOURCE_PATH}/findings/crit`,
          canonicalName: undefined, // -> falls back to name
          severity: "CRITICAL",
          category: "MALWARE",
        }),
        result({
          ...ACTIVE_HIGH,
          name: `${SOURCE_PATH}/findings/lowsev`,
          severity: "LOW",
          category: "WEAK_SSL_POLICY",
        }),
        // Numeric proto enum form: state INACTIVE(2) -> skipped.
        result({ ...ACTIVE_HIGH, state: 2 }),
        // Severity unset -> defaults to medium.
        result({
          ...ACTIVE_HIGH,
          name: `${SOURCE_PATH}/findings/unset`,
          severity: undefined,
          category: "OBSERVATION",
        }),
      ]),
    );

    const findings = await auditGcpScc(creds);

    // 3 active findings surfaced (the INACTIVE one is dropped).
    expect(findings).toHaveLength(3);

    const crit = findings.find((x) => x.title.includes("MALWARE"));
    expect(crit).toBeDefined();
    expect(crit!.severity).toBe("critical");
    // canonicalName absent -> resourceId is the finding name path.
    expect(crit!.resourceId).toBe(`${SOURCE_PATH}/findings/crit`);

    const low = findings.find((x) => x.title.includes("WEAK_SSL_POLICY"));
    expect(low!.severity).toBe("low");

    const unset = findings.find((x) => x.title.includes("OBSERVATION"));
    expect(unset!.severity).toBe("medium");
  });

  it("testConnection validates real SCC API access, not a string check", async () => {
    const agent = new GcpSccAuditorAgent();
    const validCreds = JSON.stringify({
      type: "service_account",
      project_id: PROJECT_ID,
      client_email: "sa@proj-1.iam.gserviceaccount.com",
      private_key:
        "-----BEGIN PRIVATE KEY-----\nfake\n-----END PRIVATE KEY-----\n",
    });

    // A reachable API resolves without throwing.
    mockListFindings.mockResolvedValue([[], null, {}]);
    expect(await agent.testConnection(validCreds)).toBe(true);
    expect(mockListFindings).toHaveBeenCalledWith({
      parent: `projects/${PROJECT_ID}/sources/-`,
      pageSize: 1,
    });

    // A non-JSON ref cannot resolve credentials -> false (not a substring match).
    expect(await agent.testConnection("gcp-fake")).toBe(false);

    // An API/authorization failure -> false.
    mockListFindings.mockRejectedValueOnce(new Error("PERMISSION_DENIED"));
    expect(await agent.testConnection(validCreds)).toBe(false);
  });
});
