/**
 * drift-generator.ts
 * Generates drift events by comparing prior state to current findings.
 * Prior state is synthesized deterministically with 5-10 differences.
 */

import { createHash } from "crypto";
import type { Finding } from "./evidence-generator.js";

export interface DriftEvent {
  id: string;
  tenantId: string;
  integrationId: string;
  changeType: "created" | "modified" | "deleted";
  resourceType: string;
  resourceId: string;
  severity: "critical" | "high" | "medium" | "low";
  acknowledged: boolean;
  detectedAt: string;
  diff: { before: unknown; after: unknown };
  recommendedAction: string;
}

const TENANT_ID = "tenant-acme-bank-001";

const INTEGRATION_IDS: Record<string, string> = {
  aws: "intg-aws-prod-001",
  azure: "intg-azure-prod-002",
  gcp: "intg-gcp-prod-003",
};

function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

function cloudOf(resourceId: string): string {
  if (resourceId.startsWith("arn:aws")) return "aws";
  if (resourceId.startsWith("/subscriptions")) return "azure";
  return "gcp";
}

function deterministicDate(seed: string, hoursBack: number): string {
  const h = parseInt(sha256(seed).slice(0, 6), 16);
  const offset = h % (hoursBack * 60 * 60 * 1000);
  return new Date(Date.now() - offset).toISOString();
}

const REMEDIATION_ACTIONS: Record<string, string> = {
  created: "Investigate new resource and verify it was intentionally created. Apply relevant security baseline.",
  modified: "Review configuration change. Revert to compliant state if unauthorized.",
  deleted: "Verify deletion was authorized. Restore from backup if needed and update access logs.",
};

const DRIFT_TEMPLATES: Array<{
  resourceType: string;
  cloud: string;
  title: string;
  changeType: DriftEvent["changeType"];
  severity: DriftEvent["severity"];
  beforePatch: Record<string, unknown>;
  afterPatch: Record<string, unknown>;
}> = [
  {
    resourceType: "AWS::IAM::User",
    cloud: "aws",
    title: "IAM user MFA removed",
    changeType: "modified",
    severity: "critical",
    beforePatch: { mfaEnabled: true, mfaDevice: "arn:aws:iam::123456789012:mfa/svc-user" },
    afterPatch: { mfaEnabled: false, mfaDevice: null },
  },
  {
    resourceType: "AWS::S3::Bucket",
    cloud: "aws",
    title: "S3 bucket public access enabled",
    changeType: "modified",
    severity: "critical",
    beforePatch: { publicAccessBlock: { blockPublicAcls: true, blockPublicPolicy: true } },
    afterPatch: { publicAccessBlock: { blockPublicAcls: false, blockPublicPolicy: false } },
  },
  {
    resourceType: "AWS::EC2::SecurityGroup",
    cloud: "aws",
    title: "Security group SSH opened to 0.0.0.0/0",
    changeType: "modified",
    severity: "high",
    beforePatch: { ingressRules: [{ port: 22, cidr: "10.0.0.0/8" }] },
    afterPatch: { ingressRules: [{ port: 22, cidr: "0.0.0.0/0" }] },
  },
  {
    resourceType: "AWS::CloudTrail::Trail",
    cloud: "aws",
    title: "CloudTrail trail deleted",
    changeType: "deleted",
    severity: "critical",
    beforePatch: { status: "active", multiRegion: true, logFileValidation: true },
    afterPatch: null as unknown as Record<string, unknown>,
  },
  {
    resourceType: "Azure::Storage::Account",
    cloud: "azure",
    title: "Storage account HTTPS-only disabled",
    changeType: "modified",
    severity: "high",
    beforePatch: { httpsOnly: true, tlsVersion: "TLS1_2" },
    afterPatch: { httpsOnly: false, tlsVersion: "TLS1_0" },
  },
  {
    resourceType: "Azure::Compute::VirtualMachine",
    cloud: "azure",
    title: "New unmanaged VM without disk encryption created",
    changeType: "created",
    severity: "high",
    beforePatch: null as unknown as Record<string, unknown>,
    afterPatch: { diskEncryption: false, managedIdentity: false, vmSize: "Standard_D4s_v3" },
  },
  {
    resourceType: "GCP::Storage::Bucket",
    cloud: "gcp",
    title: "GCS bucket made publicly accessible",
    changeType: "modified",
    severity: "critical",
    beforePatch: { iamPolicy: [{ role: "roles/storage.objectViewer", members: ["allUsers"] }], publicAccess: false },
    afterPatch: { iamPolicy: [{ role: "roles/storage.objectViewer", members: ["allUsers"] }], publicAccess: true },
  },
  {
    resourceType: "GCP::IAM::ServiceAccount",
    cloud: "gcp",
    title: "Service account key rotation skipped >90 days",
    changeType: "modified",
    severity: "medium",
    beforePatch: { keyLastRotated: "2025-11-01T00:00:00Z", keyAgeDays: 45 },
    afterPatch: { keyLastRotated: "2025-11-01T00:00:00Z", keyAgeDays: 95 },
  },
  {
    resourceType: "AWS::RDS::DBInstance",
    cloud: "aws",
    title: "RDS instance encryption at rest disabled",
    changeType: "modified",
    severity: "high",
    beforePatch: { storageEncrypted: true, kmsKeyId: "arn:aws:kms:us-east-1:123456789012:key/abc123" },
    afterPatch: { storageEncrypted: false, kmsKeyId: null },
  },
  {
    resourceType: "Azure::KeyVault::Vault",
    cloud: "azure",
    title: "Key Vault soft-delete disabled",
    changeType: "modified",
    severity: "medium",
    beforePatch: { softDeleteEnabled: true, purgeProtection: true },
    afterPatch: { softDeleteEnabled: false, purgeProtection: false },
  },
  {
    resourceType: "GCP::Logging::Sink",
    cloud: "gcp",
    title: "Audit log sink deleted",
    changeType: "deleted",
    severity: "high",
    beforePatch: { destination: "storage.googleapis.com/acme-audit-logs", filter: "logName:activity" },
    afterPatch: null as unknown as Record<string, unknown>,
  },
  {
    resourceType: "AWS::Lambda::Function",
    cloud: "aws",
    title: "Lambda function with wildcard IAM permissions created",
    changeType: "created",
    severity: "medium",
    beforePatch: null as unknown as Record<string, unknown>,
    afterPatch: { functionName: "acme-data-processor-v2", iamRole: "arn:aws:iam::123456789012:role/LambdaFullAccess" },
  },
];

