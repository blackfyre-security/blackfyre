import { describe, it, expect, vi, beforeEach } from "vitest";
import { Readable } from "node:stream";

// Mock S3 client
const mockSend = vi.fn();
vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: vi.fn().mockImplementation(() => ({ send: mockSend })),
  GetObjectCommand: vi.fn().mockImplementation((input) => ({ input })),
}));

// Mock @aws-sdk/lib-storage
const mockUploadDone = vi.fn().mockResolvedValue({});
vi.mock("@aws-sdk/lib-storage", () => ({
  Upload: vi.fn().mockImplementation(() => ({
    done: mockUploadDone,
  })),
}));

// Mock @aws-sdk/s3-request-presigner
vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: vi.fn().mockResolvedValue("https://s3.example.com/bundle.zip"),
}));

// Mock archiver
vi.mock("archiver", () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      pipe: vi.fn().mockReturnThis(),
      append: vi.fn(),
      finalize: vi.fn().mockResolvedValue(undefined),
      on: vi.fn(),
      pointer: vi.fn().mockReturnValue(1024),
    })),
  };
});

// Mock pdfkit
vi.mock("pdfkit", () => {
  const MockPDFDocument = vi.fn().mockImplementation(() => {
    const readable = new Readable({ read() { this.push(Buffer.from("PDF")); this.push(null); } });
    (readable as any).fontSize = vi.fn().mockReturnValue(readable);
    (readable as any).text = vi.fn().mockReturnValue(readable);
    (readable as any).moveDown = vi.fn().mockReturnValue(readable);
    (readable as any).end = vi.fn(() => { readable.push(null); });
    return readable;
  });
  return { default: MockPDFDocument };
});

describe("EvidenceBundleService", () => {
  let service: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    // Mock GetObjectCommand to return a readable body
    mockSend.mockResolvedValue({
      Body: {
        transformToByteArray: () => Promise.resolve(Buffer.from('{"test": true}')),
      },
    });

    const mod = await import("../../src/services/evidence-bundle.js");
    service = new mod.EvidenceBundleService("test-bucket", "us-east-1");
  });

  describe("generateAuditBundle", () => {
    const mockEvidence = [
      {
        id: "e1",
        findingId: "f1",
        tenantId: "t1",
        type: "config_snapshot",
        sha256Hash: "abc123",
        s3ObjectKey: "t1/soc2/f1/uuid1.json",
        framework: "soc2",
        collectedAt: new Date(),
        collectedBy: "agent-1",
        storagePath: "s3://bucket/t1/soc2/f1/uuid1.json",
      },
      {
        id: "e2",
        findingId: "f2",
        tenantId: "t1",
        type: "api_response",
        sha256Hash: "def456",
        s3ObjectKey: "t1/soc2/f2/uuid2.json",
        framework: "soc2",
        collectedAt: new Date(),
        collectedBy: "agent-1",
        storagePath: "s3://bucket/t1/soc2/f2/uuid2.json",
      },
    ];

    it("calls GetObjectCommand for each evidence item with s3ObjectKey", async () => {
      const { GetObjectCommand } = await import("@aws-sdk/client-s3");
      const result = await service.generateAuditBundle("t1", "soc2", mockEvidence);

      // Should call GetObjectCommand for each evidence item + 1 for the presigned URL
      // Total = evidenceCount + 1 (presigned URL for bundle download)
      expect(GetObjectCommand).toHaveBeenCalledTimes(mockEvidence.length + 1);
      expect(result.evidenceCount).toBe(2);
    });

    it("returns a presigned URL for the bundle", async () => {
      const result = await service.generateAuditBundle("t1", "soc2", mockEvidence);
      expect(result.presignedUrl).toBe("https://s3.example.com/bundle.zip");
    });

    it("creates a zip via archiver and uploads via lib-storage", async () => {
      const archiver = (await import("archiver")).default;
      const { Upload } = await import("@aws-sdk/lib-storage");

      await service.generateAuditBundle("t1", "soc2", mockEvidence);

      expect(archiver).toHaveBeenCalledWith("zip", expect.any(Object));
      expect(Upload).toHaveBeenCalled();
      expect(mockUploadDone).toHaveBeenCalled();
    });

    it("handles empty evidence list gracefully", async () => {
      const result = await service.generateAuditBundle("t1", "soc2", []);
      expect(result.evidenceCount).toBe(0);
      expect(result.presignedUrl).toBe("https://s3.example.com/bundle.zip");
    });
  });
});
