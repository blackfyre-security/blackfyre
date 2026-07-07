/**
 * remediation-generator.ts
 * Generates per-finding remediations with realistic cloud CLI playbooks.
 * Only generates for findings with status "open" or "in_progress".
 */

import { createHash } from "crypto";
import type { Finding } from "./evidence-generator.js";

export interface RiskAssessment {
  blastRadius: "low" | "medium" | "high";
  reversible: boolean;
}

export interface RemediationRecord {
  id: string;
  findingId: string;
  tier: "auto" | "approval" | "manual";
  status: "pending" | "approved" | "executing" | "completed" | "failed" | "rolled_back";
  playbookContent: string;
  estimatedMinutes: number;
  riskAssessment: RiskAssessment;
  approvers: string[];
  executedAt: string | null;
  completedAt: string | null;
  rollbackContent: string | null;
}

function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

function findingId(f: Finding, idx: number): string {
  return f.id || `f-${sha256(f.resourceId + f.title).slice(0, 8)}-${idx}`;
}

function deterministicDate(seed: string, hoursBack: number): string {
  const h = parseInt(sha256(seed).slice(0, 6), 16);
  const offset = h % (hoursBack * 60 * 60 * 1000);
  return new Date(Date.now() - offset).toISOString();
}

const APPROVERS = [
  ["cloud-sec-team@acme-bank.com"],
  ["cloud-sec-team@acme-bank.com", "cto@acme-bank.com"],
  ["sre-lead@acme-bank.com", "cloud-sec-team@acme-bank.com"],
  ["ciso@acme-bank.com", "cloud-sec-team@acme-bank.com"],
];

