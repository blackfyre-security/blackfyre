/**
 * Synthetic GCP finding generator for Acme Bank.
 * Reads gcp/org-data.json and applies the same checks as the real GCP auditors,
 * emitting AgentFindingPayload-shaped objects to stdout as JSON.
 *
 * Run: npx tsx fake-org/gcp/generate.ts | jq 'length'
 * (from C:/blackfyre/platform/packages/api)
 */

import { createHash } from "crypto";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

// ---------------------------------------------------------------------------
// Inline type — mirrors AgentFindingPayload from @blackfyre/shared
// ---------------------------------------------------------------------------

type Severity = "critical" | "high" | "medium" | "low";
type FindingCategory =
  | "iam"
  | "encryption"
  | "logging"
  | "network"
  | "endpoint"
  | "identity"
  | "config"
  | "iac"
  | "storage";
type RemediationTier = "auto" | "approval" | "manual";

interface AgentFindingPayload {
  title: string;
  description: string;
  severity: Severity;
  category: FindingCategory;
  resourceType?: string | null;
  resourceId?: string | null;
  resourceRegion?: string | null;
  remediationTier: RemediationTier;
  autoFixAvailable: boolean;
  cloud: "gcp";
  accountId: string;
}

// ---------------------------------------------------------------------------
// Deterministic dedup hash
// ---------------------------------------------------------------------------

function dedupHash(resourceId: string, checkId: string): string {
  return createHash("sha256")
    .update(`gcp:${resourceId}:${checkId}`)
    .digest("hex")
    .slice(0, 16);
}

// ---------------------------------------------------------------------------
// Load org data
// ---------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const orgData = JSON.parse(
  readFileSync(join(__dirname, "org-data.json"), "utf8")
);

const DEFAULT_PROJECT: string = orgData.projects[0].projectId;

// ---------------------------------------------------------------------------
// GCS Bucket checks
// ---------------------------------------------------------------------------

function auditGcsBuckets(): AgentFindingPayload[] {
  const findings: AgentFindingPayload[] = [];

  for (const bucket of orgData.gcsBuckets) {
    const name: string = bucket.name;
    const projectId: string = bucket.projectId;
    const region: string = bucket.location;

    // Check 1: Public access via IAM (critical)
    for (const binding of bucket.iamBindings) {
      const publicMember = (binding.members as string[]).find(
        (m) => m === "allUsers" || m === "allAuthenticatedUsers"
      );
      if (publicMember) {
        findings.push({
          title: `GCS bucket '${name}' has ${publicMember} as ${binding.role}`,
          description: `GCS bucket ${name} has an IAM binding granting "${binding.role}" to "${publicMember}", making the bucket publicly accessible. Remove this binding to restrict access and prevent unauthorized data exposure.`,
          severity: "critical",
          category: "config",
          resourceType: "storage.googleapis.com/Bucket",
          resourceId: name,
          resourceRegion: region,
          remediationTier: "manual",
          autoFixAvailable: false,
          cloud: "gcp",
          accountId: projectId,
        });
        break; // one finding per bucket for public access
      }
    }

    // Check 2: Uniform bucket-level access not enabled (medium)
    if (!bucket.uniformBucketLevelAccess) {
      findings.push({
        title: `GCS bucket '${name}' does not use uniform bucket-level access`,
        description: `GCS bucket ${name} does not have uniform bucket-level access enabled. Without uniform access, ACLs and IAM policies can create inconsistent permissions. Enable uniform bucket-level access for simpler, more secure permission management.`,
        severity: "medium",
        category: "config",
        resourceType: "storage.googleapis.com/Bucket",
        resourceId: name,
        resourceRegion: region,
        remediationTier: "auto",
        autoFixAvailable: true,
        cloud: "gcp",
        accountId: projectId,
      });
    }

    // Check 3: No CMEK — only flag buckets lacking both CMEK and uniform access
    // (buckets with uniform access are already flagged; this avoids per-bucket noise)
    if (!bucket.cmekKey && bucket.uniformBucketLevelAccess) {
      findings.push({
        title: `GCS bucket '${name}' uses Google-managed encryption (CMEK recommended)`,
        description: `GCS bucket ${name} does not have a customer-managed encryption key (CMEK) configured. While Google-managed encryption is applied by default, CMEK provides additional control over encryption key lifecycle, access, and auditability.`,
        severity: "medium",
        category: "encryption",
        resourceType: "storage.googleapis.com/Bucket",
        resourceId: name,
        resourceRegion: region,
        remediationTier: "manual",
        autoFixAvailable: false,
        cloud: "gcp",
        accountId: projectId,
      });
    }

    // Check 4: No retention policy for log buckets
    if (!bucket.retentionPolicyEnabled && name.includes("log")) {
      findings.push({
        title: `GCS bucket '${name}' has no retention policy configured`,
        description: `GCS bucket ${name} stores logs but has no retention policy configured. Retention policies prevent objects from being deleted before the retention period expires, supporting compliance and audit requirements.`,
        severity: "low",
        category: "config",
        resourceType: "storage.googleapis.com/Bucket",
        resourceId: name,
        resourceRegion: region,
        remediationTier: "manual",
        autoFixAvailable: false,
        cloud: "gcp",
        accountId: projectId,
      });
    }
  }

  return findings;
}

