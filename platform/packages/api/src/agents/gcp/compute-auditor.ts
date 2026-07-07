import {
  FirewallsClient,
  InstancesClient,
  DisksClient,
} from "@google-cloud/compute";
import type { AgentFindingPayload } from "@blackfyre/shared";
import { mapCheckToControls } from "../../services/compliance-mapper.js";
import type { GcpCredentials } from "./credentials.js";

/**
 * Runs all GCP Compute security checks and returns findings.
 *
 * Checks:
 * 1. gcp_fw_ssh_from_any — Firewall allows SSH (port 22) from 0.0.0.0/0
 * 2. gcp_fw_rdp_from_any — Firewall allows RDP (port 3389) from 0.0.0.0/0
 * 3. gcp_vm_serial_port — VM has serial port access enabled
 * 4. gcp_disk_not_encrypted_cmek — Disk not encrypted with CMEK
 */
export async function auditGcpCompute(
  creds: GcpCredentials,
): Promise<AgentFindingPayload[]> {
  const authClient = await creds.auth.getClient();

  const [fwFindings, vmFindings, diskFindings] = await Promise.all([
    checkFirewallRules(authClient, creds.projectId),
    checkSerialPortAccess(authClient, creds.projectId),
    checkDiskEncryption(authClient, creds.projectId),
  ]);

  return [...fwFindings, ...vmFindings, ...diskFindings];
}

// ---------------------------------------------------------------------------
// Check firewall rules for SSH/RDP open to the internet
// ---------------------------------------------------------------------------

async function checkFirewallRules(
  authClient: unknown,
  projectId: string,
): Promise<AgentFindingPayload[]> {
  const findings: AgentFindingPayload[] = [];
  const client = new FirewallsClient({ authClient: authClient as any });

  const iterable = client.listAsync({ project: projectId });

  for await (const rule of iterable) {
    // Only check ingress rules with allowed protocols
    if (rule.direction !== "INGRESS") continue;
    if (!rule.allowed || rule.allowed.length === 0) continue;

    // Check if source ranges include 0.0.0.0/0
    const sourceRanges = rule.sourceRanges ?? [];
    if (!sourceRanges.includes("0.0.0.0/0")) continue;

    for (const allowed of rule.allowed) {
      const protocol = allowed.IPProtocol ?? "";
      const ports = allowed.ports ?? [];

      // Check if SSH (port 22) is allowed
      if (isPortAllowed(protocol, ports, 22)) {
        findings.push({
          title: `Firewall rule "${rule.name}" allows SSH from 0.0.0.0/0`,
          description: `GCP firewall rule "${rule.name}" in project ${projectId} allows inbound SSH (port 22) access from the entire internet (0.0.0.0/0). Restrict SSH access to known IP ranges or use IAP tunnels.`,
          severity: "critical",
          category: "network",
          resourceType: "compute.googleapis.com/Firewall",
          resourceId: rule.name ?? "unknown",
          remediationTier: "approval",
          autoFixAvailable: false,
          controlMappings: mapCheckToControls("gcp_fw_ssh_from_any"),
        });
      }

      // Check if RDP (port 3389) is allowed
      if (isPortAllowed(protocol, ports, 3389)) {
        findings.push({
          title: `Firewall rule "${rule.name}" allows RDP from 0.0.0.0/0`,
          description: `GCP firewall rule "${rule.name}" in project ${projectId} allows inbound RDP (port 3389) access from the entire internet (0.0.0.0/0). Restrict RDP access to known IP ranges or use IAP tunnels.`,
          severity: "critical",
          category: "network",
          resourceType: "compute.googleapis.com/Firewall",
          resourceId: rule.name ?? "unknown",
          remediationTier: "approval",
          autoFixAvailable: false,
          controlMappings: mapCheckToControls("gcp_fw_rdp_from_any"),
        });
      }
    }
  }

  return findings;
}

/**
 * Checks if a specific port is allowed by a firewall allowed entry.
 * Handles "all" protocol, port ranges (e.g. "20-25"), and empty ports (= all).
 */
function isPortAllowed(
  protocol: string,
  ports: string[],
  targetPort: number,
): boolean {
  // "all" protocol means all traffic
  if (protocol === "all") return true;

  // Only TCP is relevant for SSH/RDP
  if (protocol !== "tcp") return false;

  // Empty ports array means all ports for this protocol
  if (ports.length === 0) return true;

  for (const portSpec of ports) {
    if (portSpec.includes("-")) {
      const [start, end] = portSpec.split("-").map(Number);
      if (targetPort >= start && targetPort <= end) return true;
    } else {
      if (Number(portSpec) === targetPort) return true;
    }
  }

  return false;
}

// ---------------------------------------------------------------------------
// Check VMs for serial port access enabled
// ---------------------------------------------------------------------------

async function checkSerialPortAccess(
  authClient: unknown,
  projectId: string,
): Promise<AgentFindingPayload[]> {
  const findings: AgentFindingPayload[] = [];
  const client = new InstancesClient({ authClient: authClient as any });

  const iterable = client.aggregatedListAsync({ project: projectId });

  for await (const [zonePath, scopedList] of iterable) {
    const instances = scopedList.instances ?? [];
    for (const instance of instances) {
      const metadataItems = instance.metadata?.items ?? [];

      const serialPortEnabled = metadataItems.some(
        (item: { key?: string | null; value?: string | null }) =>
          item.key === "serial-port-enable" &&
          (item.value === "true" || item.value === "1"),
      );

      if (serialPortEnabled) {
        const zone = zonePath.replace("zones/", "");
        findings.push({
          title: `VM instance "${instance.name}" has serial port access enabled`,
          description: `VM instance ${instance.name} in zone ${zone} has serial port access enabled via metadata. Serial port access can be used to interact with the VM console and should be disabled unless required for debugging.`,
          severity: "medium",
          category: "config",
          resourceType: "compute.googleapis.com/Instance",
          resourceId: instance.name ?? "unknown",
          remediationTier: "auto",
          autoFixAvailable: true,
          controlMappings: mapCheckToControls("gcp_vm_serial_port"),
        });
      }
    }
  }

  return findings;
}

// ---------------------------------------------------------------------------
// Check disks for CMEK encryption
// ---------------------------------------------------------------------------

async function checkDiskEncryption(
  authClient: unknown,
  projectId: string,
): Promise<AgentFindingPayload[]> {
  const findings: AgentFindingPayload[] = [];
  const client = new DisksClient({ authClient: authClient as any });

  const iterable = client.aggregatedListAsync({ project: projectId });

  for await (const [zonePath, scopedList] of iterable) {
    const disks = scopedList.disks ?? [];
    for (const disk of disks) {
      if (!disk.diskEncryptionKey?.kmsKeyName) {
        const zone = zonePath.replace("zones/", "");
        findings.push({
          title: `Disk "${disk.name}" is not encrypted with a customer-managed key`,
          description: `Disk ${disk.name} in zone ${zone} (${disk.sizeGb ?? "?"}GB) does not use a customer-managed encryption key (CMEK). While Google-managed encryption is applied by default, CMEK provides additional control over key lifecycle.`,
          severity: "medium",
          category: "encryption",
          resourceType: "compute.googleapis.com/Disk",
          resourceId: disk.name ?? "unknown",
          remediationTier: "manual",
          autoFixAvailable: false,
          controlMappings: mapCheckToControls("gcp_disk_not_encrypted_cmek"),
        });
      }
    }
  }

  return findings;
}
