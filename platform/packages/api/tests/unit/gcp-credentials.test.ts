import { describe, it, expect, vi } from "vitest";

// Mock google-auth-library before importing the module under test
vi.mock("google-auth-library", () => {
  return {
    GoogleAuth: vi.fn().mockImplementation((opts: any) => ({
      _credentials: opts?.credentials,
      _scopes: opts?.scopes,
      getClient: vi.fn().mockResolvedValue({}),
    })),
  };
});

import { resolveGcpCredentials } from "../../src/agents/gcp/credentials.js";
import { GoogleAuth } from "google-auth-library";

describe("GCP Credential Resolver", () => {
  it("resolves JSON credentialRef to GcpCredentials with auth and projectId", async () => {
    const credentialRef = JSON.stringify({
      projectId: "proj-1",
      serviceAccountKey: {
        client_email: "sa@proj-1.iam.gserviceaccount.com",
        private_key: "fake-key",
      },
    });

    const result = await resolveGcpCredentials(credentialRef);

    expect(result.projectId).toBe("proj-1");
    expect(result.auth).toBeDefined();
    expect(GoogleAuth).toHaveBeenCalledWith(
      expect.objectContaining({
        credentials: {
          client_email: "sa@proj-1.iam.gserviceaccount.com",
          private_key: "fake-key",
        },
        scopes: ["https://www.googleapis.com/auth/cloud-platform"],
      }),
    );
  });

  it("throws on unsupported credentialRef format", async () => {
    await expect(
      resolveGcpCredentials("invalid-string"),
    ).rejects.toThrow("Unsupported GCP credential format");
  });

  it("creates valid GoogleAuth from service account key JSON", async () => {
    const credentialRef = JSON.stringify({
      projectId: "proj-2",
      serviceAccountKey: {
        client_email: "sa@proj-2.iam.gserviceaccount.com",
        private_key: "fake-key-2",
      },
    });

    const result = await resolveGcpCredentials(credentialRef);

    // Verify auth is truthy and constructed from GoogleAuth
    expect(result.auth).toBeTruthy();
    expect(GoogleAuth).toHaveBeenCalled();
  });

  // REAL IMPL (BLACKFYRE 2026-06): pass-case for a raw downloaded service-account
  // key (the verbatim JSON `gcloud iam service-accounts keys create` writes).
  // projectId is derived from the key's own project_id and the key material is
  // forwarded to GoogleAuth unchanged.
  it("resolves a raw downloaded service-account key and derives projectId from project_id", async () => {
    const credentialRef = JSON.stringify({
      type: "service_account",
      project_id: "proj-raw",
      private_key: "fake-raw-key",
      client_email: "sa@proj-raw.iam.gserviceaccount.com",
    });

    const result = await resolveGcpCredentials(credentialRef);

    expect(result.projectId).toBe("proj-raw");
    expect(result.auth).toBeTruthy();
    expect(GoogleAuth).toHaveBeenCalledWith(
      expect.objectContaining({
        credentials: expect.objectContaining({
          client_email: "sa@proj-raw.iam.gserviceaccount.com",
          private_key: "fake-raw-key",
        }),
        projectId: "proj-raw",
        scopes: ["https://www.googleapis.com/auth/cloud-platform"],
      }),
    );
  });

  // REAL IMPL (BLACKFYRE 2026-06): fail-case — a service-account key missing the
  // private_key/client_email signing material must be rejected here with a clear
  // error rather than constructing a GoogleAuth that fails deep inside an auditor.
  it("throws when the service account key lacks client_email or private_key", async () => {
    const credentialRef = JSON.stringify({
      projectId: "proj-3",
      serviceAccountKey: {
        client_email: "sa@proj-3.iam.gserviceaccount.com",
        // private_key intentionally omitted
      },
    });

    await expect(resolveGcpCredentials(credentialRef)).rejects.toThrow(
      "GCP service account key must include client_email and private_key",
    );
  });

  // REAL IMPL (BLACKFYRE 2026-06): fail-case — no resolvable projectId (neither
  // an explicit projectId nor a project_id inside the key) is unusable because
  // every GCP SDK client the auditors build needs it to enumerate resources.
  it("throws when no projectId can be resolved", async () => {
    const credentialRef = JSON.stringify({
      serviceAccountKey: {
        client_email: "sa@noproj.iam.gserviceaccount.com",
        private_key: "fake-key",
      },
    });

    await expect(resolveGcpCredentials(credentialRef)).rejects.toThrow(
      "GCP credentials must include projectId and serviceAccountKey",
    );
  });

  it("throws on vault:// credentialRef (dereferenced upstream)", async () => {
    await expect(
      resolveGcpCredentials("vault://secret/gcp/acme"),
    ).rejects.toThrow("Vault credential resolution not yet integrated.");
  });
});
