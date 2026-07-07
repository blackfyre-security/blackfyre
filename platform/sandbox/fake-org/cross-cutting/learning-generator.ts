/**
 * learning-generator.ts
 * Generates AI learning patterns per industry with trend points.
 */

export interface TrendPoint {
  month: string;
  findings: number;
  remediationDays: number;
  score: number;
}

export interface IndustryPattern {
  industry: string;
  commonFindings: string[];
  avgRemediationDays: number;
  falsePositiveRates: Record<string, number>;
  predictedGaps: string[];
  totalPatterns: number;
  avgConfidence: number;
  trendPoints: TrendPoint[];
}

export interface LearningBundle {
  patterns: IndustryPattern[];
  byIndustry: Record<string, IndustryPattern>;
  generatedAt: string;
  modelVersion: string;
}

function last12Months(): string[] {
  const months: string[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return months;
}

function generateTrend(
  basefindings: number,
  baseScore: number,
  seed: number
): TrendPoint[] {
  const months = last12Months();
  return months.map((month, idx) => {
    const wave = Math.sin((idx / 12) * Math.PI * 2) * 3;
    const drift = (idx / 12) * -2; // improving trend
    const findings = Math.max(5, Math.round(basefindings + wave + drift + ((seed % 7) - 3)));
    const remDays = Math.max(3, Math.round(14 + wave + drift));
    const score = Math.min(100, Math.max(40, Math.round(baseScore + idx * 0.5 + drift)));
    return { month, findings, remediationDays: remDays, score };
  });
}

const INDUSTRIES: IndustryPattern[] = [
  {
    industry: "fintech",
    commonFindings: [
      "IAM users without MFA",
      "Unencrypted data at rest (S3, RDS)",
      "Overly permissive security groups",
      "Secrets in environment variables",
      "Missing CloudTrail in all regions",
      "Service accounts with admin roles",
    ],
    avgRemediationDays: 12,
    falsePositiveRates: {
      iam: 0.04,
      encryption: 0.02,
      network: 0.08,
      logging: 0.03,
      config: 0.06,
    },
    predictedGaps: [
      "PCI-DSS v4.0 MFA requirement for all admin access",
      "DPDPA 2023 data localization enforcement",
      "AI model audit trails for credit decisioning",
      "Real-time payment fraud system logging",
    ],
    totalPatterns: 2847,
    avgConfidence: 0.87,
    trendPoints: generateTrend(32, 62, 7),
  },
  {
    industry: "healthtech",
    commonFindings: [
      "ePHI in unencrypted S3 buckets",
      "Missing HIPAA Business Associate Agreements",
      "Audit log gaps for ePHI access",
      "Lack of transmission security (TLS)",
      "IAM users accessing ePHI without MFA",
      "No PHI tokenization in test environments",
    ],
    avgRemediationDays: 18,
    falsePositiveRates: {
      iam: 0.05,
      encryption: 0.03,
      network: 0.07,
      logging: 0.04,
      config: 0.09,
    },
    predictedGaps: [
      "HIPAA ePHI in AI training pipelines",
      "State health data privacy law patchwork (SHIELD, etc.)",
      "Medical device IoT security gaps",
      "Genomic data handling under emerging state laws",
    ],
    totalPatterns: 1923,
    avgConfidence: 0.84,
    trendPoints: generateTrend(28, 55, 13),
  },
  {
    industry: "saas",
    commonFindings: [
      "Multi-tenant data isolation failures",
      "SSRF vulnerabilities in container workloads",
      "Kubernetes RBAC misconfiguration",
      "Public ECR/container registries",
      "Lack of egress filtering",
      "Insufficient rate limiting on APIs",
    ],
    avgRemediationDays: 8,
    falsePositiveRates: {
      iam: 0.06,
      encryption: 0.04,
      network: 0.12,
      logging: 0.05,
      config: 0.10,
    },
    predictedGaps: [
      "AI/LLM prompt injection security controls",
      "SOC 2 Type II AI system coverage",
      "Customer data deletion automation for GDPR",
      "API security posture management",
    ],
    totalPatterns: 3412,
    avgConfidence: 0.91,
    trendPoints: generateTrend(45, 70, 19),
  },
  {
    industry: "ecommerce",
    commonFindings: [
      "PCI-DSS scope creep (card data in logs)",
      "SQL injection in legacy admin panels",
      "Third-party JavaScript supply chain risks",
      "Customer PII in S3 without lifecycle policies",
      "WAF bypass via header manipulation",
      "Outdated TLS on payment endpoints",
    ],
    avgRemediationDays: 15,
    falsePositiveRates: {
      iam: 0.07,
      encryption: 0.05,
      network: 0.11,
      logging: 0.06,
      config: 0.08,
    },
    predictedGaps: [
      "PCI-DSS v4.0 client-side script management (Req 6.4.3)",
      "Cookie consent and tracking pixel compliance",
      "CCPA opt-out signal handling",
      "Dependency confusion attacks in CI/CD",
    ],
    totalPatterns: 2156,
    avgConfidence: 0.82,
    trendPoints: generateTrend(38, 58, 23),
  },
  {
    industry: "manufacturing",
    commonFindings: [
      "OT/IT network convergence without segmentation",
      "Legacy industrial control systems without patches",
      "Remote access to OT via flat network",
      "Default credentials on IoT/SCADA devices",
      "Unencrypted OPC-UA communications",
      "No asset inventory for OT endpoints",
    ],
    avgRemediationDays: 45,
    falsePositiveRates: {
      iam: 0.08,
      encryption: 0.06,
      network: 0.15,
      logging: 0.09,
      config: 0.12,
    },
    predictedGaps: [
      "IEC 62443 OT security standard adoption",
      "NIS2 Directive compliance for critical infrastructure",
      "AI-driven anomaly detection for SCADA",
      "Supply chain firmware integrity verification",
    ],
    totalPatterns: 1247,
    avgConfidence: 0.78,
    trendPoints: generateTrend(22, 47, 29),
  },
];

export function generateLearning(): LearningBundle {
  const byIndustry: Record<string, IndustryPattern> = {};
  for (const pattern of INDUSTRIES) {
    byIndustry[pattern.industry] = pattern;
  }

  return {
    patterns: INDUSTRIES,
    byIndustry,
    generatedAt: new Date().toISOString(),
    modelVersion: "blackfyre-ml-v2.4.1",
  };
}
