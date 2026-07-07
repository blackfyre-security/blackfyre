import {
  IAMClient,
  ListUsersCommand,
  ListMFADevicesCommand,
  ListAccessKeysCommand,
  GetAccountSummaryCommand,
  GetAccountAuthorizationDetailsCommand,
  GetAccountPasswordPolicyCommand,
  type User,
} from "@aws-sdk/client-iam";
import type { AgentFindingPayload } from "@blackfyre/shared";
import { mapCheckToControls } from "../../services/compliance-mapper.js";
import type { AwsTemporaryCredentials } from "./credentials.js";

function makeClient(creds: AwsTemporaryCredentials): IAMClient {
  return new IAMClient({
    credentials: {
      accessKeyId: creds.accessKeyId,
      secretAccessKey: creds.secretAccessKey,
      sessionToken: creds.sessionToken,
    },
  });
}

/**
 * Runs all IAM security checks and returns findings.
 */
export async function auditIAM(
  creds: AwsTemporaryCredentials,
): Promise<AgentFindingPayload[]> {
  const client = makeClient(creds);
  const findings: AgentFindingPayload[] = [];

  // Gather checks concurrently where possible
  const [
    usersWithoutMfa,
    usersWithConsoleAndKeys,
    rootKeyFindings,
    passwordPolicyFindings,
    wildcardPolicyFindings,
  ] = await Promise.all([
    checkUsersWithoutMFA(client),
    checkUsersWithConsoleAndAccessKeys(client),
    checkRootAccessKeys(client),
    checkPasswordPolicy(client),
    checkWildcardPolicies(client),
  ]);

  findings.push(
    ...usersWithoutMfa,
    ...usersWithConsoleAndKeys,
    ...rootKeyFindings,
    ...passwordPolicyFindings,
    ...wildcardPolicyFindings,
  );

  return findings;
}

/** List all IAM users (handles pagination). */
async function listAllUsers(client: IAMClient): Promise<User[]> {
  const users: User[] = [];
  let marker: string | undefined;

  do {
    const resp = await client.send(
      new ListUsersCommand({ Marker: marker, MaxItems: 100 }),
    );
    if (resp.Users) users.push(...resp.Users);
    marker = resp.IsTruncated ? resp.Marker : undefined;
  } while (marker);

  return users;
}

/**
 * Check: Users without MFA enabled -> critical
 */
async function checkUsersWithoutMFA(
  client: IAMClient,
): Promise<AgentFindingPayload[]> {
  const findings: AgentFindingPayload[] = [];
  const users = await listAllUsers(client);

  for (const user of users) {
    if (!user.UserName) continue;
    const mfaResp = await client.send(
      new ListMFADevicesCommand({ UserName: user.UserName }),
    );
    const hasMfa =
      mfaResp.MFADevices !== undefined && mfaResp.MFADevices.length > 0;

    if (!hasMfa) {
      findings.push({
        title: `IAM user "${user.UserName}" has no MFA device`,
        description: `IAM user ${user.UserName} does not have any MFA device configured. This allows password-only authentication which is vulnerable to credential theft.`,
        severity: "critical",
        category: "iam",
        resourceType: "AWS::IAM::User",
        resourceId: user.Arn ?? user.UserName,
        remediationTier: "manual",
        autoFixAvailable: false,
        controlMappings: mapCheckToControls("iam_user_no_mfa"),
      });
    }
  }

  return findings;
}

/**
 * Check: Users with both console access AND access keys -> high
 */
