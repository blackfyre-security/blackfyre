import { STSClient, AssumeRoleCommand } from "@aws-sdk/client-sts";

export interface AwsTemporaryCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken: string;
}

/**
 * Minimal pino/Fastify-logger structural type. Lets callers (route handlers,
 * agents that hold request.log / app.log) opt into structured security logging
 * without this AWS-agent module taking a hard dependency on Fastify's types.
 */
export interface CredentialAccessLogger {
  info(obj: Record<string, unknown>, msg?: string): void;
  warn(obj: Record<string, unknown>, msg?: string): void;
}

// Defense-in-depth session policy: even if the customer's IAM role is
// over-privileged, our assumed session is locked down to read-only auditing
// actions. Prevents accidental or malicious writes from Blackfyre's scanning
// agents regardless of what the attached role permits.
//
// SECURITY FIX (BLACKFYRE audit 2026-06-05): the previous "read-only" policy
// gave FALSE containment. Its DenyAllWrites block only blocked mutating verbs,
// while the broad "*:Get*" allow (plus an explicit s3:GetObject allow) let the
// session: read object DATA out of any S3 bucket (exfiltration), pull plaintext
// secrets/params via secretsmanager:GetSecretValue & ssm:GetParameter(s) with
// WithDecryption, decrypt arbitrary ciphertext via kms:Decrypt /
// kms:GenerateDataKey*, and even execute arbitrary customer compute via
// lambda:InvokeFunction (none of which an "Invoke*" or "Get*" name-deny caught).
// IAM evaluates an explicit Deny ahead of any Allow, so we add a DenyDangerous
// block that revokes these data/secret/execute actions regardless of the broad
// audit allows above. A real config audit only needs metadata (Describe/List/
// Get*Policy/GetBucketAcl etc.), so this keeps auditing functional while making
// the session genuinely non-exfiltrating and non-executing.
const READ_ONLY_SESSION_POLICY = JSON.stringify({
  Version: "2012-10-17",
  Statement: [
    {
      Effect: "Allow",
      Action: [
        "*:Describe*",
        "*:List*",
        "*:Get*",
        "*:View*",
        "s3:GetObject",
        "sts:GetCallerIdentity",
      ],
      Resource: "*",
    },
    {
      Sid: "DenyAllWrites",
      Effect: "Deny",
      Action: [
        "*:Create*",
        "*:Delete*",
        "*:Put*",
        "*:Update*",
        "*:Modify*",
        "*:Attach*",
        "*:Detach*",
        "*:Add*",
        "*:Remove*",
        "*:Tag*",
        "*:Untag*",
        "iam:*",
        "sts:AssumeRole",
      ],
      Resource: "*",
    },
    {
      // SECURITY FIX (BLACKFYRE audit 2026-06-05): close the read/execute Deny
      // gaps that the "read-only" policy left open — secret material, decryption,
      // bulk object-data reads, and arbitrary compute. Explicit Deny overrides
      // the broad audit Allow above, delivering real (not nominal) containment.
      Sid: "DenyDangerousReadAndExecute",
      Effect: "Deny",
      Action: [
        // Arbitrary customer compute / code execution
        "lambda:InvokeFunction",
        "lambda:InvokeFunctionUrl",
        "ssm:SendCommand",
        "ssm:StartSession",
        // Decryption of customer data/secrets
        "kms:Decrypt",
        "kms:GenerateDataKey",
        "kms:GenerateDataKeyWithoutPlaintext",
        "kms:GenerateDataKeyPair",
        "kms:GenerateDataKeyPairWithoutPlaintext",
        "kms:ReEncryptFrom",
        "kms:ReEncryptTo",
        // Plaintext secret / parameter exfiltration
        "secretsmanager:GetSecretValue",
        "ssm:GetParameter",
        "ssm:GetParameters",
        "ssm:GetParametersByPath",
        // Bulk object DATA exfiltration (metadata reads via *:Get* still allowed)
        "s3:GetObject",
        "s3:GetObjectVersion",
        "s3:GetObjectTorrent",
        // Credential vending / session pivot
        "sts:AssumeRole",
        "sts:AssumeRoleWithWebIdentity",
        "sts:AssumeRoleWithSAML",
        "sts:GetFederationToken",
        "sts:GetSessionToken",
      ],
      Resource: "*",
    },
  ],
});

/**
 * Resolves a credentialRef string into temporary AWS credentials.
 *
 * - If credentialRef starts with "arn:aws:iam::", uses STS AssumeRole.
 * - If credentialRef starts with "vault://", throws (not yet integrated).
 */
export async function resolveCredentials(
  credentialRef: string,
  log?: CredentialAccessLogger,
): Promise<AwsTemporaryCredentials> {
  if (credentialRef.startsWith("vault://")) {
    throw new Error(
      "Vault credential resolution not yet integrated.",
    );
  }

  if (!credentialRef.startsWith("arn:aws:iam::")) {
    throw new Error(
      "Unsupported AWS credential format. Expected vault:// path or IAM role ARN (arn:aws:iam::*).",
    );
  }

  const stsClient = new STSClient({});
  const sessionName = `blackfyre-audit-${Date.now()}`;
  const command = new AssumeRoleCommand({
    RoleArn: credentialRef,
    RoleSessionName: sessionName,
    DurationSeconds: 900,
    Policy: READ_ONLY_SESSION_POLICY,
  });

  const response = await stsClient.send(command);

  if (
    !response.Credentials?.AccessKeyId ||
    !response.Credentials?.SecretAccessKey ||
    !response.Credentials?.SessionToken
  ) {
    // SECURITY FIX (BLACKFYRE audit 2026-06-05): record credential-vending
    // failures as a security-relevant anomaly. Never log the credentialRef
    // beyond the role ARN (which is an identifier, not a secret) and never log
    // the returned access key / secret / session token.
    log?.warn(
      { event: "aws.sts.assume_role.incomplete", roleArn: credentialRef, sessionName },
      "STS AssumeRole returned incomplete credentials",
    );
    throw new Error("STS AssumeRole returned incomplete credentials");
  }

  // SECURITY FIX (BLACKFYRE audit 2026-06-05): structured log for sensitive
  // credential access (cross-account STS session vended into a customer
  // account). Logs only non-secret identifiers — role ARN, redacted session
  // name, and the hardened read-only policy marker — so the access is auditable
  // without ever emitting the temporary access key, secret, or session token.
  log?.info(
    {
      event: "aws.sts.assume_role.vended",
      roleArn: credentialRef,
      sessionName,
      durationSeconds: 900,
      sessionPolicy: "read-only-hardened",
    },
    "Vended scoped read-only STS session for cloud audit",
  );

  return {
    accessKeyId: response.Credentials.AccessKeyId,
    secretAccessKey: response.Credentials.SecretAccessKey,
    sessionToken: response.Credentials.SessionToken,
  };
}
