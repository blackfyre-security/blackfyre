import type { AgentFindingPayload } from "@blackfyre/shared";
import type { ADConfig } from "../ad-auditor.js";
import { buildQuery, type LdapSearchFn } from "./ldap-client.js";
// SECURITY FIX (BLACKFYRE audit 2026-06-05): LDAP filter injection — config.baseDN is
// customer-controlled and was interpolated unescaped into AD search filters. A crafted
// baseDN (e.g. containing `)(uid=*` or filter metacharacters) could alter filter logic and
// enumerate accounts beyond the intended scope. Each assembled group DN is used only as a
// filter assertion value, so we escape the whole DN for the RFC 4515 filter context with
// escapeLdapFilter — that neutralises `(` `)` `*` `\` and control bytes while preserving the
// legitimate DN commas/`=`. escapeLdapDn is intentionally NOT used here because it would
// escape the multi-RDN baseDN's commas and corrupt a legitimate DN.
import { escapeLdapFilter } from "../../lib/ldap-escape.js";

/**
 * Privilege Sub-auditor
 *
 * Checks: Domain Admin count, nested group escalation paths,
 * service accounts with admin privileges, accounts with DCSync rights.
 */
export async function auditPrivileges(
  config: ADConfig,
  ldapSearch: LdapSearchFn,
): Promise<AgentFindingPayload[]> {
  const results: AgentFindingPayload[] = [];
  // SECURITY FIX (BLACKFYRE audit 2026-06-05): LDAP filter injection — the full group DN is
  // used as a filter assertion value, so escape the assembled DN for the RFC 4515 filter
  // context (neutralises `(` `)` `*` `\` and control bytes from a malicious baseDN while
  // preserving legitimate DN commas/`=`). daGroup/eaGroup below are already filter-escaped.
  const daGroup = escapeLdapFilter(`CN=Domain Admins,CN=Users,${config.baseDN}`);

  // Query 1: Direct Domain Admins membership (including nested via LDAP_MATCHING_RULE_IN_CHAIN)
  const domainAdmins = await ldapSearch(config, buildQuery(
    `(&(objectClass=user)(memberOf:1.2.840.113556.1.4.1941:=${daGroup}))`,
  ));

  if (domainAdmins.length > 5) {
    results.push({
      title: `Excessive Domain Admin Count: ${domainAdmins.length} accounts with DA privileges`,
      description: `${domainAdmins.length} accounts are members of the Domain Admins group. Best practice recommends no more than 5 Domain Admins. Excessive DA accounts dramatically expand the attack surface — each additional DA is a potential path to full domain compromise. Apply least-privilege and use tiered administration with delegated administrative roles.`,
      severity: domainAdmins.length > 15 ? "critical" : "high",
      category: "identity",
      resourceType: "ad_group",
      resourceId: `${config.host}/domain-admins`,
      resourceRegion: null,
      remediationTier: "approval",
      autoFixAvailable: false,
    });
  }

  // Query 2: Service accounts in privileged groups (identified by naming patterns)
  const privServiceAccounts = await ldapSearch(config, buildQuery(
    `(&(objectClass=user)(|(sAMAccountName=*svc*)(sAMAccountName=*service*)(sAMAccountName=*svc_*))(memberOf:1.2.840.113556.1.4.1941:=${daGroup}))`,
  ));

  if (privServiceAccounts.length > 0) {
    results.push({
      title: `Service Accounts with Domain Admin Privileges: ${privServiceAccounts.length} accounts`,
      description: `${privServiceAccounts.length} service account(s) have Domain Admin rights. Service accounts with DA privileges violate the principle of least privilege and are a common lateral movement vector. Service accounts should have only the permissions they need to function. Migrate these to Group Managed Service Accounts (gMSA) with scoped permissions.`,
      severity: "critical",
      category: "identity",
      resourceType: "ad_user",
      resourceId: `${config.host}/service-account-da`,
      resourceRegion: null,
      remediationTier: "approval",
      autoFixAvailable: false,
    });
  }

  // Query 3: Non-admin accounts with DCSync rights
  // DCSync = "Replicating Directory Changes All" extended right (GUID: 1131f6ad)
  // SECURITY FIX (BLACKFYRE audit 2026-06-05): LDAP filter injection — filter-escape the
  // assembled Enterprise Admins DN before embedding it as a filter assertion value.
  const eaGroup = escapeLdapFilter(`CN=Enterprise Admins,CN=Users,${config.baseDN}`);
  const nonAdminUsers = await ldapSearch(config, buildQuery(
    `(&(objectClass=user)(!(memberOf:1.2.840.113556.1.4.1941:=${daGroup}))(!(memberOf:1.2.840.113556.1.4.1941:=${eaGroup})))`,
  ));
  const dcSyncAccounts = nonAdminUsers.filter(
    (u) => String(u.nTSecurityDescriptor ?? "").includes("1131f6ad"),
  );

  if (dcSyncAccounts.length > 0) {
    results.push({
      title: `DCSync Rights Detected Outside Privileged Groups: ${dcSyncAccounts.length} accounts`,
      description: `${dcSyncAccounts.length} non-admin account(s) have the "Replicating Directory Changes All" permission, which enables DCSync attacks to extract all domain password hashes. This is the most dangerous misconfiguration in Active Directory. Immediately review and remove this permission from all non-DC computer accounts and non-admin users.`,
      severity: "critical",
      category: "identity",
      resourceType: "ad_acl",
      resourceId: `${config.host}/dcsync-rights`,
      resourceRegion: null,
      remediationTier: "approval",
      autoFixAvailable: false,
    });
  }

  // Query 4: Groups nested within Domain Admins (hidden escalation paths)
  const nestedGroups = await ldapSearch(config, buildQuery(
    `(&(objectClass=group)(memberOf:1.2.840.113556.1.4.1941:=${daGroup}))`,
  ));

  if (nestedGroups.length > 0) {
    results.push({
      title: `Nested Group Escalation Path: ${nestedGroups.length} group(s) nested in Domain Admins`,
      description: `${nestedGroups.length} non-default group(s) are nested within Domain Admins. Nested group memberships create hidden privilege escalation paths that are difficult to audit. Any member of these groups effectively has Domain Admin rights. Review and flatten the Domain Admins group to contain only individual user accounts.`,
      severity: "high",
      category: "identity",
      resourceType: "ad_group",
      resourceId: `${config.host}/nested-da-groups`,
      resourceRegion: null,
      remediationTier: "manual",
      autoFixAvailable: false,
    });
  }

  return results;
}
