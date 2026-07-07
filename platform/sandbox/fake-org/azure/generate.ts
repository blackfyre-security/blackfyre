/**
 * Synthetic Azure finding generator for Acme Bank.
 * Reads azure/org-data.json and applies the same checks as the real Azure auditors,
 * emitting AgentFindingPayload-shaped objects to stdout as JSON.
 *
 * Run: npx tsx fake-org/azure/generate.ts | jq 'length'
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
  cloud: "azure";
  accountId: string;
}

// ---------------------------------------------------------------------------
// Deterministic dedup hash
// ---------------------------------------------------------------------------

function dedupHash(resourceId: string, checkId: string): string {
  return createHash("sha256")
    .update(`azure:${resourceId}:${checkId}`)
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

const SUBSCRIPTION_ID: string = orgData.subscription.id;

// ---------------------------------------------------------------------------
// Storage checks
// ---------------------------------------------------------------------------

function auditStorage(): AgentFindingPayload[] {
  const findings: AgentFindingPayload[] = [];

  for (const account of orgData.storageAccounts) {
    const name: string = account.name;
    const id: string = account.id;
    const region: string = account.location;

    // HTTPS-only not enforced
    if (!account.enableHttpsTrafficOnly) {
      findings.push({
        title: `Storage account '${name}' allows non-HTTPS traffic`,
        description: `Storage account ${name} does not enforce HTTPS-only traffic. Non-HTTPS connections transmit data in plain text, exposing it to interception. Enable the "Secure transfer required" setting.`,
        severity: "high",
        category: "encryption",
        resourceType: "Microsoft.Storage/storageAccounts",
        resourceId: id,
        resourceRegion: region,
        remediationTier: "auto",
        autoFixAvailable: true,
        cloud: "azure",
        accountId: SUBSCRIPTION_ID,
      });
    }

    // Public blob access — critical for sensitive data accounts
    if (account.allowBlobPublicAccess) {
      findings.push({
        title: `Storage account '${name}' allows public blob access`,
        description: `Storage account ${name} has public blob access enabled at the account level. This allows individual containers to be configured for anonymous public access. Disable public blob access to prevent accidental data exposure.`,
        severity: account.sensitiveData ? "critical" : "high",
        category: "config",
        resourceType: "Microsoft.Storage/storageAccounts",
        resourceId: id,
        resourceRegion: region,
        remediationTier: "auto",
        autoFixAvailable: true,
        cloud: "azure",
        accountId: SUBSCRIPTION_ID,
      });
    }

    // CMK — only for sensitive-data accounts
    if (account.sensitiveData && account.encryptionKeySource !== "Microsoft.Keyvault") {
      findings.push({
        title: `Storage account '${name}' does not use customer-managed keys`,
        description: `Storage account ${name} stores sensitive data but uses Microsoft-managed keys instead of customer-managed keys (CMK) from Key Vault. CMK provides additional control over encryption key lifecycle and rotation.`,
        severity: "medium",
        category: "encryption",
        resourceType: "Microsoft.Storage/storageAccounts",
        resourceId: id,
        resourceRegion: region,
        remediationTier: "manual",
        autoFixAvailable: false,
        cloud: "azure",
        accountId: SUBSCRIPTION_ID,
      });
    }

    // Soft delete — only for non-sensitive accounts
    if (!account.blobSoftDeleteEnabled && !account.sensitiveData) {
      findings.push({
        title: `Storage account '${name}' does not have blob soft delete enabled`,
        description: `Storage account ${name} does not have blob soft delete enabled. Soft delete allows recovering accidentally deleted blobs within a retention period. Enable soft delete with an appropriate retention period.`,
        severity: "medium",
        category: "config",
        resourceType: "Microsoft.Storage/storageAccounts",
        resourceId: id,
        resourceRegion: region,
        remediationTier: "auto",
        autoFixAvailable: true,
        cloud: "azure",
        accountId: SUBSCRIPTION_ID,
      });
    }

    // TLS below 1.2 — only when HTTPS is enforced; if HTTPS is off that finding covers transport risk
    if (
      account.enableHttpsTrafficOnly &&
      (account.minimumTlsVersion === "TLS1_0" || account.minimumTlsVersion === "TLS1_1")
    ) {
      findings.push({
        title: `Storage account '${name}' allows TLS version below 1.2`,
        description: `Storage account ${name} is configured with minimum TLS version ${account.minimumTlsVersion}. TLS 1.0 and 1.1 have known vulnerabilities. Set minimum TLS version to TLS1_2 or higher.`,
        severity: "high",
        category: "encryption",
        resourceType: "Microsoft.Storage/storageAccounts",
        resourceId: id,
        resourceRegion: region,
        remediationTier: "auto",
        autoFixAvailable: true,
        cloud: "azure",
        accountId: SUBSCRIPTION_ID,
      });
    }
  }

  return findings;
}

// ---------------------------------------------------------------------------
// Key Vault checks
// ---------------------------------------------------------------------------

function auditKeyVaults(): AgentFindingPayload[] {
  const findings: AgentFindingPayload[] = [];

  for (const vault of orgData.keyVaults) {
    const name: string = vault.name;
    const id: string = vault.id;
    const region: string = vault.location;

    if (!vault.enableSoftDelete) {
      findings.push({
        title: `Key Vault '${name}' has soft delete disabled`,
        description: `Key Vault ${name} does not have soft delete enabled. Without soft delete, deleted keys, secrets, and certificates are permanently lost immediately. Enable soft delete to allow recovery of accidentally deleted items within the retention period.`,
        severity: "high",
        category: "encryption",
        resourceType: "Microsoft.KeyVault/vaults",
        resourceId: id,
        resourceRegion: region,
        remediationTier: "auto",
        autoFixAvailable: true,
        cloud: "azure",
        accountId: SUBSCRIPTION_ID,
      });
    }

    if (!vault.enablePurgeProtection) {
      findings.push({
        title: `Key Vault '${name}' does not have purge protection enabled`,
        description: `Key Vault ${name} does not have purge protection enabled. Without purge protection, a malicious actor with sufficient permissions can permanently delete vault items even during the soft-delete retention period. Enable purge protection to prevent irreversible deletion.`,
        severity: "high",
        category: "encryption",
        resourceType: "Microsoft.KeyVault/vaults",
        resourceId: id,
        resourceRegion: region,
        remediationTier: "auto",
        autoFixAvailable: true,
        cloud: "azure",
        accountId: SUBSCRIPTION_ID,
      });
    }

    if (!vault.enableRbacAuthorization) {
      findings.push({
        title: `Key Vault '${name}' uses access policies instead of RBAC`,
        description: `Key Vault ${name} uses legacy access policies instead of Azure RBAC for authorization. RBAC provides finer-grained, auditable access control that integrates with Azure AD Privileged Identity Management (PIM). Migrate to RBAC authorization model.`,
        severity: "medium",
        category: "iam",
        resourceType: "Microsoft.KeyVault/vaults",
        resourceId: id,
        resourceRegion: region,
        remediationTier: "manual",
        autoFixAvailable: false,
        cloud: "azure",
        accountId: SUBSCRIPTION_ID,
      });
    }
  }

  return findings;
}

// ---------------------------------------------------------------------------
// SQL Database checks
// Server-level findings (ATP, public network) deduplicated per server.
// ---------------------------------------------------------------------------

function auditSqlDatabases(): AgentFindingPayload[] {
  const findings: AgentFindingPayload[] = [];
  const serverAtpFlagged = new Set<string>();
  const serverPublicFlagged = new Set<string>();
  const serverAuditFlagged = new Set<string>();

  for (const db of orgData.sqlDatabases) {
    const name: string = db.name;
    const id: string = db.id;
    const region: string = db.location;
    const serverResourceId = `/subscriptions/${SUBSCRIPTION_ID}/resourceGroups/${db.resourceGroup}/providers/Microsoft.Sql/servers/${db.serverName}`;

    if (!db.tdeEnabled) {
      findings.push({
        title: `SQL DB '${name}' has Transparent Data Encryption disabled`,
        description: `SQL Database ${name} on server ${db.serverName} does not have Transparent Data Encryption (TDE) enabled. TDE encrypts database files at rest. Enable TDE to protect data from unauthorized access to the underlying storage.`,
        severity: "critical",
        category: "encryption",
        resourceType: "Microsoft.Sql/servers/databases",
        resourceId: id,
        resourceRegion: region,
        remediationTier: "auto",
        autoFixAvailable: true,
        cloud: "azure",
        accountId: SUBSCRIPTION_ID,
      });
    }

    // Auditing is effectively a server-level policy — deduplicate per server
    if (!db.auditingEnabled && !serverAuditFlagged.has(db.serverName)) {
      serverAuditFlagged.add(db.serverName);
      findings.push({
        title: `SQL server '${db.serverName}' does not have auditing enabled`,
        description: `SQL server ${db.serverName} does not have database auditing configured. Auditing tracks database events and provides visibility into activity that could indicate suspicious behavior. Enable server-level auditing and direct logs to a storage account or Log Analytics workspace.`,
        severity: "high",
        category: "logging",
        resourceType: "Microsoft.Sql/servers",
        resourceId: serverResourceId,
        resourceRegion: region,
        remediationTier: "manual",
        autoFixAvailable: false,
        cloud: "azure",
        accountId: SUBSCRIPTION_ID,
      });
    }

    if (!db.threatDetectionEnabled && !serverAtpFlagged.has(db.serverName)) {
      serverAtpFlagged.add(db.serverName);
      findings.push({
        title: `SQL server '${db.serverName}' has Advanced Threat Protection disabled`,
        description: `SQL server ${db.serverName} does not have Advanced Threat Protection (ATP) enabled. ATP is a server-level setting that protects all databases on the server. Enable ATP for proactive threat detection across all databases.`,
        severity: "high",
        category: "config",
        resourceType: "Microsoft.Sql/servers",
        resourceId: serverResourceId,
        resourceRegion: region,
        remediationTier: "auto",
        autoFixAvailable: true,
        cloud: "azure",
        accountId: SUBSCRIPTION_ID,
      });
    }

    if (db.publicNetworkAccess === "Enabled" && !serverPublicFlagged.has(db.serverName)) {
      serverPublicFlagged.add(db.serverName);
      findings.push({
        title: `SQL server '${db.serverName}' has public network access enabled`,
        description: `SQL server ${db.serverName} allows connections from public networks. This increases the attack surface. Disable public network access and use Private Link or VNet service endpoints to restrict access to trusted networks.`,
        severity: "high",
        category: "network",
        resourceType: "Microsoft.Sql/servers",
        resourceId: serverResourceId,
        resourceRegion: region,
        remediationTier: "manual",
        autoFixAvailable: false,
        cloud: "azure",
        accountId: SUBSCRIPTION_ID,
      });
    }
  }

  return findings;
}

// ---------------------------------------------------------------------------
// AKS Cluster checks
// ---------------------------------------------------------------------------

function auditAksClusters(): AgentFindingPayload[] {
  const findings: AgentFindingPayload[] = [];

  for (const cluster of orgData.aksClusters) {
    const name: string = cluster.name;
    const id: string = cluster.id;
    const region: string = cluster.location;

    if (!cluster.rbacEnabled) {
      findings.push({
        title: `AKS cluster '${name}' has Kubernetes RBAC disabled`,
        description: `AKS cluster ${name} does not have Kubernetes RBAC enabled. Without RBAC, all authenticated users have unrestricted access to the cluster API server. Enable RBAC to implement least-privilege access control for cluster resources.`,
        severity: "critical",
        category: "iam",
        resourceType: "Microsoft.ContainerService/managedClusters",
        resourceId: id,
        resourceRegion: region,
        remediationTier: "manual",
        autoFixAvailable: false,
        cloud: "azure",
        accountId: SUBSCRIPTION_ID,
      });
    }

    if (!cluster.networkPolicyEnabled) {
      findings.push({
        title: `AKS cluster '${name}' does not have network policy enforcement enabled`,
        description: `AKS cluster ${name} does not enforce Kubernetes NetworkPolicy. Without network policies, all pods can communicate with all other pods. Implement network policies to restrict pod-to-pod traffic to required communication paths only.`,
        severity: "high",
        category: "network",
        resourceType: "Microsoft.ContainerService/managedClusters",
        resourceId: id,
        resourceRegion: region,
        remediationTier: "manual",
        autoFixAvailable: false,
        cloud: "azure",
        accountId: SUBSCRIPTION_ID,
      });
    }

    if (!cluster.privateCluster) {
      findings.push({
        title: `AKS cluster '${name}' is not a private cluster`,
        description: `AKS cluster ${name} exposes its API server to the public internet. A private cluster restricts API server access to the VNet, significantly reducing the attack surface. Migrate to a private cluster configuration.`,
        severity: "high",
        category: "network",
        resourceType: "Microsoft.ContainerService/managedClusters",
        resourceId: id,
        resourceRegion: region,
        remediationTier: "manual",
        autoFixAvailable: false,
        cloud: "azure",
        accountId: SUBSCRIPTION_ID,
      });
    }

    if (!cluster.aadIntegrationEnabled) {
      findings.push({
        title: `AKS cluster '${name}' lacks Azure AD integration`,
        description: `AKS cluster ${name} is not integrated with Azure Active Directory for authentication. AAD integration enables managed identity-based auth and Azure RBAC for Kubernetes. Enable AAD integration to leverage enterprise identity and conditional access policies.`,
        severity: "medium",
        category: "identity",
        resourceType: "Microsoft.ContainerService/managedClusters",
        resourceId: id,
        resourceRegion: region,
        remediationTier: "manual",
        autoFixAvailable: false,
        cloud: "azure",
        accountId: SUBSCRIPTION_ID,
      });
    }
  }

  return findings;
}

// ---------------------------------------------------------------------------
// Virtual Machine checks
// ---------------------------------------------------------------------------

function auditVirtualMachines(): AgentFindingPayload[] {
  const findings: AgentFindingPayload[] = [];

  for (const vm of orgData.virtualMachines) {
    const name: string = vm.name;
    const id: string = vm.id;
    const region: string = vm.location;

    if (!vm.diskEncryptionEnabled) {
      findings.push({
        title: `VM '${name}' does not have disk encryption enabled`,
        description: `Virtual machine ${name} does not have Azure Disk Encryption enabled. Disk encryption protects data at rest on OS and data disks using Azure Key Vault keys. Enable ADE to protect against unauthorized access if physical storage media is compromised.`,
        severity: "high",
        category: "encryption",
        resourceType: "Microsoft.Compute/virtualMachines",
        resourceId: id,
        resourceRegion: region,
        remediationTier: "manual",
        autoFixAvailable: false,
        cloud: "azure",
        accountId: SUBSCRIPTION_ID,
      });
    }

    if (!vm.managedIdentityEnabled) {
      findings.push({
        title: `VM '${name}' does not use a managed identity`,
        description: `Virtual machine ${name} does not have a system-assigned or user-assigned managed identity. Managed identities eliminate the need for credentials in application code when accessing Azure services. Enable managed identity to improve credential hygiene.`,
        severity: "low",
        category: "iam",
        resourceType: "Microsoft.Compute/virtualMachines",
        resourceId: id,
        resourceRegion: region,
        remediationTier: "manual",
        autoFixAvailable: false,
        cloud: "azure",
        accountId: SUBSCRIPTION_ID,
      });
    }
  }

  return findings;
}

// ---------------------------------------------------------------------------
// NSG / Network checks
// ---------------------------------------------------------------------------

function auditNsgs(): AgentFindingPayload[] {
  const findings: AgentFindingPayload[] = [];

  for (const nsg of orgData.networkSecurityGroups) {
    const name: string = nsg.name;
    const id: string = nsg.id;
    const region: string = nsg.location;
    const isProd = !nsg.resourceGroup.includes("devops");

    for (const rule of nsg.rules) {
      if (rule.access !== "Allow" || rule.direction !== "Inbound") continue;

      const src: string = rule.sourceAddressPrefix;
      const fromAny = src === "*" || src === "Internet" || src === "0.0.0.0/0";
      if (!fromAny) continue;

      const port: string = rule.destinationPortRange;

      if (port === "22") {
        findings.push({
          title: `NSG '${name}' allows SSH (port 22) from 0.0.0.0/0`,
          description: `Network Security Group ${name} has rule "${rule.name}" that allows inbound SSH access from ${src}. This exposes SSH to the entire internet. Restrict the source to specific IP ranges or use Azure Bastion.`,
          severity: isProd ? "critical" : "high",
          category: "network",
          resourceType: "Microsoft.Network/networkSecurityGroups",
          resourceId: id,
          resourceRegion: region,
          remediationTier: "approval",
          autoFixAvailable: false,
          cloud: "azure",
          accountId: SUBSCRIPTION_ID,
        });
      } else if (port === "3389") {
        findings.push({
          title: `NSG '${name}' allows RDP (port 3389) from 0.0.0.0/0`,
          description: `Network Security Group ${name} has rule "${rule.name}" that allows inbound RDP access from ${src}. This exposes RDP to the entire internet. Restrict the source to specific IP ranges or use Azure Bastion.`,
          severity: isProd ? "critical" : "high",
          category: "network",
          resourceType: "Microsoft.Network/networkSecurityGroups",
          resourceId: id,
          resourceRegion: region,
          remediationTier: "approval",
          autoFixAvailable: false,
          cloud: "azure",
          accountId: SUBSCRIPTION_ID,
        });
      } else if (port === "*") {
        findings.push({
          title: `NSG '${name}' allows ALL inbound traffic from any source`,
          description: `Network Security Group ${name} has rule "${rule.name}" that allows all inbound traffic on all ports from ${src}. This effectively disables network-level access control, exposing SSH, RDP, and all other services. Restrict inbound rules to only required ports and sources.`,
          severity: isProd ? "critical" : "high",
          category: "network",
          resourceType: "Microsoft.Network/networkSecurityGroups",
          resourceId: id,
          resourceRegion: region,
          remediationTier: "approval",
          autoFixAvailable: false,
          cloud: "azure",
          accountId: SUBSCRIPTION_ID,
        });
      }
    }

    if (!nsg.hasFlowLogs) {
      findings.push({
        title: `NSG '${name}' has no flow logs configured`,
        description: `Network Security Group ${name} does not have NSG flow logs enabled. Flow logs are essential for monitoring network traffic, detecting anomalies, and meeting compliance requirements. Enable flow logs and send them to a storage account or Log Analytics workspace.`,
        severity: "medium",
        category: "logging",
        resourceType: "Microsoft.Network/networkSecurityGroups",
        resourceId: id,
        resourceRegion: region,
        remediationTier: "manual",
        autoFixAvailable: false,
        cloud: "azure",
        accountId: SUBSCRIPTION_ID,
      });
    }
  }

  return findings;
}

// ---------------------------------------------------------------------------
// IAM / RBAC checks
// ---------------------------------------------------------------------------

function auditIam(): AgentFindingPayload[] {
  const findings: AgentFindingPayload[] = [];

  const OWNER_ROLE_ID = "8e3af657-a8ff-443c-a75c-2fe8c4bcb635";

  const ownerAssignments = orgData.rbacAssignments.filter(
    (a: any) =>
      a.roleDefinitionId === OWNER_ROLE_ID &&
      a.scope === `/subscriptions/${SUBSCRIPTION_ID}`
  );

  if (ownerAssignments.length > 3) {
    findings.push({
      title: `RBAC: ${ownerAssignments.length} users have Owner role at subscription scope`,
      description: `The subscription has ${ownerAssignments.length} principals assigned the Owner role. The Owner role grants full access including the ability to assign roles. Limit Owner assignments to reduce risk of privilege abuse. Best practice recommends no more than 3 Owner assignments.`,
      severity: "high",
      category: "iam",
      resourceType: "Microsoft.Authorization/roleAssignments",
      resourceId: `/subscriptions/${SUBSCRIPTION_ID}`,
      resourceRegion: "global",
      remediationTier: "manual",
      autoFixAvailable: false,
      cloud: "azure",
      accountId: SUBSCRIPTION_ID,
    });
  }

  const wildcardRoles = orgData.rbacAssignments.filter((a: any) => a.isCustomWildcard);
  for (const role of wildcardRoles) {
    findings.push({
      title: `Custom role '${role.roleName}' has wildcard (*) actions`,
      description: `Custom role definition "${role.roleName}" assigned to "${role.principalName}" grants wildcard (*) actions, equivalent to Owner-level access. Scope down the custom role to only required actions.`,
      severity: "high",
      category: "iam",
      resourceType: "Microsoft.Authorization/roleDefinitions",
      resourceId: role.roleDefinitionId,
      resourceRegion: "global",
      remediationTier: "manual",
      autoFixAvailable: false,
      cloud: "azure",
      accountId: SUBSCRIPTION_ID,
    });
  }

  if (orgData.classicAdmins && orgData.classicAdmins.length > 0) {
    findings.push({
      title: `Subscription has ${orgData.classicAdmins.length} classic administrator(s)`,
      description: `The subscription still has ${orgData.classicAdmins.length} classic administrator(s) (Co-Administrator/Service Administrator). Classic admin roles are a legacy access model that bypasses Azure RBAC. Migrate to Azure RBAC roles and remove classic administrator assignments.`,
      severity: "medium",
      category: "iam",
      resourceType: "Microsoft.Authorization/classicAdministrators",
      resourceId: "classic-admins",
      resourceRegion: "global",
      remediationTier: "manual",
      autoFixAvailable: false,
      cloud: "azure",
      accountId: SUBSCRIPTION_ID,
    });
  }

  const guestAssignments = orgData.rbacAssignments.filter(
    (a: any) => a.principalType === "Guest"
  );
  if (guestAssignments.length > 0) {
    findings.push({
      title: `${guestAssignments.length} guest user(s) have role assignments in the subscription`,
      description: `Found ${guestAssignments.length} guest (external) user(s) with Azure RBAC role assignments: ${guestAssignments.map((a: any) => a.principalName).join(", ")}. Guest users represent external identities that may not be subject to your organization's security policies. Review and remove unnecessary guest access.`,
      severity: "medium",
      category: "iam",
      resourceType: "Microsoft.Authorization/roleAssignments",
      resourceId: `/subscriptions/${SUBSCRIPTION_ID}`,
      resourceRegion: "global",
      remediationTier: "manual",
      autoFixAvailable: false,
      cloud: "azure",
      accountId: SUBSCRIPTION_ID,
    });
  }

  return findings;
}

// ---------------------------------------------------------------------------
// Monitor / Logging checks
// ---------------------------------------------------------------------------

function auditMonitoring(): AgentFindingPayload[] {
  const findings: AgentFindingPayload[] = [];
  const diag = orgData.diagnosticSettings;

  if (!diag.activityLogExported) {
    findings.push({
      title: "Azure Activity Log is not exported to a Log Analytics workspace",
      description: "The Azure Activity Log is not being forwarded to a Log Analytics workspace or storage account. The Activity Log records subscription-level events including administrative actions, service health incidents, and policy writes. Export it for centralized SIEM integration.",
      severity: "high",
      category: "logging",
      resourceType: "Microsoft.Insights/diagnosticSettings",
      resourceId: `/subscriptions/${SUBSCRIPTION_ID}/providers/microsoft.insights/diagnosticSettings/activity-log`,
      resourceRegion: "global",
      remediationTier: "manual",
      autoFixAvailable: false,
      cloud: "azure",
      accountId: SUBSCRIPTION_ID,
    });
  }

  if (!diag.logAnalyticsWorkspaceConnected) {
    findings.push({
      title: "No Log Analytics workspace configured for centralized log aggregation",
      description: "There is no Log Analytics workspace connected to the subscription for centralized log collection. Without a centralized workspace, security events across resources are not aggregated, making threat detection and incident response significantly harder.",
      severity: "high",
      category: "logging",
      resourceType: "Microsoft.OperationalInsights/workspaces",
      resourceId: `/subscriptions/${SUBSCRIPTION_ID}`,
      resourceRegion: "global",
      remediationTier: "manual",
      autoFixAvailable: false,
      cloud: "azure",
      accountId: SUBSCRIPTION_ID,
    });
  }

  if (!diag.keyVaultDiagnosticsEnabled) {
    findings.push({
      title: "Key Vault diagnostic settings not configured for audit logging",
      description: "Key Vault resources in the subscription do not have diagnostic settings configured to capture audit logs. Key Vault audit logs record all access to secrets, keys, and certificates. Enable diagnostic settings to send Key Vault logs to Log Analytics for security monitoring.",
      severity: "medium",
      category: "logging",
      resourceType: "Microsoft.Insights/diagnosticSettings",
      resourceId: `/subscriptions/${SUBSCRIPTION_ID}/resourceGroups/rg-security/providers/Microsoft.KeyVault/vaults`,
      resourceRegion: "eastus",
      remediationTier: "manual",
      autoFixAvailable: false,
      cloud: "azure",
      accountId: SUBSCRIPTION_ID,
    });
  }

  return findings;
}

// ---------------------------------------------------------------------------
// Defender for Cloud checks
// ---------------------------------------------------------------------------

function auditDefender(): AgentFindingPayload[] {
  const findings: AgentFindingPayload[] = [];
  const plans = orgData.defenderPlans;

  if (plans.servers === "Free") {
    findings.push({
      title: "Microsoft Defender for Servers is not enabled (Free tier)",
      description: "Microsoft Defender for Servers is not enabled. Without it, virtual machines lack vulnerability assessment, endpoint protection monitoring, and threat detection capabilities. Upgrade to the Standard tier to enable Defender for Servers.",
      severity: "medium",
      category: "config",
      resourceType: "Microsoft.Security/pricings",
      resourceId: `/subscriptions/${SUBSCRIPTION_ID}/providers/Microsoft.Security/pricings/VirtualMachines`,
      resourceRegion: "global",
      remediationTier: "manual",
      autoFixAvailable: false,
      cloud: "azure",
      accountId: SUBSCRIPTION_ID,
    });
  }

  if (plans.sqlServers === "Free") {
    findings.push({
      title: "Microsoft Defender for SQL is not enabled",
      description: "Microsoft Defender for SQL is not enabled. Defender for SQL provides Advanced Threat Protection (ATP) and vulnerability assessments for Azure SQL Databases and SQL Servers on machines. Enable it to detect anomalous database activity.",
      severity: "medium",
      category: "config",
      resourceType: "Microsoft.Security/pricings",
      resourceId: `/subscriptions/${SUBSCRIPTION_ID}/providers/Microsoft.Security/pricings/SqlServers`,
      resourceRegion: "global",
      remediationTier: "manual",
      autoFixAvailable: false,
      cloud: "azure",
      accountId: SUBSCRIPTION_ID,
    });
  }

  if (plans.storage === "Off") {
    findings.push({
      title: "Microsoft Defender for Storage is not enabled",
      description: "Microsoft Defender for Storage is not enabled. Defender for Storage detects unusual and potentially harmful attempts to access or exploit storage accounts, including malware uploads and sensitive data exposure. Enable it to protect storage resources.",
      severity: "medium",
      category: "config",
      resourceType: "Microsoft.Security/pricings",
      resourceId: `/subscriptions/${SUBSCRIPTION_ID}/providers/Microsoft.Security/pricings/StorageAccounts`,
      resourceRegion: "global",
      remediationTier: "manual",
      autoFixAvailable: false,
      cloud: "azure",
      accountId: SUBSCRIPTION_ID,
    });
  }

  if (plans.containers === "Off") {
    findings.push({
      title: "Microsoft Defender for Containers is not enabled",
      description: "Microsoft Defender for Containers is not enabled. Defender for Containers provides runtime threat protection for AKS clusters, registry vulnerability scanning, and Kubernetes security posture management. Enable it to secure containerized workloads.",
      severity: "low",
      category: "config",
      resourceType: "Microsoft.Security/pricings",
      resourceId: `/subscriptions/${SUBSCRIPTION_ID}/providers/Microsoft.Security/pricings/Containers`,
      resourceRegion: "global",
      remediationTier: "manual",
      autoFixAvailable: false,
      cloud: "azure",
      accountId: SUBSCRIPTION_ID,
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
    ...auditStorage(),
    ...auditKeyVaults(),
    ...auditSqlDatabases(),
    ...auditAksClusters(),
    ...auditVirtualMachines(),
    ...auditNsgs(),
    ...auditIam(),
    ...auditMonitoring(),
    ...auditDefender(),
  ];

  const SCAN_ID = "azure-synthetic-scan-001";
  const TENANT_ID = orgData.tenant.id;

  return raw.map((f, idx) => {
    const hash = dedupHash(f.resourceId ?? `idx-${idx}`, f.title);
    return {
      ...f,
      id: `azure-finding-${hash}`,
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
