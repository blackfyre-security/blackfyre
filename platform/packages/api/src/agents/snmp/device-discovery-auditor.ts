import type { AgentFindingPayload } from "@blackfyre/shared";
import type { SNMPConfig } from "../snmp-auditor.js";
import { expandTargets, OID, type SnmpGetFn } from "./snmp-client.js";

export interface DiscoveredDevice {
  ip: string;
  sysName: string;
  vendor: string;
  deviceType: "router" | "switch" | "firewall" | "ap" | "server" | "printer" | "unknown";
  sysDescr: string;
  firmwareVersion: string;
}

function detectVendor(sysObjectId: string): string {
  if (sysObjectId.startsWith("1.3.6.1.4.1.9."))    return "Cisco";
  if (sysObjectId.startsWith("1.3.6.1.4.1.14988.")) return "MikroTik";
  if (sysObjectId.startsWith("1.3.6.1.4.1.2636."))  return "Juniper";
  if (sysObjectId.startsWith("1.3.6.1.4.1.11."))    return "HP/Aruba";
  if (sysObjectId.startsWith("1.3.6.1.4.1.1916."))  return "Extreme Networks";
  if (sysObjectId.startsWith("1.3.6.1.4.1.1991."))  return "Foundry/Brocade";
  if (sysObjectId.startsWith("1.3.6.1.4.1.25506.")) return "H3C";
  return "Unknown";
}

function categorizeDevice(sysDescr: string): DiscoveredDevice["deviceType"] {
  const desc = sysDescr.toLowerCase();
  if (desc.includes("firewall") || desc.includes("asa") || desc.includes("pix") || desc.includes("fortigate")) return "firewall";
  if (desc.includes("access point") || desc.includes("wireless") || desc.includes("aironet") || desc.includes("wlan")) return "ap";
  if (desc.includes("router") || desc.includes("ios xr") || desc.includes("junos")) return "router";
  if (desc.includes("switch") || desc.includes("catalyst") || desc.includes("nexus") || desc.includes("ex series")) return "switch";
  if (desc.includes("windows") || desc.includes("linux") || desc.includes("ubuntu") || desc.includes("server")) return "server";
  if (desc.includes("printer") || desc.includes("laserjet") || desc.includes("officejet")) return "printer";
  return "unknown";
}

function extractFirmwareVersion(sysDescr: string): string {
  const patterns = [
    /Version\s+([\d.]+(?:\([^)]+\))?)/i,
    /IOS\s+[\w\s]+,\s+Version\s+([\d.]+)/i,
    /Firmware\s+Version:\s*([\d.]+)/i,
    /v([\d]+\.[\d]+\.[\d]+)/i,
  ];
  for (const p of patterns) {
    const m = sysDescr.match(p);
    if (m) return m[1];
  }
  return "Unknown";
}

function isEolFirmware(sysDescr: string): boolean {
  return [/IOS\s+12\./i, /IOS\s+11\./i, /IOS\s+10\./i].some((p) => p.test(sysDescr));
}

/**
 * Device Discovery Sub-auditor
 *
 * Performs SNMP GET against target IPs to discover device type, vendor,
 * and firmware version. Flags end-of-life firmware patterns.
 */
export async function auditDeviceDiscovery(
  config: SNMPConfig,
  snmpGet: SnmpGetFn,
): Promise<{ findings: AgentFindingPayload[]; discoveredDevices: DiscoveredDevice[] }> {
  const findings: AgentFindingPayload[] = [];
  const discoveredDevices: DiscoveredDevice[] = [];

  for (const ip of expandTargets(config.targets)) {
    const sysDescr = await snmpGet(ip, config, OID.sysDescr);
    if (!sysDescr) continue;

    const sysObjectId = await snmpGet(ip, config, OID.sysObjectID) ?? "";
    const sysName = await snmpGet(ip, config, OID.sysName) ?? ip;
    const vendor = detectVendor(sysObjectId);
    const deviceType = categorizeDevice(sysDescr);
    const firmwareVersion = extractFirmwareVersion(sysDescr);

    discoveredDevices.push({ ip, sysName, vendor, deviceType, sysDescr, firmwareVersion });

    if (isEolFirmware(sysDescr)) {
      findings.push({
        title: `End-of-Life Firmware Detected: ${sysName} (${ip})`,
        description: `Device ${sysName} (${ip}) is running firmware "${firmwareVersion}" which may be end-of-life or end-of-support. Devices with EOL firmware no longer receive security patches. Upgrade to a supported firmware version immediately to remediate known CVEs.`,
        severity: "high",
        category: "network",
        resourceType: "network_device",
        resourceId: `${ip}/${sysName}`,
        resourceRegion: null,
        remediationTier: "manual",
        autoFixAvailable: false,
      });
    }
  }

  if (discoveredDevices.length === 0) {
    findings.push({
      title: `No SNMP-Responsive Devices Found in Scan Scope`,
      description: `No devices responded to SNMP queries in the specified target range. This may indicate that SNMP is disabled (good practice), targets are not reachable, or the community string / credentials are incorrect. Verify scan targets and credentials.`,
      severity: "low",
      category: "network",
      resourceType: "network_device",
      resourceId: config.targets.join(","),
      resourceRegion: null,
      remediationTier: "manual",
      autoFixAvailable: false,
    });
  }

  return { findings, discoveredDevices };
}