async function checkUsersWithConsoleAndAccessKeys(
  client: IAMClient,
): Promise<AgentFindingPayload[]> {
  const findings: AgentFindingPayload[] = [];
  const users = await listAllUsers(client);

  for (const user of users) {
    if (!user.UserName) continue;

    // A user has console access if they have a password (PasswordLastUsed is set or CreateDate implies console login).
    // The best indicator without credential report is checking if the user has a login profile,
    // but ListUsers gives us PasswordLastUsed.
    const hasConsoleAccess = user.PasswordLastUsed !== undefined;

    const keysResp = await client.send(
      new ListAccessKeysCommand({ UserName: user.UserName }),
    );
    const hasKeys =
      keysResp.AccessKeyMetadata !== undefined &&
      keysResp.AccessKeyMetadata.length > 0;

    if (hasConsoleAccess && hasKeys) {
      findings.push({
        title: `IAM user "${user.UserName}" has both console access and access keys`,
        description: `IAM user ${user.UserName} has both AWS Management Console access and programmatic access keys. This increases the attack surface. Consider separating human and programmatic access.`,
        severity: "high",
        category: "iam",
        resourceType: "AWS::IAM::User",
        resourceId: user.Arn ?? user.UserName,
        remediationTier: "manual",
        autoFixAvailable: false,
        controlMappings: mapCheckToControls("iam_console_and_access_keys"),
      });
    }
  }

  return findings;
}

/**
 * Check: Root account access keys via GetAccountSummary -> critical
 */
async function checkRootAccessKeys(
  client: IAMClient,
): Promise<AgentFindingPayload[]> {
  const findings: AgentFindingPayload[] = [];
  const resp = await client.send(new GetAccountSummaryCommand({}));
  const summary = resp.SummaryMap;

  if (summary && summary["AccountAccessKeysPresent"] && summary["AccountAccessKeysPresent"] > 0) {
    findings.push({
      title: "Root account has active access keys",
      description:
        "The AWS root account has active access keys. Root access keys provide unrestricted access to all resources. Delete them and use IAM users or roles instead.",
      severity: "critical",
      category: "iam",
      resourceType: "AWS::IAM::RootAccount",
      resourceId: "root",
      remediationTier: "manual",
      autoFixAvailable: false,
      controlMappings: mapCheckToControls("iam_root_access_keys"),
    });
  }

  if (summary && summary["AccountMFAEnabled"] !== undefined && summary["AccountMFAEnabled"] === 0) {
    findings.push({
      title: "Root account does not have MFA enabled",
      description:
        "The AWS root account does not have MFA enabled. Enable MFA on the root account to add a critical layer of security.",
      severity: "critical",
      category: "iam",
      resourceType: "AWS::IAM::RootAccount",
      resourceId: "root",
      remediationTier: "manual",
      autoFixAvailable: false,
      controlMappings: mapCheckToControls("iam_root_access_keys"),
    });
  }

  return findings;
}

/**
 * Check: Password policy compliance -> medium
 */
