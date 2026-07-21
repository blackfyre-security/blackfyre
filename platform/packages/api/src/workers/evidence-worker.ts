import type { SQSEvent } from "aws-lambda";
import { EvidenceS3Service } from "../services/evidence-s3.js";
import { eq } from "drizzle-orm";
import { evidence } from "../db/schema.js";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";

export interface EvidenceJobData {
  evidenceId: string;   // DB record ID (pre-created in pending state)
  tenantId: string;
  findingId: string;
  framework: string;
  type: string;
  content: string;      // JSON/text, or base64 when contentEncoding is "base64"
  // How `content` is encoded. Without this the uploader defaulted to utf8, so a
  // base64-encoded binary upload was stored as the base64 TEXT — the S3 object was
  // unopenable and sha256Hash covered the encoding rather than the evidence.
  contentEncoding?: "utf8" | "base64";
  collectedBy: string;
}

export async function handler(event: SQSEvent): Promise<void> {
  const bucket = process.env.EVIDENCE_BUCKET;
  const dbUrl = process.env.DATABASE_URL;

  if (!bucket) {
    console.error("[evidence-worker] EVIDENCE_BUCKET not set");
    return;
  }
  if (!dbUrl) {
    console.error("[evidence-worker] DATABASE_URL not set");
    return;
  }

  const s3Service = new EvidenceS3Service(bucket, process.env.AWS_REGION ?? "us-east-1");
  const client = postgres(dbUrl, { max: 5 });
  const db = drizzle(client);

  for (const record of event.Records) {
    const { data } = JSON.parse(record.body) as { data: EvidenceJobData };
    console.log(`[evidence-worker] Processing evidence job: ${data.evidenceId}`);

    try {
      // Upload to S3 with SHA-256 integrity
      const { s3Key, sha256Hex } = await s3Service.uploadEvidence(
        data.tenantId,
        data.framework,
        data.findingId,
        data.content,
        data.contentEncoding ?? "utf8",
      );

      // Update DB record with real S3 key and hash
      await db
        .update(evidence)
        .set({
          s3ObjectKey: s3Key,
          sha256Hash: sha256Hex,
          storagePath: `s3://${bucket}/${s3Key}`,
          framework: data.framework,
        })
        .where(eq(evidence.id, data.evidenceId));

      console.log(`[evidence-worker] Evidence ${data.evidenceId} uploaded to ${s3Key}`);
    } catch (error) {
      console.error(`[evidence-worker] Failed to process evidence ${data.evidenceId}:`, error);
      throw error; // SQS will retry
    }
  }
}
