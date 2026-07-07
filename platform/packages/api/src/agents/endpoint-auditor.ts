import { BaseAgent, type AgentContext, type AgentRunResult } from "./base-agent.js";
import type { AgentFindingPayload } from "@blackfyre/shared";
// SECURITY FIX (BLACKFYRE audit 2026-06-05): SSRF — customer-controlled apiUrl was fetched
// with raw fetch(), allowing a read-SSRF oracle to reach internal/cloud-metadata endpoints
// (e.g. 169.254.169.254) and steal cloud credentials. All outbound calls to the tenant-
// supplied apiUrl now route through safeFetch(), which blocks private/reserved targets and
// re-validates every redirect hop. SsrfBlockedError is caught to distinguish a policy
// rejection from an ordinary network error.
import { safeFetch, SsrfBlockedError } from "../lib/safe-fetch.js";

interface EndpointConfig {
  provider: "jamf" | "intune" | "crowdstrike";
  apiUrl: string;
  apiKey?: string;
  tenantId?: string;
}

/**
 * Endpoint Auditor Agent
 *
 * Scans: Device compliance, encryption, patching
 * Integration: Jamf API, Intune Graph API, CrowdStrike Falcon API
 *
 * When real API access is available, fetches device inventories.
 * When credentials are config-only, performs configuration audit
 * against endpoint security best practices.
 */
export class EndpointAuditorAgent extends BaseAgent {
  readonly type = "endpoint-auditor";
  readonly displayName = "Endpoint Auditor";
  readonly supportedIntegrations = ["jamf", "intune", "crowdstrike"];

  private parseConfig(credentialRef: string): EndpointConfig {
    try {
      return JSON.parse(credentialRef);
    } catch {
      const provider = credentialRef.includes("jamf") ? "jamf"
        : credentialRef.includes("intune") ? "intune"
        : "crowdstrike";
      return { provider, apiUrl: credentialRef.replace("vault://", "") };
    }
  }

  async run(ctx: AgentContext): Promise<AgentRunResult> {
    const startedAt = new Date();
    let findingsCount = 0;
    const config = this.parseConfig(ctx.credentialRef);

    try {
      ctx.onProgress(0);

      // Phase 1: Device Compliance Audit (0-33%)
      const deviceFindings = await this.auditDeviceCompliance(config, ctx);
      for (const f of deviceFindings) { await ctx.onFinding(f); findingsCount++; }
      ctx.onProgress(33);

      // Phase 2: Encryption Audit (33-66%)
      const encryptionFindings = await this.auditEncryption(config, ctx);
      for (const f of encryptionFindings) { await ctx.onFinding(f); findingsCount++; }
      ctx.onProgress(66);

      // Phase 3: Patching Audit (66-100%)
      const patchingFindings = await this.auditPatching(config, ctx);
      for (const f of patchingFindings) { await ctx.onFinding(f); findingsCount++; }
      ctx.onProgress(100);

      return this.createResult(startedAt, findingsCount);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return this.createResult(startedAt, findingsCount, message);
    }
  }