// ---------------------------------------------------------------------------
// BigQuery Dataset checks
// ---------------------------------------------------------------------------

function auditBigQuery(): AgentFindingPayload[] {
  const findings: AgentFindingPayload[] = [];

  for (const dataset of orgData.bigqueryDatasets) {
    const id: string = `${dataset.projectId}:${dataset.datasetId}`;
    const projectId: string = dataset.projectId;
    const region: string = dataset.location;

    // Check 1: No CMEK (high) — only for datasets without expiration policy
    if (!dataset.cmekKey && !dataset.defaultTableExpirationMs) {
      findings.push({
        title: `BigQuery dataset '${dataset.datasetId}' uses Google-managed encryption (CMEK recommended)`,
        description: `BigQuery dataset ${dataset.datasetId} in project ${projectId} uses Google-managed encryption instead of customer-managed keys (CMEK). CMEK enables key management control, access revocation, and compliance with data residency requirements.`,
        severity: "high",
        category: "encryption",
        resourceType: "bigquery.googleapis.com/Dataset",
        resourceId: id,
        resourceRegion: region,
        remediationTier: "manual",
        autoFixAvailable: false,
        cloud: "gcp",
        accountId: projectId,
      });
    }

    // Check 2: Public access (critical)
    for (const binding of dataset.iamBindings) {
      const publicMember = (binding.members as string[]).find(
        (m) => m === "allUsers" || m === "allAuthenticatedUsers"
      );
      if (publicMember) {
        findings.push({
          title: `BigQuery dataset '${dataset.datasetId}' has public access via IAM`,
          description: `BigQuery dataset ${dataset.datasetId} has an IAM binding granting "${binding.role}" to "${publicMember}". Public access to analytical datasets exposes sensitive business data. Remove the public IAM binding immediately.`,
          severity: "critical",
          category: "iam",
          resourceType: "bigquery.googleapis.com/Dataset",
          resourceId: id,
          resourceRegion: region,
          remediationTier: "manual",
          autoFixAvailable: false,
          cloud: "gcp",
          accountId: projectId,
        });
        break;
      }
    }

    // Check 3: No table expiration (low) — only flag datasets without CMEK either
    if (!dataset.defaultTableExpirationMs && !dataset.cmekKey) {
      findings.push({
        title: `BigQuery dataset '${dataset.datasetId}' has no default table expiration policy`,
        description: `BigQuery dataset ${dataset.datasetId} does not have a default table expiration policy. Without table expiration, data may be retained indefinitely. Configure a default table expiration appropriate for the data classification.`,
        severity: "low",
        category: "config",
        resourceType: "bigquery.googleapis.com/Dataset",
        resourceId: id,
        resourceRegion: region,
        remediationTier: "manual",
        autoFixAvailable: false,
        cloud: "gcp",
        accountId: projectId,
      });
    }
  }

  return findings;
}

