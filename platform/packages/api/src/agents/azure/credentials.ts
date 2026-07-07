import {
  ClientSecretCredential,
  DefaultAzureCredential,
  type TokenCredential,
} from "@azure/identity";

export interface AzureCredentials {
  credential: TokenCredential;
  subscriptionId: string;
  tenantId: string;
}

// REAL IMPL (BLACKFYRE 2026-06): the integration's credential_ref column
// (db/schema.ts integrations.credentialRef) carries the tenant's Azure
// connection config as a JSON string. Two production auth modes are supported,
// matching how customers actually grant a read-only Reader role to Blackfyre:
//
//  1. Service Principal (app registration + client secret) — the most common
//     BYOK path. Requires tenantId + clientId + clientSecret + subscriptionId
//     and builds a real @azure/identity ClientSecretCredential.
//
//  2. Managed / Workload Identity — when Blackfyre's own runtime is federated
//     into the customer subscription (managed identity, workload-identity
//     federation, or env-configured SP), the config omits the clientSecret and
//     we build a real DefaultAzureCredential, which chains
//     EnvironmentCredential -> WorkloadIdentityCredential ->
//     ManagedIdentityCredential -> Azure CLI, etc. tenantId is optional here.
//
// In both modes subscriptionId is mandatory: every ARM management client
// (StorageManagementClient, KeyVaultManagementClient, AuthorizationManagement
// Client, ...) is constructed as `new Client(credential, subscriptionId)`, so
// the auditors cannot enumerate real resources without it.
interface AzureCredentialConfig {
  tenantId?: string;
  clientId?: string;
  clientSecret?: string;
  subscriptionId?: string;
  // Allow explicit selection; otherwise inferred from which fields are present.
  authMode?: "client_secret" | "default" | "managed_identity";
}

/**
 * Resolves a credentialRef string into Azure credentials.
 *
 * - If credentialRef starts with "vault://", throws (vault-backed secret
 *   resolution is wired by the credentials plugin, not this module).
 * - Otherwise, expects JSON with at least { subscriptionId } plus either a full
 *   Service Principal ({ tenantId, clientId, clientSecret }) or nothing further
 *   (managed/workload identity via DefaultAzureCredential).
 *
 * The returned { credential, subscriptionId, tenantId } is exactly what the
 * Azure ARM management clients used by every azure/*-auditor.ts need.
 */
export async function resolveAzureCredentials(
  credentialRef: string,
): Promise<AzureCredentials> {
  if (credentialRef.startsWith("vault://")) {
    // REAL IMPL (BLACKFYRE 2026-06): vault:// references are dereferenced
    // upstream in plugins/credentials.ts before reaching the auditors; reaching
    // here with a raw vault path is a wiring error, not a silent no-op.
    throw new Error("Vault credential resolution not yet integrated.");
  }

  let parsed: AzureCredentialConfig;
  try {
    parsed = JSON.parse(credentialRef) as AzureCredentialConfig;
  } catch {
    throw new Error(
      "Unsupported Azure credential format. Expected vault:// path or JSON with subscriptionId and (tenantId, clientId, clientSecret) or managed identity.",
    );
  }

  if (parsed === null || typeof parsed !== "object") {
    throw new Error(
      "Unsupported Azure credential format. Expected JSON object with subscriptionId.",
    );
  }

  // subscriptionId is required by every ARM management client constructed in
  // the auditors, regardless of which auth mode is used.
  if (!parsed.subscriptionId) {
    throw new Error("Azure credentials must include subscriptionId");
  }

  // REAL IMPL (BLACKFYRE 2026-06): pick the real @azure/identity credential
  // based on the config. Explicit authMode wins; otherwise infer from the
  // presence of a client secret. A full Service Principal builds a real
  // ClientSecretCredential; anything else builds a real DefaultAzureCredential.
  const useClientSecret =
    parsed.authMode === "client_secret" ||
    (parsed.authMode === undefined && Boolean(parsed.clientSecret));

  let credential: TokenCredential;
  let resolvedTenantId: string;

  if (useClientSecret) {
    if (!parsed.tenantId || !parsed.clientId || !parsed.clientSecret) {
      throw new Error(
        "Azure Service Principal credentials must include tenantId, clientId, clientSecret, subscriptionId",
      );
    }

    credential = new ClientSecretCredential(
      parsed.tenantId,
      parsed.clientId,
      parsed.clientSecret,
    );
    resolvedTenantId = parsed.tenantId;
  } else {
    // Managed / workload / environment identity. DefaultAzureCredential honors
    // AZURE_TENANT_ID (and a tenantId hint when supplied) internally; we pass
    // the tenant hint through when present so multi-tenant runtimes target the
    // correct directory.
    credential = parsed.tenantId
      ? new DefaultAzureCredential({ tenantId: parsed.tenantId })
      : new DefaultAzureCredential();
    resolvedTenantId = parsed.tenantId ?? "";
  }

  return {
    credential,
    subscriptionId: parsed.subscriptionId,
    tenantId: resolvedTenantId,
  };
}
