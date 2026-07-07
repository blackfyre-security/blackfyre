import { AuthorizationManagementClient } from "@azure/arm-authorization";
import type { AgentFindingPayload } from "@blackfyre/shared";
import { mapCheckToControls } from "../../services/compliance-mapper.js";
import type { AzureCredentials } from "./credentials.js";

/** Owner built-in role definition GUID */
const OWNER_ROLE_GUID = "8e3af657-a8ff-443c-a75c-2fe8c4bcb635";

/**
 * Runs all Azure IAM/RBAC security checks and returns findings.
 *
 * Checks:
 * 1. azure_rbac_owner_count — More than 3 Owner role assignments
 * 2. azure_rbac_custom_no_scope — Custom roles with wildcard (*) actions
 * 3. azure_classic_admin — Classic administrators still present
 * 4. azure_guest_users_with_roles — Guest principals with role assignments
 */
export async function auditAzureIAM(
  creds: AzureCredentials,
): Promise<AgentFindingPayload[]> {
  const client = new AuthorizationManagementClient(
    creds.credential,
    creds.subscriptionId,
  );

  const [ownerFindings, customRoleFindings, classicAdminFindings, guestFindings] =
    await Promise.all([
      checkOwnerCount(client, creds.subscriptionId),
      checkCustomWildcardRoles(client, creds.subscriptionId),
      checkClassicAdmins(client),
      checkGuestUsersWithRoles(client, creds.subscriptionId),
    ]);

  return [
    ...ownerFindings,
    ...customRoleFindings,
    ...classicAdminFindings,
    ...guestFindings,
  ];
}

/**
 * Check: Excessive Owner role assignments (> 3) -> high
 */
async function checkOwnerCount(
  client: AuthorizationManagementClient,
  subscriptionId: string,
): Promise<AgentFindingPayload[]> {
  const findings: AgentFindingPayload[] = [];
  let ownerCount = 0;

  const ownerRoleDefId = `/subscriptions/${subscriptionId}/providers/Microsoft.Authorization/roleDefinitions/${OWNER_ROLE_GUID}`;

  for await (const assignment of client.roleAssignments.listForSubscription({
    filter: `roleDefinitionId eq '${ownerRoleDefId}'`,
  })) {
    if (assignment.roleDefinitionId?.includes(OWNER_ROLE_GUID)) {
      ownerCount++;
    }
  }

  if (ownerCount > 3) {
    findings.push({
      title: `Subscription has ${ownerCount} Owner role assignments (exceeds 3)`,
      description: `The subscription has ${ownerCount} principals assigned the Owner role. The Owner role grants full access including the ability to assign roles. Limit Owner assignments to reduce risk of privilege abuse. Best practice recommends no more than 3 Owner assignments.`,
      severity: "high",
      category: "iam",
      resourceType: "Microsoft.Authorization/roleAssignments",
      resourceId: subscriptionId,
      remediationTier: "manual",
      autoFixAvailable: false,
      controlMappings: mapCheckToControls("azure_rbac_owner_count"),
    });
  }

  return findings;
}

/**
 * Check: Custom roles with wildcard (*) actions at subscription scope -> high
 */
async function checkCustomWildcardRoles(
  client: AuthorizationManagementClient,
  subscriptionId: string,
): Promise<AgentFindingPayload[]> {
  const findings: AgentFindingPayload[] = [];

  for await (const roleDef of client.roleDefinitions.list(
    `/subscriptions/${subscriptionId}`,
  )) {
    if (roleDef.roleType !== "CustomRole") continue;

    const hasWildcard = roleDef.permissions?.some((perm) =>
      perm.actions?.some((action) => action === "*"),
    );

    if (hasWildcard) {
      findings.push({
        title: `Custom role "${roleDef.roleName}" has wildcard (*) actions`,
        description: `Custom role definition "${roleDef.roleName}" (${roleDef.id}) grants wildcard (*) actions. This is equivalent to Owner-level access. Scope down the custom role to only required actions.`,
        severity: "high",
        category: "iam",
        resourceType: "Microsoft.Authorization/roleDefinitions",
        resourceId: roleDef.id ?? roleDef.roleName ?? "unknown",
        remediationTier: "manual",
        autoFixAvailable: false,
        controlMappings: mapCheckToControls("azure_rbac_custom_no_scope"),
      });
    }
  }

  return findings;
}

/**
 * Check: Classic administrators still present -> medium
 */
async function checkClassicAdmins(
  client: AuthorizationManagementClient,
): Promise<AgentFindingPayload[]> {
  const findings: AgentFindingPayload[] = [];
  let adminCount = 0;

  try {
    for await (const admin of client.classicAdministrators.list()) {
      if (admin.emailAddress) {
        adminCount++;
      }
    }
  } catch {
    // Classic admin API may not be available in all subscriptions
    return findings;
  }

  if (adminCount > 0) {
    findings.push({
      title: `Subscription has ${adminCount} classic administrator(s)`,
      description: `The subscription still has ${adminCount} classic administrator(s) (Co-Administrator/Service Administrator). Classic admin roles are a legacy access model that bypasses Azure RBAC. Migrate to Azure RBAC roles and remove classic administrator assignments.`,
      severity: "medium",
      category: "iam",
      resourceType: "Microsoft.Authorization/classicAdministrators",
      resourceId: "classic-admins",
      remediationTier: "manual",
      autoFixAvailable: false,
      controlMappings: mapCheckToControls("azure_classic_admin"),
    });
  }

  return findings;
}

/**
 * Check: Guest users with role assignments -> medium
 */
async function checkGuestUsersWithRoles(
  client: AuthorizationManagementClient,
  subscriptionId: string,
): Promise<AgentFindingPayload[]> {
  const findings: AgentFindingPayload[] = [];
  const guestAssignments: string[] = [];

  for await (const assignment of client.roleAssignments.listForSubscription()) {
    if (assignment.principalType === "Guest") {
      guestAssignments.push(
        assignment.principalId ?? assignment.id ?? "unknown",
      );
    }
  }

  if (guestAssignments.length > 0) {
    findings.push({
      title: `${guestAssignments.length} guest user(s) have role assignments in the subscription`,
      description: `Found ${guestAssignments.length} guest (external) user(s) with Azure RBAC role assignments in subscription ${subscriptionId}. Guest users represent external identities that may not be subject to your organization's security policies. Review and remove unnecessary guest access.`,
      severity: "medium",
      category: "iam",
      resourceType: "Microsoft.Authorization/roleAssignments",
      resourceId: subscriptionId,
      remediationTier: "manual",
      autoFixAvailable: false,
      controlMappings: mapCheckToControls("azure_guest_users_with_roles"),
    });
  }

  return findings;
}
