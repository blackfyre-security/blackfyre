import {
  S3Client,
  ListBucketsCommand,
  GetPublicAccessBlockCommand,
  GetBucketEncryptionCommand,
  GetBucketVersioningCommand,
  GetBucketLoggingCommand,
} from "@aws-sdk/client-s3";
import type { AgentFindingPayload } from "@blackfyre/shared";
import { mapCheckToControls } from "../../services/compliance-mapper.js";
import type { AwsTemporaryCredentials } from "./credentials.js";

function makeClient(creds: AwsTemporaryCredentials): S3Client {
  return new S3Client({
    credentials: {
      accessKeyId: creds.accessKeyId,
      secretAccessKey: creds.secretAccessKey,
      sessionToken: creds.sessionToken,
    },
  });
}

/**
 * Runs all S3 security checks and returns findings.
 */
export async function auditS3(
  creds: AwsTemporaryCredentials,
): Promise<AgentFindingPayload[]> {
  const client = makeClient(creds);
  const findings: AgentFindingPayload[] = [];

  const bucketsResp = await client.send(new ListBucketsCommand({}));
  const buckets = bucketsResp.Buckets ?? [];

  // Run per-bucket checks concurrently
  const bucketResults = await Promise.all(
    buckets.map(async (bucket) => {
      const name = bucket.Name;
      if (!name) return [];

      const [publicAccess, encryption, versioning, logging] =
        await Promise.all([
          checkPublicAccessBlock(client, name),
          checkEncryption(client, name),
          checkVersioning(client, name),
          checkLogging(client, name),
        ]);

      return [...publicAccess, ...encryption, ...versioning, ...logging];
    }),
  );

  for (const result of bucketResults) {
    findings.push(...result);
  }

  return findings;
}

/**
 * Check: Public access block -> critical if public access is allowed
 */
async function checkPublicAccessBlock(
  client: S3Client,
  bucketName: string,
): Promise<AgentFindingPayload[]> {
  const findings: AgentFindingPayload[] = [];

  try {
    const resp = await client.send(
      new GetPublicAccessBlockCommand({ Bucket: bucketName }),
    );
    const config = resp.PublicAccessBlockConfiguration;

    if (
      !config ||
      !config.BlockPublicAcls ||
      !config.IgnorePublicAcls ||
      !config.BlockPublicPolicy ||
      !config.RestrictPublicBuckets
    ) {
      findings.push({
        title: `S3 bucket "${bucketName}" does not fully block public access`,
        description: `S3 bucket ${bucketName} has incomplete public access block settings. All four public access block flags should be enabled to prevent accidental public exposure.`,
        severity: "critical",
        category: "config",
        resourceType: "AWS::S3::Bucket",
        resourceId: bucketName,
        remediationTier: "auto",
        autoFixAvailable: true,
        controlMappings: mapCheckToControls("s3_public_access"),
      });
    }
  } catch (err: unknown) {
    // NoSuchPublicAccessBlockConfiguration means no block is set at all
    const isNoConfig =
      err instanceof Error &&
      err.name === "NoSuchPublicAccessBlockConfiguration";
    if (isNoConfig) {
      findings.push({
        title: `S3 bucket "${bucketName}" has no public access block configuration`,
        description: `S3 bucket ${bucketName} has no public access block configuration. Enable all four public access block flags to prevent accidental public exposure.`,
        severity: "critical",
        category: "config",
        resourceType: "AWS::S3::Bucket",
        resourceId: bucketName,
        remediationTier: "auto",
        autoFixAvailable: true,
        controlMappings: mapCheckToControls("s3_public_access"),
      });
    } else {
      throw err;
    }
  }

  return findings;
}

/**
 * Check: Bucket encryption -> high if no encryption
 */
async function checkEncryption(
  client: S3Client,
  bucketName: string,
): Promise<AgentFindingPayload[]> {
  const findings: AgentFindingPayload[] = [];

  try {
    const resp = await client.send(
      new GetBucketEncryptionCommand({ Bucket: bucketName }),
    );
    const rules =
      resp.ServerSideEncryptionConfiguration?.Rules ?? [];

    if (rules.length === 0) {
      findings.push({
        title: `S3 bucket "${bucketName}" has no server-side encryption`,
        description: `S3 bucket ${bucketName} does not have server-side encryption configured. Enable SSE-S3 or SSE-KMS to protect data at rest.`,
        severity: "high",
        category: "encryption",
        resourceType: "AWS::S3::Bucket",
        resourceId: bucketName,
        remediationTier: "auto",
        autoFixAvailable: true,
        controlMappings: mapCheckToControls("s3_no_encryption"),
      });
    }
  } catch (err: unknown) {
    const isNoEncryption =
      err instanceof Error &&
      err.name === "ServerSideEncryptionConfigurationNotFoundError";
    if (isNoEncryption) {
      findings.push({
        title: `S3 bucket "${bucketName}" has no server-side encryption`,
        description: `S3 bucket ${bucketName} does not have server-side encryption configured. Enable SSE-S3 or SSE-KMS to protect data at rest.`,
        severity: "high",
        category: "encryption",
        resourceType: "AWS::S3::Bucket",
        resourceId: bucketName,
        remediationTier: "auto",
        autoFixAvailable: true,
        controlMappings: mapCheckToControls("s3_no_encryption"),
      });
    } else {
      throw err;
    }
  }

  return findings;
}

/**
 * Check: Bucket versioning -> medium if not enabled
 */
async function checkVersioning(
  client: S3Client,
  bucketName: string,
): Promise<AgentFindingPayload[]> {
  const findings: AgentFindingPayload[] = [];

  const resp = await client.send(
    new GetBucketVersioningCommand({ Bucket: bucketName }),
  );

  if (resp.Status !== "Enabled") {
    findings.push({
      title: `S3 bucket "${bucketName}" does not have versioning enabled`,
      description: `S3 bucket ${bucketName} versioning status is "${resp.Status ?? "unset"}". Enable versioning to protect against accidental deletions and overwrites.`,
      severity: "medium",
      category: "config",
      resourceType: "AWS::S3::Bucket",
      resourceId: bucketName,
      remediationTier: "auto",
      autoFixAvailable: true,
      controlMappings: mapCheckToControls("s3_no_versioning"),
    });
  }

  return findings;
}

/**
 * Check: Bucket logging -> low if logging disabled
 */
async function checkLogging(
  client: S3Client,
  bucketName: string,
): Promise<AgentFindingPayload[]> {
  const findings: AgentFindingPayload[] = [];

  const resp = await client.send(
    new GetBucketLoggingCommand({ Bucket: bucketName }),
  );

  if (!resp.LoggingEnabled) {
    findings.push({
      title: `S3 bucket "${bucketName}" does not have access logging enabled`,
      description: `S3 bucket ${bucketName} does not have server access logging enabled. Enable logging to track access patterns and detect unauthorized access.`,
      severity: "low",
      category: "logging",
      resourceType: "AWS::S3::Bucket",
      resourceId: bucketName,
      remediationTier: "manual",
      autoFixAvailable: false,
      controlMappings: mapCheckToControls("s3_no_logging"),
    });
  }

  return findings;
}
