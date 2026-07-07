import { ProjectsClient } from "@google-cloud/resource-manager";
import type { AgentFindingPayload } from "@blackfyre/shared";
import { mapCheckToControls } from "../../services/compliance-mapper.js";
import type { GcpCredentials } from "./credentials.js";

/**
 * Runs all GCP IAM security checks and returns findings.
 *
 * Checks:
 * 1. gcp_sa_key_not_rotated — Service account keys older than 90 days
 * 2. gcp_sa_admin_key — Service accounts with admin roles and user-managed keys
 * 3. gcp_iam_primitive_role — Primitive roles (Owner/Editor) on non-SA principals
 * 4. gcp_iam_allUsers_binding — allUsers or allAuthenticatedUsers in IAM bindings
 */
export async function auditGcpIAM(
  creds: GcpCredentials,
): Promise<AgentFindingPayload[]> {
  const authClient = await creds.auth.getClient();
  const findings: AgentFindingPayload[] = [];

  // Get project IAM policy for role-based checks
  const policyFindings = await checkProjectIamPolicy(
    authClient,
    creds.projectId,
  );
  findings.push(...policyFindings);

  // Check service account keys via IAM REST API
  const saFindings = await checkServiceAccountKeys(
    authClient,
    creds.projectId,
  );
  findings.push(...saFindings);

  return findings;
}

// ---------------------------------------------------------------------------
// Primitive role names that indicate overly broad permissions
// ---------------------------------------------------------------------------

const PRIMITIVE_ROLES = new Set([
  "roles/owner",
  "roles/editor",
  "roles/viewer",
]);

const ADMIN_ROLES = new Set([
  "roles/owner",
  "roles/editor",
  "roles/iam.securityAdmin",
  "roles/iam.serviceAccountAdmin",
  "roles/resourcemanager.projectIamAdmin",
]);

// ---------------------------------------------------------------------------
// Check project IAM policy for allUsers and primitive role bindings
// ---------------------------------------------------------------------------

async function checkProjectIamPolicy(
  authClient: unknown,
  projectId: string,
): Promise<AgentFindingPayload[]> {
  const findings: AgentFindingPayload[] = [];
  const client = new ProjectsClient({ authClient: authClient as any });

  const [policy] = await client.getIamPolicy({
    resource: `projects/${projectId}`,
  });

  if (!policy?.bindings) return findings;

  for (const binding of policy.bindings) {
    const role = binding.role ?? "";
    const members = binding.members ?? [];

    // Check for allUsers / allAuthenticatedUsers in any binding
    for (const member of members) {
      if (member === "allUsers" || member === "allAuthenticatedUsers") {
        findings.push({
          title: `Project IAM binding grants "${role}" to ${member}`,
          description: `The GCP project ${projectId} has an IAM binding that grants role "${role}" to "${member}", making resources publicly accessible. Remove this binding to restrict access.`,
          severity: "critical",
          category: "iam",
          resourceType: "cloudresourcemanager.googleapis.com/Project",
          resourceId: `projects/${projectId}`,
          remediationTier: "manual",
          autoFixAvailable: false,
          controlMappings: mapCheckToControls("gcp_iam_allUsers_binding"),
        });
      }
    }

    // Check for primitive roles assigned to non-service-account principals
    if (
      PRIMITIVE_ROLES.has(role) &&
      (role === "roles/owner" || role === "roles/editor")
    ) {
      for (const member of members) {
        // Skip service accounts -- primitive roles on SAs are checked separately
        if (member.startsWith("serviceAccount:")) continue;
        if (member === "allUsers" || member === "allAuthenticatedUsers")
          continue;

        findings.push({
          title: `Primitive role "${role}" assigned to "${member}"`,
          description: `The GCP project ${projectId} assigns the primitive role "${role}" to "${member}". Primitive roles grant overly broad permissions. Use predefined or custom roles with least-privilege access instead.`,
          severity: "high",
          category: "iam",
          resourceType: "cloudresourcemanager.googleapis.com/Project",
          resourceId: `projects/${projectId}`,
          remediationTier: "manual",
          autoFixAvailable: false,
          controlMappings: mapCheckToControls("gcp_iam_primitive_role"),
        });
      }
    }
  }

  return findings;
}