// ---------------------------------------------------------------------------
// Cloud SQL checks
// ---------------------------------------------------------------------------

function auditCloudSql(): AgentFindingPayload[] {
  const findings: AgentFindingPayload[] = [];

  for (const instance of orgData.cloudSqlInstances) {
    const name: string = instance.name;
    const projectId: string = instance.projectId;
    const region: string = instance.region;
    const resourceId = `projects/${projectId}/instances/${name}`;

    // Check 1: Public IP enabled (high)
    if (instance.publicIpEnabled) {
      findings.push({
        title: `Cloud SQL '${name}' has public IP enabled`,
        description: `Cloud SQL instance ${name} is accessible via a public IP address. This increases the attack surface. Use private IP (Cloud SQL Private Service Connect or VPC peering) to restrict access to authorized networks.`,
        severity: "high",
        category: "network",
        resourceType: "sqladmin.googleapis.com/Instance",
        resourceId: resourceId,
        resourceRegion: region,
        remediationTier: "manual",
        autoFixAvailable: false,
        cloud: "gcp",
        accountId: projectId,
      });
    }

    // Check 2: Authorized network 0.0.0.0/0 (critical)
    const openNetwork = (instance.authorizedNetworks as Array<{ name: string; value: string }>).find(
      (n) => n.value === "0.0.0.0/0"
    );
    if (openNetwork) {
      findings.push({
        title: `Cloud SQL '${name}' authorized network allows 0.0.0.0/0`,
        description: `Cloud SQL instance ${name} has authorized network rule "${openNetwork.name}" that allows connections from any IP (0.0.0.0/0). Remove this overly permissive rule and restrict access to specific IP ranges or use Cloud SQL Auth Proxy.`,
        severity: "critical",
        category: "network",
        resourceType: "sqladmin.googleapis.com/Instance",
        resourceId: resourceId,
        resourceRegion: region,
        remediationTier: "approval",
        autoFixAvailable: false,
        cloud: "gcp",
        accountId: projectId,
      });
    }

    // Check 3: SSL not required (high)
    if (!instance.requireSsl) {
      findings.push({
        title: `Cloud SQL '${name}' does not require SSL for client connections`,
        description: `Cloud SQL instance ${name} does not require SSL/TLS for client connections. Unencrypted database connections are vulnerable to eavesdropping and man-in-the-middle attacks. Enable SSL enforcement on the instance.`,
        severity: "high",
        category: "encryption",
        resourceType: "sqladmin.googleapis.com/Instance",
        resourceId: resourceId,
        resourceRegion: region,
        remediationTier: "auto",
        autoFixAvailable: true,
        cloud: "gcp",
        accountId: projectId,
      });
    }

    // Check 4: Automated backups disabled (high)
    if (!instance.backupEnabled) {
      findings.push({
        title: `Cloud SQL '${name}' does not have automated backups enabled`,
        description: `Cloud SQL instance ${name} does not have automated backups enabled. Without automated backups, there is no point-in-time recovery capability for the database. Enable automated backups to protect against data loss.`,
        severity: "high",
        category: "config",
        resourceType: "sqladmin.googleapis.com/Instance",
        resourceId: resourceId,
        resourceRegion: region,
        remediationTier: "auto",
        autoFixAvailable: true,
        cloud: "gcp",
        accountId: projectId,
      });
    }
  }

  return findings;
}

// ---------------------------------------------------------------------------
// GKE Cluster checks
// ---------------------------------------------------------------------------