// Playbook templates keyed by (cloud, category)
function buildPlaybook(finding: Finding): { playbook: string; rollback: string | null; estimatedMinutes: number; riskAssessment: RiskAssessment } {
  const r = finding.resourceId;
  const cloud = r.startsWith("arn:aws") ? "aws" : r.startsWith("/subscriptions") ? "azure" : "gcp";

  if (cloud === "aws") {
    switch (finding.category) {
      case "iam":
        if (finding.title.includes("MFA")) {
          return {
            playbook: `# Enforce MFA for IAM User\n# Finding: ${finding.title}\n\nUSER_ARN="${r}"\nUSER_NAME=$(echo "$USER_ARN" | awk -F/ '{print $NF}')\n\n# Step 1: Verify current MFA status\naws iam list-mfa-devices --user-name "$USER_NAME"\n\n# Step 2: Create a virtual MFA device\naws iam create-virtual-mfa-device \\\n  --virtual-mfa-device-name "$USER_NAME-mfa" \\\n  --outfile /tmp/mfa-qr-$USER_NAME.png \\\n  --bootstrap-method QRCodePNG\n\n# Step 3: Enable MFA on the user (requires out-of-band OTP tokens)\n# aws iam enable-mfa-device --user-name "$USER_NAME" \\\n#   --serial-number arn:aws:iam::123456789012:mfa/$USER_NAME-mfa \\\n#   --authentication-code1 <code1> --authentication-code2 <code2>\n\n# Step 4: Add a deny policy for non-MFA sessions\naws iam put-user-policy \\\n  --user-name "$USER_NAME" \\\n  --policy-name DenyWithoutMFA \\\n  --policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Deny","Action":"*","Resource":"*","Condition":{"BoolIfExists":{"aws:MultiFactorAuthPresent":"false"}}}]}'\n\necho "MFA enforcement policy applied. Coordinate with user $USER_NAME to register device."`,
            rollback: `# Rollback: Remove MFA deny policy\nUSER_NAME=$(echo "${r}" | awk -F/ '{print $NF}')\naws iam delete-user-policy --user-name "$USER_NAME" --policy-name DenyWithoutMFA`,
            estimatedMinutes: 30,
            riskAssessment: { blastRadius: "medium", reversible: true },
          };
        }
        if (finding.title.includes("access key") || finding.title.includes("key")) {
          return {
            playbook: `# Rotate/Deactivate Stale IAM Access Key\n# Finding: ${finding.title}\n\nKEY_ID=$(aws iam list-access-keys --user-name "$(echo '${r}' | awk -F/ '{print $NF}')" \\\n  --query 'AccessKeyMetadata[?Status==\`Active\`].AccessKeyId' --output text | head -1)\nUSER=$(echo "${r}" | awk -F/ '{print $NF}')\n\n# Step 1: Deactivate old key\naws iam update-access-key --access-key-id "$KEY_ID" --status Inactive --user-name "$USER"\n\n# Step 2: Create a new key\naws iam create-access-key --user-name "$USER" > /tmp/new-key-$USER.json\necho "New key created. Rotate application credentials within 24h."\n\n# Step 3: After rotation confirmed, delete old key\n# aws iam delete-access-key --access-key-id "$KEY_ID" --user-name "$USER"`,
            rollback: `# Rollback: Reactivate old key\naws iam update-access-key --access-key-id "$KEY_ID" --status Active --user-name "$USER"`,
            estimatedMinutes: 60,
            riskAssessment: { blastRadius: "high", reversible: true },
          };
        }
        return {
          playbook: `# Remediate IAM Finding\n# Finding: ${finding.title}\n# Resource: ${r}\n\n# Step 1: Review current IAM policy\naws iam get-user --user-name "$(echo '${r}' | awk -F/ '{print $NF}')"\n\n# Step 2: Apply principle of least privilege\n# Review and remove unnecessary permissions manually via IAM console\n# or use AWS Access Analyzer to generate a scoped-down policy.`,
          rollback: null,
          estimatedMinutes: 45,
          riskAssessment: { blastRadius: "medium", reversible: true },
        };

      case "encryption":
        return {
          playbook: `# Enable Encryption at Rest\n# Finding: ${finding.title}\n# Resource: ${r}\n\n# For S3 Bucket:\nBUCKET_NAME=$(echo "${r}" | awk -F: '{print $NF}')\naws s3api put-bucket-encryption \\\n  --bucket "$BUCKET_NAME" \\\n  --server-side-encryption-configuration '{\n    "Rules": [{\n      "ApplyServerSideEncryptionByDefault": {\n        "SSEAlgorithm": "aws:kms",\n        "KMSMasterKeyID": "arn:aws:kms:us-east-1:123456789012:key/mrk-default"\n      },\n      "BucketKeyEnabled": true\n    }]\n  }'\n\n# For RDS (requires snapshot + restore):\n# INSTANCE_ID=$(echo "${r}" | awk -F: '{print $NF}')\n# aws rds create-db-snapshot --db-instance-identifier "$INSTANCE_ID" --db-snapshot-identifier "$INSTANCE_ID-pre-encrypt"\n# # Then restore from snapshot with encryption enabled\necho "Encryption enabled."`,
          rollback: `# Rollback: Revert to SSE-S3 (not recommended for production)\nBUCKET_NAME=$(echo "${r}" | awk -F: '{print $NF}')\naws s3api put-bucket-encryption --bucket "$BUCKET_NAME" \\\n  --server-side-encryption-configuration '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'`,
          estimatedMinutes: 20,
          riskAssessment: { blastRadius: "low", reversible: true },
        };

      case "logging":
        return {
          playbook: `# Enable Logging / Audit Trail\n# Finding: ${finding.title}\n# Resource: ${r}\n\n# Enable CloudTrail if missing\naws cloudtrail create-trail \\\n  --name acme-bank-audit-trail \\\n  --s3-bucket-name acme-bank-cloudtrail-logs \\\n  --include-global-service-events \\\n  --is-multi-region-trail \\\n  --enable-log-file-validation\naws cloudtrail start-logging --name acme-bank-audit-trail\n\n# Enable S3 access logging\nBUCKET=$(echo "${r}" | awk -F: '{print $NF}')\naws s3api put-bucket-logging \\\n  --bucket "$BUCKET" \\\n  --bucket-logging-status '{"LoggingEnabled":{"TargetBucket":"acme-bank-access-logs","TargetPrefix":"$BUCKET/"}}'`,
          rollback: `# Rollback: Stop CloudTrail (use only in emergency)\naws cloudtrail stop-logging --name acme-bank-audit-trail`,
          estimatedMinutes: 15,
          riskAssessment: { blastRadius: "low", reversible: true },
        };

      case "network":
        return {
          playbook: `# Restrict Network Access\n# Finding: ${finding.title}\n# Resource: ${r}\n\n# Remove overly permissive security group rules\nSG_ID=$(echo "${r}" | awk -F/ '{print $NF}')\n\n# Revoke inbound SSH from 0.0.0.0/0\naws ec2 revoke-security-group-ingress \\\n  --group-id "$SG_ID" \\\n  --protocol tcp --port 22 --cidr 0.0.0.0/0\n\n# Revoke inbound RDP from 0.0.0.0/0\naws ec2 revoke-security-group-ingress \\\n  --group-id "$SG_ID" \\\n  --protocol tcp --port 3389 --cidr 0.0.0.0/0\n\n# Add restricted SSH from corporate CIDR\naws ec2 authorize-security-group-ingress \\\n  --group-id "$SG_ID" \\\n  --protocol tcp --port 22 --cidr 10.0.0.0/8\n\necho "Security group rules tightened."`,
          rollback: `# Rollback: Restore previous rules\nSG_ID=$(echo "${r}" | awk -F/ '{print $NF}')\naws ec2 authorize-security-group-ingress --group-id "$SG_ID" --protocol tcp --port 22 --cidr 0.0.0.0/0`,
          estimatedMinutes: 10,
          riskAssessment: { blastRadius: "medium", reversible: true },
        };

      case "config":
        return {
          playbook: `# Fix Misconfiguration\n# Finding: ${finding.title}\n# Resource: ${r}\n\n# Block S3 public access\nBUCKET=$(echo "${r}" | awk -F: '{print $NF}')\naws s3api put-public-access-block \\\n  --bucket "$BUCKET" \\\n  --public-access-block-configuration \\\n    "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"\n\n# Verify\naws s3api get-public-access-block --bucket "$BUCKET"\necho "Public access blocked."`,
          rollback: `# Rollback: Re-enable public access (not recommended)\nBUCKET=$(echo "${r}" | awk -F: '{print $NF}')\naws s3api put-public-access-block --bucket "$BUCKET" --public-access-block-configuration "BlockPublicAcls=false,IgnorePublicAcls=false,BlockPublicPolicy=false,RestrictPublicBuckets=false"`,
          estimatedMinutes: 5,
          riskAssessment: { blastRadius: "low", reversible: true },
        };

      default:
        return {
          playbook: `# Remediate AWS Finding\n# Finding: ${finding.title}\n# Resource: ${r}\n# Refer to AWS Security Hub for detailed remediation steps.\necho "Manual remediation required."`,
          rollback: null,
          estimatedMinutes: 60,
          riskAssessment: { blastRadius: "medium", reversible: false },
        };
    }
  }

  if (cloud === "azure") {
    switch (finding.category) {
      case "iam":
        return {
          playbook: `# Azure IAM Remediation\n# Finding: ${finding.title}\n\n# Enable MFA for Azure AD user\naz rest --method POST \\\n  --url 'https://graph.microsoft.com/v1.0/reports/authenticationMethods/usersRegisteredByFeature' \\\n  --headers 'Content-Type=application/json'\n\n# Conditional Access: Require MFA\naz ad conditional-access policy create \\\n  --display-name "Require MFA for All Users" \\\n  --state enabled \\\n  --conditions '{"users":{"includeUsers":["All"]},"applications":{"includeApplications":["All"]}}' \\\n  --grant-controls '{"operator":"OR","builtInControls":["mfa"]}'\n\necho "MFA Conditional Access policy applied."`,
          rollback: `# Rollback: Disable Conditional Access policy\naz ad conditional-access policy update --id <policy-id> --state disabled`,
          estimatedMinutes: 30,
          riskAssessment: { blastRadius: "medium", reversible: true },
        };

      case "encryption":
        return {
          playbook: `# Azure Encryption Remediation\n# Finding: ${finding.title}\n# Resource: ${r}\n\nSUBSCRIPTION="sub-acme-001"\nRG="rg-prod"\nACCOUNT_NAME=$(echo "${r}" | awk -F/ '{print $NF}')\n\n# Enable CMK encryption on Storage Account\nKEY_VAULT="acme-bank-keyvault"\nKEY_NAME="storage-cmk-key"\naz storage account update \\\n  --name "$ACCOUNT_NAME" \\\n  --resource-group "$RG" \\\n  --subscription "$SUBSCRIPTION" \\\n  --encryption-key-source Microsoft.Keyvault \\\n  --encryption-key-vault "https://$KEY_VAULT.vault.azure.net" \\\n  --encryption-key-name "$KEY_NAME" \\\n  --encryption-key-version latest\n\necho "CMK encryption enabled for $ACCOUNT_NAME"`,
          rollback: `# Rollback: Revert to Microsoft-managed keys\naz storage account update --name "$ACCOUNT_NAME" --resource-group rg-prod --encryption-key-source Microsoft.Storage`,
          estimatedMinutes: 20,
          riskAssessment: { blastRadius: "low", reversible: true },
        };

      case "logging":
        return {
          playbook: `# Azure Logging Remediation\n# Finding: ${finding.title}\n\nSUBSCRIPTION="sub-acme-001"\nRG="rg-prod"\n\n# Enable diagnostic settings on the resource\naz monitor diagnostic-settings create \\\n  --name "acme-bank-diagnostics" \\\n  --resource "${r}" \\\n  --logs '[{"category":"AuditEvent","enabled":true,"retentionPolicy":{"enabled":true,"days":90}}]' \\\n  --metrics '[{"category":"AllMetrics","enabled":true}]' \\\n  --workspace "/subscriptions/$SUBSCRIPTION/resourcegroups/$RG/providers/microsoft.operationalinsights/workspaces/acme-log-analytics"\n\necho "Diagnostic settings enabled."`,
          rollback: `# Rollback: Remove diagnostic settings\naz monitor diagnostic-settings delete --name "acme-bank-diagnostics" --resource "${r}"`,
          estimatedMinutes: 10,
          riskAssessment: { blastRadius: "low", reversible: true },
        };

      case "network":
        return {
          playbook: `# Azure Network Security Remediation\n# Finding: ${finding.title}\n\nNSG_NAME=$(echo "${r}" | awk -F/ '{print $NF}')\nRG="rg-prod"\n\n# Remove overly permissive rules\naz network nsg rule delete \\\n  --resource-group "$RG" \\\n  --nsg-name "$NSG_NAME" \\\n  --name AllowSSHFromInternet\n\n# Add restricted rule\naz network nsg rule create \\\n  --resource-group "$RG" \\\n  --nsg-name "$NSG_NAME" \\\n  --name AllowSSHFromCorp \\\n  --priority 100 \\\n  --source-address-prefixes 10.0.0.0/8 \\\n  --destination-port-ranges 22 \\\n  --protocol Tcp \\\n  --access Allow\n\necho "NSG rules updated."`,
          rollback: `# Rollback: Restore original NSG rule\naz network nsg rule delete --resource-group rg-prod --nsg-name "$NSG_NAME" --name AllowSSHFromCorp`,
          estimatedMinutes: 10,
          riskAssessment: { blastRadius: "medium", reversible: true },
        };

      default:
        return {
          playbook: `# Azure Configuration Remediation\n# Finding: ${finding.title}\n# Use Azure Policy or Security Center recommendations to remediate.\naz security assessment list --query "[?properties.status.code=='Unhealthy']"`,
          rollback: null,
          estimatedMinutes: 45,
          riskAssessment: { blastRadius: "medium", reversible: false },
        };
    }
  }

  // GCP
  switch (finding.category) {
    case "iam":
      return {
        playbook: `# GCP IAM Remediation\n# Finding: ${finding.title}\n\nPROJECT="acme-bank-prod"\nSA=$(echo "${r}" | awk -F/ '{print $NF}')\n\n# Remove overly broad IAM bindings\ngcloud projects get-iam-policy "$PROJECT" \\\n  --flatten="bindings[].members" \\\n  --format="table(bindings.role,bindings.members)" \\\n  --filter="bindings.members:$SA"\n\n# Remove editor/owner role from service account\ngcloud projects remove-iam-policy-binding "$PROJECT" \\\n  --member="serviceAccount:$SA" \\\n  --role="roles/editor"\n\n# Grant minimal required role instead\ngcloud projects add-iam-policy-binding "$PROJECT" \\\n  --member="serviceAccount:$SA" \\\n  --role="roles/storage.objectViewer"\n\necho "IAM policy updated for $SA"`,
        rollback: `# Rollback: Restore editor role\ngcloud projects add-iam-policy-binding acme-bank-prod --member="serviceAccount:$SA" --role="roles/editor"`,
        estimatedMinutes: 20,
        riskAssessment: { blastRadius: "medium", reversible: true },
      };

    case "encryption":
      return {
        playbook: `# GCP Encryption Remediation\n# Finding: ${finding.title}\n\nPROJECT="acme-bank-prod"\nBUCKET=$(echo "${r}" | awk -F/ '{print $NF}')\nKEY_RING="acme-keyring"\nKEY_NAME="storage-key"\nLOCATION="us-central1"\n\n# Create KMS key if not exists\ngcloud kms keyrings create "$KEY_RING" --location "$LOCATION" --project "$PROJECT" 2>/dev/null || true\ngcloud kms keys create "$KEY_NAME" \\\n  --keyring "$KEY_RING" --location "$LOCATION" \\\n  --purpose encryption --project "$PROJECT" 2>/dev/null || true\n\n# Apply CMEK to bucket\nKEY_RESOURCE="projects/$PROJECT/locations/$LOCATION/keyRings/$KEY_RING/cryptoKeys/$KEY_NAME"\ngsutil kms encryption -k "$KEY_RESOURCE" "gs://$BUCKET"\n\necho "CMEK encryption applied to gs://$BUCKET"`,
        rollback: `# Rollback: Remove CMEK (revert to Google-managed)\ngsutil kms encryption -d "gs://$BUCKET"`,
        estimatedMinutes: 20,
        riskAssessment: { blastRadius: "low", reversible: true },
      };

    case "logging":
      return {
        playbook: `# GCP Logging Remediation\n# Finding: ${finding.title}\n\nPROJECT="acme-bank-prod"\n\n# Enable audit logging for all services\ngcloud projects get-iam-policy "$PROJECT" > /tmp/current-policy.yaml\n\ncat >> /tmp/audit-patch.yaml << 'EOF'\nauditConfigs:\n- auditLogConfigs:\n  - logType: ADMIN_READ\n  - logType: DATA_READ\n  - logType: DATA_WRITE\n  service: allServices\nEOF\n\ngcloud projects set-iam-policy "$PROJECT" /tmp/audit-patch.yaml\n\n# Create a log sink to GCS\ngcloud logging sinks create acme-audit-sink \\\n  storage.googleapis.com/acme-bank-audit-logs \\\n  --log-filter='logName="projects/$PROJECT/logs/cloudaudit.googleapis.com%2Factivity"' \\\n  --project "$PROJECT"\n\necho "Audit logging enabled and sink created."`,
        rollback: `# Rollback: Remove log sink\ngcloud logging sinks delete acme-audit-sink --project acme-bank-prod`,
        estimatedMinutes: 15,
        riskAssessment: { blastRadius: "low", reversible: true },
      };

    case "network":
      return {
        playbook: `# GCP Network Security Remediation\n# Finding: ${finding.title}\n\nPROJECT="acme-bank-prod"\nNETWORK="acme-vpc"\n\n# Remove default allow-all firewall rules\ngcloud compute firewall-rules list \\\n  --project "$PROJECT" \\\n  --filter="network=$NETWORK AND allowed[].ports:22 AND sourceRanges:0.0.0.0/0" \\\n  --format="value(name)" | while read RULE; do\n  gcloud compute firewall-rules delete "$RULE" --project "$PROJECT" --quiet\ndone\n\n# Create IAP-based SSH rule\ngcloud compute firewall-rules create allow-ssh-iap \\\n  --project "$PROJECT" \\\n  --network "$NETWORK" \\\n  --allow tcp:22 \\\n  --source-ranges 35.235.240.0/20 \\\n  --description "Allow SSH via Cloud IAP only"\n\necho "Firewall rules updated."`,
        rollback: `# Rollback: Allow direct SSH (not recommended)\ngcloud compute firewall-rules create allow-ssh-direct --network acme-vpc --allow tcp:22 --source-ranges 0.0.0.0/0 --project acme-bank-prod`,
        estimatedMinutes: 10,
        riskAssessment: { blastRadius: "medium", reversible: true },
      };

    default:
      return {
        playbook: `# GCP Configuration Remediation\n# Finding: ${finding.title}\n# Use Security Command Center (SCC) recommendations.\ngcloud scc findings list organizations/123456789/sources/-\necho "Manual remediation required."`,
        rollback: null,
        estimatedMinutes: 45,
        riskAssessment: { blastRadius: "medium", reversible: false },
      };
  }
}

