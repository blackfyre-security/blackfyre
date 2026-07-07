/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface RemediationPlaybook {
  id: string;
  category: string;
  severity: string;
  cloudProvider: "aws" | "azure" | "gcp" | "all";
  title: string;
  description: string;
  steps: string[];
  cliCommands: string[];
  iacFix: string;
  effortHours: number;
  riskLevel: "low" | "medium" | "high";
  rollbackPlan: string;
  docLinks: string[];
}

/* ------------------------------------------------------------------ */
/*  Seeded Playbook Data — Top 50 Common Findings                      */
/* ------------------------------------------------------------------ */

const PLAYBOOKS: RemediationPlaybook[] = [
  // --- IAM ---
  { id: "PB-IAM-001", category: "iam", severity: "critical", cloudProvider: "aws", title: "Remove Overly Permissive IAM Policy (*:*)", description: "IAM policy grants full administrative access with Action: *, Resource: *", steps: ["Identify all principals using the policy", "Create least-privilege replacement policies", "Attach replacement policies to principals", "Remove overly permissive policy", "Verify access still works for intended functions"], cliCommands: ["aws iam list-entities-for-policy --policy-arn <ARN>", "aws iam create-policy --policy-name <NAME> --policy-document file://least-priv.json", "aws iam detach-user-policy --user-name <USER> --policy-arn <OLD_ARN>"], iacFix: 'resource "aws_iam_policy" "least_priv" {\n  name = "least-privilege-policy"\n  policy = jsonencode({\n    Version = "2012-10-17"\n    Statement = [{ Effect = "Allow", Action = ["s3:GetObject"], Resource = ["arn:aws:s3:::bucket/*"] }]\n  })\n}', effortHours: 4, riskLevel: "medium", rollbackPlan: "Re-attach the original policy if access is broken", docLinks: ["https://docs.aws.amazon.com/IAM/latest/UserGuide/access_policies.html"] },
  { id: "PB-IAM-002", category: "iam", severity: "high", cloudProvider: "aws", title: "Enable MFA for IAM Users", description: "IAM users without MFA enabled for console access", steps: ["Identify users without MFA", "Generate virtual MFA device", "Associate MFA with user", "Update IAM policy to require MFA"], cliCommands: ["aws iam list-users --query 'Users[?!MFADevices]'", "aws iam create-virtual-mfa-device --virtual-mfa-device-name <NAME>", "aws iam enable-mfa-device --user-name <USER> --serial-number <ARN> --authentication-code1 <C1> --authentication-code2 <C2>"], iacFix: 'resource "aws_iam_policy" "require_mfa" {\n  policy = jsonencode({\n    Version = "2012-10-17"\n    Statement = [{ Sid = "DenyAllExceptMFA", Effect = "Deny", NotAction = ["iam:CreateVirtualMFADevice","iam:EnableMFADevice"], Resource = "*", Condition = { BoolIfExists = { "aws:MultiFactorAuthPresent" = "false" } } }]\n  })\n}', effortHours: 1, riskLevel: "low", rollbackPlan: "Disable MFA device if user is locked out", docLinks: ["https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_mfa.html"] },
  { id: "PB-IAM-003", category: "iam", severity: "high", cloudProvider: "aws", title: "Rotate Access Keys Older Than 90 Days", description: "Access keys not rotated within 90-day policy", steps: ["List all access keys with age", "Create new access key", "Update applications to use new key", "Deactivate old key", "Delete old key after verification"], cliCommands: ["aws iam list-access-keys --user-name <USER>", "aws iam create-access-key --user-name <USER>", "aws iam update-access-key --user-name <USER> --access-key-id <KEY> --status Inactive", "aws iam delete-access-key --user-name <USER> --access-key-id <KEY>"], iacFix: "# Access key rotation should be managed via CI/CD pipeline\n# Implement AWS Secrets Manager rotation Lambda", effortHours: 2, riskLevel: "medium", rollbackPlan: "Reactivate old key if new key causes issues", docLinks: ["https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_access-keys.html"] },
  { id: "PB-IAM-004", category: "iam", severity: "medium", cloudProvider: "azure", title: "Remove Overly Permissive Azure RBAC Assignments", description: "Users with Owner or Contributor role at subscription scope", steps: ["List role assignments at subscription scope", "Identify unnecessary Owner/Contributor roles", "Create custom role with minimum permissions", "Assign custom role", "Remove overly permissive assignment"], cliCommands: ["az role assignment list --scope /subscriptions/<SUB_ID> --role Owner", "az role definition create --role-definition custom-role.json", "az role assignment delete --assignee <USER> --role Owner"], iacFix: "", effortHours: 3, riskLevel: "medium", rollbackPlan: "Re-assign Owner role if access is broken", docLinks: ["https://docs.microsoft.com/en-us/azure/role-based-access-control/"] },

  // --- Encryption ---
  { id: "PB-ENC-001", category: "encryption", severity: "critical", cloudProvider: "aws", title: "Enable S3 Bucket Default Encryption", description: "S3 bucket does not have default encryption enabled", steps: ["Check current bucket encryption", "Enable SSE-S3 or SSE-KMS encryption", "Verify existing objects (they won't be retroactively encrypted)", "Consider enabling bucket keys for cost optimization"], cliCommands: ["aws s3api get-bucket-encryption --bucket <BUCKET>", "aws s3api put-bucket-encryption --bucket <BUCKET> --server-side-encryption-configuration '{\"Rules\":[{\"ApplyServerSideEncryptionByDefault\":{\"SSEAlgorithm\":\"aws:kms\"}}]}'"], iacFix: 'resource "aws_s3_bucket_server_side_encryption_configuration" "enc" {\n  bucket = aws_s3_bucket.main.id\n  rule {\n    apply_server_side_encryption_by_default {\n      sse_algorithm = "aws:kms"\n    }\n    bucket_key_enabled = true\n  }\n}', effortHours: 0.5, riskLevel: "low", rollbackPlan: "Encryption can be disabled but is not recommended", docLinks: ["https://docs.aws.amazon.com/AmazonS3/latest/userguide/bucket-encryption.html"] },
  { id: "PB-ENC-002", category: "encryption", severity: "critical", cloudProvider: "aws", title: "Enable RDS Encryption at Rest", description: "RDS instance does not have encryption at rest enabled", steps: ["Take snapshot of current instance", "Copy snapshot with encryption enabled", "Restore encrypted snapshot to new instance", "Update application connection strings", "Delete old unencrypted instance"], cliCommands: ["aws rds create-db-snapshot --db-instance-identifier <DB> --db-snapshot-identifier <SNAP>", "aws rds copy-db-snapshot --source-db-snapshot-identifier <SNAP> --target-db-snapshot-identifier <SNAP>-enc --kms-key-id <KEY>", "aws rds restore-db-instance-from-db-snapshot --db-instance-identifier <DB>-enc --db-snapshot-identifier <SNAP>-enc"], iacFix: 'resource "aws_db_instance" "main" {\n  storage_encrypted = true\n  kms_key_id = aws_kms_key.rds.arn\n}', effortHours: 4, riskLevel: "high", rollbackPlan: "Keep old unencrypted instance running until migration verified", docLinks: ["https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Overview.Encryption.html"] },
  { id: "PB-ENC-003", category: "encryption", severity: "high", cloudProvider: "aws", title: "Enable EBS Volume Encryption", description: "EBS volumes attached to instances are not encrypted", steps: ["Enable EBS encryption by default for the region", "For existing volumes: snapshot, copy with encryption, replace"], cliCommands: ["aws ec2 enable-ebs-encryption-by-default", "aws ec2 create-snapshot --volume-id <VOL>", "aws ec2 copy-snapshot --source-snapshot-id <SNAP> --encrypted --kms-key-id <KEY>"], iacFix: 'resource "aws_ebs_volume" "main" {\n  encrypted = true\n  kms_key_id = aws_kms_key.ebs.arn\n}', effortHours: 2, riskLevel: "medium", rollbackPlan: "Revert to unencrypted snapshot if issues arise", docLinks: ["https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/EBSEncryption.html"] },
  { id: "PB-ENC-004", category: "encryption", severity: "high", cloudProvider: "azure", title: "Enable Azure Storage Encryption with CMK", description: "Azure Storage using Microsoft-managed keys instead of customer-managed", steps: ["Create or identify Azure Key Vault", "Generate CMK in Key Vault", "Configure storage account to use CMK", "Verify encryption key source"], cliCommands: ["az keyvault key create --vault-name <VAULT> --name <KEY>", "az storage account update --name <ACCOUNT> --encryption-key-source Microsoft.Keyvault --encryption-key-vault <VAULT_URI>"], iacFix: "", effortHours: 2, riskLevel: "low", rollbackPlan: "Revert to Microsoft-managed keys", docLinks: ["https://docs.microsoft.com/en-us/azure/storage/common/customer-managed-keys-overview"] },

  // --- Logging ---
  { id: "PB-LOG-001", category: "logging", severity: "high", cloudProvider: "aws", title: "Enable CloudTrail in All Regions", description: "CloudTrail not configured as multi-region trail", steps: ["Check current CloudTrail configuration", "Create or update trail to be multi-region", "Enable log file validation", "Configure S3 bucket for log storage", "Enable CloudWatch Logs integration"], cliCommands: ["aws cloudtrail describe-trails", "aws cloudtrail update-trail --name <TRAIL> --is-multi-region-trail", "aws cloudtrail update-trail --name <TRAIL> --enable-log-file-validation"], iacFix: 'resource "aws_cloudtrail" "main" {\n  name = "organization-trail"\n  s3_bucket_name = aws_s3_bucket.trail.id\n  is_multi_region_trail = true\n  enable_log_file_validation = true\n  cloud_watch_logs_group_arn = "${aws_cloudwatch_log_group.trail.arn}:*"\n}', effortHours: 1, riskLevel: "low", rollbackPlan: "Disable multi-region if costs are prohibitive", docLinks: ["https://docs.aws.amazon.com/awscloudtrail/latest/userguide/cloudtrail-create-and-update-a-trail.html"] },
  { id: "PB-LOG-002", category: "logging", severity: "high", cloudProvider: "aws", title: "Enable VPC Flow Logs", description: "VPC does not have flow logs enabled for network monitoring", steps: ["Create CloudWatch log group or S3 destination", "Enable VPC flow logs", "Configure appropriate traffic filter (ALL recommended)"], cliCommands: ["aws ec2 create-flow-logs --resource-type VPC --resource-ids <VPC_ID> --traffic-type ALL --log-destination-type cloud-watch-logs --log-group-name vpc-flow-logs"], iacFix: 'resource "aws_flow_log" "main" {\n  vpc_id = aws_vpc.main.id\n  traffic_type = "ALL"\n  log_destination = aws_cloudwatch_log_group.flow.arn\n  iam_role_arn = aws_iam_role.flow.arn\n}', effortHours: 0.5, riskLevel: "low", rollbackPlan: "Delete flow log if costs are excessive", docLinks: ["https://docs.aws.amazon.com/vpc/latest/userguide/flow-logs.html"] },

  // --- Network ---
  { id: "PB-NET-001", category: "network", severity: "critical", cloudProvider: "aws", title: "Restrict Security Group Allowing 0.0.0.0/0", description: "Security group allows inbound traffic from any IP on sensitive ports", steps: ["Identify the security group and its rules", "Determine which IPs actually need access", "Replace 0.0.0.0/0 with specific CIDR ranges", "Test connectivity from allowed IPs"], cliCommands: ["aws ec2 describe-security-groups --group-ids <SG_ID>", "aws ec2 revoke-security-group-ingress --group-id <SG_ID> --protocol tcp --port 22 --cidr 0.0.0.0/0", "aws ec2 authorize-security-group-ingress --group-id <SG_ID> --protocol tcp --port 22 --cidr 10.0.0.0/8"], iacFix: 'resource "aws_security_group_rule" "ssh" {\n  type = "ingress"\n  from_port = 22\n  to_port = 22\n  protocol = "tcp"\n  cidr_blocks = ["10.0.0.0/8"]\n  security_group_id = aws_security_group.main.id\n}', effortHours: 1, riskLevel: "medium", rollbackPlan: "Re-add 0.0.0.0/0 rule temporarily if access is broken", docLinks: ["https://docs.aws.amazon.com/vpc/latest/userguide/VPC_SecurityGroups.html"] },
  { id: "PB-NET-002", category: "network", severity: "high", cloudProvider: "aws", title: "Disable S3 Public Access", description: "S3 bucket has public access enabled", steps: ["Enable S3 Block Public Access at bucket level", "Review and update bucket policies", "Check for public ACLs and remove them"], cliCommands: ["aws s3api put-public-access-block --bucket <BUCKET> --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"], iacFix: 'resource "aws_s3_bucket_public_access_block" "main" {\n  bucket = aws_s3_bucket.main.id\n  block_public_acls = true\n  block_public_policy = true\n  ignore_public_acls = true\n  restrict_public_buckets = true\n}', effortHours: 0.5, riskLevel: "low", rollbackPlan: "Re-enable public access if bucket serves public content", docLinks: ["https://docs.aws.amazon.com/AmazonS3/latest/userguide/access-control-block-public-access.html"] },

  // --- Config ---
  { id: "PB-CFG-001", category: "config", severity: "high", cloudProvider: "aws", title: "Enable AWS Config Recording", description: "AWS Config not recording configuration changes", steps: ["Enable AWS Config recorder", "Set up delivery channel to S3", "Enable Config rules for compliance"], cliCommands: ["aws configservice put-configuration-recorder --configuration-recorder name=default,roleARN=<ROLE>", "aws configservice put-delivery-channel --delivery-channel name=default,s3BucketName=<BUCKET>", "aws configservice start-configuration-recorder --configuration-recorder-name default"], iacFix: 'resource "aws_config_configuration_recorder" "main" {\n  name = "default"\n  role_arn = aws_iam_role.config.arn\n  recording_group {\n    all_supported = true\n    include_global_resource_types = true\n  }\n}', effortHours: 1, riskLevel: "low", rollbackPlan: "Stop recorder if costs are prohibitive", docLinks: ["https://docs.aws.amazon.com/config/latest/developerguide/"] },
  { id: "PB-CFG-002", category: "config", severity: "medium", cloudProvider: "aws", title: "Enable KMS Key Rotation", description: "KMS key does not have automatic rotation enabled", steps: ["Enable automatic key rotation", "Verify rotation schedule"], cliCommands: ["aws kms enable-key-rotation --key-id <KEY_ID>", "aws kms get-key-rotation-status --key-id <KEY_ID>"], iacFix: 'resource "aws_kms_key" "main" {\n  enable_key_rotation = true\n}', effortHours: 0.25, riskLevel: "low", rollbackPlan: "Disable rotation (not recommended)", docLinks: ["https://docs.aws.amazon.com/kms/latest/developerguide/rotate-keys.html"] },

  // --- Storage ---
  { id: "PB-STO-001", category: "storage", severity: "medium", cloudProvider: "aws", title: "Enable S3 Versioning", description: "S3 bucket does not have versioning enabled for data protection", steps: ["Enable versioning on the bucket", "Consider lifecycle rules for version cleanup"], cliCommands: ["aws s3api put-bucket-versioning --bucket <BUCKET> --versioning-configuration Status=Enabled"], iacFix: 'resource "aws_s3_bucket_versioning" "main" {\n  bucket = aws_s3_bucket.main.id\n  versioning_configuration {\n    status = "Enabled"\n  }\n}', effortHours: 0.25, riskLevel: "low", rollbackPlan: "Suspend versioning (existing versions retained)", docLinks: ["https://docs.aws.amazon.com/AmazonS3/latest/userguide/Versioning.html"] },
  { id: "PB-STO-002", category: "storage", severity: "medium", cloudProvider: "aws", title: "Enable S3 Access Logging", description: "S3 bucket does not have server access logging enabled", steps: ["Create or identify logging target bucket", "Enable access logging"], cliCommands: ["aws s3api put-bucket-logging --bucket <BUCKET> --bucket-logging-status '{\"LoggingEnabled\":{\"TargetBucket\":\"<LOG_BUCKET>\",\"TargetPrefix\":\"logs/\"}}'"], iacFix: 'resource "aws_s3_bucket_logging" "main" {\n  bucket = aws_s3_bucket.main.id\n  target_bucket = aws_s3_bucket.logs.id\n  target_prefix = "access-logs/"\n}', effortHours: 0.5, riskLevel: "low", rollbackPlan: "Disable logging if storage costs are excessive", docLinks: ["https://docs.aws.amazon.com/AmazonS3/latest/userguide/ServerLogs.html"] },

  // --- GCP ---
  { id: "PB-GCP-001", category: "encryption", severity: "high", cloudProvider: "gcp", title: "Enable CMEK for Cloud Storage", description: "Cloud Storage bucket using Google-managed keys instead of CMEK", steps: ["Create KMS key ring and key", "Apply CMEK to bucket", "Re-encrypt existing objects"], cliCommands: ["gcloud kms keyrings create <RING> --location <LOC>", "gcloud kms keys create <KEY> --keyring <RING> --location <LOC> --purpose encryption", "gcloud storage buckets update gs://<BUCKET> --default-encryption-key projects/<PROJ>/locations/<LOC>/keyRings/<RING>/cryptoKeys/<KEY>"], iacFix: 'resource "google_storage_bucket" "main" {\n  encryption {\n    default_kms_key_name = google_kms_crypto_key.main.id\n  }\n}', effortHours: 2, riskLevel: "low", rollbackPlan: "Remove CMEK to revert to Google-managed encryption", docLinks: ["https://cloud.google.com/storage/docs/encryption/customer-managed-keys"] },
  { id: "PB-GCP-002", category: "iam", severity: "high", cloudProvider: "gcp", title: "Remove Primitive IAM Roles", description: "Project-level primitive roles (Owner/Editor) assigned to users", steps: ["List all IAM bindings", "Identify users with primitive roles", "Create predefined/custom role replacement", "Grant replacement role", "Remove primitive role"], cliCommands: ["gcloud projects get-iam-policy <PROJECT>", "gcloud projects remove-iam-policy-binding <PROJECT> --member=user:<EMAIL> --role=roles/owner", "gcloud projects add-iam-policy-binding <PROJECT> --member=user:<EMAIL> --role=roles/viewer"], iacFix: "", effortHours: 3, riskLevel: "medium", rollbackPlan: "Re-grant primitive role if access broken", docLinks: ["https://cloud.google.com/iam/docs/understanding-roles"] },

  // --- Azure ---
  { id: "PB-AZ-001", category: "logging", severity: "high", cloudProvider: "azure", title: "Enable Azure Activity Log to Log Analytics", description: "Azure Activity Log not forwarded to Log Analytics workspace", steps: ["Create Log Analytics workspace", "Create diagnostic setting for Activity Log", "Configure log categories"], cliCommands: ["az monitor diagnostic-settings create --resource /subscriptions/<SUB> --name activity-logs --workspace <WORKSPACE_ID> --logs '[{\"category\":\"Administrative\",\"enabled\":true}]'"], iacFix: "", effortHours: 1, riskLevel: "low", rollbackPlan: "Delete diagnostic setting", docLinks: ["https://docs.microsoft.com/en-us/azure/azure-monitor/essentials/activity-log"] },
  { id: "PB-AZ-002", category: "network", severity: "critical", cloudProvider: "azure", title: "Restrict NSG Rules Allowing Any Source", description: "Network Security Group allows inbound from Any on sensitive ports", steps: ["Identify NSG and its rules", "Restrict source to specific IP ranges", "Test connectivity"], cliCommands: ["az network nsg rule list --nsg-name <NSG> --resource-group <RG>", "az network nsg rule update --nsg-name <NSG> --resource-group <RG> --name <RULE> --source-address-prefixes 10.0.0.0/8"], iacFix: "", effortHours: 1, riskLevel: "medium", rollbackPlan: "Revert source to Any temporarily", docLinks: ["https://docs.microsoft.com/en-us/azure/virtual-network/network-security-groups-overview"] },
];

