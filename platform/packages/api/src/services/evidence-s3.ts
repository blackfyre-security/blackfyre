import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createHash, randomUUID } from "node:crypto";

export class EvidenceS3Service {
  private client: S3Client;
  private bucket: string;

  constructor(bucket: string, region: string = "us-east-1") {
    this.bucket = bucket;
    this.client = new S3Client({ region });
  }

  /**
   * Upload evidence content to S3 with SHA-256 integrity verification.
   * S3 independently verifies the ChecksumSHA256 on upload -- tampered-in-transit is rejected.
   * Object Lock (WORM) on the bucket prevents modification/deletion after upload.
   *
   * Key format: {tenantId}/{framework}/{findingId}/{uuid}.json
   * DB stores hex digest. AWS ChecksumSHA256 requires base64.
   */
  async uploadEvidence(
    tenantId: string,
    framework: string,
    findingId: string,
    content: Buffer | string,
  ): Promise<{ s3Key: string; sha256Hex: string }> {
    const buf = typeof content === "string" ? Buffer.from(content) : content;
    const sha256Hex = createHash("sha256").update(buf).digest("hex");
    const sha256Base64 = Buffer.from(sha256Hex, "hex").toString("base64");
    const s3Key = `${tenantId}/${framework}/${findingId}/${randomUUID()}.json`;

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: s3Key,
        Body: buf,
        ChecksumSHA256: sha256Base64,
        ContentType: "application/json",
      }),
    );

    return { s3Key, sha256Hex };
  }

  /**
   * Re-verify evidence integrity by fetching object from S3 and recomputing SHA-256.
   * Compares hex digest against expected value stored in DB.
   * Returns false if tampered.
   */
  async verifyEvidence(s3Key: string, expectedSha256Hex: string): Promise<boolean> {
    const response = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: s3Key }),
    );

    const bytes = await (response.Body as any).transformToByteArray();
    const actualHex = createHash("sha256").update(Buffer.from(bytes)).digest("hex");
    return actualHex === expectedSha256Hex;
  }

  /**
   * Generate a presigned GET URL for evidence download.
   * Default expiry: 15 minutes (900 seconds) -- minimizes exposure window.
   */
  async generatePresignedDownloadUrl(s3Key: string, expiresIn: number = 900): Promise<string> {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.bucket, Key: s3Key }),
      { expiresIn },
    );
  }
}