const STATUS_DISTRIBUTION: RemediationRecord["status"][] = [
  "pending", "pending", "pending", "pending", "pending",
  "pending", "pending", "pending", "pending", "pending", // 10 pending
  "approved", "approved", "approved",                      // 3 approved
  "executing", "executing", "executing",                   // 3 executing
  "completed", "completed", "completed", "completed", "completed", // 5 completed
  "failed", "failed",                                      // 2 failed
  "rolled_back",                                           // 1 rolled_back
];

export function generateRemediations(findings: Finding[]): RemediationRecord[] {
  const actionable = findings.filter(
    (f) => !f.status || f.status === "open" || f.status === "in_progress"
  );

  return actionable.map((finding, idx) => {
    const fid = findingId(finding, idx);
    const seed = sha256(fid + "remediation");
    const { playbook, rollback, estimatedMinutes, riskAssessment } = buildPlaybook(finding);

    const statusIdx = idx % STATUS_DISTRIBUTION.length;
    const status = STATUS_DISTRIBUTION[statusIdx];
    const approverIdx = parseInt(seed.slice(0, 2), 16) % APPROVERS.length;

    const isExecuted = ["executing", "completed", "failed", "rolled_back"].includes(status);
    const isCompleted = ["completed", "rolled_back"].includes(status);
    const executedAt = isExecuted ? deterministicDate(seed + "exec", 48) : null;
    const completedAt = isCompleted ? deterministicDate(seed + "done", 24) : null;

    return {
      id: `r-${seed.slice(0, 12)}`,
      findingId: fid,
      tier: (finding.remediationTier as RemediationRecord["tier"]) || "manual",
      status,
      playbookContent: playbook,
      estimatedMinutes,
      riskAssessment,
      approvers: APPROVERS[approverIdx],
      executedAt,
      completedAt,
      rollbackContent: rollback,
    };
  });
}
