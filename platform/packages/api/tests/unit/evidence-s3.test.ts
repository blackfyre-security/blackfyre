import { describe, it, expect, vi, beforeEach } from "vitest";
import { createHash } from "node:crypto";

// Mock @aws-sdk/client-s3
const mockSend = vi.fn();
vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: vi.fn().mockImplementation(() => ({ send: mockSend })),
  PutObjectCommand: vi.fn().mockImplementation((input) => ({ input })),
  GetObjectCommand: vi.fn().mockImplementation((input) => ({ input })),
}));

// Mock @aws-sdk/s3-request-presigner
vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: vi.fn().mockResolvedValue("https://s3.example.com/presigned"),
}));

describe("EvidenceS3Service", () => {
  let service: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockSend.mockResolvedValue({});
    const mod = await import("../../src/services/evidence-s3.js");
    service = new mod.EvidenceS3Service("test-bucket", "us-east-1");
  });

  describe("uploadEvidence", () => {
    it("calls PutObjectCommand with ChecksumSHA256 set", async () => {
      const { PutObjectCommand } = await import("@aws-sdk/client-s3");
      const content = Buffer.from("test evidence content");

      const result = await service.uploadEvidence("tenant-1", "soc2", "finding-1", content);

      expect(PutObjectCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          ChecksumSHA256: expect.any(String),
          Bucket: "test-bucket",
        }),
      );
      expect(result.sha256Hex).toBe(
        createHash("sha256").update(content).digest("hex"),
      );
      expect(result.s3Key).toContain("tenant-1/soc2/finding-1/");
    });

    it("computes correct SHA-256 hex-to-base64 conversion", () => {
      const content = Buffer.from("hello world");
      const hex = createHash("sha256").update(content).digest("hex");
      const base64 = Buffer.from(hex, "hex").toString("base64");

      expect(hex).toBe("b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9");
      expect(base64).toBe("uU0nuZNNPgilLlLX2n2r+sSE7+N6U4DukIj3rOLvzek=");
    });
  });

  describe("verifyEvidence", () => {
    it("returns false when expected hash does not match recomputed", async () => {
      // Mock GetObjectCommand returning different content
      const bodyContent = Buffer.from("actual content");
      mockSend.mockResolvedValueOnce({
        Body: { transformToByteArray: () => Promise.resolve(bodyContent) },
      });

      const wrongHash = "0000000000000000000000000000000000000000000000000000000000000000";
      const result = await service.verifyEvidence("some/key", wrongHash);
      expect(result).toBe(false);
    });

    it("returns true when hash matches", async () => {
      const bodyContent = Buffer.from("actual content");
      const correctHash = createHash("sha256").update(bodyContent).digest("hex");
      mockSend.mockResolvedValueOnce({
        Body: { transformToByteArray: () => Promise.resolve(bodyContent) },
      });

      const result = await service.verifyEvidence("some/key", correctHash);
      expect(result).toBe(true);
    });
  });

  describe("generatePresignedDownloadUrl", () => {
    it("returns a presigned URL string", async () => {
      const url = await service.generatePresignedDownloadUrl("some/key");
      expect(url).toBe("https://s3.example.com/presigned");
    });
  });
});