function auditGke(): AgentFindingPayload[] {
  const findings: AgentFindingPayload[] = [];

  for (const cluster of orgData.gkeClusters) {
    const name: string = cluster.name;
    const projectId: string = cluster.projectId;
    const region: string = cluster.location;
    const resourceId: string = cluster.resourceId;

    if (!cluster.workloadIdentityEnabled) {
      findings.push({
        title: `GKE cluster '${name}' lacks Workload Identity`,
        description: `GKE cluster ${name} does not have Workload Identity enabled. Without Workload Identity, pods must use node service account credentials or mounted key files to access GCP services, violating least-privilege. Enable Workload Identity to bind Kubernetes service accounts to GCP IAM service accounts.`,
        severity: "high",
        category: "iam",
        resourceType: "container.googleapis.com/Cluster",
        resourceId: resourceId,
        resourceRegion: region,
        remediationTier: "manual",
        autoFixAvailable: false,
        cloud: "gcp",
        accountId: projectId,
      });
    }

    if (!cluster.shieldedNodesEnabled) {
      findings.push({
        title: `GKE cluster '${name}' does not use shielded nodes`,
        description: `GKE cluster ${name} does not have shielded GKE nodes enabled. Shielded nodes provide verifiable node integrity using Secure Boot, vTPM, and Integrity Monitoring. Enable shielded nodes to protect against rootkits and bootloader attacks.`,
        severity: "medium",
        category: "config",
        resourceType: "container.googleapis.com/Cluster",
        resourceId: resourceId,
        resourceRegion: region,
        remediationTier: "manual",
        autoFixAvailable: false,
        cloud: "gcp",
        accountId: projectId,
      });
    }

    if (!cluster.privateClusterEnabled) {
      findings.push({
        title: `GKE cluster '${name}' is not configured as a private cluster`,
        description: `GKE cluster ${name} nodes have public IP addresses, exposing them to the internet. A private cluster restricts node IP addresses to RFC 1918 ranges, reducing the attack surface. Migrate to a private cluster configuration.`,
        severity: "high",
        category: "network",
        resourceType: "container.googleapis.com/Cluster",
        resourceId: resourceId,
        resourceRegion: region,
        remediationTier: "manual",
        autoFixAvailable: false,
        cloud: "gcp",
        accountId: projectId,
      });
    }

    if (!cluster.networkPolicyEnabled) {
      findings.push({
        title: `GKE cluster '${name}' does not enforce Kubernetes NetworkPolicy`,
        description: `GKE cluster ${name} does not have network policy enforcement enabled. Without network policies, pods can communicate with all other pods in the cluster. Enable NetworkPolicy support to restrict pod-to-pod traffic.`,
        severity: "medium",
        category: "network",
        resourceType: "container.googleapis.com/Cluster",
        resourceId: resourceId,
        resourceRegion: region,
        remediationTier: "manual",
        autoFixAvailable: false,
        cloud: "gcp",
        accountId: projectId,
      });
    }

    if (!cluster.masterAuthorizedNetworksEnabled) {
      findings.push({
        title: `GKE cluster '${name}' does not restrict master authorized networks`,
        description: `GKE cluster ${name} does not have master authorized networks configured. Without this, the Kubernetes API server is accessible from any IP address. Configure authorized networks to restrict API server access to trusted IP ranges.`,
        severity: "medium",
        category: "network",
        resourceType: "container.googleapis.com/Cluster",
        resourceId: resourceId,
        resourceRegion: region,
        remediationTier: "manual",
        autoFixAvailable: false,
        cloud: "gcp",
        accountId: projectId,
      });
    }
  }

  return findings;
}

// ---------------------------------------------------------------------------
// IAM checks
// ---------------------------------------------------------------------------

