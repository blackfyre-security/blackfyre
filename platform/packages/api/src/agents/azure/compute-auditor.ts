import { ComputeManagementClient } from "@azure/arm-compute";
import { NetworkManagementClient } from "@azure/arm-network";
import type { AgentFindingPayload } from "@blackfyre/shared";
import { mapCheckToControls } from "../../services/compliance-mapper.js";
import type { AzureCredentials } from "./credentials.js";

/**
 * Extracts the resource group name from an Azure resource ID.
 */
function extractResourceGroup(resourceId: string | undefined): string | null {
  if (!resourceId) return null;
  const match = resourceId.match(/\/resourceGroups\/([^/]+)/i);
  return match ? match[1] : null;
}

/**
 * Extracts the resource name from an Azure resource ID (last segment).
 */
function extractResourceName(resourceId: string | undefined): string | null {
  if (!resourceId) return null;
  const segments = resourceId.split("/");
  return segments[segments.length - 1] ?? null;
}

/**
 * Runs all Azure Compute security checks and returns findings.
 *
 * Checks:
 * 1. azure_vm_unencrypted_disk — OS disk without encryption
 * 2. azure_vm_no_managed_disk — VM using unmanaged (VHD) disks
 * 3. azure_vm_public_ip — VM with a public IP address attached
 */
export async function auditAzureCompute(
  creds: AzureCredentials,
): Promise<AgentFindingPayload[]> {
  const computeClient = new ComputeManagementClient(
    creds.credential,
    creds.subscriptionId,
  );
  const networkClient = new NetworkManagementClient(
    creds.credential,
    creds.subscriptionId,
  );

  const findings: AgentFindingPayload[] = [];

  for await (const vm of computeClient.virtualMachines.listAll()) {
    const vmName = vm.name ?? "unknown";
    const vmId = vm.id ?? vmName;

    // Check 1: Unencrypted OS disk
    const osDisk = vm.storageProfile?.osDisk;
    const hasEncryptionSettings = osDisk?.encryptionSettings?.enabled === true;
    const hasDiskEncryptionSet =
      osDisk?.managedDisk?.diskEncryptionSet != null;

    if (!hasEncryptionSettings && !hasDiskEncryptionSet) {
      findings.push({
        title: `VM "${vmName}" has an unencrypted OS disk`,
        description: `Virtual machine ${vmName} (${vmId}) does not have disk encryption enabled on its OS disk. Neither Azure Disk Encryption (encryptionSettings) nor a Disk Encryption Set is configured. Enable disk encryption to protect data at rest.`,
        severity: "high",
        category: "encryption",
        resourceType: "Microsoft.Compute/virtualMachines",
        resourceId: vmId,
        remediationTier: "manual",
        autoFixAvailable: false,
        controlMappings: mapCheckToControls("azure_vm_unencrypted_disk"),
      });
    }

    // Check 2: Unmanaged disk (VHD)
    if (osDisk?.vhd) {
      findings.push({
        title: `VM "${vmName}" uses an unmanaged (VHD) disk`,
        description: `Virtual machine ${vmName} (${vmId}) uses an unmanaged VHD disk instead of an Azure Managed Disk. Unmanaged disks require manual storage account management and lack built-in redundancy, encryption, and RBAC. Migrate to Managed Disks.`,
        severity: "medium",
        category: "config",
        resourceType: "Microsoft.Compute/virtualMachines",
        resourceId: vmId,
        remediationTier: "manual",
        autoFixAvailable: false,
        controlMappings: mapCheckToControls("azure_vm_no_managed_disk"),
      });
    }

    // Check 3: Public IP on VM network interfaces
    const networkInterfaces = vm.networkProfile?.networkInterfaces ?? [];

    for (const nicRef of networkInterfaces) {
      if (!nicRef.id) continue;

      const nicRg = extractResourceGroup(nicRef.id);
      const nicName = extractResourceName(nicRef.id);

      if (!nicRg || !nicName) continue;

      try {
        const nic = await networkClient.networkInterfaces.get(nicRg, nicName);

        for (const ipConfig of nic.ipConfigurations ?? []) {
          if (ipConfig.publicIPAddress) {
            findings.push({
              title: `VM "${vmName}" has a public IP address`,
              description: `Virtual machine ${vmName} (${vmId}) has a public IP address attached via NIC "${nicName}" (IP configuration: ${ipConfig.name ?? "default"}). VMs with public IPs are directly exposed to the internet. Use a load balancer, NAT gateway, or Azure Bastion instead.`,
              severity: "medium",
              category: "network",
              resourceType: "Microsoft.Compute/virtualMachines",
              resourceId: vmId,
              remediationTier: "manual",
              autoFixAvailable: false,
              controlMappings: mapCheckToControls("azure_vm_public_ip"),
            });
            break; // One finding per VM is sufficient
          }
        }
      } catch {
        // Skip NIC if we cannot read it (permissions)
      }
    }
  }

  return findings;
}
