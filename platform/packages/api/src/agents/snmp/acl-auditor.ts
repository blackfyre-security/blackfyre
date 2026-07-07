import type { AgentFindingPayload } from "@blackfyre/shared";
import type { SNMPConfig } from "../snmp-auditor.js";
import type { DiscoveredDevice } from "./device-discovery-auditor.js";
import type { SnmpWalkFn } from "./snmp-client.js";

/**
 * ACL Audit Sub-auditor
 *
 * Checks: overly permissive ACLs, multiple default routes, missing egress filtering,
 * SNMP access without source IP restriction, absence of firewall device.
 */
export async function auditACLs(
  config: SNMPConfig,
  discoveredDevices: DiscoveredDevice[],
  snmpWalk: SnmpWalkFn,
): Promise<AgentFindingPayload[]> {
  const findings: AgentFindingPayload[] = [];
  const routerOrFirewall = discoveredDevices.filter((d) => d.deviceType === "router" || d.deviceType === "firewall");

  for (const device of routerOrFirewall) {
    // Walk IP route table to detect multiple default routes
    const routeEntries = await snmpWalk(device.ip, config, "1.3.6.1.2.1.4.21");
    const defaultRoutes = routeEntries.filter((e) => String(e.value ?? "").startsWith("0.0.0.0"));

    if (defaultRoutes.length > 1) {
      findings.push({
        title: `Multiple Default Routes on ${device.sysName} (${device.ip})`,
        description: `Device ${device.sysName} has ${defaultRoutes.length} default routes configured. Multiple default routes can indicate misconfigured routing that may allow traffic to bypass security controls. Verify that only intended default routes exist and all traffic flows through the correct security inspection points.`,
        severity: "medium",
        category: "network",
        resourceType: "network_acl",
        resourceId: `${device.ip}/routing`,
        resourceRegion: null,
        remediationTier: "manual",
        autoFixAvailable: false,
      });
    }

    // Walk interface descriptions for ACL mentions
    const ifDesc = await snmpWalk(device.ip, config, "1.3.6.1.2.1.31.1.1.1.18");
    const withoutAcl = ifDesc.filter((e) => {
      const desc = String(e.value ?? "").toLowerCase();
      return !desc.includes("acl") && !desc.includes("filter") && !desc.includes("access-group");
    });

    if (ifDesc.length > 0 && withoutAcl.length === ifDesc.length) {
      findings.push({
        title: `No ACLs Detected on ${device.sysName} (${device.ip}) Interfaces`,
        description: `No access control lists appear to be applied to any interface on ${device.sysName}. Unfiltered interfaces allow all traffic to pass without inspection, violating the principle of least-privilege for network communications. Apply inbound ACLs on all external-facing interfaces to restrict traffic to permitted services only.`,
        severity: "high",
        category: "network",
        resourceType: "network_acl",
        resourceId: `${device.ip}/acl`,
        resourceRegion: null,
        remediationTier: "manual",
        autoFixAvailable: false,
      });
    }
  }

  // Check SNMP access restriction per device
  for (const device of discoveredDevices) {
    const communityTable = await snmpWalk(device.ip, config, "1.3.6.1.6.3.18.1.1.1");
    const hasSourceRestriction = communityTable.some(
      (e) => String(e.oid ?? "").includes("CommunityTransportTag") && String(e.value ?? "") !== "",
    );

    if (!hasSourceRestriction && communityTable.length > 0) {
      findings.push({
        title: `SNMP Access Not Restricted by Source IP: ${device.sysName} (${device.ip})`,
        description: `Device ${device.sysName} does not restrict SNMP access by source IP address. Without source IP restrictions, any host on the network can query or write SNMP data. Configure SNMP community or user access to permit queries only from dedicated NMS/monitoring IP addresses.`,
        severity: "medium",
        category: "network",
        resourceType: "snmp_config",
        resourceId: `${device.ip}/snmp-acl`,
        resourceRegion: null,
        remediationTier: "manual",
        autoFixAvailable: false,
      });
    }
  }

  // Flag if no firewall was found in a reasonably-sized segment
  const hasFirewall = discoveredDevices.some((d) => d.deviceType === "firewall");
  if (!hasFirewall && discoveredDevices.length > 3) {
    findings.push({
      title: `No Dedicated Firewall Detected in Network Segment`,
      description: `SNMP discovery did not identify a dedicated firewall device in the scanned network segment. Without a perimeter firewall, egress traffic is uncontrolled, allowing malware to exfiltrate data and establish command-and-control channels. Deploy a Next-Generation Firewall with strict egress filtering and application awareness.`,
      severity: "high",
      category: "network",
      resourceType: "network_acl",
      resourceId: config.targets.join(","),
      resourceRegion: null,
      remediationTier: "manual",
      autoFixAvailable: false,
    });
  }

  return findings;
}
