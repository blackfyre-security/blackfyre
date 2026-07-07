import { GoogleAuth } from "google-auth-library";

export interface GcpCredentials {
  auth: GoogleAuth;
  projectId: string;
}

// REAL IMPL (BLACKFYRE 2026-06): the integration's credential_ref column
// (db/schema.ts integrations.credentialRef) carries the tenant's GCP connection
// config as a JSON string. Customers grant Blackfyre read-only auditing by
// minting a service-account key and pasting it; two real shapes show up in the
// wild and both are supported here:
//
//  1. Wrapped — { projectId, serviceAccountKey: { ...raw SA key... } }. The
//     onboarding UI uses this so it can carry an explicit project even when the
//     SA can audit several projects in the org.
//
//  2. Raw — the verbatim JSON of a downloaded Google service-account key, i.e.
//     { type: "service_account", project_id, private_key, client_email, ... }.
//     This is exactly what `gcloud iam service-accounts keys create` writes, so
//     supporting it lets a customer paste the file unchanged. The project is
//     taken from the key's own `project_id`.
//
// In both shapes the resolved projectId is mandatory: every GCP SDK client the
// auditors construct (Storage, ProjectsClient, compute, KMS, ...) needs it to
// enumerate real resources, and `cloudresourcemanager.googleapis.com/Project`
// findings are keyed on `projects/${projectId}`.
interface ServiceAccountKey {
  type?: string;
  project_id?: string;
  private_key?: string;
  client_email?: string;
  [k: string]: unknown;
}

interface WrappedGcpCredentialConfig {
  projectId?: string;
  serviceAccountKey?: ServiceAccountKey;
}

// Scope Blackfyre's audit clients to cloud-platform. The OAuth scope only
// bounds the *API surface* a token can reach; the customer's read-only IAM
// grant on the service account is what actually limits the session to
// non-mutating, metadata-only reads. cloud-platform is the umbrella scope the
// google-cloud client libraries (Storage/Compute/KMS/resource-manager) expect.
const GCP_AUDIT_SCOPES = ["https://www.googleapis.com/auth/cloud-platform"];

/**
 * Resolves a credentialRef string into GCP credentials.
 *
 * - If credentialRef starts with "vault://", throws (vault-backed secret
 *   resolution is dereferenced upstream in plugins/credentials.ts, not here).
 * - Otherwise, expects JSON in one of two shapes: the wrapped
 *   { projectId, serviceAccountKey } config, or a raw downloaded
 *   service-account key ({ type, project_id, private_key, client_email, ... }).
 *
 * The returned { auth, projectId } is exactly what every GCP SDK client used by
 * the gcp/*-auditor.ts modules needs (each constructs its client with
 * `{ authClient: await creds.auth.getClient(), projectId: creds.projectId }`).
 */
export async function resolveGcpCredentials(
  credentialRef: string,
): Promise<GcpCredentials> {
  if (credentialRef.startsWith("vault://")) {
    // REAL IMPL (BLACKFYRE 2026-06): vault:// references are dereferenced
    // upstream in plugins/credentials.ts before reaching the auditors; reaching
    // here with a raw vault path is a wiring error, not a silent no-op.
    throw new Error("Vault credential resolution not yet integrated.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(credentialRef);
  } catch {
    throw new Error(
      "Unsupported GCP credential format. Expected vault:// path or JSON service account key.",
    );
  }

  if (parsed === null || typeof parsed !== "object") {
    throw new Error(
      "Unsupported GCP credential format. Expected vault:// path or JSON service account key.",
    );
  }

  // REAL IMPL (BLACKFYRE 2026-06): accept both the wrapped config and a raw
  // downloaded service-account key. A raw key is recognised by the presence of
  // the canonical SA-key fields (type/private_key/client_email); otherwise we
  // treat the object as the wrapped { projectId, serviceAccountKey } config.
  const obj = parsed as Record<string, unknown>;
  const looksLikeRawKey =
    obj.type === "service_account" ||
    typeof obj.private_key === "string" ||
    typeof obj.client_email === "string";

  let serviceAccountKey: ServiceAccountKey;
  let projectId: string | undefined;

  if (looksLikeRawKey) {
    serviceAccountKey = obj as ServiceAccountKey;
    projectId = serviceAccountKey.project_id;
  } else {
    const wrapped = obj as WrappedGcpCredentialConfig;
    if (!wrapped.serviceAccountKey) {
      throw new Error(
        "GCP credentials must include projectId and serviceAccountKey",
      );
    }
    serviceAccountKey = wrapped.serviceAccountKey;
    // Prefer the explicit project, fall back to the key's own project_id.
    projectId = wrapped.projectId ?? serviceAccountKey.project_id;
  }

  if (!projectId) {
    throw new Error(
      "GCP credentials must include projectId and serviceAccountKey",
    );
  }

  // REAL IMPL (BLACKFYRE 2026-06): validate the service-account key actually
  // carries the material google-auth-library needs to sign a JWT and exchange
  // it for an access token. Without client_email + private_key the GoogleAuth
  // would construct fine but every downstream SDK call would fail deep inside
  // an auditor with an opaque error; surface a clear, actionable error here.
  if (
    typeof serviceAccountKey !== "object" ||
    serviceAccountKey === null ||
    !serviceAccountKey.client_email ||
    !serviceAccountKey.private_key
  ) {
    throw new Error(
      "GCP service account key must include client_email and private_key",
    );
  }

  const auth = new GoogleAuth({
    credentials: serviceAccountKey as Record<string, string>,
    projectId,
    scopes: GCP_AUDIT_SCOPES,
  });

  return { auth, projectId };
}
