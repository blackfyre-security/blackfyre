import { describe, it, expect, vi, beforeEach } from "vitest";
import { createHash } from "node:crypto";

// REAL IMPL (BLACKFYRE 2026-06): mock the SSRF-hardened fetch so reference-fetch tests
// run hermetically (no real network). We re-export the real SsrfBlockedError so the
// service's `instanceof` check still works. The mock fn is created via vi.hoisted so it
// is initialised BEFORE the hoisted vi.mock factory runs — a plain top-level `const`
// would be in the temporal dead zone when the factory executes (vitest hoists vi.mock
// above all top-level declarations).
const { mockSafeFetch } = vi.hoisted(() => ({ mockSafeFetch: vi.fn() }));
vi.mock("../../src/lib/safe-fetch.js", async () => {
  const actual = await vi.importActual<typeof import("../../src/lib/safe-fetch.js")>(
    "../../src/lib/safe-fetch.js",
  );
  return { ...actual, safeFetch: mockSafeFetch };
});

import { EvidenceService } from "../../src/services/evidence-service.js";
import { SsrfBlockedError } from "../../src/lib/safe-fetch.js";

const MOCK_SHA256 = "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890";

const mockRow = {
  id: "e1",
  findingId: "f1",
  tenantId: "t1",
  type: "config_snapshot",
  storagePath: "s3://bucket/t1/soc2/f1/uuid.json",
  sha256Hash: MOCK_SHA256,
  // REAL IMPL (BLACKFYRE 2026-06): a content-hashed record is the verifiable case.
  hashSource: "content",
  integrityVerified: true,
  framework: "soc2",
  s3ObjectKey: "t1/soc2/f1/uuid.json",
  collectedAt: new Date(),
  collectedBy: "agent-1",
};

/** Build a chainable mock that resolves at `terminalMethod` with `resolveValue`. */
function makeChain(terminalMethod: string, resolveValue: unknown) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const m of ["from", "where", "limit", "offset", "orderBy", "returning", "values"]) {
    chain[m] = vi.fn().mockReturnThis();
  }
  chain[terminalMethod] = vi.fn().mockResolvedValue(resolveValue);
  return chain;
}

function createMockDb() {
  const mockRows = [mockRow];
  const mockCountRows = [{ count: 1 }];

  // getById path: select().from().where().limit(1) → resolves to mockRows
  const getByIdChain = makeChain("limit", mockRows);

  // listVault rows path: select().from().where().limit().offset().orderBy() → resolves to mockRows
  const listVaultRowsChain = makeChain("orderBy", mockRows);

  // listVault count path: select({ count }).from().where() → resolves to mockCountRows
  const listVaultCountChain = makeChain("where", mockCountRows);

  // insert chain — capture the values passed to .values() so we can assert on the
  // computed sha256Hash / hashSource / integrityVerified the service writes.
  const capturedInsertValues: any[] = [];
  const insertChain = makeChain("returning", mockRows);
  insertChain.values = vi.fn().mockImplementation((v: any) => {
    capturedInsertValues.push(v);
    return insertChain;
  });

  // Track which select call we're on
  let selectIdx = 0;
  const selectFn = vi.fn().mockImplementation(() => {
    selectIdx++;
    // Call 1 (getById or listVault rows): use getByIdChain or listVaultRowsChain
    // Call 2 (listVault count): use listVaultCountChain
    // For listVault, two consecutive selects happen in Promise.all (calls 1 and 2)
    // For getById, only call 1 happens
    // We detect by checking whether a `framework` filter arg was passed
    // Simpler: alternate — but getById only makes 1 call, listVault makes 2.
    // Strategy: return getByIdChain for odd calls, listVaultCountChain for even calls.
    // But listVault first call needs offset/orderBy support (listVaultRowsChain).
    // Use a flag to differentiate.
    return selectIdx % 2 === 1 ? getByIdChain : listVaultCountChain;
  });

  return {
    select: selectFn,
    insert: vi.fn().mockReturnValue(insertChain),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    }),
    delete: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue(mockRows),
      }),
    }),
    _getByIdChain: getByIdChain,
    _listVaultRowsChain: listVaultRowsChain,
    _mockRows: mockRows,
    _capturedInsertValues: capturedInsertValues,
    _resetIdx: () => { selectIdx = 0; },
  };
}

