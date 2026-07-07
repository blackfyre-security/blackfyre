import { StorageManagementClient } from "@azure/arm-storage";
import type { AgentFindingPayload } from "@blackfyre/shared";
import { mapCheckToControls } from "../../services/compliance-mapper.js";
import type { AzureCredentials } from "./credentials.js";

/**
 * Extracts the resource group name from an Azure resource ID.
 * Resource ID format: /subscriptions/{sub}/resourceGroups/{rg}/providers/...
 */
function extractResourceGroup(resourceId: string | undefined): string | null {
  if (!resourceId) return null;
  const match = resourceId.match(/\/resourceGroups\/([^/]+)/i);
  return match ? match[1] : null;
}

/**
 * Runs all Azure Storage security checks and returns findings.
 *
 * Checks:
 * 1. azure_storage_no_https — HTTPS-only traffic not enforced
 * 2. azure_storage_public_blob — Public blob access allowed
 * 3. azure_storage_no_encryption — No customer-managed key (CMK) encryption
 * 4. azure_storage_no_soft_delete — Blob soft delete not enabled
 */
export async function auditAzureStorage(
  creds: AzureCredentials,
): Promise<AgentFindingPayload[]> {
  const client = new StorageManagementClient(
    creds.credential,
    creds.subscriptionId,
  );
  const findings: AgentFindingPayload[] = [];

  for await (const account of client.storageAccounts.list()) {
    const accountName = account.name ?? "unknown";
    const accountId = account.id ?? accountName;
    const resourceGroup = extractResourceGroup(account.id);

    // Check 1: HTTPS-only traffic
    if (account.enableHttpsTrafficOnly !== true) {
      findings.push({
        title: `Storage account "${accountName}" allows non-HTTPS traffic`,
        description: `Storage account ${accountName} does not enforce HTTPS-only traffic. Non-HTTPS connections transmit data in plain text, exposing it to interception. Enable the "Secure transfer required" setting.`,
        severity: "high",
        category: "encryption",
        resourceType: "Microsoft.Storage/storageAccounts",
        resourceId: accountId,
        remediationTier: "auto",
        autoFixAvailable: true,
        controlMappings: mapCheckToControls("azure_storage_no_https"),
      });
    }

    // Check 2: Public blob access
    if (account.allowBlobPublicAccess === true) {
      findings.push({
        title: `Storage account "${accountName}" allows public blob access`,
        description: `Storage account ${accountName} has public blob access enabled at the account level. This allows individual containers to be configured for anonymous public access. Disable public blob access to prevent accidental data exposure.`,
        severity: "critical",
        category: "config",
        resourceType: "Microsoft.Storage/storageAccounts",
        resourceId: accountId,
        remediationTier: "auto",
        autoFixAvailable: true,
        controlMappings: mapCheckToControls("azure_storage_public_blob"),
      });
    }

    // Check 3: Customer-managed key encryption
    if (account.encryption?.keySource !== "Microsoft.Keyvault") {
      findings.push({
        title: `Storage account "${accountName}" does not use customer-managed keys`,
        description: `Storage account ${accountName} uses Microsoft-managed keys (${account.encryption?.keySource ?? "default"}) instead of customer-managed keys (CMK) from Key Vault. CMK provides additional control over encryption key lifecycle and rotation.`,
        severity: "medium",
        category: "encryption",
        resourceType: "Microsoft.Storage/storageAccounts",
        resourceId: accountId,
        remediationTier: "manual",
        autoFixAvailable: false,
        controlMappings: mapCheckToControls("azure_storage_no_encryption"),
      });
    }

    // Check 4: Blob soft delete
    if (resourceGroup) {
      try {
        const blobProps = await client.blobServices.getServiceProperties(
          resourceGroup,
          accountName,
        );

        if (blobProps.deleteRetentionPolicy?.enabled !== true) {
          findings.push({
            title: `Storage account "${accountName}" does not have blob soft delete enabled`,
            description: `Storage account ${accountName} does not have blob soft delete enabled. Soft delete allows recovering accidentally deleted blobs within a retention period. Enable soft delete with an appropriate retention period.`,
            severity: "medium",
            category: "config",
            resourceType: "Microsoft.Storage/storageAccounts",
            resourceId: accountId,
            remediationTier: "auto",
            autoFixAvailable: true,
            controlMappings: mapCheckToControls("azure_storage_no_soft_delete"),
          });
        }
      } catch {
        // Skip soft delete check if we cannot read blob service properties
      }
    }
  }

  return findings;
}