  private async auditDeviceCompliance(config: EndpointConfig, ctx: AgentContext): Promise<AgentFindingPayload[]> {
    const results: AgentFindingPayload[] = [];

    if (config.apiKey || config.apiUrl.startsWith("https://")) {
      // Attempt real API call for device inventory
      try {
        const devices = await this.fetchDeviceInventory(config);
        if (devices) {
          const outdatedOs = devices.filter((d: any) => d.osOutdated);
          if (outdatedOs.length > 0) {
            results.push({ title: `Outdated OS: ${outdatedOs.length} devices running unsupported OS versions`, description: `${outdatedOs.length} managed devices are running operating system versions that are no longer receiving security updates. This exposes the organization to unpatched vulnerabilities. Devices should be upgraded to current OS versions within 30 days.`, severity: "high", category: "endpoint", resourceType: "device", resourceId: `${config.provider}/${outdatedOs.length}-devices`, resourceRegion: null, remediationTier: "manual", autoFixAvailable: false });
          }
          const nonCompliant = devices.filter((d: any) => !d.compliant);
          if (nonCompliant.length > 0) {
            results.push({ title: `Non-Compliant Devices: ${nonCompliant.length} devices failing compliance policies`, description: `${nonCompliant.length} devices do not meet the organization's compliance policies. Non-compliant devices may lack security controls, have unauthorized software, or have disabled security features. Review and remediate each device's compliance status.`, severity: "high", category: "endpoint", resourceType: "device", resourceId: `${config.provider}/${nonCompliant.length}-devices`, resourceRegion: null, remediationTier: "manual", autoFixAvailable: false });
          }
          const staleCheckin = devices.filter((d: any) => d.lastCheckinDaysAgo > 30);
          if (staleCheckin.length > 0) {
            results.push({ title: `Stale Devices: ${staleCheckin.length} devices not checked in for 30+ days`, description: `${staleCheckin.length} managed devices have not communicated with the ${config.provider} server in over 30 days. These devices may be lost, stolen, or decommissioned without proper wipe. Investigate each device and enforce remote wipe policy if necessary.`, severity: "medium", category: "endpoint", resourceType: "device", resourceId: `${config.provider}/${staleCheckin.length}-devices`, resourceRegion: null, remediationTier: "manual", autoFixAvailable: false });
          }
          return results;
        }
      } catch { /* Fall through to config audit */ }
    }

    // Configuration audit (when real API unavailable)
    results.push({ title: `Endpoint MDM Enrollment Verification Required`, description: `The ${config.provider} integration is configured but device enrollment completeness cannot be verified via API. Ensure all corporate devices are enrolled in ${config.provider} and that enrollment is enforced through conditional access policies. Unmanaged devices accessing corporate data represent a significant security risk.`, severity: "medium", category: "endpoint", resourceType: "mdm_config", resourceId: config.provider, resourceRegion: null, remediationTier: "manual", autoFixAvailable: false });

    if (config.provider === "jamf" || config.provider === "intune") {
      results.push({ title: `Auto-Enrollment Policy Verification Required`, description: `Verify that ${config.provider} is configured for automatic device enrollment. Without auto-enrollment, new devices may operate without management controls for days or weeks before IT manually enrolls them. Enable DEP/ABM enrollment for Apple devices or Autopilot for Windows devices.`, severity: "medium", category: "endpoint", resourceType: "mdm_config", resourceId: config.provider, resourceRegion: null, remediationTier: "manual", autoFixAvailable: false });
    }

    return results;
  }

  private async auditEncryption(config: EndpointConfig, _ctx: AgentContext): Promise<AgentFindingPayload[]> {
    const results: AgentFindingPayload[] = [];

    results.push({ title: `Disk Encryption Enforcement Audit Required`, description: `Verify that full-disk encryption (FileVault for macOS, BitLocker for Windows) is enforced through ${config.provider} compliance policies. Unencrypted devices expose sensitive data if lost or stolen. HIPAA, PCI-DSS, and SOC 2 require encryption at rest on all endpoints that access sensitive data.`, severity: "high", category: "encryption", resourceType: "encryption_policy", resourceId: config.provider, resourceRegion: null, remediationTier: "manual", autoFixAvailable: false });

    results.push({ title: `Removable Media Encryption Policy Required`, description: `Verify that ${config.provider} enforces encryption on removable media (USB drives, external hard drives). Unencrypted removable media is a leading cause of data breaches through lost or stolen devices. Configure ${config.provider} to block unencrypted removable storage or enforce automatic encryption.`, severity: "medium", category: "encryption", resourceType: "encryption_policy", resourceId: config.provider, resourceRegion: null, remediationTier: "manual", autoFixAvailable: false });

    results.push({ title: `Recovery Key Escrow Verification Required`, description: `Verify that FileVault/BitLocker recovery keys are being escrowed to ${config.provider}. Without escrowed recovery keys, encrypted devices cannot be recovered by IT if the user forgets their password or leaves the organization, potentially resulting in permanent data loss.`, severity: "medium", category: "encryption", resourceType: "encryption_policy", resourceId: config.provider, resourceRegion: null, remediationTier: "manual", autoFixAvailable: false });

    return results;
  }

