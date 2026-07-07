import { describe, it, expect, vi, beforeEach } from "vitest";
import { ReportGeneratorService } from "../../src/services/report-generator.js";
import { ComplianceService } from "../../src/services/compliance-service.js";

// Mock ComplianceService methods
vi.mock("../../src/services/compliance-service.js", () => {
  return {
    ComplianceService: vi.fn(),
  };
});

function createMockDb() {
  const chainable = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    offset: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockResolvedValue([]),
    returning: vi.fn().mockResolvedValue([]),
    values: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
  };

  return {
    select: vi.fn().mockReturnValue(chainable),
    insert: vi.fn().mockReturnValue(chainable),
    delete: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([]),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([]),
        }),
      }),
    }),
    _chainable: chainable,
  };
}

function createMockComplianceService() {
  return {
    getScores: vi.fn(),
    getMatrix: vi.fn(),
    getTrend: vi.fn(),
    getAvailableFrameworks: vi.fn(),
  };
}

describe("ReportGeneratorService", () => {
  let mockDb: ReturnType<typeof createMockDb>;
  let mockComplianceService: ReturnType<typeof createMockComplianceService>;
  let service: ReportGeneratorService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    mockComplianceService = createMockComplianceService();

    // Create service and inject the mock compliance service
    service = new ReportGeneratorService(mockDb as any);
    (service as any).complianceService = mockComplianceService;
  });

  describe("generateBoardSummary", () => {
    it("returns all 5 framework scores", async () => {
      const mockScores = [
        { framework: "soc2", score: 85, passCount: 17, failCount: 2, partialCount: 1, naCount: 0, totalControls: 20, evaluatedControls: 20 },
        { framework: "iso27001", score: 72, passCount: 14, failCount: 4, partialCount: 2, naCount: 0, totalControls: 20, evaluatedControls: 20 },
        { framework: "hipaa", score: 90, passCount: 18, failCount: 1, partialCount: 1, naCount: 0, totalControls: 20, evaluatedControls: 20 },
        { framework: "gdpr", score: 65, passCount: 13, failCount: 5, partialCount: 2, naCount: 0, totalControls: 20, evaluatedControls: 20 },
        { framework: "pcidss", score: 78, passCount: 15, failCount: 3, partialCount: 2, naCount: 0, totalControls: 20, evaluatedControls: 20 },
      ];

      mockComplianceService.getScores.mockResolvedValue(mockScores);

      // Mock findings count queries (open findings, critical findings)
      mockDb._chainable.where.mockReturnThis();
      // First call: open findings count, second: critical findings count,
      // third: scan count, fourth: total remediations, fifth: completed remediations
      let callCount = 0;
      mockDb.select.mockImplementation(() => {
        callCount++;
        const innerChainable = {
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          innerJoin: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue([]),
          offset: vi.fn().mockReturnThis(),
          orderBy: vi.fn().mockResolvedValue([]),
        };

        switch (callCount) {
          case 1: // open findings
            innerChainable.where.mockResolvedValue([{ count: 12 }]);
            break;
          case 2: // critical findings
            innerChainable.where.mockResolvedValue([{ count: 3 }]);
            break;
          case 3: // recent scans
            innerChainable.where.mockResolvedValue([{ count: 5 }]);
            break;
          case 4: // total remediations
            innerChainable.where.mockResolvedValue([{ count: 10 }]);
            break;
          case 5: // completed remediations
            innerChainable.where.mockResolvedValue([{ count: 7 }]);
            break;
          default:
            innerChainable.where.mockResolvedValue([{ count: 0 }]);
        }

        return innerChainable;
      });

      const result = await service.generateBoardSummary("tenant-1");

      expect(result.frameworkScores).toHaveLength(5);
      expect(result.frameworkScores.map((s) => s.framework)).toEqual([
        "soc2", "iso27001", "hipaa", "gdpr", "pcidss",
      ]);
      expect(result.frameworkScores[0].score).toBe(85);
      expect(result.frameworkScores[2].score).toBe(90);
      expect(result.totalOpenFindings).toBe(12);
      expect(result.criticalFindings).toBe(3);
      expect(result.recentScanCount).toBe(5);
      expect(result.remediationProgress).toBe(70); // 7/10 * 100
      expect(result.generatedAt).toBeDefined();
      expect(mockComplianceService.getScores).toHaveBeenCalledWith("tenant-1");
    });
  });

  describe("generateReadiness", () => {
    it("returns correct structure with topFailingControls", async () => {
      const mockMatrix = {
        framework: "soc2",
        version: "2017",
        score: 75,
        entries: [
          { controlId: "CC1.1", controlName: "Control 1", weight: 3, category: "Access Control", status: "pass", findingIds: [], evidenceCount: 0 },
          { controlId: "CC1.2", controlName: "Control 2", weight: 2, category: "Access Control", status: "fail", findingIds: ["f1"], evidenceCount: 0 },
          { controlId: "CC2.1", controlName: "Control 3", weight: 3, category: "Encryption", status: "fail", findingIds: ["f2", "f3"], evidenceCount: 0 },
          { controlId: "CC2.2", controlName: "Control 4", weight: 1, category: "Encryption", status: "partial", findingIds: ["f4"], evidenceCount: 0 },
          { controlId: "CC3.1", controlName: "Control 5", weight: 2, category: "Logging", status: "pass", findingIds: [], evidenceCount: 0 },
        ],
      };

      mockComplianceService.getMatrix.mockResolvedValue(mockMatrix);

      // Mock findings severity counts: 5 severity queries
      let severityCallCount = 0;
      const severityCounts: Record<string, number> = {
        critical: 1,
        high: 3,
        medium: 5,
        low: 2,
        info: 0,
      };
      const severityOrder = ["critical", "high", "medium", "low", "info"];

      mockDb.select.mockImplementation(() => {
        const innerChainable = {
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockImplementation(() => {
            const sev = severityOrder[severityCallCount] ?? "info";
            severityCallCount++;
            return Promise.resolve([{ count: severityCounts[sev] }]);
          }),
          innerJoin: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue([]),
          offset: vi.fn().mockReturnThis(),
          orderBy: vi.fn().mockResolvedValue([]),
        };
        return innerChainable;
      });

      const result = await service.generateReadiness("tenant-1", "soc2");

      expect(result.framework).toBe("soc2");
      expect(result.overallScore).toBe(75);
      expect(result.totalControls).toBe(5);
      expect(result.passCount).toBe(2);
      expect(result.failCount).toBe(2);
      expect(result.partialCount).toBe(1);

      // topFailingControls should include fail and partial entries, sorted by weight desc
      expect(result.topFailingControls).toHaveLength(3);
      expect(result.topFailingControls[0].controlId).toBe("CC2.1"); // weight 3
      expect(result.topFailingControls[1].controlId).toBe("CC1.2"); // weight 2
      expect(result.topFailingControls[2].controlId).toBe("CC2.2"); // weight 1

      expect(result.findingsBySeverity).toBeDefined();
      expect(result.generatedAt).toBeDefined();
      expect(mockComplianceService.getMatrix).toHaveBeenCalledWith("tenant-1", "soc2");
    });
  });

  describe("generateGapAnalysis", () => {
    it("filters only fail/partial controls and groups by category", async () => {
      const mockMatrix = {
        framework: "iso27001",
        version: "2022",
        score: 60,
        entries: [
          { controlId: "A5.1", controlName: "Policy", weight: 2, category: "Governance", status: "pass", findingIds: [], evidenceCount: 0 },
          { controlId: "A5.2", controlName: "Roles", weight: 1, category: "Governance", status: "fail", findingIds: ["f1"], evidenceCount: 0 },
          { controlId: "A8.1", controlName: "Inventory", weight: 3, category: "Asset Management", status: "partial", findingIds: ["f2"], evidenceCount: 0 },
          { controlId: "A8.2", controlName: "Classification", weight: 2, category: "Asset Management", status: "fail", findingIds: ["f3", "f4"], evidenceCount: 0 },
          { controlId: "A9.1", controlName: "Access", weight: 3, category: "Access Control", status: "pass", findingIds: [], evidenceCount: 0 },
          { controlId: "A9.2", controlName: "Auth", weight: 2, category: "Access Control", status: "na", findingIds: [], evidenceCount: 0 },
        ],
      };

      mockComplianceService.getMatrix.mockResolvedValue(mockMatrix);

      const result = await service.generateGapAnalysis("tenant-1", "iso27001");

      expect(result.framework).toBe("iso27001");
      expect(result.totalGaps).toBe(3); // 1 fail + 1 partial + 1 fail

      // Should have 2 category groups: Governance and Asset Management
      expect(result.gaps).toHaveLength(2);

      const governanceGap = result.gaps.find((g) => g.category === "Governance");
      expect(governanceGap).toBeDefined();
      expect(governanceGap!.controls).toHaveLength(1);
      expect(governanceGap!.controls[0].controlId).toBe("A5.2");
      expect(governanceGap!.controls[0].status).toBe("fail");
      expect(governanceGap!.controls[0].findingCount).toBe(1);

      const assetGap = result.gaps.find((g) => g.category === "Asset Management");
      expect(assetGap).toBeDefined();
      expect(assetGap!.controls).toHaveLength(2);

      // Access Control should NOT be in gaps (pass and na only)
      const accessGap = result.gaps.find((g) => g.category === "Access Control");
      expect(accessGap).toBeUndefined();

      expect(result.generatedAt).toBeDefined();
      expect(mockComplianceService.getMatrix).toHaveBeenCalledWith("tenant-1", "iso27001");
    });

    it("returns empty gaps when all controls pass", async () => {
      const mockMatrix = {
        framework: "soc2",
        version: "2017",
        score: 100,
        entries: [
          { controlId: "CC1.1", controlName: "Control 1", weight: 3, category: "Access Control", status: "pass", findingIds: [], evidenceCount: 0 },
          { controlId: "CC2.1", controlName: "Control 2", weight: 2, category: "Encryption", status: "pass", findingIds: [], evidenceCount: 0 },
        ],
      };

      mockComplianceService.getMatrix.mockResolvedValue(mockMatrix);

      const result = await service.generateGapAnalysis("tenant-1", "soc2");

      expect(result.totalGaps).toBe(0);
      expect(result.gaps).toHaveLength(0);
    });
  });
});
