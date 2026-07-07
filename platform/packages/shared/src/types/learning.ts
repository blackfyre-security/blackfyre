export interface LearningPattern {
  id: string;
  patternType: "common_finding" | "false_positive" | "remediation_rate" | "predicted_gap";
  industry: string;
  framework?: string;
  category: string;
  metric: string;
  value: number;
  sampleSize: number;
  confidence: number;
  lastUpdatedAt: Date;
}

export interface IndustryInsight {
  industry: string;
  commonFindings: { category: string; occurrenceRate: number; sampleSize: number }[];
  avgRemediationDays: { category: string; avgDays: number }[];
  falsePositiveRates: { category: string; rate: number }[];
  predictedGaps: { framework: string; controlCategory: string; likelihood: number }[];
}

export interface LearningStats {
  totalPatterns: number;
  patternsByType: Record<string, number>;
  industriesCovered: string[];
  avgConfidence: number;
}