export function generateDrift(findings: Finding[]): DriftEvent[] {
  return DRIFT_TEMPLATES.map((template, idx) => {
    const seed = sha256(`drift-${idx}-${template.title}`);
    const hoursBack = 24 + (parseInt(seed.slice(0, 4), 16) % (30 * 24));

    // Find a matching finding for the resourceId if possible
    const matchingFinding = findings.find(
      (f) =>
        f.resourceType === template.resourceType ||
        cloudOf(f.resourceId) === template.cloud
    );

    const resourceId =
      matchingFinding?.resourceId ||
      (template.cloud === "aws"
        ? `arn:aws:${template.resourceType.split("::")[1].toLowerCase()}:us-east-1:123456789012:resource-${idx}`
        : template.cloud === "azure"
        ? `/subscriptions/sub-acme-001/resourceGroups/rg-prod/providers/${template.resourceType.replace("::", "/")}/resource-${idx}`
        : `projects/acme-bank-prod/global/${template.resourceType.split("::")[2].toLowerCase()}/resource-${idx}`);

    return {
      id: `d-${idx + 1}`,
      tenantId: TENANT_ID,
      integrationId: INTEGRATION_IDS[template.cloud] || INTEGRATION_IDS.aws,
      changeType: template.changeType,
      resourceType: template.resourceType,
      resourceId,
      severity: template.severity,
      acknowledged: parseInt(seed.slice(4, 6), 16) % 3 === 0, // ~33% acknowledged
      detectedAt: deterministicDate(seed + "det", hoursBack),
      diff: {
        before: template.beforePatch,
        after: template.afterPatch,
      },
      recommendedAction: REMEDIATION_ACTIONS[template.changeType],
    };
  });
}
