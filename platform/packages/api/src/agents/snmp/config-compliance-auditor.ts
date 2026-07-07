import type { AgentFindingPayload } from "@blackfyre/shared";
import type { SNMPConfig } from "../snmp-auditor.js";
import type { DiscoveredDevice } from "./device-discovery-auditor.js";
import type { PortCheckFn } from "./snmp-client.js";

const DEFAULT_COMMUNITY_STRINGS = new Set([
  "public", "private", "community", "cisco", "admin", "manager",
  "snmp", "network", "system", "monitor", "read", "write", "secret",
]);

/**
 * Configuration Compliance Sub-auditor
 *
 * Checks: default community strings, SNMP v1/v2c usage (should be v3),
 * MD5/DES deprecation, unencrypted management protocols on discovered devices.
 */
export async function auditConfigCompliance(
  config: SNMPConfig,
  discoveredDevices: DiscoveredDevice[],
  checkPort: PortCheckFn,
): Promise<AgentFindingPayload[]> {
  const findings: AgentFindingPayload[] = [];

  // Check 1: SNMP v1/v2c in use — must be v3
  if (config.version !== "v3") {
    findings.push({
      title: `Insecure SNMP Version in Use: ${config.version} (should be v3)`,
      description: `SNMP ${config.version} is being used for network device management. SNMP v1 and v2c transmit community strings in plaintext, allowing any attacker who captures network traffic to read full device configurations and MIB data. SNMP v3 with authentication (SHA) and encryption (AES) is required by CIS Controls and PCI-DSS Network Security requirements. Migrate all devices to SNMPv3 with authPriv security level.`,
      severity: "high",
      category: "network",
      resourceType: "snmp_config",
      resourceId: "snmp-version",
      resourceRegion: null,
      remediationTier: "approval",
      autoFixAvailable: false,
    });
  }

  // Check 2: SNMPv3 without privacy (authNoPriv)
  if (config.version === "v3" && config.auth && !config.auth.privProtocol) {
    findings.push({
      title: `SNMPv3 Authentication Without Encryption (authNoPriv)`,
      description: `SNMPv3 is configured with authentication but without privacy (encryption). The authNoPriv security level authenticates SNMP requests but transmits all OID data in plaintext. Use authPriv with AES-128 or AES-256 to ensure both authentication and encryption of management traffic.`,
      severity: "medium",
      category: "network",
      resourceType: "snmp_config",
      resourceId: "snmp-v3-privacy",
      resourceRegion: null,
      remediationTier: "manual",
      autoFixAvailable: false,
    });
  }

  // Check 3: SNMPv3 with MD5 (deprecated)
  if (config.version === "v3" && config.auth?.authProtocol === "MD5") {
    findings.push({
      title: `SNMPv3 Using MD5 Authentication Protocol (Deprecated)`,
      description: `SNMPv3 is configured with MD5 as the authentication protocol. MD5 is cryptographically broken and deprecated in RFC 7860. Migrate to SHA-256 or SHA-512 authentication protocol on all devices.`,
      severity: "medium",
      category: "network",
      resourceType: "snmp_config",
      resourceId: "snmp-v3-md5",
      resourceRegion: null,
      remediationTier: "manual",
      autoFixAvailable: false,
    });
  }

  // Check 4: SNMPv3 with DES (deprecated)
  if (config.version === "v3" && config.auth?.privProtocol === "DES") {
    findings.push({
      title: `SNMPv3 Using DES Privacy Protocol (Deprecated)`,
      description: `SNMPv3 is configured with DES as the privacy protocol. DES uses a 56-bit key and is considered cryptographically broken. Migrate to AES-128 or AES-256 for SNMPv3 privacy to ensure secure management traffic encryption.`,
      severity: "medium",
      category: "network",
      resourceType: "snmp_config",
      resourceId: "snmp-v3-des",
      resourceRegion: null,
      remediationTier: "manual",
      autoFixAvailable: false,
    });
  }

  // Check 5: Default community strings
  if (config.version === "v2c" && config.community) {
    if (DEFAULT_COMMUNITY_STRINGS.has(config.community.toLowerCase())) {
      findings.push({
        title: `Default SNMP Community String in Use: "${config.community}"`,
        description: `The SNMP community string "${config.community}" is a well-known default. Attackers routinely attempt default community strings to gain read or write access to network device configurations. Change all SNMP community strings to randomly generated, high-entropy values and restrict SNMP access to dedicated management IP ranges.`,
        severity: "critical",
        category: "network",
        resourceType: "snmp_config",
        resourceId: "snmp-community",
        resourceRegion: null,
        remediationTier: "approval",
        autoFixAvailable: false,
      });
    }
  }

  // Check 6: Unencrypted management protocols on discovered devices
  const telnetDevices: string[] = [];
  const httpDevices: string[] = [];

  for (const device of discoveredDevices.slice(0, 20)) {
    const [hasTelnet, hasHttp] = await Promise.all([
      checkPort(device.ip, 23),
      checkPort(device.ip, 80),
    ]);
    if (hasTelnet) telnetDevices.push(device.ip);
    if (hasHttp) httpDevices.push(device.ip);
  }

  if (telnetDevices.length > 0) {
    findings.push({
      title: `Telnet Enabled on ${telnetDevices.length} Network Device(s)`,
      description: `${telnetDevices.length} network device(s) have Telnet (port 23) enabled for management. Telnet transmits all data including passwords in plaintext, making it trivially interceptable. Disable Telnet and enable SSH (SSHv2) with strong key algorithms on all network devices. Required by PCI-DSS Requirement 2.2.7.`,
      severity: "critical",
      category: "network",
      resourceType: "network_device",
      resourceId: telnetDevices.join(","),
      resourceRegion: null,
      remediationTier: "approval",
      autoFixAvailable: false,
    });
  }

  if (httpDevices.length > 0) {
    findings.push({
      title: `Unencrypted HTTP Management Interface on ${httpDevices.length} Device(s)`,
      description: `${httpDevices.length} network device(s) expose management interfaces over HTTP (port 80). Unencrypted management allows credential interception and session hijacking. Disable HTTP and enable HTTPS-only management on all devices.`,
      severity: "high",
      category: "network",
      resourceType: "network_device",
      resourceId: httpDevices.join(","),
      resourceRegion: null,
      remediationTier: "manual",
      autoFixAvailable: false,
    });
  }

  return findings;
}