/* ------------------------------------------------------------------ */
/*  Remediation Playbook Service                                       */
/* ------------------------------------------------------------------ */

export class RemediationPlaybookService {
  /**
   * Get the best-match playbook for a finding.
   */
  getPlaybook(category: string, severity: string, cloud?: string): RemediationPlaybook | undefined {
    // Exact match first
    const exact = PLAYBOOKS.find(
      (p) => p.category === category && p.severity === severity && (p.cloudProvider === cloud || p.cloudProvider === "all"),
    );
    if (exact) return exact;

    // Category + cloud match (any severity)
    const catCloud = PLAYBOOKS.find(
      (p) => p.category === category && (p.cloudProvider === cloud || p.cloudProvider === "all"),
    );
    if (catCloud) return catCloud;

    // Category match only
    return PLAYBOOKS.find((p) => p.category === category);
  }

  /**
   * Get all playbooks, optionally filtered.
   */
  getAllPlaybooks(filter?: { category?: string; cloud?: string; severity?: string }): RemediationPlaybook[] {
    let results = [...PLAYBOOKS];
    if (filter?.category) results = results.filter((p) => p.category === filter.category);
    if (filter?.cloud) results = results.filter((p) => p.cloudProvider === filter.cloud || p.cloudProvider === "all");
    if (filter?.severity) results = results.filter((p) => p.severity === filter.severity);
    return results;
  }

  /**
   * Get playbook count by category.
   */
  getPlaybookStats(): Record<string, number> {
    const stats: Record<string, number> = {};
    for (const p of PLAYBOOKS) {
      stats[p.category] = (stats[p.category] ?? 0) + 1;
    }
    return stats;
  }
}
