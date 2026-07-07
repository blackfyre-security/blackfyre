import { KeyVaultManagementClient } from "@azure/arm-keyvault";
import type { AgentFindingPayload } from "@blackfyre/shared";
import { mapCheckToControls } from "../../services/compliance-mapper.js";
import type { AzureCredentials } from "./credentials.js";

/**
 * Runs all Azure Key Vault security checks and returns findings.
 *
 * Checks:
 * 1. azure_kv_no_soft_delete — Key Vault without soft delete enabled
 * 2. azure_kv_no_purge_protection — Key Vault without purge protection
 * 3. azure_kv_rbac_not_enabled — Key Vault not using RBAC authorization
 */
export async function auditAzureKeyVault(
  creds: AzureCredentials,
): Promise<AgentFindingPayload[]> {
  const client = new KeyVaultManagementClient(
    creds.credential,
    creds.subscriptionId,
  );
  const findings: AgentFindingPayload[] = [];

  for await (const vault of client.vaults.listBySubscription()) {
    const vaultName = vault.name ?? "unknown";
    const vaultId = vault.id ?? vaultName;
    const properties = vault.properties;

    // Check 1: Soft delete
    if (properties?.enableSoftDelete !== true) {
      findings.push({
        title: `Key Vault "${vaultName}" does not have soft delete enabled`,
        description: `Key Vault ${vaultName} (${vaultId}) does not have soft delete enabled. Without soft delete, deleted keys, secrets, and certificates are permanently lost immediately. Enable soft delete to allow recovery of accidentally deleted items within the retention period.`,
        severity: "high",
        category: "encryption",
        resourceType: "Microsoft.KeyVault/vaults",
        resourceId: vaultId,
        remediationTier: "auto",
        autoFixAvailable: true,
        controlMappings: mapCheckToControls("azure_kv_no_soft_delete"),
      });
    }

    // Check 2: Purge protection
    if (properties?.enablePurgeProtection !== true) {
      findings.push({
        title: `Key Vault "${vaultName}" does not have purge protection enabled`,
        description: `Key Vault ${vaultName} (${vaultId}) does not have purge protection enabled. Without purge protection, a malicious actor with sufficient permissions can permanently delete vault items even during the soft-delete retention period. Enable purge protection to prevent irreversible deletion.`,
        severity: "high",
        category: "encryption",
        resourceType: "Microsoft.KeyVault/vaults",
        resourceId: vaultId,
        remediationTier: "auto",
        autoFixAvailable: true,
        controlMappings: mapCheckToControls("azure_kv_no_purge_protection"),
      });
    }

    // Check 3: RBAC authorization
    if (properties?.enableRbacAuthorization !== true) {
      findings.push({
        title: `Key Vault "${vaultName}" uses access policies instead of RBAC`,
        description: `Key Vault ${vaultName} (${vaultId}) uses legacy access policies instead of Azure RBAC for authorization. RBAC provides finer-grained, auditable access control that integrates with Azure AD Privileged Identity Management (PIM). Migrate to RBAC authorization model.`,
        severity: "medium",
        category: "iam",
        resourceType: "Microsoft.KeyVault/vaults",
        resourceId: vaultId,
        remediationTier: "manual",
        autoFixAvailable: false,
        controlMappings: mapCheckToControls("azure_kv_rbac_not_enabled"),
      });
    }
  }

  return findings;
}
