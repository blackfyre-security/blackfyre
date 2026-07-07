import { KeyManagementServiceClient } from "@google-cloud/kms";
import type { AgentFindingPayload } from "@blackfyre/shared";
import { mapCheckToControls } from "../../services/compliance-mapper.js";
import type { GcpCredentials } from "./credentials.js";

/**
 * Runs all GCP KMS security checks and returns findings.
 *
 * Checks:
 * 1. gcp_kms_no_rotation — Crypto key does not have automatic rotation configured
 * 2. gcp_kms_public_iam — Crypto key IAM policy grants allUsers/allAuthenticatedUsers
 * 3. gcp_kms_destroyed_key — Crypto key has versions in DESTROYED or DESTROY_SCHEDULED state
 */
export async function auditGcpKMS(
  creds: GcpCredentials,
): Promise<AgentFindingPayload[]> {
  const authClient = await creds.auth.getClient();
  const client = new KeyManagementServiceClient({
    authClient: authClient as any,
  });

  const findings: AgentFindingPayload[] = [];

  // List all key rings across all locations (using "-" for all locations)
  const parent = `projects/${creds.projectId}/locations/-`;
  const [keyRings] = await client.listKeyRings({ parent });

  for (const keyRing of keyRings) {
    if (!keyRing.name) continue;

    // List crypto keys in this key ring
    const [cryptoKeys] = await client.listCryptoKeys({
      parent: keyRing.name,
    });

    for (const key of cryptoKeys) {
      if (!key.name) continue;

      const keyName = key.name.split("/").pop() ?? key.name;

      // Check: No rotation period configured
      if (!key.rotationPeriod) {
        findings.push({
          title: `KMS key "${keyName}" does not have automatic rotation configured`,
          description: `GCP KMS crypto key ${key.name} does not have an automatic rotation period configured. Configure automatic key rotation to limit the amount of data encrypted under a single key version and reduce the blast radius of key compromise.`,
          severity: "high",
          category: "encryption",
          resourceType: "cloudkms.googleapis.com/CryptoKey",
          resourceId: key.name,
          remediationTier: "auto",
          autoFixAvailable: true,
          controlMappings: mapCheckToControls("gcp_kms_no_rotation"),
        });
      }

      // Check: Public IAM policy on key
      await checkKeyPublicIam(client, key.name, keyName, findings);

      // Check: Destroyed key versions
      await checkDestroyedKeyVersions(client, key.name, keyName, findings);
    }
  }

  return findings;
}

// ---------------------------------------------------------------------------
// Check key IAM policy for public access
// ---------------------------------------------------------------------------

async function checkKeyPublicIam(
  client: KeyManagementServiceClient,
  keyName: string,
  keyShortName: string,
  findings: AgentFindingPayload[],
): Promise<void> {
  try {
    const [policy] = await client.getIamPolicy({
      resource: keyName,
    } as any);

    for (const binding of policy.bindings ?? []) {
      const members = binding.members ?? [];
      for (const member of members) {
        if (member === "allUsers" || member === "allAuthenticatedUsers") {
          findings.push({
            title: `KMS key "${keyShortName}" is publicly accessible via IAM`,
            description: `GCP KMS crypto key ${keyName} has an IAM binding granting "${binding.role}" to "${member}". Public access to encryption keys is a critical security risk. Remove public access immediately.`,
            severity: "critical",
            category: "encryption",
            resourceType: "cloudkms.googleapis.com/CryptoKey",
            resourceId: keyName,
            remediationTier: "manual",
            autoFixAvailable: false,
            controlMappings: mapCheckToControls("gcp_kms_public_iam"),
          });
          return; // One finding per key is sufficient
        }
      }
    }
  } catch {
    // If we can't read IAM policy, skip this check
  }
}

// ---------------------------------------------------------------------------
// Check for destroyed or destroy-scheduled key versions
// ---------------------------------------------------------------------------

async function checkDestroyedKeyVersions(
  client: KeyManagementServiceClient,
  keyName: string,
  keyShortName: string,
  findings: AgentFindingPayload[],
): Promise<void> {
  try {
    const [versions] = await client.listCryptoKeyVersions({
      parent: keyName,
    });

    const destroyedVersions = versions.filter(
      (v) => v.state === "DESTROYED" || v.state === "DESTROY_SCHEDULED",
    );

    if (destroyedVersions.length > 0) {
      findings.push({
        title: `KMS key "${keyShortName}" has ${destroyedVersions.length} destroyed/scheduled-for-destruction version(s)`,
        description: `GCP KMS crypto key ${keyName} has ${destroyedVersions.length} key version(s) in DESTROYED or DESTROY_SCHEDULED state. Verify this is intentional and that no data remains encrypted with these versions. Data encrypted with destroyed key versions is permanently inaccessible.`,
        severity: "medium",
        category: "encryption",
        resourceType: "cloudkms.googleapis.com/CryptoKey",
        resourceId: keyName,
        remediationTier: "manual",
        autoFixAvailable: false,
        controlMappings: mapCheckToControls("gcp_kms_destroyed_key"),
      });
    }
  } catch {
    // If we can't list key versions, skip this check
  }
}
