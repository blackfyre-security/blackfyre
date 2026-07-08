// AUTO-GENERATED from the Blackfyre platform source (control-registry + scanner classes).
// Source of truth: platform/packages/api + workers/scanners. Do not fabricate entries.

export type AuditorCloud = "aws" | "azure" | "gcp" | "container" | "iac" | "multi" | "other";
export type AuditorCategory =
  | "compute"
  | "container"
  | "database"
  | "encryption"
  | "iam"
  | "logging"
  | "monitoring"
  | "networking"
  | "other"
  | "storage";

export interface Auditor {
  name: string;
  cloud: AuditorCloud;
  category: AuditorCategory;
  description?: string;
}

export const AUDITORS: readonly Auditor[] = [
  { name: "AWS IAM Auditor", cloud: "aws", category: "iam", description: "Audits IAM users, roles and policies via AWS SDK v3 (real resource enumeration)." },
  { name: "AWS S3 Auditor", cloud: "aws", category: "storage", description: "Checks S3 buckets for public access, encryption and bucket-policy exposure." },
  { name: "AWS EC2 & VPC Auditor", cloud: "aws", category: "networking", description: "Audits EC2 instances plus VPC security groups and networking exposure." },
  { name: "AWS CloudTrail Auditor", cloud: "aws", category: "logging", description: "Verifies CloudTrail trail coverage and logging configuration." },
  { name: "AWS KMS Auditor", cloud: "aws", category: "encryption", description: "Checks KMS key rotation and key-policy configuration." },
  { name: "AWS RDS Auditor", cloud: "aws", category: "database", description: "Enumerates RDS DB instances via DescribeDBInstances; flags encryption/public-access issues." },
  { name: "AWS Lambda Auditor", cloud: "aws", category: "compute", description: "Audits Lambda function configuration via ListFunctions/GetFunctionConfiguration." },
  { name: "AWS ECS Task Definition Auditor", cloud: "container", category: "container", description: "Audits ECS task definitions for insecure settings via @aws-sdk/client-ecs." },
  { name: "AWS ECR Repository Auditor", cloud: "container", category: "container", description: "Checks ECR repositories for image-scan, tag-immutability and public access." },
  { name: "AWS EKS Cluster Auditor", cloud: "container", category: "container", description: "Audits EKS clusters for insecure configuration via @aws-sdk/client-eks." },
  { name: "AWS SQS/SNS Auditor", cloud: "aws", category: "other", description: "Audits SQS queues and SNS topics for policy and encryption issues (messaging)." },
  { name: "AWS Secrets Manager Auditor", cloud: "aws", category: "encryption", description: "Checks Secrets Manager secrets for rotation and resource-policy exposure." },
  { name: "AWS GuardDuty Auditor", cloud: "aws", category: "monitoring", description: "Verifies GuardDuty is enabled across all account regions." },
  { name: "AWS WAF Auditor", cloud: "aws", category: "networking", description: "Audits WAFv2 web ACLs across regional and CloudFront scopes." },
  { name: "AWS Config Auditor", cloud: "aws", category: "monitoring", description: "Enumerates AWS Config recorders and rules across regions." },
  { name: "Azure IAM/RBAC Auditor", cloud: "azure", category: "iam", description: "Runs Azure IAM/RBAC role-assignment security checks." },
  { name: "Azure Storage Auditor", cloud: "azure", category: "storage", description: "Runs Azure Storage account security checks (public access, encryption)." },
  { name: "Azure Compute Auditor", cloud: "azure", category: "compute", description: "Audits Azure compute (VM) configuration." },
  { name: "Azure Network Auditor", cloud: "azure", category: "networking", description: "Audits Azure NSGs/network rules for over-permissive 'any' origins." },
  { name: "Azure Key Vault Auditor", cloud: "azure", category: "encryption", description: "Runs Azure Key Vault security checks." },
  { name: "Azure SQL Auditor", cloud: "azure", category: "database", description: "Enumerates logical SQL servers via @azure/arm-sql; derives sub-resource findings." },
  { name: "Azure App Service Auditor", cloud: "azure", category: "compute", description: "Checks Web Apps for HTTPS-only enforcement and minimum TLS 1.2." },
  { name: "Azure AKS Auditor", cloud: "container", category: "container", description: "Audits managed AKS clusters via ContainerServiceClient." },
  { name: "Azure Defender for Cloud Auditor", cloud: "azure", category: "monitoring", description: "Checks Defender pricing plans, auto-provisioning and security contacts." },
  { name: "Azure Monitor Auditor", cloud: "azure", category: "logging", description: "Checks subscription diagnostic settings, activity-log export and alerts." },
  { name: "Azure Policy Auditor", cloud: "azure", category: "other", description: "Checks Azure Policy assignment compliance and per-resource non-compliance (governance)." },
  { name: "GCP IAM Auditor", cloud: "gcp", category: "iam", description: "Runs GCP IAM security checks." },
  { name: "GCP Storage (GCS) Auditor", cloud: "gcp", category: "storage", description: "Runs GCP Cloud Storage (GCS) bucket security checks." },
  { name: "GCP Compute Auditor", cloud: "gcp", category: "compute", description: "Runs GCP Compute Engine security checks." },
  { name: "GCP Network/Logging Auditor", cloud: "gcp", category: "networking", description: "Runs GCP VPC network and logging security checks." },
  { name: "GCP KMS Auditor", cloud: "gcp", category: "encryption", description: "Runs GCP Cloud KMS key security checks." },
  { name: "GCP BigQuery Auditor", cloud: "gcp", category: "database", description: "Checks BigQuery datasets/tables for missing default CMEK and access issues." },
  { name: "GCP Cloud SQL Auditor", cloud: "gcp", category: "database", description: "Enumerates Cloud SQL instances via Cloud SQL Admin API; audits instance settings." },
  { name: "GCP GKE Auditor", cloud: "container", category: "container", description: "Audits GKE clusters across all zonal/regional locations via ClusterManagerClient." },
  { name: "GCP Security Command Center Auditor", cloud: "gcp", category: "monitoring", description: "Surfaces active, un-muted SCC findings across all enabled sources." },
  { name: "GCP Organization Policy Auditor", cloud: "gcp", category: "other", description: "Checks effective org-policy constraints for unenforced governance controls." },
  { name: "Active Directory User Account Auditor", cloud: "other", category: "iam", description: "On-prem AD (LDAP): stale/disabled accounts, non-expiring/old passwords." },
  { name: "Active Directory Privilege Auditor", cloud: "other", category: "iam", description: "On-prem AD: Domain Admin count, nested escalation paths, DCSync rights, admin service accounts." },
  { name: "Active Directory Group Membership Auditor", cloud: "other", category: "iam", description: "On-prem AD: empty groups, oversized groups, cross-domain foreign-principal nesting." },
  { name: "Active Directory Group Policy Auditor", cloud: "other", category: "iam", description: "On-prem AD: password/lockout policy, advanced audit policy, AppLocker/SRP status." },
  { name: "SNMP ACL Auditor", cloud: "other", category: "networking", description: "Network devices: permissive ACLs, missing egress filtering, unrestricted SNMP access." },
  { name: "SNMP Config Compliance Auditor", cloud: "other", category: "networking", description: "Network devices: default community strings, SNMP v1/v2c, MD5/DES, unencrypted mgmt protocols." },
  { name: "SNMP Device Discovery Auditor", cloud: "other", category: "networking", description: "SNMP GET discovery of device type/vendor/firmware; flags end-of-life firmware." },
  { name: "Identity Auditor", cloud: "other", category: "iam", description: "IdP audit (Okta/Entra ID/Google Workspace): MFA enrollment, admin sprawl, stale accounts." },
  { name: "Endpoint Auditor", cloud: "other", category: "other", description: "EDR/MDM audit (Jamf/Intune/CrowdStrike): device compliance, disk encryption, patching." },
  { name: "Network Scanner", cloud: "other", category: "networking", description: "Scans target hosts/domains for open ports, SSL/TLS config, DNS security, HTTP headers." },
  { name: "Kubernetes CIS Benchmark Auditor", cloud: "container", category: "container", description: "CIS checks on a live cluster: cluster-admin RBAC bindings, pod security, missing NetworkPolicies." },
  { name: "Container Registry Auditor", cloud: "container", category: "container", description: "Registry (ECR/ACR/GAR) scan: image vulnerability findings, tag immutability, public access." },
  { name: "Code Repository Security Auditor", cloud: "multi", category: "other", description: "VCS (GitHub/GitLab): default-branch protection, required PR reviews, repo settings." },
  { name: "SaaS Security Auditor", cloud: "other", category: "other", description: "Org-level SaaS security-policy snapshot from provider admin APIs (Google Workspace/Okta/Entra)." },
  { name: "OT/SCADA Passive Collector", cloud: "other", category: "networking", description: "Passive-only analysis of mirrored/captured OT/SCADA traffic (safety-critical, never active)." },
  { name: "Prowler Deep Scanner", cloud: "aws", category: "other", description: "Container Lambda running Prowler CLI for deep AWS scanning (900+ checks, framework compliance)." },
  { name: "Checkov IaC Scanner", cloud: "iac", category: "other", description: "Checkov 3.2.0 in a container Lambda: Terraform/CloudFormation/K8s IaC misconfiguration scanning." },
  { name: "Semgrep IaC/SAST Scanner", cloud: "iac", category: "other", description: "Semgrep 1.90.0 in a container Lambda: static code/pattern security analysis (SARIF output)." },
  { name: "Bandit SAST Scanner", cloud: "iac", category: "other", description: "Bandit 1.7.10 in a container Lambda: Python security static analysis (SARIF output)." },
];

