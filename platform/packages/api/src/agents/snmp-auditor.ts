import { BaseAgent, type AgentContext, type AgentRunResult } from "./base-agent.js";
import { snmpGet, snmpWalk, checkPort, expandTargets, OID } from "./snmp/snmp-client.js";
import { auditDeviceDiscovery } from "./snmp/device-discovery-auditor.js";
import { auditConfigCompliance } from "./snmp/config-compliance-auditor.js";
import { auditACLs } from "./snmp/acl-auditor.js";

export interface SNMPConfig {
  targets: string[]; // IP ranges or individual IPs
  version: "v2c" | "v3";
  community?: string; // v2c
  auth?: {
    user: string;
    authProtocol: "SHA" | "MD5";
    authKey: string;
    privProtocol?: "AES" | "DES";
    privKey?: string;
  }; // v3
}

/**
 * SNMP Network Auditor Agent
 *
 * Scans: Device discovery (device type, firmware), configuration compliance
 * (community strings, SNMP version), and ACL completeness.
 * Integration: SNMP v2c/v3 via UDP 161
 *
 * Sub-auditors:
 * - device-discovery-auditor: SNMP GET walks, vendor/type detection, EOL firmware
 * - config-compliance-auditor: SNMP version, community strings, Telnet/HTTP presence
 * - acl-auditor: default routes, interface ACLs, SNMP source restrictions, firewall presence
 */
export class SnmpAuditorAgent extends BaseAgent {
  readonly type = "snmp-auditor";
  readonly displayName = "SNMP Network Auditor";
  readonly supportedIntegrations = ["snmp", "network_device"];

  private parseConfig(credentialRef: string): SNMPConfig {
    try {
      return JSON.parse(credentialRef);
    } catch {
      const ref = credentialRef.replace("vault://", "");
      return {
        targets: ref.split(",").map((s) => s.trim()).filter(Boolean),
        version: "v2c",
        community: "public",
      };
    }
  }

  async run(ctx: AgentContext): Promise<AgentRunResult> {
    const startedAt = new Date();
    let findingsCount = 0;
    const config = this.parseConfig(ctx.credentialRef);

    try {
      ctx.onProgress(0);

      // Phase 1: Device Discovery (0-33%)
      const { findings: discoveryFindings, discoveredDevices } = await auditDeviceDiscovery(config, snmpGet);
      for (const f of discoveryFindings) { await ctx.onFinding(f); findingsCount++; }
      ctx.onProgress(33);

      // Phase 2: Configuration Compliance (33-66%)
      const complianceFindings = await auditConfigCompliance(config, discoveredDevices, checkPort);
      for (const f of complianceFindings) { await ctx.onFinding(f); findingsCount++; }
      ctx.onProgress(66);

      // Phase 3: ACL Audit (66-100%)
      const aclFindings = await auditACLs(config, discoveredDevices, snmpWalk);
      for (const f of aclFindings) { await ctx.onFinding(f); findingsCount++; }
      ctx.onProgress(100);

      return this.createResult(startedAt, findingsCount);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return this.createResult(startedAt, findingsCount, message);
    }
  }

  async testConnection(credentialRef: string): Promise<boolean> {
    const config = this.parseConfig(credentialRef);
    if (config.targets.length === 0) return false;

    const firstTarget = expandTargets(config.targets)[0];
    if (!firstTarget) return false;

    const result = await snmpGet(firstTarget, config, OID.sysDescr);
    return result !== null;
  }
}
