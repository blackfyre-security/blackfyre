import type { AgentFindingPayload } from "@blackfyre/shared";
import type { ADConfig } from "../ad-auditor.js";
import { buildQuery, type LdapSearchFn } from "./ldap-client.js";

/**
 * Group Policy Sub-auditor
 *
 * Checks: password policy compliance (length, complexity, lockout, history),
 * advanced audit policy presence, AppLocker/SRP status.
 */
export async function auditGroupPolicy(
  config: ADConfig,
  ldapSearch: LdapSearchFn,
): Promise<AgentFindingPayload[]> {
  const results: AgentFindingPayload[] = [];

  // Query domain object for password policy attributes
  const domainObjects = await ldapSearch(config, {
    scope: "sub",
    filter: "(objectClass=domain)",
    attributes: ["minPwdLength", "pwdHistoryLength", "maxPwdAge", "lockoutThreshold", "lockoutDuration", "pwdProperties"],
  });

  if (domainObjects.length > 0) {
    const domain = domainObjects[0];
    const minLength = Number(domain.minPwdLength ?? 0);
    const historyLength = Number(domain.pwdHistoryLength ?? 0);
    const lockoutThreshold = Number(domain.lockoutThreshold ?? 0);
    const complexityEnabled = (Number(domain.pwdProperties ?? 0) & 1) === 1;

    if (minLength < 12) {
      results.push({
        title: `Weak Password Length Policy: Minimum ${minLength} characters (required: 12)`,
        description: `The domain password policy requires only ${minLength} character(s). CIS Benchmark for Windows Server requires minimum 14 characters; PCI-DSS Requirement 8.3.6 requires minimum 12. Short passwords are significantly more susceptible to brute-force attacks. Update the Default Domain Policy minimum password length to at least 12 characters.`,
        severity: "high",
        category: "identity",
        resourceType: "group_policy",
        resourceId: `${config.host}/password-policy`,
        resourceRegion: null,
        remediationTier: "approval",
        autoFixAvailable: false,
      });
    }

    if (!complexityEnabled) {
      results.push({
        title: `Password Complexity Disabled in Domain Policy`,
        description: `The domain password policy does not enforce complexity requirements (uppercase, lowercase, digit, special character). Password complexity is required by PCI-DSS 8.3.6, HIPAA, and ISO 27001 Annex A.9. Enable the "Password must meet complexity requirements" policy in Default Domain Policy.`,
        severity: "high",
        category: "identity",
        resourceType: "group_policy",
        resourceId: `${config.host}/password-complexity`,
        resourceRegion: null,
        remediationTier: "approval",
        autoFixAvailable: false,
      });
    }

    if (lockoutThreshold === 0 || lockoutThreshold > 10) {
      results.push({
        title: `Insufficient Account Lockout Policy: ${lockoutThreshold === 0 ? "Disabled" : `${lockoutThreshold} attempts`}`,
        description: `Account lockout is ${lockoutThreshold === 0 ? "completely disabled" : `set to ${lockoutThreshold} attempts before lockout`}. CIS Benchmark recommends locking out after 5 invalid attempts. Without lockout enforcement, accounts are vulnerable to online password brute-force attacks. Set lockout threshold to 5 attempts with a 15-minute lockout duration.`,
        severity: lockoutThreshold === 0 ? "critical" : "high",
        category: "identity",
        resourceType: "group_policy",
        resourceId: `${config.host}/lockout-policy`,
        resourceRegion: null,
        remediationTier: "approval",
        autoFixAvailable: false,
      });
    }

    if (historyLength < 12) {
      results.push({
        title: `Insufficient Password History: ${historyLength} passwords remembered (required: 12)`,
        description: `The domain stores only ${historyLength} password(s) in history, allowing users to recycle recent passwords. CIS Benchmark requires remembering at least 24 passwords; PCI-DSS requires 4. Increase the password history length to prevent rapid password cycling attacks.`,
        severity: "medium",
        category: "identity",
        resourceType: "group_policy",
        resourceId: `${config.host}/password-history`,
        resourceRegion: null,
        remediationTier: "manual",
        autoFixAvailable: false,
      });
    }
  } else {
    results.push({
      title: `Active Directory Password Policy Audit Required`,
      description: `Unable to retrieve domain password policy via LDAP. Manually verify that the Default Domain Policy enforces: minimum 12-character passwords, complexity requirements, account lockout after 5 attempts, and password history of at least 12 entries.`,
      severity: "medium",
      category: "identity",
      resourceType: "group_policy",
      resourceId: `${config.host}/password-policy`,
      resourceRegion: null,
      remediationTier: "manual",
      autoFixAvailable: false,
    });
  }

  // Audit Policy — check for advanced audit policy configuration
  const auditConfig = await ldapSearch(config, buildQuery("(&(objectClass=container)(cn=Audit))"));
  if (auditConfig.length === 0) {
    results.push({
      title: `Advanced Audit Policy Not Configured`,
      description: `No Advanced Audit Policy Configuration detected in Active Directory. Without audit policies, logon events, privilege use, and object access changes are not logged. Enable Advanced Audit Policy: Account Logon, Logon/Logoff, Privilege Use, and DS Access categories at minimum. Required by SOC 2, PCI-DSS 10.2, and ISO 27001 A.12.4.`,
      severity: "high",
      category: "identity",
      resourceType: "audit_policy",
      resourceId: `${config.host}/audit-policy`,
      resourceRegion: null,
      remediationTier: "manual",
      autoFixAvailable: false,
    });
  }

  // AppLocker / SRP — check for application control GPOs
  const gpos = await ldapSearch(config, buildQuery("(&(objectClass=groupPolicyContainer)(displayName=*))"));
  const hasAppControl = gpos.some(
    (g) => String(g.displayName ?? "").toLowerCase().includes("applocker")
      || String(g.displayName ?? "").toLowerCase().includes("application control"),
  );

  if (!hasAppControl) {
    results.push({
      title: `No Application Control Policy Detected (AppLocker/SRP)`,
      description: `No AppLocker or Software Restriction Policy GPO was detected. Application control prevents unauthorized software execution and is a critical defense against ransomware and malware. CIS Control 2 and NIST CSF ID.AM-2 require software inventory and control. Deploy AppLocker or Windows Defender Application Control (WDAC) policies.`,
      severity: "medium",
      category: "identity",
      resourceType: "group_policy",
      resourceId: `${config.host}/applocker`,
      resourceRegion: null,
      remediationTier: "manual",
      autoFixAvailable: false,
    });
  }

  return results;
}
