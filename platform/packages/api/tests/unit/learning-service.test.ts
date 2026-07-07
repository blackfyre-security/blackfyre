import { describe, it, expect, vi } from "vitest";
import { LearningService } from "../../src/services/learning-service.js";

/**
 * Creates a mock DB that returns different results for sequential select() calls.
 * Each call to select() returns a chainable that resolves to the next result in the list.
 */
function createMockDb(selectResults: unknown[][] = []) {
  let selectCallIndex = 0;

  const chainable = () => {
    const idx = selectCallIndex++;
    const result = selectResults[idx] ?? [];
    const chain: Record<string, any> = {};
    chain.from = vi.fn().mockReturnValue(chain);
    chain.where = vi.fn().mockReturnValue(chain);
    chain.limit = vi.fn().mockReturnValue(chain);
    chain.offset = vi.fn().mockReturnValue(chain);
    chain.orderBy = vi.fn().mockReturnValue(chain);
    chain.groupBy = vi.fn().mockReturnValue(chain);
    chain.innerJoin = vi.fn().mockReturnValue(chain);
    chain.returning = vi.fn().mockResolvedValue(result);
    chain.then = (resolve: (v: unknown) => void) => resolve(result);
    return chain;
  };

  const insertChain: Record<string, any> = {};
  insertChain.values = vi.fn().mockReturnValue(insertChain);
  insertChain.returning = vi.fn().mockResolvedValue([]);

  const updateChain: Record<string, any> = {};
  updateChain.set = vi.fn().mockReturnValue(updateChain);
  updateChain.where = vi.fn().mockReturnValue(updateChain);
  updateChain.returning = vi.fn().mockResolvedValue([]);

  return {
    select: vi.fn().mockImplementation(chainable),
    insert: vi.fn().mockReturnValue(insertChain),
    update: vi.fn().mockReturnValue(updateChain),
    _insertChain: insertChain,
    _updateChain: updateChain,
  };
}

