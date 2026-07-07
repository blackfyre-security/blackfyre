import { Storage } from "@google-cloud/storage";
import type { AgentFindingPayload } from "@blackfyre/shared";
import { mapCheckToControls } from "../../services/compliance-mapper.js";
import type { GcpCredentials } from "./credentials.js";

/**
 * Runs all GCP Storage (GCS) security checks and returns findings.
 *
 * Checks:
 * 1. gcp_bucket_public_access — Bucket IAM policy grants allUsers/allAuthenticatedUsers
 * 2. gcp_bucket_no_uniform_access — Uniform bucket-level access not enabled
 * 3. gcp_bucket_no_versioning — Object versioning not enabled
 * 4. gcp_bucket_no_cmek — No customer-managed encryption key configured
 */
export async function auditGcpStorage(
  creds: GcpCredentials,
): Promise<AgentFindingPayload[]> {
  const authClient = await creds.auth.getClient();
  const storage = new Storage({
    authClient: authClient as any,
    projectId: creds.projectId,
  });

  const findings: AgentFindingPayload[] = [];

  const [buckets] = await storage.getBuckets();

  // Run per-bucket checks concurrently
  const bucketResults = await Promise.all(
    buckets.map(async (bucket) => {
      const bucketFindings: AgentFindingPayload[] = [];
      const name = bucket.name;

      const [metadata] = await bucket.getMetadata();

      // Check: Uniform bucket-level access not enabled
      if (
        metadata.iamConfiguration?.uniformBucketLevelAccess?.enabled !== true
      ) {
        bucketFindings.push({
          title: `GCS bucket "${name}" does not use uniform bucket-level access`,
          description: `GCS bucket ${name} does not have uniform bucket-level access enabled. Without uniform access, ACLs and IAM policies can create inconsistent permissions. Enable uniform bucket-level access for simpler, more secure permission management.`,
          severity: "medium",
          category: "config",
          resourceType: "storage.googleapis.com/Bucket",
          resourceId: name,
          remediationTier: "auto",
          autoFixAvailable: true,
          controlMappings: mapCheckToControls("gcp_bucket_no_uniform_access"),
        });
      }

      // Check: Versioning not enabled
      if (metadata.versioning?.enabled !== true) {
        bucketFindings.push({
          title: `GCS bucket "${name}" does not have versioning enabled`,
          description: `GCS bucket ${name} does not have object versioning enabled. Versioning protects against accidental deletions and overwrites. Enable versioning for data recovery and audit trail.`,
          severity: "medium",
          category: "config",
          resourceType: "storage.googleapis.com/Bucket",
          resourceId: name,
          remediationTier: "auto",
          autoFixAvailable: true,
          controlMappings: mapCheckToControls("gcp_bucket_no_versioning"),
        });
      }

      // Check: No CMEK (customer-managed encryption key)
      if (!metadata.encryption?.defaultKmsKeyName) {
        bucketFindings.push({
          title: `GCS bucket "${name}" does not use customer-managed encryption`,
          description: `GCS bucket ${name} does not have a customer-managed encryption key (CMEK) configured. While Google-managed encryption is applied by default, CMEK provides additional control over encryption key lifecycle and access.`,
          severity: "medium",
          category: "encryption",
          resourceType: "storage.googleapis.com/Bucket",
          resourceId: name,
          remediationTier: "manual",
          autoFixAvailable: false,
          controlMappings: mapCheckToControls("gcp_bucket_no_cmek"),
        });
      }

      // Check: Public access via IAM policy
      try {
        const [iamPolicy] = await bucket.iam.getPolicy();
        for (const binding of iamPolicy.bindings ?? []) {
          const members = binding.members ?? [];
          for (const member of members) {
            if (member === "allUsers" || member === "allAuthenticatedUsers") {
              bucketFindings.push({
                title: `GCS bucket "${name}" is publicly accessible via IAM`,
                description: `GCS bucket ${name} has an IAM binding granting "${binding.role}" to "${member}". This makes the bucket publicly accessible. Remove public access unless explicitly required.`,
                severity: "critical",
                category: "config",
                resourceType: "storage.googleapis.com/Bucket",
                resourceId: name,
                remediationTier: "manual",
                autoFixAvailable: false,
                controlMappings: mapCheckToControls("gcp_bucket_public_access"),
              });
              break; // One finding per binding is sufficient
            }
          }
        }
      } catch {
        // If we can't read IAM policy, skip public access check
      }

      return bucketFindings;
    }),
  );

  for (const result of bucketResults) {
    findings.push(...result);
  }

  return findings;
}