export const AUDITOR_COUNT = AUDITORS.length; // 55
export const AUDITOR_CLOUDS: readonly AuditorCloud[] = ["aws", "azure", "container", "gcp", "iac", "multi", "other"];
export const AUDITOR_CATEGORIES: readonly AuditorCategory[] = ["compute", "container", "database", "encryption", "iam", "logging", "monitoring", "networking", "other", "storage"];
export const SCANNER_TYPES: readonly string[] = ["SDK auditors (TypeScript, cloud SDK-backed agents in packages/api/src/agents)", "AWS/Azure/GCP granular sub-auditors (auditXxx functions, 43 total)", "Active Directory (LDAP) auditors", "SNMP / network-device auditors", "Identity (Okta/Entra/Google Workspace) auditor", "Endpoint EDR/MDM (Jamf/Intune/CrowdStrike) auditor", "Network scanner (ports/TLS/DNS/headers)", "Kubernetes CIS auditor", "Container Registry auditor", "Code Repository (GitHub/GitLab) auditor", "SaaS security auditor", "OT/SCADA passive collector", "Prowler deep scan (container Lambda, 900+ AWS checks)", "Checkov (IaC, container Lambda)", "Semgrep (SAST, container Lambda)", "Bandit (Python SAST, container Lambda)"];
