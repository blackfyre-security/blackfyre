import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";

const client = new SecretsManagerClient({});

/**
 * Resolve a credential reference to a credentials object.
 * vault:// paths → AWS Secrets Manager
 * Raw JSON strings → parsed directly (dev/test only)
 */
export async function resolveCredentials(credentialRef: string): Promise<Record<string, string>> {
  if (!credentialRef) throw new Error("Credential ref is required");

  if (credentialRef.startsWith("vault://")) {
    const path = credentialRef.slice("vault://".length);
    if (!path || path.length < 3) throw new Error(`Invalid vault path: ${credentialRef}`);

    const command = new GetSecretValueCommand({ SecretId: path });
    const response = await client.send(command);

    if (!response.SecretString) throw new Error(`Secret not found: ${path}`);
    return JSON.parse(response.SecretString);
  }

  try {
    return JSON.parse(credentialRef);
  } catch {
    throw new Error(`Invalid credential ref — must be vault:// path or valid JSON`);
  }
}