async function checkPasswordPolicy(
  client: IAMClient,
): Promise<AgentFindingPayload[]> {
  const findings: AgentFindingPayload[] = [];

  try {
    const resp = await client.send(new GetAccountPasswordPolicyCommand({}));
    const policy = resp.PasswordPolicy;

    if (!policy) {
      findings.push({
        title: "No IAM password policy configured",
        description:
          "The AWS account has no custom IAM password policy. A strong password policy should enforce minimum length, complexity, and rotation requirements.",
        severity: "medium",
        category: "iam",
        resourceType: "AWS::IAM::AccountPasswordPolicy",
        resourceId: "password-policy",
        remediationTier: "auto",
        autoFixAvailable: true,
        controlMappings: mapCheckToControls("iam_weak_password_policy"),
      });
      return findings;
    }

    if (!policy.RequireUppercaseCharacters || !policy.RequireLowercaseCharacters || !policy.RequireNumbers || !policy.RequireSymbols) {
      findings.push({
        title: "IAM password policy does not enforce full complexity",
        description:
          "The IAM password policy does not require all character types (uppercase, lowercase, numbers, symbols). Strengthen the policy to meet compliance requirements.",
        severity: "medium",
        category: "iam",
        resourceType: "AWS::IAM::AccountPasswordPolicy",
        resourceId: "password-policy",
        remediationTier: "auto",
        autoFixAvailable: true,
        controlMappings: mapCheckToControls("iam_weak_password_policy"),
      });
    }

    if ((policy.MinimumPasswordLength ?? 0) < 14) {
      findings.push({
        title: "IAM password policy minimum length is below 14 characters",
        description: `The IAM password policy minimum length is ${policy.MinimumPasswordLength ?? "not set"}. Best practice recommends at least 14 characters.`,
        severity: "medium",
        category: "iam",
        resourceType: "AWS::IAM::AccountPasswordPolicy",
        resourceId: "password-policy",
        remediationTier: "auto",
        autoFixAvailable: true,
        controlMappings: mapCheckToControls("iam_weak_password_policy"),
      });
    }

    if ((policy.MaxPasswordAge ?? 0) === 0 || (policy.MaxPasswordAge ?? 0) > 90) {
      findings.push({
        title: "IAM password policy does not enforce rotation within 90 days",
        description: `Password max age is ${policy.MaxPasswordAge ?? "not set"} days. Require rotation every 90 days or fewer.`,
        severity: "medium",
        category: "iam",
        resourceType: "AWS::IAM::AccountPasswordPolicy",
        resourceId: "password-policy",
        remediationTier: "auto",
        autoFixAvailable: true,
        controlMappings: mapCheckToControls("iam_weak_password_policy"),
      });
    }
  } catch (err: unknown) {
    // NoSuchEntity means no password policy is set
    const isNoPolicy =
      err instanceof Error && err.name === "NoSuchEntityException";
    if (isNoPolicy) {
      findings.push({
        title: "No IAM password policy configured",
        description:
          "The AWS account has no custom IAM password policy. A strong password policy should enforce minimum length, complexity, and rotation requirements.",
        severity: "medium",
        category: "iam",
        resourceType: "AWS::IAM::AccountPasswordPolicy",
        resourceId: "password-policy",
        remediationTier: "auto",
        autoFixAvailable: true,
        controlMappings: mapCheckToControls("iam_weak_password_policy"),
      });
    } else {
      throw err;
    }
  }

  return findings;
}

/**
 * Check: Policies with "Action": "*" and "Resource": "*" -> high
 */
async function checkWildcardPolicies(
  client: IAMClient,
): Promise<AgentFindingPayload[]> {
  const findings: AgentFindingPayload[] = [];
  let marker: string | undefined;

  do {
    const resp = await client.send(
      new GetAccountAuthorizationDetailsCommand({
        Filter: ["LocalManagedPolicy"],
        Marker: marker,
      }),
    );

    for (const policy of resp.Policies ?? []) {
      for (const version of policy.PolicyVersionList ?? []) {
        if (!version.IsDefaultVersion || !version.Document) continue;

        // The policy document is URL-encoded JSON
        let doc: { Statement?: Array<{ Effect?: string; Action?: string | string[]; Resource?: string | string[] }> };
        try {
          doc = JSON.parse(decodeURIComponent(version.Document));
        } catch {
          continue;
        }

        for (const stmt of doc.Statement ?? []) {
          if (stmt.Effect !== "Allow") continue;

          const actions = Array.isArray(stmt.Action)
            ? stmt.Action
            : [stmt.Action];
          const resources = Array.isArray(stmt.Resource)
            ? stmt.Resource
            : [stmt.Resource];

          const hasWildcardAction = actions.some((a) => a === "*");
          const hasWildcardResource = resources.some((r) => r === "*");

          if (hasWildcardAction && hasWildcardResource) {
            findings.push({
              title: `IAM policy "${policy.PolicyName}" grants full wildcard access`,
              description: `Customer-managed IAM policy ${policy.PolicyName} (${policy.Arn}) contains a statement with "Action": "*" and "Resource": "*". This grants unrestricted access and should be scoped down.`,
              severity: "high",
              category: "iam",
              resourceType: "AWS::IAM::Policy",
              resourceId: policy.Arn ?? policy.PolicyName ?? "unknown",
              remediationTier: "manual",
              autoFixAvailable: false,
              controlMappings: mapCheckToControls("iam_wildcard_policy"),
            });
            break; // One finding per policy is sufficient
          }
        }
      }
    }

    marker = resp.IsTruncated ? resp.Marker : undefined;
  } while (marker);

  return findings;
}
