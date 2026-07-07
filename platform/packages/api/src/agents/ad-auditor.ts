import { BaseAgent, type AgentContext, type AgentRunResult } from "./base-agent.js";
import { ldapSearch } from "./ad/ldap-client.js";
import { auditUserAccounts } from "./ad/user-account-auditor.js";
import { auditGroupPolicy } from "./ad/group-policy-auditor.js";
import { auditPrivileges } from "./ad/privilege-auditor.js";
import { auditGroupMembership } from "./ad/group-membership-auditor.js";

export interface ADConfig {
  host: string;
  port: number; // 389 or 636 for LDAPS
  baseDN: string;
  bindDN: string;
  bindCredential: string; // vault:// reference
  useTLS: boolean;
}

/**
 * Active Directory Auditor Agent
 *
 * Scans: User accounts, Group Policy, Privilege escalation paths,
 * and Group membership hygiene.
 * Integration: LDAP/LDAPS via ldapjs (optional peer dependency)
 *
 * Sub-auditors:
 * - user-account-auditor: stale accounts, disabled-in-groups, non-expiring passwords
 * - group-policy-auditor: password policy compliance, audit policy, AppLocker
 * - privilege-auditor: Domain Admin count, DCSync rights, service account DA
 * - group-membership-auditor: empty groups, large groups, cross-domain nesting
 */
export class AdAuditorAgent extends BaseAgent {
  readonly type = "ad-auditor";
  readonly displayName = "Active Directory Auditor";
  readonly supportedIntegrations = ["active_directory", "ad"];

  private parseConfig(credentialRef: string): ADConfig {
    try {
      return JSON.parse(credentialRef);
    } catch {
      const ref = credentialRef.replace("vault://", "");
      const [host, ...rest] = ref.split("/");
      return {
        host: host ?? "localhost",
        port: 389,
        baseDN: rest.join("/") || "dc=corp,dc=local",
        bindDN: "",
        bindCredential: credentialRef,
        useTLS: false,
      };
    }
  }

  async run(ctx: AgentContext): Promise<AgentRunResult> {
    const startedAt = new Date();
    let findingsCount = 0;
    const config = this.parseConfig(ctx.credentialRef);

    try {
      ctx.onProgress(0);

      // Phase 1: User Account Audit (0-25%)
      const userFindings = await auditUserAccounts(config, ldapSearch);
      for (const f of userFindings) { await ctx.onFinding(f); findingsCount++; }
      ctx.onProgress(25);

      // Phase 2: Group Policy Audit (25-50%)
      const gpFindings = await auditGroupPolicy(config, ldapSearch);
      for (const f of gpFindings) { await ctx.onFinding(f); findingsCount++; }
      ctx.onProgress(50);

      // Phase 3: Privilege Audit (50-75%)
      const privFindings = await auditPrivileges(config, ldapSearch);
      for (const f of privFindings) { await ctx.onFinding(f); findingsCount++; }
      ctx.onProgress(75);

      // Phase 4: Group Membership Audit (75-100%)
      const groupFindings = await auditGroupMembership(config, ldapSearch);
      for (const f of groupFindings) { await ctx.onFinding(f); findingsCount++; }
      ctx.onProgress(100);

      return this.createResult(startedAt, findingsCount);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return this.createResult(startedAt, findingsCount, message);
    }
  }

  async testConnection(credentialRef: string): Promise<boolean> {
    const config = this.parseConfig(credentialRef);
    if (!config.host) return false;

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ldap = await import("ldapjs" as any).catch(() => null) as any;
      if (!ldap) return false;

      return await new Promise<boolean>((resolve) => {
        const client = ldap.createClient({
          url: `${config.useTLS ? "ldaps" : "ldap"}://${config.host}:${config.port}`,
          timeout: 5000,
          connectTimeout: 5000,
        });
        client.on("connect", () => { client.destroy(); resolve(true); });
        client.on("error", () => resolve(false));
        setTimeout(() => { client.destroy(); resolve(false); }, 6000);
      });
    } catch {
      return false;
    }
  }
}
