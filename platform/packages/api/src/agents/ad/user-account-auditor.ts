import type { AgentFindingPayload } from "@blackfyre/shared";
import type { ADConfig } from "../ad-auditor.js";
import { buildQuery, firstAttr, parseAdTimestamp, type LdapSearchFn } from "./ldap-client.js";

/**
 * User Account Sub-auditor
 *
 * Checks: stale accounts (>90 days no login), disabled accounts still in groups,
 * non-expiring passwords, passwords older than 90 days.
 */
export async function auditUserAccounts(
  config: ADConfig,
  ldapSearch: LdapSearchFn,
): Promise<AgentFindingPayload[]> {
  const results: AgentFindingPayload[] = [];
  const staleThreshold = Date.now() - 90 * 24 * 60 * 60 * 1000;

  // Query 1: enabled accounts with lastLogon older than 90 days
  // AD stores lastLogonTimestamp as Windows FILETIME (100ns intervals since 1601-01-01)
  const staleUsers = await ldapSearch(config, buildQuery(
    "(&(objectClass=user)(objectCategory=person)(!(userAccountControl:1.2.840.113556.1.4.803:=2)))",
  ));
  const staleAccounts = staleUsers.filter((u) => {
    const lastLogon = parseAdTimestamp(firstAttr(u.lastLogonTimestamp ?? u.lastLogon));
    return lastLogon > 0 && lastLogon < staleThreshold;
  });

  if (staleAccounts.length > 0) {
    results.push({
      title: `Stale Active Directory Accounts: ${staleAccounts.length} accounts inactive >90 days`,
      description: `${staleAccounts.length} enabled user accounts have not logged in for over 90 days. Stale accounts are prime targets for credential stuffing and brute-force attacks since their compromise may go undetected. Disable or remove accounts per your user lifecycle policy. CIS Control 5.3 requires disabling accounts after 45 days of inactivity.`,
      severity: "high",
      category: "identity",
      resourceType: "ad_user",
      resourceId: `${config.host}/stale-accounts`,
      resourceRegion: null,
      remediationTier: "approval",
      autoFixAvailable: false,
    });
  }

  // Query 2: disabled accounts still in security groups
  const disabledInGroups = await ldapSearch(config, buildQuery(
    "(&(objectClass=user)(objectCategory=person)(userAccountControl:1.2.840.113556.1.4.803:=2)(memberOf=*))",
  ));

  if (disabledInGroups.length > 0) {
    results.push({
      title: `Disabled Accounts in Active Groups: ${disabledInGroups.length} accounts retain group memberships`,
      description: `${disabledInGroups.length} disabled AD accounts still have active group memberships. If these accounts are re-enabled, they immediately regain access permissions. Remove disabled accounts from all security groups as part of the offboarding process.`,
      severity: "medium",
      category: "identity",
      resourceType: "ad_user",
      resourceId: `${config.host}/disabled-in-groups`,
      resourceRegion: null,
      remediationTier: "manual",
      autoFixAvailable: false,
    });
  }

  // Query 3: accounts with DONT_EXPIRE_PASSWORD flag (bit 65536 in userAccountControl)
  const nonExpiringAccounts = await ldapSearch(config, buildQuery(
    "(&(objectClass=user)(objectCategory=person)(userAccountControl:1.2.840.113556.1.4.803:=65536)(!(userAccountControl:1.2.840.113556.1.4.803:=2)))",
  ));

  if (nonExpiringAccounts.length > 0) {
    results.push({
      title: `Non-Expiring Passwords: ${nonExpiringAccounts.length} accounts exempt from password rotation`,
      description: `${nonExpiringAccounts.length} enabled accounts have the "Password Never Expires" flag set. Non-expiring passwords violate NIST SP 800-63B and PCI-DSS Requirement 8.3.9. Service accounts excepted by documented policy should be tracked separately. Review and enforce password expiration for all standard user accounts.`,
      severity: "high",
      category: "identity",
      resourceType: "ad_user",
      resourceId: `${config.host}/non-expiring-passwords`,
      resourceRegion: null,
      remediationTier: "manual",
      autoFixAvailable: false,
    });
  }

  // Query 4: accounts with password age >90 days (pwdLastSet)
  const pwdAgeThreshold = Date.now() - 90 * 24 * 60 * 60 * 1000;
  const allEnabledUsers = await ldapSearch(config, buildQuery(
    "(&(objectClass=user)(objectCategory=person)(!(userAccountControl:1.2.840.113556.1.4.803:=2)))",
  ));
  const stalePasswords = allEnabledUsers.filter((u) => {
    const pwdLastSet = parseAdTimestamp(firstAttr(u.pwdLastSet));
    return pwdLastSet > 0 && pwdLastSet < pwdAgeThreshold;
  });

  if (stalePasswords.length > 0) {
    results.push({
      title: `Stale Passwords: ${stalePasswords.length} accounts with passwords older than 90 days`,
      description: `${stalePasswords.length} accounts have passwords that have not been changed in over 90 days. While NIST SP 800-63B no longer mandates periodic rotation, organizations subject to PCI-DSS or legacy compliance requirements must enforce 90-day rotation. Ensure password expiry policies are applied to these accounts.`,
      severity: "medium",
      category: "identity",
      resourceType: "ad_user",
      resourceId: `${config.host}/stale-passwords`,
      resourceRegion: null,
      remediationTier: "manual",
      autoFixAvailable: false,
    });
  }

  return results;
}