  private async auditPatching(config: EndpointConfig, _ctx: AgentContext): Promise<AgentFindingPayload[]> {
    const results: AgentFindingPayload[] = [];

    results.push({ title: `Automated Patch Management Policy Required`, description: `Verify that ${config.provider} enforces automated OS and application patching. Critical security patches should be deployed within 14 days of release (CISA BOD 22-01 requires 2 weeks for KEV vulnerabilities). Configure ${config.provider} to automatically install critical updates with a maximum deferral of 7 days.`, severity: "high", category: "endpoint", resourceType: "patch_policy", resourceId: config.provider, resourceRegion: null, remediationTier: "manual", autoFixAvailable: false });

    results.push({ title: `EOL Software Detection Required`, description: `Verify that ${config.provider} is monitoring for end-of-life (EOL) software. Devices running EOL operating systems or applications no longer receive security patches and are vulnerable to known exploits. Implement ${config.provider} smart groups or compliance policies to flag EOL software.`, severity: "high", category: "endpoint", resourceType: "patch_policy", resourceId: config.provider, resourceRegion: null, remediationTier: "manual", autoFixAvailable: false });

    results.push({ title: `Third-Party Application Patching Required`, description: `Verify that ${config.provider} manages patching for third-party applications (browsers, PDF readers, Java, etc.). Third-party application vulnerabilities account for a significant portion of security exploits. Configure automated updates or use a third-party patch management solution integrated with ${config.provider}.`, severity: "medium", category: "endpoint", resourceType: "patch_policy", resourceId: config.provider, resourceRegion: null, remediationTier: "manual", autoFixAvailable: false });

    return results;
  }

  private async fetchDeviceInventory(config: EndpointConfig): Promise<any[] | null> {
    try {
      const headers: Record<string, string> = { "Accept": "application/json" };
      if (config.apiKey) headers["Authorization"] = `Bearer ${config.apiKey}`;

      let url: string;
      if (config.provider === "jamf") {
        url = `${config.apiUrl}/api/v1/computers-inventory?section=GENERAL&page=0&page-size=100`;
      } else if (config.provider === "intune") {
        url = `${config.apiUrl}/v1.0/deviceManagement/managedDevices?$top=100`;
      } else {
        url = `${config.apiUrl}/devices/queries/devices/v1?limit=100`;
      }

      // SECURITY FIX (BLACKFYRE audit 2026-06-05): SSRF — route the tenant-controlled apiUrl
      // through safeFetch (private-IP/metadata blocking + per-hop redirect re-validation)
      // instead of raw fetch(). safeFetch enforces its own hard timeout.
      const res = await safeFetch(url, { headers }, { timeoutMs: 8000 });
      if (!res.ok) return null;

      const data = await res.json();
      // Normalize to common format (simplified)
      return (data.results ?? data.value ?? data.resources ?? []).map((d: any) => ({
        id: d.id ?? d.deviceId,
        name: d.general?.name ?? d.deviceName ?? d.hostname,
        compliant: d.complianceState === "compliant" || d.status === "compliant",
        osOutdated: false, // Would need version comparison logic
        lastCheckinDaysAgo: d.lastSyncDateTime ? Math.floor((Date.now() - new Date(d.lastSyncDateTime).getTime()) / 86400000) : 999,
      }));
    } catch (err) {
      // SECURITY FIX (BLACKFYRE audit 2026-06-05): SSRF — record blocked targets at warn so the
      // SSRF oracle attempt is auditable; no Fastify logger is reachable in agent context.
      if (err instanceof SsrfBlockedError) {
        console.warn(JSON.stringify({ level: "warn", event: "ssrf.blocked", agent: this.type, provider: config.provider, phase: "fetchDeviceInventory", reason: err.message }));
      }
      return null;
    }
  }

  async testConnection(credentialRef: string): Promise<boolean> {
    const config = this.parseConfig(credentialRef);
    if (!config.apiUrl) return false;
    try {
      // SECURITY FIX (BLACKFYRE audit 2026-06-05): SSRF — connectivity probe against the
      // tenant-controlled apiUrl routed through safeFetch so a HEAD request can't be used to
      // probe internal/metadata services. vault:// refs still fall through to the catch below.
      const res = await safeFetch(config.apiUrl, { method: "HEAD" }, { timeoutMs: 5000 });
      return res.status < 500;
    } catch (err) {
      // SECURITY FIX (BLACKFYRE audit 2026-06-05): SSRF — log blocked probe targets at warn.
      if (err instanceof SsrfBlockedError && !config.apiUrl.startsWith("vault://")) {
        console.warn(JSON.stringify({ level: "warn", event: "ssrf.blocked", agent: this.type, provider: config.provider, phase: "testConnection", reason: err.message }));
      }
      return config.apiUrl.startsWith("vault://");
    }
  }
}
