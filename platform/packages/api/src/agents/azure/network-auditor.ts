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
 * Checks whether a source address prefix represents "any" origin.
 * Azure uses string values, not CIDR arrays.
 */
function isFromAny(sourceAddressPrefix: string | undefined): boolean {
  if (!sourceAddressPrefix) return false;
  return (
    sourceAddressPrefix === "*" ||
    sourceAddressPrefix === "Internet" ||
    sourceAddressPrefix === "0.0.0.0/0"
  );
}

/**
 * Runs all Azure Network security checks and returns findings.
 *
 * Checks:
 * 1. azure_nsg_ssh_from_any — NSG allows SSH (port 22) from any source
 * 2. azure_nsg_rdp_from_any — NSG allows RDP (port 3389) from any source
 * 3. azure_nsg_all_inbound — NSG allows all inbound traffic from any source
 * 4. azure_nsg_no_flow_logs — NSG has no flow logs configured
 */
export async function auditAzureNetwork(
  creds: AzureCredentials,
): Promise<AgentFindingPayload[]> {
  const client = new NetworkManagementClient(
    creds.credential,
    creds.subscriptionId,
  );
  const findings: AgentFindingPayload[] = [];

  for await (const nsg of client.networkSecurityGroups.listAll()) {
    const nsgName = nsg.name ?? "unknown";
    const nsgId = nsg.id ?? nsgName;
    const resourceGroup = extractResourceGroup(nsg.id);

    // Check security rules for dangerous inbound patterns
    for (const rule of nsg.securityRules ?? []) {
      // Only inspect Allow + Inbound rules
      if (rule.access !== "Allow" || rule.direction !== "Inbound") continue;
      if (!isFromAny(rule.sourceAddressPrefix)) continue;

      const port = rule.destinationPortRange;
      const isAllPorts = port === "*";
      const isSsh = port === "22" || isAllPorts;
      const isRdp = port === "3389" || isAllPorts;

      // SSH from any
      if (isSsh) {
        findings.push({
          title: `NSG "${nsgName}" allows SSH (port 22) from any source`,
          description: `Network Security Group ${nsgName} (${nsgId}) has rule "${rule.name}" that allows inbound SSH access from ${rule.sourceAddressPrefix}. This exposes SSH to the entire internet. Restrict the source to specific IP ranges or use Azure Bastion.`,
          severity: "critical",
          category: "network",
          resourceType: "Microsoft.Network/networkSecurityGroups",
          resourceId: nsgId,
          remediationTier: "approval",
          autoFixAvailable: false,
          controlMappings: mapCheckToControls("azure_nsg_ssh_from_any"),
        });
      }

      // RDP from any
      if (isRdp) {
        findings.push({
          title: `NSG "${nsgName}" allows RDP (port 3389) from any source`,
          description: `Network Security Group ${nsgName} (${nsgId}) has rule "${rule.name}" that allows inbound RDP access from ${rule.sourceAddressPrefix}. This exposes RDP to the entire internet. Restrict the source to specific IP ranges or use Azure Bastion.`,
          severity: "critical",
          category: "network",
          resourceType: "Microsoft.Network/networkSecurityGroups",
          resourceId: nsgId,
          remediationTier: "approval",
          autoFixAvailable: false,
          controlMappings: mapCheckToControls("azure_nsg_rdp_from_any"),
        });
      }

      // All inbound (only if not already flagged as SSH/RDP specific)
      if (isAllPorts && !isSsh && !isRdp) {
        // This branch won't trigger because isAllPorts implies isSsh and isRdp.
        // The separate all-inbound finding below handles it.
      }

      // Dedicated all-inbound check: port "*" means all ports are open
      if (isAllPorts) {
        findings.push({
          title: `NSG "${nsgName}" allows ALL inbound traffic from any source`,
          description: `Network Security Group ${nsgName} (${nsgId}) has rule "${rule.name}" that allows all inbound traffic on all ports from ${rule.sourceAddressPrefix}. This effectively disables network-level access control. Restrict inbound rules to only required ports and sources.`,
          severity: "critical",
          category: "network",
          resourceType: "Microsoft.Network/networkSecurityGroups",
          resourceId: nsgId,
          remediationTier: "approval",
          autoFixAvailable: false,
          controlMappings: mapCheckToControls("azure_nsg_all_inbound"),
        });
      }
    }

    // Check 4: Flow logs
    if (resourceGroup) {
      try {
        let hasFlowLogs = false;

        for await (const _flowLog of client.flowLogs.list(
          resourceGroup,
          nsgName,
        )) {
          hasFlowLogs = true;
          break;
        }

        if (!hasFlowLogs) {
          findings.push({
            title: `NSG "${nsgName}" has no flow logs configured`,
            description: `Network Security Group ${nsgName} (${nsgId}) does not have NSG flow logs enabled. Flow logs are essential for monitoring network traffic, detecting anomalies, and meeting compliance requirements. Enable flow logs and send them to a storage account or Log Analytics workspace.`,
            severity: "medium",
            category: "logging",
            resourceType: "Microsoft.Network/networkSecurityGroups",
            resourceId: nsgId,
            remediationTier: "manual",
            autoFixAvailable: false,
            controlMappings: mapCheckToControls("azure_nsg_no_flow_logs"),
          });
        }
      } catch {
        // Skip flow log check if API is unavailable
      }
    }
  }

  return findings;
}
