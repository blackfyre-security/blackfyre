const isProd = $app.stage === "prod";

// App region (see sst.config.ts providers.aws.region). Used to scope the evidence
// CMK's kms:ViaService condition to S3 in this region only.
const region = "ap-south-1";

// SECURITY FIX (BLACKFYRE audit 2026-06-05): evidence bucket previously used
// SSE-S3 (AES256), an AWS-owned key with no customer access control, no
// per-decrypt CloudTrail trail, and no rotation/key-policy boundary. Compliance
// evidence (held under Object Lock for up to 7 years) warrants a customer-managed
// CMK: SSE-KMS gives key-policy-level access control, CloudTrail-audited decrypts,
// and automatic annual rotation. Create a dedicated CMK and encrypt the bucket
// with it below.
//
// DEFERRED FOLLOW-UP: per-tenant BYOK / customer-supplied KMS keys (one CMK or
// grant per tenant so tenants can hold/revoke their own evidence key) is a
// larger change (key provisioning, per-object key selection, rotation tracking)
// and is intentionally out of scope for this fix. This platform-managed CMK is
// the safe quick win that closes the SSE-S3 gap today.
// SECURITY FIX (BLACKFYRE audit 2026-06-05): the BLACKFYRE follow-up review found
// that switching the evidence bucket to SSE-KMS broke its consumers' implicit
// access — the API Lambda and the evidence-queue worker hold S3 permissions (via
// SST `link`) but those grants do NOT extend to the new CMK, so every
// PutObject/GetObject against the bucket would fail at runtime with KMS
// AccessDenied (the reviewer's high/medium findings on infra/queues.ts and
// infra/api.ts). We grant the required `kms:GenerateDataKey*` (encrypt new
// objects) and `kms:Decrypt` (read existing objects) from the KEY-POLICY side
// rather than touching each consumer's IAM, and we tightly scope that grant with
// the `kms:ViaService` condition so the key can only ever be used through S3 in
// this account/region — i.e. exactly the SSE-KMS evidence-bucket path. No role
// gains raw, direct KMS access to this CMK. The account-root statement is the
// mandatory "do not orphan the key" baseline that lets IAM administer the key.
const accountId = aws.getCallerIdentityOutput({}).accountId;
const evidenceKey = new aws.kms.Key("EvidenceBucketKmsKey", {
  description: `Blackfyre evidence bucket SSE-KMS CMK (${$app.stage})`,
  deletionWindowInDays: isProd ? 30 : 7,
  enableKeyRotation: true,
  policy: $jsonStringify({
    Version: "2012-10-17",
    Statement: [
      {
        Sid: "EnableAccountAdministration",
        Effect: "Allow",
        Principal: { AWS: $interpolate`arn:aws:iam::${accountId}:root` },
        Action: "kms:*",
        Resource: "*",
      },
      {
        // Evidence consumers (API Lambda + evidence worker) need to mint data
        // keys to encrypt new objects and to decrypt existing ones — but ONLY
        // through S3 SSE-KMS, never as a standalone KMS call. The ViaService
        // condition enforces that envelope so a compromised consumer role cannot
        // turn its S3 access into a general-purpose decrypt oracle.
        Sid: "AllowEvidenceBucketSseKmsViaS3",
        Effect: "Allow",
        Principal: { AWS: $interpolate`arn:aws:iam::${accountId}:root` },
        Action: [
          "kms:GenerateDataKey",
          "kms:GenerateDataKeyWithoutPlaintext",
          "kms:Decrypt",
        ],
        Resource: "*",
        Condition: {
          StringEquals: { "kms:ViaService": $interpolate`s3.${region}.amazonaws.com` },
        },
      },
    ],
  }),
  tags: { Name: `blackfyre-${$app.stage}-evidence-kms` },
});

// Friendly alias so the key is discoverable in the console / CloudTrail.
new aws.kms.Alias("EvidenceBucketKmsAlias", {
  name: `alias/blackfyre-${$app.stage}-evidence`,
  targetKeyId: evidenceKey.keyId,
});

export const storage = {
  evidenceBucket: new sst.aws.Bucket("EvidenceBucket", {
    versioning: true,
    transform: {
      bucket: {
        objectLockEnabled: true,
      },
    },
  }),
  // Exported so consumers (API Lambda, evidence workers) can be granted
  // kms:Decrypt / kms:GenerateDataKey on the exact CMK rather than "*".
  evidenceKmsKey: evidenceKey,
};

// SECURITY FIX (BLACKFYRE audit 2026-06-05): server-side encryption switched
// from SSE-S3 (AES256) to SSE-KMS using the dedicated customer-managed CMK above.
// bucketKeyEnabled stays on to amortise KMS calls (S3 Bucket Keys) and keep cost
// flat despite the per-object KMS encryption context.
new aws.s3.BucketServerSideEncryptionConfigurationV2("EvidenceBucketSSE", {
  bucket: storage.evidenceBucket.name,
  rules: [
    {
      applyServerSideEncryptionByDefault: {
        sseAlgorithm: "aws:kms",
        kmsMasterKeyId: evidenceKey.arn,
      },
      bucketKeyEnabled: true,
    },
  ],
});

// SECURITY FIX (BLACKFYRE audit 2026-06-05): evidence bucket lacked an explicit
// public-access block. Add a fail-safe block of all public ACLs / policies so
// compliance evidence can never be exposed via a stray bucket policy or ACL.
new aws.s3.BucketPublicAccessBlock("EvidenceBucketPublicBlock", {
  bucket: storage.evidenceBucket.name,
  blockPublicAcls: true,
  blockPublicPolicy: true,
  ignorePublicAcls: true,
  restrictPublicBuckets: true,
});

// Pulumi escape hatch: SST Bucket does not expose objectLockConfiguration natively.
// BucketObjectLockConfigurationV2 sets default retention on the Object Lock bucket.
// GOVERNANCE mode for non-prod (allows emergency delete with s3:BypassGovernanceRetention).
// COMPLIANCE mode for prod (truly immutable -- even root account cannot delete).
new aws.s3.BucketObjectLockConfigurationV2("EvidenceBucketLock", {
  bucket: storage.evidenceBucket.name,
  objectLockEnabled: "Enabled",
  rule: {
    defaultRetention: {
      mode: isProd ? "COMPLIANCE" : "GOVERNANCE",
      days: isProd ? 2555 : 1, // 7 years prod, 1 day dev
    },
  },
});