function auditIam(): AgentFindingPayload[] {
  const findings: AgentFindingPayload[] = [];

  const PRIMITIVE_ROLES = new Set(["roles/owner", "roles/editor"]);

  for (const binding of orgData.iamBindings) {
    const projectId: string = binding.projectId;
    const role: string = binding.role;

    if (PRIMITIVE_ROLES.has(role)) {
      const nonSaMembers = (binding.members as string[]).filter(
        (m) =>
          !m.startsWith("serviceAccount:") &&
          m !== "allUsers" &&
          m !== "allAuthenticatedUsers"
      );

      if (nonSaMembers.length > 0) {
        findings.push({
          title: `IAM binding grants primitive role '${role}' to ${nonSaMembers.length} member(s) in '${projectId}'`,
          description: `GCP project ${projectId} assigns the primitive role "${role}" to ${nonSaMembers.length} member(s): ${nonSaMembers.join(", ")}. Primitive roles grant overly broad permissions across all GCP services. Replace with predefined or custom roles following least-privilege.`,
          severity: role === "roles/owner" ? "high" : "medium",
          category: "iam",
          resourceType: "cloudresourcemanager.googleapis.com/Project",
          resourceId: `projects/${projectId}`,
          resourceRegion: "global",
          remediationTier: "manual",
          autoFixAvailable: false,
          cloud: "gcp",
          accountId: projectId,
        });
      }
    }
  }

  // Service account key age check (90+ days)
  const ninetyDaysAgo = new Date("2025-02-06T00:00:00Z");
  for (const sa of orgData.serviceAccounts) {
    const projectId: string = sa.projectId;

    for (const key of sa.keys as Array<{ name: string; keyType: string; validAfterTime: string }>) {
      if (key.keyType !== "USER_MANAGED") continue;
      if (new Date(key.validAfterTime) < ninetyDaysAgo) {
        findings.push({
          title: `Service account key for '${sa.email}' not rotated in 90+ days`,
          description: `Service account ${sa.email} has a user-managed key created on ${key.validAfterTime} that has not been rotated in over 90 days. Rotate service account keys regularly to reduce the risk of compromised credentials.`,
          severity: "high",
          category: "iam",
          resourceType: "iam.googleapis.com/ServiceAccountKey",
          resourceId: key.name,
          resourceRegion: "global",
          remediationTier: "manual",
          autoFixAvailable: false,
          cloud: "gcp",
          accountId: projectId,
        });
      }
    }

    // Admin SA with user-managed keys (critical)
    const userKeys = (sa.keys as Array<{ keyType: string }>).filter((k) => k.keyType === "USER_MANAGED");
    if (userKeys.length > 0 && sa.hasAdminRole) {
      findings.push({
        title: `Admin service account '${sa.email}' has user-managed keys`,
        description: `Service account ${sa.email} has an admin-level role and ${userKeys.length} user-managed key(s). Admin service accounts with downloadable keys pose a critical security risk if the key is leaked. Use Workload Identity or short-lived tokens instead.`,
        severity: "critical",
        category: "iam",
        resourceType: "iam.googleapis.com/ServiceAccount",
        resourceId: sa.email,
        resourceRegion: "global",
        remediationTier: "manual",
        autoFixAvailable: false,
        cloud: "gcp",
        accountId: projectId,
      });
    }
  }

  return findings;
}

// ---------------------------------------------------------------------------
// KMS checks
// ---------------------------------------------------------------------------

function auditKms(): AgentFindingPayload[] {
  const findings: AgentFindingPayload[] = [];

  for (const key of orgData.kmsKeys) {
    const projectId: string = key.projectId;
    const keyShortName: string = (key.name as string).split("/").pop() ?? key.name;

    // No rotation period (high)
    if (!key.rotationPeriod) {
      findings.push({
        title: `KMS key '${keyShortName}' does not have automatic rotation configured`,
        description: `GCP KMS crypto key ${key.name} does not have an automatic rotation period configured. Configure automatic key rotation to limit the amount of data encrypted under a single key version and reduce the blast radius of key compromise.`,
        severity: "high",
        category: "encryption",
        resourceType: "cloudkms.googleapis.com/CryptoKey",
        resourceId: key.name,
        resourceRegion: key.location,
        remediationTier: "auto",
        autoFixAvailable: true,
        cloud: "gcp",
        accountId: projectId,
      });
    }

    // Public IAM (critical)
    for (const binding of key.iamBindings as Array<{ role: string; members: string[] }>) {
      const publicMember = binding.members.find(
        (m) => m === "allUsers" || m === "allAuthenticatedUsers"
      );
      if (publicMember) {
        findings.push({
          title: `KMS key '${keyShortName}' is publicly accessible via IAM`,
          description: `GCP KMS crypto key ${key.name} has an IAM binding granting "${binding.role}" to "${publicMember}". Public access to encryption keys is a critical security risk. Remove public access immediately.`,
          severity: "critical",
          category: "encryption",
          resourceType: "cloudkms.googleapis.com/CryptoKey",
          resourceId: key.name,
          resourceRegion: key.location,
          remediationTier: "manual",
          autoFixAvailable: false,
          cloud: "gcp",
          accountId: projectId,
        });
        break;
      }
    }
  }

  return findings;
}

