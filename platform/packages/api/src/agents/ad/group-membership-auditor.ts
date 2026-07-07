import type { AgentFindingPayload } from "@blackfyre/shared";
import type { ADConfig } from "../ad-auditor.js";
import { buildQuery, type LdapSearchFn } from "./ldap-client.js";

/**
 * Group Membership Sub-auditor
 *
 * Checks: empty groups, groups with excessive members (>100),
 * cross-domain group nesting via foreign security principals.
 */
export async function auditGroupMembership(
  config: ADConfig,
  ldapSearch: LdapSearchFn,
): Promise<AgentFindingPayload[]> {
  const results: AgentFindingPayload[] = [];

  // Query 1: Empty security groups (no members)
  const emptyGroups = await ldapSearch(config, buildQuery(
    "(&(objectClass=group)(groupType:1.2.840.113556.1.4.803:=2147483648)(!(member=*)))",
  ));

  if (emptyGroups.length > 10) {
    results.push({
      title: `Excessive Empty Security Groups: ${emptyGroups.length} groups with no members`,
      description: `${emptyGroups.length} security groups contain no members. Empty groups indicate incomplete deprovisioning or legacy configurations. While not a direct vulnerability, excessive group clutter complicates access reviews, increases attack surface via ACL assignments, and violates change management best practices. Clean up groups that have been empty for >90 days.`,
      severity: "low",
      category: "identity",
      resourceType: "ad_group",
      resourceId: `${config.host}/empty-groups`,
      resourceRegion: null,
      remediationTier: "manual",
      autoFixAvailable: false,
    });
  }

  // Query 2: Groups with >100 members (potential over-permissioning)
  const allGroups = await ldapSearch(config, buildQuery(
    "(&(objectClass=group)(groupType:1.2.840.113556.1.4.803:=2147483648))",
  ));
  const largeGroups = allGroups.filter((g) => {
    const members = Array.isArray(g.member) ? g.member.length : (g.member ? 1 : 0);
    return members > 100;
  });

  if (largeGroups.length > 0) {
    results.push({
      title: `Oversized Security Groups: ${largeGroups.length} groups with >100 members`,
      description: `${largeGroups.length} security group(s) have more than 100 members. Very large groups often result from "add everyone" provisioning patterns that violate least-privilege. Review these groups to ensure all members require the access level granted. Consider replacing with dynamic groups based on user attributes or job function.`,
      severity: "medium",
      category: "identity",
      resourceType: "ad_group",
      resourceId: `${config.host}/large-groups`,
      resourceRegion: null,
      remediationTier: "manual",
      autoFixAvailable: false,
    });
  }

  // Query 3: Foreign Security Principals (cross-domain nesting)
  const foreignPrincipals = await ldapSearch(config, buildQuery("(objectClass=foreignSecurityPrincipal)"));

  if (foreignPrincipals.length > 0) {
    results.push({
      title: `Cross-Domain Group Nesting: ${foreignPrincipals.length} foreign security principal(s)`,
      description: `${foreignPrincipals.length} foreign security principal(s) found in the directory. These represent accounts from other domains/forests with access to resources in this domain. Cross-domain trust relationships increase the blast radius of a compromise in a trusted domain. Audit each foreign principal to verify business justification and appropriate access scope.`,
      severity: "medium",
      category: "identity",
      resourceType: "ad_trust",
      resourceId: `${config.host}/foreign-principals`,
      resourceRegion: null,
      remediationTier: "manual",
      autoFixAvailable: false,
    });
  }

  return results;
}