describe("LearningService", () => {
  describe("getStats", () => {
    it("returns correct structure with totals, patternsByType, industries, and avgConfidence", async () => {
      const totalResult = [{ count: 42 }];
      const byTypeResult = [
        { patternType: "common_finding", count: 20 },
        { patternType: "false_positive", count: 10 },
        { patternType: "remediation_rate", count: 8 },
        { patternType: "predicted_gap", count: 4 },
      ];
      const industriesResult = [
        { industry: "fintech" },
        { industry: "healthtech" },
        { industry: "saas" },
      ];
      const avgConfidenceResult = [{ avg: "72" }];

      const db = createMockDb([
        totalResult,
        byTypeResult,
        industriesResult,
        avgConfidenceResult,
      ]);
      const service = new LearningService(db as any);

      const stats = await service.getStats();

      expect(stats.totalPatterns).toBe(42);
      expect(stats.patternsByType).toEqual({
        common_finding: 20,
        false_positive: 10,
        remediation_rate: 8,
        predicted_gap: 4,
      });
      expect(stats.industriesCovered).toEqual(["fintech", "healthtech", "saas"]);
      expect(stats.avgConfidence).toBe(72);
    });

    it("returns 0 avgConfidence when no patterns exist", async () => {
      const db = createMockDb([
        [{ count: 0 }],   // total
        [],                 // byType
        [],                 // industries
        [{ avg: null }],    // avgConfidence
      ]);
      const service = new LearningService(db as any);

      const stats = await service.getStats();

      expect(stats.totalPatterns).toBe(0);
      expect(stats.patternsByType).toEqual({});
      expect(stats.industriesCovered).toEqual([]);
      expect(stats.avgConfidence).toBe(0);
    });
  });

  describe("getIndustryInsight", () => {
    it("returns all 4 sections for an industry", async () => {
      const patterns = [
        {
          id: "p1",
          patternType: "common_finding",
          industry: "fintech",
          framework: null,
          category: "iam",
          metric: "occurrence_rate",
          value: 65,
          sampleSize: 10,
          confidence: 100,
          lastUpdatedAt: new Date(),
        },
        {
          id: "p2",
          patternType: "remediation_rate",
          industry: "fintech",
          framework: null,
          category: "encryption",
          metric: "avg_fix_days",
          value: 14,
          sampleSize: 5,
          confidence: 50,
          lastUpdatedAt: new Date(),
        },
        {
          id: "p3",
          patternType: "false_positive",
          industry: "fintech",
          framework: null,
          category: "logging",
          metric: "false_positive_rate",
          value: 12,
          sampleSize: 3,
          confidence: 30,
          lastUpdatedAt: new Date(),
        },
        {
          id: "p4",
          patternType: "predicted_gap",
          industry: "fintech",
          framework: "soc2",
          category: "network",
          metric: "likelihood",
          value: 80,
          sampleSize: 8,
          confidence: 80,
          lastUpdatedAt: new Date(),
        },
      ];

      const db = createMockDb([patterns]);
      const service = new LearningService(db as any);

      const insight = await service.getIndustryInsight("fintech");

      expect(insight.industry).toBe("fintech");
      expect(insight.commonFindings).toHaveLength(1);
      expect(insight.commonFindings[0]).toEqual({
        category: "iam",
        occurrenceRate: 65,
        sampleSize: 10,
      });
      expect(insight.avgRemediationDays).toHaveLength(1);
      expect(insight.avgRemediationDays[0]).toEqual({
        category: "encryption",
        avgDays: 14,
      });
      expect(insight.falsePositiveRates).toHaveLength(1);
      expect(insight.falsePositiveRates[0]).toEqual({
        category: "logging",
        rate: 12,
      });
      expect(insight.predictedGaps).toHaveLength(1);
      expect(insight.predictedGaps[0]).toEqual({
        framework: "soc2",
        controlCategory: "network",
        likelihood: 80,
      });
    });

    it("returns empty sections when no patterns exist", async () => {
      const db = createMockDb([[]]);
      const service = new LearningService(db as any);

      const insight = await service.getIndustryInsight("saas");

      expect(insight.industry).toBe("saas");
      expect(insight.commonFindings).toHaveLength(0);
      expect(insight.avgRemediationDays).toHaveLength(0);
      expect(insight.falsePositiveRates).toHaveLength(0);
      expect(insight.predictedGaps).toHaveLength(0);
    });
  });

  describe("getPredictedGaps", () => {
    it("returns predictions for high-occurrence patterns in the given industry", async () => {
      // First call: common_finding patterns
      const commonPatterns = [
        {
          id: "p1",
          patternType: "common_finding",
          industry: "healthtech",
          framework: null,
          category: "encryption",
          metric: "occurrence_rate",
          value: 75,
          sampleSize: 12,
          confidence: 100,
          lastUpdatedAt: new Date(),
        },
        {
          id: "p2",
          patternType: "common_finding",
          industry: "healthtech",
          framework: null,
          category: "iam",
          metric: "occurrence_rate",
          value: 45,
          sampleSize: 8,
          confidence: 80,
          lastUpdatedAt: new Date(),
        },
        {
          id: "p3",
          patternType: "common_finding",
          industry: "healthtech",
          framework: null,
          category: "logging",
          metric: "occurrence_rate",
          value: 20,
          sampleSize: 3,
          confidence: 30,
          lastUpdatedAt: new Date(),
        },
      ];
      // Second call: existing predicted_gap patterns
      const existingGaps = [
        {
          id: "g1",
          patternType: "predicted_gap",
          industry: "healthtech",
          framework: "hipaa",
          category: "endpoint",
          metric: "likelihood",
          value: 60,
          sampleSize: 6,
          confidence: 60,
          lastUpdatedAt: new Date(),
        },
      ];

      const db = createMockDb([commonPatterns, existingGaps]);
      const service = new LearningService(db as any);

      const predictions = await service.getPredictedGaps("healthtech", "hipaa");

      // p1 (value=75, confidence=100) and p2 (value=45, confidence=80) qualify (>= 30% and >= 50 confidence)
      // p3 (value=20) does not qualify (< 30%)
      // Plus one existing gap
      expect(predictions).toHaveLength(3);
      expect(predictions[0]).toEqual({
        framework: "hipaa",
        controlCategory: "encryption",
        likelihood: 75,
      });
      expect(predictions[1]).toEqual({
        framework: "hipaa",
        controlCategory: "iam",
        likelihood: 45,
      });
      expect(predictions[2]).toEqual({
        framework: "hipaa",
        controlCategory: "endpoint",
        likelihood: 60,
      });
    });

    it("returns empty when no high-occurrence patterns exist", async () => {
      const db = createMockDb([[], []]);
      const service = new LearningService(db as any);

      const predictions = await service.getPredictedGaps("ecommerce");

      expect(predictions).toHaveLength(0);
    });
  });

  describe("confidence calculation", () => {
    it("sampleSize=5 yields confidence=50", () => {
      const confidence = Math.min(5 * 10, 100);
      expect(confidence).toBe(50);
    });

    it("sampleSize=15 yields confidence=100 (capped)", () => {
      const confidence = Math.min(15 * 10, 100);
      expect(confidence).toBe(100);
    });

    it("sampleSize=1 yields confidence=10", () => {
      const confidence = Math.min(1 * 10, 100);
      expect(confidence).toBe(10);
    });

    it("sampleSize=10 yields confidence=100", () => {
      const confidence = Math.min(10 * 10, 100);
      expect(confidence).toBe(100);
    });
  });

  describe("listPatterns", () => {
    it("returns patterns and total", async () => {
      const patterns = [
        {
          id: "p1",
          patternType: "common_finding",
          industry: "fintech",
          framework: null,
          category: "iam",
          metric: "occurrence_rate",
          value: 65,
          sampleSize: 10,
          confidence: 100,
          lastUpdatedAt: new Date(),
        },
      ];

      const db = createMockDb([
        patterns, // select for rows
        [{ total: 1 }], // select for count
      ]);
      const service = new LearningService(db as any);

      const result = await service.listPatterns({ industry: "fintech" });

      expect(result.patterns).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });
});