describe("EvidenceService", () => {
  let mockDb: ReturnType<typeof createMockDb>;
  let service: EvidenceService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSafeFetch.mockReset();
    mockDb = createMockDb();
    service = new EvidenceService(mockDb as any);
  });

  describe("create", () => {
    it("inserts an evidence record and returns it", async () => {
      const result = await service.create("t1", {
        findingId: "f1",
        type: "config_snapshot",
        collectedBy: "agent-1",
      });

      expect(mockDb.insert).toHaveBeenCalled();
      expect(result).toBeDefined();
      expect(result.id).toBe("e1");
    });

    // REAL IMPL (BLACKFYRE 2026-06): tamper-evidence honesty regression coverage.
    it("hashes the ACTUAL content bytes when content is provided (hash_source=content)", async () => {
      const content = '{"cloudtrail":"enabled","mfa":true}';
      const expectedHash = createHash("sha256").update(Buffer.from(content, "utf-8")).digest("hex");

      await service.create("t1", {
        findingId: "f1",
        type: "config_snapshot",
        collectedBy: "agent-1",
        content,
      });

      const values = mockDb._capturedInsertValues[0];
      expect(values.sha256Hash).toBe(expectedHash);
      expect(values.hashSource).toBe("content");
      expect(values.integrityVerified).toBe(true);
    });

    it("hashes raw Buffer content identically to its bytes", async () => {
      const buf = Buffer.from([0x00, 0x01, 0x02, 0xff, 0xfe]);
      const expectedHash = createHash("sha256").update(buf).digest("hex");

      await service.create("t1", {
        findingId: "f1",
        type: "manual_upload",
        collectedBy: "agent-1",
        content: buf,
      });

      const values = mockDb._capturedInsertValues[0];
      expect(values.sha256Hash).toBe(expectedHash);
      expect(values.hashSource).toBe("content");
      expect(values.integrityVerified).toBe(true);
    });

    it("does NOT hash content metadata-style: hash differs from the old metadata-only digest", async () => {
      // The previous (buggy) impl hashed metadata when no content. Prove that when content
      // IS given, the digest is over content, NOT over {findingId,collectedBy,...}.
      const content = "real-evidence-bytes";
      const metadataDigest = createHash("sha256")
        .update(JSON.stringify({ findingId: "f1", collectedBy: "agent-1" }))
        .digest("hex");

      await service.create("t1", {
        findingId: "f1",
        type: "config_snapshot",
        collectedBy: "agent-1",
        content,
      });

      const values = mockDb._capturedInsertValues[0];
      expect(values.sha256Hash).not.toBe(metadataDigest);
      expect(values.sha256Hash).toBe(createHash("sha256").update(Buffer.from(content, "utf-8")).digest("hex"));
    });

    it("fetches and hashes the REAL bytes when only a contentUrl is provided (hash_source=reference-fetch)", async () => {
      const fetchedBytes = Buffer.from("fetched-evidence-payload");
      mockSafeFetch.mockResolvedValue({
        ok: true,
        status: 200,
        arrayBuffer: async () => fetchedBytes.buffer.slice(fetchedBytes.byteOffset, fetchedBytes.byteOffset + fetchedBytes.byteLength),
      });

      await service.create("t1", {
        findingId: "f1",
        type: "api_response",
        collectedBy: "agent-1",
        contentUrl: "https://evidence.example.com/object.json",
      });

      expect(mockSafeFetch).toHaveBeenCalledWith(
        "https://evidence.example.com/object.json",
        expect.objectContaining({ method: "GET" }),
        expect.anything(),
      );
      const values = mockDb._capturedInsertValues[0];
      expect(values.sha256Hash).toBe(createHash("sha256").update(fetchedBytes).digest("hex"));
      expect(values.hashSource).toBe("reference-fetch");
      expect(values.integrityVerified).toBe(true);
    });

    it("falls back to metadata-only (NOT tamper-evident) when reference fetch is SSRF-blocked", async () => {
      mockSafeFetch.mockRejectedValue(new SsrfBlockedError("Blocked IP address: 169.254.169.254"));

      await service.create("t1", {
        findingId: "f1",
        type: "api_response",
        collectedBy: "agent-1",
        contentUrl: "http://169.254.169.254/latest/meta-data/",
      });

      const values = mockDb._capturedInsertValues[0];
      expect(values.hashSource).toBe("metadata-only");
      expect(values.integrityVerified).toBe(false);
    });

    it("falls back to metadata-only when reference fetch returns a non-OK status", async () => {
      mockSafeFetch.mockResolvedValue({ ok: false, status: 404, arrayBuffer: async () => new ArrayBuffer(0) });

      await service.create("t1", {
        findingId: "f1",
        type: "api_response",
        collectedBy: "agent-1",
        contentUrl: "https://evidence.example.com/missing.json",
      });

      const values = mockDb._capturedInsertValues[0];
      expect(values.hashSource).toBe("metadata-only");
      expect(values.integrityVerified).toBe(false);
    });

    it("marks metadata-only / integrity_verified=false when NO content and NO reference are provided", async () => {
      await service.create("t1", {
        findingId: "f1",
        type: "config_snapshot",
        collectedBy: "agent-1",
      });

      const values = mockDb._capturedInsertValues[0];
      expect(values.hashSource).toBe("metadata-only");
      expect(values.integrityVerified).toBe(false);
      // The digest must still be populated (NOT-NULL column) and unique per record.
      expect(values.sha256Hash).toMatch(/^[0-9a-f]{64}$/);
    });

    it("emits a structured audit warning for metadata-only records and never logs secrets", async () => {
      const log = { info: vi.fn(), warn: vi.fn() };
      const svc = new EvidenceService(mockDb as any, log);

      await svc.create("t1", {
        findingId: "f1",
        type: "config_snapshot",
        collectedBy: "agent-1",
        content: "super-secret-evidence-body",
      });
      // content path → info event, no secret in payload
      expect(log.info).toHaveBeenCalled();
      const infoPayload = JSON.stringify(log.info.mock.calls);
      expect(infoPayload).toContain("evidence.hash");
      expect(infoPayload).not.toContain("super-secret-evidence-body");

      await svc.create("t1", { findingId: "f1", type: "config_snapshot", collectedBy: "agent-1" });
      expect(log.warn).toHaveBeenCalled();
      const warnPayload = JSON.stringify(log.warn.mock.calls);
      expect(warnPayload).toContain("metadata-only");
    });
  });

  describe("getById", () => {
    it("returns an evidence record when found", async () => {
      const result = await service.getById("e1");

      expect(mockDb.select).toHaveBeenCalled();
      expect(result.id).toBe("e1");
    });

    it("throws notFound when record does not exist", async () => {
      mockDb._getByIdChain.limit.mockResolvedValueOnce([]);

      await expect(service.getById("nonexistent")).rejects.toThrow("Evidence not found");
    });
  });

  describe("listVault", () => {
    it("returns items with sha256Hash and collectedAt", async () => {
      // listVault makes 2 selects in Promise.all: rows (call 1 = odd) + count (call 2 = even)
      // getByIdChain handles rows, listVaultCountChain handles count
      // But getByIdChain uses `limit` as terminal — listVault needs `orderBy` as terminal.
      // Fix: replace getByIdChain with listVaultRowsChain for this test by overriding select.
      const listVaultRowsChain = makeChain("orderBy", [mockRow]);
      const listVaultCountChain = makeChain("where", [{ count: 1 }]);
      let idx = 0;
      mockDb.select.mockImplementation(() => {
        idx++;
        return idx % 2 === 1 ? listVaultRowsChain : listVaultCountChain;
      });

      const result = await service.listVault("t1", { limit: 10, offset: 0 });

      expect(result.rows).toBeDefined();
      expect(result.rows.length).toBe(1);
      expect(result.rows[0].sha256Hash).toBe(MOCK_SHA256);
      expect(result.rows[0].collectedAt).toBeDefined();
      expect(result.total).toBe(1);
    });

    it("filters by framework when provided", async () => {
      const listVaultRowsChain = makeChain("orderBy", [mockRow]);
      const listVaultCountChain = makeChain("where", [{ count: 1 }]);
      let idx = 0;
      mockDb.select.mockImplementation(() => {
        idx++;
        return idx % 2 === 1 ? listVaultRowsChain : listVaultCountChain;
      });

      const result = await service.listVault("t1", { framework: "soc2", limit: 10, offset: 0 });

      // The where condition is applied -- verify filtered result returned
      expect(result.rows).toBeDefined();
      expect(result.rows[0].framework).toBe("soc2");
    });
  });

  describe("verifyIntegrity", () => {
    it("returns { valid: true } on matching hash", async () => {
      // verifyIntegrity resolves the record tenant-scoped (1 select), then s3Service.verifyEvidence
      const mockS3Service = {
        verifyEvidence: vi.fn().mockResolvedValue(true),
      };

      const result = await service.verifyIntegrity("e1", "t1", mockS3Service as any);

      expect(result.valid).toBe(true);
      expect(result.expected).toBe(MOCK_SHA256);
      expect(result.actual).toBe(MOCK_SHA256);
      expect(result.hashSource).toBe("content");
      expect(mockS3Service.verifyEvidence).toHaveBeenCalledWith(
        "t1/soc2/f1/uuid.json",
        MOCK_SHA256,
      );
    });

    it("returns { valid: false } and a mismatch on tampered content", async () => {
      const mockS3Service = { verifyEvidence: vi.fn().mockResolvedValue(false) };

      const result = await service.verifyIntegrity("e1", "t1", mockS3Service as any);

      expect(result.valid).toBe(false);
      expect(result.actual).toBe("mismatch");
    });

    // REAL IMPL (BLACKFYRE 2026-06): never claim tamper-evidence over data we did not hash.
    it("REFUSES to verify a metadata-only record (not content-tamper-evident)", async () => {
      mockDb._getByIdChain.limit.mockResolvedValueOnce([
        { ...mockRow, hashSource: "metadata-only", integrityVerified: false },
      ]);
      const mockS3Service = { verifyEvidence: vi.fn().mockResolvedValue(true) };

      const result = await service.verifyIntegrity("e1", "t1", mockS3Service as any);

      expect(result.valid).toBe(false);
      expect(result.hashSource).toBe("metadata-only");
      expect(result.reason).toMatch(/metadata-only/);
      // Crucially: we must NOT call S3 verify and present its result as integrity.
      expect(mockS3Service.verifyEvidence).not.toHaveBeenCalled();
    });

    // SECURITY REGRESSION (cross-tenant IDOR): verifyIntegrity used to resolve the
    // record with the UN-scoped getById, so any authenticated user holding an
    // evidence UUID could verify — and via the sibling download route retrieve —
    // another tenant's compliance evidence.
    //
    // Asserting on the mock DB is NOT sufficient here: the shared select-chain mock
    // answers getById and getByIdForTenant identically, so a "row not found" test
    // passes with the bug still present. Assert the resolution PATH instead — that
    // the tenant-scoped lookup is the one used, and that it receives the caller's
    // tenant. This fails if verifyIntegrity is switched back to getById.
    it("resolves the record tenant-scoped, not by id alone", async () => {
      const scoped = vi.spyOn(service, "getByIdForTenant");
      const unscoped = vi.spyOn(service, "getById");
      const mockS3Service = { verifyEvidence: vi.fn().mockResolvedValue(true) };

      await service.verifyIntegrity("e1", "t1", mockS3Service as any);

      expect(scoped).toHaveBeenCalledWith("e1", "t1");
      expect(unscoped).not.toHaveBeenCalled();

      scoped.mockRestore();
      unscoped.mockRestore();
    });

    it("returns valid:false with reason when a content record has no S3 object yet", async () => {
      mockDb._getByIdChain.limit.mockResolvedValueOnce([
        { ...mockRow, s3ObjectKey: null },
      ]);
      const mockS3Service = { verifyEvidence: vi.fn() };

      const result = await service.verifyIntegrity("e1", "t1", mockS3Service as any);

      expect(result.valid).toBe(false);
      expect(result.actual).toBe("no-s3-key");
      expect(mockS3Service.verifyEvidence).not.toHaveBeenCalled();
    });
  });
});
