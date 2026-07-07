import {
  KMSClient,
  ListKeysCommand,
  DescribeKeyCommand,
  GetKeyRotationStatusCommand,
  type KeyListEntry,
} from "@aws-sdk/client-kms";
import type { AgentFindingPayload } from "@blackfyre/shared";
import { mapCheckToControls } from "../../services/compliance-mapper.js";
import type { AwsTemporaryCredentials } from "./credentials.js";

function makeClient(creds: AwsTemporaryCredentials): KMSClient {
  return new KMSClient({
    credentials: {
      accessKeyId: creds.accessKeyId,
      secretAccessKey: creds.secretAccessKey,
      sessionToken: creds.sessionToken,
    },
  });
}

/**
 * Runs all KMS security checks and returns findings.
 */
export async function auditKMS(
  creds: AwsTemporaryCredentials,
): Promise<AgentFindingPayload[]> {
  const client = makeClient(creds);
  const findings: AgentFindingPayload[] = [];

  // List all KMS keys (paginated)
  const keys: KeyListEntry[] = [];
  let marker: string | undefined;

  do {
    const resp = await client.send(
      new ListKeysCommand({ Marker: marker, Limit: 100 }),
    );
    if (resp.Keys) keys.push(...resp.Keys);
    marker = resp.Truncated ? resp.NextMarker : undefined;
  } while (marker);

  // Check each key concurrently
  const keyResults = await Promise.all(
    keys.map(async (key) => {
      if (!key.KeyId) return [];
      return checkKey(client, key.KeyId, key.KeyArn ?? key.KeyId);
    }),
  );

  for (const result of keyResults) {
    findings.push(...result);
  }

  return findings;
}

/**
 * Checks a single KMS key for rotation status and pending deletion.
 */
async function checkKey(
  client: KMSClient,
  keyId: string,
  keyArn: string,
): Promise<AgentFindingPayload[]> {
  const findings: AgentFindingPayload[] = [];

  const descResp = await client.send(
    new DescribeKeyCommand({ KeyId: keyId }),
  );
  const metadata = descResp.KeyMetadata;

  if (!metadata) return findings;

  // Skip AWS-managed keys (we can only check customer-managed keys for rotation)
  if (metadata.KeyManager !== "CUSTOMER") return findings;

  // Check: Key pending deletion -> high
  if (metadata.KeyState === "PendingDeletion") {
    findings.push({
      title: `KMS key "${keyId}" is pending deletion`,
      description: `KMS key ${keyArn} is scheduled for deletion. Verify this is intentional and that no resources depend on this key. Data encrypted with this key will become permanently inaccessible after deletion.`,
      severity: "high",
      category: "encryption",
      resourceType: "AWS::KMS::Key",
      resourceId: keyArn,
      remediationTier: "manual",
      autoFixAvailable: false,
      controlMappings: mapCheckToControls("kms_key_pending_deletion"),
    });
    // Don't check rotation for keys pending deletion
    return findings;
  }

  // Only check rotation for enabled symmetric keys
  if (
    metadata.KeyState !== "Enabled" ||
    (metadata.KeySpec !== "SYMMETRIC_DEFAULT" && metadata.KeySpec !== undefined)
  ) {
    return findings;
  }

  // Check: Key rotation disabled -> medium
  try {
    const rotationResp = await client.send(
      new GetKeyRotationStatusCommand({ KeyId: keyId }),
    );

    if (!rotationResp.KeyRotationEnabled) {
      findings.push({
        title: `KMS key "${keyId}" does not have automatic rotation enabled`,
        description: `Customer-managed KMS key ${keyArn} does not have automatic key rotation enabled. Enable rotation to limit the amount of data encrypted under a single key version.`,
        severity: "medium",
        category: "encryption",
        resourceType: "AWS::KMS::Key",
        resourceId: keyArn,
        remediationTier: "auto",
        autoFixAvailable: true,
        controlMappings: mapCheckToControls("kms_rotation_disabled"),
      });
    }
  } catch {
    // Some key types don't support rotation status queries — skip
  }

  return findings;
}