// ---------------------------------------------------------------------------
// Security Command Center findings
// ---------------------------------------------------------------------------

function auditScc(): AgentFindingPayload[] {
  const findings: AgentFindingPayload[] = [];

  const severityMap: Record<string, Severity> = {
    CRITICAL: "critical",
    HIGH: "high",
    MEDIUM: "medium",
    LOW: "low",
  };

  const categoryMap: Record<string, FindingCategory> = {
    PUBLIC_BUCKET_ACL: "config",
    OPEN_FIREWALL: "network",
    SQL_NO_ROOT_PASSWORD: "config",
    AUDIT_LOGGING_DISABLED: "logging",
    MFA_NOT_ENFORCED: "iam",
    KMS_KEY_NOT_ROTATED: "encryption",
    GKE_WORKLOAD_IDENTITY_DISABLED: "iam",
  };

  // Skip categories already covered by dedicated auditors to avoid duplicate findings
  const SKIP_CATEGORIES = new Set([
    "PUBLIC_BUCKET_ACL",    // covered by auditGcsBuckets
    "KMS_KEY_NOT_ROTATED",  // covered by auditKms
    "GKE_WORKLOAD_IDENTITY_DISABLED", // covered by auditGke
  ]);

  for (const sccFinding of orgData.sccFindings) {
    if (sccFinding.state !== "ACTIVE") continue;
    if (SKIP_CATEGORIES.has(sccFinding.category)) continue;

    const sev = severityMap[sccFinding.severity] ?? "medium";
    const cat = categoryMap[sccFinding.category] ?? "config";
    const resourceProject =
      (sccFinding.resourceName as string).match(/projects\/([^/]+)/)?.[1] ??
      DEFAULT_PROJECT;

    findings.push({
      title: `SCC: ${(sccFinding.category as string).replace(/_/g, " ")} — ${(sccFinding.resourceName as string).split("/").pop()}`,
      description: `Security Command Center active finding: ${sccFinding.description} (finding ID: ${(sccFinding.name as string).split("/").pop()})`,
      severity: sev,
      category: cat,
      resourceType: "securitycenter.googleapis.com/Finding",
      resourceId: sccFinding.name,
      resourceRegion: "global",
      remediationTier: "manual",
      autoFixAvailable: false,
      cloud: "gcp",
      accountId: resourceProject,
    });
  }

  return findings;
}

// ---------------------------------------------------------------------------
// Assemble all findings with stable IDs
// ---------------------------------------------------------------------------

interface FullFinding extends AgentFindingPayload {
  id: string;
  scanId: string;
  tenantId: string;
  status: "open";
  dedupHash: string;
}

function buildFindings(): FullFinding[] {
  const raw: AgentFindingPayload[] = [
    ...auditGcsBuckets(),
    ...auditBigQuery(),
    ...auditCloudSql(),
    ...auditGke(),
    ...auditIam(),
    ...auditKms(),
    ...auditScc(),
  ];

  const SCAN_ID = "gcp-synthetic-scan-001";
  const TENANT_ID = orgData.organization.id;

  return raw.map((f, idx) => {
    const hash = dedupHash(f.resourceId ?? `idx-${idx}`, f.title);
    return {
      ...f,
      id: `gcp-finding-${hash}`,
      scanId: SCAN_ID,
      tenantId: TENANT_ID,
      status: "open" as const,
      dedupHash: hash,
    };
  });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const findings = buildFindings();
process.stdout.write(JSON.stringify(findings, null, 2));