// ---------------------------------------------------------------------------
// Check service account keys via IAM REST API
// ---------------------------------------------------------------------------

interface ServiceAccount {
  name?: string;
  email?: string;
  displayName?: string;
}

interface ServiceAccountKey {
  name?: string;
  keyType?: string;
  validAfterTime?: string;
  validBeforeTime?: string;
}

async function checkServiceAccountKeys(
  authClient: any,
  projectId: string,
): Promise<AgentFindingPayload[]> {
  const findings: AgentFindingPayload[] = [];

  // List service accounts via REST API
  const saListUrl = `https://iam.googleapis.com/v1/projects/${projectId}/serviceAccounts`;
  let serviceAccounts: ServiceAccount[] = [];

  try {
    const saResp = await authClient.request({ url: saListUrl });
    serviceAccounts = saResp.data?.accounts ?? [];
  } catch {
    // If we can't list SAs (permissions), return empty -- best effort
    return findings;
  }

  // Get project IAM policy to determine which SAs have admin roles
  const client = new ProjectsClient({ authClient });
  let adminSaEmails: Set<string>;
  try {
    const [policy] = await client.getIamPolicy({
      resource: `projects/${projectId}`,
    });
    adminSaEmails = extractAdminServiceAccounts(policy?.bindings ?? []);
  } catch {
    adminSaEmails = new Set();
  }

  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  for (const sa of serviceAccounts) {
    if (!sa.name || !sa.email) continue;

    // List keys for this service account
    const keysUrl = `https://iam.googleapis.com/v1/${sa.name}/keys`;
    let keys: ServiceAccountKey[] = [];
    try {
      const keysResp = await authClient.request({ url: keysUrl });
      keys = keysResp.data?.keys ?? [];
    } catch {
      continue; // Skip if we can't read keys for this SA
    }

    const userManagedKeys = keys.filter(
      (k) => k.keyType === "USER_MANAGED",
    );

    for (const key of userManagedKeys) {
      if (!key.validAfterTime) continue;

      const keyCreated = new Date(key.validAfterTime);

      // Check: SA key not rotated (older than 90 days)
      if (keyCreated < ninetyDaysAgo) {
        findings.push({
          title: `Service account key for "${sa.email}" not rotated in 90+ days`,
          description: `Service account ${sa.email} has a user-managed key created on ${key.validAfterTime} that has not been rotated in over 90 days. Rotate service account keys regularly to reduce the risk of compromised credentials.`,
          severity: "high",
          category: "iam",
          resourceType: "iam.googleapis.com/ServiceAccountKey",
          resourceId: key.name ?? sa.email,
          remediationTier: "manual",
          autoFixAvailable: false,
          controlMappings: mapCheckToControls("gcp_sa_key_not_rotated"),
        });
      }
    }

    // Check: SA with admin role and user-managed keys
    if (userManagedKeys.length > 0 && adminSaEmails.has(sa.email)) {
      findings.push({
        title: `Admin service account "${sa.email}" has user-managed keys`,
        description: `Service account ${sa.email} has an admin-level role and ${userManagedKeys.length} user-managed key(s). Admin service accounts with downloadable keys pose a critical security risk. Use workload identity or short-lived tokens instead.`,
        severity: "critical",
        category: "iam",
        resourceType: "iam.googleapis.com/ServiceAccount",
        resourceId: sa.email,
        remediationTier: "manual",
        autoFixAvailable: false,
        controlMappings: mapCheckToControls("gcp_sa_admin_key"),
      });
    }
  }

  return findings;
}

/**
 * Extracts service account emails that have admin-level roles from IAM bindings.
 */
function extractAdminServiceAccounts(
  bindings: Array<{ role?: string | null; members?: string[] | null }>,
): Set<string> {
  const adminEmails = new Set<string>();

  for (const binding of bindings) {
    if (!binding.role || !ADMIN_ROLES.has(binding.role)) continue;
    for (const member of binding.members ?? []) {
      if (member.startsWith("serviceAccount:")) {
        adminEmails.add(member.replace("serviceAccount:", ""));
      }
    }
  }

  return adminEmails;
}
